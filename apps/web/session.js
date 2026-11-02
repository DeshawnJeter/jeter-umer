// API helpers retain their existing contracts. The browser never receives a model key.
const nativeFetch=window.fetch.bind(window);
const info=await nativeFetch('/auth/session').then(response=>response.ok?response.json():null);
if(info?.required){
 if(!info.authenticated)location.replace('/signin');
 else{
  window.fetch=async(input,options={})=>{const url=new URL(typeof input==='string'?input:input.url,location.href);const method=(options.method||input.method||'GET').toUpperCase();if(url.origin===location.origin&&!['GET','HEAD'].includes(method)){const headers=new Headers(options.headers||input.headers);headers.set('X-Workshop-CSRF',info.csrf);options={...options,headers};}const response=await nativeFetch(input,options);if(url.origin===location.origin&&response.status===401)location.replace('/signin');return response;};
  const button=document.createElement('button');button.textContent='Sign out';button.addEventListener('click',async()=>{const response=await window.fetch('/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(response.ok)location.replace('/signin');});document.querySelector('header')?.append(button);
  const allowance=document.createElement('p');document.querySelector('header')?.append(allowance);const update=async()=>{try{const response=await window.fetch('/api/usage');if(!response.ok)return;const value=await response.json();allowance.textContent=`Team allowance today: ${value.used.calls} / ${value.limits.dailyCalls} model requests · ${value.used.tokens.toLocaleString()} / ${value.limits.dailyTokens.toLocaleString()} tokens. Total: ${value.totalTokens.toLocaleString()} / ${value.limits.totalTokens.toLocaleString()} tokens.`;}catch{allowance.textContent='Team usage is temporarily unavailable.';}};await update();setInterval(update,30000);
 }
}
