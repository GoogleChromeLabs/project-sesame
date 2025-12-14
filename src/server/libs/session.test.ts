import { test, describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { SessionService, UserSignInStatus } from './session.js';
import { Session } from 'express-session';
import { User, SignUpUser } from './users.js';

// Mock config
// We might need to mock config if it's imported directly in SessionService. 
// For now, let's assume default values or that the environment variables are set or we can use a mock via loader if needed,
// but since we are importing from a path, mocking module effectively in native node test runner is tricky without a loader.
// However, session.ts imports config from '~project-sesame/server/config.ts'. 
// We should check if we can run this test easily. 
// If `getTime` depends on Date.now, we can mock that or just rely on relative time logic? 
// session.ts uses `getTime`. 

describe('SessionService', () => {
  let mockSession: Partial<Session>;
  let service: SessionService;

  beforeEach(() => {
    mockSession = {};
    service = new SessionService(mockSession as Session);
  });

  describe('Challenge', () => {
    it('should set a random challenge if none provided', () => {
      const challenge = service.setChallenge();
      assert.ok(challenge);
      assert.strictEqual(mockSession.challenge, challenge);
    });

    it('should set a specific challenge', () => {
      const challenge = 'specific-challenge';
      service.setChallenge(challenge);
      assert.strictEqual(mockSession.challenge, challenge);
    });

    it('should get challenge', () => {
      mockSession.challenge = 'test-challenge';
      assert.strictEqual(service.getChallenge(), 'test-challenge');
    });

    it('should delete challenge', () => {
      mockSession.challenge = 'test-challenge';
      service.deleteChallenge();
      assert.strictEqual(mockSession.challenge, undefined);
    });
  });

  describe('Sign Up', () => {
    it('should set signing up user', () => {
      const user: SignUpUser = { username: 'newuser', displayName: 'New User' };
      service.setSigningUp(user);
      assert.strictEqual(mockSession.signup_username, 'newuser');
      assert.deepStrictEqual(mockSession.signup_user, user);
    });

    it('should get signing up user', () => {
      const user: SignUpUser = { username: 'newuser', displayName: 'New User' };
      mockSession.signup_user = user;
      assert.deepStrictEqual(service.getSigningUp(), user);
    });

    it('should reset signing up', () => {
      mockSession.signup_username = 'newuser';
      mockSession.signup_user = { username: 'newuser', displayName: 'New User' };
      service.resetSigningUp();
      assert.strictEqual(mockSession.signup_username, undefined);
      assert.strictEqual(mockSession.signup_user, undefined);
    });
  });

  describe('Sign In', () => {
    it('should set signing in username', () => {
      service.setSigningIn('existinguser');
      assert.strictEqual(mockSession.signin_username, 'existinguser');
    });

    it('should throw error for invalid username', () => {
      assert.throws(() => service.setSigningIn(''), /Invalid username/);
    });

    it('should reset signing in', () => {
      mockSession.signin_username = 'existinguser';
      service.resetSigningIn();
      assert.strictEqual(mockSession.signin_username, undefined);
    });
  });

  describe('Signed In', () => {
    it('should set signed in user and clear other states', () => {
      // @ts-ignore
      const user: User = { id: '1', username: 'user', displayName: 'User' };
      mockSession.challenge = 'c';
      mockSession.signin_username = 'u';
      mockSession.signup_user = { username: 'u', displayName: 'U' };

      service.setSignedIn(user);

      assert.strictEqual(mockSession.challenge, undefined);
      assert.strictEqual(mockSession.signin_username, undefined);
      assert.strictEqual(mockSession.signup_user, undefined);
      assert.deepStrictEqual(mockSession.user, user);
      assert.ok(mockSession.last_signedin_at);
    });
  });

  describe('Sign Out', async () => {
    it('should destroy session', async () => {
      let destroyed = false;
      mockSession.destroy = (fn) => {
        destroyed = true;
        if (fn) fn(undefined);
        return mockSession as Session;
      };

      await service.setSignedOut();
      assert.ok(destroyed);
    });
  });

  describe('Status', () => {
    it('should return SignedOut if no user or pending state', () => {
      assert.strictEqual(service.getSignInStatus(), UserSignInStatus.SignedOut);
    });

    it('should return SigningUp if signup_username is present', () => {
      mockSession.signup_username = 'u';
      assert.strictEqual(service.getSignInStatus(), UserSignInStatus.SigningUp);
    });

    it('should return SigningIn if signin_username is present', () => {
      mockSession.signin_username = 'u';
      assert.strictEqual(service.getSignInStatus(), UserSignInStatus.SigningIn);
    });

    it('should return RecentlySignedIn if recently signed in', () => {
      // @ts-ignore
      const user: User = { id: '1', username: 'user', displayName: 'User' };
      mockSession.user = user;
      mockSession.last_signedin_at = Date.now();

      // Note: This relies on config.short_session_duration. 
      // If tests fail due to config dependency, we might need to mock config or adjust usage.
      // Assuming default/mock environment works for now.
      assert.strictEqual(service.getSignInStatus(), UserSignInStatus.RecentlySignedIn);
    });
  });
});
