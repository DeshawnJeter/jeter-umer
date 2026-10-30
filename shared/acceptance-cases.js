const actions=['left','right','up','down','jump','attack','ability','interact'];
export function validateAcceptanceCases(cases){
 if(!Array.isArray(cases)||cases.length>8)throw Error('At most eight independent tests');
 for(const c of cases){
  if(typeof c.name!=='string'||!c.name.trim()||c.name.length>80||!Array.isArray(c.steps)||!c.steps.length||c.steps.length>300||!Array.isArray(c.assertions)||!c.assertions.length||c.assertions.length>8)throw Error('Invalid independent test');
  let frames=0;for(const s of c.steps){if(!Number.isFinite(s.dt)||s.dt<0||s.dt>0.1||!Number.isInteger(s.repeat)||s.repeat<1||s.repeat>300||!Array.isArray(s.actions)||s.actions.some(a=>!actions.includes(a)))throw Error('Invalid independent input replay');frames+=s.repeat;}if(frames>300)throw Error('Independent replay exceeds 300 frames');
  for(const a of c.assertions){if(!['health','score','phase','nodes'].includes(a.field)||!['eq','gte','lte'].includes(a.op))throw Error('Invalid independent assertion');if(a.field==='phase'?(a.op!=='eq'||!['ready','playing','won','lost'].includes(a.value)):(!Number.isFinite(a.value)||a.value<0||a.value>100000))throw Error('Invalid assertion value');}
 }
 return structuredClone(cases);
}
