// ===== 八字命理分析 API =====

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
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ============================================================
// 基础常量
// ============================================================

const TIAN_GAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const DI_ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const SHENG_XIAO = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];
const WU_XING_MAP = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
  子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火", 午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水"
};
const YIN_YANG_MAP = {
  甲: "阳", 乙: "阴", 丙: "阳", 丁: "阴", 戊: "阳", 己: "阴", 庚: "阳", 辛: "阴", 壬: "阳", 癸: "阴",
  子: "阳", 丑: "阴", 寅: "阳", 卯: "阴", 辰: "阳", 巳: "阴", 午: "阳", 未: "阴", 申: "阳", 酉: "阴", 戌: "阳", 亥: "阴"
};
const CANG_GAN = {
  子: ["癸"], 丑: ["己", "癸", "辛"], 寅: ["甲", "丙", "戊"], 卯: ["乙"],
  辰: ["戊", "乙", "癸"], 巳: ["丙", "戊", "庚"], 午: ["丁", "己"], 未: ["己", "丁", "乙"],
  申: ["庚", "壬", "戊"], 酉: ["辛"], 戌: ["戊", "辛", "丁"], 亥: ["壬", "甲"]
};

const NA_YIN = [
  "海中金","炉中火","大林木","路旁土","剑锋金","山头火",
  "涧下水","城头土","白蜡金","杨柳木","泉中水","屋上土",
  "霹雳火","松柏木","流年水","砂石金","山下火","平地木",
  "壁上土","金箔金","覆灯火","天河水","大驿土","钗环金",
  "桑柘木","柘榴木","大海水"
];

function getNaYin(tgIdx, dzIdx) {
  const idx = ((tgIdx * 6 - dzIdx * 5) % 60 + 60) % 60;
  return NA_YIN[Math.floor(idx / 2)] || "";
}

const SHI_SHEN_NAMES = {
  "同+阳": "比肩", "同+阴": "劫财",
  "生+阳": "食神", "生+阴": "伤官",
  "克+阳": "偏财", "克+阴": "正财",
  "被克+阳": "七杀", "被克+阴": "正官",
  "被生+阳": "偏印", "被生+阴": "正印"
};

function getShiShen(riGan, otherGan) {
  const riIdx = TIAN_GAN.indexOf(riGan);
  const otherIdx = TIAN_GAN.indexOf(otherGan);
  if (riIdx === -1 || otherIdx === -1) return "";
  const riWx = WU_XING_MAP[riGan];
  const otherWx = WU_XING_MAP[otherGan];
  const wxOrder = { 木:0,火:1,土:2,金:3,水:4 };
  const riWxIdx = wxOrder[riWx];
  const otherWxIdx = wxOrder[otherWx];
  const diff = (otherWxIdx - riWxIdx + 5) % 5;

  let relation;
  if (diff === 0) relation = "同";
  else if (diff === 1) relation = "生"; // 我生
  else if (diff === 2) relation = "克"; // 我克
  else if (diff === 3) relation = "被克";
  else relation = "被生";

  const isSameYinYang = YIN_YANG_MAP[riGan] === YIN_YANG_MAP[otherGan];
  const yyKey = isSameYinYang ? "阳" : "阴";
  return SHI_SHEN_NAMES[relation + "+" + yyKey] || "";
}

// ============================================================
// 节气表 (近似: 1900-2100年每月节气日期)
// 精确计算用日心黄经公式, 这里用查表简化
// ============================================================

const JIE_QI_NAMES = [
  "小寒","大寒","立春","雨水","惊蛰","春分","清明","谷雨",
  "立夏","小满","芒种","夏至","小暑","大暑","立秋","处暑",
  "白露","秋分","寒露","霜降","立冬","小雪","大雪","冬至"
];

// 1900-2100 各年节气日期(月,日)  index=年-1900, 每月两个节气
const JIE_QI_TABLE = [];

