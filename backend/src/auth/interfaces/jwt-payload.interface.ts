export interface JwtPayload {
  sub: number;
  email: string;
  roles: string[];
  mustChangePassword?: boolean;
  type?: 'access';
}
