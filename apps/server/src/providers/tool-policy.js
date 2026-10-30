import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
const categories={inspect_components:'reads',read_source:'reads',search_source:'reads',apply_source_patch:'edits',run_rule_checks:'tests'};
export const toolCategory=name=>categories[name];
export function toolStateFor(request){
 if(request.toolState)return structuredClone(request.toolState);
 const existing=!!(request.context?.previousSource||request.context?.sourceReference);
 const repair=existing&&!!(request.findings?.length||request.context?.unresolvedFeedback?.length);
 const kind=repair?'repair':!existing?'new_mechanic':request.context?.changeRequest?'feature_change':'small_change';
 const base=kind==='small_change'?4:6;
 return {kind,base,max:repair?8:base,extended:false,counts:{reads:0,edits:0,tests:0},progress:0,seenSources:[],lastFailure:null,lastFailureCategory:null,repeatedFailures:0,testBaselines:{},stopReason:null};
}
export function toolBudget(request){
 const state=toolStateFor(request),actions=state.counts.edits+state.counts.tests,limit=state.extended?state.max:state.base;
 const stopReason=state.stopReason||(actions>=limit?'action_limit':null);
 return {kind:state.kind,used:{...state.counts},readLimit:4,actionLimit:limit,maxActions:state.max,extended:state.extended,stopReason};
}
export function allowedToolNames(request){
 const budget=toolBudget(request);if(budget.stopReason)return [];
 const {reads,edits,tests}=budget.used,actions=edits+tests;
 return Object.keys(request.tools||{}).filter(name=>{
  const category=toolCategory(name);
  if(category==='reads')return reads<budget.readLimit;
  if(category==='edits')return actions<budget.actionLimit-1;
  return category==='tests'&&actions<budget.actionLimit;
 });
}
export function recordToolResult(request,call,result,{beforeSource='',afterSource=''}={}){
 const state=toolStateFor(request),category=toolCategory(call.name);
 if(!allowedToolNames(request).includes(call.name))throw Error('Coding tool round limit or role boundary exceeded');
 state.counts[category]++;
 let suite,progress=false,success=category==='reads'||(category==='edits'?result.verdict==='pass':result.passed===true&&Array.isArray(result.tests)&&result.tests.length>0&&result.tests.every(test=>test.passed));
 if(category==='edits'&&success){
  const before=hash(beforeSource),after=hash(afterSource);
  if(!state.seenSources.length)state.seenSources.push(before);
  progress=before!==after&&!state.seenSources.includes(after);
  if(!state.seenSources.includes(after))state.seenSources.push(after);
 }
 if(category==='tests'){
  // A different or weakened test suite cannot claim fewer failures as progress.
  try{suite=hash(JSON.stringify(JSON.parse(JSON.parse(call.arguments).scenarios)));}catch{suite=hash(call.arguments);}
  const failed=(result.tests||[]).filter(test=>!test.passed);
  const coverage=hash(JSON.stringify((result.tests||[]).map(test=>test.name).sort())),key=suite+coverage;
  const count=failed.length||(!success?1:0),baseline=state.testBaselines[key];
  if(baseline!==undefined&&count<baseline)progress=true;
  state.testBaselines[key]=baseline===undefined?count:Math.min(baseline,count);
  if(success)state.stopReason='checks_passed';
 }
 if(progress){state.progress++;if(category==='tests'||state.lastFailureCategory==='edits'){state.lastFailure=null;state.repeatedFailures=0;}}
 if(category!=='reads'&&!success){
  const signature=hash(JSON.stringify({name:call.name,...(category==='tests'?{suite}:{}),failures:result.tests?.filter(test=>!test.passed).map(test=>({name:test.name,error:test.error})),findings:result.findings,error:result.error}));
  state.repeatedFailures=state.lastFailure===signature?state.repeatedFailures+1:1;state.lastFailure=signature;state.lastFailureCategory=category;
  if(state.repeatedFailures>=2)state.stopReason='repeated_failure';
 }
 const actions=state.counts.edits+state.counts.tests;
 if(!state.stopReason&&!state.extended&&state.max>state.base&&actions>=state.base-1&&progress)state.extended=true;
 return {state,audit:{name:call.name,category,success,progress,...toolBudget({toolState:state})}};
}
