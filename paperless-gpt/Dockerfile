# paperless-gpt (icereed), pinned. Bump together with config.yaml and CHANGELOG.md.
FROM docker.io/icereed/paperless-gpt:v0.31.0

COPY rootfs /
RUN chmod +x /usr/local/bin/addon-start.sh

# addon-start.sh turns /data/options.json into the environment, then hands
# over to the upstream entrypoint (which drops root).
WORKDIR /app/
ENTRYPOINT ["/usr/local/bin/addon-start.sh"]
