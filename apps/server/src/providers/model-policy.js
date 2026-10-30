const S='claude-sonnet-5-5',H='claude-haiku-5-5';
export const ROLE_MODELS=Object.freeze({planner:[S,S],coding:[S,S],gameplay:[H,S],combat:[S,S],enemies:[S,S],levels:[H,S],progression:[S,S],ui:[S,S],art:[S,S],vfx:[H,S],story:[S,H],audio:[H,H],implementation:[S,S],integration:[S,S],qa:[S,S]});
export function selectModel(config,role,stage,request){
 let model=config.models[role][stage],escalated=false;
 if(config.escalation?.enabled&&role==='coding'&&stage==='worker'&&(request.attempt||1)>=config.escalation.afterAttempt&&request.findings?.length){model=config.escalation.model;escalated=true;}
 const effort=/^claude-(sonnet|haiku|opus)-5-5(?:-|$)/.test(model)?(escalated?'high':['planner','coding','combat','enemies','progression','integration','qa','implementation'].includes(role)?'medium':'low'):undefined;
 return {model,escalated,...(effort?{effort}:{})};
}
