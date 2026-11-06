# Changelog

## 0.1.2

- Fix every change from the sidebar panel failing with 400 ("This field is required"): Ingress
  sends request bodies chunked and Paperless read them as empty. nginx now buffers the body
  and forwards it with a Content-Length.

## 0.1.1

- Fix login from the sidebar panel: nginx drops the `Origin: null` header that the Ingress
  iframe sends, which Django rejected as a CSRF failure (403).

## 0.1.0

- First version: Paperless-ngx 2.20.15 with local Redis and nginx, Ingress (sidebar panel) and a
  LAN port for the mobile app. Documents on `/share/paperless` (the `paperless` network storage),
  database and index in the add-on config folder. OCR languages: Dutch, English, Turkish.
