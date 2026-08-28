#!/usr/bin/env bash
set -euo pipefail

service_name="Bluesky Wally Builds API"
account_name="wallybuildsai.bsky.social"

printf 'Paste the Bluesky app password (input stays hidden): '
IFS= read -r -s app_password
printf '\n'

if [[ -z "$app_password" ]]; then
  printf 'No password entered; nothing saved.\n' >&2
  exit 1
fi

security add-generic-password -U \
  -a "$account_name" \
  -s "$service_name" \
  -w "$app_password" >/dev/null

unset app_password
printf 'Saved the Bluesky app password in macOS Keychain.\n'
