/*
 * @license
 * Copyright 2023 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License
 */

import express, {Request, Response} from 'express';
import {create} from 'express-handlebars';
import useragent from 'express-useragent';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'path';
import {config} from '~project-sesame/server/config.ts';
import {
  PageType,
  UserSignInStatus,
  getSignInStatus,
  initializeSession,
  pageAclCheck,
  setChallenge,
  setEntrancePath,
  getEntrancePath,
  setSignedOut,
} from '~project-sesame/server/middlewares/session.ts';
import {admin} from '~project-sesame/server/middlewares/admin.ts';
import {auth} from '~project-sesame/server/middlewares/auth.ts';
import {fedcm} from '~project-sesame/server/middlewares/fedcm.ts';
import {federation} from '~project-sesame/server/middlewares/federation.ts';
import {settings} from '~project-sesame/server/middlewares/settings.ts';
import {webauthn} from '~project-sesame/server/middlewares/webauthn.ts';
import {wellKnown} from '~project-sesame/server/middlewares/well-known.ts';

const app = express();

/**
 * Authentication often needs to add server-side data to the rendered HTML. In order
 * to achieve this, the HTML output from the frontend tooling is used as a base template
 * for SSR templating.

 * @param app The express.js app instance
 */
function configureTemplateEngine(app: express.Application) {
  const hbs = create({
    helpers: {
      isPageEnabled: (path: string) => {
        if (!config.enabled_pages) {
          return true;
        }
        return config.enabled_pages.includes(path);
      },
      isSignedIn: (options: any) => {
        return (
          options.data.root.signin_status >= UserSignInStatus.SignedIn
        );
      },
    },
    extname: 'html',
    defaultLayout: 'index',
    layoutsDir: path.join(config.views_root_file_path, 'layouts'),
    partialsDir: path.join(config.views_root_file_path, 'partials'),
  });
  app.engine('html', hbs.engine);
  app.set('view engine', 'html');
  app.set('views', path.join(config.views_root_file_path));
}

configureTemplateEngine(app);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", 'data:', ...config.csp.connect_src],
        scriptSrc: [
          "'self'",
          "'inline-speculation-rules'",
          ...config.csp.script_src,
        ],
        imgSrc: ["'self'", 'data:', ...config.csp.img_src],
        fontSrc: ["'self'", ...config.csp.font_src],
        frameSrc: ["'self'", ...config.csp.frame_src],
        styleSrc: ["'self'", "'unsafe-inline'", ...config.csp.style_src],
        styleSrcElem: ["'self'", ...config.csp.style_src_elem],
      },
      // CSP is report-only if the app is running in debug mode.
      reportOnly: config.debug,
    },
    crossOriginOpenerPolicy: {
      policy: 'same-origin-allow-popups',
    },
  })
);

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(useragent.express());

app.use(initializeSession());
app.use(cookieParser());

app.use(
  '/static',
  express.static(path.join(config.dist_root_file_path, 'client/static'))
);

// Set page defaults
app.use((req: Request, res: Response, next) => {
  const width = req.headers['sec-ch-viewport-width'];
  if (typeof width === 'string') {
    res.locals.open_drawer = parseInt(width) > 768;
  }
  res.setHeader('Accept-CH', 'Sec-CH-Viewport-Width');

  res.locals.signin_status = getSignInStatus(req, res);

  // Use the path to identify the JavaScript file. Append `index` for paths that end with a `/`.
  res.locals.pagename = /\/$/.test(req.path) ? `${req.path}index` : req.path;
  res.locals.layout = res.locals.pagename.slice(1);

  return next();
});

app.locals.origin_trials = config.origin_trials;
app.locals.repository_url = config.repository_url;
app.locals.debug = config.debug;

app.get('/', pageAclCheck(PageType.NoAuth), (req: Request, res: Response) => {
  return res.render('index.html', {
    title: 'Welcome!',
  });
});

app.get(
  '/signup-form',
  pageAclCheck(PageType.SignUp),
  (req: Request, res: Response) => {
    // Manually set the entrance path as this is a sign-up page
    setEntrancePath(req, res, '/signin-form');

    return res.render('signup-form.html', {
      title: 'Sign-Up Form',
    });
  }
);

app.get(
  '/signin-form',
  pageAclCheck(PageType.SignIn),
  (req: Request, res: Response) => {
    return res.render('signin-form.html', {
      title: 'Sign-In Form',
    });
  }
);

