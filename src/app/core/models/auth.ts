export type Role = 'admin' | 'recruiter' | 'candidate';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  candidate_id: number | null;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  user: User;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone: string | null;
}

export interface StaffUserInput {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'recruiter';
}

export interface UserUpdate {
  name?: string;
  role?: 'admin' | 'recruiter';
  is_active?: boolean;
  password?: string;
}
