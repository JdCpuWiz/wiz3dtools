// Facebook Page posting (Change #442). Plain `fetch` against the Graph API —
// no SDK. Design + one-time Meta app/token setup: the SOCIAL_POSTING.md doc in
// the wiz3d-prints repo (C438 investigation).
//
// Env (BOTH required; either one missing = the whole feature is HIDDEN in the
// admin UI and every call here refuses loudly — that absence is the kill
// switch):
//   FACEBOOK_PAGE_ID    — numeric Page id
//   FACEBOOK_PAGE_TOKEN — NON-EXPIRING Page access token. It only counts as
//                         non-expiring when it was derived from a long-lived
//                         USER token via /me/accounts; a token pasted straight
//                         out of Graph API Explorer dies in ~1 hour. Refresh
//                         runbook: wiz3d-prints/scripts/facebook-refresh-tokens.sh.
//
// Design rule (opposite of notify.service.ts, deliberately): failures here are
// NEVER silent. A dead token is the realistic failure and it must be visible in
// the admin UI, because the only symptom otherwise is "posts stopped happening"
// — which nobody notices. Callers decide whether a failure is fatal; this
// module always throws with the Graph message intact.

// Pinned Graph version. Meta keeps a version alive ~2 years; bump here only.
const GRAPH_VERSION = 'v23.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

// A Page fetching a photo from our storefront can take a moment; 20s is
// generous enough that a slow image fetch isn't reported as a token problem.
const TIMEOUT_MS = 20_000;

const PAGE_ID = process.env.FACEBOOK_PAGE_ID || '';
const PAGE_TOKEN = process.env.FACEBOOK_PAGE_TOKEN || '';

/** True when both env vars are present. Drives the admin UI's kill switch. */
export function isFacebookConfigured(): boolean {
  return Boolean(PAGE_ID && PAGE_TOKEN);
}

export interface FacebookPostInput {
  /** Caption / message body. Product name + description + PDP link. */
  message: string;
  /** Public URL of the product's primary image. Absent → text+link post. */
  imageUrl?: string | null;
  /** PDP link — only used by the no-image `/feed` fallback. */
  link?: string;
  /**
   * VERIFICATION ONLY (scripts/facebook-smoke.mjs). Uploads the photo to the
   * Page's media library WITHOUT publishing it to the feed, so a live token
   * can be exercised end to end without anyone seeing a post. This is the same
   * round-trip the C438 investigation used to validate the tokens. Never set
   * by the product publish path.
   */
  unpublished?: boolean;
}

export interface FacebookPostResult {
  /** Graph `post_id` ("{page-id}_{post-id}"); the id facebook.com/<id> opens. */
  postId: string;
  /** True when this went out as a photo post rather than the feed fallback. */
  withPhoto: boolean;
}

function graphError(payload: unknown, status: number): Error {
  const err = (payload as { error?: { message?: string; code?: number; error_subcode?: number } })?.error;
  const detail = err?.message || `Facebook returned HTTP ${status}`;
  const code = err?.code ? ` (code ${err.code}${err.error_subcode ? `/${err.error_subcode}` : ''})` : '';
  return new Error(`Facebook: ${detail}${code}`);
}

async function graphPost(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({ ...params, access_token: PAGE_TOKEN });

  let res: Response;
  try {
    res = await fetch(`${GRAPH_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Facebook: could not reach the Graph API (${message})`);
  }

  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw graphError(payload, res.status);
  return payload;
}

/**
 * Post to the configured Page. Uses `/{page-id}/photos` when an image URL is
 * given (Facebook fetches the image itself, so the URL must be publicly
 * reachable), and falls back to `/{page-id}/feed` for a text+link post.
 *
 * Throws on any failure, with the Graph error message preserved so the admin
 * sees WHY (expired token, unreachable image, …) rather than "posting failed".
 */
export async function postToPage(input: FacebookPostInput): Promise<FacebookPostResult> {
  if (!isFacebookConfigured()) {
    throw Object.assign(
      new Error('Facebook posting is not configured on this server — FACEBOOK_PAGE_ID / FACEBOOK_PAGE_TOKEN are unset.'),
      { statusCode: 503 },
    );
  }
  if (!input.message?.trim()) throw new Error('Facebook: refusing to post an empty caption');

  if (input.imageUrl) {
    const data = await graphPost(`/${PAGE_ID}/photos`, {
      url: input.imageUrl,
      caption: input.message,
      published: input.unpublished ? 'false' : 'true',
    });
    // /photos answers { id, post_id }; post_id is the feed story (what a human
    // opens). Fall back to id so a shape change can't lose the marker.
    const postId = (data.post_id as string) || (data.id as string);
    if (!postId) throw new Error('Facebook: post succeeded but returned no id');
    return { postId, withPhoto: true };
  }

  const data = await graphPost(`/${PAGE_ID}/feed`, {
    message: input.message,
    ...(input.link ? { link: input.link } : {}),
  });
  const postId = data.id as string;
  if (!postId) throw new Error('Facebook: post succeeded but returned no id');
  return { postId, withPhoto: false };
}
