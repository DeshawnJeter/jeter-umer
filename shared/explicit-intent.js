// Narrow deterministic facts, not a general natural-language judge. Free-form
// tone and creative preferences must not become exact string requirements.
export function namedStoryPlaces(context={}){
 const direction=context.decisions?.['story.direction'];if(typeof direction!=='string')return [];
 return [...new Set([...direction.matchAll(/\b(?:[Vv]illage|[Tt]own|[Cc]ity|[Kk]ingdom|[Ww]orld)\s+(?:is named|is called|named|called|is|of)\s+([A-Z][A-Za-z'-]{1,31})\b/g)].map(match=>match[1]))];
}
export function requestedBattleBackdrop(brief={},context={}){
 for(const text of [context.changeRequest?.request,brief.prompt]){
  if(typeof text!=='string')continue;let selected=null;
  for(const clause of text.split(/[.;\n]/)){
   if(/\b(?:not|avoid|without)\b/i.test(clause))continue;
   const after=clause.match(/(?:battle|combat)\s+(?:background|backdrop)[^.;\n]{0,40}?\b(themed|ruins|cavern|forest|space|neon)\b/i);
   const before=clause.match(/\b(themed|ruins|cavern|forest|space|neon)\s+(?:battle|combat)\s+(?:background|backdrop)\b/i);
   if(after||before)selected=(after||before)[1].toLowerCase();
  }
  if(selected)return selected;
 }
 return null;
}
