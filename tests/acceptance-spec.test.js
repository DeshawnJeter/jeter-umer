import test from 'node:test';import assert from 'node:assert/strict';
import {defaults,clone,validateArtifact} from '../shared/contracts/index.js';
import {check as checkPlan} from '../agents/planner/checker.js';
import {check as checkStory} from '../agents/story/checker.js';
test('approved plans require compact observable acceptance criteria',()=>{
  const plan=clone(defaults.planner);assert.deepEqual(validateArtifact('planner',plan),[]);
  for(const acceptance of [undefined,[],['Only a win'],Array(7).fill('Too many criteria'),['Win','Lose','']])assert.ok(validateArtifact('planner',{...plan,acceptance}).length);
});
test('custom plan and story can describe new mechanics without copying fixed template keywords',async()=>{
  const brief={genre:'custom',title:'Crystal Watch',difficulty:'beginner'},artifact={...clone(defaults.planner),...brief,objective:'Defend a crystal through six waves by building towers.'};
  delete artifact.genre;
  assert.equal((await checkPlan({brief,artifact})).verdict,'pass');
  assert.equal((await checkStory({brief,artifact:{intro:'Build towers to defend the crystal.',victory:'The crystal stands!',defeat:'The crystal fell.'}})).verdict,'pass');
});
