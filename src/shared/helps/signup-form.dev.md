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

## Integrating a password-based sign-up form

To integrate a **password-based sign-up form** that works seamlessly with
browser password managers, you need to structure your form with semantic HTML
and configure the appropriate input attributes.

- **Use semantic HTML:** Build the form using native `<form>`, `<input>`, and
  `<button type="submit">` elements to ensure accessibility, keyboard
  navigation, and reliable integration with browser password managers.
- **Configure username autocomplete:** Set `autocomplete="username"` on the
  username or identifier `<input>` element so password managers associate the
  correct identifier with the saved password.
- **Configure new-password autocomplete:** Set `autocomplete="new-password"` on
  both the password and password confirmation `<input>` elements. This signals
  browser password managers to suggest a strong, auto-generated password instead
  of autofilling an existing credential.

### Best practices & advanced UX

Consider these patterns to improve the sign-up experience:

- **Form simplicity:** Ask only for essential information during registration
  (such as a username, password, and optional display name) to reduce cognitive
  load and form abandonment.
- **Unrestricted password rules:** Avoid overly restrictive password composition
  rules (such as banning special characters or limiting maximum length) that
  interfere with password managers generating strong, complex passwords.
- **Allow pasting passwords:** Never disable copy-and-paste on password fields
  so users can paste credentials from external password managers.
- **Password visibility toggle:** Provide a control that switches the password
  `<input>` `type` between `password` and `text` so users can verify their entry
  and avoid typing errors.

### Developer resources

- **Guide:** [Sign-up form best
  practices](https://web.dev/articles/sign-up-form-best-practices) (web.dev)
- **Guide:** [Help users sign in with
  autofill](https://developer.chrome.com/docs/identity/autofill) (Chrome for
  Developers)
