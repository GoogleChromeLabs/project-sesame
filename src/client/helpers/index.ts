/*
 * @license
 * Copyright 2023 Google Inc. All rights reserved.
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

import { MdLinearProgress } from "@material/web/progress/linear-progress";

export const $: any = document.querySelector.bind(document);

export const redirect = (path: string) => {
  location.href = path;
}

export function toast(text: string): void {
  $("#snackbar").labelText = text;
  $("#snackbar").show();
}

/**
 * Sends a POST request with payload. Throws when the response is not 200.
 * @param path The endpoint path.
 * @param payload The payload JSON object.
 * @returns
 */
export async function _fetch(path: string, payload: any = ""): Promise<any> {
  const headers: any = {
    "X-Requested-With": "XMLHttpRequest",
  };
  if (payload && !(payload instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(payload);
  }
  const res = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: headers,
    body: payload,
  });
  if (res.status === 200) {
    // Server authentication succeeded
    return res.json();
  } else {
    // Server authentication failed
    const result = await res.json();
    throw new Error(result.error);
  }
}

/**
 * Encode given buffer or decode given string with Base64URL.
 */
export class base64url {
  static encode(buffer: ArrayBuffer): string {
    const base64 = window.btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }

  static decode(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const binStr = window.atob(base64);
    const bin = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bin[i] = binStr.charCodeAt(i);
    }
    return bin.buffer;
  }
}

/**
 * Indicate loading status using a material progress web component.
 */
class Loading {
  progress: MdLinearProgress;

  constructor() {
    this.progress = $("#progress");
  }

  start() {
    this.progress.indeterminate = true;
    const inputs = document.querySelectorAll("input");
    if (inputs) {
      inputs.forEach((input) => (input.disabled = true));
    }
  }

  stop() {
    this.progress.indeterminate = false;
    const inputs = document.querySelectorAll("input");
    if (inputs) {
      inputs.forEach((input) => (input.disabled = false));
    }
  }
}

export const loading = new Loading();

export function postForm(path: string) {
  const form = $("#form");
  // When the form is submitted, proceed to the password form.
  form.addEventListener("submit", async (s: any) => {
    s.preventDefault();
    const form = new FormData(s.target);
    const cred = {} as any;
    form.forEach((v, k) => (cred[k] = v));
    _fetch(s.target.action, cred)
      .then((user) => {
        redirect(path);
      })
      .catch((e) => {
        loading.stop();
        console.error(e.message);
        toast(e.message);
      });
  });
}
