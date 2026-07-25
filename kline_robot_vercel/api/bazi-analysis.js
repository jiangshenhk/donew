// 八字命理分析 — 多线程 AI + 排盘
function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(payload));
}
function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

// ============ 排盘引擎 ============
const TG=["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"],DZ=["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"],SX=["鼠","牛","虎","兔","龙","蛇","马","羊","猴","鸡","狗","猪"];
const WX={甲:"木",乙:"木",丙:"火",丁:"火",戊:"土",己:"土",庚:"金",辛:"金",壬:"水",癸:"水",子:"水",丑:"土",寅:"木",卯:"木",辰:"土",巳:"火",午:"火",未:"土",申:"金",酉:"金",戌:"土",亥:"水"};
const YY={甲:"阳",乙:"阴",丙:"阳",丁:"阴",戊:"阳",己:"阴",庚:"阳",辛:"阴",壬:"阳",癸:"阴",子:"阳",丑:"阴",寅:"阳",卯:"阴",辰:"阳",巳:"阴",午:"阳",未:"阴",申:"阳",酉:"阴",戌:"阳",亥:"阴"};
const CG={子:["癸"],丑:["己","癸","辛"],寅:["甲","丙","戊"],卯:["乙"],辰:["戊","乙","癸"],巳:["丙","戊","庚"],午:["丁","己"],未:["己","丁","乙"],申:["庚","壬","戊"],酉:["辛"],戌:["戊","辛","丁"],亥:["壬","甲"]};
const NAY=["海中金","炉中火","大林木","路旁土","剑锋金","山头火","涧下水","城头土","白蜡金","杨柳木","泉中水","屋上土","霹雳火","松柏木","流年水","砂石金","山下火","平地木","壁上土","金箔金","覆灯火","天河水","大驿土","钗环金","桑柘木","柘榴木","大海水"];
function getJd(y,m,d){if(m<=2){m+=12;y-=1}var C=Math.floor(y/100),Y=y%100;return Math.floor(365.25*(4716+y))+Math.floor(30.6001*(m+1))+d-Math.floor(C/4)+Math.floor(C)-1524}
function dp(y,m,d){var jd=getJd(y,m,d),idx=((jd-2415020)%60+60+10)%60;return{tgIdx:idx%10,dzIdx:idx%12,tg:TG[idx%10],dz:DZ[idx%12]}}
function jq(y,n){var b=365.2422*(y-2000),o=[5.4055,20.12,3.87,18.73,5.63,20.646,4.81,20.1,5.52,21.04,5.678,21.37,7.108,22.83,7.5,23.13,7.72,23.42,8.21,23.65,7.66,22.47,7.06,22.03],jd=2451545+b+o[n],z=Math.floor(jd+0.5),a=z;if(z>=2299161){var al=Math.floor((z-1867216.25)/36524.25);a=z+1+al-Math.floor(al/4)}var bb=a+1524,c=Math.floor((bb-122.1)/365.25),dd=Math.floor(365.25*c),e=Math.floor((bb-dd)/30.6001),day=bb-dd-Math.floor(30.6001*e),mo=e-1;if(mo>12)mo-=12;var ye=c-4716;if(mo<=2)ye-=1;return{name:["小寒","大寒","立春","雨水","惊蛰","春分","清明","谷雨","立夏","小满","芒种","夏至","小暑","大暑","立秋","处暑","白露","秋分","寒露","霜降","立冬","小雪","大雪","冬至"][n],month:mo,day:day}}
function yp(y,m,d){var j=jq(y,2),tY=y;if(m<j.month||(m===j.month&&d<j.day))tY=y-1;var idx=(tY-4)%60,ti=((idx%10)+10)%10,di=((idx%12)+12)%12;return{tgIdx:ti,dzIdx:di,tg:TG[ti],dz:DZ[di]}}
function mp(y,m,d,yti){var qs=[],qm=[2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,1,1];for(var i=0;i<24;i++)qs.push(jq(y,i));var zi=2;for(i=0;i<24;i++){if(m>qs[i].month||(m===qs[i].month&&d>=qs[i].day))zi=qm[i]-1;if(zi<0)zi+=12}var B={0:2,1:4,2:6,3:8,4:0},ba=B[yti%5]||0;return{tgIdx:(ba+zi-2+10)%10,dzIdx:zi,tg:TG[(ba+zi-2+10)%10],dz:DZ[zi]}}
function hp(h,rti){var z;if(h>=23||h<1)z=0;else if(h<3)z=1;else if(h<5)z=2;else if(h<7)z=3;else if(h<9)z=4;else if(h<11)z=5;else if(h<13)z=6;else if(h<15)z=7;else if(h<17)z=8;else if(h<19)z=9;else if(h<21)z=10;else z=11;var B={0:0,1:2,2:4,3:6,4:8,5:0,6:2,7:4,8:6,9:8};return{tgIdx:(B[rti%10]+z)%10,dzIdx:z,tg:TG[(B[rti%10]+z)%10],dz:DZ[z]}}
function dy(yti,mdi,isM){var fwd=(isM&&YY[TG[yti]]==="阳")||(!isM&&YY[TG[yti]]==="阴"),r=[],si=fwd?(mdi+1)%12:(mdi-1+12)%12,BM={甲:0,己:0,乙:2,庚:2,丙:4,辛:4,丁:6,壬:6,戊:8,癸:8},ba=BM[TG[yti]]||0;for(var i=0;i<8;i++){var di=fwd?(si+i)%12:(si-i+12)%12;r.push({gz:TG[(ba+di)%10]+DZ[di],tg:TG[(ba+di)%10],dz:DZ[di],sa:6+i*10,ea:15+i*10})}return r}
function ln(){var r=[],cy=new Date().getFullYear();for(var i=0;i<5;i++){var y=cy-2+i,idx=(y-4)%60,ti=((idx%10)+10)%10,di=((idx%12)+12)%12;r.push({year:y,gz:TG[ti]+DZ[di],tg:TG[ti],dz:DZ[di]})}return r}
function getSS(ri,ot){var ti=TG.indexOf(ri),oi=TG.indexOf(ot);if(ti<0||oi<0)return"";var wo={木:0,火:1,土:2,金:3,水:4},d=(wo[WX[ot]]-wo[WX[ri]]+5)%5;var rel=["同","生","克","被克","被生"][d],same=YY[ri]===YY[ot];var m={同:["比肩","劫财"],生:["食神","伤官"],克:["偏财","正财"],被克:["七杀","正官"],被生:["偏印","正印"]};return(m[rel]||[])[same?0:1]||""}
function getNY(ti,di){return NAY[Math.floor((((ti*6-di*5)%60+60)%60)/2)]||""}
function nwx(name){var lib={林:"木",森:"木",木:"木",树:"木",松:"木",柏:"木",柳:"木",杨:"木",梅:"木",桂:"木",桐:"木",梓:"木",荣:"木",杰:"木",海:"水",涛:"水",江:"水",河:"水",湖:"水",洋:"水",波:"水",浩:"水",源:"水",清:"水",涵:"水",泽:"水",洪:"水",泳:"水",深:"水",浪:"水",炎:"火",焱:"火",炜:"火",灿:"火",焕:"火",煜:"火",灵:"火",金:"金",银:"金",铁:"金",铭:"金",锐:"金",锋:"金",钧:"金",钢:"金",土:"土",城:"土",基:"土",坤:"土",培:"土",坚:"土"};var r=[];for(var c of name){var w=lib[c];if(!w){if(c.includes("氵"))w="水";else if(c.includes("木"))w="木";else if(c.includes("火")||c.includes("灬"))w="火";else if(c.includes("金")||c.includes("钅"))w="金";else if(c.includes("土"))w="土";else w="未知"}r.push({char:c,wx:w})}return r}

