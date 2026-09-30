// Reclaim "Meeting Created" webhook -> GA4 Measurement Protocol.
//
// The booking link on /mechanics-only carries data-ga_cid / data-gclid /
// data-fbclid query params (see the "Reclaim booking attribution" script in
// public/mechanics-only.html). Reclaim echoes them back in this webhook, so a
// completed booking can be reported server-side even when the click can't be seen.
//
// Requires in Cloudflare Pages → Settings → Environment variables → Production:
//   RECLAIM_WEBHOOK_SECRET  shared secret shown in Reclaim when the webhook is created
//   GA4_API_SECRET          GA4 Admin → Data streams → Measurement Protocol API secrets
// Optional:
//   GA4_MP_DEBUG=1          send to GA4's validation endpoint and log its verdict
//                           (events sent there do NOT appear in reports)
//
// POST only — GET falls through to the static site (same as contact.js).
// Google Ads (gclid) forwarding is intentionally NOT built yet — follow-up once
// the GA4 path is verified end to end.

const GA4_MEASUREMENT_ID = 'G-DNK8STLEH3';

// TODO: confirm header name once the webhook config exists in Reclaim.
// Reclaim shows the verification method when the webhook is created; this is a
// placeholder, not their documented value.
const WEBHOOK_SECRET_HEADER = 'x-reclaim-webhook-secret';

// TODO: confirm against a real payload. Event type and the echoed data-* params
// are searched for defensively until the actual shape is known.
const CREATED_EVENT = 'meeting created';

function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// Depth-first search for the first string/number value stored under `key`.
function findKey(node, key) {
  if (!node || typeof node !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(node, key)) {
    const v = node[key];
    if (typeof v === 'string' || typeof v === 'number') return String(v);
  }
  for (const k of Object.keys(node)) {
    const found = findKey(node[k], key);
    if (found !== undefined) return found;
  }
  return undefined;
}

function eventType(payload) {
  const raw = findKey(payload, 'event') || findKey(payload, 'eventType') ||
    findKey(payload, 'event_type') || findKey(payload, 'type') || '';
  return raw.replace(/[_-]+/g, ' ').trim().toLowerCase();
}

// Keep webhook logs debuggable without storing attendee emails in them.
function redact(payload) {
  return JSON.stringify(payload).replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]');
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

export async function onRequestPost(context) {
  const { request, env } = context;
  const log = {};

  // --- Verify shared secret (fail closed) --------------------------------
  const expected = env.RECLAIM_WEBHOOK_SECRET;
  const provided = request.headers.get(WEBHOOK_SECRET_HEADER) || '';
  log.verified = Boolean(expected) && timingSafeEqual(provided, expected);
  if (!log.verified) {
    console.log('[reclaim-webhook]', JSON.stringify({ ...log, reason: expected ? 'bad secret' : 'RECLAIM_WEBHOOK_SECRET not set' }));
    return json({ error: 'forbidden' }, 403);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    console.log('[reclaim-webhook]', JSON.stringify({ ...log, reason: 'invalid json' }));
    return json({ error: 'invalid json' }, 400);
  }

  log.event = eventType(payload);
  log.payload = redact(payload);
  const attribution = {
    ga_cid: findKey(payload, 'data-ga_cid'),
    gclid: findKey(payload, 'data-gclid'),
    fbclid: findKey(payload, 'data-fbclid'),
  };
  log.attribution = attribution;

  // Only "Meeting Created" for v1. Cancel/reschedule handling is a follow-up.
  if (log.event !== CREATED_EVENT) {
    log.outcome = 'ignored (not Meeting Created)';
    console.log('[reclaim-webhook]', JSON.stringify(log));
    return json({ ok: true, ignored: true });
  }

  // GA4 needs a client_id to attribute the event to a visitor.
  if (!attribution.ga_cid) {
    log.outcome = 'skipped: no data-ga_cid (visitor booked without a captured GA client id)';
    console.log('[reclaim-webhook]', JSON.stringify(log));
    return json({ ok: true, skipped: 'no ga_cid' });
  }
  if (!env.GA4_API_SECRET) {
    log.outcome = 'GA4_API_SECRET not set';
    console.log('[reclaim-webhook]', JSON.stringify(log));
    return json({ error: 'not configured' }, 500);
  }

  // --- Forward to GA4 Measurement Protocol ------------------------------
  const base = env.GA4_MP_DEBUG === '1'
    ? 'https://www.google-analytics.com/debug/mp/collect'
    : 'https://www.google-analytics.com/mp/collect';
  const url = `${base}?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${encodeURIComponent(env.GA4_API_SECRET)}`;
  const params = { source: 'reclaim_webhook', engagement_time_msec: 1 };
  if (attribution.gclid) params.gclid = attribution.gclid;
  if (attribution.fbclid) params.fbclid = attribution.fbclid;

  try {
    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        client_id: attribution.ga_cid,
        events: [{ name: 'booking_completed', params }],
      }),
    });
    log.ga4Status = res.status;
    if (env.GA4_MP_DEBUG === '1') log.ga4Validation = await res.text();
    log.outcome = res.ok ? 'forwarded to GA4' : 'GA4 rejected';
  } catch (e) {
    log.outcome = 'GA4 request failed: ' + e.message;
  }

  console.log('[reclaim-webhook]', JSON.stringify(log));
  // Always 200 once verified so Reclaim doesn't retry and double-count.
  return json({ ok: true, outcome: log.outcome });
}
