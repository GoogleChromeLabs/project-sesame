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
  CredentialDeviceType,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/types';

import {
  AttestationFormat,
  AttestationStatement,
  AuthenticatorAttachment,
  AuthenticatorTransportFuture
} from '@simplewebauthn/types';
import { JwtPayload } from 'jsonwebtoken';
import { StringDecoder } from 'string_decoder';
import { SignInStatus } from './server/middlewares/session.ts';
import { User } from './server/libs/users.ts';

interface AppLocals {
  is_localhost?: boolean;
  title?: string;
  repository_url?: string;
  id_token_lifetime?: number;
}

interface ResLocals {
  signin_status: SignInStatus;
  user: User;
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
}

declare module 'express-session' {
  interface Session {
    // `true` if the user is signed in.
    signed_in: boolean;
    // Claimed username. This alone doesn't mean the user is signed in.
    username: string;
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

export interface WebAuthnRegistrationObject extends
  Omit<PublicKeyCredentialCreationOptionsJSON, 'rp' | 'pubKeyCredParams' | 'challenge' | 'excludeCredentials'> {
  credentialsToExclude?: string[];
  customTimeout?: number;
  abortTimeout?: number;
}

export interface WebAuthnAuthenticationObject extends Omit<PublicKeyCredentialRequestOptionsJSON, 'challenge'> {
  customTimeout?: number;
  abortTimeout?: number;
}
