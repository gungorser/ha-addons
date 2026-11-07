#!/bin/sh
# Add-on entry point: maps /data/options.json to paperless-gpt environment
# variables, keeps state in /data and the prompts in the add-on config folder,
# then starts the upstream entrypoint.
set -eu

OPTIONS=${ADDON_OPTIONS:-/data/options.json}
DATA=${ADDON_DATA:-/data}
PROMPTS=${ADDON_PROMPTS:-/config/prompts}
APP_UID=10001

log() { echo "[addon] $*"; }
fail() { echo "[addon] ERROR: $*" >&2; exit 1; }

[ -r "$OPTIONS" ] || fail "$OPTIONS not found"

# The image has no jq: a small JSON reader in awk. Top-level scalars become
# opt_<key>='value', env_vars entries become export NAME='value'. Values are
# single-quoted for the shell, so eval only ever assigns.
parse_options() {
  awk '
    function q(v) { gsub(/\047/, "\047\\\047\047", v); return "\047" v "\047" }
    BEGIN { RS = "\001" }
    { s = s $0 }
    END {
      n = length(s); t = 0
      for (i = 1; i <= n; i++) {
        c = substr(s, i, 1)
        if (index(" \t\r\n", c)) continue
        if (index("{}[],:", c)) { tok[++t] = c; typ[t] = c; continue }
        if (c == "\"") {
          v = ""
          for (i++; i <= n; i++) {
            c = substr(s, i, 1)
            if (c == "\"") break
            if (c == "\\") {
              i++; c = substr(s, i, 1)
              if (c == "n" || c == "r" || c == "t") c = " "
              else if (c == "b" || c == "f") c = ""
              else if (c == "u") { c = "?"; i += 4 }
            }
            v = v c
          }
          tok[++t] = v; typ[t] = "s"; continue
        }
        v = ""
        while (i <= n && !index(" \t\r\n{}[],:", substr(s, i, 1))) { v = v substr(s, i, 1); i++ }
        i--
        tok[++t] = v; typ[t] = "s"
      }
      # Walk the top-level object.
      depth = 0
      for (p = 1; p <= t; p++) {
        if (typ[p] == "{" || typ[p] == "[") { depth++; continue }
        if (typ[p] == "}" || typ[p] == "]") { depth--; continue }
        if (depth != 1 || typ[p] != "s" || typ[p + 1] != ":") continue
        key = tok[p]; p += 2
        if (typ[p] == "s") {
          if (key ~ /^[a-z_]+$/) print "opt_" key "=" q(tok[p])
          continue
        }
        if (key != "env_vars" || typ[p] != "[") { p--; continue }
        # env_vars: [ {"name": ..., "value": ...}, ... ]
        d = 0
        for (; p <= t; p++) {
          if (typ[p] == "[" || typ[p] == "{") { d++; if (typ[p] == "{") { name = ""; val = "" } continue }
          if (typ[p] == "]" || typ[p] == "}") {
            d--
            if (typ[p] == "}" && name ~ /^[A-Z][A-Z0-9_]*$/) print "export " name "=" q(val)
            if (d == 0) break
            continue
          }
          if (typ[p] == "s" && typ[p + 1] == ":") {
            if (tok[p] == "name") name = tok[p + 2]
            if (tok[p] == "value") val = tok[p + 2]
            p += 2
          }
        }
      }
    }
  ' "$OPTIONS"
}

opt_paperless_url=; opt_paperless_token=; opt_paperless_public_url=
opt_llm_provider=; opt_llm_model=; opt_llm_language=
opt_anthropic_api_key=; opt_googleai_api_key=; opt_openai_api_key=; opt_mistral_api_key=
opt_vision_llm_provider=none; opt_vision_llm_model=
opt_create_new_tags=false; opt_log_level=info
eval "$(parse_options)"

[ -n "$opt_paperless_token" ] || fail "paperless_token is empty: create a token in Paperless (My Profile -> API Auth Token) and enter it in the add-on configuration."
[ -n "$opt_llm_model" ] || fail "llm_model is empty."

