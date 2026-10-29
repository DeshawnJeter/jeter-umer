import test from 'node:test';import assert from 'node:assert/strict';import {pathNodes,components,inspectSnapshot} from '../shared/code-game.js';
test('long paths use at most sixteen valid render nodes and preserve both endpoints',()=>{
 const points=pathNodes({x:40,y:240},{x:680,y:240},'#606060');assert.ok(points.length<=16);assert.equal(points[0].x,40);assert.equal(points.at(-1).x,680);assert.equal(components.pathNodes,pathNodes);
 const state={phase:'ready',health:3,maxHealth:3,score:0,objective:'Test',nodes:points};assert.equal(inspectSnapshot(state).nodes.length,points.length);
 const diagonal=pathNodes({x:0,y:0},{x:720,y:480});assert.equal(diagonal.length,16);assert.ok(diagonal.every(point=>point.x>=0&&point.x<=720&&point.y>=0&&point.y<=480));
});
test('path helpers reject invalid coordinates and colors before producing invalid render data',()=>{
 for(const [start,end,color] of [[{x:NaN,y:0},{x:1,y:1},'#ffffff'],[{x:-1,y:0},{x:1,y:1},'#ffffff'],[{x:0,y:0},{x:1,y:1},'red']])assert.throws(()=>pathNodes(start,end,color),/pathNodes requires/);
});

test('checker catalog retains every supplied API and the source/render/replay bounds',async()=>{
 const {CHECKER_COMPONENT_CATALOG,COMPONENT_CATALOG}=await import('../shared/code-game.js');for(const name of Object.keys(components)){assert.ok(CHECKER_COMPONENT_CATALOG.includes(name+'('));assert.ok(COMPONENT_CATALOG.includes(name+'('));}
 for(const text of ['6000','nodes <=64','300 expanded','0..0.1','label <=40','no imports'])assert.ok(CHECKER_COMPONENT_CATALOG.includes(text));
});
