// Stock price service control API
// Control contract for frontend.

export default async function handler(req, res) {
  const action = req.query?.action || 'status';

  if (!['start', 'stop', 'status'].includes(action)) {
    return res.status(400).json({
      status: 'error',
      message: 'invalid action'
    });
  }

  // Runtime control placeholder.
  // Persistent GitHub config update will be connected through server token.
  // Keep API contract stable for price-test.html.

  const enabled = action === 'start' ? true : action === 'stop' ? false : null;

  return res.status(200).json({
    status: 'ok',
    action,
    enabled,
    message: action === 'status'
      ? 'price service status query'
      : `price service ${action} requested`,
    config: 'stockprice/config/price-config.json'
  });
}
