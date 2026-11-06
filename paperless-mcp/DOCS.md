# Paperless MCP

Runs [paperless-mcp](https://github.com/baruchiro/paperless-mcp) (baruchiro) for the Paperless-ngx
add-on, so Claude can search, read, tag and upload documents. The endpoint is meant to be published
through the reverse proxy (Nginx Proxy Manager) over HTTPS and added to Claude as a custom connector.

## Before the first start

1. **Paperless token.** In Paperless: My Profile -> API Auth Token -> generate. Enter it as
   `paperless_token`. Claude acts with this user's permissions.
2. **Start** the add-on. The log shows the endpoint path:
   `[addon] MCP endpoint: <your public URL>/<access key>/mcp`.
3. **Reverse proxy.** Nginx Proxy Manager: new proxy host (for example `mcp.gungors.duckdns.org`)
   -> `http://192.168.0.221:8100`, Let's Encrypt certificate, Force SSL.
4. **Claude.** Settings -> Connectors -> Add custom connector, URL
   `https://mcp.gungors.duckdns.org/<access key>/mcp`.

## Access

The access key in the path is the only login: whoever knows the full URL can read and change all
documents of the token's user. Keep the URL private, use it only over HTTPS. Every other path
answers 404. To revoke access, set a new `access_key` (or delete `/data/access_key` by reinstalling)
and update the connector URL.

## Options

| Option | Default | Meaning |
|---|---|---|
| `paperless_url` | `http://ffbb73c4-paperless:8099` | Paperless as reached from this add-on (the Paperless add-on's internal host name and port) |
| `paperless_token` | required | Paperless API token of the user Claude works as |
| `public_url` | empty | Public Paperless URL, used in document links (for example `https://paperless.gungors.duckdns.org`) |
| `access_key` | generated | Secret path segment, at least 32 characters; generated once and kept when empty |

## How it is built

- `node:22-alpine` with `@baruchiro/paperless-mcp` from npm, version pinned in the `Dockerfile`.
- `rootfs/app/start.mjs` starts paperless-mcp in HTTP mode on `127.0.0.1:3000` without a server
  token (it rejects requests without one) and a small proxy on port `8100` that only forwards
  `/<access key>/mcp` and adds `Authorization: Bearer <paperless_token>`.
- Uploads by file path are limited to an empty folder, so the server cannot read the add-on's own
  files.
- Only the Streamable HTTP endpoint (`/mcp`) is published; the old SSE endpoint is not.

## Checks after a change

The log shows `proxy listening on 8100` and `MCP Stateless Streamable HTTP Server listening`. A
request to any other path answers 404. In Claude, the connector lists the Paperless tools and
`list_documents` returns the documents.
