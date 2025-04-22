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

import {Base64URLString} from '@simplewebauthn/server';
import {generateRandomString} from './helpers.ts';
import {store} from '../config.ts';
import {JwtPayload} from 'jsonwebtoken';
import {UserId} from './users.ts';

export interface IdToken extends JwtPayload {
  /**
interface JwtPayload {
  [key: string]: any;
  iss?: string | undefined;
  sub?: string | undefined;
  aud?: string | string[] | undefined;
  exp?: number | undefined;
  nbf?: number | undefined;
  iat?: number | undefined;
  jti?: string | undefined;
}
*/
}

export interface FederationMap extends IdToken {
  id?: Base64URLString;
  user_id?: UserId;
  given_name?: string;
  family_name?: string;
  nickname?: string;
  name?: string;
  picture?: string;
  locale?: string;
  email?: string;
  email_verified?: boolean;
}

export class FederationMappings {
  static collection = 'federation_mappings';

  static async create(user_id: UserId, idtoken: IdToken): Promise<any> {
    idtoken.user_id = user_id;
    return FederationMappings.update(idtoken);
  }

  static async findByIssuer(url: string): Promise<FederationMap[]> {
    const results: FederationMap[] = [];
    const refs = await store
      .collection(FederationMappings.collection)
      // TODO: Does `iss` always match our issuer identity?
      .where('iss', '==', url)
      .get();
    refs.forEach(map => results.push(<FederationMap>map.data()));
    return results;
  }

  static async findByUserId(user_id: UserId) {
    const results: FederationMap[] = [];
    const refs = await store
      .collection(FederationMappings.collection)
      .where('user_id', '==', user_id)
      .get();
    refs.forEach(map => results.push(<FederationMap>map.data()));
    return results;
  }

  static async update(
    map: FederationMap
  ): Promise<FirebaseFirestore.WriteResult> {
    map.id = map.id || generateRandomString();
    const ref = await store
      .collection(FederationMappings.collection)
      .doc(map.id);
    return ref.set(map);
  }

  static async remove(
    map_id: Base64URLString
  ): Promise<FirebaseFirestore.WriteResult> {
    const ref = await store
      .collection(FederationMappings.collection)
      .doc(map_id);
    return ref.delete();
  }
}
