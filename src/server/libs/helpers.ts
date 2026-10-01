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
import type {Request} from 'express';
import {isoBase64URL} from '@simplewebauthn/server/helpers';
import type {
  DocumentReference,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import {config} from '../config.js';

/**
 * Regex matching a valid DNS label (RFC 1123): 1-63 lowercase alphanumeric
 * characters or hyphens, starting and ending with an alphanumeric character.
 */
const VALID_DNS_LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

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

/**
 * Checks whether a request hostname is permitted for dynamic RP ID resolution
 * in non-production environments.
 *
 * Allowlisted patterns:
 * - `localhost` and `*.localhost`
 * - Additional development hostnames or domain suffixes configured via the
 *   comma-separated `ALLOWED_DEV_HOSTS` environment variable (e.g. `dev.example.com,.proxy.example.org`)
 * - App Engine default and PR preview domains for the current project:
 *   `<project>.appspot.com`, `<version>-dot-<project>.appspot.com`,
 *   `<project>.<region>.r.appspot.com`, `<version>-dot-<project>.<region>.r.appspot.com`
 *
 * @param hostname - The lowercase hostname extracted from the HTTP request.
 * @param projectName - The configured Google Cloud project ID.
 * @param allowedDevHosts - Optional comma-separated list of allowed dev hostnames/suffixes (defaults to `process.env.ALLOWED_DEV_HOSTS`).
 * @returns `true` if the hostname is safe to use dynamically.
 */
export function isAllowedDynamicHostname(
  hostname: string,
  projectName: string,
  allowedDevHosts: string | undefined = process.env.ALLOWED_DEV_HOSTS
): boolean {
  const normalized = hostname.toLowerCase();

  if (normalized === 'localhost' || normalized.endsWith('.localhost')) {
    return true;
  }

  if (allowedDevHosts) {
    const entries = allowedDevHosts
      .split(',')
      .map(entry => entry.trim().toLowerCase())
      .filter(Boolean);

    for (const entry of entries) {
      const domain = entry.startsWith('.') ? entry.slice(1) : entry;
      if (
        domain &&
        (normalized === domain || normalized.endsWith(`.${domain}`))
      ) {
        return true;
      }
    }
  }

  const normalizedProject = projectName.toLowerCase();
  if (!normalized.endsWith('.appspot.com') || !normalizedProject) {
    return false;
  }

  const withoutAppspot = normalized.slice(0, -'.appspot.com'.length);
  let serviceAndProject = withoutAppspot;
  if (withoutAppspot.endsWith('.r')) {
    const withoutR = withoutAppspot.slice(0, -'.r'.length);
    const lastDotIndex = withoutR.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return false;
    }
    const region = withoutR.slice(lastDotIndex + 1);
    if (!VALID_DNS_LABEL_REGEX.test(region)) {
      return false;
    }
    serviceAndProject = withoutR.slice(0, lastDotIndex);
  }

  if (serviceAndProject === normalizedProject) {
    return true;
  }

  const dotProjectSuffix = `-dot-${normalizedProject}`;
  if (serviceAndProject.endsWith(dotProjectSuffix)) {
    const versionOrService = serviceAndProject.slice(
      0,
      -dotProjectSuffix.length
    );
    return VALID_DNS_LABEL_REGEX.test(versionOrService);
  }

  return false;
}

/**
 * Resolved Relying Party context for an incoming HTTP request.
 */
export interface RequestContext {
  rpId: string;
  origin: string;
  associatedOrigins: string[];
}

/**
 * Configuration subset used by `getRequestContext`.
 */
export interface RpConfigOptions {
  is_prod?: boolean;
  hostname: string;
  origin: string;
  associated_origins: string[];
  project_name: string;
}

/**
 * Resolves the WebAuthn Relying Party ID, origin, and associated origins for the
 * incoming HTTP request.
 *
 * In production (`is_prod: true`), this always returns the static configuration
 * values to strictly enforce the canonical production domain.
 * In non-production environments (local development, custom development proxies,
 * and App Engine PR preview deployments), it dynamically derives the RP ID and
 * origin from the request host header if it matches an allowlisted domain
 * pattern.
 *
 * @param req - The incoming Express request (or request-like object).
 * @param cfg - Optional configuration override (defaults to global server config).
 * @returns The resolved `rpId`, `origin`, and `associatedOrigins`.
 */
export function getRequestContext(
  req: Pick<Request, 'headers' | 'hostname' | 'secure' | 'protocol'>,
  cfg: RpConfigOptions = config
): RequestContext {
  if (cfg.is_prod) {
    return {
      rpId: cfg.hostname,
      origin: cfg.origin,
      associatedOrigins: cfg.associated_origins,
    };
  }

  const forwardedHostHeader = req.headers?.['x-forwarded-host'];
  const rawForwardedHost = Array.isArray(forwardedHostHeader)
    ? forwardedHostHeader[0]
    : forwardedHostHeader;
  const rawHost =
    rawForwardedHost?.split(',')[0]?.trim() ||
    req.headers?.host?.trim() ||
    req.hostname ||
    '';

  if (!rawHost) {
    return {
      rpId: cfg.hostname,
      origin: cfg.origin,
      associatedOrigins: cfg.associated_origins,
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(`http://${rawHost}`);
  } catch {
    return {
      rpId: cfg.hostname,
      origin: cfg.origin,
      associatedOrigins: cfg.associated_origins,
    };
  }

  if (
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.pathname !== '/' ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    return {
      rpId: cfg.hostname,
      origin: cfg.origin,
      associatedOrigins: cfg.associated_origins,
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const host = parsedUrl.host.toLowerCase();

  if (!isAllowedDynamicHostname(hostname, cfg.project_name)) {
    return {
      rpId: cfg.hostname,
      origin: cfg.origin,
      associatedOrigins: cfg.associated_origins,
    };
  }

  const forwardedProtoHeader = req.headers?.['x-forwarded-proto'];
  const rawForwardedProto = Array.isArray(forwardedProtoHeader)
    ? forwardedProtoHeader[0]
    : forwardedProtoHeader;
  const forwardedProto = rawForwardedProto
    ?.split(',')[0]
    ?.trim()
    ?.toLowerCase();

  let protocol: 'http' | 'https';
  if (forwardedProto === 'https' || forwardedProto === 'http') {
    protocol = forwardedProto;
  } else if (req.secure || req.protocol === 'https') {
    protocol = 'https';
  } else if (hostname === 'localhost') {
    protocol = 'http';
  } else {
    protocol = 'https';
  }

  const dynamicOrigin = `${protocol}://${host}`;
  const origins = new Set<string>([
    dynamicOrigin,
    `https://${host}`,
    `https://${hostname}`,
    ...(hostname === 'localhost'
      ? [`http://${host}`, `http://${hostname}`]
      : []),
    ...cfg.associated_origins,
  ]);

  return {
    rpId: hostname,
    origin: dynamicOrigin,
    associatedOrigins: Array.from(origins),
  };
}
