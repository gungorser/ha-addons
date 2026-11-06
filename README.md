# ha-addons

Home Assistant add-on repository of the Gungor house. One repository, one folder per add-on.

| Add-on | Folder | What it does |
|---|---|---|
| Paperless-ngx | [`paperless/`](paperless) | Document archive: OCR, tags, full-text search; documents on the `paperless` network storage |

## Install

Home Assistant: Settings -> Add-ons -> Add-on store -> menu -> Repositories, add
`https://github.com/gungorser/ha-addons`. Every add-on in this repository then shows in the store.

## Layout

Each add-on folder holds `config.yaml` (name, version, options, ports, folder maps), `build.yaml`
(pinned upstream image), `Dockerfile`, `rootfs/` (files copied into the image), `DOCS.md` (the
Documentation tab in Home Assistant) and `CHANGELOG.md`.

## Release

Home Assistant offers an update when `version` in an add-on's `config.yaml` changes on `master`.
Bump it with every change that should reach the house, add a `CHANGELOG.md` entry, merge the PR.
Install or update live only after Sercan approved it.

## Testing

Test an add-on image before it is merged. A cloud session can run Docker (`sudo dockerd` with the
session proxy in its environment). Docker Hub is reachable; `ghcr.io` blobs and the Debian mirrors
are not, so `apt-get` layers cannot be built there: build a test image from the upstream image plus
`rootfs/`, and run the packages the Dockerfile installs (redis, nginx) as their own Docker Hub
images on the host network. Each add-on's `DOCS.md` lists what to check.
