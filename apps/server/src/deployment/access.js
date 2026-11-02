import {failure} from './control.js';
export function securityHeaders(res,config,{preview=false,worker=false}={}){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=()');
 if(config.hosted)res.setHeader('Strict-Transport-Security','max-age=31536000');
 const origin=config.previewOrigin;
 res.setHeader('Content-Security-Policy',preview?`default-src 'none'; script-src ${origin}; style-src ${origin} 'unsafe-inline'; connect-src ${worker?"'none'":origin}; worker-src ${worker?"'none'":origin}; img-src ${origin} data: blob:; media-src ${origin} blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${config.appOrigin}`:`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-src ${origin}; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`);
}
export class RateLimit {
 constructor({now=()=>Date.now(),limit=120,interval=60000}={}){this.now=now;this.limit=limit;this.interval=interval;this.times=[];}
 take(){this.times=this.times.filter(t=>t>this.now()-this.interval);if(this.times.length>=this.limit)throw failure(429,'Request limit reached. Try again shortly.');this.times.push(this.now());}
}
export function requireOrigin(req,config){if(req.headers.origin!==config.appOrigin||req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin')throw failure(403,'Origin rejected');}
export function authorize(req,config,control){const session=control.session(req);if(!session)throw failure(401,'Sign in to the workshop');if(!['GET','HEAD'].includes(req.method)){requireOrigin(req,config);if(req.headers['x-workshop-csrf']!==session.csrf)throw failure(403,'Session verification failed');}return session;}
export const SIGNIN_HTML='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Game Workshop</title><link rel="stylesheet" href="/style.css"></head><body><main><h1>Team Game Workshop</h1><p>This workshop is private. Use your team password to continue.</p><form id="signin"><label>Team password<input id="password" name="password" type="password" autocomplete="current-password" minlength="16" maxlength="128" required></label><button>Sign in</button></form><p id="error" role="alert"></p></main><script type="module" src="/signin.js"></script></body></html>';
