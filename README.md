# Project Sesame

Project Sesame is an open-source demo web application built with node.js,
designed to provide a hands-on environment for web developers to explore,
experiment and learn a wide range of identity and authentication features and
patterns.

## How to run locally

### Prerequisites

* [Node.js 20+](https://nodejs.org/)
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

For all the features to work as expected (incl. federated identity with FedCM), you need to run the RP and IdP separately.

First, run the firebase emulator:
```shell
npm run emulator
```

Run RP in a separate terminal:
```shell
npm run dev:rp
```

Run the IdP in a separate terminal:
```shell
npm run dev:idp
```

#### Setting up a mock cross-site environment 

For the FedCM flow to work correctly and to accurately simulate a real-world scenario, your browser needs to perceive the Identity Provider (IdP) and Relying Party (RP) as **separate, secure domains**. 

This section explains how to use **Caddy** to set up a local reverse proxy that serves your demos on mock domains with HTTPS. This ensures your browser treats them as cross-site, allowing you to test FedCM in an appropriate context.

##### 1. Run the services 
For Caddy to proxy correctly, make sure your apps run on the right ports:

* RP: localhost:8080
* IDP: localhost:5000


You can also modify these ports in the corresponding config files (`rp-localhost.config.json` and `idp-localhost.config.json`) and in the `Caddyfile`.

##### 2. Start the Caddy proxy

Make sure Caddy is [installed](https://caddyserver.com/docs/install) on your computer.

Before running the proxy script for the first time, you need to make it executable:
```shell
chmod +x caddy.sh
```

This script will start Caddy, which automatically handles HTTPS certificate generation and trust for `idp.localhost` and `rp.localhost`. The first time you run it, Caddy will ask for your system password to install a local certificate authority.

```shell
sh caddy.sh
```

Now Caddy should proxy from [https://rp.localhost](https://rp.localhost) to `localhost:8080` and [https://idp.localhost](https://idp.localhost) to `localhost:8000`, or other ports that you specify in the config files.

## Adding a new sign-in flow

You can use this code base to try and experiment with new ideas. To add a new
sign-in flow, follow the instructions below.

### Determine the path

For example, `/sign-in`.

### Add a new HTML template

To add a new HTML template, create a file under `src/shared/views`.

For example, `src/shared/views/sign-in.html`.

### Add a TypeScript file

To add a TypeScript file that runs on the HTML template, create a file under
`src/client/pages`.

For example, `src/client/pages/sign-in.ts`.

### Where to find layout templates

The layout template is at `src/client/layout.html`. The partial templates are
under `src/shared/views/partials`.

### Add a server behavior

To access the HTML on the browser, you need to add a path to the server as well.
Add a server behavior in `src/server/app.ts`.

For example, to add a behavior for `/sign-in`, add a code like so:

```ts
app.get('/sign-in', pageAclCheck(PageType.SignIn), (req: Request, res: Response)) => {
  res.render('password.html', {
    title: 'Password',
    layout: 'password',
  });
});
```

#### `pageAclCheck`

Define the type of the page from the following list with `pageAclCheck`.

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

The `pageAclCheck` middleware automatically redirects users in a wrong sign-in status.

#### `apiAclCheck`

Define the type of the API from the following list with `apiAclCheck`.

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

The `apiAclCheck` middleware automatically blocks users in a wrong sign-in status.

#### Start a session

You can start a session for the user by verifying the authentication credential.
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
    setSessionUser(user, req, res);

    return res.json(user);
  } else {
    return res.status(401).json({error: 'Failed to sign in.'});
  }
});
```
