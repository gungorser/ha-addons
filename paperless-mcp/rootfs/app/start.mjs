// Add-on entry point.
//
// Runs paperless-mcp (Streamable HTTP, local only) and a small proxy in front
// of it. The proxy only answers on /<access_key>/mcp and adds the Paperless
// token as "Authorization: Bearer", so a client that cannot send headers
// (claude.ai custom connectors) can use the secret URL instead.

import { spawn } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";

const OPTIONS = "/data/options.json";
const KEY_FILE = "/data/access_key";
const UPLOAD_DIR = "/tmp/uploads";
const MCP_PORT = 3000;
const PROXY_PORT = 8100;

const options = JSON.parse(readFileSync(OPTIONS, "utf8"));

if (!options.paperless_token) {
  console.error(
    "[addon] paperless_token is empty: create a token in Paperless (My Profile -> API token) " +
      "and enter it in the add-on configuration.",
  );
  process.exit(1);
}

// The access key comes from the options, or is generated once and kept in /data.
let accessKey = options.access_key;
if (!accessKey) {
  if (!existsSync(KEY_FILE)) {
    writeFileSync(KEY_FILE, randomBytes(24).toString("hex"), { mode: 0o600 });
  }
  accessKey = readFileSync(KEY_FILE, "utf8").trim();
}
if (accessKey.length < 32 || !/^[A-Za-z0-9_-]+$/.test(accessKey)) {
  console.error("[addon] access_key must be at least 32 characters of A-Z, a-z, 0-9, - or _.");
  process.exit(1);
}

const mcpPath = `/${accessKey}/mcp`;
console.log(`[addon] MCP endpoint: <your public URL>${mcpPath}`);

// File uploads by path are limited to an empty folder, so the server cannot
// read files of the container (such as /data/options.json).
mkdirSync(UPLOAD_DIR, { recursive: true });

const env = {
  ...process.env,
  PAPERLESS_URL: options.paperless_url.replace(/\/+$/, ""),
  PAPERLESS_MCP_UPLOAD_PATHS: UPLOAD_DIR,
};
if (options.public_url) env.PAPERLESS_PUBLIC_URL = options.public_url.replace(/\/+$/, "");

// No server token and no --no-auth: paperless-mcp rejects requests that do
// not carry a token, and only the proxy below adds one.
const server = spawn("paperless-mcp", ["--http", "--port", String(MCP_PORT)], {
  env,
  stdio: "inherit",
});
server.on("exit", (code, signal) => {
  console.error(`[addon] paperless-mcp stopped (code ${code}, signal ${signal})`);
  process.exit(1);
});

const expected = Buffer.from(mcpPath);
function allowed(url) {
  const path = Buffer.from((url || "").split("?")[0]);
  return path.length === expected.length && timingSafeEqual(path, expected);
}

const proxy = http.createServer((req, res) => {
  if (!allowed(req.url)) {
    res.writeHead(404).end();
    return;
  }
  const headers = { ...req.headers, authorization: `Bearer ${options.paperless_token}` };
  delete headers.host;
  const upstream = http.request(
    {
      host: "127.0.0.1",
      port: MCP_PORT,
      method: req.method,
      path: "/mcp",
      headers,
    },
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
});
proxy.listen(PROXY_PORT, () => console.log(`[addon] proxy listening on ${PROXY_PORT}`));

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    server.kill("SIGTERM");
    process.exit(0);
  });
}