# The API key of a provider, by provider name.
provider_key() {
  case "$1" in
    anthropic) echo "$opt_anthropic_api_key" ;;
    googleai) echo "$opt_googleai_api_key" ;;
    openai) echo "$opt_openai_api_key" ;;
    mistral) echo "$opt_mistral_api_key" ;;
    *) echo "local" ;;
  esac
}
[ -n "$(provider_key "$opt_llm_provider")" ] || fail "llm_provider is $opt_llm_provider but ${opt_llm_provider}_api_key is empty."

export PAPERLESS_BASE_URL="${opt_paperless_url%/}"
export PAPERLESS_API_TOKEN="$opt_paperless_token"
[ -z "$opt_paperless_public_url" ] || export PAPERLESS_PUBLIC_URL="${opt_paperless_public_url%/}"
export LLM_PROVIDER="$opt_llm_provider"
export LLM_MODEL="$opt_llm_model"
export LLM_LANGUAGE="$opt_llm_language"
export CREATE_NEW_TAGS="$opt_create_new_tags"
export LOG_LEVEL="$opt_log_level"
# Every key that is set, so switching the provider needs no other change.
[ -z "$opt_anthropic_api_key" ] || export ANTHROPIC_API_KEY="$opt_anthropic_api_key"
[ -z "$opt_googleai_api_key" ] || export GOOGLEAI_API_KEY="$opt_googleai_api_key"
[ -z "$opt_openai_api_key" ] || export OPENAI_API_KEY="$opt_openai_api_key"
[ -z "$opt_mistral_api_key" ] || export MISTRAL_API_KEY="$opt_mistral_api_key"

if [ "$opt_vision_llm_provider" = none ]; then
  log "LLM OCR off (vision_llm_provider: none); Paperless keeps its own OCR"
else
  [ -n "$opt_vision_llm_model" ] || fail "vision_llm_provider is $opt_vision_llm_provider but vision_llm_model is empty."
  [ -n "$(provider_key "$opt_vision_llm_provider")" ] || fail "vision_llm_provider is $opt_vision_llm_provider but ${opt_vision_llm_provider}_api_key is empty."
  export OCR_PROVIDER=llm
  export VISION_LLM_PROVIDER="$opt_vision_llm_provider"
  export VISION_LLM_MODEL="$opt_vision_llm_model"
  log "LLM OCR on: $opt_vision_llm_provider / $opt_vision_llm_model"
fi

# Page images for LLM OCR: upstream renders up to 600 DPI (about 5000x7500
# pixels per A4 page), which runs a Raspberry Pi 4 out of memory and costs
# more tokens. These defaults keep pages near 200 DPI; env_vars can override.
export IMAGE_MAX_RENDER_DPI="${IMAGE_MAX_RENDER_DPI:-200}"
export IMAGE_MAX_PIXEL_DIMENSION="${IMAGE_MAX_PIXEL_DIMENSION:-2400}"
export IMAGE_MAX_TOTAL_PIXELS="${IMAGE_MAX_TOTAL_PIXELS:-4000000}"

# State survives updates: undo history and UI settings in /data, prompts in
# the add-on config folder (editable, upstream defaults copied on first start).
mkdir -p "$DATA/db" "$DATA/config" "$PROMPTS"
for dir in db config prompts; do
  target="$DATA/$dir"; [ "$dir" = prompts ] && target="$PROMPTS"
  rm -rf "/app/$dir"
  ln -s "$target" "/app/$dir"
done
chown -R "$APP_UID:$APP_UID" "$DATA/db" "$DATA/config" "$PROMPTS"
export PUID=$APP_UID PGID=$APP_UID

log "paperless $PAPERLESS_BASE_URL, model $LLM_PROVIDER / $LLM_MODEL, language $LLM_LANGUAGE"
cd /app
exec /app/entrypoint.sh
