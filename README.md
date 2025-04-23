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

```shell
npm run emulator & npm run dev
```

Open [http://localhost:8080](http://localhost:8080).

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

### Add the path entry to `rsbuild.config.ts`

Don't forget to add the TypeScript path to `source/entry` in `rsbuild.config.ts`.

For example, `'sign-in': './src/client/pages/sign-ints'`,

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
  NoAuth = 0,           // No authentication is required
  SignUp = 1,           // This is a sign-up page
  SigningUp = 2, // The user must be signing up
  SignIn = 3,           // This is a sign-in page
  SignedIn = 4,         // The user must be signed in
  Sensitive = 5,        // The user must be recently signed in
  Reauth = 6,           // The user must be signed in and requires reauthentication
}
```

The `pageAclCheck` middleware automatically redirects users in a wrong sign-in status.

#### `apiAclCheck`

Define the type of the API from the following list with `apiAclCheck`.

```ts
export enum ApiType {
  NoAuth = 0,               // No authentication is required
  PasskeyRegistration = 1,  // The user is either signing-up or signed-in
  Identifier = 2,           // The user is about to sign-up
  SigningUp = 3,     // The user is in the middle of signing up
  Authentication = 4,       // The user is about to sign in with a username and a credential
  FirstCredential = 5,      // The user is about to sign in
  SecondCredential = 6,     // The user is about to sign in
  SignedIn = 7,             // The user must be signed in
  Sensitive = 8,            // The user must be recently signed in
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
