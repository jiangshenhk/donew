function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(payload));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeMarkdown(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/#/g, "\\#");
}

function detectPlatform(url) {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("bilibili.com") || u.includes("b23.tv")) return "bilibili";
  if (u.includes("mp.weixin.qq.com") || u.includes("weixin.qq.com")) return "wechat";
  if (u.includes("douyin.com") || u.includes("tiktok.com")) return "tiktok";
  if (u.includes("xiaohongshu.com") || u.includes("xhslink.com")) return "xiaohongshu";
  return "other";
}

function extractYoutubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function extractBilibiliId(url) {
  const patterns = [
    /bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/,
    /b23\.tv\/([a-zA-Z0-9]+)/,
    /bilibili\.com\/video\/av(\d+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function fetchWithTimeout(url, options = {}, timeout = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function getYoutubeVideoInfo(videoId) {
  try {
    const resp = await fetchWithTimeout(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      {},
      15000
    );
    if (resp.ok) {
      const data = await resp.json();
      return { title: data.title, author: data.author_name || "YouTube" };
    }
  } catch (e) {
    console.warn("oembed failed:", e.message);
  }
  return { title: videoId, author: "YouTube" };
}

async function getYoutubeTranscript(videoId) {
  const transcriptUrl = `https://youtubetranscript.com/?v=${videoId}`;
  try {
    const resp = await fetchWithTimeout(transcriptUrl, {}, 20000);
    if (!resp.ok) return null;
    const xml = await resp.text();
    const texts = [];
    const regex = /<text[^>]*>([^<]*)<\/text>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      const txt = match[1].trim();
      if (txt) texts.push(txt);
    }
    if (texts.length === 0) return null;
    return texts.join(" ");
  } catch (e) {
    console.warn("youtube transcript failed:", e.message);
    return null;
  }
}

async function getBilibiliVideoInfo(vid) {
  try {
    const apiUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${vid}`;
    const resp = await fetchWithTimeout(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Referer": "https://www.bilibili.com/"
      }
    }, 15000);
    if (!resp.ok) throw new Error("B站 API 返回 " + resp.status);
    const json = await resp.json();
    if (json.code !== 0) throw new Error("B站 API 错误: " + (json.message || "未知错误"));
    const data = json.data;
    return {
      title: data.title || vid,
      author: data.owner?.name || "B站用户",
      duration: data.duration || 0,
      description: data.desc || "",
      cid: data.cid || null
    };
  } catch (e) {
    console.warn("bilibili info failed:", e.message);
    return { title: vid, author: "B站用户", duration: 0, description: "", cid: null };
  }
}

async function getBilibiliSubtitle(vid, cid) {
  if (!cid) return null;
  try {
    const apiUrl = `https://api.bilibili.com/x/player/v2?bvid=${vid}&cid=${cid}`;
    const resp = await fetchWithTimeout(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Referer": "https://www.bilibili.com/"
      }
    }, 15000);
    if (!resp.ok) return null;
    const json = await resp.json();
    const subtitle = json.data?.subtitle?.subtitles;
    if (!subtitle || subtitle.length === 0) return null;
    const subUrl = subtitle[0].subtitle_url;
    if (!subUrl) return null;
    const subResp = await fetchWithTimeout(
      subUrl.startsWith("http") ? subUrl : "https:" + subUrl,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Referer": "https://www.bilibili.com/"
        }
      },
      15000
    );
    if (!subResp.ok) return null;
    const subData = await subResp.json();
    const texts = (subData.body || []).map(item => item.content).filter(Boolean);
    if (texts.length === 0) return null;
    return texts.join("\n");
  } catch (e) {
    console.warn("bilibili subtitle failed:", e.message);
    return null;
  }
}

