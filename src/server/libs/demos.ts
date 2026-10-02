/*
 * @license
 * Copyright 2026 Google Inc. All rights reserved.
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

/**
 * Supported authentication journey / experience categories for demo cards.
 */
export type DemoCategory =
  'sign-up' | 'sign-in' | 'identity verification' | 'ux';

/**
 * Represents a single visual row inside a demo card's mini-window thumbnail.
 */
export interface DemoThumbnailRow {
  input?: {
    text: string;
    verified?: string;
  };
  button?: string;
  pill?: {
    text: string;
    trailing?: string;
    center?: boolean;
  };
  header?: {
    text: string;
    strong?: boolean;
    pill?: string;
    heart?: boolean;
  };
}

/**
 * Visual configuration for a demo card's mini-window thumbnail.
 */
export interface DemoThumbnail {
  dashed?: boolean;
  rows: DemoThumbnailRow[];
}

/**
 * Metadata definition for a single demo entry on the landing page catalog.
 */
export interface DemoItem {
  path: string;
  title: string;
  description: string;
  categories: DemoCategory[];
  apis: string[];
  thumbnail: DemoThumbnail;
}

/**
 * View-model representation of a demo entry passed to the Handlebars template.
 */
export interface DemoViewModel extends DemoItem {
  categoriesAttr: string;
  apisAttr: string;
}

/**
 * Aggregated catalog data for rendering the landing page.
 */
export interface CatalogData {
  categories: DemoCategory[];
  apis: string[];
  demos: DemoViewModel[];
}

/**
 * Ordered list of category filters displayed on the landing page.
 */
export const DEMO_CATEGORIES: DemoCategory[] = [
  'sign-up',
  'sign-in',
  'identity verification',
  'ux',
];

/**
 * Ordered list of browser identity API filters displayed on the landing page.
 */
export const DEMO_APIS: string[] = [
  'Passkeys',
  'FedCM',
  'EVP',
  'Immediate UI',
  'Conditional Get',
  'Conditional Create',
  'Password',
  'Signal API',
  'iframe',
];

/**
 * Master catalog of authentication journeys and browser API demos.
 */
