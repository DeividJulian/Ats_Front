import { USER } from '../../../../testing/fixtures';
import { accountState } from './users';

describe('accountState', () => {
  it('tells active, unverified and deactivated accounts apart', () => {
    expect(accountState(USER)).toBe('active');
    expect(accountState({ ...USER, verified: false })).toBe('unverified');
    // Deactivated wins: it can't be used whatever its verification
    expect(accountState({ ...USER, verified: false, is_active: false })).toBe('inactive');
  });
});
