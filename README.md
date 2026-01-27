<!--
Copyright 2025 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

# Project Sesame

Project Sesame is an open-source demo web application built with node.js,
designed to provide a hands-on environment for web developers to explore,
experiment and learn a wide range of identity and authentication features and
patterns.

## How to run locally

### Prerequisites

* [Node.js 22+](https://nodejs.org/)
* [gcloud CLI](https://cloud.google.com/sdk/docs/install)
* [Java JDK 11+](https://jdk.java.net/)

### Install

```shell
npm ci
```

### Bulid

```shell
npm run build
```

### Run

This command will run emulator, RP and IdP projects, and Caddy proxy:

```shell
sudo npm run dev:local
```

Caddy should proxy from [https://rp.localhost](https://rp.localhost) to `localhost:8080` and [https://idp.localhost](https://idp.localhost) to `localhost:8000`, 
or other ports that you specify in the `rp-localhost.config.json` and `idp-localhost.config.json` config files.

## Adding a new sign-in flow

You can use this code base to try and experiment with new ideas. To add a new
sign-in flow, follow the instructions below.

1. Determine the path. e.g. `/sign-in`
2. Add a new HTML template under `src/shared/views`. e.g. `src/shared/views/sign-in.html`
3. Add a TypeScript file under `src/client/pages`. e.g. `src/client/pages/sign-in.ts`.
4. Layout template is `src/client/layout.html`. The partial templates are under `src/shared/views/partials`.
5. Add a server behavior at `src/server/app.ts`. e.g.
    ```ts
    app.get('/sign-in', pageAclCheck(PageType.SignIn), (req: Request, res: Response)) => {
      res.render('sign-in.html', {
        title: 'Password',
        layout: 'password',
      });
    });
    ```

### Use `pageAclCheck` middleware for pages

Unless this is a public page, use the `pageAclCheck` middleware to specify ACL.

```ts
export enum PageType {
  NoAuth = 0, // No authentication is required
  SignUp = 1, // This is a sign-up page
  SigningUp = 2, // The user must be signing up
  SignIn = 3, // This is a sign-in page
  FirstCredential = 4, // The user has provided the username
  Reauth = 5, // The user must be signed in and requires reauthentication
  SignedIn = 6, // The user must be signed in
  Sensitive = 7, // The user must be recently signed in
}
```

The `pageAclCheck` middleware automatically redirects the user if they need to be signed in to access this page etc.

### Use `apiAclCheck` middleware for APIs

Unless this is a public API, use the `apiAclCheck` middleware to specify ACL.

```ts
export enum ApiType {
  NoAuth = 0, // No authentication is required
  PasskeyRegistration = 1, // The user is either signing-up, signed-in or upgrading
  SigningUp = 2, // The user is in the middle of signing up
  SignIn = 3, // The user is about to sign in with a username and a credential
  FirstCredential = 4, // The user is about to sign in
  SecondCredential = 5, // The user is about to sign in
  SignedIn = 6, // The user must be signed in
  Sensitive = 7, // The user must be recently signed in
}
```

The `apiAclCheck` middleware automatically blocks requests with insuffcient privilege.

### Start a session

Start a session after the user successfully signed in.
Create or use a middleware under `src/server/middlewares`.

For example, if the you want to check a password at `/auth/sign-in`, create the
endpoint in `src/server/middlewares/auth.ts`.

```ts
router.post('/sign-in', apiAclCheck(ApiType.Authentication), async (req: Request, res: Response) => {
  const {username, password} = req.body;
  // TODO: Validate entered parameter.
  if (!Users.isValidUsername(username) || !Users.isValidPassword(password)) {
    return res.status(401).json({error: 'Enter at least one random letter.'});
  }

  const user = await Users.validatePassword(username, password);
  if (user) {
    // Set the user as a signed in status
    new SessionService(req.session).setSessionUser(user);

    return res.json(user);
  } else {
    return res.status(401).json({error: 'Failed to sign in.'});
  }
});
```
