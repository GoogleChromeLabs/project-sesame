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

import crypto from 'crypto';
import {isoBase64URL} from '@simplewebauthn/server/helpers';
import type {
  DocumentReference,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

/**
 * The number of deletions to commit in a single batched write.
 *
 * Firestore limits the size of a commit request (10 MiB) rather than the
 * number of writes in it, so this keeps each request comfortably small even
 * when a sweep deletes many documents at once.
 */
const DELETE_BATCH_SIZE = 500;

/**
 * A reference to a Firestore document paired with the ID of the account that
 * owns it.
 *
 * This is used to find data that outlived its account (e.g. passkeys of an
 * account that was evicted by the Firestore TTL policy) without having to load
 * entire documents.
 */
export interface OwnedDocument {
  ref: DocumentReference;
  ownerId: string;
}

/**
 * Pairs Firestore documents with the ID of the account that owns them, as
 * stored in the given field.
 *
 * Documents without an owner ID are left out. It's unknown which account they
 * belong to (e.g. legacy documents that predate the current field names), so
 * they can't safely be judged as orphaned.
 *
 * @param docs - The documents to pair with their owner.
 * @param ownerField - The path of the field that holds the owner's ID.
 * @returns The documents that have an owner ID, along with that ID.
 */
export function toOwnedDocuments(
  docs: Pick<QueryDocumentSnapshot, 'ref' | 'get'>[],
  ownerField: string
): OwnedDocument[] {
  return docs.flatMap(doc => {
    const ownerId: unknown = doc.get(ownerField);
    return typeof ownerId === 'string' && ownerId !== ''
      ? [{ref: doc.ref, ownerId}]
      : [];
  });
}

/**
 * Deletes the given Firestore documents using batched writes.
 *
 * The references are split into chunks that are committed one after another
 * to keep every commit request small. Awaiting every commit guarantees that
 * the documents are gone, or that an error is thrown, by the time the returned
 * promise resolves. Fire-and-forget `delete()` calls can't give that
 * guarantee.
 *
 * @param refs - References to the documents to delete.
 * @returns A promise that resolves to the number of deleted documents.
 */
export async function deleteDocuments(
  refs: DocumentReference[]
): Promise<number> {
  for (let i = 0; i < refs.length; i += DELETE_BATCH_SIZE) {
    const chunk = refs.slice(i, i + DELETE_BATCH_SIZE);
    const batch = chunk[0].firestore.batch();
    for (const ref of chunk) {
      batch.delete(ref);
    }
    await batch.commit();
  }
  return refs.length;
}

export function generateRandomString(num_of_bytes: number = 32): string {
  return isoBase64URL.fromBuffer(crypto.randomBytes(num_of_bytes));
}

export function getGravatarUrl(username: string): string {
  const pictureURL = new URL('https://www.gravatar.com/');
  pictureURL.pathname = `/avatar/${crypto
    .createHash('md5')
    .update(username)
    .digest('hex')}`;
  pictureURL.searchParams.append('s', '200');
  return pictureURL.toString();
}

export function compareUrls(url1?: string, url2?: string): boolean {
  if (!url1 || !url2) return false;
  const origin1 = new URL(url1).origin;
  const origin2 = new URL(url2).origin;
  return origin1 === origin2;
}
