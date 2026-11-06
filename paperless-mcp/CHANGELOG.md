# Changelog

## 0.2.0

- Login with the Home Assistant account (OAuth, Home Assistant is the authorization server)
  instead of a secret path. New options `ha_external_url`, `ha_internal_url`, `allowed_users`
  (empty: administrators only); `access_key` removed. The endpoint is now `/mcp`.

## 0.1.0

- First version: paperless-mcp 2.2.1 (baruchiro) in HTTP mode behind a secret-path proxy on port
  8100, for the Paperless-ngx add-on.
