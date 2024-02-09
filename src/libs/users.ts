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

import { getGravatarUrl } from "./helpers.js";
import { store } from "../config.js";
import crypto from "crypto";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { Base64URLString } from "@simplewebauthn/types";

export interface User {
  id: Base64URLString;
  username: string;
  displayName?: string;
  email?: string;
  picture?: string;
}

/**
 * User data schema
 * {
 *   id: string Base64URL encoded user ID,
 *   username: string username,
 *   displayName: string display name,
 *   email: string email address,
 *   picture: string avatar image url,
 * }
 **/

export class Users {
  static collection = "users";

  static isValidUsername(username: string): boolean {
    return !!username && /^[a-zA-Z0-9@\.\-_]+$/.test(username);
  }

  static async create(
    username: string,
    options: {
      picture?: string;
      displayName?: string;
      email?: string;
    } = {}
  ): Promise<User> {
    let { picture, displayName, email }: any = options;

    if (!picture) {
      picture = getGravatarUrl(username);
    }

    if (!displayName) {
      displayName = username;
    }

    if (!email) {
      email = username;
    }

    const user = {
      id: isoBase64URL.fromBuffer(crypto.randomBytes(32)),
      username,
      picture,
      displayName,
      email,
    };
    return Users.update(user);
  }

  static async findById(user_id: Base64URLString): Promise<User | undefined> {
    const doc = await store.collection(Users.collection).doc(user_id).get();
    if (doc) {
      return <User>doc.data();
    } else {
      return;
    }
  }

  static async findByUsername(username: string): Promise<User | undefined> {
    const results: User[] = [];
    const refs = await store
      .collection(Users.collection)
      .where("username", "==", username)
      .get();
    if (refs) {
      refs.forEach((user) => results.push(<User>user.data()));
    }
    return results.length > 0 ? results[0] : undefined;
  }

  static async update(user: User): Promise<User> {
    const ref = store
      .collection(Users.collection)
      .doc(<Base64URLString>user.id);
    ref.set(user);
    return user;
  }
}
