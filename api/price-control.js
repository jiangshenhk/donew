// Stock price service control API
// Controls stockprice/config/price-config.json through GitHub API

const OWNER = 'jiangshenhk';
const REPO = 'donew';
const CONFIG_PATH = 'stockprice/config/price-config.json';

async function getConfig() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('Missing GITHUB_TOKEN');

  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${CONFIG_PATH}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json'
    }
  });

  if (!r.ok) throw new Error('Cannot read config');
  return await r.json();
}

async function saveConfig(file, config) {
  const token = process.env.GITHUB_TOKEN;
  const content = Buffer.from(JSON.stringify(config, null, 2)).toString('base64');

  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${CONFIG_PATH}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: 'Update stock price service control',
      content,
      sha: file.sha
    })
  });

  if (!r.ok) throw new Error('Cannot save config');
}

export default async function handler(req, res) {
  try {
    const action = req.query?.action || 'status';
    const file = await getConfig();
    const config = JSON.parse(Buffer.from(file.content, 'base64').toString());

    if (action === 'start') config.enabled = true;
    if (action === 'stop') config.enabled = false;

    if (action === 'start' || action === 'stop') {
      await saveConfig(file, config);
    }

    return res.status(200).json({
      status: 'ok',
      action,
      enabled: config.enabled,
      intervalMinutes: config.intervalMinutes
    });
  } catch (e) {
    return res.status(500).json({
      status: 'error',
      message: e.message
    });
  }
}
