/**
 * showcase-materials.service — proxy to wiz3d-prints /api/materials.
 * Same pattern as showcase-portfolio + showcase-services.
 */

const BASE_URL = process.env.WIZ3D_PRINTS_API_URL;
const ADMIN_TOKEN = process.env.WIZ3D_PRINTS_ADMIN_TOKEN;

export interface ShowcaseMaterial {
  id: string;
  name: string;
  description: string;
  properties: string[];
  applications: string[];
  colors: string[];
  order: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShowcaseMaterialInput {
  name: string;
  description: string;
  properties?: string[];
  applications?: string[];
  colors?: string[];
  order?: number;
  published?: boolean;
}

export type UpdateShowcaseMaterialInput = Partial<CreateShowcaseMaterialInput>;

export class ShowcaseMaterialsConfigError extends Error {}
export class ShowcaseMaterialsUpstreamError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`wiz3d-prints returned ${status}`);
  }
}

function assertConfigured(): { baseUrl: string; token: string } {
  if (!BASE_URL || !ADMIN_TOKEN) {
    throw new ShowcaseMaterialsConfigError(
      'WIZ3D_PRINTS_API_URL and WIZ3D_PRINTS_ADMIN_TOKEN must be set in the wiz3dtools env',
    );
  }
  return { baseUrl: BASE_URL.replace(/\/$/, ''), token: ADMIN_TOKEN };
}

async function call<T>(path: string, init: RequestInit & { body?: string } = {}): Promise<T> {
  const { baseUrl, token } = assertConfigured();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-admin-token': token, ...(init.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ShowcaseMaterialsUpstreamError(res.status, body);
  return body as T;
}

export const listShowcaseMaterials = () => call<ShowcaseMaterial[]>('/api/materials', { method: 'GET' });
export const createShowcaseMaterial = (input: CreateShowcaseMaterialInput) =>
  call<ShowcaseMaterial>('/api/materials', { method: 'POST', body: JSON.stringify(input) });
export const updateShowcaseMaterial = (id: string, input: UpdateShowcaseMaterialInput) =>
  call<ShowcaseMaterial>(`/api/materials/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) });
export const deleteShowcaseMaterial = (id: string) =>
  call<void>(`/api/materials/${encodeURIComponent(id)}`, { method: 'DELETE' });
