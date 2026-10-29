import test from 'node:test';import assert from 'node:assert/strict';
import {createOpenAIClient,buildRequest,TOKEN_COUNT_ENDPOINT,ENDPOINT} from '../apps/server/src/providers/openai.js';import {providerConfig} from '../apps/server/src/providers/config.js';import {defaults,clone} from '../shared/contracts/index.js';
const config=providerConfig({GAME_BUILDER_PROVIDER:'openai',OPENAI_API_KEY:'SYNTHETIC_COUNT_KEY'}).publicConfig;
const request={instructions:'Review the supplied bounded game task.',brief:{title:'Count',prompt:'Collect stars',difficulty:'beginner'},context:{plan:clone(defaults.planner)}};
const completion=()=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({kind:'artifact',artifact:defaults.gameplay,question:null,summary:'Synthetic bounded proposal'})}]}],usage:{input_tokens:100,output_tokens:20,total_tokens:120}}));
test('provider counts include the full structured request and reserve maximum output without raising the cap',async()=>{
  let counted=0,generated=0;const reserved=[],audits=[];
  const client=createOpenAIClient('SYNTHETIC_COUNT_KEY',config,{countInputTokens:true,fetchImpl:async(url,options)=>{
    if(url===TOKEN_COUNT_ENDPOINT){counted++;const body=JSON.parse(options.body);assert.ok(body.text.format.schema);assert.ok(body.instructions);assert.ok(body.input);assert.equal(body.max_output_tokens,undefined);return new Response(JSON.stringify({input_tokens:100}));}
    assert.equal(url,ENDPOINT);generated++;return completion();
  }});
  for(let n=0;n<2;n++)await client.generate('gameplay','worker',request,{reserve:async value=>reserved.push(value),onAttempt:async value=>audits.push(value)});
  assert.equal(counted,1);assert.equal(generated,2);assert.deepEqual(reserved,[100+config.maxOutputTokens+512,100+config.maxOutputTokens+512]);assert.ok(audits.every(a=>a.reservationMethod==='provider-count'));
});
test('unavailable input counts retain conservative reservations and do not leak error bodies',async()=>{
  let reservation;const audits=[];
  const client=createOpenAIClient('SYNTHETIC_COUNT_KEY',config,{countInputTokens:true,fetchImpl:async url=>url===TOKEN_COUNT_ENDPOINT?new Response(JSON.stringify({error:{message:'PRIVATE_ERROR_CANARY'}}),{status:503}):completion()});
  await client.generate('gameplay','worker',request,{reserve:async value=>{reservation=value;},onAttempt:async value=>audits.push(value)});
  assert.equal(reservation,buildRequest(config,'gameplay','worker',request).reservation);assert.equal(audits[0].reservationMethod,'byte-upper-bound');assert.ok(!JSON.stringify(audits).includes('PRIVATE_ERROR_CANARY'));
});

test('counted coding reservations include coding headroom on fresh and cached requests',async()=>{
 let count=0;const reserved=[];
 const client=createOpenAIClient('SYNTHETIC_COUNT_KEY',config,{countInputTokens:true,fetchImpl:async(url,options)=>{
  if(url===TOKEN_COUNT_ENDPOINT){count++;return new Response(JSON.stringify({input_tokens:200}));}
  assert.equal(JSON.parse(options.body).max_output_tokens,6144);
  return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({kind:'artifact',artifact:{source:'fixture',scenarios:'[]'},question:null,summary:'count fixture'})}]}],usage:{input_tokens:200,output_tokens:30,total_tokens:230}}));
 }});
 for(let n=0;n<2;n++)await client.generate('coding','worker',{instructions:'fixture',brief:{genre:'custom'},context:{}},{reserve:async value=>reserved.push(value)});
 assert.equal(count,1);assert.deepEqual(reserved,[200+6144+512,200+6144+512]);
});
