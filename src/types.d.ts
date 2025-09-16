/**
 * Copyright 2022 Google LLC
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
 * limitations under the License.
 */

import {
  AttestationFormat,
  AttestationStatement,
  AuthenticatorAttachment,
  AuthenticatorTransportFuture,
  CredentialDeviceType,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server';
import {JwtPayload} from 'jsonwebtoken';
import {StringDecoder} from 'string_decoder';
import {UserSignInStatus} from './server/middlewares/session.js';
import {User, SignUpUser} from './server/libs/users.js';

interface AppLocals {
  is_localhost?: boolean;
  title?: string;
  repository_url?: string;
  id_token_lifetime?: number;
}

interface ResLocals {
  // User's sign-in status
  signin_status: UserSignInStatus;
  // Whether the user is signed in or not
  is_signed_in: boolean;
  // User object
  user: User;
  // Whether viewport width is less than 768px or not
  narrow: boolean;
}

declare global {
  namespace Express {
    interface Application {
      locals: AppLocals;
    }
    interface Response {
      locals: ResLocals;
    }
  }
  namespace NodeJS {
    interface ProcessEnv {
      ANDROID_PACKAGENAME: string;
      ANDROID_SHA256HASH: string;
      FIRESTORE_EMULATOR_HOST: string;
      FIRESTORE_DATABASENAME: string;
      ID_TOKEN_LIFETIME: number;
      SHORT_SESSION_DURATION: number;
      LONG_SESSION_DURATION: number;
      NODE_ENV: string;
      PROJECT_NAME: string;
      SECRET: string;
      PORT: number;
    }
  }
}

declare module 'express-session' {
  interface Session {
    // Claimed username. This isn't validated.
    signin_username?: string;
    // Deprecating: Claimed username. DB does not have a conflicting entry.
    // TODO: Move this out to a database.
    signup_username?: string;
    // Claimed user info.
    signup_user?: SignUpUser;
    // A new passkey user ID upon sign-up.
    passkey_user_id?: string;
    // User information if the user is signed in.
    user?: User;
    // Last signed in time in epoch;
    last_signedin_at?: number;
    // Enrollment session for the second step.
    challenge?: string;
    // The path from which the user signed in.
    entrance?: string;
  }
}

declare module 'jwt' {
  interface jwtPayload {
    email: string;
  }
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ANDROID_PACKAGENAME: string;
      ANDROID_SHA256HASH: string;
      FIRESTORE_EMULATOR_HOST: string;
      FIRESTORE_DATABASENAME: string;
      ID_TOKEN_LIFETIME: number;
      SHORT_SESSION_DURATION: number;
      LONG_SESSION_DURATION: number;
      NODE_ENV: string;
      PROJECT_NAME: string;
      SECRET: string;
      PORT: number;
    }
  }
}

export interface WebAuthnRegistrationObject
  extends Omit<
    PublicKeyCredentialCreationOptionsJSON,
    'rp' | 'pubKeyCredParams' | 'challenge' | 'excludeCredentials'
  > {
  credentialsToExclude?: string[];
  customTimeout?: number;
  abortTimeout?: number;
}

export interface WebAuthnAuthenticationObject
  extends Omit<PublicKeyCredentialRequestOptionsJSON, 'challenge'> {
  customTimeout?: number;
  abortTimeout?: number;
}
