#!/bin/sh
#
# Copyright 2025 Google Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -e

LOG_FILE="caddy.log"

# --- Startup and Cleanup ---
echo "Attempting to stop any running Caddy instances..."
npx caddy stop > /dev/null 2>&1 || sudo killall caddy > /dev/null 2>&1 || true

# --- Get Ports ---
RP_PORT=$(node -p "require('./rp-localhost.config.json').port" | sed 's/\x1b\[[0-9;]*m//g')
IDP_PORT=$(node -p "require('./idp-localhost.config.json').port" | sed 's/\x1b\[[0-9;]*m//g')


# Inform the user where the logs will be.
echo "Caddy logs will be stored in ${LOG_FILE}. Tailing this file in another terminal..."
echo "To monitor logs, run: tail -f ${LOG_FILE}"

# Run Caddy, redirecting all output, and provide a custom failure message.
# The parentheses group the command and its redirections.
(
  RP_PORT=${RP_PORT} IDP_PORT=${IDP_PORT} npx caddy run --config Caddyfile > "${LOG_FILE}" 2>&1
) || {
  # This code runs ONLY if the Caddy process exits with a non-zero status (an error).
  echo "Caddy process failed. See ${LOG_FILE} for details." >&2
  exit 1 # Ensure the script exits with a failure code
}
