export interface User {
  id: number;
  username: string;
  email: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginDto {
  username: string;
  password: string;
}

export interface RegisterDto {
  username: string;
  email?: string;
  password: string;
  role?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}
