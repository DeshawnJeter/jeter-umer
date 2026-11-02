import {isAbsolute,resolve} from 'node:path';
export function integer(env,key,fallback,min=1,max=1000000000){const n=Number(env[key]??fallback);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(`Invalid ${key}`);return n;}
export function deploymentConfig(env=process.env){
 const hosted=env.NODE_ENV==='production',enabled=hosted||env.WORKSHOP_AUTH==='on';
 const port=integer(env,'PORT',3000,1024,65535),previewPort=integer(env,'GAME_BUILDER_CODE_PREVIEW_PORT',port>65400?port-100:port+100,1024,65535);
 function origin(key,fallback){const value=env[key]||fallback,url=new URL(value);if(url.origin!==value||url.username||url.password||hosted&&url.protocol!=='https:')throw Error(`Invalid ${key}: use an exact HTTPS origin without a trailing slash`);return value;}
 const appOrigin=origin('WORKSHOP_PUBLIC_ORIGIN',`http://127.0.0.1:${port}`),previewOrigin=origin('WORKSHOP_PREVIEW_ORIGIN',`http://127.0.0.1:${previewPort}`);
 if(appOrigin===previewOrigin||previewPort===port)throw Error('Workshop and preview origins must be separate');
 if(hosted&&new URL(appOrigin).hostname===new URL(previewOrigin).hostname)throw Error('Production preview requires a different hostname so workshop cookies cannot reach games');
 if(hosted&&(!env.WORKSHOP_PUBLIC_ORIGIN||!env.WORKSHOP_PREVIEW_ORIGIN))throw Error('Production requires both public origins');
 const root=resolve(env.WORKSHOP_DATA_DIR||'.local/hosted-workshop');
 if(hosted&&(!env.WORKSHOP_DATA_DIR||!isAbsolute(env.WORKSHOP_DATA_DIR)))throw Error('Production requires an absolute persistent WORKSHOP_DATA_DIR');
 if(enabled&&(!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(env.WORKSHOP_PASSWORD_HASH||'')||(env.WORKSHOP_SESSION_SECRET||'').length<32))throw Error('Configure a password hash and a session secret of at least 32 characters');
 if(hosted&&env.GAME_BUILDER_BROWSER_QA!=='on')throw Error('Production requires browser QA');
 return Object.freeze({hosted,enabled,port,previewPort,appOrigin,previewOrigin,root,host:hosted?'0.0.0.0':'127.0.0.1',passwordHash:env.WORKSHOP_PASSWORD_HASH,secret:env.WORKSHOP_SESSION_SECRET,
  dailyCalls:integer(env,'WORKSHOP_DAILY_CALL_LIMIT',100),dailyTokens:integer(env,'WORKSHOP_DAILY_TOKEN_LIMIT',500000),totalTokens:integer(env,'WORKSHOP_TOTAL_TOKEN_LIMIT',2000000),
  maxSessions:integer(env,'WORKSHOP_MAX_SESSIONS',20,1,100),sessionSeconds:integer(env,'WORKSHOP_SESSION_SECONDS',28800,300,86400),
  maxDataBytes:integer(env,'WORKSHOP_MAX_DATA_BYTES',250000000,1000000,100000000000),maxRuns:integer(env,'WORKSHOP_MAX_RUNS',100,1,10000),maxProjects:integer(env,'WORKSHOP_MAX_PROJECTS',100,1,10000)});
}
