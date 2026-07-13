// Cloudflare Pages Function - Mechanic Marketing sales-agent endpoint
// POST /api/sales-agent
// Expects: { lead: {name, email, website}, messages: [{role, content}], clickupTaskId? }
//
// Talks to the Claude API directly. The skill + knowledge pack below are the
// full system prompt, so no separate backend is needed. Lead capture reuses
// the same MM Pipeline (ClickUp) + Resend setup as functions/contact.js.
//
// Env vars (all optional except ANTHROPIC_API_KEY; each integration no-ops if
// its vars aren't set): ANTHROPIC_API_KEY, SALES_AGENT_MODEL, ALLOWED_ORIGINS,
// RESEND_API_KEY, CLICKUP_API_TOKEN, SLACK_WEBHOOK_URL, HIGHLEVEL_API_TOKEN
// (Private Integration token, scopes contacts.write + opportunities.write),
// and optionally HIGHLEVEL_LOCATION_ID / HIGHLEVEL_PIPELINE_ID /
// HIGHLEVEL_STAGE_ID to override the baked-in MM sub-account defaults.

import { SKILL } from './_lib/sales-agent/skill.js';
import { KNOWLEDGE } from './_lib/sales-agent/knowledge.js';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

// MM Pipeline list + custom field ids - identical to functions/contact.js so
// sales-agent leads land alongside every other website lead.
const CLICKUP_LEADS_LIST_ID = '901606822314';
const CF_EMAIL = 'e22c5884-b7a3-4ff6-92d4-abe0d9265eb2';          // Email (email)
const CF_CONTACT = '9fb06e97-2706-4890-8dd5-f2ddeae49353';        // Contact (text)
const CF_COMPANY = '0c3c1daa-bc0f-41d8-8322-3dda27c9f7b8';        // Company/website (text)
const CF_CHANNEL = 'd82f6771-a73a-4e30-8e82-fb4180fc85d9';        // Channel (dropdown)
const CF_CHANNEL_ONLINE = '4b6d2547-2409-4563-b764-f5e34806dd93'; // Channel -> "Online"

const LEAD_RECIPIENTS = ['hello@mechanicmarketing.co', 'guy@mechanicmarketing.co'];

// GoHighLevel (LeadConnector) - MM sub-account. A lead upserts a contact and
// drops an opportunity into the Marketing Pipeline's "New Lead" stage, so the
// sales agent feeds the GHL CRM alongside ClickUp. All of this no-ops unless
// HIGHLEVEL_API_TOKEN (a Private Integration token with contacts.write +
// opportunities.write) is set in Cloudflare env vars. Location and pipeline
// default to the live MM sub-account but can be overridden per-env.
const HL_API_BASE = 'https://services.leadconnectorhq.com';
const HL_VERSION = '2021-07-28';
const HL_DEFAULT_LOCATION_ID = '0VR8ysbpzoGC6kdzWYKi';        // Mechanic Marketing
const HL_DEFAULT_PIPELINE_ID = 'iSY3cnUPYTlpEv5HnG6i';        // Marketing Pipeline
const HL_DEFAULT_STAGE_ID = '3bb4f964-b4c1-4183-be9d-e573e6d4230b'; // "New Lead"
const HL_LEAD_SOURCE = 'Sales agent (website chat)';
const HL_LEAD_TAGS = ['sales-agent', 'website-chat'];

const RECOMMEND_TOOL = {
  name: 'recommend_plan',
  description: 'Present a confident plan recommendation card to the visitor. Call once you have enough to recommend a specific Mechanic Marketing plan, or to explain why none cleanly fits.',
  input_schema: {
    type: 'object',
    properties: {
      service: {
        type: 'string',
        enum: ['ignite', 'accelerate', 'custom', 'unsure'],
        description: 'The plan id from the knowledge block that best fits, or "unsure" if none cleanly fits.',
      },
      headline: {
        type: 'string',
        description: 'Short headline for the card, e.g. "Accelerate" or "Ignite".',
      },
      reasoning: {
        type: 'string',
        description: '1-2 sentences on why this fits their specific situation.',
      },
      price: {
        type: 'string',
        description: 'The price string verbatim from the knowledge block for this plan.',
      },
      included: {
        type: 'array',
        items: { type: 'string' },
        description: '4-6 inclusion bullets verbatim from the knowledge block for this plan.',
      },
      offer: {
        type: 'string',
        description: 'ONLY for the "accelerate" plan: the booking offer string from the knowledge block (lock in $2,000/m + GST if they book now). Omit entirely for ignite, custom and unsure.',
      },
    },
    required: ['service', 'headline', 'reasoning'],
  },
};