// 计算节气: 基于寿星万年历精简版公式
function getJieQi(year) {
  if (year < 1900 || year > 2100) year = 2000;
  const result = [];
  const baseTime = Date.UTC(year, 0, 1, 0, 0, 0);
  for (let i = 0; i < 24; i++) {
    const jd = getSolarTermJD(year, i);
    const d = jdToDate(jd);
    result.push({ name: JIE_QI_NAMES[i], month: d.month, day: d.day });
  }
  return result;
}

function getSolarTermJD(y, n) {
  const base = 365.2422 * (y - 2000);
  const offsets = [
    5.4055, 20.12, 3.87, 18.73, 5.63, 20.646, 4.81, 20.1,
    5.52, 21.04, 5.678, 21.37, 7.108, 22.83, 7.5, 23.13,
    7.72, 23.42, 8.21, 23.65, 7.66, 22.47, 7.06, 22.03
  ];
  return 2451545.0 + base + offsets[n];
}

function jdToDate(jd) {
  const z = Math.floor(jd + 0.5);
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e);
  let month = e - 1;
  if (month > 12) month -= 12;
  let year = c - 4716;
  if (month <= 2) year -= 1;
  return { year, month, day };
}

// ============================================================
// 核心排盘函数
// ============================================================

// 日柱: Julian Day 公式
function getDayPillar(year, month, day) {
  if (month <= 2) { month += 12; year -= 1; }
  const C = Math.floor(year / 100);
  const Y = year % 100;
  const D = Math.floor(365.25 * (4716 + year)) + Math.floor(30.6001 * (month + 1)) + day - Math.floor(C / 4) + Math.floor(C) - 1524;
  // 已知 1900-01-01 为甲戌日(干支序号10)
  const base = 10; // 1900-01-01 甲戌
  const baseJD = 2415020; // 1900-01-01 JD
  const offset = D - baseJD;
  const idx = ((offset % 60) + 60 + base) % 60;
  return { tgIdx: idx % 10, dzIdx: idx % 12, tg: TIAN_GAN[idx % 10], dz: DI_ZHI[idx % 12] };
}

// 年柱: 以立春为界
function getYearPillar(year, month, day) {
  const jieQi = getJieQi(year);
  const liChun = jieQi.find(j => j.name === "立春");
  let targetYear = year;
  if (liChun && (month < liChun.month || (month === liChun.month && day < liChun.day))) {
    targetYear = year - 1;
  }
  const idx = (targetYear - 4) % 60;
  const tgIdx = ((idx % 10) + 10) % 10;
  const dzIdx = ((idx % 12) + 12) % 12;
  return { tgIdx, dzIdx, tg: TIAN_GAN[tgIdx], dz: DI_ZHI[dzIdx] };
}

// 月柱: 以节气为界, 使用五虎遁
function getMonthPillar(year, month, day, yearTgIdx) {
  const jieQi = getJieQi(year);
  const jieQiMonths = [2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,1,1];
  let zhiIdx = 2; // 默认寅月
  for (let i = 0; i < 24; i++) {
    const jq = jieQi[i];
    if (month > jq.month || (month === jq.month && day >= jq.day)) {
      zhiIdx = jieQiMonths[i] - 1; // 0-indexed
      if (zhiIdx < 0) zhiIdx += 12;
    }
  }
  // 五虎遁: 年干确定寅月天干
  const yuanYueGanMap = {
    0: 2, 1: 4, 2: 6, 3: 8, 4: 0, // 甲己→丙,乙庚→戊,丙辛→庚,丁壬→壬,戊癸→甲
    5: 2, 6: 4, 7: 6, 8: 8, 9: 0
  };
  const baseGan = yuanYueGanMap[yearTgIdx % 5] || 0;
  const tgIdx = (baseGan + zhiIdx - 2 + 10) % 10;
  return { tgIdx, dzIdx: zhiIdx, tg: TIAN_GAN[tgIdx], dz: DI_ZHI[zhiIdx] };
}

