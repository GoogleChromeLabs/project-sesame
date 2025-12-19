import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { CustomFirestoreStore } from './custom-firestore-session.ts';
import { Timestamp } from 'firebase-admin/firestore';
import { SessionData } from 'express-session';

describe('CustomFirestoreStore', () => {
  let mockDb: any;
  let store: CustomFirestoreStore;

  beforeEach(() => {
    mockDb = {
      collection: (kind: string) => ({
        doc: (sid: string) => ({
          set: (data: any, options: any) => Promise.resolve(),
        }),
      }),
    };
    // @ts-ignore
    store = new CustomFirestoreStore({ dataset: mockDb, kind: 'sessions' });
    // Override the db property because super() might set it differently
    (store as any).db = mockDb;
  });

  it('should set expiresAt as a Timestamp', async () => {
    const sid = 'test-sid';
    // @ts-ignore
    const sess: SessionData = { cookie: { maxAge: 1000 } };

    // Spy on the set method
    let capturedData: any;
    mockDb.collection = (kind: string) => ({
      doc: (docSid: string) => ({
        set: (data: any, options: any) => {
          capturedData = data;
          return Promise.resolve();
        },
      }),
    });

    await store.set(sid, sess);

    assert.ok(capturedData, 'Data should be captured');
    assert.ok(capturedData.expiresAt instanceof Timestamp, `expiresAt should be a Timestamp, but got ${typeof capturedData.expiresAt}`);
  });
});
