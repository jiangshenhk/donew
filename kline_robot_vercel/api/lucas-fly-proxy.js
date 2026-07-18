export const config = {
  runtime: 'edge',
  regions: ['hkg1', 'hnd1', 'sin1', 'iad1']
}

export default async function handler(req) {
  const url = new URL(req.url)
  const lamin = url.searchParams.get('lamin')
  const lomin = url.searchParams.get('lomin')
  const lamax = url.searchParams.get('lamax')
  const lomax = url.searchParams.get('lomax')

  if (!lamin || !lomin || !lamax || !lomax) {
    return new Response(JSON.stringify({ error: 'missing bbox params' }), {
      status: 400, headers: { 'content-type': 'application/json' }
    })
  }

  const api = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`

  try {
    const resp = await fetch(api, {
      headers: { 'User-Agent': 'donew-beta/1.0' }
    })
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: 'OpenSky error', status: resp.status }), {
        status: resp.status, headers: { 'content-type': 'application/json' }
      })
    }
    const data = await resp.json()
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 's-maxage=10, stale-while-revalidate=5'
      }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, code: err.cause?.code || err.code }), {
      status: 502, headers: { 'content-type': 'application/json' }
    })
  }
}
