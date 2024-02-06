import { Base64URLString } from "@simplewebauthn/types";
import { $, _fetch, loading } from "../common";
import {
  registerCredential,
  updateCredential,
  unregisterCredential,
} from "../passkeys";
import { html, render } from "lit";

const aaguids = await fetch("/aaguids.json");
const icons = await aaguids.json();

/**
 * Change and update the user's display name.
 */
async function changeDisplayName(e: {
  target: HTMLButtonElement;
}): Promise<void> {
  const newName = prompt(
    "Enter a new display name",
    e.target.dataset.displayName
  );
  if (!newName?.length) {
    loading.start();
    await _fetch("/auth/updateDisplayName", { newName });
    loading.stop();
    renderDisplayName();
  }
}

/**
 * Render the user's display name.
 */
async function renderDisplayName(): Promise<void> {
  const res = await _fetch("/auth/userinfo");
  render(
    html`
      <img class="profile-image" src="${res.picture}" width="80" height="80" />
      <h2>Hi, ${res.displayName}</h2>
      <div class="display-name">
        <span>${res.username}</span>
        <md-icon-button
          slot="end"
          data-display-name="${res.displayName || res.username}"
          @click="${changeDisplayName}"
          title="Edit your display name"
        >
          <md-icon>edit</md-icon>
        </md-icon-button>
      </div>
    `,
    $("#userinfo")
  );
}

/**
 * Rename and update the credential name.
 */
async function rename(e: { target: HTMLButtonElement }): Promise<void> {
  const { credId, name } = e.target.dataset as { credId: Base64URLString, name: string };
  const newName = prompt("Enter a new credential name.", name);
  if (!newName?.length) return;
  try {
    loading.start();
    await updateCredential(credId, newName);
    await renderCredentials();
    loading.stop();
  } catch (error: any) {
    loading.stop();
    console.error(error);
    alert(error.message);
  }
}

/**
 * Remove and delete a credential.
 */
async function remove(event: { target: HTMLButtonElement }): Promise<void> {
  if (!confirm("Do you really want to remove this credential?")) return;

  try {
    loading.start();
    await unregisterCredential(<Base64URLString>event.target.dataset.credId);
    await renderCredentials();
    loading.stop();
  } catch (error: any) {
    loading.stop();
    console.error(error);
    alert(error.message);
  }
}

const createPasskey = $("#create-passkey");

// Is WebAuthn available on this browser?
if (
  window.PublicKeyCredential &&
  PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&
  PublicKeyCredential.isConditionalMediationAvailable
) {
  try {
    // Are UVPAA and conditional UI available on this browser?
    const results = await Promise.all([
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
      PublicKeyCredential.isConditionalMediationAvailable(),
    ]);
    if (results.every((r) => r === true)) {
      // If both are available, reveal the "Create a passkey" button.
      createPasskey.classList.remove("hidden");
    } else {
      // If either is not available, show a message.
      $("#message").innerText = "This device does not support passkeys.";
    }
  } catch (e) {
    console.error(e);
  }
} else {
  // If the condition does not match, show a message.
  $("#message").innerText = "This device does not support passkeys.";
}

/**
 * Render the list of saved credentials.
 */
async function renderCredentials(): Promise<void> {
  const res = await _fetch("/webauthn/getKeys");
  const list = $("#list");
  const creds =
    res.length > 0
      // TODO: Define `cred` type across the server and the client
      ? html`${res.map((cred: any, i: number) => {
          const created = new Date(cred.registeredAt);
          const createdDate = created.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });
          const createdTime = created.toLocaleTimeString(undefined, {
            timeStyle: "short",
            hour12: false,
          });
          const createdStr = `Created: ${createdDate}, ${createdTime}`;
          return html`${i > 0 && i < res.length
              ? html` <md-divider></md-divider> `
              : ""}
            <md-list-item>
              <img
                slot="start"
                src="${icons[cred.aaguid].icon_light}"
                title="${icons[cred.aaguid].name}"
                width="24"
                height="24"
              />
              <span slot="headline">${cred.name || "Unnamed"}</span>
              <span slot="supporting-text">${createdStr}</span>
              <md-icon-button
                slot="end"
                data-cred-id="${cred.id}"
                data-name="${cred.name || "Unnamed"}"
                @click="${rename}"
              >
                <md-icon>edit</md-icon>
              </md-icon-button>
              <md-icon-button
                slot="end"
                data-cred-id="${cred.id}"
                @click="${remove}"
              >
                <md-icon>delete</md-icon>
              </md-icon-button>
            </md-list-item>`;
        })}`
      : html`<md-list-item>No credentials found.</md-list-item>`;
  render(creds, list);
}

/**
 * Create a new paskey and register the credential.
 */
async function register(): Promise<void> {
  try {
    loading.start();
    await registerCredential();
    await renderCredentials();
    loading.stop();
  } catch (error: any) {
    // Stop the loading UI
    loading.stop();
    // 'InvalidStateError' indicates a passkey already exists on the device.
    if (error.name === "InvalidStateError") {
      alert("A passkey already exists for this device.");
      // `NotAllowedError` indicates the user canceled the operation.
    } else if (error.name === "NotAllowedError") {
      return;
      // Show other errors in an alert.
    } else {
      alert(error.message);
      console.error(error);
    }
  }
}

loading.start();
renderDisplayName();
await renderCredentials();
loading.stop();

createPasskey.addEventListener("click", register);
