# Paperless MCP

Runs [paperless-mcp](https://github.com/baruchiro/paperless-mcp) (baruchiro) for the Paperless-ngx
add-on, so Claude can search, read, tag and upload documents. Clients log in with their Home
Assistant account: Home Assistant is the OAuth authorization server, and this add-on only lets in
Home Assistant users it allows. The endpoint is meant to be published through the reverse proxy
(Nginx Proxy Manager) over HTTPS and added to Claude as a custom connector.

## Before the first start

1. **Paperless token.** In Paperless: My Profile -> API Auth Token -> generate. Enter it as
   `paperless_token`. Claude acts in Paperless with this user's permissions.
2. **Home Assistant URL.** `ha_external_url` is the address Claude opens for the login (the public
   Home Assistant URL, https).
3. **Start** the add-on. The log shows `gateway listening on 8100` and who may log in.
4. **Reverse proxy.** Nginx Proxy Manager: new proxy host (for example `mcp.gungors.duckdns.org`)
   -> `http://192.168.0.221:8100`, Let's Encrypt certificate, Force SSL.
5. **Claude.** Settings -> Connectors -> Add custom connector, URL
   `https://mcp.gungors.duckdns.org/mcp`. If Claude asks for an OAuth client ID (Home Assistant has
   no client registration), enter `https://claude.ai` and leave the secret empty. Connecting opens
   the Home Assistant login; log in with an allowed user.

## Access

- Every request to `/mcp` needs a Home Assistant access token (`Authorization: Bearer`). The add-on
  asks Home Assistant who the token belongs to (websocket `auth/current_user`) and keeps the answer
  for one minute.
- `allowed_users` empty: Home Assistant administrators only. Otherwise only the listed users (user
  name, case-insensitive, or user id).
- Without a valid token the answer is 401 with a pointer to the OAuth metadata
  (`/.well-known/oauth-protected-resource`), which names Home Assistant as the authorization
  server. Every other path answers 404.
- The Paperless token never leaves the add-on.

## Options

| Option | Default | Meaning |
|---|---|---|
| `paperless_url` | `http://ffbb73c4-paperless:8099` | Paperless as reached from this add-on (the Paperless add-on's internal host name and port) |
| `paperless_token` | required | Paperless API token of the user Claude works as |
| `ha_external_url` | `https://homeassistant.gungors.duckdns.org` | Public Home Assistant URL, the OAuth login |
| `ha_internal_url` | `http://homeassistant:8123` | Home Assistant as reached from this add-on, for the token check |
| `allowed_users` | empty (administrators) | Home Assistant users who may use the MCP |
| `public_url` | empty | Public Paperless URL, used in document links (for example `https://paperless.gungors.duckdns.org`) |

## How it is built

- `node:22-alpine` with `@baruchiro/paperless-mcp` from npm, version pinned in the `Dockerfile`.
- `rootfs/app/start.mjs` starts paperless-mcp in HTTP mode on `127.0.0.1:3000` without a server
  token (it rejects requests without one) and a gateway on port `8100` that checks the Home
  Assistant token, then forwards `/mcp` with `Authorization: Bearer <paperless_token>`.
- Uploads by file path are limited to an empty folder, so the server cannot read the add-on's own
  files.
- Only the Streamable HTTP endpoint (`/mcp`) is published; the old SSE endpoint is not.

## Checks after a change

The log shows `gateway listening on 8100` and `MCP Stateless Streamable HTTP Server listening`.
`/mcp` without a token answers 401 with a `WWW-Authenticate` header. In Claude, the connector logs
in through Home Assistant, lists the Paperless tools, and `list_documents` returns the documents.
