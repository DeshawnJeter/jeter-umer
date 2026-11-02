// A feature registers only after its worker, checker and runtime are shipped.
export const EXTENSION_SPECS={};
export const CORE_ROLES=['planner','gameplay','levels','ui','story','audio'];
export function activeRoles(genre='collector'){
  if(genre==='custom')return ['planner','ui','story','audio','coding','integration','qa'];
  if(['campaign','roguelike'].includes(genre))return ['planner','combat','progression','art','ui','story','audio','integration','qa'];
  return [...CORE_ROLES,...Object.entries(EXTENSION_SPECS).filter(([,s])=>s.genres==='all'||s.genres.includes(genre)).map(([role])=>role)];
}
export function dependenciesFor(role,genre='collector'){
  const roles=activeRoles(genre),has=value=>roles.includes(value);
  if(!roles.includes(role))throw Error('Inactive specialist');
  if(role==='planner')return [];
  if(['implementation','integration','qa'].includes(role))return roles.filter(r=>r!==role&&!({implementation:['integration','qa'],integration:['qa'],qa:[]}[role]).includes(r));
  const extras={coding:['gameplay','ui'],vfx:['ui'],gameplay:['combat','progression','enemies'],levels:['gameplay'],ui:['art','combat','progression']}[role]||[];
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
    else valid=typeof v===rule.type&&(!rule.maxLength||v.length<=rule.maxLength)&&(!rule.enum||rule.enum.includes(v))&&(!rule.pattern||new RegExp(rule.pattern).test(v));
    if(!valid)errors.push(`Invalid ${role}.${key}`);
  }
  return errors;
}

EXTENSION_SPECS.combat={"genres":["rpg","front_battle","campaign","roguelike"],"job":"Design bounded party combat. Choose attackPower 2–5, spellPower 4–8, spellCost 1–3 and enemyDamage 1–3. Preserve the party template and avoid unsupported mechanics.","fields":{"attackPower":{"type":"integer","default":3,"min":2,"max":5},"spellPower":{"type":"integer","default":6,"min":4,"max":8},"spellCost":{"type":"integer","default":2,"min":1,"max":3},"enemyDamage":{"type":"integer","default":2,"min":1,"max":3}}};

EXTENSION_SPECS.progression={"genres":["rpg","front_battle","campaign","roguelike"],"job":"Design the shared potion inventory and one reachable level-up. Choose startingPotions 1–6, potionHealing 3–8, xpPerEncounter 10–15, levelTwoAt 15–30, levelHeal 2–6. Threshold must be at most three encounter rewards. No shops or arbitrary equipment.","fields":{"startingPotions":{"type":"integer","default":3,"min":1,"max":6},"potionHealing":{"type":"integer","default":6,"min":3,"max":8},"xpPerEncounter":{"type":"integer","default":10,"min":10,"max":15},"levelTwoAt":{"type":"integer","default":20,"min":15,"max":30},"levelHeal":{"type":"integer","default":4,"min":2,"max":6}}};

EXTENSION_SPECS.enemies={"genres":["stealth","run_gun","jump_shooter","metroidvania"],"job":"Tune enemy behavior using patrolSpeed 30–80, chaseSpeed 80–140 (not slower than patrol), visionRange 120–240, alertRate 20–60 and fireInterval 0.8–2 seconds. Only the selected template uses applicable parameters. Choose archetypeMix mixed/sentries/rushers, telegraphMs 500–1000, attackCooldown 1–2.5 seconds, retreatAt 0.2–0.5. Attacks must announce before damage; respect walls and the trusted state machine.","fields":{"patrolSpeed":{"type":"integer","default":58,"min":30,"max":80},"chaseSpeed":{"type":"integer","default":110,"min":80,"max":140},"visionRange":{"type":"integer","default":210,"min":120,"max":240},"alertRate":{"type":"integer","default":42,"min":20,"max":60},"fireInterval":{"type":"number","default":1.2,"min":0.8,"max":2},"archetypeMix":{"type":"string","default":"mixed","enum":["mixed","sentries","rushers"]},"telegraphMs":{"type":"integer","default":650,"min":500,"max":1000},"attackCooldown":{"type":"number","default":1.4,"min":1,"max":2.5},"retreatAt":{"type":"number","default":0.3,"min":0.2,"max":0.5}}};

