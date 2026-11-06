ARG BUILD_FROM
FROM ${BUILD_FROM}

# Redis (task broker, local only), nginx (Ingress + LAN entry) and the
# extra OCR languages, installed at build time so start-up needs no network.
RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        redis-server \
        nginx \
        tesseract-ocr-nld \
        tesseract-ocr-tur \
    && rm -rf /var/lib/apt/lists/* /etc/nginx/sites-enabled/default

COPY rootfs /
RUN chmod +x /usr/local/bin/addon-env.py \
    /etc/s6-overlay/s6-rc.d/*/run
