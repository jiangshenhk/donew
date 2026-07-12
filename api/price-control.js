// Stock price service control API
// Note: control state is stored in stockprice/config/price-config.json
// This endpoint provides the control contract for the frontend.

export default async function handler(req, res) {
  const action = req.query?.action || 'status';

  if (!['start', 'stop', 'status'].includes(action)) {
    return res.status(400).json({
      status: 'error',
      message: 'invalid action'
    });
  }

  // Placeholder until persistent storage is connected.
  // The next step will connect this to the config store.
  return res.status(200).json({
    status: 'ok',
    action,
    message: `price service ${action}`,
    note: 'control persistence will be connected to stockprice config'
  });
}
