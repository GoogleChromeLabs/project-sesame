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

To let an embedded third-party identity provider (IdP) or authentication widget
sign users in with passkeys, you can delegate WebAuthn capabilities to a
cross-origin `<iframe>` using the
[Permissions Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Permissions_Policy)
specification.

By default, the WebAuthn API blocks cross-origin iframes from calling credential
operations, to prevent unauthorized access and phishing. With explicit
Permissions Policy delegation, a top-level relying party (RP) can safely give a
specific cross-origin frame permission to call `navigator.credentials.get()`.

### Implementation guide

Delegating WebAuthn authentication to an embedded iframe requires two
configuration steps on the parent RP page and one on the IdP:

- **Set the HTTP Permissions-Policy header:** Configure your server to return a
  `Permissions-Policy` header that grants `publickey-credentials-get` to the
  iframe's origin:

  ```http
  Permissions-Policy: publickey-credentials-get=(self "https://idp.example")
  ```

- **Add the `allow` attribute to the `<iframe>` element:** Explicitly grant the
  permission on the iframe itself:

  ```html
  <iframe
    src="https://idp.example/iframe-federation?nonce=NONCE&origin=https%3A%2F%2Frp.example"
    allow="publickey-credentials-get"
  >
  </iframe>
  ```

- **Restrict framing on the IdP:** The IdP must set a
  `Content-Security-Policy: frame-ancestors` header that allows framing only
  from trusted RP origins:

  ```http
  Content-Security-Policy: frame-ancestors 'self' https://rp.example;
  ```

### Best practices checklist

When you use WebAuthn in cross-origin iframes, follow these security practices:

- **Authentication only (no credential creation):** The
  `publickey-credentials-get` policy only allows passkey sign-in
  (`navigator.credentials.get()`). Browsers don't allow credential registration
  (`navigator.credentials.create()`) in cross-origin iframes, to protect
  credential ownership.
- **Strict origin allowlisting:** Never use a wildcard (`*`) in the
  `Permissions-Policy` header or the iframe `allow` attribute for WebAuthn.
  Always name the exact trusted IdP origin.
- **Secure token communication:** After the user verifies with their passkey in
  the iframe, send the resulting token with `window.parent.postMessage()`. Set
  `targetOrigin` to the exact RP origin, never `'*'`.
- **Nonce and origin validation:** Include a cryptographically random `nonce`
  and the expected RP origin in the iframe URL parameters to prevent replay
  attacks and token interception.
- **CSP frame-ancestors enforcement:** The IdP must restrict framing with
  `Content-Security-Policy: frame-ancestors`, so unauthorized third parties
  can't embed the sign-in form for clickjacking attacks.

### Developer resources

- **Guide:** [Passkeys within
  iframes](https://web.dev/articles/webauthn-within-iframe) (web.dev)
- **Specification:** [WebAuthn in cross-origin
  iframes](https://www.w3.org/TR/webauthn-3/#sctn-iframe-guidance) (W3C)
- **Guide:** [Permissions Policy:
  publickey-credentials-get](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy/publickey-credentials-get)
  (MDN)
- **Guide:** [Content Security Policy:
  frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-ancestors)
  (MDN)
