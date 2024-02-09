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

declare module 'express-session' {
  interface Session {
    'signed-in'?: 'yes' | undefined
    // User ID and the indicator that the user is signed in.
    username: string
    nonce: number
    name?: string
    displayName?: string
    picture?: string
    // Timestamp of the recent successful sign-in time.
    timeout?: number
    // Enrollment session for the second step.
    challenge?: string
    // Enrollment type
    type?: 'platform' | 'cross-platform' | 'undefined'
  }
}

declare module 'jwt' {
  interface jwtPayload {
    email: string
  }
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ANDROID_PACKAGENAME: string
      ANDROID_SHA256HASH: string
      DOMAIN: string
      FIRESTORE_EMULATOR_HOST: string
      FIRESTORE_DATABASENAME: string
      HOSTNAME: string
      ID_TOKEN_LIFETIME: number
      NODE_ENV: string
      ORIGIN: string
      PROJECT_NAME: string
      SECRET: string
      PORT: number
    }
  }
}

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
import { JwtPayload } from 'jsonwebtoken'
import { StringDecoder } from 'string_decoder'

export interface UserInfo {
  user_id: string
  name: string
  displayName: string
  picture: string
}

export interface WebAuthnRegistrationObject extends
  Omit<PublicKeyCredentialCreationOptionsJSON, 'rp' | 'pubKeyCredParams' | 'challenge' | 'excludeCredentials'> {
  credentialsToExclude?: string[]
  customTimeout?: number
  abortTimeout?: number
}

export interface WebAuthnAuthenticationObject extends Omit<PublicKeyCredentialRequestOptionsJSON, 'challenge'> {
  customTimeout?: number
  abortTimeout?: number
}
