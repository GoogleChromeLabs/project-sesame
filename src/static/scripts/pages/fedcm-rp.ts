import { textField } from 'material-components-web';
import { $, _fetch, loading, postForm, toast } from '../common';
// @ts-ignore
const { IdentityProvider } = await import(/* webpackIgnore: true */'https://fedcm-idp-demo.glitch.me/fedcm.js')
new textField.MDCTextField($('.mdc-text-field'));

let idpInfo: any;
try {
  idpInfo = await _fetch('/federation/idp', { url: 'https://fedcm-idp-demo.glitch.me' });
} catch (error: any) {
  console.error(error);
  toast(error.message);
}

const idp = new IdentityProvider({
  configURL: idpInfo.configURL,
  clientId: idpInfo.clientId
});

postForm('/password');

const signIn = async () => {
  let token;
  try {
    token = await idp.signIn();
  } catch (e) {
    // Silently dismiss the request for now.
    // TODO: What was I supposed to do when FedCM fails other reasons than "not signed in"?
    console.info('The user is not signed in to the IdP.');
    return;
  }

  try {
    await _fetch('/federation/verify', { token, url: idpInfo.origin });
    location.href = '/home';
  } catch (error: any) {
    console.info(error);
    toast(error.message);
  }
}

if ('IdentityCredential' in window) {
  await signIn();
} else {
  $('#unsupported').classList.remove('hidden');
}
