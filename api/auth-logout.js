import { sendJson, handleOptions } from './_lib/auth-utils.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  sendJson(res, { ok: true });
}
