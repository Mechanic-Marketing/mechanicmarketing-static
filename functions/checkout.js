// Self-serve quiz checkout — creates an Airwallex Payment Link for the
// recommended plan with the 20% quiz discount applied SERVER-SIDE (the
// prices shown in the quiz are display-only and never trusted).
//
// Requires in Cloudflare Pages → Settings → Environment variables:
//   AIRWALLEX_CLIENT_ID   — Airwallex API client id
//   AIRWALLEX_API_KEY     — Airwallex API key
//   AIRWALLEX_ENV         — optional; set to "demo" to hit the demo API
//
// Until those are set this endpoint returns 503 and the quiz falls back
// to the book-a-call path, so it is safe to ship ahead of the keys.

const PLANS = {
  ignite:     { label: 'Ignite',     monthly: 1500 },
  accelerate: { label: 'Accelerate', monthly: 2500 },
};

// Self-serve quiz offer: 20% off the monthly fee. The first month is taken
// through this payment link; ongoing billing is set up during onboarding.
const QUIZ_DISCOUNT = 0.20;

function apiHost(env) {
  return env.AIRWALLEX_ENV === 'demo'
    ? 'https://api-demo.airwallex.com'
    : 'https://api.airwallex.com';
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.AIRWALLEX_CLIENT_ID || !env.AIRWALLEX_API_KEY) {
    return Response.json({ success: false, error: 'Checkout is not available yet.' }, { status: 503 });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return Response.json({ success: false, error: 'Invalid request.' }, { status: 400 });
  }

  const plan = PLANS[data.plan];
  const name = (data.name || '').trim();
  const email = (data.email || '').trim();
  if (!plan || !name || !/^\S+@\S+\.\S+$/.test(email)) {
    return Response.json({ success: false, error: 'Invalid request.' }, { status: 400 });
  }

  const amount = Math.round(plan.monthly * (1 - QUIZ_DISCOUNT) * 100) / 100;

  try {
    // Authenticate
    const loginRes = await fetch(`${apiHost(env)}/api/v1/authentication/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': env.AIRWALLEX_CLIENT_ID,
        'x-api-key': env.AIRWALLEX_API_KEY,
      },
    });
    if (!loginRes.ok) {
      console.error('Airwallex login failed:', loginRes.status, await loginRes.text());
      return Response.json({ success: false, error: 'Checkout is not available right now.' }, { status: 502 });
    }
    const { token } = await loginRes.json();

    // Create a single-use payment link for the discounted first month.
    // Metadata carries the lead details through to the webhook.
    const linkRes = await fetch(`${apiHost(env)}/api/v1/pa/payment_links/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount,
        currency: 'AUD',
        reusable: false,
        title: `Mechanic Marketing — ${plan.label} (first month, 20% quiz offer)`,
        description: `${plan.label} plan, first month at 20% off (normally $${plan.monthly.toLocaleString()}/m). Month-to-month, no lock-in, cancel any time. Ad spend additional.`,
        metadata: {
          source: 'mechanics_quiz_selfserve',
          plan: data.plan,
          lead_name: name,
          lead_email: email,
          lead_mobile: (data.mobile || '').trim(),
          lead_workshop: (data.workshop || '').trim(),
        },
      }),
    });
    if (!linkRes.ok) {
      console.error('Airwallex payment link failed:', linkRes.status, await linkRes.text());
      return Response.json({ success: false, error: 'Checkout is not available right now.' }, { status: 502 });
    }
    const link = await linkRes.json();
    if (!link.url) {
      console.error('Airwallex payment link response missing url:', JSON.stringify(link));
      return Response.json({ success: false, error: 'Checkout is not available right now.' }, { status: 502 });
    }

    return Response.json({ success: true, url: link.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return Response.json({ success: false, error: 'Checkout is not available right now.' }, { status: 502 });
  }
}
