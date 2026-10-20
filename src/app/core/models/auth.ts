export type Role = 'admin' | 'recruiter' | 'candidate';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  candidate_id: number | null;
  is_active: boolean;
  /** False until the person enters with the first emailed code */
  verified: boolean;
  created_at: string;
  last_login: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  user: User;
}

export interface RegisterInput {
  name: string;
  email: string;
  phone: string | null;
}

/** Answer of /auth/register and /auth/login: a code went to that email. */
export interface CodeSent {
  message: string;
  email: string;
}

export interface AuthOptions {
  /** Whether the two seeded demo accounts can enter without a code */
  demo_login: boolean;
}

export type DemoAccount = 'recruiter' | 'candidate';

export interface StaffUserInput {
  name: string;
  email: string;
  role: 'admin' | 'recruiter';
}

export interface UserUpdate {
  name?: string;
  role?: 'admin' | 'recruiter';
  is_active?: boolean;
}