app.get(
  '/new-password',
  pageAclCheck(PageType.SigningUp),
  (req: Request, res: Response) => {
    res.render('new-password.html', {
      title: 'Password',
    });
  }
);

app.get(
  '/password',
  pageAclCheck(PageType.FirstCredential),
  (req: Request, res: Response) => {
    res.render('password.html', {
      title: 'Password verification',
    });
  }
);

app.get(
  '/password-reauth',
  pageAclCheck(PageType.Reauth),
  (req: Request, res: Response) => {
    res.render('password-reauth.html', {
      title: 'Password reauthentication',
    });
  }
);

app.get(
  '/fedcm-delegate',
  pageAclCheck(PageType.SignUp),
  (req: Request, res: Response) => {
    // Manually set the entrance path as this is a sign-up page
    setEntrancePath(req, res, '/passkey-form-autofill');

    return res.render('fedcm-delegate.html', {
      title: 'FedCM delegation flow',
    });
  }
);

app.get(
  '/fedcm-form-autofill',
  pageAclCheck(PageType.SignIn),
  (req: Request, res: Response) => {
    return res.render('fedcm-form-autofill.html', {
      title: 'Identifier-first form',
    });
  }
);

app.get(
  '/passkey-form-autofill',
  pageAclCheck(PageType.SignIn),
  (req: Request, res: Response) => {
    return res.render('passkey-form-autofill.html', {
      title: 'Passkey form autofill',
    });
  }
);

app.get(
  '/passkey-one-button',
  pageAclCheck(PageType.SignIn),
  (req: Request, res: Response) => {
    return res.render('passkey-one-button.html', {
      title: 'Passkey one button',
    });
  }
);

app.get(
  '/passkey-reauth',
  pageAclCheck(PageType.Reauth),
  (req: Request, res: Response) => {
    res.render('passkey-reauth.html', {
      title: 'Passkey reauthentication',
    });
  }
);

app.get(
  '/passkey-signup',
  pageAclCheck(PageType.SignUp),
  (req: Request, res: Response) => {
    // Manually set the entrance path as this is a sign-up page
    setEntrancePath(req, res, '/passkey-form-autofill');

    return res.render('passkey-signup.html', {
      title: 'Passkey sign-up',
    });
  }
);

app.get(
  '/fedcm-active-mode',
  pageAclCheck(PageType.SignIn),
  (req: Request, res: Response) => {
    return res.render('fedcm-active-mode.html', {
      title: 'FedCM active mode',
    });
  }
);

app.get(
  '/fedcm-passive-mode',
  pageAclCheck(PageType.SignIn),
  (req: Request, res: Response) => {
    return res.render('fedcm-passive-mode.html', {
      title: 'FedCM passive mode',
    });
  }
);

app.get(
  '/credential-manager',
  pageAclCheck(PageType.SignIn),
  (req: Request, res: Response) => {
    return res.render('credential-manager.html', {
      title: 'Credential Manager for the Web',
    });
  }
);

app.get(
  '/legacy-credman',
  pageAclCheck(PageType.SignIn),
  (req: Request, res: Response) => {
    return res.render('legacy-credman.html', {
      title: 'Legacy Credential Management',
    });
  }
);

app.get(
  '/home',
  pageAclCheck(PageType.SignedIn),
  (req: Request, res: Response) => {
    return res.render('home.html', {
      title: 'home',
    });
  }
);

app.get(
  '/signout',
  pageAclCheck(PageType.SignedIn),
  (req: Request, res: Response) => {
    const entrancePath = getEntrancePath(req, res);

    setSignedOut(req, res);

    return res.redirect(307, entrancePath);
  }
);

app.use('/admin', admin);
app.use('/auth', auth);
app.use('/fedcm', fedcm);
app.use('/federation', federation);
app.use('/settings', settings);
app.use('/webauthn', webauthn);
app.use('/.well-known', wellKnown);

app.use(
  helmet({
    crossOriginResourcePolicy: {policy: 'cross-origin'},
  }),
  express.static(path.join(config.dist_root_file_path, 'shared/public'))
);

// After successfully registering all routes, add a health check endpoint.
// Do it last, as previous routes may throw errors during start-up.
app.get('/__health-check', (req: Request, res: Response) => {
  res.send('OK');
});

app.listen(config.port, () => {
  console.log(`Server listening at ${config.origin}`);
});
