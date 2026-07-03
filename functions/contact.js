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
