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

# Exit immediately if a command exits with a non-zero status.
set -e

# Stop any existing Caddy instances to prevent port conflicts.
# The '|| true' ensures the script doesn't exit if no Caddy processes are found.
echo "Attempting to stop any running Caddy instances..."
sudo killall caddy || true

RP_PORT=$(node -p "require('./rp-localhost.config.json').port")
IDP_PORT=$(node -p "require('./idp-localhost.config.json').port")

echo "Starting Caddy to proxy rp.localhost -> ${RP_PORT} and idp.localhost -> ${IDP_PORT}"
RP_PORT=${RP_PORT} IDP_PORT=${IDP_PORT} caddy run --config Caddyfile
