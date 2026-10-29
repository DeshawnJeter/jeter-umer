import { validateBrief } from './contracts/index.js';
export const SETTING_KEYS = ['title','genre','theme','difficulty','music','musicStyle','musicInstrument'];
export const PROMPT_DEFAULTS = Object.freeze({title:'My Prompt Game',genre:'collector',theme:'space',difficulty:'beginner',music:false,musicStyle:'adventure',musicInstrument:'auto'});
const unsupportedPatterns = [
  [/\b(rpg|role[- ]playing|turn[- ]based|final fantasy|dragon warrior)\b/i,'Turn-based RPG, party and battle systems are not supported yet.'],
  [/\b(stealth|metal gear)\b/i,'Stealth, patrol vision and detection systems are not supported yet.'],
  [/\b(shoot(?:ing|er)?|contra|mega\s?man)\b/i,'Shooting, weapons and projectile combat are not supported yet.'],
  [/\bmetroidvania\b/i,'Metroidvania progression and connected-room exploration are not supported yet.'],
  [/\b(first[- ]person|3d)\b/i,'First-person exploration and battle views are not supported yet.'],
  [/\b(inventory|crafting|boss(?:es)?)\b/i,'Inventory, crafting and boss systems are not supported yet.']
];
export function unsupportedIn(prompt) {
  const positive = prompt.replace(/\b(?:no|without|do not add)\s+(?:any\s+)?(?:rpg|stealth|shooting|shooter|weapons|inventory|crafting|bosses|3d)\b/gi,'');
  return unsupportedPatterns.filter(([pattern])=>pattern.test(positive)).map(([,text])=>text);
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
  proposal.unsupportedRequests=[...new Set([...proposal.unsupportedRequests,...unsupportedIn(prompt)])];
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
  select('genre',[['platformer',/platform|jump/i],['maze',/maze|labyrinth/i],['survival',/surviv|arena|dodge.*drones/i],['collector',/collect|stars/i]],'No clear supported game type; suggested star collector.');
  select('theme',[['neon',/neon|cyber/i],['forest',/forest|woodland|garden/i],['space',/space|astral|cosmic/i]],'No clear supported art theme; suggested space.');
  select('difficulty',[['experienced',/experienced|expert|hard|challenging/i],['beginner',/beginner|easy|friendly/i]],'No difficulty specified; suggested beginner.');
  select('musicStyle',[['chiptune',/chiptune|retro|8[- ]bit/i],['lofi',/lo[- ]?fi/i],['mysterious',/mysterious|mystery/i],['cinematic',/cinematic/i],['dance',/dance|electronic/i],['arcade',/arcade|energetic/i],['calm',/calm|ambient/i],['adventure',/adventure/i]],'No music style specified; suggested adventure if music is enabled.');
  select('musicInstrument',[['piano',/piano|keys/i],['bell',/bell/i],['pluck',/pluck/i],['pad',/pad/i],['organ',/organ/i],['fm',/fm lead/i],['synth',/synth/i]],'No instrument specified; the audio agent may choose a preset.');
  result.music=!/\b(no music|without music|music\s*:\s*(?:off|false)|music disabled)\b/i.test(prompt)&&(/\b(music|soundtrack|chiptune|lo[- ]?fi)\b/i.test(prompt));
  return finalizeResolution(result,prompt);
}
