export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  // Demo mode if no keys
  if (!login || !password) {
    return res.status(200).json({
      demo: true,
      domain: url,
      keywords: Math.floor(Math.random() * 80) + 20,
      backlinks: Math.floor(Math.random() * 500) + 50,
      domainAuthority: Math.floor(Math.random() * 30) + 10,
      traffic: Math.floor(Math.random() * 1200) + 200
    });
  }

  try {
    const target = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const auth = Buffer.from(`${login}:${password}`).toString('base64');

    const response = await fetch('https://api.dataforseo.com/v3/domain_analytics/technologies/domain_overview/live', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{ target, location_code: 2826, language_code: 'en' }])
    });

    const data = await response.json();
    const result = data.tasks?.[0]?.result?.[0] || {};

    res.status(200).json({
      domain: target,
      keywords: result.organic?.count || 0,
      backlinks: result.backlinks || 0,
      domainAuthority: Math.round((result.domain_rank || 0) / 10),
      traffic: result.organic?.etv || 0,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
