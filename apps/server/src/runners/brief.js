import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {demoResolve,finalizeResolution,reviewResolutionIntent,featureRequestText,unsupportedIn} from '../../../../shared/prompt-brief.js';
import {policy} from '../../../../shared/policies/index.js';
import {fingerprint} from './instructions.js';
export async function resolvePromptBrief({client,brief,decisions={},hooks={},directory,beforeStep=async()=>{},onEvent=async()=>{}}) {
  const instructions=await readFile(resolve('prompts/brief-resolver.md'),'utf8');
  const folder=resolve(directory,'brief-resolution');await mkdir(folder,{recursive:true});let findings=[];
  for(let attempt=1;attempt<=policy.maxAttempts;attempt++){
    const request={operation:'resolve_brief',instructions,brief,context:{decisions},featureIntent:{positiveRequestText:featureRequestText(brief.prompt),knownRequestedUnsupported:unsupportedIn(brief.prompt)},task:{role:'planner',purpose:'Extract supported settings for human plan review'},attempt,findings,limits:{maxContextChars:policy.maxContextChars}};
    await beforeStep();await onEvent({stage:'resolving_prompt',attempt});
    const output=client?await client.generate('planner','worker',request,hooks):{artifact:demoResolve(brief.prompt),summary:'Demo keyword extraction'};
    const proposal=finalizeResolution(output.artifact,brief.prompt);
    await writeFile(resolve(folder,`attempt-${attempt}-worker.json`),JSON.stringify({request,output,proposal},null,2));
    await beforeStep();await onEvent({stage:'checking_prompt',attempt});
    const deterministicReview=reviewResolutionIntent(proposal,brief.prompt);
    const modelReport=client?await client.generate('planner','checker',{...request,artifact:proposal,deterministicReview},hooks):{verdict:'pass',findings:[],evidence:['Demo resolution contract check']};
    const combinedFindings=[...deterministicReview.findings,...modelReport.findings];
    const report={...modelReport,verdict:combinedFindings.length?'fail':modelReport.verdict,findings:combinedFindings,evidence:[...deterministicReview.evidence,...modelReport.evidence]};
    await writeFile(resolve(folder,`attempt-${attempt}-checker.json`),JSON.stringify({proposal,report},null,2));
    if(report.verdict==='pass'&&!report.findings.length)return {proposal,report,sourcePrompt:brief.prompt,instructionsHash:fingerprint(instructions),provider:client?(client.mode||'openai'):'scripted-demo'};
    findings=report.findings.length?report.findings:['Return conservative, supported suggestions for review instead of asking a question.'];
  }
  throw new Error('Prompt interpretation exhausted its checked repair attempts. Revise the prompt; no specialists were started.');
}
