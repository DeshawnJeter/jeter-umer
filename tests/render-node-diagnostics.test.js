import test from 'node:test';import assert from 'node:assert/strict';import {inspectSnapshot} from '../shared/code-game.js';
test('render failures identify the exact node and field without reflecting arbitrary model text',()=>{
 const snapshot={phase:'ready',health:4,maxHealth:4,score:0,objective:'Light beacons',nodes:[{x:10,y:20,size:30,color:'#ffffff'}]};assert.throws(()=>inspectSnapshot(snapshot),/Render node 0: label is required/);snapshot.nodes[0].label='';assert.equal(inspectSnapshot(snapshot).nodes[0].label,'');snapshot.nodes[0].color='untrusted secret-like text';assert.throws(()=>inspectSnapshot(snapshot),error=>error.message==='Render node 0: color must use six-digit #RRGGBB.');
});
