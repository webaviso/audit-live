function demoSeo(domain) {
  return {
    demo: true,
    provider: 'demo',
    domain,
    keywords: Math.floor(Math.random() * 80) + 20,
    backlinks: Math.floor(Math.random() * 500) + 50,
    domainAuthority: Math.floor(Math.random() * 30) + 10,
    traffic: Math.floor(Math.random() * 1200) + 200
  };
}

function normaliseDomain(url) {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').replace(/\/$/, '');
}

function authorityEstimate(indexedPages, brandMatches) {
  const pages = Number(indexedPages) || 0;
  const matches = Number(brandMatches) || 0;
  const pageScore = pages > 0 ? Math.min(45, Math.log10(pages + 1) * 15) : 0;
  const matchScore = Math.min(25, matches * 5);
  return Math.round(Math.min(70, 10 + pageScore + matchScore));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  const domain = normaliseDomain(url);
  const serpApiKey = process.env.SERPAPI_KEY || process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY;

  // SerpAPI is the preferred live provider for this project.
  if (serpApiKey) {
    try {
      const siteQuery = `site:${domain}`;
      const siteApiUrl = `https://serpapi.com/search.json?engine=google&google_domain=google.co.uk&gl=uk&hl=en&num=10&q=${encodeURIComponent(siteQuery)}&api_key=${encodeURIComponent(serpApiKey)}`;
      const siteResponse = await fetch(siteApiUrl);
      const siteData = await siteResponse.json().catch(() => ({}));

      if (!siteResponse.ok || siteData.error) {
        return res.status(200).json({
          ...demoSeo(domain),
          serpApiError: siteData.error || 'SerpAPI request failed'
        });
      }

      const brandApiUrl = `https://serpapi.com/search.json?engine=google&google_domain=google.co.uk&gl=uk&hl=en&num=10&q=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(serpApiKey)}`;
      const brandResponse = await fetch(brandApiUrl);
      const brandData = await brandResponse.json().catch(() => ({}));

      const indexedPages = Number(siteData.search_information?.total_results) || 0;
      const organicResults = Array.isArray(brandData.organic_results) ? brandData.organic_results : [];
      const brandMatches = organicResults.filter(result => String(result.link || '').includes(domain)).length;

      // SerpAPI is a live Google results API, not a backlink/traffic database.
      // These values are live visibility estimates so the front-end can still score the audit.
      const keywords = Math.min(500, Math.max(0, Math.round(indexedPages / 10)));
      const backlinks = 0;
      const domainAuthority = authorityEstimate(indexedPages, brandMatches);
      const traffic = Math.min(5000, Math.max(0, Math.round(indexedPages / 3)));

      return res.status(200).json({
        provider: 'serpapi',
        domain,
        indexedPages,
        brandMatches,
        keywords,
        backlinks,
        domainAuthority,
        traffic,
        note: 'SerpAPI provides live Google visibility signals. Backlinks and traffic are estimates, not backlink-tool metrics.',
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      return res.status(200).json({
        ...demoSeo(domain),
        serpApiError: err.message
      });
    }
  }

  // Old DataForSEO fallback, kept only in case those variables are ever added again.
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    return res.status(200).json(demoSeo(domain));
  }

  try {
    const auth = Buffer.from(`${login}:${password}`).toString('base64');

    const response = await fetch('https://api.dataforseo.com/v3/domain_analytics/technologies/domain_overview/live', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{ target: domain, location_code: 2826, language_code: 'en' }])
    });

    const data = await response.json();
    const result = data.tasks?.[0]?.result?.[0] || {};

    res.status(200).json({
      provider: 'dataforseo',
      domain,
      keywords: result.organic?.count || 0,
      backlinks: result.backlinks || 0,
      domainAuthority: Math.round((result.domain_rank || 0) / 10),
      traffic: result.organic?.etv || 0,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(200).json({
      ...demoSeo(domain),
      dataForSeoError: err.message
    });
  }
}
