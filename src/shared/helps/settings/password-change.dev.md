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

## Integrating a secure password change flow

To build a secure, user-friendly password change experience, you should
implement standard autocomplete attributes, support the well-known URL redirect,
and enforce reauthentication for sensitive operations.

### Best practices & integration checklist

When implementing a password change form, ensure you follow these key technical
patterns:

- **Well-known redirection:** Configure a redirect from the well-known path
  `/.well-known/change-password` to your actual password change URL (e.g.,
  `/settings/password-change`). This allows password managers, browsers, and
  security tools to guide users directly to your change form.
- **Input autocomplete hints:** Use the correct `autocomplete` attributes on
  form inputs. Set the username input to `autocomplete="username"` (which can be
  hidden if the user is already signed in), and set both new password inputs to
  `autocomplete="new-password"`. This tells password managers to suggest
  generating a strong, unique password rather than autofilling the current
  password.
- **Reauthentication protection:** Guard the password change page and the API
  endpoint with a reauthentication check. If the user's active session is older
  than a set threshold (e.g., 5-10 minutes), require them to re-enter their
  current password or verify via a passkey before allowing access. This prevents
  unauthorized changes if a session is hijacked or left unattended.
- **Backend validation:** Ensure the backend validates that the new password
  meets strength requirements and that both submitted password fields match
  exactly before updating the database.

### Learning resources

- **Guide:** [Help users change passwords easily by adding a well-known URL for
  changing passwords](https://web.dev/articles/change-password-url) (web.dev)
- **Guide:** [Sign-in form best
  practices](https://web.dev/articles/sign-in-form-best-practices) (web.dev)
- **Guide:** [Sign-up form best
  practices](https://web.dev/articles/sign-up-form-best-practices) (web.dev)
