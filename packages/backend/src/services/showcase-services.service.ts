/**
 * showcase-services.service — proxy to wiz3d-prints /api/services.
 *
 * Same shape as showcase-portfolio.service — only the entity name and
 * field set differ. Per Phase 3 lesson learned, holding off on a
 * makeProxyService<T>() factory until 3+ entities exist that would
 * legitimately share it.
 */

const BASE_URL = process.env.WIZ3D_PRINTS_API_URL;
const ADMIN_TOKEN = process.env.WIZ3D_PRINTS_ADMIN_TOKEN;

export interface ShowcaseService {
  id: string;
  title: string;
  description: string;
  icon: string;
  features: string[];
  pricing: string | null;
  order: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShowcaseServiceInput {
  title: string;
  description: string;
  icon: string;
  features?: string[];
  pricing?: string | null;
  order?: number;
  published?: boolean;
}

export interface UpdateShowcaseServiceInput {
  title?: string;
  description?: string;
  icon?: string;
  features?: string[];
  pricing?: string | null;
  order?: number;
  published?: boolean;
}

export class ShowcaseServicesConfigError extends Error {}
export class ShowcaseServicesUpstreamError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`wiz3d-prints returned ${status}`);
  }
}

function assertConfigured(): { baseUrl: string; token: string } {
  if (!BASE_URL || !ADMIN_TOKEN) {
    throw new ShowcaseServicesConfigError(
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
  if (!res.ok) throw new ShowcaseServicesUpstreamError(res.status, body);
  return body as T;
}

export async function listShowcaseServices(): Promise<ShowcaseService[]> {
  return call<ShowcaseService[]>('/api/services', { method: 'GET' });
}

export async function createShowcaseService(
  input: CreateShowcaseServiceInput,
): Promise<ShowcaseService> {
  return call<ShowcaseService>('/api/services', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateShowcaseService(
  id: string,
  input: UpdateShowcaseServiceInput,
): Promise<ShowcaseService> {
  return call<ShowcaseService>(`/api/services/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteShowcaseService(id: string): Promise<void> {
  await call<void>(`/api/services/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
