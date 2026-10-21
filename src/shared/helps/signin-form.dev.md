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

## Integrating a password-based sign-in form

To integrate a **password-based sign-in form** that works seamlessly with
browser autofill and password managers, you need to structure your form with
semantic HTML and configure the appropriate input attributes.

- **Use semantic HTML:** Wrap input fields in a `<form>` element, associate each
  `<input>` with a `<label>`, and use a `<button type="submit">` with a clear
  action label (such as **Sign in** or **Login**).
- **Use stable identifiers:** Assign consistent `id` and `name` attributes
  (such as `id="username"` and `name="username"`) across builds so password
  managers can reliably identify fields.
- **Configure form autocomplete:** Set `autocomplete="username"` on the
  username `<input>` element and `autocomplete="current-password"` on the
  password `<input>` element to distinguish sign-in fields from registration
  fields.
- **Set appropriate input types:** Use `type="text"` (or `type="email"` for
  email identifiers) to display the appropriate mobile keyboard layout, and
  `type="password"` to mask password entry.

### Best practices & advanced UX

Consider these patterns to improve the sign-in experience:

- **Browser-native validation:** Add the `required` attribute to inputs to
  validate empty fields in the browser before submitting a network request.
- **Password visibility toggle:** Provide a control that switches the password
  `<input>` `type` between `password` and `text` so users can verify their entry
  before submitting.
- **Accessible account recovery:** Include a visible **Forgot password?** link
  near the form controls so users can easily recover access to their account.
- **Mobile-friendly targets and typography:** Size interactive controls to at
  least 44x44 CSS pixels and use an input font size of at least 16px to prevent
  mobile browsers from automatically zooming in on focus.
- **Upgrade to passkey form autofill:** Once your password form is in place, add
  `webauthn` to the username `autocomplete` attribute (such as
  `autocomplete="username webauthn"`) and enable Conditional UI so users can
  [sign in with a passkey through form
  autofill](https://web.dev/articles/passkey-form-autofill).

### Developer resources

- **Guide:** [Sign-in form best
  practices](https://web.dev/articles/sign-in-form-best-practices) (web.dev)
- **Guide:** [Help users sign in with
  autofill](https://developer.chrome.com/docs/identity/autofill) (Chrome for
  Developers)
