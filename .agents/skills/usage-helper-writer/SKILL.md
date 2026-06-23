---
name: usage-helper-writer
description: Rephrase and polish technical help documentation or usage guides to be natural, professional, and clear.
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

# Usage Helper Writer Skill

This skill provides guidelines and patterns for rewriting, rephrasing, and polishing technical usage guides, helper texts, and onboarding copy in the codebase (especially those originally drafted in non-native English). It aims to produce clear, engaging, and professional English documentation.

## Writing Principles

1. **Prioritize Natural Phrasing & Idiomatic English**
   - Avoid literal translations or awkward grammar patterns (e.g., "In this page, you can experience..." -> "On this page, you can experience...").
   - Use active voice and direct, action-oriented verbs.
   - Use clear terms (e.g., "seamlessly accommodates both passkeys and passwords" instead of "can accommodate passkeys and passwords called...").

2. **Structure for Scannability**
   - Use clear, action-oriented section headings (e.g., "### How to test it:", "### WebAuthn Signal API Demo:").
   - Break down complex flows into numbered lists or bullet points.
   - Use bold text strategically to highlight user actions, key choices, or system prompts (e.g., **Selecting a saved password**, **Click or tap the username field**).

3. **Clarify Technical Context and Terminology**
   - Introduce standard industry terminology where appropriate to educate the user (e.g., mentioning "conditional UI" alongside "passkey form autofill").
   - Clearly explain the *why* behind technical features (e.g., instead of "the password manager will delete the passkey to avoid further confusion", use "preventing future confusion by cleaning up invalid or orphaned passkeys").

4. **Tone and Style**
   - Professional, encouraging, and clear.
   - Instructive without being overly pedantic.
   - Consistent with modern web developer documentation standards (like MDN or Google Developer documentation).

## Example Pattern: Before & After

### Before
> ## Passkey form autofill
> In this page, you can experience authentication through a form that can accommodate passkeys and passwords called "passkey form autofill". This page also demonstrates WebAuthn Signal API that deletes an unusable passkey.
> 
> Put your cursor on the username field and form autofill suggestions should appear. The list contains passkeys and passwords that are stored to the password manager, so you can select one to proceed signing in.
> 
> If you haven't created a passkey on this website yet, you can enter an arbitrary username and continue. You can enter a random password in the next page to create an account. The password will be ignored.
> 
> If you do have entries in the password manager:
> - Select a password entry, and associated username will be filled in the username field, so that you can **Continue** to enter a password.
> - Select a passkey entry, and a passkey dialog will appear to proceed with user verification, and you'll be signed in.
> 
> If your sign-in attempt is rejected by the server because the public key is not found on the server, the password manager will delete the passkey to avoid further confusion. This is done by WebAuthn Signal API.

### After
> ## Passkey Form Autofill
> On this page, you can experience a sign-in flow that seamlessly accommodates both passkeys and passwords in a single form—a feature known as "passkey form autofill" (or conditional UI). This page also demonstrates how the WebAuthn Signal API can be used to clean up invalid or orphaned passkeys.
> 
> ### How to test it:
> 1. **Click or tap the username field** to trigger the browser's autofill suggestions.
> 2. If you have credentials saved in your password manager for this site:
>    - **Selecting a saved password**: The username will be filled in automatically. Click **Continue** to proceed to the password step.
>    - **Selecting a saved passkey**: A browser verification prompt will appear immediately. Complete the verification to sign in instantly.
> 3. If you don't have a passkey or account yet, enter any username and click **Continue**. On the next page, you can enter any password to register (the password will be ignored, but it simulates a traditional sign-up flow).
> 
> ### WebAuthn Signal API Demo:
> If a passkey sign-in attempt is rejected by the server because the corresponding public key is not found (e.g., if the user deleted their credential from their account settings but the local passkey remains in their password manager), the server uses the WebAuthn Signal API to signal the browser. The browser's password manager will then delete the invalid passkey, preventing future confusion.