EXTENSION_SPECS.art={"genres":"all","job":"Tune original procedural scenery and animation using particleCount 0–24 and animationMs 800–3000. The existing UI specialist owns colors/theme/HUD. No external images, copied characters or code.","fields":{"battleBackdrop":{"type":"string","default":"themed","enum":["themed","forest","space","neon","ruins","cavern"]},"particleCount":{"type":"integer","default":12,"min":0,"max":24},"animationMs":{"type":"integer","default":1400,"min":800,"max":3000}}};

EXTENSION_SPECS.implementation={"genres":"all","job":"Assemble the gameplay implementation from trusted modules. Copy the exact supplied artifactReference runtime, modules and version. The compiler generates a data-only assembly module; no arbitrary source, paths or scripts are accepted.","fields":{"runtime":{"type":"string","default":"collector","enum":["collector","maze","platformer","survival","custom","roguelike","campaign","rpg","front_battle","stealth","run_gun","jump_shooter","metroidvania"]},"modules":{"type":"array","default":["movement","hud","settings","audio","failure-state","game-events","vfx"],"enum":["movement","hud","settings","audio","failure-state","game-events","vfx","turn-combat","party-items","patrols","vision","projectiles","ability-gates","checkpoints","jump"]},"version":{"type":"integer","default":1,"min":1,"max":1}}};

EXTENSION_SPECS.integration={"genres":"all","job":"Review the assembled checked contributions. Copy status ready and the exact supplied artifactReference manifestHash. Never accept stale dependencies or claim browser execution.","fields":{"status":{"type":"string","default":"ready","enum":["ready"]},"manifestHash":{"type":"string","default":"0000000000000000000000000000000000000000000000000000000000000000","pattern":"^[a-f0-9]{64}$"}}};

EXTENSION_SPECS.qa={"genres":"all","job":"Review actual trusted rule-test evidence and checked artifacts. Copy artifactReference scope, passed and evidenceHash only when supplied checks pass. Scope is rules-and-static; never claim browser testing, listening, or human approval.","fields":{"scope":{"type":"string","default":"rules-and-static","enum":["rules-and-static"]},"passed":{"type":"boolean","default":true},"evidenceHash":{"type":"string","default":"0000000000000000000000000000000000000000000000000000000000000000","pattern":"^[a-f0-9]{64}$"}}};

EXTENSION_SPECS.vfx={"genres":"all","job":"Respond to immutable gameplay events with bounded hit flashes, spell impacts, explosions, shot trails and camera shake. Choose enabled, maxParticles 0–96, particlesPerBurst 0–12, shake 0–0.006, flashMs 0–120. Bursts must fit the pool. Never modify combat, MP, inventory or warnings; reduced-effects settings take priority.","fields":{"enabled":{"type":"boolean","default":true},"maxParticles":{"type":"integer","default":48,"min":0,"max":96},"particlesPerBurst":{"type":"integer","default":6,"min":0,"max":12},"shake":{"type":"number","default":0.003,"min":0,"max":0.006},"flashMs":{"type":"integer","default":80,"min":0,"max":120}}};

EXTENSION_SPECS.coding={genres:['custom'],job:'Write original JavaScript game rules for the approved prompt using the supplied componentCatalog. Return source and scenarios. Export createGame(api) with start, update(dt,input), inspect. No imports, DOM, network or host access. Include bounded winning and losing input replay scenarios. Do not copy the example when it fails the prompt. Test evidence is computed independently; never invent execution.',fields:{source:{type:'string',default:'',maxLength:6000},scenarios:{type:'string',default:'',maxLength:6000}}};
