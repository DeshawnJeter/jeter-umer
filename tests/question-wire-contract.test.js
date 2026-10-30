import test from 'node:test';
import assert from 'node:assert/strict';
import { questionSchema, decodeProviderOutput } from '../apps/server/src/providers/schemas.js';
import { normalizeQuestion, validateAnswer } from '../shared/contracts/questions.js';
import { repairInstruction } from '../apps/server/src/providers/output-errors.js';
import { createOpenAIClient, buildRequest } from '../apps/server/src/providers/openai.js';
import { providerConfig } from '../apps/server/src/providers/config.js';

const question = {key:'planner.settings',text:'Which settings should apply?',reason:'The selected collector settings conflict with the requested lantern rules.',options:['Use form settings','Use prompt settings'],recommended:'Use prompt settings',blocking:true,affectedRoles:['planner'],maxLength:500};
const worker = q => ({kind:'question',artifact:null,question:q,summary:'Resolve conflicting settings before planning.'});

test('wire schema gives models the human-question bounds before the first call',()=>{
  const p=questionSchema.properties;
  assert.equal(p.key.maxLength,80); assert.equal(p.text.maxLength,400);assert.equal(p.reason.maxLength,600);
  assert.equal(p.options.maxItems,6);assert.equal(p.options.items.maxLength,100);
  assert.equal(p.maxLength.minimum,1);assert.equal(p.maxLength.maximum,1000);assert.deepEqual(p.blocking.enum,[true]);
  assert.ok(new RegExp(p.options.items.pattern).test('Use prompt settings'));
  for(const option of [' padded','padded ','','\n'])assert.equal(new RegExp(p.options.items.pattern).test(option),false);
  assert.match(p.recommended.description,/exactly/);assert.match(p.options.description,/Unique/);
});

test('valid model questions remain human-answerable in both worker and checker paths',()=>{
  for(const stage of ['worker','checker']){
    const value=stage==='worker'?worker(question):{review:{verdict:'needs_human',findings:[],evidence:['Compared selected settings with the request.'],question}};
    const decoded=decodeProviderOutput('planner',stage,value);
    assert.equal(validateAnswer(normalizeQuestion(decoded.question,'planner',stage),question.recommended),question.recommended);
  }
  assert.doesNotThrow(()=>decodeProviderOutput('planner','worker',worker({...question,options:[],recommended:'',maxLength:500})));
});

test('wire and local validation reject invalid bounds and relational question errors',()=>{
  for(const change of [{key:'Planner Settings'},{key:'planner.constructor'},{text:' '},{reason:'x'.repeat(601)},{options:[' padded']},{options:['same','same'],recommended:'same'},{recommended:'Another option'},{maxLength:0},{maxLength:1001},{maxLength:2},{blocking:false},{affectedRoles:['unknown']}]){
    assert.throws(()=>decodeProviderOutput('planner','worker',worker({...question,...change})));
  }
  const instruction=repairInstruction('question');
  assert.match(instruction,/maxLength an integer 1–1000/);assert.match(instruction,/exact offered option/);assert.match(instruction,/Do not invent human answers/);
});

test('bounded question repair preserves the request and returns a question, never an invented answer',async()=>{
  const config=providerConfig({GAME_BUILDER_PROVIDER:'openai',OPENAI_API_KEY:'SYNTHETIC_TEST'}).publicConfig;
  const bodies=[],audits=[],finishes=[];
  const request={instructions:'Plan the selected game. Ask about conflicting settings.',brief:{title:'My Adventure',genre:'collector',difficulty:'experienced',prompt:'Make Moonbrook Lanterns with custom rules.'},context:{decisions:{}},task:{role:'planner'},findings:[]};
  const client=createOpenAIClient('SYNTHETIC_TEST',config,{fetchImpl:async(_,options)=>{
    bodies.push(JSON.parse(options.body));const value=worker(bodies.length===1?{...question,options:['same','same'],recommended:'same'}:question);
    return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}],usage:{input_tokens:100,output_tokens:50,total_tokens:150}}));
  }});
  const result=await client.generate('planner','worker',request,{onAttempt:a=>audits.push(a),finish:usage=>finishes.push(usage)});
  assert.deepEqual(result.question,question);assert.equal(result.artifact,undefined);
  assert.equal(bodies.length,2);assert.equal(finishes.length,2);assert.deepEqual(bodies[1].input,bodies[0].input);
  assert.equal(audits[0].code,'question');assert.equal(audits[1].outcome,'accepted');
  assert.match(bodies[1].instructions,/maxLength an integer/);
  const wire=buildRequest(config,'planner','worker',request).body.text.format.schema.properties.question.anyOf[0];
  assert.equal(wire.properties.maxLength.minimum,1);
});
