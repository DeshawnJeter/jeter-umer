// A feature registers only after its worker, checker and runtime are shipped.
export const EXTENSION_SPECS={};
export const CORE_ROLES=['planner','gameplay','levels','ui','story','audio'];
export function activeRoles(genre='collector'){
  return [...CORE_ROLES,...Object.entries(EXTENSION_SPECS).filter(([,s])=>s.genres==='all'||s.genres.includes(genre)).map(([role])=>role)];
}
export function dependenciesFor(role,genre='collector'){
  const roles=activeRoles(genre),has=value=>roles.includes(value);
  if(!roles.includes(role))throw Error('Inactive specialist');
  if(role==='planner')return [];
  if(['implementation','integration','qa'].includes(role))return roles.filter(r=>r!==role&&!({implementation:['integration','qa'],integration:['qa'],qa:[]}[role]).includes(r));
  const extras={gameplay:['combat','progression','enemies'],levels:['gameplay'],ui:['art','combat','progression']}[role]||[];
  return ['planner',...extras.filter(has)];
}
export function extensionDefaults(role){return Object.fromEntries(Object.entries(EXTENSION_SPECS[role].fields).map(([key,spec])=>[key,structuredClone(spec.default)]));}
export function extensionErrors(role,value){
  const spec=EXTENSION_SPECS[role],errors=[];if(!spec||!value||typeof value!=='object'||Array.isArray(value))return ['Invalid specialist artifact'];
  if(Object.keys(value).sort().join()!==Object.keys(spec.fields).sort().join())errors.push('Unexpected or missing specialist artifact fields');
  for(const [key,rule]of Object.entries(spec.fields)){
    const v=value[key];let valid;
    if(rule.type==='number'||rule.type==='integer')valid=Number.isFinite(v)&&(rule.type!=='integer'||Number.isInteger(v))&&v>=rule.min&&v<=rule.max;
    else if(rule.type==='array')valid=Array.isArray(v)&&v.length<=16&&new Set(v).size===v.length&&v.every(item=>typeof item==='string'&&rule.enum.includes(item));
    else valid=typeof v===rule.type&&(!rule.enum||rule.enum.includes(v))&&(!rule.pattern||new RegExp(rule.pattern).test(v));
    if(!valid)errors.push(`Invalid ${role}.${key}`);
  }
  return errors;
}

EXTENSION_SPECS.combat={"genres":["rpg","front_battle"],"job":"Design bounded party combat. Choose attackPower 2–5, spellPower 4–8, spellCost 1–3 and enemyDamage 1–3. Preserve the party template and avoid unsupported mechanics.","fields":{"attackPower":{"type":"integer","default":3,"min":2,"max":5},"spellPower":{"type":"integer","default":6,"min":4,"max":8},"spellCost":{"type":"integer","default":2,"min":1,"max":3},"enemyDamage":{"type":"integer","default":2,"min":1,"max":3}}};
