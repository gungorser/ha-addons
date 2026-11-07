# Paperless GPT

Runs [paperless-gpt](https://github.com/icereed/paperless-gpt) (icereed) for the Paperless-ngx
add-on. It sends the text of a document to an LLM and writes the suggested title, tags,
correspondent, document type and date back to Paperless. Optionally it reads bad scans with a
vision LLM (LLM OCR). Paperless keeps its own OCR and full-text search; this add-on only fills
fields.

paperless-gpt polls Paperless; Paperless does not call it. Which documents it handles is decided
by tags:

| Tag | What happens |
|---|---|
| `paperless-gpt-auto` | Processed automatically, the result is written straight to Paperless. Afterwards the tag is replaced by `paperless-gpt-auto-complete` |
| `paperless-gpt` | Shown in the add-on's web UI; you review and apply the suggestions |
| `paperless-gpt-ocr-auto` | LLM OCR (only when `vision_llm_provider` is set) |
| `paperless-gpt-failed` | Set by the add-on when a document could not be processed, so it is not retried forever |

## Before the first start

1. **Paperless token.** In Paperless: My Profile -> API Auth Token -> generate. Enter it as
   `paperless_token`. The add-on edits documents with this user's permissions.
2. **LLM.** Choose `llm_provider` and `llm_model`, and enter the API key of that provider
   (`anthropic_api_key`, `googleai_api_key`, `openai_api_key` or `mistral_api_key`). Keys of other
   providers may stay set: switching is then only a change of `llm_provider` and `llm_model`.
   Examples: `anthropic` / `claude-haiku-5-5`, `googleai` / a Gemini Flash model.
3. **Start** the add-on. The log shows `[addon] paperless ..., model ...` and
   `Server started on interface :8080`.
4. **New documents automatically.** In Paperless: Workflows -> new workflow, trigger "Document
   Added", action "Assignment" with tag `paperless-gpt-auto`. For old documents add the tag in bulk.

## Options

| Option | Default | Meaning |
|---|---|---|
| `paperless_url` | `http://ffbb73c4-paperless:8099` | Paperless as reached from this add-on |
| `paperless_token` | required | Paperless API token |
| `paperless_public_url` | `https://paperless.gungors.duckdns.org` | Paperless address used for document links in the web UI |
| `llm_provider` | `anthropic` | `anthropic`, `googleai`, `openai`, `mistral` or `ollama` |
| `llm_model` | `claude-haiku-5-5` | Model name of that provider |
| `anthropic_api_key`, `googleai_api_key`, `openai_api_key`, `mistral_api_key` | empty | API keys; the one of `llm_provider` (and `vision_llm_provider`) is required |
| `llm_language` | `Dutch, Turkish or English` | Hint to the LLM which language the documents are in ("The content is likely in ..."). It does not set the language of the titles: those usually follow the document. To force one, edit `title_prompt.tmpl` in the prompts folder |
| `vision_llm_provider` | `none` | LLM OCR provider; `none` keeps LLM OCR off |
| `vision_llm_model` | empty | Vision model, required when `vision_llm_provider` is set |
| `create_new_tags` | `false` | Allow the LLM to create tags that do not exist yet |
| `log_level` | `info` | `debug`, `info`, `warn` or `error` |
| `env_vars` | empty | Any other paperless-gpt variable (README of paperless-gpt), for example `TOKEN_LIMIT`, `OLLAMA_HOST`, `OPENAI_BASE_URL`. The options above win over the same name here |

## OCR and tagging in one pass

paperless-gpt AI workflows can run LLM OCR first and then generate the metadata from the clean
text. The house uses one created in the web UI (stored in the prompts folder,
`workflows/ocr-ve-etiket/`): trigger tag `ai-isle`, OCR on, all steps default. A Paperless
workflow (trigger "Document Added", assign tag `ai-isle`) sends every new document through it.
For old documents, add `ai-isle` in bulk.

## Models (checked 2026-11-07)

- Google AI: `gemini-3.5-flash-lite` works for tagging and OCR. `gemini-2.5-flash` is closed to
  new API users (404); `gemini-3.8-flash` hung without answer on the free tier (20 requests a
  day). Free tier for 3.5 Flash-Lite is about 500 requests a day: a document takes 5 requests for
  tagging plus 1 per page for OCR. `GOOGLEAI_THINKING_BUDGET` gives 400 on Gemini 3 models.
- Anthropic: `claude-haiku-5-5` needs prepaid API credits (console.anthropic.com), separate from
  a claude.ai subscription.

## Cost and privacy

Every processed document's text (and for LLM OCR, page images) goes to the chosen provider. Use a
paid API plan whose terms exclude training on the data. LLM OCR costs much more than tagging: keep
it for bad scans only, via the `paperless-gpt-ocr-auto` tag.

## How it is built

- `icereed/paperless-gpt` from Docker Hub, version pinned in the `Dockerfile`.
- `rootfs/usr/local/bin/addon-start.sh` maps `/data/options.json` to the environment (the image has
  no jq, so a small awk reader), links `/app/db` and `/app/config` to `/data` and `/app/prompts` to
  the add-on config folder (`/addon_configs/<slug>/prompts`, editable; upstream defaults are copied
  on first start), then runs the upstream entrypoint, which drops to user 10001.
- paperless-gpt has no login of its own, so no port is published: the web UI is reached only
  through Ingress (Home Assistant login). Its frontend uses relative paths and works under the
  Ingress prefix. paperless-gpt warns that `/app/config`, `/app/db` and `/app/prompts` are "not on a
  volume": they are links into `/data` and `/config`, which are.

## Checks after a change

- The log shows `[addon] paperless ..., model ...`, `Starting application as 10001:10001` and
  `Server started on interface :8080`, and no `Error in background tagging`.
- The panel (Ingress) opens the web UI, and History lists earlier changes.
- A test document tagged `paperless-gpt-auto` gets a title, tags, correspondent, document type and
  date within a minute and then carries `paperless-gpt-auto-complete`.
- With the key of `llm_provider` empty, the add-on stops with `[addon] ERROR: ... api_key is empty`.
