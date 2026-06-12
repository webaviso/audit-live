export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  const key = process.env.PAGESPEED_KEY;
  if (!key) return res.status(500).json({ error: 'PAGESPEED_KEY not set in Vercel' });

  try {
    const target = url.startsWith('http') ? url : `https://${url}`;
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(target)}&key=${key}&category=PERFORMANCE&category=SEO&strategy=mobile`;
    
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'PageSpeed failed' });
    }

    const lighthouse = data.lighthouseResult;
    const perf = Math.round((lighthouse.categories.performance.score || 0) * 100);
    const seo = Math.round((lighthouse.categories.seo.score || 0) * 100);

    const audits = lighthouse.audits;
    const lcp = audits['largest-contentful-paint']?.displayValue || '—';
    const cls = audits['cumulative-layout-shift']?.displayValue || '—';

    res.status(200).json({
      url: target,
      performance: perf,
      seo: seo,
      lcp,
      cls,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
