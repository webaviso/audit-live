function demoAiso(domain) {
  return {
    demo: true,
    domain,
    chatgpt: Math.random() > 0.5 ? 'visible' : 'missing',
    perplexity: Math.random() > 0.4 ? 'visible' : 'partial',
    googleAI: Math.random() > 0.6 ? 'visible' : 'missing',
    schema: Math.random() > 0.5,
    consistency: 'partial',
    summary: 'Demo AI visibility estimate.'
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, business } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url=' });

  const domain = url.replace(/^https?:\/\//, '').split('/')[0];
  const key = process.env.OPENAI_KEY;

  if (!key) {
    return res.status(200).json(demoAiso(domain));
  }

  try {
    const name = business || domain;

    const prompt = `You are an AI search auditor. For the UK business "${name}" (${domain}), answer in JSON only:
{
  "chatgpt": "visible|partial|missing",
  "perplexity": "visible|partial|missing", 
  "googleAI": "visible|partial|missing",
  "schema": true|false,
  "consistency": "consistent|partial|inconsistent",
  "summary": "one sentence"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(200).json({
        ...demoAiso(domain),
        openaiError: data.error?.message || 'OpenAI request failed'
      });
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(200).json({
        ...demoAiso(domain),
        openaiError: 'OpenAI returned no content'
      });
    }

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      return res.status(200).json({
        ...demoAiso(domain),
        openaiError: 'OpenAI returned invalid JSON'
      });
    }

    res.status(200).json({
      ...result,
      domain,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(200).json({
      ...demoAiso(domain),
      openaiError: err.message
    });
  }
}
