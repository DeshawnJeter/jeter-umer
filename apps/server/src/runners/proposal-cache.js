import {readFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fingerprint} from './instructions.js';
function semanticRequest(request){
  const copy=structuredClone(request),memory=copy.context?.memory;
  if(memory)for(const field of ['revision','checkpoint','previousHandoff','references'])delete memory[field];
  return copy;
}
export async function pendingProposal(folder,attempt,request){
  if(request.execution?.provider!=='openai')return null;
  try{
    // Reviewed failures need repair, not replay of the same proposal. Accepted
    // work normally lives in project memory and is skipped by the manager.
    try{await access(resolve(folder,`attempt-${attempt}-checker.json`));return null;}catch(error){if(error.code!=='ENOENT')throw error;}
    const text=await readFile(resolve(folder,`attempt-${attempt}-worker.json`),'utf8');if(text.length>100000)return null;
    const saved=JSON.parse(text);if(!saved.result?.artifact||saved.result.question)return null;
    if(fingerprint(semanticRequest(saved.request))!==fingerprint(semanticRequest(request)))return null;
    return {result:structuredClone(saved.result),requestHash:fingerprint(saved.request)};
  }catch{return null;}
}
