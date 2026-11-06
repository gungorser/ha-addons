// Add-on entry point.
//
// Runs paperless-mcp (Streamable HTTP, local only) and a small gateway in
// front of it. Clients log in with their Home Assistant account (OAuth, Home
// Assistant is the authorization server); the gateway checks the Home
// Assistant access token, then calls paperless-mcp with the Paperless token.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import http from "node:http";

const OPTIONS = "/data/options.json";
const UPLOAD_DIR = "/tmp/uploads";
const MCP_PORT = 3000;
const GATEWAY_PORT = 8100;
const CACHE_MS = 60_000;

const options = JSON.parse(readFileSync(OPTIONS, "utf8"));
const trimSlash = (url) => url.replace(/\/+$/, "");

if (!options.paperless_token) {
  console.error(
    "[addon] paperless_token is empty: create a token in Paperless (My Profile -> API Auth Token) " +
      "and enter it in the add-on configuration.",
  );
  process.exit(1);
}
const haExternal = trimSlash(options.ha_external_url);
const haInternal = trimSlash(options.ha_internal_url);
const allowedUsers = (options.allowed_users || []).map((u) => u.toLowerCase());
console.log(
  `[addon] login through ${haExternal}; allowed: ` +
    (allowedUsers.length ? allowedUsers.join(", ") : "Home Assistant administrators"),
);

// File uploads by path are limited to an empty folder, so the server cannot
// read files of the container (such as /data/options.json).
mkdirSync(UPLOAD_DIR, { recursive: true });

const env = {
  ...process.env,
  PAPERLESS_URL: trimSlash(options.paperless_url),
  PAPERLESS_MCP_UPLOAD_PATHS: UPLOAD_DIR,
};
if (options.public_url) env.PAPERLESS_PUBLIC_URL = trimSlash(options.public_url);

// No server token and no --no-auth: paperless-mcp rejects requests that do
// not carry a token, and only the gateway below adds one.
const server = spawn("paperless-mcp", ["--http", "--port", String(MCP_PORT)], {
  env,
  stdio: "inherit",
});
server.on("exit", (code, signal) => {
  console.error(`[addon] paperless-mcp stopped (code ${code}, signal ${signal})`);
  process.exit(1);
});

// --- Home Assistant token check -------------------------------------------

// The Home Assistant user behind an access token, or null when the token is
// not valid. Uses the websocket API: auth, then auth/current_user.
function haUser(token) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${haInternal.replace(/^http/, "ws")}/api/websocket`);
    const done = (user) => {
      clearTimeout(timer);
      try {
        ws.close();
      } catch {}
      resolve(user);
    };
    const timer = setTimeout(() => done(null), 10_000);
    ws.onerror = () => done(null);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "auth_required") {
        ws.send(JSON.stringify({ type: "auth", access_token: token }));
      } else if (msg.type === "auth_ok") {
        ws.send(JSON.stringify({ id: 1, type: "auth/current_user" }));
      } else if (msg.type === "auth_invalid") {
        done(null);
      } else if (msg.type === "result" && msg.id === 1) {
        done(msg.success ? msg.result : null);
      }
    };
  });
}

function userAllowed(user) {
  if (!user) return false;
  if (!allowedUsers.length) return user.is_admin === true;
  return allowedUsers.includes(String(user.name).toLowerCase()) || allowedUsers.includes(user.id);
}

// token hash -> { ok, until }
const cache = new Map();
async function tokenAllowed(token) {
  const key = createHash("sha256").update(token).digest("hex");
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.until > now) return hit.ok;
  const user = await haUser(token);
  const ok = userAllowed(user);
  if (user && !ok) console.log(`[addon] denied Home Assistant user ${user.name}`);
  for (const [k, v] of cache) if (v.until <= now) cache.delete(k);
  cache.set(key, { ok, until: now + CACHE_MS });
  return ok;
}

// --- Gateway ----------------------------------------------------------------

// The public base URL as the client sees it (behind the reverse proxy).
function publicBase(req) {
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  return `${proto}://${host}`;
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

// OAuth protected resource metadata (RFC 9728): Home Assistant is the
// authorization server.
function resourceMetadata(req, res) {
  sendJson(res, 200, {
    resource: `${publicBase(req)}/mcp`,
    authorization_servers: [haExternal],
    bearer_methods_supported: ["header"],
    resource_name: "Paperless",
  });
}

function forward(req, res) {
  const headers = { ...req.headers, authorization: `Bearer ${options.paperless_token}` };
  delete headers.host;
  const upstream = http.request(
    { host: "127.0.0.1", port: MCP_PORT, method: req.method, path: "/mcp", headers },
    (up) => {
      res.writeHead(up.statusCode, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  req.pipe(upstream);
}

const gateway = http.createServer(async (req, res) => {
  const path = (req.url || "").split("?")[0];

  if (
    req.method === "GET" &&
    (path === "/.well-known/oauth-protected-resource" ||
      path === "/.well-known/oauth-protected-resource/mcp")
  ) {
    resourceMetadata(req, res);
    return;
  }
  if (path !== "/mcp") {
    res.writeHead(404).end();
    return;
  }

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || !(await tokenAllowed(token))) {
    req.resume();
    sendJson(
      res,
      401,
      { error: "invalid_token" },
      {
        "www-authenticate": `Bearer resource_metadata="${publicBase(req)}/.well-known/oauth-protected-resource"`,
      },
    );
    return;
  }
  forward(req, res);
});
gateway.listen(GATEWAY_PORT, () => console.log(`[addon] gateway listening on ${GATEWAY_PORT}`));

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    server.kill("SIGTERM");
    process.exit(0);
  });
}
