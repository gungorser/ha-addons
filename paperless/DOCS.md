# Paperless-ngx

[Paperless-ngx](https://docs.paperless-ngx.com/) stores PDFs, reads them with OCR, sorts them with
tags, correspondents and document types, and finds them with full-text search.

## Before the first start

1. **Network storage.** Documents are written to `/share/paperless`. Add a network storage in
   Settings -> System -> Storage named `paperless`, usage **Share**, pointing at the folder on the
   NAS (Gungor house: server `192.168.0.221`, remote share `STORAGE/paperless`). Without it the
   documents land on the Home Assistant system disk.
2. **First user.** Set `admin_user` and `admin_password`. The account is created on start when no
   superuser exists yet; the options can be cleared afterwards.

## Using it

- **Sidebar:** the "Paperless" panel opens through Ingress, behind the Home Assistant login.
- **Adding PDFs:** drop them into `consume` (`\\<HA>\share\paperless\consume` through the Samba
  share, or the NAS folder `paperless\consume`). Subfolder names become tags
  (`consume/Vergi/x.pdf` gets the tag `Vergi`). The folder is checked every `consumer_polling`
  seconds, because network shares send no change events.
- **Mobile app:** server address `http://<HA IP>:8000` (home network only; do not forward this
  port to the internet).
- **Files on disk:** `media/documents/originals/<year>/<correspondent>/<title>.pdf`, readable
  without Paperless.

## Options

| Option | Default | Meaning |
|---|---|---|
| `ocr_language` | `nld+eng+tur` | Tesseract languages for OCR (installed: nld, eng, tur, deu, fra, ita, spa) |
| `time_zone` | `Europe/Amsterdam` | Paperless time zone |
| `filename_format` | `{{ created_year }}/{{ correspondent }}/{{ title }}` | Folder layout of the stored files |
| `consumer_recursive` | `true` | Also read subfolders of `consume` |
| `consumer_subdirs_as_tags` | `true` | Subfolder names become tags |
| `consumer_polling` | `60` | Seconds between checks of `consume` (0 = file events, not on network shares) |
| `csrf_trusted_origins` | HA and LAN URLs | Every URL Paperless is opened from; add the external HA URL (https) to use it from outside |
| `admin_user`, `admin_password` | empty | First superuser (see above) |
| `env_vars` | empty | Extra `PAPERLESS_*` settings, see the [configuration docs](https://docs.paperless-ngx.com/configuration/) |

## How it is built

- Upstream image `paperlessngx/paperless-ngx` (version in `build.yaml`) with its own s6 init.
- `init-addon` (first s6 step, `rootfs/usr/local/bin/addon-env.py`) turns the options into
  Paperless environment variables and writes `nginx.conf`.
- Paperless listens on `127.0.0.1:8000` under the Ingress path (`PAPERLESS_FORCE_SCRIPT_NAME`).
  nginx on `8099` (Ingress port, published as `8000`) adds that path back to requests that
  arrive without it, so the sidebar and the LAN port reach the same app.
- Redis runs inside the container, local only.
- Paperless runs as root (`USERMAP_UID=0`): the network share does not allow `chown`.
- Data: database, search index and the generated secret key in the add-on config folder
  (`/addon_configs/<slug>/`); documents in `/share/paperless/{consume,media}`.

## Checks after a change

Open the sidebar panel and log in; open `http://<HA IP>:8000` and log in; drop a PDF into
`consume/<folder>/` and see it appear with that tag; find the stored file under
`media/documents/originals/` on the NAS.