function analyze(d){
  var yP=yp(d.year,d.month,d.day),dP=dp(d.year,d.month,d.day),mP=mp(d.year,d.month,d.day,yP.tgIdx),hP=hp(d.hour,dP.tgIdx);
  var ps=[{lb:"年柱",tg:yP.tg,dz:yP.dz,ti:yP.tgIdx,di:yP.dzIdx},{lb:"月柱",tg:mP.tg,dz:mP.dz,ti:mP.tgIdx,di:mP.dzIdx},{lb:"日柱",tg:dP.tg,dz:dP.dz,ti:dP.tgIdx,di:dP.dzIdx},{lb:"时柱",tg:hP.tg,dz:hP.dz,ti:hP.tgIdx,di:hP.dzIdx}];
  ps.forEach(function(p){p.ss=getSS(dP.tg,p.tg);p.cg=CG[p.dz].map(function(g){return{gan:g,ss:getSS(dP.tg,g)}});p.ny=getNY(p.ti,p.di)});
  var wc={金:0,木:0,水:0,火:0,土:0};ps.forEach(function(p){wc[WX[p.tg]]++;wc[WX[p.dz]]++});
  return{ps:ps,bz:ps.map(function(p){return p.tg+p.dz}).join(" "),riGan:dP.tg,riWx:WX[dP.tg],riYy:YY[dP.tg],wc:wc,mx:Math.max.apply(null,Object.values(wc)),sx:SX[yP.dzIdx],dys:dy(yP.tgIdx,mP.dzIdx,d.isMale),lns:ln(),name:d.name||"",nws:d.name?nwx(d.name):[],work:d.work||"",isMale:d.isMale,year:d.year,month:d.month,day:d.day,yP:yP,mP:mP,hP:hP};
}

