export default async function handler(req, res) {
  const { lamin, lomin, lamax, lomax } = req.query

  if (!lamin || !lomin || !lamax || !lomax) {
    return res.status(400).json({ error: '缺少经纬度参数' })
  }

  try {
    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    })
    if (!resp.ok) {
      return res.status(resp.status).json({ error: 'OpenSky API error', status: resp.status, statusText: resp.statusText })
    }
    const data = await resp.json()
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=5')
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack })
  }
}
