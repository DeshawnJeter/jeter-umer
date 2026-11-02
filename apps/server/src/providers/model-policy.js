const SOL='gpt-6.1-sol',TERRA='gpt-6.1-terra',LUNA='gpt-6-luna';
export const ROLE_MODELS=Object.freeze({planner:[SOL,SOL],coding:[SOL,SOL],gameplay:[LUNA,LUNA],combat:[LUNA,SOL],enemies:[LUNA,SOL],levels:[LUNA,SOL],progression:[LUNA,SOL],ui:[TERRA,TERRA],art:[TERRA,TERRA],vfx:[LUNA,TERRA],story:[TERRA,LUNA],audio:[LUNA,LUNA],implementation:[SOL,SOL],integration:[SOL,SOL],qa:[SOL,SOL]});
export function selectModel(config,role,stage,request){
 let model=config.models[role][stage],escalated=false;
 if(config.escalation?.enabled&&role==='coding'&&stage==='worker'&&(request.attempt||1)>=config.escalation.afterAttempt&&request.findings?.length){model=config.escalation.model;escalated=true;}
 const reasoning=/^gpt-6(?:\.1)?-(?:astra|sol|terra|luna)(?:-|$)/.test(model)?{effort:escalated?'high':(['coding','planner','qa','integration'].includes(role)?'medium':'low')}:undefined;
 return {model,escalated,...(reasoning?{reasoning}:{})};
}