async function extractArticleFromUrl(url) {
  const resp = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml"
    },
    redirect: "follow"
  }, 20000);

  if (!resp.ok) {
    throw new Error(`无法访问文章链接（HTTP ${resp.status}）`);
  }

  const html = await resp.text();
  const cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
    .replace(/<code[^>]*>[\s\S]*?<\/code>/gi, "")
    .replace(/<pre[^>]*>[\s\S]*?<\/pre>/gi, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n");

  const lines = cleaned.split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 10);

  if (lines.length === 0) {
    throw new Error("无法从该文章中提取文字内容，请尝试直接粘贴文字。");
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "未知标题";

  return { title, text: lines.join("\n\n") };
}

async function callDeepSeek(prompt, maxTokens = 8000) {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("未配置 DEEPSEEK_API_KEY");
  }
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  const resp = await fetchWithTimeout("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "你是一个专业的内容总结助手。请用中文回复，结构清晰，重点突出。" },
        { role: "user", content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.3
    })
  }, 90000);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`DeepSeek API 返回 ${resp.status}: ${text.substring(0, 200)}`);
  }
  const json = await resp.json();
  return json.choices?.[0]?.message?.content || "";
}

async function callOpenAI(prompt, maxTokens = 8000) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("未配置 OPENAI_API_KEY");
  }
  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const resp = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "你是一个专业的内容总结助手。请用中文回复，结构清晰，重点突出。" },
        { role: "user", content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.3
    })
  }, 90000);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI API 返回 ${resp.status}: ${text.substring(0, 200)}`);
  }
  const json = await resp.json();
  return json.choices?.[0]?.message?.content || "";
}

async function callAI(prompt) {
  if (process.env.DEEPSEEK_API_KEY) {
    return { provider: "DeepSeek", text: await callDeepSeek(prompt) };
  }
  if (process.env.OPENAI_API_KEY) {
    return { provider: "OpenAI", text: await callOpenAI(prompt) };
  }
  throw new Error("未配置任何 AI API Key（DEEPSEEK_API_KEY 或 OPENAI_API_KEY）");
}

function buildReportHtml({
  title, mode, platform, sourceTitle, sourceAuthor, sourceUrl,
  sourceText, summary, generatedAt, provider
}) {
  const isArticle = mode === "article";
  const label = isArticle ? "文章" : "视频";

  const separator = "## AI 深度分析";
  const sepIdx = summary.indexOf(separator);
  let summaryPart = summary;
  let analysisPart = "";
  if (sepIdx !== -1) {
    summaryPart = summary.substring(0, sepIdx).trim();
    analysisPart = summary.substring(sepIdx).trim();
  }

  function renderMd(html) {
    return html
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>")
      .replace(/<p><\/p>/g, "")
      .replace(/^<p>/, "<p>")
      .replace(/<\/p>$/, "</p>");
  }

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; background: #0f172a; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif; line-height: 1.75; }
    main { max-width: 960px; margin: 0 auto; padding: 32px 20px 56px; }
    h1 { margin: 0 0 8px; font-size: 32px; color: #f1f5f9; }
    h2 { font-size: 22px; margin: 28px 0 12px; color: #e2e8f0; border-left: 4px solid #3b82f6; padding-left: 12px; }
    h3 { font-size: 17px; margin: 20px 0 10px; color: #cbd5e1; }
    .meta { color: #94a3b8; font-size: 13px; margin-bottom: 20px; line-height: 1.8; }
    .meta a { color: #60a5fa; }
    .card { background: #172554; border: 1px solid #334155; border-radius: 18px; padding: 20px 24px; margin-bottom: 18px; }
    .card h3 { margin-top: 0; }
    .highlight { color: #fde047; font-weight: 700; }
    .tag { display: inline-block; background: #1e3a5f; color: #93c5fd; border-radius: 8px; padding: 2px 10px; font-size: 12px; margin-right: 6px; }
    .summary-box { color: #e2e8f0; }
    .summary-box p { margin: 12px 0; }
    .summary-box ul, .summary-box ol { padding-left: 20px; }
    .summary-box li { margin: 6px 0; }
    .summary-box strong { color: #fde047; }
    .analysis-box { color: #e2e8f0; }
    .analysis-box p { margin: 12px 0; }
    .analysis-box ul, .analysis-box ol { padding-left: 20px; }
    .analysis-box li { margin: 6px 0; }
    .analysis-box strong { color: #fde047; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #334155; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">
      <span class="tag">${escapeHtml(platform)}</span>
      <span class="tag">${escapeHtml(label)}</span>
      ${sourceTitle ? `｜${escapeHtml(sourceTitle)}` : ""}
      ${sourceAuthor ? `｜作者：${escapeHtml(sourceAuthor)}` : ""}<br>
      生成时间：${escapeHtml(generatedAt)}｜AI：${escapeHtml(provider)}
      ${sourceUrl ? `<br><a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener">查看原始${label}</a>` : ""}
    </div>

    <h2>内容总结</h2>
    <div class="card summary-box">
      ${renderMd(summaryPart)}
    </div>
    ${analysisPart ? `
    <h2>AI 深度分析</h2>
    <div class="card analysis-box">
      ${renderMd(analysisPart.replace(/^## AI 深度分析\s*/g, ""))}
    </div>` : ""}

    <div class="footer">
      由十方斋｜内容总结分析工具自动生成 · ${escapeHtml(provider)} 提供 AI 分析 · 仅供学习参考，不构成任何建议
    </div>
  </main>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 204, { ok: true });
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, message: "Method not allowed" });

  try {
    const mode = String(req.body?.mode || "video").trim();
    const note = String(req.body?.note || "").trim();

    let sourceTitle = "";
    let sourceAuthor = "";
    let sourceUrl = "";
    let sourceText = "";
    let platform = "";

    if (mode === "article") {
      const articleUrl = String(req.body?.articleUrl || req.body?.videoUrl || "").trim();
      const articleText = String(req.body?.articleText || "").trim();

      if (!articleUrl && !articleText) {
        return sendJson(res, 400, { ok: false, message: "请输入文章链接或粘贴文字内容" });
      }

      if (articleText) {
        sourceText = articleText;
        sourceTitle = "用户粘贴文字";
        platform = "手动输入";
      } else if (articleUrl) {
        try {
          const article = await extractArticleFromUrl(articleUrl);
          sourceTitle = article.title;
          sourceText = article.text;
          sourceUrl = articleUrl;
          platform = detectPlatform(articleUrl) === "wechat" ? "微信公众号" : "网页文章";
        } catch (e) {
          return sendJson(res, 400, {
            ok: false,
            message: `文章获取失败：${e.message}\n\n请尝试直接粘贴文字内容。`
          });
        }
      }
    } else {
      const videoUrl = String(req.body?.videoUrl || req.body?.symbol || "").trim();

      if (!videoUrl) {
        return sendJson(res, 400, { ok: false, message: "请输入视频链接" });
      }

      sourceUrl = videoUrl;
      platform = detectPlatform(videoUrl);

      if (platform === "youtube") {
        const videoId = extractYoutubeId(videoUrl);
        if (!videoId) {
          return sendJson(res, 400, { ok: false, message: "无法解析 YouTube 视频 ID" });
        }
        const info = await getYoutubeVideoInfo(videoId);
        sourceTitle = info.title;
        sourceAuthor = info.author;
        sourceText = await getYoutubeTranscript(videoId);
        if (!sourceText) {
          return sendJson(res, 400, {
            ok: false,
            message: "该 YouTube 视频没有可用的字幕/文字稿。请确认视频已开启自动字幕功能，或尝试其他视频。"
          });
        }
        platform = "YouTube";
      } else if (platform === "bilibili") {
        const vid = extractBilibiliId(videoUrl);
        if (!vid) {
          return sendJson(res, 400, { ok: false, message: "无法解析 B站视频 ID" });
        }
        const info = await getBilibiliVideoInfo(vid);
        sourceTitle = info.title;
        sourceAuthor = info.author;
        sourceText = await getBilibiliSubtitle(vid, info.cid);
        if (!sourceText) {
          return sendJson(res, 400, {
            ok: false,
            message: "该 B站视频没有可用字幕。B站视频需由 UP 主上传字幕或开启 AI 字幕功能。"
          });
        }
        platform = "B站";
      } else if (platform === "wechat") {
        return sendJson(res, 400, {
          ok: false,
          message: "微信视频号内容暂不支持直接获取。请切换到「文章总结」模式，手动粘贴视频的文字描述/字幕/笔记即可。",
          suggestMode: "article"
        });
      } else {
        return sendJson(res, 400, {
          ok: false,
          message: `暂不支持的视频平台（${platform}）。目前支持：YouTube、B站。如需处理其他内容，请切换到"文章"模式。`
        });
      }
    }

    const noteText = note ? `\n\n用户额外说明：${note}` : "";
    const maxLen = 15000;
    const trimmedText = sourceText.length > maxLen
      ? sourceText.substring(0, maxLen) + "\n\n[注意：原文过长已截断，原始长度 " + sourceText.length + " 字符]"
      : sourceText;

    const contentType = mode === "article" ? "文章内容" : "视频内容";
    const aiPrompt = `请对以下${contentType}进行总结和深度分析。请用中文回复，严格按以下结构输出：

## 内容概览
简要说明该${mode === "article" ? "文章" : "视频"}的主题、类型和核心内容。

## 核心要点
列出${mode === "article" ? "文章" : "视频"}中提到的 3-8 个核心观点或重要信息，每条单独列出。

## 关键结论
总结最终的结论、立场或建议。

## 补充观察
如果有值得关注的细节、数据或案例，请在此补充。

## AI 深度分析
从以下角度对这个${mode === "article" ? "文章" : "视频"}进行更深层次的独立分析：
- **逻辑审视**：内容的论证逻辑是否严密？有无明显漏洞或偏见？
- **背景补充**：这个话题相关的背景知识、行业趋势或历史脉络。
- **延伸思考**：这个内容可能引发的进一步思考或值得关注的问题。
- **独特见解**：基于内容之外的知识，给出你独有的洞察或评价。

标题：${escapeMarkdown(sourceTitle || "未知")}
${sourceAuthor ? "作者：" + escapeMarkdown(sourceAuthor) : ""}

原始内容：
${trimmedText}
${noteText}`;

    const generatedAt = new Date().toISOString();
    const generatedAtLocal = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
    let aiResult;
    try {
      aiResult = await callAI(aiPrompt);
    } catch (e) {
      return sendJson(res, 500, {
        ok: false,
        message: `AI 调用失败：${e.message}。请检查 API Key 配置。`
      });
    }

    const reportTitle = mode === "article" ? "文章总结分析报告" : "视频总结分析报告";
    const html = buildReportHtml({
      title: reportTitle,
      mode,
      platform,
      sourceTitle,
      sourceAuthor,
      sourceUrl,
      sourceText,
      summary: aiResult.text,
      generatedAt: generatedAtLocal,
      provider: aiResult.provider
    });

    const typeLabel = mode === "article" ? "文章" : "视频";
    const markdown = `# ${reportTitle}\n\n**平台**：${platform}\n**${typeLabel}**：${sourceTitle}\n**作者**：${sourceAuthor}\n**链接**：${sourceUrl}\n**AI**：${aiResult.provider}\n**生成时间**：${generatedAtLocal}\n\n---\n\n${aiResult.text}`;

    return sendJson(res, 200, {
      ok: true,
      provider: aiResult.provider,
      status: "已生成",
      message: `已对"${sourceTitle}"生成${typeLabel}总结。`,
      generatedAt,
      filename: "summary-report.html",
      html,
      markdown,
      summaryText: getSummaryPlainText(aiResult.text),
      meta: {
        mode,
        platform,
        sourceTitle,
        sourceAuthor,
        sourceUrl
      }
    });
  } catch (error) {
    console.error("summary error:", error);
    return sendJson(res, 500, {
      ok: false,
      message: error.message || String(error)
    });
  }
}

function getSummaryPlainText(markdownSummary) {
  return markdownSummary
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}
