import { textField } from 'material-components-web';
import { $, loading, redirect, postForm } from '../common';
import { authenticate } from '../passkeys';
new textField.MDCTextField($('.mdc-text-field'));

postForm('/password');

// Feature detection: check if WebAuthn and conditional UI are supported.
if (window.PublicKeyCredential &&
    PublicKeyCredential.isConditionalMediationAvailable) {
  try {
    const cma = await PublicKeyCredential.isConditionalMediationAvailable();
    if (cma) {
      // If a conditional UI is supported, invoke the conditional `authenticate()` immediately.
      const user = await authenticate(true);
      if (user) {
        // When the user is signed in, redirect to the home page.
        $('#username').value = user.username;
        loading.start();
        redirect('/home');
      } else {
        throw new Error('User not found.');
      }
    }
  } catch (error: any) {
    loading.stop();
    console.error(error);
    // `NotAllowedError` indicates a user cancellation.
    if (error.name !== 'NotAllowedError') {
      alert(error.message);
    }
  }
}
