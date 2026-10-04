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

## Integrating passkeys in cross-origin iframes

To allow an embedded third-party identity provider (IdP) or authentication widget to authenticate users with passkeys, you can delegate WebAuthn capabilities to a cross-origin `<iframe>` using the [Permissions Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Permissions_Policy) specification.

By default, the WebAuthn API blocks cross-origin iframes from invoking credential operations to prevent unauthorized access and phishing. Through explicit Permissions Policy delegation, a top-level Relying Party (RP) can safely grant a designated cross-origin frame permission to invoke `navigator.credentials.get()`.

### Implementation guide

Delegating WebAuthn authentication to an embedded iframe requires two complementary configuration steps on the parent RP page:

- **Set the HTTP Permissions-Policy header:** Configure your server to return the `publickey-credentials-get` policy directing trust to the iframe's origin:

  ```http
  Permissions-Policy: publickey-credentials-get=(self "https://idp.example")
  ```

- **Add the `allow` attribute on the `<iframe>` element:** Explicitly grant the permission on the embed element:

  ```html
  <iframe
    src="https://idp.example/iframe-federation?nonce=NONCE&origin=https%3A%2F%2Frp.example"
    allow="publickey-credentials-get"
  >
  </iframe>
  ```

- **Frame access control on the IdP:** The IdP must configure its `Content-Security-Policy: frame-ancestors` header to allow framing only from trusted RP origins:

  ```http
  Content-Security-Policy: frame-ancestors 'self' https://rp.example;
  ```

### Best practices checklist

When implementing WebAuthn within cross-origin iframes, follow these security practices:

- **Authentication only (no credential creation):** The `publickey-credentials-get` policy only permits passkey assertion (`navigator.credentials.get()`). Browsers do not permit credential registration (`navigator.credentials.create()`) in cross-origin iframes to protect credential ownership.
- **Strict origin allowlisting:** Never use a wildcard (`*`) in `Permissions-Policy` or iframe `allow` attributes for WebAuthn. Explicitly name the exact trusted IdP origin.
- **Secure token communication:** After the user verifies their passkey within the iframe, use `window.parent.postMessage()` targeting the exact RP origin (`targetOrigin`) rather than `'*'` to send the resulting token.
- **Nonce and origin validation:** Include a cryptographically random `nonce` and the expected RP origin in the iframe request parameters to prevent replay attacks and token interception.
- **CSP frame-ancestors enforcement:** The IdP must restrict framing using `Content-Security-Policy: frame-ancestors` to prevent unauthorized third parties from embedding the authentication form in malicious clickjacking attacks.

### Developer resources

- **Guide:** [Passkeys within iframes](https://web.dev/articles/webauthn-within-iframe) (web.dev)
- **Specification:** [WebAuthn in cross-origin iframes](https://www.w3.org/TR/webauthn-3/#sctn-iframe-guidance) (W3C)
- **Guide:** [Permissions Policy: publickey-credentials-get](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy/publickey-credentials-get) (MDN)
- **Guide:** [Content Security Policy: frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-ancestors) (MDN)