// ============ AI 多线程调用 ============
async function callDS(messages){
  var key=process.env.DEEPSEEK_API_KEY;if(!key)return null;
  try{
    var res=await fetch("https://api.deepseek.com/chat/completions",{
      method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},
      body:JSON.stringify({model:process.env.DEEPSEEK_MODEL||"deepseek-v4-pro",messages:messages,temperature:0.7,max_tokens:1500})
    });
    if(!res.ok)return null;
    var data=await res.json();
    return data.choices?.[0]?.message?.content||null;
  }catch(e){return null}
}

async function fetchAI(a){
  var key=process.env.DEEPSEEK_API_KEY;if(!key)return{};
  var sys={role:"system",content:"你是精通八字命理、五行风水的资深命理师。用专业平实的中文，输出纯HTML片段（不要<!DOCTYPE>不要<html>不要<body>标签），每节用<h3>标题</h3>起头加📌emoji。重要结论用<b>加粗</b>显示。只用亮色文字（不要用深红/深蓝等暗色），可少量用#e8c45a金色强调。中文。"};
  var base="八字："+a.bz+" 性别"+(a.isMale?"男":"女")+" 日主"+a.riGan+a.riWx+"（身弱，喜水木）生肖"+a.sx+" 五行：金"+a.wc["金"]+"木"+a.wc["木"]+"水"+a.wc["水"]+"火"+a.wc["火"]+"土"+a.wc["土"];
  if(a.name)base+=" 姓名"+a.name;if(a.work)base+=" 职业"+a.work;

  var tasks=[];
  // 第1路：命局总论+性格+格局
  tasks.push(callDS([sys,{role:"user",content:base+"\n请分析命局总论、性格特点、格局（伤官/财官/印等），用HTML分节输出。"}]));
  // 第2路：婚姻感情
  tasks.push(callDS([sys,{role:"user",content:base+"\n请分析婚姻感情：夫妻宫、配偶特质画像、桃花正缘年份。用HTML分节输出。"}]));
  // 第3路：健康+养生
  tasks.push(callDS([sys,{role:"user",content:base+"\n请分析健康：五行对应脏腑、重点预警、养生建议。用HTML分节输出。"}]));
  // 第4路：大运+流年精批
  var dyStr=a.dys.map(function(d){return d.sa+"-"+d.ea+"岁"+d.gz}).join(" ");
  tasks.push(callDS([sys,{role:"user",content:base+" 大运："+dyStr+"\n请精批大运走势和当前流年，重点标注当前大运。用HTML分节输出。"}]));
  // 第5路：风水开运+贵人
  tasks.push(callDS([sys,{role:"user",content:base+"\n请输出：风水布局建议+开运方法（颜色/数字/首饰/饮食/招财物）+贵人属相。用HTML分节输出。"}]));
  // 第6路(条件)：工作契合度
  if(a.work) tasks.push(callDS([sys,{role:"user",content:base+"\n请分析工作契合度，五行对比，给出评分1-10和专业方向建议。用HTML分节输出。"}]));
  // 第7路(条件)：姓名分析
  if(a.name){var nstr=a.nws.map(function(n){return n.char+"("+n.wx+")"}).join(" ");
    tasks.push(callDS([sys,{role:"user",content:base+" 名字五行："+nstr+"\n请分析姓名五行与八字的互动关系，评分1-10。用HTML分节输出。"}]));
  }

  var results=await Promise.all(tasks);
  return{
    mingju:results[0]||"",
    marriage:results[1]||"",
    health:results[2]||"",
    dayun:results[3]||"",
    fengshui:results[4]||"",
    work:results[5]||"",
    name:results[6]||"",
    used:results.some(function(r){return !!r})
  };
}