const SUGGEST_REPLIES_TOOL = {
  name: 'suggest_quick_replies',
  description: 'Offer 2-4 short suggested replies the visitor can click instead of typing, matching the question you just asked. Call this alongside most conversational turns. Skip it when a recommendation card already gives them a clear next action, or when the question genuinely needs free text (e.g. asking for their website).',
  input_schema: {
    type: 'object',
    properties: {
      replies: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        maxItems: 4,
        description: 'Short reply options (a few words each) the visitor could click, phrased as something they would say.',
      },
    },
    required: ['replies'],
  },
};

function buildSystemPrompt() {
  return `${SKILL}\n\n## Current plans, pricing & decision guide (source of truth - do not deviate from this)\n\n${JSON.stringify(KNOWLEDGE, null, 2)}`;
}

// Rate limiting - 20 requests per IP per 60 seconds
const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 20;

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }

  const entry = rateLimitMap.get(ip);

  if (now - entry.windowStart > windowMs) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= maxRequests) {
    return true;
  }

  entry.count++;
  return false;
}

function getAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const defaults = [
    'https://mechanicmarketing.co',
    'https://www.mechanicmarketing.co',
  ];

  if (allowed.includes(origin) || defaults.includes(origin)) return origin;

  // Cloudflare preview builds (Pages + Worker previews)
  if (/^https:\/\/[a-z0-9-]+\.mechanicmarketing-static\.pages\.dev$/.test(origin)) return origin;
  if (/^https:\/\/[a-z0-9-]+-mechanicmarketing\.[a-z0-9-]+\.workers\.dev$/.test(origin)) return origin;

  return null;
}

function corsHeaders(request, env) {
  const origin = getAllowedOrigin(request, env);
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return headers;
}

// Same Resend setup as functions/contact.js - reuses the RESEND_API_KEY secret.
async function sendResendEmail(env, { subject, text, replyTo }) {
  const payload = {
    from: 'Mechanic Marketing Website <noreply@mechanicmarketing.co>',
    to: LEAD_RECIPIENTS,
    subject,
    text,
  };
  if (replyTo) payload.reply_to = replyTo;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend ${res.status}: ${errText}`);
  }
}

// Creates the MM Pipeline task for a new lead and returns its id. Awaited (not
// fire-and-forget) so the id can be handed back to the client and resent on
// later turns, letting the running chat transcript attach to the right task.
async function createClickUpTask(env, lead) {
  const description = [
    `Source: Sales agent (website chat)`,
    `Email: ${lead.email}`,
    lead.name ? `Name: ${lead.name}` : null,
    lead.website ? `Website: ${lead.website}` : null,
    `First message: ${lead.message || '-'}`,
    `Lead received: ${new Date().toISOString()}`,
  ].filter(Boolean).join('\n');

  const customFields = [
    lead.email ? { id: CF_EMAIL, value: lead.email } : null,
    lead.website ? { id: CF_COMPANY, value: lead.website } : null,
    { id: CF_CHANNEL, value: CF_CHANNEL_ONLINE },
  ].filter(Boolean);

  const payload = {
    name: `Sales agent lead: ${lead.name || lead.email}`,
    description,
    status: 'lead',
    custom_fields: customFields,
  };

  let res = await postClickUpTask(env, payload);
  // If the list's status names change, don't lose the lead - retry without one.
  if (!res.ok) {
    delete payload.status;
    res = await postClickUpTask(env, payload);
  }
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ClickUp ${res.status}: ${errText}`);
  }

  const task = await res.json();
  return task.id;
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

