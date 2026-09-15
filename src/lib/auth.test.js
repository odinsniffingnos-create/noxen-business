import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAuthSession,
  signIn,
  signOut,
  hasFeatureAccess,
} from './auth.js';

test('returns null when there is no saved auth session', () => {
  localStorage.clear();
  assert.equal(getAuthSession(), null);
});

test('signIn creates a session for a known business owner account', () => {
  const session = signIn({
    email: 'owner@noxenbusiness.com',
    password: 'noxen123',
    businessName: 'Noxen Business',
  });

  assert.ok(session);
  assert.equal(session.user.email, 'owner@noxenbusiness.com');
  assert.equal(session.user.role, 'owner');
});

test('feature access resolves to the user plan', () => {
  const session = signIn({
    email: 'owner@noxenbusiness.com',
    password: 'noxen123',
    businessName: 'Noxen Business',
  });

  assert.equal(hasFeatureAccess(session, 'advanced_analytics'), true);
  assert.equal(hasFeatureAccess(session, 'team_collaboration'), false);
});

test('signOut clears the active session', () => {
  signIn({
    email: 'owner@noxenbusiness.com',
    password: 'noxen123',
    businessName: 'Noxen Business',
  });

  signOut();
  assert.equal(getAuthSession(), null);
});
