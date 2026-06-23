---
name: dev-helper-writer
description: Rephrase and polish developer-facing help texts, integration guides, and checklists to be clear, professional, and structurally sound.
---

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

# Developer Helper Writer Skill

This skill provides guidelines and patterns for rewriting, rephrasing, and polishing developer-facing documentation, integration guides, API explainers, and technical checklists in the codebase. It ensures technical concepts are explained clearly, accurately, and in accordance with modern web standards documentation.

## Writing Principles

1. **Direct and Precise API Terminology**
   - Refer to APIs, methods, attributes, and options by their exact names using inline code formatting (e.g., `mediation: 'conditional'`, `navigator.credentials.get()`, `autocomplete="username webauthn"`).
   - Anchor specifications with both their developer-friendly name and official specification name (e.g., "passkey form autofill (also known as Conditional UI)").
   - Link to specifications or reference docs (like MDN or developer.chrome.com) directly from API terms where helpful.

2. **Feature-Benefit Action Items in Checklists**
   - Format lists and checklists so that each item starts with a bolded descriptor outlining the action or benefit (e.g., **Seamless Sign-In:**, **Orphaned Credential Cleanup:**, **Proactive Passkey Creation:**).
   - Follow the bolded descriptor with a clear, concise explanation of the implementation mechanism.

3. **Categorized and Labeled Resources**
   - Group learning resources, codelabs, and guides clearly.
   - Prefix each resource link with its category in bold (e.g., **Guide:**, **Codelab:**, **API Reference:**).
   - Append the publisher or source in parentheses after the link (e.g., `(web.dev)`, `(Google Developers)`, `(W3C)`).

4. **Tone and Style**
   - Clear, precise, and authoritative yet developer-friendly.
   - Action-oriented, focusing on how a developer can achieve the target UX or secure implementation.

## Example Pattern: Before & After

### Before
> ## How to integrate passkey form autofill
> Use [WebAuthn](https://www.w3.org/TR/webauthn/) to build a passkey experience.
> 
> You can enable **passkey form autofill** by appending `mediation: "conditional"` to the `navigator.credentials.get()` call to an ordinary passkey authentication invocation. Also, the `input` element must contain `webauthn` within its `autocomplete` attribute.
> 
> There are a lot of tricks you can perform to make the passkey authentication experience better. Here's a checklist:
> - Allow users to [sign in with a passkey through form autofill](https://web.dev/articles/passkey-form-autofill).
> - Signal when a passkey's matching credential is not found on the backend with [`PublicKeyCredential.signalUnknownCredential()`](https://developer.chrome.com/docs/identity/webauthn-signal-api#signal-that-a-credential-does-not-exist).
> - Prompt users to manually create a passkey if the user hasn't created one after a sign-in.
> 
> ### Learning resources
> - [Sign in with a passkey through form autofill](https://web.dev/articles/passkey-form-autofill)
> - [Server-side passkey authentication](https://developers.google.com/identity/passkeys/developer-guides/server-authentication)

### After
> ## Integrating Passkey Form Autofill
> To build a seamless sign-in experience, you can integrate **passkey form autofill** (also known as Conditional UI) using the [WebAuthn API](https://www.w3.org/TR/webauthn/).
> 
> You can enable this by passing `mediation: 'conditional'` as an option to the `navigator.credentials.get()` call when initiating passkey authentication. Additionally, the corresponding username/password `<input>` element must include `webauthn` in its `autocomplete` attribute (e.g., `autocomplete="username webauthn"`).
> 
> ### Best Practices & Advanced UX Checklist
> To deliver a top-tier passkey experience, consider implementing these advanced patterns and API integrations:
> - **Seamless Sign-In:** Enable users to [sign in with a passkey directly via form autofill](https://web.dev/articles/passkey-form-autofill) to reduce friction.
> - **Orphaned Credential Cleanup:** Use the WebAuthn Signal API's [`PublicKeyCredential.signalUnknownCredential()`](https://developer.chrome.com/docs/identity/webauthn-signal-api#signal-that-a-credential-does-not-exist) to notify the browser when a passkey's matching public key is not found on the server, allowing the browser to delete the invalid credential.
> - **Proactive Passkey Creation:** Prompt users to create a passkey immediately after they successfully sign in using a traditional password.
> 
> ### Developer Resources
> - **Guide:** [Sign in with a passkey through form autofill](https://web.dev/articles/passkey-form-autofill) (web.dev)
> - **Guide:** [Server-side passkey authentication](https://developers.google.com/identity/passkeys/developer-guides/server-authentication) (Google Developers)
