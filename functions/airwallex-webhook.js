// Airwallex webhook — the source of truth for self-serve quiz payments.
// The client-side "success" redirect is never trusted; a lead only counts
// as paid once this endpoint verifies the event signature.
//
// On a paid event it:
//   1. emails the team (Resend),
//   2. creates a PAID task in the ClickUp MM Pipeline,
//   3. sends the customer a what-happens-next confirmation email.
//
// Requires in Cloudflare Pages → Settings → Environment variables:
//   AIRWALLEX_WEBHOOK_SECRET — from Airwallex → Developer → Webhooks
//   RESEND_API_KEY, CLICKUP_API_TOKEN — already set for the contact form
//
// Airwallex webhook endpoint to register: https://mechanicmarketing.co/airwallex-webhook
// Subscribe to: payment_link.paid (and/or payment_intent.succeeded)

// Same ClickUp list + custom fields as functions/contact.js (MM Pipeline).
const CLICKUP_LEADS_LIST_ID = '901606822314';
const CF_EMAIL = 'e22c5884-b7a3-4ff6-92d4-abe0d9265eb2';
const CF_CONTACT = '9fb06e97-2706-4890-8dd5-f2ddeae49353';
const CF_COMPANY = '0c3c1daa-bc0f-41d8-8322-3dda27c9f7b8';
const CF_CHANNEL = 'd82f6771-a73a-4e30-8e82-fb4180fc85d9';
const CF_CHANNEL_ONLINE = '4b6d2547-2409-4563-b764-f5e34806dd93';

const TEAM_RECIPIENTS = ['hello@mechanicmarketing.co'];

