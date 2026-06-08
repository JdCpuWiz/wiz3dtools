/**
 * showcase-about.service — proxy to wiz3d-prints /api/about. Polymorphic
 * entity: `kind` is "stat" | "equipment" | "value" and `data` is a Json
 * blob shaped per kind (see prisma/schema.prisma in wiz3d-prints for the
 * canonical contract). Admin list passes ?all=true to get a flat array
 * (including drafts) rather than the grouped public response.
 */

const BASE_URL = process.env.WIZ3D_PRINTS_API_URL;
const ADMIN_TOKEN = process.env.WIZ3D_PRINTS_ADMIN_TOKEN;

export type AboutBlockKind = 'stat' | 'equipment' | 'value';

export interface ShowcaseAboutBlock {
  id: string;
  kind: AboutBlockKind;
  data: Record<string, unknown>;
  sortOrder: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShowcaseAboutInput {
  kind: AboutBlockKind;
  data: Record<string, unknown>;
  sortOrder?: number;
  published?: boolean;
}

export type UpdateShowcaseAboutInput = Partial<CreateShowcaseAboutInput>;

export class ShowcaseAboutConfigError extends Error {}
export class ShowcaseAboutUpstreamError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`wiz3d-prints returned ${status}`);
  }
}

function assertConfigured(): { baseUrl: string; token: string } {
  if (!BASE_URL || !ADMIN_TOKEN) {
    throw new ShowcaseAboutConfigError(
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
  if (!res.ok) throw new ShowcaseAboutUpstreamError(res.status, body);
  return body as T;
}

// Admin list — uses ?all=true so the upstream returns the flat array
// (including drafts), not the grouped public shape.
export const listShowcaseAbout = () => call<ShowcaseAboutBlock[]>('/api/about?all=true', { method: 'GET' });
export const createShowcaseAbout = (input: CreateShowcaseAboutInput) =>
  call<ShowcaseAboutBlock>('/api/about', { method: 'POST', body: JSON.stringify(input) });
export const updateShowcaseAbout = (id: string, input: UpdateShowcaseAboutInput) =>
  call<ShowcaseAboutBlock>(`/api/about/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) });
export const deleteShowcaseAbout = (id: string) =>
  call<void>(`/api/about/${encodeURIComponent(id)}`, { method: 'DELETE' });
