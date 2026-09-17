// ClickUp — MM Pipeline list ("Mechanic Marketing Clients" space → Pipeline Management).
// Website + LP leads land here with status "lead", matching the Meta-lead import format.
// Requires CLICKUP_API_TOKEN in Cloudflare Pages → Settings → Environment variables.
const CLICKUP_LEADS_LIST_ID = '901606822314';

// Custom field ids on the MM Pipeline list (fetched 2 Jul 2026)
const CF_EMAIL = 'e22c5884-b7a3-4ff6-92d4-abe0d9265eb2';          // Email (email)
const CF_CONTACT = '9fb06e97-2706-4890-8dd5-f2ddeae49353';        // Contact (text)
const CF_COMPANY = '0c3c1daa-bc0f-41d8-8322-3dda27c9f7b8';        // Company/website (text)
const CF_CHANNEL = 'd82f6771-a73a-4e30-8e82-fb4180fc85d9';        // Channel (dropdown)
const CF_CHANNEL_ONLINE = '4b6d2547-2409-4563-b764-f5e34806dd93'; // Channel → "Online"

// Everyone who should be notified of a new lead by email.
const LEAD_RECIPIENTS = ['hello@mechanicmarketing.co', 'guy@mechanicmarketing.co'];

// Resend segment/topic ids (fetched from the Resend dashboard 16 Sep 2026).
// Replaces the retired Kit (ConvertKit) integration — see brief 4.
const RESEND_MM_SEGMENT_ID = '731fa8c5-c579-42d8-b093-0c4cdbb8ad17';          // Segment: Mechanic Marketing
const RESEND_MM_NEWSLETTER_TOPIC_ID = '4c25f610-ae12-4559-ba3c-d74889e12310'; // Topic: Mechanic Marketing newsletter

// Only these three forms feed the Resend signup — everything else posting to
// /contact (the other landing-page forms) is out of scope for now.
const RESEND_SUBSCRIBE_SOURCE = {
  'Contact page':                   'contact_form',
  'Free Audit LP - Quiz':           'offer_form',
  'Free Audit LP - Contact form':   'offer_form',
};

// Maps each form's `source` value to a plain-English description of what
// the visitor actually asked for, so the email and ClickUp task are clear.
const SOURCE_REQUESTS = {
  'Free Audit LP':      'Free marketing audit (requested a 30-min audit call)',
  'Mechanics Only LP':  'Free marketing audit (requested a 30-min audit call)',
  'Website Audit LP':   'Free website audit of their workshop site',
  'Book a Call LP':     'Requested a free strategy call',
  'Contact page':       'General enquiry via the contact form',
};