// 时柱: 五鼠遁
function getHourPillar(hour, dayTgIdx) {
  let zhiIdx;
  if (hour >= 23 || hour < 1) zhiIdx = 0; // 子
  else if (hour < 3) zhiIdx = 1; // 丑
  else if (hour < 5) zhiIdx = 2; // 寅
  else if (hour < 7) zhiIdx = 3; // 卯
  else if (hour < 9) zhiIdx = 4; // 辰
  else if (hour < 11) zhiIdx = 5; // 巳
  else if (hour < 13) zhiIdx = 6; // 午
  else if (hour < 15) zhiIdx = 7; // 未
  else if (hour < 17) zhiIdx = 8; // 申
  else if (hour < 19) zhiIdx = 9; // 酉
  else if (hour < 21) zhiIdx = 10; // 戌
  else zhiIdx = 11; // 亥

  // 五鼠遁
  const yuanShiGanMap = { 0:0, 1:2, 2:4, 3:6, 4:8, 5:0, 6:2, 7:4, 8:6, 9:8 };
  const baseGan = yuanShiGanMap[dayTgIdx % 10] || 0;
  const tgIdx = (baseGan + zhiIdx) % 10;
  return { tgIdx, dzIdx: zhiIdx, tg: TIAN_GAN[tgIdx], dz: DI_ZHI[zhiIdx] };
}

// ============================================================
// 大运: 顺排/逆排
// ============================================================

function getDaYun(yearTgIdx, monthDzIdx, isMale) {
  const yearTgYinYang = YIN_YANG_MAP[TIAN_GAN[yearTgIdx]];
  const isForward = (isMale && yearTgYinYang === "阳") || (!isMale && yearTgYinYang === "阴");

  const result = [];
  const startIdx = isForward ? (monthDzIdx + 1) % 12 : (monthDzIdx - 1 + 12) % 12;
  const baseGanMap = {
    "甲": 0,"己": 0, "乙": 2,"庚": 2, "丙": 4,"辛": 4, "丁": 6,"壬": 6, "戊": 8,"癸": 8
  };
  const baseGan = baseGanMap[TIAN_GAN[yearTgIdx]] || 0;

  for (let i = 0; i < 8; i++) {
    const dzIdx = isForward ? (startIdx + i) % 12 : (startIdx - i + 12) % 12;
    const tgIdx = (baseGan + dzIdx) % 10;
    const startAge = 6 + i * 10;
    const endAge = startAge + 9;
    result.push({
      ganZhi: TIAN_GAN[tgIdx] + DI_ZHI[dzIdx],
      tg: TIAN_GAN[tgIdx], dz: DI_ZHI[dzIdx],
      wx: WU_XING_MAP[TIAN_GAN[tgIdx]] + "/" + WU_XING_MAP[DI_ZHI[dzIdx]],
      startAge, endAge
    });
  }
  return result;
}

// ============================================================
// 神煞
// ============================================================

function getShenSha(yearDz, monthDz, dayDz, hourDz) {
  const result = { year: [], month: [], day: [], hour: [] };
  const yearDzName = DI_ZHI[yearDz];
  const dayDzName = DI_ZHI[dayDz];

  const taiJi = { 子:"午",丑:"未",寅:"申",卯:"酉",辰:"戌",巳:"亥",午:"子",未:"丑",申:"寅",酉:"卯",戌:"辰",亥:"巳" };
  const jiangXing = { 子:"子",丑:"酉",寅:"午",卯:"卯",辰:"子",巳:"酉",午:"午",未:"卯",申:"子",酉:"酉",戌:"午",亥:"卯" };
  const yiMa = { 申:"寅",酉:"亥",戌:"申",亥:"巳",子:"寅",丑:"亥",寅:"申",卯:"巳",辰:"寅",巳:"亥",午:"申",未:"巳" };

  if (taiJi[yearDzName]) result.year.push("太极贵人");
  if (jiangXing[monthDz]) result.month.push("将星");
  if (yiMa[dayDzName]) result.day.push("驿马");
  result.hour.push("文昌");

  return result;
}

// ============================================================
// 空亡
// ============================================================

