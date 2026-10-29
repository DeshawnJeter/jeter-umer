import { validateBrief } from './contracts/index.js';
import {GAME_TYPES} from './game-types.js';
export const SETTING_KEYS = ['title','genre','theme','difficulty','music','musicStyle','musicInstrument'];
export const PROMPT_DEFAULTS = Object.freeze({title:'My Prompt Game',genre:'collector',theme:'space',difficulty:'beginner',music:false,musicStyle:'adventure',musicInstrument:'auto'});
const unsupportedPatterns = [
  [/\b(rpg|role[- ]playing|turn[- ]based)\b|\b(?:like|inspired by|similar to)\s+(?:(?:the\s+)?original\s+)?(?:final fantasy|dragon warrior)\b/i,'RPG battles require the party RPG or front-view battle template.',['rpg','front_battle','campaign']],
  [/\bstealth\b|\b(?:like|inspired by|similar to)\s+(?:(?:the\s+)?original\s+)?metal gear\b/i,'Stealth requires the stealth mission template.',['stealth']],
  [/\b(?:shoot(?:ing|er)?|projectiles?|weapons?)\b|\b(?:like|inspired by|similar to)\s+(?:(?:the\s+)?original\s+)?(?:contra|mega\s?man)\b/i,'Shooting requires a shooter or exploration template.',['run_gun','jump_shooter','metroidvania']],
  [/\bmetroidvania\b/i,'Ability-gated exploration requires the metroidvania template.',['metroidvania']],
  [/\b(?:3d|first[- ]person exploration)\b/i,'3D and first-person exploration are not supported.'],
  [/\binventory\b/i,'Inventory is limited to party potions in the RPG/battle templates.',['rpg','front_battle','campaign']],
  [/\bcrafting\b/i,'Crafting is not supported.'],
  [/\bboss(?:es)?\b/i,'Boss encounters require an RPG or shooter template.',['rpg','front_battle','run_gun','jump_shooter']],
  [/\bmultiplayer\b/i,'Multiplayer is not supported.']
];
export function featureRequestText(prompt) {
  let text=prompt.replace(/\b(?:title(?:d)?|name(?:d)?|called)\s*:?\s*["“][^"”]*["”]/gi,' ').replace(/\b(?:title(?:d)?|name(?:d)?|called)\s*:?\s*'[^']*'/gi,' ');
  text=text.replace(/\b(?:title|name)\s*:\s*[^\n;.]+/gi,' ');
  // Remove negative clauses/lists, but retain a later positive instruction such
  // as "no shooting, but add stealth". This is a conservative lexical backstop;
  // the independent model still reviews the original, unmodified prompt.
  text=text.replace(/\b(?:do\s+not\s+(?:include|add|use|enable|implement|want)|don't\s+(?:include|add|use|enable|implement|want)|never\s+(?:include|add|use|enable|implement)|without|no|avoid|not\s+(?:a|an))\b[^.!?;\n]*?(?=[.!?;\n]|\b(?:but|however|instead|except|yet|then|rather|just|add|include|enable|use|make|create|with)\b|$)/gi,' ');
  return text;
}
export function unsupportedIn(prompt,genre) {
  const positive=featureRequestText(prompt);
  return unsupportedPatterns.filter(([pattern,,genres])=>pattern.test(positive)&&!(genres||[]).some(id=>Object.hasOwn(GAME_TYPES,id)&&(!genre||genre===id))).map(([,text])=>text);
}
export function reviewResolutionIntent(proposal,prompt) {
  const requested=unsupportedIn(prompt,proposal.genre),findings=[];
  for(const note of proposal.unsupportedRequests){
    const categories=unsupportedPatterns.filter(([pattern])=>pattern.test(note)).map(([,text])=>text);
    if(categories.some(category=>!requested.includes(category)))findings.push('An unsupported warning refers to a mechanic absent from positive requests (it may be excluded or only mentioned in a title). Remove that false warning; preserve actual requested unsupported features.');
    if(/\b(?:is|are)\s+(?:actually\s+)?supported\b|\baccepted in\b|\bno unsupported\b/i.test(note))findings.push('The unsupported list contains a statement describing a supported feature. Open arenas, drones and healing stars are supported in survival. Put satisfied constraints in evidence or assumptions.');
  }
  return {verdict:findings.length?'fail':'pass',findings:[...new Set(findings)],evidence:['Compared known mechanic warnings with positive request clauses, excluding named titles and negative feature lists']};
}
export function validateResolution(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join() !== [...SETTING_KEYS,'assumptions','unsupportedRequests'].sort().join()) throw new Error('Invalid prompt resolution fields');
  if(SETTING_KEYS.filter(key=>key!=='music').some(key=>typeof value[key]!=='string'||!value[key].trim()))throw new Error('Missing resolved setting');
  for (const key of ['assumptions','unsupportedRequests']) if (!Array.isArray(value[key]) || value[key].length > 16 || value[key].some(text=>typeof text!=='string'||!text.trim()||text.length>240)) throw new Error('Invalid prompt resolution notes');
  if (!['beginner','experienced'].includes(value.difficulty) || typeof value.music !== 'boolean') throw new Error('Invalid resolved difficulty or music');
  const settings=validateBrief({...value,prompt:'Validate resolved settings',inputMode:'manual'});
  return {...Object.fromEntries(SETTING_KEYS.map(key=>[key,settings[key]])),assumptions:[...value.assumptions],unsupportedRequests:[...value.unsupportedRequests]};
}
export function finalizeResolution(value,prompt) {
  const proposal=validateResolution(value);
  proposal.unsupportedRequests=[...new Set([...proposal.unsupportedRequests,...unsupportedIn(prompt,proposal.genre)])];
  return proposal;
}
// Demo mode intentionally recognizes supported labels/keywords, not arbitrary
// natural language. Real mode uses a separately checked model extraction.
export function demoResolve(prompt) {
  const result={...PROMPT_DEFAULTS,assumptions:[],unsupportedRequests:[]};
  const title=prompt.match(/\b(?:title|name)\s*:\s*["“]?([^\n;"”]+)/i)||prompt.match(/\b(?:called|named)\s+["“]([^"”]+)["”]/i);
  if(title)result.title=title[1].trim().slice(0,60);else result.assumptions.push('No explicit title was found; suggested My Prompt Game.');
  const select=(key,patterns,fallbackNote)=>{
    const label={genre:'(?:game type|genre)',theme:'(?:art theme|art|theme)',difficulty:'difficulty',musicStyle:'music style',musicInstrument:'(?:lead instrument|instrument)'}[key];
    const explicit=prompt.match(new RegExp(label+'\\s*:\\s*([^\\n;]+)','i'))?.[1];
    const matches=patterns.filter(([,pattern])=>pattern.test(explicit||prompt));
    if(matches.length)result[key]=matches[0][0];
    if(matches.length!==1)result.assumptions.push(matches.length?'Conflicting '+key+' cues; suggested '+result[key]+'.':fallbackNote);
  };
  select('genre',[['campaign',/multi[- ]level|campaign|multiple levels/i],['front_battle',/front[- _]?(?:view|battle)|dragon warrior/i],['metroidvania',/metroidvania/i],['jump_shooter',/jump[- _]?(?:and[- _]?)?shoot|mega\s?man/i],['run_gun',/run[- _]?(?:and[- _]?)?gun|side[- ]scroll.*shoot|contra/i],['stealth',/stealth|metal gear/i],['rpg',/rpg|role[- ]playing|turn[- ]based|final fantasy/i],['platformer',/platform|jump/i],['maze',/maze|labyrinth/i],['survival',/surviv|arena|dodge.*drones/i],['collector',/collect|stars/i]].filter(([id])=>Object.hasOwn(GAME_TYPES,id)),'No clear supported game type; suggested star collector.');
  select('theme',[['neon',/neon|cyber/i],['forest',/forest|woodland|garden/i],['space',/space|astral|cosmic/i]],'No clear supported art theme; suggested space.');
  select('difficulty',[['experienced',/experienced|expert|hard|challenging/i],['beginner',/beginner|easy|friendly/i]],'No difficulty specified; suggested beginner.');
  select('musicStyle',[['chiptune',/chiptune|retro|8[- ]bit/i],['lofi',/lo[- ]?fi/i],['mysterious',/mysterious|mystery/i],['cinematic',/cinematic/i],['dance',/dance|electronic/i],['arcade',/arcade|energetic/i],['calm',/calm|ambient/i],['adventure',/adventure/i]],'No music style specified; suggested adventure if music is enabled.');
  select('musicInstrument',[['piano',/piano|keys/i],['bell',/bell/i],['pluck',/pluck/i],['pad',/pad/i],['organ',/organ/i],['fm',/fm lead/i],['synth',/synth/i]],'No instrument specified; the audio agent may choose a preset.');
  result.music=!/\b(no music|without music|music\s*:\s*(?:off|false)|music disabled)\b/i.test(prompt)&&(/\b(music|soundtrack|chiptune|lo[- ]?fi)\b/i.test(prompt));
  return finalizeResolution(result,prompt);
}
