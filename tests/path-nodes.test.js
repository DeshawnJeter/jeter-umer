import test from 'node:test';import assert from 'node:assert/strict';import {pathNodes,components,inspectSnapshot} from '../shared/code-game.js';
test('long paths use at most sixteen valid render nodes and preserve both endpoints',()=>{
 const points=pathNodes({x:40,y:240},{x:680,y:240},'#606060');assert.ok(points.length<=16);assert.equal(points[0].x,40);assert.equal(points.at(-1).x,680);assert.equal(components.pathNodes,pathNodes);
 const state={phase:'ready',health:3,maxHealth:3,score:0,objective:'Test',nodes:points};assert.equal(inspectSnapshot(state).nodes.length,points.length);
 const diagonal=pathNodes({x:0,y:0},{x:720,y:480});assert.equal(diagonal.length,16);assert.ok(diagonal.every(point=>point.x>=0&&point.x<=720&&point.y>=0&&point.y<=480));
});
test('path helpers reject invalid coordinates and colors before producing invalid render data',()=>{
 for(const [start,end,color] of [[{x:NaN,y:0},{x:1,y:1},'#ffffff'],[{x:-1,y:0},{x:1,y:1},'#ffffff'],[{x:0,y:0},{x:1,y:1},'red']])assert.throws(()=>pathNodes(start,end,color),/pathNodes requires/);
});