// Appends one exchange (visitor message + reply) to the ClickUp task as a
// comment, building up the full chat transcript turn by turn.
async function addClickUpTranscriptComment(env, taskId, { userMessage, replyText, recommendation }) {
  const lines = [`Visitor: ${userMessage}`, ``, `Agent: ${replyText}`];
  if (recommendation) {
    lines.push('', `-> Recommended: ${recommendation.headline || recommendation.service}${recommendation.price ? ` (${recommendation.price})` : ''}`);
  }

  const res = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/comment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': env.CLICKUP_API_TOKEN,
    },
    body: JSON.stringify({ comment_text: lines.join('\n') }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ClickUp comment ${res.status}: ${errText}`);
  }
}

function hlFetch(env, pathname, body) {
  return fetch(`${HL_API_BASE}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${env.HIGHLEVEL_API_TOKEN}`,
      'Version': HL_VERSION,
    },
    body: JSON.stringify(body),
  });
}

// Upserts a GHL contact (dedupes on email/phone per the sub-account's unique
// identifiers) and creates a "New Lead" opportunity in the Marketing Pipeline.
// Opportunity creation is best-effort: if it fails, the contact still lands.
async function createHighLevelLead(env, lead) {
  const locationId = env.HIGHLEVEL_LOCATION_ID || HL_DEFAULT_LOCATION_ID;

  const first = (lead.name || '').trim().split(/\s+/)[0] || '';
  const contactBody = {
    locationId,
    name: lead.name || lead.email,
    firstName: first,
    email: lead.email,
    source: HL_LEAD_SOURCE,
    tags: HL_LEAD_TAGS,
  };
  if (lead.website) contactBody.website = lead.website;

  const res = await hlFetch(env, '/contacts/upsert', contactBody);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HighLevel upsert ${res.status}: ${errText}`);
  }
  const data = await res.json();
  const contactId = data.contact?.id || data.id;
  if (!contactId) return;

  // Best-effort opportunity in the Marketing Pipeline -> New Lead stage.
  try {
    const oppRes = await hlFetch(env, '/opportunities/', {
      locationId,
      pipelineId: env.HIGHLEVEL_PIPELINE_ID || HL_DEFAULT_PIPELINE_ID,
      pipelineStageId: env.HIGHLEVEL_STAGE_ID || HL_DEFAULT_STAGE_ID,
      name: `${lead.name || lead.email} - Sales agent`,
      status: 'open',
      contactId,
      source: HL_LEAD_SOURCE,
    });
    if (!oppRes.ok) {
      console.error('SALES_AGENT_LEAD_HL_OPP_FAIL', oppRes.status, await oppRes.text());
    }
  } catch (err) {
    console.error('SALES_AGENT_LEAD_HL_OPP_FAIL', err.message);
  }
}

async function captureLead(env, lead) {
  const promises = [];

  if (env.HIGHLEVEL_API_TOKEN) {
    promises.push(
      createHighLevelLead(env, lead)
        .catch((err) => console.error('SALES_AGENT_LEAD_HL_FAIL', err.message))
    );
  }

  if (env.SLACK_WEBHOOK_URL) {
    const slackText = [
      `*New sales-agent lead*`,
      `- Email: ${lead.email}`,
      lead.name ? `- Name: ${lead.name}` : null,
      lead.website ? `- Website: ${lead.website}` : null,
      `- First message: ${(lead.message || '').substring(0, 300)}`,
    ].filter(Boolean).join('\n');

    promises.push(
      fetch(env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: slackText }),
      }).catch((err) => console.error('SALES_AGENT_LEAD_SLACK_FAIL', err.message))
    );
  }

  if (env.RESEND_API_KEY) {
    const text = [
      `New sales-agent lead from mechanicmarketing.co`,
      ``,
      `Name: ${lead.name || '-'}`,
      `Email: ${lead.email}`,
      `Website: ${lead.website || '-'}`,
      `First message: ${lead.message || '-'}`,
      `Source: Sales agent (website chat)`,
    ].join('\n');

    promises.push(
      sendResendEmail(env, {
        subject: `New sales-agent lead: ${lead.name || lead.email}`,
        text,
        replyTo: lead.email ? `${lead.name || ''} <${lead.email}>`.trim() : undefined,
      }).catch((err) => console.error('SALES_AGENT_LEAD_EMAIL_FAIL', err.message))
    );
  }

  return Promise.allSettled(promises);
}

async function notifyRecommendation(env, lead, recommendation) {
  if (!recommendation) return;
  const promises = [];

  if (env.SLACK_WEBHOOK_URL) {
    const slackText = [
      `*Sales agent recommendation*`,
      lead?.email ? `- Lead: ${lead.email}` : null,
      `- Plan: ${recommendation.service}`,
      `- ${recommendation.headline || ''}`,
      recommendation.offer ? `- Offer surfaced: yes` : null,
    ].filter(Boolean).join('\n');

    promises.push(
      fetch(env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: slackText }),
      }).catch((err) => console.error('SALES_AGENT_RECOMMENDATION_SLACK_FAIL', err.message))
    );
  }

  if (env.RESEND_API_KEY && lead?.email) {
    const text = [
      `Sales agent made a recommendation`,
      ``,
      `Lead: ${lead.name || lead.email} (${lead.email})`,
      `Website: ${lead.website || '-'}`,
      `Recommended: ${recommendation.headline || recommendation.service}`,
      `Reasoning: ${recommendation.reasoning || '-'}`,
      recommendation.price ? `Price: ${recommendation.price}` : null,
      recommendation.offer ? `Offer surfaced: ${recommendation.offer}` : null,
    ].filter(Boolean).join('\n');

    promises.push(
      sendResendEmail(env, {
        subject: `Sales agent rec: ${lead.name || lead.email} -> ${recommendation.headline || recommendation.service}`,
        text,
        replyTo: lead.email ? `${lead.name || ''} <${lead.email}>`.trim() : undefined,
      }).catch((err) => console.error('SALES_AGENT_RECOMMENDATION_EMAIL_FAIL', err.message))
    );
  }

  return Promise.allSettled(promises);
}