const PAID_EVENTS = ['payment_link.paid', 'payment_intent.succeeded'];

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.AIRWALLEX_WEBHOOK_SECRET) {
    console.error('Webhook: AIRWALLEX_WEBHOOK_SECRET not set');
    return new Response('Not configured', { status: 503 });
  }

  // Verify signature over raw body BEFORE parsing anything.
  const rawBody = await request.text();
  const timestamp = request.headers.get('x-timestamp') || '';
  const signature = request.headers.get('x-signature') || '';
  const valid = await verifySignature(env.AIRWALLEX_WEBHOOK_SECRET, timestamp + rawBody, signature);
  if (!valid) {
    console.error('Webhook: invalid signature');
    return new Response('Invalid signature', { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Bad payload', { status: 400 });
  }

  // Acknowledge everything we don't act on so Airwallex doesn't retry.
  if (!PAID_EVENTS.includes(event.name)) {
    return new Response('OK', { status: 200 });
  }

  const obj = (event.data && event.data.object) || {};
  const meta = obj.metadata || {};

  // Only handle our own quiz checkouts; other Airwallex activity passes through.
  if (meta.source !== 'mechanics_quiz_selfserve') {
    return new Response('OK', { status: 200 });
  }

  const lead = {
    name: meta.lead_name || 'Unknown',
    email: meta.lead_email || '',
    mobile: meta.lead_mobile || '',
    workshop: meta.lead_workshop || '',
    plan: meta.plan || '',
    amount: obj.amount,
    currency: obj.currency || 'AUD',
    eventId: event.id || '',
  };
  const amountStr = typeof lead.amount === 'number'
    ? `$${lead.amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })} ${lead.currency}`
    : '(amount unavailable)';

  // 1. Team notification
  const teamLines = [
    `PAID self-serve sign-up from the mechanics-only quiz (20% offer).`,
    ``,
    `Name: ${lead.name}`,
    lead.workshop ? `Workshop: ${lead.workshop}` : null,
    lead.email ? `Email: ${lead.email}` : null,
    lead.mobile ? `Mobile: ${lead.mobile}` : null,
    `Plan: ${lead.plan}`,
    `Paid: ${amountStr} (first month, 20% off)`,
    ``,
    `Clock starts now — ads live in 7 days was the promise. Kick off onboarding today.`,
    `Airwallex event: ${lead.eventId}`,
  ].filter(Boolean).join('\n');

  await sendEmail(env, {
    from: 'Mechanic Marketing Website <noreply@mechanicmarketing.co>',
    to: TEAM_RECIPIENTS,
    subject: `💰 PAID sign-up: ${lead.workshop || lead.name} — ${lead.plan} (quiz self-serve)`,
    text: teamLines,
  });

  // 2. ClickUp task — unmissable PAID marker in the title since the list
  //    statuses don't have a dedicated "paid" state.
  await createClickUpTask(env, lead, amountStr);

  // 3. Customer confirmation
  if (lead.email) {
    await sendEmail(env, {
      from: 'Mechanic Marketing <noreply@mechanicmarketing.co>',
      to: [lead.email],
      subject: `You're in — here's what happens next`,
      text: [
        `G'day ${lead.name.split(' ')[0]},`,
        ``,
        `Payment received — you've locked in your first month at 20% off and skipped the queue. Welcome aboard.`,
        ``,
        `What happens next:`,
        `1. Today–tomorrow: we'll call you to kick off — logins, targeting, and what makes your workshop different.`,
        `2. Days 1–7: we build your landing page, campaigns and tracking.`,
        `3. Day 7: your ads go live.`,
        ``,
        `Everything is month-to-month with no lock-in, and you own everything we build.`,
        ``,
        `Questions in the meantime? Just reply to this email or call us.`,
        ``,
        `— The Mechanic Marketing team`,
        `mechanicmarketing.co`,
      ].join('\n'),
      reply_to: 'hello@mechanicmarketing.co',
    });
  }

  return new Response('OK', { status: 200 });
}

async function verifySignature(secret, message, signature) {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  const expected = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');
  // Constant-time-ish comparison
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

async function sendEmail(env, payload) {
  if (!env.RESEND_API_KEY) {
    console.error('Webhook: RESEND_API_KEY not set');
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error('Webhook Resend error:', await res.text());
  } catch (err) {
    console.error('Webhook Resend error:', err);
  }
}

async function createClickUpTask(env, lead, amountStr) {
  if (!env.CLICKUP_API_TOKEN) {
    console.error('Webhook: CLICKUP_API_TOKEN not set');
    return;
  }

  const description = [
    `💰 PAID — self-serve sign-up via mechanics-only quiz (20% offer).`,
    `Plan: ${lead.plan}`,
    `Paid: ${amountStr} (first month, 20% off)`,
    lead.workshop ? `Workshop: ${lead.workshop}` : null,
    lead.email ? `Email: ${lead.email}` : null,
    lead.mobile ? `Mobile: ${lead.mobile}` : null,
    `Airwallex event: ${lead.eventId}`,
    `Paid at: ${new Date().toISOString()}`,
    ``,
    `Ads-live-in-7-days clock is running — start onboarding immediately.`,
  ].filter(Boolean).join('\n');

  const payload = {
    name: `💰 PAID — ${lead.name}${lead.workshop ? ` — ${lead.workshop}` : ''}`,
    description,
    status: 'lead',
    custom_fields: [
      lead.email ? { id: CF_EMAIL, value: lead.email } : null,
      lead.mobile ? { id: CF_CONTACT, value: lead.mobile } : null,
      lead.workshop ? { id: CF_COMPANY, value: lead.workshop } : null,
      { id: CF_CHANNEL, value: CF_CHANNEL_ONLINE },
    ].filter(Boolean),
  };

  try {
    let res = await postTask(env, payload);
    // Same fallback as contact.js — never lose a paid lead to a status rename.
    if (!res.ok) {
      console.error('Webhook ClickUp create (with status) failed:', res.status, await res.text());
      delete payload.status;
      res = await postTask(env, payload);
    }
    if (!res.ok) console.error('Webhook ClickUp create failed:', res.status, await res.text());
  } catch (err) {
    console.error('Webhook ClickUp error:', err);
  }
}

function postTask(env, payload) {
  return fetch(`https://api.clickup.com/api/v2/list/${CLICKUP_LEADS_LIST_ID}/task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': env.CLICKUP_API_TOKEN,
    },
    body: JSON.stringify(payload),
  });
}
