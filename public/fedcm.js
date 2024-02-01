const IDP_ORIGIN = 'https://fedcm-idp-demo.glitch.me';
const IDP_CONFIG = `${IDP_ORIGIN}/fedcm.json`;

const $ = document.querySelector.bind(document);

export const idpSignOut = () => {
  try {
    if (navigator.credentials && navigator.credentials.preventSilentAccess) {
      navigator.credentials.preventSilentAccess();
    }
  } catch (e) {
    console.error(e);
  }
};

export const getToken = async (options = {}) => {
  const { loginHint, context } = options;
  const nonce = $('meta[name="nonce"]').content;
  const clientId = $('meta[name="client_id"]').content;
  if (!nonce || !clientId) {
    throw new Error('nonce or client_id is missing in the meta tag.');
  }
  const credential = await navigator.credentials.get({
    identity: {
      providers: [{
        configURL: IDP_CONFIG,
        clientId,
        nonce,
        loginHint
      }],
      context,
    },
    mediation: 'optional',
  }).catch(e => {
    console.error(e);
    return e;
  });
  const token = credential.token;
  return token;
};

export const redirectToIdp = () => {
  location.href = IDP_ORIGIN;
}

export function setIframe(domId, callback) {
  const dom = $(`#${domId}`);
  if (!dom) throw new Error("Specified DOM ID doesn't exit");

  const iframe = document.createElement('iframe');
  iframe.setAttribute('allow', 'identity-credentials-get');
  iframe.src = `${IDP_ORIGIN}/iframe`;
  dom.appendChild(iframe);

  window.addEventListener('message', async e => {
    if (e.origin === IDP_ORIGIN && e.data === 'sign-in') {
      await callback();
    }
  });
}

export async function disconnect(account_id) {
  const clientId = $('meta[name="client_id"]').content
  await IdentityCredential.disconnect({
    configURL: IDP_CONFIG,
    clientId: clientId,
    accountHint: account_id
  });
}

// const tokenElement = document.createElement('meta');
// tokenElement.httpEquiv = 'origin-trial';
// tokenElement.content = 'AgVVeF19wUsK9H7mq0k+Y0qSvxYjkuhZPA1qF0C+hPRhG/CMdSVDWIJwJlYZy7Aj2LX71/qF1uA7deocLbx1VgQAAABleyJvcmlnaW4iOiJodHRwczovL2ZlZGNtLXJwLWRlbW8uZ2xpdGNoLm1lOjQ0MyIsImZlYXR1cmUiOiJGZWRDbUlkcFNpZ25pblN0YXR1cyIsImV4cGlyeSI6MTcwNzI2Mzk5OX0=';
// document.head.appendChild(tokenElement);
