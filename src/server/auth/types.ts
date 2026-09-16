export interface SessionUser {
  id: string;
  username: string;
  roles: string[];
}

export interface AuthSession {
  user: SessionUser;
  expiresAt: number;
  issuedAt: number;
}
