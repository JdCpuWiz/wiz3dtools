// Zoo-Notifier source client (BP38 P7). Adapted from the canonical
// clients/notify-client.ts in the zoo-notifier repo — keep the wire contract
// identical to that file. POSTs a push notification to the ecosystem hub.
//
// Env (both optional; a missing/blank key makes every call a SILENT no-op so
// wiz3dtools never breaks its own order/payment flow when the hub is down or
// un-provisioned):
//   ZOO_NOTIFIER_URL — hub base URL. LAN default http://192.168.7.84:3030
//   ZOO_NOTIFIER_KEY — wiz3dtools' per-source Bearer key (zn_…)
//
// Contract: POST {ZOO_NOTIFIER_URL}/api/notify
//   Authorization: Bearer <ZOO_NOTIFIER_KEY>
//   body: { title, body?, category?, priority?, deepLink?, dedupeKey? }
//   Same (source, dedupeKey) within 10 min is deduped hub-side.
//
// Design rule: FIRE-AND-FORGET. notify() never throws and never blocks the
// caller's happy path — a down hub must not fail an order.

export type NotifyPriority = 'passive' | 'active' | 'time-sensitive' | 'critical';

export interface NotifyInput {
  title: string;
  body?: string;
  /** Category slug — devices subscribe/mute per category. e.g. "orders". */
  category?: string;
  priority?: NotifyPriority;
  /** Absolute URL the iOS app opens on tap (deep link into the tools UI). */
  deepLink?: string;
  /** Same (source, dedupeKey) within 10 min is dropped hub-side. */
  dedupeKey?: string;
}

const URL_ENV = process.env.ZOO_NOTIFIER_URL || 'http://192.168.7.84:3030';
const KEY_ENV = process.env.ZOO_NOTIFIER_KEY || '';

/**
 * Send a push notification to the Zoo-Notifier hub. Resolves to true on a
 * 2xx, false otherwise (including when unconfigured). Never throws.
 */
export async function notify(input: NotifyInput): Promise<boolean> {
  if (!KEY_ENV) return false; // hub not provisioned for this source — no-op
  if (!input?.title) return false;
  try {
    const res = await fetch(`${URL_ENV.replace(/\/$/, '')}/api/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KEY_ENV}`,
      },
      body: JSON.stringify(input),
      // Never let a slow/dead hub wedge the caller.
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false; // network/timeout/etc. — swallow; this is best-effort
  }
}

/**
 * Fire-and-forget wrapper. Kicks off notify() without awaiting so the caller's
 * request finishes regardless of the hub, and logs (never throws) on failure.
 */
export function notifyAsync(input: NotifyInput): void {
  void notify(input).then(
    (ok) => {
      if (!ok && KEY_ENV) {
        console.warn(`[notify] hub rejected/failed push: ${input.title}`);
      }
    },
    (err) => {
      console.warn('[notify] unexpected error (swallowed):', err?.message ?? err);
    },
  );
}
