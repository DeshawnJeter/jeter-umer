import test from 'node:test';import assert from 'node:assert/strict';import {providerConfig} from './fixtures/legacy-provider.js';import {buildRequest} from './fixtures/legacy-provider.js';
import {loadProfile,instructionBundle} from '../apps/server/src/runners/instructions.js';import {DEFAULT_SOURCE} from '../shared/code-game.js';
test('fixed wire schemas do not consume task context but full byte and token limits remain enforced',()=>{
 const config=providerConfig({GAME_BUILDER_PROVIDER:'openai',OPENAI_API_KEY:'synthetic'}).publicConfig;
 const req={instructions:'Keep every instruction and decision.',brief:{title:'Game',genre:'collector',prompt:'Preserve all original mechanics.',difficulty:'beginner'},context:{decisions:{direction:'Moonbrook'}},artifact:{speed:190,timeLimit:60}};
 const first=buildRequest(config,'gameplay','checker',req),limit=first.contextChars+10;assert.ok(first.serialized.length>limit);
 const focused=buildRequest(config,'gameplay','checker',{...req,limits:{maxContextChars:limit}});assert.equal(focused.body.instructions,first.body.instructions);assert.equal(focused.body.input[0].content[0].text,first.body.input[0].content[0].text);assert.ok(focused.reservation>Buffer.byteLength(focused.serialized));
 assert.throws(()=>buildRequest(config,'gameplay','checker',{...req,limits:{maxContextChars:first.contextChars-1}}),/context limit/);
 assert.throws(()=>buildRequest({...config,maxRequestBytes:100},'gameplay','checker',req),/context limit/);
});
test('a small incremental source stays complete even when tool/schema overhead exceeds the task bound',async()=>{
 const config=providerConfig({GAME_BUILDER_PROVIDER:'openai',OPENAI_API_KEY:'synthetic'}).publicConfig,bundle=await instructionBundle('coding','worker',await loadProfile('coding'),{genre:'custom'});
 const source=DEFAULT_SOURCE+'/*'+'existing mechanics '.repeat(80)+'*/',request={...bundle,brief:{title:'Project',genre:'custom',difficulty:'beginner',prompt:'Preserve requirements. '.repeat(45)},context:{previousSource:source,unresolvedFeedback:[{title:'Visible hint',expected:'Keep these instructions. '.repeat(25)}]},tools:{read_source(){},search_source(){},apply_source_patch(){},inspect_components(){},run_rule_checks(){}}};
 const prepared=buildRequest(config,'coding','worker',request),data=JSON.parse(prepared.body.input[0].content[0].text);assert.ok(prepared.contextChars<=16000);assert.equal(data.context.previousSource,source);assert.equal(data.context.sourceReference,undefined);assert.equal(prepared.body.text.format.schema.properties.artifact.anyOf[0].properties.source.enum,undefined);assert.equal(prepared.body.tool_choice,'auto');
});
