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

This page demonstrates a traditional registration form built in accordance with
modern web standards and accessibility guidelines.

### Best practices & form optimization checklist

When implementing password-based sign-up, ensure your form implements the following architectural, UX, and security patterns:

- **Semantic HTML:** Build the form using native `<form>`, `<input>`, and
  `<button>` elements. This guarantees accessibility, native keyboard
  navigation, and seamless integration with browser extensions and password
  managers.
- **Autofill compatibility:** Assist credential managers by providing explicit `autocomplete` attributes:
  - Configure the username/identifier field with `autocomplete="username"`.
  - Configure both the password and password confirmation fields with
    `autocomplete="new-password"`. This signals to browser password managers to
    suggest a strong, unique, auto-generated password instead of autofilling
    existing credentials.
- **Form simplicity:** Ask only for essential information during registration
  (e.g., username, password, and optionally a display name). Minimizing form
  fields reduces cognitive load and significantly decreases cart/form
  abandonment rates.
- **Unrestricted password validation:** Avoid overly restrictive password rules
  (such as banning special characters, restricting length, or blocking
  copy/paste) that interfere with password managers' ability to generate strong,
  complex passwords.
- **Paste enablement:** Never disable copy-and-paste functionality on password
  fields. Users must be allowed to paste secure credentials directly from
  external password managers.
- **Password visibility control:** Include a visibility toggle (switching the
  input type between `password` and `text`) to help users verify their input,
  which reduces typing errors and friction.

### Developer resources

- **Guide:** [Sign-up form best
  practices](https://web.dev/articles/sign-up-form-best-practices) (web.dev)
- **Guide:** [Help users sign in with
  autofill](https://developer.chrome.com/docs/identity/autofill) (Chrome
  Developers)
