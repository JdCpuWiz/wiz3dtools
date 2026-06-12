import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/user.model.js';
import type { User, LoginDto, RegisterDto } from '@wizqueue/shared';

const BCRYPT_ROUNDS = 12;

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
  csrfToken: string;
}

export interface AuthResult {
  user: User;
  token: string;
  csrfToken: string;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  if (secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters long');
  return secret;
}

export function signToken(user: User): { token: string; csrfToken: string } {
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const payload: JwtPayload = { userId: user.id, username: user.username, role: user.role, csrfToken };
  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '24h' });
  return { token, csrfToken };
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

export async function register(data: RegisterDto): Promise<AuthResult> {
  if (!data.password || data.password.length < 12) {
    const err = new Error('Password must be at least 12 characters') as any;
    err.statusCode = 400;
    throw err;
  }

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
  const { token, csrfToken } = signToken(user);
  return { user, token, csrfToken };
}

// ── Per-customer store-API tokens (Change #148 F7) ────────────────────────────
//
// HMAC-signed short-lived token that ties a /api/store/* call to a specific
// customerId. Format: `${base64url(JSON{customerId,exp})}.${base64url(sig)}`.
// Verified by `requireStoreCustomerToken` middleware; minted by POST
// /api/store/customers/token after email+password verification.
//
// Why HMAC and not JWT: smaller payload, no library dep churn, no clock-skew
// fields we don't use, no signing-algo confusion attacks. Single secret in
// the env that signs + verifies.

const STORE_TOKEN_TTL_SEC = 30 * 60; // 30 min

export interface StoreCustomerTokenPayload {
  customerId: number;
  exp: number; // unix seconds
}

function getStoreCustomerTokenSecret(): string {
  const s = process.env.STORE_CUSTOMER_TOKEN_SECRET;
  if (!s) throw new Error('STORE_CUSTOMER_TOKEN_SECRET environment variable is not set');
  if (s.length < 32) throw new Error('STORE_CUSTOMER_TOKEN_SECRET must be at least 32 characters long');
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): Buffer {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

export function signStoreCustomerToken(customerId: number): { token: string; expiresAt: number } {
  const exp = Math.floor(Date.now() / 1000) + STORE_TOKEN_TTL_SEC;
  const payload: StoreCustomerTokenPayload = { customerId, exp };
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = crypto.createHmac('sha256', getStoreCustomerTokenSecret()).update(body).digest();
  return { token: `${body}.${b64url(sig)}`, expiresAt: exp };
}

export function verifyStoreCustomerToken(token: string): StoreCustomerTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 2) {
    const err = new Error('Malformed store-customer token') as any;
    err.statusCode = 401;
    throw err;
  }
  const [body, sig] = parts;
  const expected = crypto.createHmac('sha256', getStoreCustomerTokenSecret()).update(body).digest();
  const provided = b64urlDecode(sig);
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    const err = new Error('Invalid store-customer token signature') as any;
    err.statusCode = 401;
    throw err;
  }
  let payload: StoreCustomerTokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString('utf8'));
  } catch {
    const err = new Error('Malformed store-customer token payload') as any;
    err.statusCode = 401;
    throw err;
  }
  if (!Number.isInteger(payload?.customerId) || !Number.isInteger(payload?.exp)) {
    const err = new Error('Malformed store-customer token payload') as any;
    err.statusCode = 401;
    throw err;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    const err = new Error('Store-customer token expired') as any;
    err.statusCode = 401;
    throw err;
  }
  return payload;
}

export async function login(data: LoginDto): Promise<AuthResult> {
  const userWithHash = await UserModel.findByUsername(data.username);
  if (!userWithHash) {
    console.warn(`[AUTH] Failed login attempt for unknown username: ${data.username} at ${new Date().toISOString()}`);
    const err = new Error('Invalid credentials') as any;
    err.statusCode = 401;
    throw err;
  }

  const valid = await bcrypt.compare(data.password, userWithHash.passwordHash);
  if (!valid) {
    console.warn(`[AUTH] Failed login attempt for username: ${data.username} at ${new Date().toISOString()}`);
    const err = new Error('Invalid credentials') as any;
    err.statusCode = 401;
    throw err;
  }

  const { passwordHash: _ph, ...user } = userWithHash;
  const { token, csrfToken } = signToken(user);
  console.info(`[AUTH] Successful login: ${user.username} at ${new Date().toISOString()}`);
  return { user, token, csrfToken };
}
