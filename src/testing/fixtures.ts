/** Shared test data. */
import { User } from '../app/core/models';

/** Unsigned token with the given expiry (seconds since epoch); the client only reads the payload. */
export function fakeToken(exp: number): string {
  const payload = btoa(JSON.stringify({ sub: '1', role: 'admin', exp })).replace(/=+$/, '');
  return `header.${payload}.signature`;
}

export const USER: User = {
  id: 1,
  name: 'Laura Gómez',
  email: 'laura@empresa.com',
  role: 'recruiter',
  candidate_id: null,
  is_active: true,
  verified: true,
  created_at: '2026-10-10T00:00:00Z',
  last_login: null,
};
