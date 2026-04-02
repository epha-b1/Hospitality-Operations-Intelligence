export type UserRole = 'hotel_admin' | 'manager' | 'analyst' | 'member';

export interface JwtPayload {
  userId: string;
  username: string;
  role: UserRole;
  propertyId?: string;
  iat?: number;
  exp?: number;
}

export interface TokenResponse {
  accessToken: string;
  user: {
    id: string;
    username: string;
    role: UserRole;
  };
}