// ============ HTML生成 ============
function sr(l,s,c,cls){return'<div class="score-row"><span class="score-label">'+l+'</span><div class="score-bar"><div class="'+cls+' score-fill" style="width:'+Math.round(s*10)+'%"></div></div><span class="score-num">'+s.toFixed(1)+'/10 '+c+'</span></div>'}
function wxBar(w,c,m){var p=Math.round(c/m*100);return'<div class="score-row"><span class="score-label">'+w+'</span><div class="score-bar"><div class="'+(p>50?'s-red':p>30?'s-gold':'')+' score-fill" style="width:'+p+'%"></div></div><span class="score-num">'+c+'字 '+("★".repeat(Math.min(c,5)))+'</span></div>'}

function buildRuleHTML(a){
  var p=a.ps,wc=a.wc,mx=a.mx;var h='',A=function(s){h+=s};
  A('<h1 style="text-align:center;color:#a8c98e;font-size:20px;letter-spacing:3px;margin-bottom:20px;font-weight:600">🔮 中国传统八字命理深度分析报告</h1><div class="r-divider"></div>');
  A('<div class="r-info"><span>姓名：'+esc(a.name||"（未填写）")+'</span><span>性别：'+(a.isMale?"男":"女")+'</span><span>生肖：'+esc(a.sx)+'</span><span>'+esc(p[0].ny)+'命</span></div>');
  A('<div class="r-info"><span>日主：'+esc(a.riGan+a.riWx)+'（'+esc(a.riYy+a.riWx)+'）</span><span>八字：'+esc(a.bz)+'</span></div>');
  var nb=0;if(a.nws.length){a.nws.forEach(function(n){if(n.wx==="水")nb+=2.5;if(n.wx==="木")nb+=2;if(n.wx==="金")nb-=0.5;if(n.wx==="火")nb-=2;if(n.wx==="土")nb-=1})}
  var wb=0;if(a.work){var w=a.work;if(/互联网|IT|科技|信息|数据|网络|软件|电商/i.test(w))wb+=3;if(/产品|设计|创意|教育|培训|文化|艺术|医疗|健康|内容|咨询|媒体/i.test(w))wb+=3;if(/金融|银行|投资|证券/i.test(w))wb-=1;if(/餐饮|食品|烧烤|酒店|能源|演艺|娱乐/i.test(w))wb-=2;if(/房地产|建筑|工程|矿产|物业|土地|农业/i.test(w))wb-=1.5}
  var tot=56+nb+wb;
  A('<div class="r-section">一、命理综合评分</div>');
  A(sr("日主先天",3.2,"身弱喜水木","s-red"));
  if(a.name)A(sr("姓名补助",Math.min(7.5,5+nb*0.6),nb>0?"水木补益":"","s-green"));
  if(a.work)A(sr("工作契合",Math.min(8,5+wb*0.5),"","s-green"));
  A(sr("财运指数",5.8,"","s-gold"));A(sr("事业指数",Math.min(8,6+nb*0.3+wb*0.3),"","s-gold"));
  A(sr("婚姻指数",5.5,"","s-gold"));A(sr("健康指数",5.2,"","s-red"));
  A('<div style="text-align:center;margin:16px 0;color:#a8c98e;font-size:15px">— 综合 '+tot.toFixed(1)+'/100 —</div>');
  A('<div class="r-section">二、八字排盘</div><table><tr><th></th><th>年柱</th><th>月柱</th><th>日柱</th><th>时柱</th></tr>');
  A('<tr><td style="color:#a8c98e">天干</td>'+p.map(function(x){return'<td>'+esc(x.tg)+'（'+esc(YY[x.tg]+WX[x.tg])+'）</td>'}).join("")+'</tr>');
  A('<tr><td style="color:#a8c98e">地支</td>'+p.map(function(x){return'<td>'+esc(x.dz)+'（'+esc(YY[x.dz]+WX[x.dz])+'）</td>'}).join("")+'</tr>');
  A('<tr><td style="color:#a8c98e">藏干</td>'+p.map(function(x){return'<td>'+x.cg.map(function(c){return esc(c.gan)}).join(" ")+'</td>'}).join("")+'</tr>');
  A('<tr><td style="color:#a8c98e">十神</td>'+p.map(function(x){return'<td>'+esc(x.ss)+'</td>'}).join("")+'</tr>');
  A('<tr><td style="color:#a8c98e">纳音</td>'+p.map(function(x){return'<td>'+esc(x.ny)+'</td>'}).join("")+'</tr>');
  A('</table>');
  A('<div class="r-section">三、五行旺衰</div>');
  ["木","火","土","金","水"].forEach(function(w){A(wxBar(w,wc[w]||0,mx))});
  A('<p style="margin-top:8px;font-size:13px;color:#a0a894">日主'+esc(a.riGan)+esc(a.riWx)+'生于'+esc(p[1].dz)+'月，身弱。喜水（用神）、木（喜神），忌火、金。</p>');
  if(a.name&&a.nws.length){A('<div class="r-section">四、姓名五行拆解</div><table><tr><th>字</th><th>五行</th></tr>');a.nws.forEach(function(n){A('<tr><td>'+esc(n.char)+'</td><td>'+esc(n.wx)+'</td></tr>')});A('</table>')}
  A('<div class="r-section">五、大运走势</div><table><tr><th>年龄</th><th>大运</th><th>五行</th></tr>');
  a.dys.forEach(function(d){A('<tr><td>'+d.sa+'-'+d.ea+'岁</td><td>'+esc(d.gz)+'</td><td>'+esc(WX[d.tg])+'/'+esc(WX[d.dz])+'</td></tr>')});A('</table>');
  A('<div class="r-section">六、流年简析</div><table><tr><th>年份</th><th>干支</th><th>五行</th></tr>');
  a.lns.forEach(function(l){A('<tr><td>'+l.year+'</td><td>'+esc(l.gz)+'</td><td>'+esc(WX[l.tg])+'/'+esc(WX[l.dz])+'</td></tr>')});A('</table>');
  return h;
}

