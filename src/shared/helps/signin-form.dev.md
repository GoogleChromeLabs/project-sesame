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

## Integrate a password-based sign-in form

This page demonstrates a password-based sign-in form built in accordance with
web standards and accessibility guidelines.

### Best practices & form optimization checklist

When implementing password authentication, make sure your form implements the
following structural, UX, and security patterns:

- **Semantic structure:** Wrap all input fields in a `<form>` element. Use
  `<label>` elements associated with `<input>` fields (positioned above the
  inputs for optimal mobile readability), and a `<button type="submit">` with
  descriptive text (such as **Login** or **Sign in**) rather than a generic
  label.
- **Stable identifiers:** Use stable, unique `id` and `name` attributes (such
  as `id="username"` and `name="username"`) that don't change between builds,
  allowing password managers to reliably identify and save credentials.
- **Autofill compatibility:** Assist password managers by providing explicit
  `autocomplete` attributes:
  - Configure the username input with `autocomplete="username"`.
  - Configure the password input with `autocomplete="current-password"` to
    signal that it's a sign-in form (distinguishing it from registration
    fields).
- **Appropriate input types:** Set `type="text"` on the username input to
  trigger the correct virtual keyboard layout on mobile devices. Always use
  `type="password"` for the password input to mask the entry.
- **Browser-native validation:** Apply the `required` attribute to inputs so
  the browser can quickly flag empty fields before sending a request to the
  server.
- **Password visibility control:** Offer a toggle that switches the password
  input type between `password` and `text` so users can check what they typed.
  This reduces typing errors and friction.
- **Accessible recovery links:** Include a clearly visible "Forgot password?"
  link to help users recover accounts without frustration.
- **Mobile optimization:** Make sure all interactive elements have comfortable
  touch targets (at least 44x44 CSS pixels). Set input font sizes to at least
  16px to prevent iOS browsers from automatically zooming in and disrupting the
  layout.

### Developer resources

- **Guide:** [Sign-in form best
  practices](https://web.dev/articles/sign-in-form-best-practices) (web.dev)
- **Guide:** [Help users sign in with
  autofill](https://developer.chrome.com/docs/identity/autofill) (Chrome for
  Developers)
