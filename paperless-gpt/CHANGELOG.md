# Changelog

## 0.1.2

- LLM OCR page images default to about 200 DPI (`IMAGE_MAX_RENDER_DPI` 200,
  `IMAGE_MAX_PIXEL_DIMENSION` 2400, `IMAGE_MAX_TOTAL_PIXELS` 4000000). The upstream 600 DPI
  renders ran the Raspberry Pi 4 out of memory on a 4-page scan.

## 0.1.1

- `llm_language` default `Dutch, Turkish or English`; documented that it is a hint about the
  documents' language, not the language of the titles.

## 0.1.0

- First version: paperless-gpt v0.31.0 (icereed) for the Paperless-ngx add-on. Web UI through
  Ingress only. LLM provider, model and API keys (Anthropic, Google AI, OpenAI, Mistral) are add-on
  options, so the provider can be switched without other changes. LLM OCR off by default.
