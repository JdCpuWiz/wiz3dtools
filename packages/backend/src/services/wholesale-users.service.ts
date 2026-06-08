/**
 * wholesale-users.service — thin HTTP proxy to wiz3d-prints'
 * /api/internal/wholesale-users.
 *
 * wiz3d-prints owns the wholesale User table (next-auth credentials live
 * there); wiz3dtools is just an admin client. All traffic goes through
 * the internal endpoints with an `X-Admin-Token` header matching
 * `ADMIN_API_TOKEN` on the wiz3d-prints side. See BuildPlan #11 Phase 1
 * for the architecture rationale; Phase 8 renamed the URL from
 * /api/admin/wholesale to /api/internal/wholesale-users when the
 * wiz3d-prints built-in /admin/* surface was retired.
 *
 * No retries here — failures bubble up so the admin UI shows a real
 * error instead of masking transient outages.
 */

const BASE_URL = process.env.WIZ3D_PRINTS_API_URL;
const ADMIN_TOKEN = process.env.WIZ3D_PRINTS_ADMIN_TOKEN;

export interface WholesaleUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  wiz3dtoolsCustomerId: number | null;
  createdAt: string;
}

export interface CreateWholesaleUserInput {
  name: string;
  email: string;
  password: string;
  wiz3dtoolsCustomerId?: number | null;
}

export interface UpdateWholesaleUserInput {
  name?: string;
  email?: string;
  password?: string;
  active?: boolean;
  wiz3dtoolsCustomerId?: number | null;
}

export class WholesaleUsersConfigError extends Error {}

/** Forwarded from wiz3d-prints — status + parsed error body. */
export class WholesaleUsersUpstreamError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`wiz3d-prints returned ${status}`);
  }
}

function assertConfigured(): { baseUrl: string; token: string } {
  if (!BASE_URL || !ADMIN_TOKEN) {
    throw new WholesaleUsersConfigError(
      'WIZ3D_PRINTS_API_URL and WIZ3D_PRINTS_ADMIN_TOKEN must be set in the wiz3dtools env',
    );
  }
  return { baseUrl: BASE_URL.replace(/\/$/, ''), token: ADMIN_TOKEN };
}

async function call<T>(
  path: string,
  init: RequestInit & { body?: string } = {},
): Promise<T> {
  const { baseUrl, token } = assertConfigured();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-admin-token': token,
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new WholesaleUsersUpstreamError(res.status, body);
  return body as T;
}

export async function listWholesaleUsers(): Promise<WholesaleUser[]> {
  return call<WholesaleUser[]>('/api/internal/wholesale-users', { method: 'GET' });
}

export async function createWholesaleUser(
  input: CreateWholesaleUserInput,
): Promise<WholesaleUser> {
  return call<WholesaleUser>('/api/internal/wholesale-users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateWholesaleUser(
  id: string,
  input: UpdateWholesaleUserInput,
): Promise<WholesaleUser> {
  return call<WholesaleUser>(`/api/internal/wholesale-users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteWholesaleUser(id: string): Promise<void> {
  await call<void>(`/api/internal/wholesale-users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