export async function onRequestPost(context) {
  const { request } = context;

  // Parse form data
  let data;
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await request.json();
  } else {
    const formData = await request.formData();
    data = Object.fromEntries(formData.entries());
  }

  // --- Spam defenses --------------------------------------------------
  // These fail "successfully" (200, { success: true }) rather than with
  // an error. Real visitors never notice either check exists; bots that
  // get a fake success have no signal to tell them to adapt and retry.

  // Honeypot — a field every real form carries but hides from view.
  // Bots that auto-fill every input on the page trip this; humans never
  // see or touch it.
  if (data.hp_website) {
    return Response.json({ success: true });
  }

  // Time trap — `ts` is set client-side to the page-load timestamp. A
  // human takes at least a second or two to fill the form; a script
  // posting straight to this endpoint either omits `ts` entirely or
  // submits within milliseconds of "loading" it.
  const submittedAt = Number(data.ts);
  if (!submittedAt || Number.isNaN(submittedAt) || Date.now() - submittedAt < 1500) {
    return Response.json({ success: true });
  }

  // Normalise field names — handle both the main contact page and all 4 LP forms
  const fullName     = data.full_name || data.first_name || data.firstName || '';
  const email        = data.email || '';
  const phone        = data.phone || data.mobile || '';
  const workshopName = data.workshop_name || data.workshopName || '';
  const websiteUrl   = data.website_url || data.websiteUrl || data.website || '';
  const source       = data.source || 'Contact page';

  // Validation — need at least a name and either email or phone
  if (!fullName) {
    return Response.json({ success: false, error: 'Name is required.' }, { status: 400 });
  }
  if (!email && !phone) {
    return Response.json({ success: false, error: 'Email or phone is required.' }, { status: 400 });
  }

  // Link-stuffed message — classic SEO/backlink spam pads the free-text
  // fields with several URLs. Legitimate enquiries essentially never do.
  const freeText = `${data.message || ''} ${data.frustration || ''}`;
  const linkCount = (freeText.match(/https?:\/\//gi) || []).length;
  if (linkCount >= 3) {
    return Response.json({ success: true });
  }

  const requested = SOURCE_REQUESTS[source] || `Enquiry via ${source}`;

  // Build email body including all available fields
  const lines = [
    `New enquiry from mechanicmarketing.co`,
    `Source: ${source}`,
    `They requested: ${requested}`,
    ``,
    `Name: ${fullName}`,
    email        ? `Email: ${email}`                                                                  : null,
    phone        ? `Phone/Mobile: ${phone}`                                                           : null,
    workshopName ? `Workshop: ${workshopName}`                                                        : null,
    websiteUrl   ? `Website: ${websiteUrl}`                                                           : null,
    (data.primaryService || data.primary_service) ? `Primary Service: ${data.primaryService || data.primary_service}` : null,
    data.state        ? `State: ${data.state}`                                                        : null,
    data.monthly_spend ? `Monthly Ad Spend: ${data.monthly_spend}`                                   : null,
    data.monthly_revenue ? `Monthly Revenue: ${data.monthly_revenue}`                                : null,
    data.frustration  ? `\nBiggest Frustration:\n${data.frustration}`                                : null,
    data.message      ? `\nMessage:\n${data.message}`                                                 : null,
  ].filter(Boolean).join('\n');

  const mailPayload = {
    from: 'Mechanic Marketing Website <noreply@mechanicmarketing.co>',
    to: LEAD_RECIPIENTS,
    subject: `New lead: ${workshopName || fullName} — ${requested}`,
    text: lines,
  };

  if (email) {
    mailPayload.reply_to = `${fullName} <${email}>`;
  }

  // Send via Resend
  let emailOk = false;
  try {
    const mailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify(mailPayload),
    });
    emailOk = mailResponse.ok;
    if (!mailResponse.ok) {
      console.error('Resend error:', await mailResponse.text());
    }
  } catch (err) {
    console.error('Resend error:', err);
  }

  // Create the lead task in ClickUp (MM Pipeline)
  let clickupOk = false;
  try {
    clickupOk = await createClickUpLead(context.env, {
      fullName, email, phone, workshopName, websiteUrl, source, requested,
      primaryService: data.primaryService || data.primary_service || '',
      state: data.state || '',
      monthlySpend: data.monthly_spend || '',
      monthlyRevenue: data.monthly_revenue || '',
      frustration: data.frustration || '',
      message: data.message || '',
    });
  } catch (err) {
    console.error('ClickUp error:', err);
  }

  // Resend contact/event signup — replaces the retired Kit integration.
  // Never blocks the form response: log and carry on if it fails.
  const mmSource = RESEND_SUBSCRIBE_SOURCE[source];
  if (mmSource && email) {
    const newsletterOptIn = data.newsletter_optin === 'on' || data.newsletter_optin === true;
    try {
      await subscribeToResend(context.env, { email, fullName, mmSource, newsletterOptIn });
    } catch (err) {
      console.error('Resend subscribe error:', err);
    }
  }

  // The lead is captured as long as either channel worked. Only tell the
  // visitor to retry when both failed — retrying after a partial success
  // would double up the lead.
  if (!emailOk && !clickupOk) {
    return Response.json({ success: false, error: 'Failed to send. Please try again.' }, { status: 500 });
  }

  return Response.json({ success: true });
}

