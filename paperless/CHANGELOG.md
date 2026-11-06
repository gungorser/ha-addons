# Changelog

## 0.1.1

- Fix login from the sidebar panel: nginx drops the `Origin: null` header that the Ingress
  iframe sends, which Django rejected as a CSRF failure (403).

## 0.1.0

- First version: Paperless-ngx 2.20.15 with local Redis and nginx, Ingress (sidebar panel) and a
  LAN port for the mobile app. Documents on `/share/paperless` (the `paperless` network storage),
  database and index in the add-on config folder. OCR languages: Dutch, English, Turkish.