export async function onRequestPost({ request, env, waitUntil }) {
  try {
    const clientIp = request.headers.get('CF-Connecting-IP') ||
                     request.headers.get('X-Forwarded-For') ||
                     'unknown';

    if (isRateLimited(clientIp)) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Give it a sec and try again.' }),
        { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) } }
      );
    }

    if (!env.ANTHROPIC_API_KEY) {
      console.error('SALES_AGENT_ERROR missing ANTHROPIC_API_KEY');
      return new Response(JSON.stringify({ error: 'Something broke on our end. Try again?' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
      });
    }

    const body = await request.json();
    const { lead, messages } = body;
    let clickupTaskId = body.clickupTaskId || null;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
      });
    }

    // Capture the lead on the first message (so we keep it even if they bounce
    // after one exchange).
    if (messages.length === 1 && lead) {
      console.log('SALES_AGENT_LEAD', JSON.stringify({
        ts: new Date().toISOString(),
        name: lead.name,
        email: lead.email,
        website: lead.website,
        firstMessage: messages[0]?.content,
      }));

      const capturePromise = captureLead(env, {
        email: lead.email,
        name: lead.name || undefined,
        website: lead.website || undefined,
        message: messages[0]?.content,
      });
      if (typeof waitUntil === 'function') waitUntil(capturePromise);
      else capturePromise.catch(() => {});

      // Awaited so the created task id can be returned to the client.
      if (env.CLICKUP_API_TOKEN) {
        try {
          clickupTaskId = await createClickUpTask(env, {
            email: lead.email,
            name: lead.name || undefined,
            website: lead.website || undefined,
            message: messages[0]?.content,
          });
        } catch (err) {
          console.error('SALES_AGENT_LEAD_CLICKUP_FAIL', err.message);
        }
      }
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.SALES_AGENT_MODEL || DEFAULT_MODEL,
        max_tokens: MAX_TOKENS,
        system: buildSystemPrompt(),
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        tools: [RECOMMEND_TOOL, SUGGEST_REPLIES_TOOL],
      }),
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error(`SALES_AGENT_ANTHROPIC_ERROR ${anthropicResponse.status} ${errText}`);
      throw new Error(`upstream_${anthropicResponse.status}`);
    }

    const result = await anthropicResponse.json();
    const content = Array.isArray(result.content) ? result.content : [];

    const replyText = content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n\n')
      .trim() || "Hmm, I got a bit tangled up there. Try that again?";

    const toolUse = content.find(block => block.type === 'tool_use' && block.name === 'recommend_plan');
    const recommendation = toolUse ? toolUse.input : null;

    const suggestUse = content.find(block => block.type === 'tool_use' && block.name === 'suggest_quick_replies');
    const suggestions = suggestUse && Array.isArray(suggestUse.input?.replies) ? suggestUse.input.replies : null;

    if (recommendation) {
      const notifyPromise = notifyRecommendation(env, lead, recommendation);
      if (typeof waitUntil === 'function') waitUntil(notifyPromise);
      else notifyPromise.catch(() => {});
    }

    // Turns after the first: append this exchange to the ClickUp task.
    if (messages.length > 1 && clickupTaskId && env.CLICKUP_API_TOKEN) {
      const commentPromise = addClickUpTranscriptComment(env, clickupTaskId, {
        userMessage: messages[messages.length - 1]?.content || '',
        replyText,
        recommendation,
      }).catch((err) => console.error('SALES_AGENT_CLICKUP_COMMENT_FAIL', err.message));
      if (typeof waitUntil === 'function') waitUntil(commentPromise);
      else commentPromise.catch(() => {});
    }

    console.log('SALES_AGENT_TURN', JSON.stringify({
      ts: new Date().toISOString(),
      email: lead?.email,
      userMsg: messages[messages.length - 1]?.content?.substring(0, 200),
      hasRecommendation: Boolean(recommendation),
    }));

    return new Response(JSON.stringify({ reply: replyText, recommendation, suggestions, clickupTaskId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
    });

  } catch (err) {
    console.error('SALES_AGENT_ERROR', err.message, err.stack);
    return new Response(JSON.stringify({ error: 'Something broke on our end. Try again?' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
    });
  }
}

export function onRequestOptions({ request, env }) {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}