export const DEMOS: DemoItem[] = [
  {
    path: '/signup-form',
    title: 'Sign-up Form',
    description: 'Standard multi-step username and password registration form.',
    categories: ['sign-up'],
    apis: ['Password'],
    thumbnail: {
      rows: [{input: {text: 'username'}}, {button: 'Continue'}],
    },
  },
  {
    path: '/passkey-signup',
    title: 'Sign-up with a passkey',
    description:
      'Create a new account directly with a passkey without setting a password.',
    categories: ['sign-up'],
    apis: ['Passkeys'],
    thumbnail: {
      rows: [{input: {text: 'username'}}, {button: '🔑 Passkey'}],
    },
  },
  {
    path: '/evp-passkey-signup',
    title: 'Passwordless sign-up with email verification',
    description:
      'End-to-end onboarding combining Email Verification Protocol and passkey creation.',
    categories: ['sign-up', 'ux'],
    apis: ['EVP', 'Passkeys'],
    thumbnail: {
      rows: [
        {input: {text: '📧 elisa@example.com', verified: '✓ EVP'}},
        {pill: {text: '🔑 + Create Passkey', center: true}},
      ],
    },
  },
  {
    path: '/evp',
    title: 'Email Verification Protocol',
    description:
      'Verify email ownership cryptographically via autocomplete="email" token presentation.',
    categories: ['identity verification'],
    apis: ['EVP'],
    thumbnail: {
      rows: [
        {input: {text: '📧 autocomplete="email"'}},
        {pill: {text: 'SD-JWT+KB Verified ✓'}},
      ],
    },
  },
  {
    path: '/signin-form',
    title: 'Sign-in Form',
    description:
      'Traditional username and password sign-in form with password manager integration.',
    categories: ['sign-in'],
    apis: ['Password'],
    thumbnail: {
      rows: [{input: {text: 'username'}}, {button: 'Continue'}],
    },
  },
  {
    path: '/automatic-passkey-creation',
    title: 'Automatic Passkey Creation',
    description:
      'Sign in with a password and silently upgrade to a passkey via Conditional Create.',
    categories: ['sign-in', 'ux'],
    apis: ['Conditional Create', 'Passkeys', 'Password'],
    thumbnail: {
      rows: [
        {input: {text: 'Password: ••••••••'}},
        {pill: {text: '✨ Passkey created automatically'}},
      ],
    },
  },
  {
    path: '/passkey-form-autofill',
    title: 'Passkey form autofill',
    description:
      'Sign in with a passkey directly from the username input autofill dropdown.',
    categories: ['sign-in', 'ux'],
    apis: ['Conditional Get', 'Passkeys'],
    thumbnail: {
      rows: [
        {input: {text: 'username |'}},
        {pill: {text: '🔑 elisa@example.com (Passkey)'}},
      ],
    },
  },
  {
    path: '/passkey-one-button',
    title: 'Passkey one button',
    description:
      'Trigger modal passkey authentication directly from a single button click.',
    categories: ['sign-in'],
    apis: ['Passkeys'],
    thumbnail: {
      rows: [{input: {text: 'username'}}, {button: '🔑 Passkey'}],
    },
  },
  {
    path: '/passkey-iframe',
    title: 'Passkey within iframe',
    description:
      'Authenticate with a passkey inside a cross-origin iframe via Permissions Policy.',
    categories: ['sign-in'],
    apis: ['Passkeys', 'iframe'],
    thumbnail: {
      dashed: true,
      rows: [
        {header: {text: '🪟 <iframe allow="...">'}},
        {button: '🔑 Sign in'},
      ],
    },
  },
  {
    path: '/immediate-ui-mode',
    title: 'Save to favorites with quick sign-in',
    description:
      'Click the favorite button in a sneaker shop to sign in inline via Immediate UI mode.',
    categories: ['sign-in', 'ux'],
    apis: ['Immediate UI', 'Passkeys', 'FedCM', 'Password'],
    thumbnail: {
      rows: [
        {header: {text: '👟 Multicolor Sneakers', heart: true}},
        {pill: {text: '🔑 Quick sign-in sheet', trailing: '⚡'}},
      ],
    },
  },
  {
    path: '/fedcm-active-mode',
    title: 'FedCM active mode',
    description:
      'Button-triggered federated sign-in using the browser-mediated FedCM chooser.',
    categories: ['sign-in'],
    apis: ['FedCM'],
    thumbnail: {
      rows: [
        {header: {text: '🌐 Sign in with IdP', strong: true, pill: 'Active'}},
        {input: {text: 'Elisa Beckett'}},
      ],
    },
  },
  {
    path: '/fedcm-passive-mode',
    title: 'FedCM passive mode',
    description:
      'Ambient federated account prompt displayed automatically on page load.',
    categories: ['sign-in'],
    apis: ['FedCM'],
    thumbnail: {
      rows: [
        {header: {text: '🌐 Sign in with IdP', strong: true, pill: 'Passive'}},
        {input: {text: 'Elisa Beckett'}},
      ],
    },
  },
  {
    path: '/fedcm-form-autofill',
    title: 'FedCM form autofill',
    description:
      'Surface federated IdP accounts and passkeys inside the form autofill suggestions.',
    categories: ['sign-in', 'ux'],
    apis: ['FedCM', 'Conditional Get', 'Passkeys'],
    thumbnail: {
      rows: [
        {input: {text: 'username |'}},
        {pill: {text: '🔑 Passkey / 🌐 FedCM autofill'}},
      ],
    },
  },
];

/**
 * Builds the filtered catalog data for the landing page based on `enabledPages`.
 *
 * @param enabledPages Optional list of enabled page paths from server config.
 * @returns Filtered demos along with active category and API filter lists.
 */
export function getCatalogData(enabledPages?: string[]): CatalogData {
  const enabledDemos = DEMOS.filter(demo => {
    if (!enabledPages) {
      return true;
    }
    return enabledPages.includes(demo.path);
  });

  const activeCategorySet = new Set<DemoCategory>();
  const activeApiSet = new Set<string>();

  const demos: DemoViewModel[] = enabledDemos.map(demo => {
    demo.categories.forEach(category => activeCategorySet.add(category));
    demo.apis.forEach(apiName => activeApiSet.add(apiName));
    return {
      ...demo,
      categoriesAttr: demo.categories.join(','),
      apisAttr: demo.apis.join(','),
    };
  });

  const categories = DEMO_CATEGORIES.filter(category =>
    activeCategorySet.has(category)
  );
  const apis = DEMO_APIS.filter(apiName => activeApiSet.has(apiName));

  return {
    categories,
    apis,
    demos,
  };
}
