<!--
 Copyright 2026 Google Inc. All rights reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
-->

## Passkey Management

On this page, you can experience a complete passkey management dashboard. Providing a user-friendly management interface is a crucial part of a great passkey implementation, allowing users to keep track of and control their security credentials.

### What you can do on this page:

- **Register a new passkey:** Seamlessly create and associate a new passkey with
  your account using your current device or a physical security key.
- **Rename a credential:** Assign friendly, custom names to your passkeys (e.g.,
  "Google Password Manager (second account)") so you can easily identify them
  later.
- **Delete a credential:** Revoke a passkey by removing its public key from the
  server. Once deleted, that specific passkey can no longer be used to sign in
  to your account. Matching passkey is evicted from the passkey provider if it
  supports Signal API.
- **View rich metadata:** Inspect detailed technical and contextual information about each registered credential, including:
  - **Credential name:** Passkey provider name (e.g., Google Password Manager,
    iCloud Keychain, Windows Hello) or a custome label you assigned.
  - **Registered date:** When the passkey was first registered.
  - **Last used date:** The timestamp of the most recent successful authentication.
  - **Sync state:** Whether the passkey is backed up and synchronized across the user's devices (a synced/multi-device passkey) or locked to a single physical device (a hardware-bound/single-device passkey).