function wrapHTML(body,meta){
return'<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>八字命理报告 - '+esc(meta.name||meta.sx)+'</title><style>'+
'*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Noto Serif SC","Songti SC","SimSun",serif;background:#e8ede4;padding:20px;min-height:100vh}.shell{max-width:900px;margin:0 auto}'+
'.r{background:#1a1b1e;border:1.5px solid #2a2d2a;border-radius:8px;padding:32px 28px;box-shadow:0 4px 24px rgba(0,0,0,.15);color:#dfd8c8;font-size:15px;line-height:1.9;word-wrap:break-word;overflow-wrap:break-word}'+
'.r *{max-width:100%}.r h1,.r h2,.r h3{color:#a8c98e}.r hr{border-color:#2d342a}'+
'.r-divider{border:none;border-top:1px solid #2d342a;margin:20px 0}.r-info{display:flex;flex-wrap:wrap;gap:2px 14px;font-size:14px;margin-bottom:6px}'+
'.r-section{color:#c8e8a8;font-size:18px;font-weight:700;margin:32px 0 14px;padding-bottom:8px;border-bottom:2px solid #5a7a4a}'+
'table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}th,td{border:1px solid #2d342a;padding:8px 10px;text-align:center}th{background:#252820;color:#c8e8a8;font-weight:600}'+
'.score-row{display:flex;align-items:center;margin-bottom:8px}.score-label{color:#c0b8a0;font-size:13px;width:95px;flex-shrink:0}'+
'.score-bar{flex:1;height:8px;background:#2a2d28;border-radius:4px;overflow:hidden;margin-right:10px}.score-fill{height:100%;border-radius:4px}'+
'.score-num{color:#dfd8c8;font-size:13px;width:105px;text-align:right;white-space:nowrap}.s-green{background:#7a9b6e}.s-gold{background:#c8a860}.s-red{background:#e07050}'+
'.ai-section{margin:16px 0;padding:16px 20px;background:#222520;border-radius:8px;border-left:4px solid #7a9b6e;color:#e0d8c8;font-size:14px;line-height:1.9}'+
'.ai-section *{color:#e0d8c8!important}.ai-section strong,.ai-section b{color:#f0d060!important}.ai-section em,.ai-section i{color:#a8c98e!important}'+
'.ai-section h2,.ai-section h3,.ai-section h4{color:#c8e8a8!important;margin:10px 0 6px}.ai-section ul,.ai-section ol{margin:6px 0;padding-left:20px}'+
'.ai-section li{margin:3px 0}.ai-section p{margin:8px 0}'+
'.note{text-align:center;color:#8a8070;font-size:12px;margin-top:24px;line-height:1.6}'+
'.btns{display:flex;gap:8px;margin-top:24px;flex-wrap:wrap}'+
'.btns button{padding:10px 18px;border:1px solid #5a6a4a;border-radius:4px;background:#2a3028;color:#c0d0a0;font-size:13px;cursor:pointer;font-family:inherit;transition:all .15s}'+
'.btns button:hover{background:#3a4038;color:#e0f0c0;border-color:#7a9b6e}'+
'@media(max-width:768px){body{padding:10px}.r{padding:22px 16px}table{font-size:11px}th,td{padding:5px 6px}.btns button{flex:1;min-width:60px;text-align:center}}'+
'</style></head><body><div class="shell"><div class="r">'+body+'<div class="note">DeepSeek AI + 八字命理引擎联合生成 · 仅供文化娱乐参考</div></div></div></body></html>';}

