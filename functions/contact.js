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

  // Build email body including all available fields
  const lines = [
    `New enquiry from mechanicmarketing.co`,
    `Source: ${source}`,
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
    to: ['hello@mechanicmarketing.co'],
    subject: `New enquiry: ${workshopName || fullName} (${source})`,
    text: lines,
  };

  if (email) {
    mailPayload.reply_to = `${fullName} <${email}>`;
  }

  // Send via Resend
  const mailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify(mailPayload),
  });

  if (!mailResponse.ok) {
    const error = await mailResponse.text();
    console.error('Resend error:', error);
    return Response.json({ success: false, error: 'Failed to send email. Please try again.' }, { status: 500 });
  }

  return Response.json({ success: true });
}
