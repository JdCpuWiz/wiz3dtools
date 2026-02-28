import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/user.model.js';
import type { User, LoginDto, RegisterDto, AuthResponse } from '@wizqueue/shared';

const BCRYPT_ROUNDS = 12;

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

export function signToken(user: User): string {
  const payload: JwtPayload = { userId: user.id, username: user.username, role: user.role };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, getJwtSecret()) as JwtPayload;
  } catch {
    const err = new Error('Invalid or expired token') as any;
    err.statusCode = 401;
    throw err;
  }
}

export async function register(data: RegisterDto): Promise<AuthResponse> {
  const existing = await UserModel.findByUsername(data.username);
  if (existing) {
    const err = new Error('Username already taken') as any;
    err.statusCode = 409;
    throw err;
  }

  const count = await UserModel.countAll();
  const role = count === 0 ? 'admin' : (data.role || 'user');

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const user = await UserModel.create({ username: data.username, email: data.email, passwordHash, role });
  const token = signToken(user);
  return { user, token };
}

export async function login(data: LoginDto): Promise<AuthResponse> {
  const userWithHash = await UserModel.findByUsername(data.username);
  if (!userWithHash) {
    const err = new Error('Invalid credentials') as any;
    err.statusCode = 401;
    throw err;
  }

  const valid = await bcrypt.compare(data.password, userWithHash.passwordHash);
  if (!valid) {
    const err = new Error('Invalid credentials') as any;
    err.statusCode = 401;
    throw err;
  }

  const { passwordHash: _ph, ...user } = userWithHash;
  const token = signToken(user);
  return { user, token };
}