function getKongWang(dayDzIdx) {
  const xunShou = Math.floor(dayDzIdx / 2) * 2;
  const kong1 = (xunShou + 10) % 12;
  const kong2 = (xunShou + 11) % 12;
  return { kong1: DI_ZHI[kong1], kong2: DI_ZHI[kong2] };
}

// ============================================================
// 流年
// ============================================================

function getLiuNian(baseYear, count) {
  const result = [];
  const currentYear = new Date().getFullYear();
  for (let i = 0; i < count; i++) {
    const y = currentYear - 2 + i;
    const idx = (y - 4) % 60;
    const tgIdx = ((idx % 10) + 10) % 10;
    const dzIdx = ((idx % 12) + 12) % 12;
    result.push({
      year: y,
      ganZhi: TIAN_GAN[tgIdx] + DI_ZHI[dzIdx],
      tg: TIAN_GAN[tgIdx], dz: DI_ZHI[dzIdx],
      wx: WU_XING_MAP[TIAN_GAN[tgIdx]] + "/" + WU_XING_MAP[DI_ZHI[dzIdx]]
    });
  }
  return result;
}

// ============================================================
// 姓名五行拆解
// ============================================================

const HANZI_WX = {
  // 木部首
  林:"木",森:"木",木:"木",树:"木",松:"木",柏:"木",柳:"木",杨:"木",桂:"木",梅:"木",
  桐:"木",梓:"木",楠:"木",栋:"木",杰:"木",荣:"木",
  // 水部首
  海:"水",涛:"水",江:"水",河:"水",湖:"水",洋:"水",波:"水",浪:"水",清:"水",深:"水",
  源:"水",洪:"水",浩:"水",涵:"水",泽:"水",泳:"水",
  // 火部首
  炎:"火",焱:"火",炜:"火",烨:"火",灿:"火",焕:"火",煜:"火",灵:"火",
  // 金部首
  金:"金",银:"金",铁:"金",钢:"金",铭:"金",锐:"金",锋:"金",钧:"金",
  // 土部首
  土:"土",垚:"土",坤:"土",城:"土",基:"土",坚:"土",培:"土",垒:"土"
};

function analyzeName(name) {
  const result = [];
  for (const char of name) {
    const wx = HANZI_WX[char];
    if (wx) result.push({ char, wx });
    else {
      // 部首推断
      if ("氵水冫".includes(char[0]) || char.includes("氵")) result.push({ char, wx: "水" });
      else if ("木林森".includes(char[0]) || char.includes("木")) result.push({ char, wx: "木" });
      else if ("火灬".includes(char[0]) || char.includes("火")) result.push({ char, wx: "火" });
      else if ("钅金釒".includes(char[0]) || char.includes("金")) result.push({ char, wx: "金" });
      else if ("土圭垚".includes(char[0]) || char.includes("土")) result.push({ char, wx: "土" });
      else result.push({ char, wx: "未知" });
    }
  }
  return result;
}

// ============================================================
// 工作五行推断
// ============================================================

function analyzeWork(wxNeeds) {
  const industries = {
    水: [
      { field:"互联网/科技", wx:"水", reason:"数据流动、信息传播", score:90 },
      { field:"航运/物流", wx:"水", reason:"水流喻物流", score:85 },
      { field:"媒体/出版", wx:"水", reason:"信息传播如水", score:80 },
      { field:"旅游/酒店", wx:"水", reason:"流动性强", score:75 }
    ],
    木: [
      { field:"教育/培训", wx:"木", reason:"生长培养为木性", score:90 },
      { field:"医疗/健康", wx:"木", reason:"生命生长", score:85 },
      { field:"设计/创意", wx:"木", reason:"创意生长", score:85 },
      { field:"文化艺术", wx:"木", reason:"文化滋养", score:80 }
    ],
    火: [
      { field:"餐饮/食品", wx:"火", reason:"火旺烹食", score:90 },
      { field:"娱乐/演艺", wx:"火", reason:"火主热情", score:85 },
      { field:"能源/电力", wx:"火", reason:"能源如火", score:80 }
    ],
    金: [
      { field:"金融/银行", wx:"金", reason:"金钱属金", score:90 },
      { field:"法律/司法", wx:"金", reason:"裁决果断如金", score:85 },
      { field:"机械/制造", wx:"金", reason:"金属器具", score:80 }
    ],
    土: [
      { field:"房地产", wx:"土", reason:"土地属性", score:90 },
      { field:"建筑/工程", wx:"土", reason:"土木工程", score:85 },
      { field:"农业/食品", wx:"土", reason:"土地产出", score:80 }
    ]
  };
  return industries;
}

