import test from 'node:test';import assert from 'node:assert/strict';import {lossDeadlineForBrief} from '../apps/server/src/validation/code-checks.js';
test('idle continuation uses only an explicit bounded lose-within requirement',()=>{
 assert.equal(lossDeadlineForBrief({prompt:'Doing nothing must lose within 25 seconds.'}),25);assert.equal(lossDeadlineForBrief({prompt:'Doing nothing should lose within 12s.'}),12);
 for(const prompt of ['Lose eventually.','Doing nothing must not lose within 25 seconds.','Doing nothing must lose within 45 seconds.','Win within 25 seconds.'])assert.equal(lossDeadlineForBrief({prompt}),null);
});
