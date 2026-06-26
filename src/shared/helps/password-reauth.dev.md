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

## Integrating password-based reauthentication

Reauthentication ensures that users re-verify their credentials before
performing highly sensitive actions, protecting active sessions from
unauthorized physical access or hijacking.

### Best practices & integration checklist

To implement a secure and seamless reauthentication flow, follow these technical patterns:

- **Session expiry tracking:** Track the exact timestamp of the user's last
  credential verification (e.g., `last_signedin_at` in the session). Define a
  short-duration threshold (e.g., 3 to 15 minutes) after which sensitive routes
  require a new verification ceremony.
- **Destination preservation:** When redirecting a user to the reauthentication
  page, pass the original target path (e.g., as a query parameter:
  `/password-reauth?r=/settings/password-change`). After successful
  re-verification, automatically redirect the user back to their intended
  destination.
- **Open redirect prevention:** When performing the post-verification redirect
  using a query parameter, validate that the target URL is a relative path or
  belongs to the same origin. Never redirect to arbitrary external URLs, which
  would expose your application to open redirect vulnerabilities.
- **Correct input autocomplete:** Structure your reauthentication form with the
  username field (can be hidden since the user is already signed in) and the
  password input set to `autocomplete="current-password"`. This prompts password
  managers to autofill the user's existing password.
- **Second-factor / passkey fallback:** Reauthenticating just with a password
  isn't strong enough. Consider a second factor as a step-up, or allow the user
  to verify using a passkey (`/passkey-reauth`).
