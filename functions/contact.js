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

  // Send via Resend API
  const mailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${context.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Mechanic Marketing Website <noreply@mechanicmarketing.co>',
      to: ['hello@mechanicmarketing.co'],
      reply_to: `${full_name} <${email}>`,
      subject: `New enquiry: ${workshop_name || full_name}`,
      text: emailBody,
    }),
  });

  if (!mailResponse.ok) {
    const error = await mailResponse.text();
    console.error('Resend error:', error);
    return Response.json({ success: false, error: 'Failed to send email. Please try again.' }, { status: 500 });
  }

  return Response.json({ success: true });
}
