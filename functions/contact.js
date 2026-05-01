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

  const { full_name, email, phone, workshop_name, website_url, monthly_revenue, message } = data;

  // Basic validation
  if (!full_name || !email) {
    return Response.json({ success: false, error: 'Name and email are required.' }, { status: 400 });
  }

  // Build email content
  const emailBody = `
New enquiry from mechanicmarketing.co

Name: ${full_name}
Email: ${email}
Phone: ${phone || 'Not provided'}
Workshop: ${workshop_name || 'Not provided'}
Website: ${website_url || 'Not provided'}
Monthly Revenue: ${monthly_revenue || 'Not provided'}

Message:
${message || 'No message provided'}
  `.trim();

  // Send via Mailchannels (free, no API key required on Cloudflare Workers)
  const mailResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: 'hello@mechanicmarketing.co', name: 'Mechanic Marketing' }],
      }],
      from: {
        email: 'noreply@mechanicmarketing.co',
        name: 'Mechanic Marketing Website',
      },
      reply_to: {
        email: email,
        name: full_name,
      },
      subject: `New enquiry: ${workshop_name || full_name}`,
      content: [{
        type: 'text/plain',
        value: emailBody,
      }],
    }),
  });

  if (!mailResponse.ok) {
    const error = await mailResponse.text();
    console.error('Mailchannels error:', error);
    return Response.json({ success: false, error: 'Failed to send email. Please try again.' }, { status: 500 });
  }

  return Response.json({ success: true });
}

// Return 405 for non-POST requests
export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return new Response('Method not allowed', { status: 405 });
}