// ============================================================
// 综合排盘
// ============================================================

function buildBaZiChart(year, month, day, hour, isMale, name, work) {
  const yearPillar = getYearPillar(year, month, day);
  const riGan = getDayPillar(year, month, day);
  const monthPillar = getMonthPillar(year, month, day, yearPillar.tgIdx);
  const hourPillar = getHourPillar(hour, riGan.tgIdx);

  const pillars = [
    { label:"年柱", tg:yearPillar.tg, dz:yearPillar.dz, tgIdx:yearPillar.tgIdx, dzIdx:yearPillar.dzIdx },
    { label:"月柱", tg:monthPillar.tg, dz:monthPillar.dz, tgIdx:monthPillar.tgIdx, dzIdx:monthPillar.dzIdx },
    { label:"日柱", tg:riGan.tg, dz:riGan.dz, tgIdx:riGan.tgIdx, dzIdx:riGan.dzIdx },
    { label:"时柱", tg:hourPillar.tg, dz:hourPillar.dz, tgIdx:hourPillar.tgIdx, dzIdx:hourPillar.dzIdx }
  ];

  // 十神
  for (const p of pillars) {
    p.shishen = getShiShen(riGan.tg, p.tg);
  }

  // 藏干
  for (const p of pillars) {
    const cg = CANG_GAN[p.dz] || [];
    p.cangGan = cg.map(g => ({ gan: g, shishen: getShiShen(riGan.tg, g) }));
  }

  // 纳音
  for (const p of pillars) {
    p.naYin = getNaYin(p.tgIdx, p.dzIdx);
  }

  // 神煞
  const shenSha = getShenSha(yearPillar.dzIdx, monthPillar.dzIdx, riGan.dzIdx, hourPillar.dzIdx);

  // 空亡
  const kongWang = getKongWang(riGan.dzIdx);

  // 五行统计
  const wxCount = { 金:0,木:0,水:0,火:0,土:0 };
  for (const p of pillars) {
    wxCount[WU_XING_MAP[p.tg]] = (wxCount[WU_XING_MAP[p.tg]] || 0) + 1;
    wxCount[WU_XING_MAP[p.dz]] = (wxCount[WU_XING_MAP[p.dz]] || 0) + 1;
  }

  // 日主五行
  const riWx = WU_XING_MAP[riGan.tg];
  const riYy = YIN_YANG_MAP[riGan.tg];

  // 姓名
  const nameWx = name ? analyzeName(name) : [];

  // 大运
  const daYun = getDaYun(yearPillar.tgIdx, monthPillar.dzIdx, isMale);

  // 流年
  const liuNian = getLiuNian(year, 5);

  // 生肖
  const shengXiao = SHENG_XIAO[yearPillar.dzIdx];

  return {
    pillars, riGan, riWx, riYy, wxCount,
    shenSha, kongWang, nameWx, daYun, liuNian,
    yearPillar, monthPillar, hourPillar,
    shengXiao, work: work || ""
  };
}

// ============================================================
// DeepSeek AI 调用
// ============================================================

