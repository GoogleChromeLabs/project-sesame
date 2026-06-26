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

This page demonstrates a traditional sign-in form built in accordance with
modern web standards and accessibility guidelines.

### Best practices & form optimization checklist

When implementing traditional password authentication, ensure your form
implements the following architectural, UX, and security patterns:

- **Semantic structure:** Wrap all input fields in a `<form>` element. Use
  `<label>` elements associated with `<input>` fields (positioned above the
  inputs for optimal mobile readability), and a `<button type="submit">` with
  descriptive text (such as **Login** or **Sign in**) rather than a generic
  label.
- **Stable identifiers:** Use stable, unique `id` and `name` attributes (e.g.,
  `id="username"` and `name="username"`) that do not change between builds,
  allowing password managers to reliably identify and save credentials.
- **Autofill compatibility:** Assist credential managers by providing explicit
  `autocomplete` attributes:
  - Configure the username input with `autocomplete="username"`.
  - Configure the password input with `autocomplete="current-password"` to
    signal that it is a sign-in form (distinguishing it from registration
    fields).
- **Appropriate input types:** Set `type="text"` to trigger the correct virtual
  keyboard layout on mobile devices. Always use `type="password"` for the
  password input to mask the entry.
- **Browser-native validation:** Apply the `required` attribute to inputs to
  leverage fast, browser-native validation before sending requests to the
  server.
- **Password visibility control:** Offer a password visibility toggle (switching
  the input type between `password` and `text`) to help users verify their
  input, which reduces typing errors and friction.
- **Accessible recovery links:** Include a clearly visible "Forgot password?"
  link to help users recover accounts without frustration.
- **Mobile optimization:** Ensure all interactive elements have comfortable
  touch targets (at least 44x44 CSS pixels) and input font sizes are at least
  16px to prevent iOS browsers from automatically zooming in and disrupting the
  layout.

### Developer resources

- **Guide:** [Sign-in form best
  practices](https://web.dev/articles/sign-in-form-best-practices) (web.dev)
- **Guide:** [Help users sign in with
  autofill](https://developer.chrome.com/docs/identity/autofill) (Chrome
  Developers)
