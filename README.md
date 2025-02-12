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
app.get('/sign-in', sessionCheck, (req, res) => {
  if (res.locals.signin_status < SignInStatus.SigningIn) {
    // If the user has not started signing in, redirect to the original entrance.
    return res.redirect(307, getEntrancePath(req, res));
  }
  if (res.locals.signin_status === SignInStatus.RecentlySignedIn) {
    // If the user is signed in, redirect to `/home`.
    return res.redirect(307, '/home');
  }

  res.render('password.html', {
    title: 'Password',
    layout: 'password',
  });
});
```

#### `sessionCheck`
By using `sessionCheck` middleware, a sign-in status is available at
`res.locals.signin_status` and the user info is available at `res.locals.user`.

`res.locals.signin_status` has the following statuses:

```ts
export enum SignInStatus {
  Unregistered = 0,
  SignedOut = 1,
  SigningUp = 2,
  SigningIn = 3,
  SignedIn = 4,
  RecentlySignedIn = 5,
}
```

#### `setEntrancePath` and `getEntrancePath`

Project Sesame's goal is to demonstrate a specific sign-in flow by linking to
 the enterance path from a developer documentation. We try to prevent users from
 entering  unrelated sign-in flows, by bringing them back to the original
 entrance.

To do so, memorize where the user signs in by calling `setEntrancePath` and
recall where the user signed in by calling `getEntrancePath`.

#### Start a session

You can start a session for the user by verifying the authentication credential.
Create or use a middleware under `src/server/middlewares`.

For example, if the you want to check a password at `/auth/sign-in`, create the
endpoint in `src/server/middlewares/auth.ts`.

```ts
router.post('/sign-in', sessionCheck, async (req: Request, res: Response) => {
  if (res.locals.signin_status > SignInStatus.SignedOut) {
    // If the user is already signed in, return an error.
    return res.status(400).json({error: 'The user is already signed in.'});
  }
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
