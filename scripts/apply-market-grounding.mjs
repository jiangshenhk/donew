import fs from 'fs';

function replaceOnce(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) throw new Error(`Missing marker: ${label}`);
  return text.replace(from, to);
}

const groundingExport = `\nexport const EVIDENCE_GROUNDING_RULES = \`\n【事实与证据约束】\n1. 只能根据输入中的行情字段、历史区间统计、新闻条目和策略基线下结论，不得补写输入中不存在的事实。\n2. 只有当前价和当日涨跌时，只能描述当前价格、当日变化和与前收比较；不得写“历史新高/历史新低/数月高点/突破前高/创纪录”。\n3. 写历史高低点、突破前高、距高点回撤等结论，必须引用输入中明确提供的对应历史区间数据。\n4. 因果判断必须指出依据；证据不足时使用“可能、暂时显示、尚需确认、现有数据不足以判断”。\n5. 禁止“资金正在、市场已经确认、必然、确定、明显由某事件导致”等无法由输入直接证明的句子。\n6. 新闻为空时不得自行编造事件解释。\n\`;\n\nexport function sanitizeUnsupportedClaims(markdown) {\n  let text = String(markdown || '');\n  const replacements = [\n    [/创(?:下|出|历史)?新高|刷新历史新高|历史新高/g, '处于较高位置（现有输入未提供历史区间数据，不能确认是否为历史新高）'],\n    [/创(?:下|出|历史)?新低|刷新历史新低|历史新低/g, '处于较低位置（现有输入未提供历史区间数据，不能确认是否为历史新低）'],\n    [/突破前高/g, '接近或越过近期参考位置（输入未提供可核验前高）'],\n    [/资金正在/g, '现有信息可能反映资金在'],\n    [/市场已经确认/g, '市场暂时显示'],\n    [/明显由([^。；\\n]+)导致/g, '可能与$1有关，但现有输入不足以确认因果'],\n  ];\n  for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);\n  return text;\n}\n`;

const corePath = 'lib/market-report-core.mjs';
let core = fs.readFileSync(corePath, 'utf8');
if (!core.includes('EVIDENCE_GROUNDING_RULES')) core += groundingExport;
fs.writeFileSync(corePath, core);

const generatorPath = 'scripts/generate-market-daily-report.mjs';
let generator = fs.readFileSync(generatorPath, 'utf8');
generator = replaceOnce(generator, '  validateCriticalRequirements,\n', '  validateCriticalRequirements,\n  EVIDENCE_GROUNDING_RULES,\n  sanitizeUnsupportedClaims,\n', 'generator imports');
generator = replaceOnce(generator,
  'const prompt = buildMarketReportPrompt({ strategy, reportType, news, marketSnapshot: pricePayload });',
  'const prompt = `${buildMarketReportPrompt({ strategy, reportType, news, marketSnapshot: pricePayload })}\\n\\n${EVIDENCE_GROUNDING_RULES}`;',
  'generator prompt');
generator = replaceOnce(generator,
  'const markdown = await callAI();\nvalidateCriticalRequirements(markdown);',
  'const markdown = sanitizeUnsupportedClaims(await callAI());\nvalidateCriticalRequirements(markdown);',
  'generator sanitize');
fs.writeFileSync(generatorPath, generator);

const apiRules = `const EVIDENCE_GROUNDING_RULES = \`\n【事实与证据约束】\n- 只能根据输入中的行情、历史区间字段和新闻下结论，不得补写不存在的事实。\n- 只有当前价和日涨跌时，不得称为历史新高、历史新低、数月高点、突破前高或创纪录。\n- 因果判断必须指出依据；证据不足时写“可能、暂时显示、尚需确认、现有数据不足以判断”。\n- 禁止“资金正在、市场已经确认、必然、确定、明显由某事件导致”等无法直接证明的句子。\n- 新闻为空时不得自行编造事件解释。\n\`;\n\nfunction sanitizeUnsupportedClaims(markdown) {\n  let text = String(markdown || '');\n  const replacements = [\n    [/创(?:下|出|历史)?新高|刷新历史新高|历史新高/g, '处于较高位置（现有输入未提供历史区间数据，不能确认是否为历史新高）'],\n    [/创(?:下|出|历史)?新低|刷新历史新低|历史新低/g, '处于较低位置（现有输入未提供历史区间数据，不能确认是否为历史新低）'],\n    [/突破前高/g, '接近或越过近期参考位置（输入未提供可核验前高）'],\n    [/资金正在/g, '现有信息可能反映资金在'],\n    [/市场已经确认/g, '市场暂时显示'],\n    [/明显由([^。；\\n]+)导致/g, '可能与$1有关，但现有输入不足以确认因果'],\n  ];\n  for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);\n  return text;\n}\n\n`;

const apiPath = 'kline_robot_vercel/api/market-report-v2.js';
let api = fs.readFileSync(apiPath, 'utf8');
if (!api.includes('const EVIDENCE_GROUNDING_RULES')) {
  const marker = api.indexOf('\nfunction ');
  if (marker < 0) throw new Error('Missing API function marker');
  api = `${api.slice(0, marker + 1)}${apiRules}${api.slice(marker + 1)}`;
}
api = api.replaceAll('content: marketPrompt() },', 'content: `${marketPrompt()}\\n\\n${EVIDENCE_GROUNDING_RULES}` },');
api = api.replace('const built = buildRuleMarkdown(meta, snapshot, classification, targets, ai.text,', 'const built = buildRuleMarkdown(meta, snapshot, classification, targets, sanitizeUnsupportedClaims(ai.text),');
api = api.replace('markdown: built.markdown,', 'markdown: sanitizeUnsupportedClaims(built.markdown),');
fs.writeFileSync(apiPath, api);

const validatorPath = 'scripts/validate-market-report.mjs';
let validator = fs.readFileSync(validatorPath, 'utf8');
if (!validator.includes('unsupportedAbsoluteClaims')) {
  const marker = "const markdown = fs.readFileSync(file, 'utf8');";
  const guard = `\n\nconst unsupportedAbsoluteClaims = [\n  /创(?:下|出|历史)?新高|刷新历史新高|历史新高/,\n  /创(?:下|出|历史)?新低|刷新历史新低|历史新低/,\n  /突破前高/,\n  /资金正在/,\n  /市场已经确认/,\n  /明显由[^。；\\n]+导致/,\n];\nfor (const pattern of unsupportedAbsoluteClaims) {\n  if (pattern.test(markdown)) throw new Error(\`报告包含缺乏可核验证据的绝对表述: \${pattern}\`);\n}\n`;
  validator = replaceOnce(validator, marker, marker + guard, 'validator markdown');
}
fs.writeFileSync(validatorPath, validator);

console.log('Applied evidence-grounding rules to manual and automatic market reports.');
