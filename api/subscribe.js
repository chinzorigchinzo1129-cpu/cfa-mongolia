// Vercel Serverless Function: /api/subscribe
// Receives email from landing page → adds to Brevo list
//
// Required environment variables (set in Vercel Dashboard → Settings → Environment Variables):
//   BREVO_API_KEY     — From Brevo: Settings → SMTP & API → API Keys
//   BREVO_LIST_ID     — From Brevo: Contacts → Lists → click your list → ID in URL

export default async function handler(req, res) {
  // CORS headers (in case form is on different subdomain later)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, source } = req.body || {};

  // Validate email
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const API_KEY = process.env.BREVO_API_KEY;
  const LIST_ID = parseInt(process.env.BREVO_LIST_ID, 10);

  if (!API_KEY || !LIST_ID) {
    console.error('Missing BREVO_API_KEY or BREVO_LIST_ID env vars');
    return res.status(500).json({ error: 'Server config error' });
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': API_KEY,
        'content-type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        listIds: [LIST_ID],
        attributes: {
          SOURCE: source || 'lead_magnet_47_formula',
          SIGNUP_DATE: new Date().toISOString()
        },
        updateEnabled: true  // if email already exists, just update (no error)
      })
    });

    const data = await response.json();

    // Brevo returns 201 for new contact, 204 for updated existing
    if (response.ok || response.status === 204) {
      return res.status(200).json({ success: true });
    }

    // Brevo can return 400 with code "duplicate_parameter" — also success for our purpose
    if (data.code === 'duplicate_parameter') {
      return res.status(200).json({ success: true, note: 'already_subscribed' });
    }

    console.error('Brevo API error:', data);
    return res.status(500).json({ error: 'Subscription failed', details: data });

  } catch (err) {
    console.error('Fetch error:', err);
    return res.status(500).json({ error: err.message });
  }
}
