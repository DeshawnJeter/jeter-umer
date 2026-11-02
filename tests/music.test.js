import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { composeScore, validateScore, musicStyleOf, MUSIC_STYLES } from '../shared/music.js';
import { clone, defaults, validateArtifact, validateBrief } from '../shared/contracts/index.js';
import { work } from '../agents/audio/agent.js';
import { check } from '../agents/audio/checker.js';
import { buildGame } from '../apps/server/src/integration/build.js';
let exportedClass;
async function audioClass() {
  exportedClass ??= (async () => {
    const dir = await mkdtemp(join(tmpdir(), 'music-export-')); await buildGame(dir, clone(defaults));
    assert.deepEqual(JSON.parse(await readFile(join(dir,'music-score.json'),'utf8')),defaults.audio.score);
    return (await import(pathToFileURL(join(dir,'audio.js')).href)).GameAudio;
  })();
  return exportedClass;
}
function fakeAudio({ gate } = {}) {
  const stats = { contexts:0, closes:0, toneStarts:0, nodes:[], sequences:[], notes:[] };
  class Node {
    constructor(options) { this.options=options; this.disposed=false; this.gain={ value:0, rampTo(value) { this.value=value; } }; stats.nodes.push(this); }
    connect() { return this; } toDestination() { return this; } dispose() { this.disposed=true; }
    triggerAttackRelease(...args) { stats.notes.push(args); }
  }
  class Sequence {
    constructor(callback, notes, interval) { Object.assign(this,{callback,notes,interval,disposed:false}); stats.sequences.push(this); }
    start() { return this; } dispose() { this.disposed=true; }
  }
  const transport={ state:'stopped',bpm:{value:0},start(){this.state='started';},stop(){this.state='stopped';} };
  class Context {
    constructor(){stats.contexts++;this.currentTime=0;this.destination={};}
    createGain(){return {gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
    resume(){return Promise.resolve();} close(){stats.closes++;return Promise.resolve();}
  }
  return {stats,transport,dependencies:{AudioContextCtor:Context,Tone:{Gain:Node,Limiter:Node,Synth:Node,MembraneSynth:Node,Sequence,start:async()=>{stats.toneStarts++;await gate;},getTransport:()=>transport}}};
}
test('all musical styles compose bounded audible parts and preserve explicit choices', async () => {
  for (const style of Object.keys(MUSIC_STYLES)) {
    const brief={title:'Music test',music:true,musicStyle:style,genre:'platformer'};
    const {artifact}=await work({brief}); assert.deepEqual(validateScore(artifact.score),[]); assert.deepEqual(validateArtifact('audio',artifact),[]);
    assert.equal((await check({artifact,brief})).verdict,'pass');
    assert.equal((await check({artifact:{...artifact,score:{...artifact.score,style:style==='calm'?'arcade':'calm'}},brief})).verdict,'fail');
  }
});
test('scores reject executable/remote notes, extreme event counts, silent loops and unknown fields', () => {
  for (const style of ['constructor','../file','https://example.invalid']) { assert.throws(()=>musicStyleOf(style));assert.throws(()=>validateBrief({prompt:'Explore',musicStyle:style})); }
  for (const change of [{tempo:9999},{waveform:'eval()'},{melody:['https://example.invalid/audio']},{melody:Array(1024).fill('C4')},{melody:Array(16).fill('R')},{bass:['C9','C9','C9','C9']},{path:'../../.env'},{style:'calm',tempo:70,drums:true}]) assert.ok(validateScore({...composeScore(),...change}).length);
});
test('audio has no contexts/sequences before a gesture and concurrent starts share one graph', async () => {
  const GameAudio=await audioClass(), fake=fakeAudio();
  const audio=new GameAudio({...clone(defaults.audio),music:true},fake.dependencies);
  assert.equal(fake.stats.contexts,0);assert.equal(fake.stats.sequences.length,0);
  await Promise.all([audio.start(),audio.start()]);assert.equal(fake.stats.contexts,1);assert.equal(fake.stats.toneStarts,1);assert.equal(fake.stats.sequences.length,3);
  assert.equal(fake.transport.state,'stopped');audio.setPlaying(true);
  fake.stats.sequences[0].callback(1,'C4');assert.equal(fake.stats.notes.length,1);
  audio.setPlaying(false);fake.stats.sequences[0].callback(2,'C4');assert.equal(fake.stats.notes.length,1);
  const count=fake.stats.nodes.length;await audio.start();audio.setPlaying(true);assert.equal(fake.stats.nodes.length,count);
  audio.muted=true;audio.update();assert.equal(audio.gain.gain.value,0);assert.equal(audio.musicGain.gain.value,0);
  audio.muted=false;audio.volume=999;audio.update();assert.equal(audio.volume,0.3);assert.ok(audio.musicGain.gain.value<=0.3);
  audio.dispose();audio.dispose();assert.equal(fake.stats.closes,1);assert.ok(fake.stats.nodes.every(node=>node.disposed));assert.ok(fake.stats.sequences.every(seq=>seq.disposed));
  await assert.rejects(audio.start(),/disposed/);
});
test('music-off mode never starts Tone or allocates its instruments', async () => {
  const GameAudio=await audioClass(),fake=fakeAudio(),audio=new GameAudio(clone(defaults.audio),fake.dependencies);
  await audio.start();assert.equal(fake.stats.toneStarts,0);assert.equal(fake.stats.nodes.length,0);audio.dispose();
});
test('disposing during an asynchronous start prevents late instrument creation', async () => {
  let release;const gate=new Promise(resolve=>{release=resolve;});
  const GameAudio=await audioClass(),fake=fakeAudio({gate}),audio=new GameAudio({...clone(defaults.audio),music:true},fake.dependencies);
  const pending=audio.start();await new Promise(resolve=>setImmediate(resolve));audio.dispose();release();await assert.rejects(pending,/disposed/);assert.equal(fake.stats.nodes.length,0);assert.equal(fake.stats.closes,1);
});
