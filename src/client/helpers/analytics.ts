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

import { $ } from './index';

declare global {
  interface Window {
    dataLayer: any[];
    glueCookieNotificationBarLoaded: () => void;
    glue: any;
  }
}

export function initAnalytics() {
  window.dataLayer = window.dataLayer || [];

  function gtag(...args: any[]) {
    window.dataLayer.push(args);
  }

  // Default to denied for Google Analytics storage
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    wait_for_update: 500,
  });

  gtag('js', new Date());

  const measurementId = $('meta[name="analytics-id"]')?.content;

  if (measurementId) {
    gtag('config', measurementId);
  } else {
    // console.warn('Google Analytics Measurement ID not found.');
  }

  const initCookieBar = () => {
    const { instance, status: CookieNotificationBarStatus } =
      window.glue.CookieNotificationBar;

    if (!instance) {
      console.warn('Glue cookie instance is undefined');
      return;
    }

    function updateCookieBtn(status: string) {
      const cookieBtn = $('#manage-cookies-btn');

      if (status === CookieNotificationBarStatus.ACCEPTED) {
        gtag('consent', 'update', {
          analytics_storage: 'granted',
        });
        if (measurementId && !$('#ga-script')) {
          const script = document.createElement('script');
          script.id = 'ga-script';
          script.async = true;
          script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
          document.head.appendChild(script);
        }
        if (cookieBtn) {
          cookieBtn.style.display = 'none';
        }
      } else {
        gtag('consent', 'update', {
          analytics_storage: 'denied',
        });
        if (cookieBtn) {
          cookieBtn.style.display = status === CookieNotificationBarStatus.REJECTED ? 'block' : 'none';
        }
      }
    }
    // Listen for changes
    instance.listen('statuschange', (event: any) => {
      updateCookieBtn(event.detail.status);
    });

    updateCookieBtn(instance.status);
  };

  if (window.glue && window.glue.CookieNotificationBar && window.glue.CookieNotificationBar.instance) {
    initCookieBar();
  } else {
    window.glueCookieNotificationBarLoaded = initCookieBar;
  }
}