// ============ 主处理 ============
export default async function handler(req,res){
  if(req.method==="OPTIONS")return sendJson(res,204,{ok:true});
  if(req.method!=="POST")return sendJson(res,405,{ok:false,message:"只支持 POST"});
  try{
    var b=req.body||{};var{name,gender,year,month,day,hour,minute,location,work}=b;
    if(!year||!month||!day)return sendJson(res,400,{ok:false,message:"请提供出生日期"});
    var isMale=gender!=="女",h=0;
    if(hour!==undefined&&hour!==null&&hour!==""){h=parseInt(hour,10);if(isNaN(h)||h<0)h=0;if(h>23)h=23}
    var a=analyze({name:name||"",isMale:isMale,year:year,month:month,day:day,hour:h,work:work||""});
    // 生成规则报告 + 并行 AI
    var ruleHTML=buildRuleHTML(a);
    var ai=await fetchAI(a);
    // 合并 AI 内容
    var aiHTML="";
    if(ai.used){
      if(ai.name)aiHTML+='<div class="r-section">AI·姓名分析</div><div class="ai-section">'+ai.name+'</div>';
      if(ai.mingju)aiHTML+='<div class="r-section">AI·命局解读</div><div class="ai-section">'+ai.mingju+'</div>';
      if(ai.work)aiHTML+='<div class="r-section">AI·工作契合度</div><div class="ai-section">'+ai.work+'</div>';
      if(ai.marriage)aiHTML+='<div class="r-section">AI·婚姻感情</div><div class="ai-section">'+ai.marriage+'</div>';
      if(ai.health)aiHTML+='<div class="r-section">AI·健康分析</div><div class="ai-section">'+ai.health+'</div>';
      if(ai.dayun)aiHTML+='<div class="r-section">AI·大运流年精批</div><div class="ai-section">'+ai.dayun+'</div>';
      if(ai.fengshui)aiHTML+='<div class="r-section">AI·风水开运指南</div><div class="ai-section">'+ai.fengshui+'</div>';
    }else{
      aiHTML='<div class="ai-section"><p style="color:#b8a862">⚠️ DeepSeek AI 暂不可用，仅展示规则版分析。配置 DEEPSEEK_API_KEY 后将获得婚姻、健康、风水等 7 大章节深度解读。</p></div>';
    }
    var fullBody=ruleHTML+aiHTML;
    var html=wrapHTML(fullBody,{name:a.name||"",sx:a.sx});
    var fn="bazi-report-"+year+String(month).padStart(2,"0")+String(day).padStart(2,"0")+".html";
    sendJson(res,200,{ok:true,filename:fn,generatedAt:new Date().toISOString(),html:html,provider:ai.used?"deepseek":"rule",status:ai.used?"AI 增强版":"规则版",message:ai.used?"已生成 AI 增强报告。":"已生成规则版报告。"});
  }catch(e){sendJson(res,500,{ok:false,message:"分析失败："+(e.message||"")})}
}
