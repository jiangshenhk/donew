export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok:false, message:'Method not allowed' });
  }

  try {
    const { reportType, prompt, rawNews, marketSnapshot } = req.body || {};
    if (!prompt) return res.status(400).json({ ok:false, message:'Missing prompt' });

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return res.status(500).json({ ok:false, message:'Missing AI key' });

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${apiKey}`
      },
      body:JSON.stringify({
        model:'deepseek-chat',
        messages:[
          {role:'system',content:'你负责生成投资日报，严格遵守用户提供的模板。'},
          {role:'user',content:prompt}
        ],
        temperature:0.2
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(500).json({ok:false,message:data.error?.message || 'DeepSeek failed'});
    }

    const markdown = data.choices?.[0]?.message?.content || '';
    return res.json({
      ok:true,
      reportType,
      report:{markdown},
      meta:{newsCount:Array.isArray(rawNews)?rawNews.length:0}
    });
  } catch (error) {
    return res.status(500).json({ok:false,message:error.message});
  }
}
