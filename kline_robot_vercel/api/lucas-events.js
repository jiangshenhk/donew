export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST' })
  }

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: '未配置 DEEPSEEK_API_KEY' })
  }

  let lang = 'zh'
  let startDate = ''
  let endDate = ''
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})
    lang = body.lang === 'en' ? 'en' : 'zh'
    startDate = body.startDate || ''
    endDate = body.endDate || ''
  } catch {}

  if (!startDate) {
    const d = new Date()
    startDate = d.toISOString().split('T')[0]
  }
  if (!endDate) {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    endDate = d.toISOString().split('T')[0]
  }

  try {
    const result = await callDeepSeek(DEEPSEEK_API_KEY, lang, startDate, endDate)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600')
    res.status(200).json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

async function callDeepSeek(apiKey, lang = 'zh', startDate, endDate) {
  const isEn = lang === 'en'
  const langLabel = isEn ? 'English' : '中文'
  const descriptionLang = isEn ? 'English' : '中文'

  const systemPrompt = `You are a Melbourne local event guide. You know all upcoming entertainment, culture, sports, food, music, art, and family events in Melbourne and Victoria.

Generate real upcoming events in Melbourne from ${startDate} to ${endDate}.

## Output format (JSON only)
{
  "news": "Overview of upcoming Melbourne events, 3-5 sentences. Write in ${langLabel}.",
  "events": [
    {
      "name": "Event name (in ${langLabel})",
      "date": "2026-XX-XX",
      "venue": "Venue name",
      "category": "music|sports|culture|food|festival|art|family|market|other",
      "description": "Brief description, 1-2 sentences. Write in ${descriptionLang}.",
      "lat": -37.xxx,
      "lng": 144.xxx,
      "url": "real ticket/booking/info URL (Ticketek, Ticketmaster, event website, or venue page); leave empty if unavailable"
    }
  ]
}

## Requirements
1. Generate **30-50 events** across all categories, as many real events as possible
2. Dates must be between ${startDate} and ${endDate}
3. Coordinates must cover Greater Melbourne area: lat -38.5 to -37.5, lng 144.0 to 145.5 (including western suburbs like Werribee, Point Cook, Williamstown, and Geelong area)
4. Use real, well-known events and venues where possible (MCG, Rod Laver Arena, Federation Square, NGV, Southbank, St Kilda, Flemington, Geelong etc.)
5. Cover all areas: eastern suburbs, western suburbs, northern suburbs, CBD, and Geelong — don't concentrate only in CBD
6. Include AFL, NRL, concerts, exhibitions, festivals, night markets, food events, family activities
7. Provide a real URL for each event if known (ticketing page, event website, or venue page); leave empty only if no URL is available
8. Output ONLY valid JSON, no markdown fences or extra text`

  const resp = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: isEn ? 'Generate Melbourne events for the next month' : '请生成墨尔本未来1个月的活动信息' },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`DeepSeek API ${resp.status}: ${text.slice(0, 200)}`)
  }

  const data = await resp.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('DeepSeek 返回内容为空')
  }

  const parsed = JSON.parse(content)
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    events: parsed.events || [],
    news: parsed.news || '',
  }
}
