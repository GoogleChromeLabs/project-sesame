import { _fetch } from ".";

// @ts-ignore
export async function authenticate(): Promise<PasswordCredential | undefined> {
  try {
    const credential = await navigator.credentials.get({
      // @ts-ignore
      password: true,
      mediation: 'required',
    });
    if (credential?.type === 'password') {
      await _fetch('/auth/username-password', {
        username: credential.id,
        // @ts-ignore
        password: credential.password
      });
      return credential;
    } else {
      return undefined;
    }
  } catch (error: any) {
    console.error(error);
    throw error;
  }
}
