import { $, _fetch, loading, redirect } from "../common";
import { authenticate } from "../passkeys";

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