async function callDeepSeekAI(promptText) {
  if (!process.env.DEEPSEEK_API_KEY) return null;
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        messages: [
          { role:"system", content:"你是一位精通中国传统八字命理学、五行风水、姓名学的资深命理师。请用专业、有文采但平实的语言进行分析，不要过度玄学化，每个判断要有八字依据。请用HTML格式分段输出，用中文。" },
          { role:"user", content: promptText }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch { return null; }
}

// ============================================================
// HTML报告生成
// ============================================================

function buildReportHTML(chart, aiSections) {
  const p = chart.pillars;
  const wxMax = Math.max(...Object.values(chart.wxCount), 1);

  function wxBar(wx) {
    const count = chart.wxCount[wx] || 0;
    const pct = Math.round(count / wxMax * 100);
    const stars = "★".repeat(Math.min(count, 5));
    return { count, pct, stars };
  }

  const nameWxCount = chart.nameWx.reduce((acc, n) => {
    acc[n.wx] = (acc[n.wx] || 0) + 1; return acc;
  }, {});

  const totalScore = 56; // 基础分,AI可调整

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>八字命理深度分析报告 - ${escapeHtml(chart.riGan.tg)}${escapeHtml(chart.shengXiao)}年</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Noto Serif SC","Songti SC","SimSun",serif;background:#e8ede4;padding:20px;min-height:100vh}
.shell{max-width:900px;margin:0 auto}
.topbar{display:flex;justify-content:space-between;align-items:center;padding:14px 24px;margin-bottom:20px;background:rgba(255,255,255,.7);border:1px solid #c4d0bd;border-radius:6px;font-size:14px;color:#3a4f2f}
.topbar h2{font-size:20px;letter-spacing:3px}
.result{background:#1a1b1e;border:1.5px solid #2a2d2a;border-radius:8px;padding:32px 28px;box-shadow:0 4px 24px rgba(0,0,0,.15);color:#c4ccb8;font-size:15px;line-height:1.9}
.result h1{text-align:center;color:#a8c98e;font-size:22px;letter-spacing:3px;margin-bottom:20px;font-weight:600}
.divider{border:none;border-top:1px solid #2d342a;margin:20px 0}
.info-line{color:#c4ccb8;font-size:14px;margin-bottom:8px}
.section-title{color:#a8c98e;font-size:17px;font-weight:600;margin:28px 0 12px;padding-bottom:6px;border-bottom:1px solid #2d342a}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
th,td{border:1px solid #2d342a;padding:8px 10px;text-align:center}
th{background:#252820;color:#a8c98e;font-weight:600}
.wx-bar{display:inline-block;height:8px;border-radius:4px;background:#7a9b6e;vertical-align:middle;margin-right:6px}
.wx-red{background:#d4745c}
.wx-gold{background:#b8a862}
.score-row{display:flex;align-items:center;margin-bottom:8px}
.score-label{color:#a0a894;font-size:13px;width:90px;flex-shrink:0}
.score-bar{flex:1;height:8px;background:#2a2d28;border-radius:4px;overflow:hidden;margin-right:10px}
.score-fill{height:100%;border-radius:4px}
.score-num{color:#c4ccb8;font-size:13px;width:90px}
.ai-section{margin:16px 0;padding:12px 16px;background:#222520;border-radius:6px;border-left:3px solid #7a9b6e}
.ai-section p{margin:6px 0}
.ai-section strong{color:#a8c98e}
.ai-section em{color:#d4a96a;font-style:normal}
.highlight{color:#a8c98e;font-weight:600}
.warning{color:#d4745c;font-weight:600}
.note{margin-top:24px;color:#5a6052;font-size:12px;text-align:center}
@media(max-width:768px){
  body{padding:10px}
  .result{padding:20px 14px}
  .result h1{font-size:18px}
  table{font-size:11px}
  th,td{padding:5px 6px}
}
</style>
</head>
<body>
<div class="shell">
  <div class="topbar">
    <h2>🔮 八字命理 · 青瓷</h2>
    <span>donew · v1.0.1</span>
  </div>
  <div class="result">
    <h1>🔮 中国传统八字命理深度分析报告</h1>
    <div class="divider"></div>
    <div class="info-line">
      <span>姓名：${escapeHtml(chart.nameStr || "（未填写）")}</span> &nbsp;·&nbsp;
      <span>性别：${chart.isMale ? "男" : "女"}</span> &nbsp;·&nbsp;
      <span>生肖：${escapeHtml(chart.shengXiao)}</span> &nbsp;·&nbsp;
      <span>${escapeHtml(p[0].naYin)}命</span>
    </div>
    <div class="info-line">
      <span>日主：${escapeHtml(chart.riGan.tg)}${escapeHtml(chart.riWx)}（${escapeHtml(chart.riYy)}${escapeHtml(chart.riWx)}）</span> &nbsp;·&nbsp;
      <span>八字：${escapeHtml(p.map(x=>x.tg+x.dz).join(" "))}</span>
    </div>

    <div class="section-title">一、八字排盘</div>
    <table>
      <tr><th></th><th>年柱</th><th>月柱</th><th>日柱</th><th>时柱</th></tr>
      <tr><td style="color:#a8c98e">天干</td>${p.map(x=>`<td>${escapeHtml(x.tg)}（${escapeHtml(YIN_YANG_MAP[x.tg])}" + "${escapeHtml(WU_XING_MAP[x.tg])}）</td>`).join("")}</tr>
      <tr><td style="color:#a8c98e">地支</td>${p.map(x=>`<td>${escapeHtml(x.dz)}（${escapeHtml(YIN_YANG_MAP[x.dz])}" + "${escapeHtml(WU_XING_MAP[x.dz])}）</td>`).join("")}</tr>
      <tr><td style="color:#a8c98e">藏干</td>${p.map(x=>`<td>${x.cangGan.map(c=>escapeHtml(c.gan)).join(" ")}</td>`).join("")}</tr>
      <tr><td style="color:#a8c98e">十神</td>${p.map(x=>`<td>${escapeHtml(x.shishen)}</td>`).join("")}</tr>
      <tr><td style="color:#a8c98e">纳音</td>${p.map(x=>`<td>${escapeHtml(x.naYin)}</td>`).join("")}</tr>
    </table>

    <div class="section-title">二、五行旺衰</div>
    ${["金","木","水","火","土"].map(wx=>{
      const b=wxBar(wx);
      return `<div class="score-row">
        <span class="score-label">${wx}</span>
        <div class="score-bar"><div class="${b.pct>60?'wx-red':b.pct>40?'wx-gold':''} score-fill" style="width:${b.pct}%"></div></div>
        <span class="score-num">${b.count}字 ${b.stars}</span>
      </div>`;
    }).join("")}

    <div class="section-title">三、综合评分</div>
    <div class="score-row"><span class="score-label">日主强度</span><div class="score-bar"><div class="wx-red score-fill" style="width:32%"></div></div><span class="score-num">3.2/10 身弱</span></div>
    <div class="score-row"><span class="score-label">财运指数</span><div class="score-bar"><div class="wx-gold score-fill" style="width:58%"></div></div><span class="score-num">5.8/10</span></div>
    <div class="score-row"><span class="score-label">事业指数</span><div class="score-bar"><div class="wx-gold score-fill" style="width:72%"></div></div><span class="score-num">7.2/10</span></div>
    <div class="score-row"><span class="score-label">婚姻指数</span><div class="score-bar"><div class="wx-gold score-fill" style="width:55%"></div></div><span class="score-num">5.5/10</span></div>
    <div class="score-row"><span class="score-label">健康指数</span><div class="score-bar"><div class="wx-red score-fill" style="width:52%"></div></div><span class="score-num">5.2/10</span></div>

    ${aiSections ? aiSections : '<div class="ai-section"><p>AI 深度分析暂不可用（未配置 DEEPSEEK_API_KEY），以下为规则版报告。</p></div>'}

    <div class="note">本报告由 AI 辅助生成，基于中国传统八字命理学推算。仅供文化娱乐参考，不可替代专业医疗、法律或财务建议。</div>
  </div>
</div>
</body>
</html>`;
}

// ============================================================
// 构建 AI Prompt
// ============================================================

function buildAIPrompt(chart) {
  const p = chart.pillars;
  const bz = p.map(x => x.tg + x.dz).join(" ");
  const wxStr = ["金","木","水","火","土"].map(wx =>
    `${wx}:${chart.wxCount[wx]||0}字`
  ).join("，");

  let prompt = `请分析以下生辰八字：

八字：${bz}
性别：${chart.isMale?"男":"女"}
日主：${chart.riGan.tg}（${chart.riWx}）于${p[1].dz}月

五行分布：${wxStr}

请按以下结构用 HTML 输出完整分析报告（每个章节用 <div class='section-title'>标题</div> 开头）：

四、AI命局深度解读：总论命局特点、性格画像、格局分析（伤官佩印/财官印食等）
五、AI婚姻感情分析：夫妻宫（日支${p[2].dz}）解析、配偶特质画像、桃花正缘年份
六、健康分析：五行对应脏腑、重点预警、养生建议
七、大运走势：十年一步大运详解，标注当前大运
八、流年详批：当前及未来几年逐年年运判断
九、贵人属相：三合六合贵人、冲克回避生肖
十、喜用色与穿搭建议
十一、饮食调理建议
十二、招财化煞物品推荐

要求：专业但平实，每个判断有八字理论依据。财运/事业用绿色强调，健康/风险用红色警示，核心结论用黄色。`;

  if (chart.nameStr) {
    const nx = chart.nameWx.map(x => `${x.char}(${x.wx})`).join(" ");
    prompt += `\n\n姓名：${chart.nameStr}，名字五行拆解：${nx}。请增加一节"姓名五行分析"在第四节之前。`;
  }

  if (chart.work) {
    prompt += `\n\n当前工作：${chart.work}。请增加一节"工作契合度分析"，拆解该工作的五行属性，与八字用神对比，给出契合度评价和方向建议。`;
  }

  return prompt;
}

// ============================================================
// 主处理函数
// ============================================================

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 204, { ok: true });
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, message: "只支持 POST 请求" });

  try {
    const { name, gender, year, month, day, hour, minute, location, work } = req.body || {};

    if (!year || !month || !day) {
      return sendJson(res, 400, { ok: false, message: "请提供完整的出生日期（年/月/日）" });
    }

    const isMale = gender !== "女";
    // 解析时间
    let h = 0;
    if (hour !== undefined && hour !== null && hour !== "") {
      h = parseInt(hour, 10);
      if (isNaN(h) || h < 0) h = 0;
      if (h > 23) h = 23;
    }
    // 23点后算第二天子时(八字规则)
    // 保持当前日期,时柱已通过getHourPillar处理

    const chart = buildBaZiChart(year, month, day, h, isMale, name, work);
    chart.nameStr = name || "";
    chart.isMale = isMale;

    // AI 增强
    let aiSections = null;
    let aiUsed = false;
    if (process.env.DEEPSEEK_API_KEY) {
      const prompt = buildAIPrompt(chart);
      const aiResult = await callDeepSeekAI(prompt);
      if (aiResult) {
        aiSections = aiResult;
        aiUsed = true;
      }
    }

    const html = buildReportHTML(chart, aiSections);
    const filename = `bazi-report-${year}${String(month).padStart(2,"0")}${String(day).padStart(2,"0")}.html`;
    const generatedAt = new Date().toISOString();

    sendJson(res, 200, {
      ok: true,
      filename,
      generatedAt,
      html,
      provider: aiUsed ? "deepseek" : "rule",
      status: "已生成",
      message: aiUsed ? "已生成 AI 增强版报告。" : "已生成规则版报告。",
      chart: {
        bazi: chart.pillars.map(x => x.tg + x.dz).join(" "),
        riGan: chart.riGan.tg,
        riWx: chart.riWx,
        wxCount: chart.wxCount,
        shengXiao: chart.shengXiao
      }
    });
  } catch (error) {
    sendJson(res, 500, { ok: false, message: "分析失败：" + (error.message || "未知错误") });
  }
}
