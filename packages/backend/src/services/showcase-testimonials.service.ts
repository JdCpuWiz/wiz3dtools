/**
 * showcase-testimonials.service — proxy to wiz3d-prints /api/testimonials.
 * Notable: testimonials can link to a portfolio item via portfolioItemId.
 */

const BASE_URL = process.env.WIZ3D_PRINTS_API_URL;
const ADMIN_TOKEN = process.env.WIZ3D_PRINTS_ADMIN_TOKEN;

export interface ShowcaseTestimonial {
  id: string;
  name: string;
  role: string;
  company: string | null;
  content: string;
  rating: number;
  icon: string | null;
  featured: boolean;
  published: boolean;
  portfolioItemId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShowcaseTestimonialInput {
  name: string;
  role: string;
  company?: string | null;
  content: string;
  rating?: number;
  icon?: string | null;
  featured?: boolean;
  published?: boolean;
  portfolioItemId?: string | null;
}

export type UpdateShowcaseTestimonialInput = Partial<CreateShowcaseTestimonialInput>;

export class ShowcaseTestimonialsConfigError extends Error {}
export class ShowcaseTestimonialsUpstreamError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`wiz3d-prints returned ${status}`);
  }
}

function assertConfigured(): { baseUrl: string; token: string } {
  if (!BASE_URL || !ADMIN_TOKEN) {
    throw new ShowcaseTestimonialsConfigError(
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
  if (!res.ok) throw new ShowcaseTestimonialsUpstreamError(res.status, body);
  return body as T;
}

export const listShowcaseTestimonials = () => call<ShowcaseTestimonial[]>('/api/testimonials', { method: 'GET' });
export const createShowcaseTestimonial = (input: CreateShowcaseTestimonialInput) =>
  call<ShowcaseTestimonial>('/api/testimonials', { method: 'POST', body: JSON.stringify(input) });
export const updateShowcaseTestimonial = (id: string, input: UpdateShowcaseTestimonialInput) =>
  call<ShowcaseTestimonial>(`/api/testimonials/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) });
export const deleteShowcaseTestimonial = (id: string) =>
  call<void>(`/api/testimonials/${encodeURIComponent(id)}`, { method: 'DELETE' });
