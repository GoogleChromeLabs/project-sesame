export class IdentityProvider {

  constructor(options) {
    let { configURL, clientId = '' } = options;
    if (clientId === '') {
      clientId = document.querySelector('meta[name="fedcm_demo_client_id"]')?.content
    }
    if (clientId === '') {
      throw new Error('client ID is not declared.');
    }
    const url = new URL(configURL);
    this.origin = url.origin;
    this.configURL = configURL;
    this.clientId = clientId;
  }

  async signIn(options = {}) {
    let { loginHint, context, nonce } = options;
    if (!nonce) {
      nonce = document.querySelector('meta[name="nonce"]')?.content;
    }
    if (!nonce || !this.clientId) {
      throw new Error('nonce or client_id is not declared.');
    }

    let credential;
    try {
      credential = await navigator.credentials.get({
        identity: {
          providers: [{
            configURL: this.configURL,
            clientId: this.clientId,
            nonce,
            loginHint
          }],
          context,
        },
        mediation: 'optional',
      })
    } catch (e) {
      console.error(e);
      throw new Error(e.message);
    };
    const token = credential.token;
    return token;
  }

  redirect() {
    location.href = this.origin;
  }

  setIframe(domId, callback) {
    const dom = document.querySelector(`#${domId}`);
    if (!dom) throw new Error("Specified DOM ID doesn't exit");

    const iframe = document.createElement('iframe');
    iframe.setAttribute('allow', 'identity-credentials-get');
    iframe.src = `${this.origin}/iframe`;
    dom.appendChild(iframe);

    window.addEventListener('message', async e => {
      if (e.origin === this.origin && e.data === 'sign-in') {
        await callback();
      }
    });
  }

  async signOut() {
    try {
      if (navigator.credentials && navigator.credentials.preventSilentAccess) {
        await navigator.credentials.preventSilentAccess();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async disconnect(accountId) {
    try {
      return await IdentityCredential.disconnect({
        configURL: this.configURL,
        clientId: this.clientId,
        accountHint: accountId
      });      
    } catch (e) {
      throw new Error('Failed disconnecting.');
    }
  }
};

// const tokenElement = document.createElement('meta');
// tokenElement.httpEquiv = 'origin-trial';
// tokenElement.content = 'AgVVeF19wUsK9H7mq0k+Y0qSvxYjkuhZPA1qF0C+hPRhG/CMdSVDWIJwJlYZy7Aj2LX71/qF1uA7deocLbx1VgQAAABleyJvcmlnaW4iOiJodHRwczovL2ZlZGNtLXJwLWRlbW8uZ2xpdGNoLm1lOjQ0MyIsImZlYXR1cmUiOiJGZWRDbUlkcFNpZ25pblN0YXR1cyIsImV4cGlyeSI6MTcwNzI2Mzk5OX0=';
// document.head.appendChild(tokenElement);