// Creates a task in the MM Pipeline list, matching the format of the
// existing imported leads: name as title, details in the description,
// status "lead", plus the Email/Contact/Company/Channel custom fields.
async function createClickUpLead(env, lead) {
  if (!env.CLICKUP_API_TOKEN) {
    console.error('ClickUp: CLICKUP_API_TOKEN not set');
    return false;
  }

  const description = [
    `They requested: ${lead.requested}`,
    `Source: ${lead.source}`,
    lead.workshopName ? `Workshop: ${lead.workshopName}` : null,
    lead.email ? `Email: ${lead.email}` : null,
    lead.phone ? `Phone: ${lead.phone}` : null,
    lead.websiteUrl ? `Website: ${lead.websiteUrl}` : null,
    lead.primaryService ? `Primary service: ${lead.primaryService}` : null,
    lead.state ? `State: ${lead.state}` : null,
    lead.monthlySpend ? `Monthly ad spend: ${lead.monthlySpend}` : null,
    lead.monthlyRevenue ? `Monthly revenue: ${lead.monthlyRevenue}` : null,
    lead.frustration ? `Biggest frustration: ${lead.frustration}` : null,
    lead.message ? `Message: ${lead.message}` : null,
    `Lead received: ${new Date().toISOString()}`,
  ].filter(Boolean).join('\n');

  const customFields = [
    lead.email ? { id: CF_EMAIL, value: lead.email } : null,
    lead.phone ? { id: CF_CONTACT, value: lead.phone } : null,
    (lead.workshopName || lead.websiteUrl)
      ? { id: CF_COMPANY, value: [lead.workshopName, lead.websiteUrl].filter(Boolean).join(' — ') }
      : null,
    { id: CF_CHANNEL, value: CF_CHANNEL_ONLINE },
  ].filter(Boolean);

  const payload = {
    name: lead.workshopName && lead.workshopName !== lead.fullName
      ? `${lead.fullName} — ${lead.workshopName}`
      : lead.fullName,
    description,
    status: 'lead',
    custom_fields: customFields,
  };

  let res = await postClickUpTask(env, payload);

  // If the list's status names ever change, don't lose the lead — retry
  // without an explicit status so it lands in the list default.
  if (!res.ok) {
    console.error('ClickUp create (with status) failed:', res.status, await res.text());
    delete payload.status;
    res = await postClickUpTask(env, payload);
  }

  if (!res.ok) {
    console.error('ClickUp create failed:', res.status, await res.text());
    return false;
  }

  const task = await res.json();
  console.log('ClickUp lead task created:', task.id, lead.source);
  return true;
}

function postClickUpTask(env, payload) {
  return fetch(`https://api.clickup.com/api/v2/list/${CLICKUP_LEADS_LIST_ID}/task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': env.CLICKUP_API_TOKEN,
    },
    body: JSON.stringify(payload),
  });
}

// Creates (or updates) the Resend contact, assigns it to the Mechanic
// Marketing segment, sets its newsletter topic subscription, and fires the
// mm.subscribed event. Each step is independent so a partial failure still
// leaves the contact/segment/topic in the right state.
async function subscribeToResend(env, { email, fullName, mmSource, newsletterOptIn }) {
  if (!env.RESEND_API_KEY) {
    console.error('Resend subscribe: RESEND_API_KEY not set');
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${env.RESEND_API_KEY}`,
  };
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  const lastName = rest.join(' ') || undefined;
  const properties = { brand: 'mm', source: mmSource };

  let isNewContact = true;
  let res = await fetch('https://api.resend.com/contacts', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, first_name: firstName || undefined, last_name: lastName, properties }),
  });
  if (!res.ok) {
    // Contact likely already exists — fall back to updating it.
    isNewContact = false;
    res = await fetch(`https://api.resend.com/contacts/${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ first_name: firstName || undefined, last_name: lastName, properties }),
    });
    if (!res.ok) {
      console.error('Resend contact create/update failed:', res.status, await res.text());
    }
  }

  const segmentRes = await fetch(
    `https://api.resend.com/contacts/${encodeURIComponent(email)}/segments/${RESEND_MM_SEGMENT_ID}`,
    { method: 'POST', headers }
  );
  if (!segmentRes.ok) {
    console.error('Resend segment add failed:', segmentRes.status, await segmentRes.text());
  }

  // Ticking the box always opts them in. Leaving it unticked only opts them
  // out for a brand-new contact — the topic's default is opt_in, so a new
  // contact left untouched would end up subscribed. An existing contact who
  // leaves it unticked just isn't re-subscribed; we don't touch (and
  // possibly unsubscribe) whatever preference they already had.
  if (newsletterOptIn || isNewContact) {
    const topicsRes = await fetch(`https://api.resend.com/contacts/${encodeURIComponent(email)}/topics`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify([{
        id: RESEND_MM_NEWSLETTER_TOPIC_ID,
        subscription: newsletterOptIn ? 'opt_in' : 'opt_out',
      }]),
    });
    if (!topicsRes.ok) {
      console.error('Resend topic update failed:', topicsRes.status, await topicsRes.text());
    }
  }

  const eventRes = await fetch('https://api.resend.com/events/send', {
    method: 'POST',
    headers,
    body: JSON.stringify({ event: 'mm.subscribed', email, payload: { source: mmSource } }),
  });
  if (!eventRes.ok) {
    console.error('Resend event send failed:', eventRes.status, await eventRes.text());
  }
}
