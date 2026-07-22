import { getUserFromReq, sendJson, handleOptions } from './_lib/auth-utils.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  const user = getUserFromReq(req);
  sendJson(res, { ok: !!user, user: user || null });
}
