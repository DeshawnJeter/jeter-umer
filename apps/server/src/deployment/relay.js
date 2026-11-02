import {timingSafeEqual} from 'node:crypto';

export function trustedPreviewRelay(req, secret) {
  const supplied = req.headers['x-workshop-preview-relay'];
  if(typeof secret !== 'string' || secret.length < 32 || typeof supplied !== 'string' || supplied.length > 256 || req.method !== 'GET' || !req.url?.startsWith('/play/')) return false;
  const a = Buffer.from(secret), b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a,b);
}
