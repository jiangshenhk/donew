import https from 'node:https'

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'donew-beta/1.0' } }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }) }
        catch { reject(new Error('JSON parse failed')) }
      })
    }).on('error', reject)
  })
}

export default async function handler(req, res) {
  const { lamin, lomin, lamax, lomax } = req.query
  if (!lamin || !lomin || !lamax || !lomax) {
    return res.status(400).json({ error: 'missing bbox params' })
  }

  try {
    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`
    const result = await httpsGet(url)
    if (result.status !== 200) {
      return res.status(result.status).json({ error: 'OpenSky error', detail: result.data })
    }
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=5')
    res.status(200).json(result.data)
  } catch (err) {
    res.status(500).json({ error: err.message, code: err.code })
  }
}
