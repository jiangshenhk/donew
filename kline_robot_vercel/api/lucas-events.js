export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST' })
  }

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: '未配置 DEEPSEEK_API_KEY' })
  }

  try {
    const result = await callDeepSeek(DEEPSEEK_API_KEY)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600')
    res.status(200).json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

async function callDeepSeek(apiKey) {
  const systemPrompt = `你是一个墨尔本本地活动资讯助手。你非常了解墨尔本及维多利亚州即将发生的娱乐、文化、体育、美食、音乐、艺术、家庭等活动。

请生成墨尔本地区未来1个月内（从今天 ${new Date().toISOString().split('T')[0]} 起）的真实活动信息。

## 输出格式要求
必须返回一个 JSON 对象，格式如下：
{
  "news": "墨尔本近期活动综合概述，3-5句话，中文",
  "events": [
    {
      "name": "活动名称（英文）",
      "date": "2026-XX-XX",
      "venue": "场地名称",
      "category": "music|sports|culture|food|festival|art|family|market|other",
      "description": "活动简要描述，1-2句话，中文",
      "lat": -37.xxx,
      "lng": 144.xxx,
      "url": ""
    }
  ]
}

## 要求
1. 生成 **15-25个** 活动，覆盖各类别
2. 日期必须在未来1个月内
3. 坐标必须在墨尔本大都会区范围内（lat: -38.5 到 -37.5, lng: 144.5 到 145.5）
4. 活动名称用英文，描述用中文
5. 尽可能使用真实、知名的活动和场地（如 MCG、Rod Laver Arena、Federation Square、NGV、Southbank、St Kilda、Flemington等）
6. 包括 AFL、NRL、音乐会、展览、节庆、夜市、市场等活动
7. url 留空字符串即可
8. 只输出 JSON，不要包含 \`\`\`json 等标记`

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
        { role: 'user', content: '请生成墨尔本未来1个月的活动信息' },
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
