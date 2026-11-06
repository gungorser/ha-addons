FROM docker.io/library/node:22-alpine

# The MCP server, pinned. Bump together with config.yaml and CHANGELOG.md.
ARG PAPERLESS_MCP_VERSION=2.2.1
RUN npm install --global --omit=dev "@baruchiro/paperless-mcp@${PAPERLESS_MCP_VERSION}" \
    && npm cache clean --force

COPY rootfs /
CMD ["node", "/app/start.mjs"]
