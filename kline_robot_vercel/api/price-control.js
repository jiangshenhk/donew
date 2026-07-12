export default async function handler(req, res) {
  const action = req.query.action || 'status';

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // V1: 返回控制指令状态
  // 后续接 GitHub Contents API / KV
  // 实现真正持久化开关

  if (action === 'start') {
    return res.end(JSON.stringify({
      enabled: true,
      message: '自动更新已开启（配置接口已预留）'
    }));
  }

  if (action === 'stop') {
    return res.end(JSON.stringify({
      enabled: false,
      message: '自动更新已关闭（配置接口已预留）'
    }));
  }

  return res.end(JSON.stringify({
    enabled: true,
    message: '行情服务运行中'
  }));
}
