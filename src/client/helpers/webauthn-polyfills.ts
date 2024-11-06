import { UAParser } from 'ua-parser-js';
import {
  RegistrationCredential,
  RegistrationResponseJSON,
  AuthenticatorAttestationResponseJSON,
  AuthenticationCredential,
  AuthenticationResponseJSON,
  AuthenticatorAssertionResponseJSON,
  PublicKeyCredentialCreationOptions,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptions,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types';

/**
 * Encode given buffer or decode given string with Base64URL.
 */
class base64url {
  static encode(buffer: ArrayBuffer): string {
    const base64 = window.btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }

  static decode(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const binStr = window.atob(base64);
    const bin = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bin[i] = binStr.charCodeAt(i);
    }
    return bin.buffer;
  }
}

if (PublicKeyCredential) {
  const uap = new UAParser();
  const browser = uap.getBrowser();
  if (!browser?.major) {
    throw new Error('Browser major version not found.');
  }
  const browserName = browser.name;
  const browserVer = parseInt(browser.major);
  const engine = uap.getEngine();
  if (!engine?.version) {
    throw new Error('Engine version not found.');
  }
  const engineName = engine.name;
  const engineVer = parseInt(engine.version.replace(/^([0-9]+)\.*$/, '$1'));

  // @ts-ignore
  if (!PublicKeyCredential?.parseCreationOptionsFromJSON) {
    // @ts-ignore
    PublicKeyCredential.parseCreationOptionsFromJSON = (
      options: PublicKeyCredentialCreationOptionsJSON
    ): PublicKeyCredentialCreationOptions => {
      const user = {
        ...options.user,
        id: base64url.decode(options.user.id),
      } as PublicKeyCredentialUserEntity;
      const challenge = base64url.decode(options.challenge);
      const excludeCredentials =
        options.excludeCredentials?.map((cred) => {
          return {
            ...cred,
            id: base64url.decode(cred.id),
          } as PublicKeyCredentialDescriptor;
        }) ?? [];
      return {
        ...options,
        user,
        challenge,
        excludeCredentials,
      } as PublicKeyCredentialCreationOptions;
    };
  }
  // @ts-ignore
  if (!PublicKeyCredential?.parseRequestOptionsFromJSON) {
    // @ts-ignore
    PublicKeyCredential.parseRequestOptionsFromJSON = (
      options: PublicKeyCredentialRequestOptionsJSON
    ): PublicKeyCredentialRequestOptions => {
      const challenge = base64url.decode(options.challenge);
      const allowCredentials =
        options.allowCredentials?.map((cred) => {
          return {
            ...cred,
            id: base64url.decode(cred.id),
          } as PublicKeyCredentialDescriptor;
        }) ?? [];
      return {
        ...options,
        allowCredentials,
        challenge,
      } as PublicKeyCredentialRequestOptions;
    };
  }

  // @ts-ignore
  if (!PublicKeyCredential.prototype.toJSON) {
    // @ts-ignore
    PublicKeyCredential.prototype.toJSON = function(
      this: RegistrationCredential | AuthenticationCredential
    ): RegistrationResponseJSON | AuthenticationResponseJSON {
      try {
        // @ts-ignore
        const id = this.id;
        // @ts-ignore
        const rawId = base64url.encode(this.rawId);
        // @ts-ignore
        const authenticatorAttachment = this.authenticatorAttachment;
        const clientExtensionResults = {};
        // @ts-ignore
        const type = this.type;
        // This is authentication.
        // @ts-ignore
        if (this.response.signature) {
          return {
            id,
            rawId,
            response: {
              // @ts-ignore
              authenticatorData: base64url.encode(this.response.authenticatorData),
              // @ts-ignore
              clientDataJSON: base64url.encode(this.response.clientDataJSON),
              // @ts-ignore
              signature: base64url.encode(this.response.signature),
              // @ts-ignore
              userHandle: base64url.encode(this.response.userHandle),
            } as AuthenticatorAssertionResponseJSON,
            authenticatorAttachment,
            clientExtensionResults,
            type,
          } as AuthenticationResponseJSON;
        } else {
          return {
            id,
            rawId,
            response: {
              // @ts-ignore
              clientDataJSON: base64url.encode(this.response.clientDataJSON),
              // @ts-ignore
              attestationObject: base64url.encode(this.response.attestationObject),
              // @ts-ignore
              transports: this.response?.getTransports() || [],
            } as AuthenticatorAttestationResponseJSON,
            authenticatorAttachment,
            clientExtensionResults,
            type,
          } as RegistrationResponseJSON;
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
    }
  }
  
  // @ts-ignore
  if (!PublicKeyCredential.getClientCapabilities ||
    // If this is Safari 17.4+, there's a spec glitch.
    (browserName === 'Safari' && browserVer >= 17.4)) {
    // @ts-ignore
    PublicKeyCredential.getClientCapabilities = async (): ClientCapabilities => {
      let conditionalCreate = false;
      let conditionalGet = false;
      let hybridTransport = false;
      let passkeyPlatformAuthenticator = false;
      let userVerifyingPlatformAuthenticator = false;
      let relatedOrigins = false;
      let signalAllAcceptedCredentials = false;
      let signalCurrentUserDetails = false;
      let signalUnknownCredential = false;
      if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&
          PublicKeyCredential.isConditionalMediationAvailable) {
        // Are UVPAA and conditional UI available on this browser?
        const results = await Promise.all([
          PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
          PublicKeyCredential.isConditionalMediationAvailable()
        ]);
        userVerifyingPlatformAuthenticator = results[0];
        conditionalGet = results[1];
      }
      // @ts-ignore
      if (PublicKeyCredential.signalAllAcceptedCredentials) {
        signalAllAcceptedCredentials = true;
      }
      // @ts-ignore
      if (PublicKeyCredential.signalCurrentUserDetails) {
        signalCurrentUserDetails = true;
      }
      // @ts-ignore
      if (PublicKeyCredential.signalUknownCredential) {
        signalUnknownCredential = true;
      }

      // `conditionalCreate` is `true` on Safari 15+
      if (browserName === 'Safari' && browserVer >= 18) {
        conditionalCreate = true;
      }
      // `hybridTransport` is `true` on Firefox 119+, Chromium 108+ and Safari 16+
      if ((engineName === 'Blink' && engineVer >= 108) ||
          (browserName === 'Firefox' && browserVer >= 119) ||
          (browserName === 'Safari' && browserVer >= 16)) {
        hybridTransport = true;
      } 
      // `passkeyPlatformAuthenticator` is `true` if `hybridTransport` and `userVerifyingPlatformAuthenticator` are `true`.
      if (hybridTransport && userVerifyingPlatformAuthenticator) {
        passkeyPlatformAuthenticator = true;
      }
      // `relatedOrigins` is `true` on Chromium 128+
      if ((engineName === 'Blink' && engineVer >= 128)) {
        relatedOrigins = true;
      }
      return {
        conditionalCreate,
        conditionalGet,
        hybridTransport,
        passkeyPlatformAuthenticator,
        userVerifyingPlatformAuthenticator,
        relatedOrigins,
        signalAllAcceptedCredentials,
        signalCurrentUserDetails,
        signalUnknownCredential
      } as ClientCapabilities;
    };
  }
}

