import {isModelProvider} from '../../../../shared/providers.js';
import {activeRoles} from '../../../../shared/specialists.js';
const rates={'claude-sonnet-5-5':[2,10],'claude-opus-5-5':[4,20],'gpt-6-astra':[10,50],'gpt-6.1-sol':[2,10],'gpt-6.1-terra':[1,5],'gpt-6-luna':[0.1,0.5]};
export function buildBudget(config,data={}){
 if(!isModelProvider(config.mode))return null;const result={maxCalls:config.maxCalls,maxTotalTokens:config.maxTotalTokens};
 for(const key of Object.keys(result))if(data[key]!==undefined){if(!Number.isInteger(data[key])||data[key]<(key==='maxCalls'?1:2000)||data[key]>config[key])throw Error('Requested '+key+' must stay within the server limit');result[key]=data[key];}
 return result;
}
export function estimateBuild(config,brief){
 if(!isModelProvider(config.mode))return {calls:0,estimatedDollars:0,note:'Demo mode makes no model calls.'};
 const roles=activeRoles(brief.genre),jobs=roles.flatMap(role=>['worker','checker'].map(stage=>({role,stage})));if(brief.inputMode==='prompt')jobs.push({role:'planner',stage:'worker'},{role:'planner',stage:'checker'});
 let cost=0,known=true;for(const {role,stage}of jobs){const rate=rates[config.models[role][stage]];if(!rate){known=false;continue;}cost+=(2000*rate[0]+(role==='coding'&&stage==='worker'?3000:1000)*rate[1])/1e6;}
 return {calls:jobs.length,estimatedDollars:known?Math.round(cost*10000)/10000:null,pricingDate:'2026-10-30',assumptions:'Illustrative first-pass estimate: 2000 input tokens/request, 1000 output (3000 for coding). Excludes repairs, tools, escalations and caching; actual cost can differ. Prompt-only routing may change the required roles. Call/token limits are enforced; this estimate is not a dollar billing cap.'};
}
