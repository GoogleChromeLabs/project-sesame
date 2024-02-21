/*
 * @license
 * Copyright 2024 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License
 */

import '../layout';
import { $, _fetch, loading, redirect } from "../helpers/index";
import { authenticate } from "../helpers/passkeys";

if (window.PublicKeyCredential) {
  $("#passkey-signin").addEventListener(
    "click",
    async (e: { target: HTMLButtonElement }) => {
      try {
        loading.start();
        const user = await authenticate();
        if (user) {
          redirect("/home");
        } else {
          throw new Error("User not found.");
        }
      } catch (error: any) {
        loading.stop();
        console.error(error);
        if (error.name !== "NotAllowedError") {
          alert(error.message);
        }
      }
    }
  );
} else {
  alert("WebAuthn isn't supported on this browser. Redirecting to a form.");
  redirect("/");
}
