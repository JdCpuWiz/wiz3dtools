/**
 * showcase-portfolio.service — proxy to wiz3d-prints /api/portfolio.
 *
 * Portfolio data + admin auth live in wiz3d-prints (existing PortfolioItem
 * Prisma model + /api/portfolio routes that accept X-Admin-Token).
 * wiz3dtools is just the admin client surface — see BuildPlan #11 Phase 3.
 *
 * Same pattern as wholesale-users.service. If we end up with services /
 * materials / testimonials / about following suit, consider extracting a
 * shared makeProxyService<T>() factory. Holding off for now — 5 entities
 * isn't enough to justify the abstraction yet.
 */

const BASE_URL = process.env.WIZ3D_PRINTS_API_URL;
const ADMIN_TOKEN = process.env.WIZ3D_PRINTS_ADMIN_TOKEN;

export interface ShowcasePortfolioItem {
  id: string;
  title: string;
  description: string;
  category: string;
  material: string;
  dimensions: string | null;
  printTime: string | null;
  images: string[];
  featured: boolean;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShowcasePortfolioInput {
  title: string;
  description: string;
  category: string;
  material: string;
  dimensions?: string | null;
  printTime?: string | null;
  images?: string[];
  featured?: boolean;
  published?: boolean;
}

export interface UpdateShowcasePortfolioInput {
  title?: string;
  description?: string;
  category?: string;
  material?: string;
  dimensions?: string | null;
  printTime?: string | null;
  images?: string[];
  featured?: boolean;
  published?: boolean;
}

export class ShowcasePortfolioConfigError extends Error {}
export class ShowcasePortfolioUpstreamError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`wiz3d-prints returned ${status}`);
  }
}

function assertConfigured(): { baseUrl: string; token: string } {
  if (!BASE_URL || !ADMIN_TOKEN) {
    throw new ShowcasePortfolioConfigError(
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
  if (!res.ok) throw new ShowcasePortfolioUpstreamError(res.status, body);
  return body as T;
}

export async function listShowcasePortfolio(): Promise<ShowcasePortfolioItem[]> {
  // GET is public — no token needed — but we send it anyway since the
  // proxy is always authenticated on this side.
  return call<ShowcasePortfolioItem[]>('/api/portfolio', { method: 'GET' });
}

export async function createShowcasePortfolio(
  input: CreateShowcasePortfolioInput,
): Promise<ShowcasePortfolioItem> {
  return call<ShowcasePortfolioItem>('/api/portfolio', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateShowcasePortfolio(
  id: string,
  input: UpdateShowcasePortfolioInput,
): Promise<ShowcasePortfolioItem> {
  return call<ShowcasePortfolioItem>(`/api/portfolio/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteShowcasePortfolio(id: string): Promise<void> {
  await call<void>(`/api/portfolio/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
