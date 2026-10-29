import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { composeScore, validateScore, musicStyleOf, instrumentOf, MUSIC_STYLES, MUSIC_INSTRUMENTS } from '../shared/music.js';
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
  class FMVoice extends Node { constructor(options){super(options);this.fm=true;} }
  return {stats,transport,dependencies:{AudioContextCtor:Context,Tone:{Gain:Node,Limiter:Node,Synth:Node,FMSynth:FMVoice,MembraneSynth:Node,Sequence,start:async()=>{stats.toneStarts++;await gate;},getTransport:()=>transport}}};
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

test('music and SFX gains and mutes are independent and safely bounded', async () => {
  const GameAudio=await audioClass(),fake=fakeAudio(),audio=new GameAudio({...clone(defaults.audio),music:true},fake.dependencies);
  await audio.start(); audio.setPlaying(true); audio.musicVolume=0.4; audio.sfxVolume=0.7; audio.update();
  assert.equal(audio.gain.gain.value,audio.volume*0.7); assert.equal(audio.musicGain.gain.value,audio.volume*0.55*0.4);
  audio.musicMuted=true;audio.update();assert.equal(audio.musicGain.gain.value,0);assert.ok(audio.gain.gain.value>0);
  audio.musicMuted=false;audio.sfxMuted=true;audio.update();assert.equal(audio.gain.gain.value,0);assert.ok(audio.musicGain.gain.value>0);
  audio.sfxMuted=false;audio.musicVolume=Infinity;audio.sfxVolume=-1;audio.update();assert.equal(audio.gain.gain.value,0);assert.equal(audio.musicGain.gain.value,0);
  audio.dispose();
});

test('pausing silences ringing music voices even when levels change, then restores the mix', async () => {
  const GameAudio=await audioClass(),fake=fakeAudio(),audio=new GameAudio({...clone(defaults.audio),music:true},fake.dependencies);
  await audio.start();audio.setPlaying(true);assert.ok(audio.musicGain.gain.value>0);
  audio.setPlaying(false);assert.equal(audio.musicGain.gain.value,0);assert.equal(fake.transport.state,'stopped');
  audio.musicVolume=0.4;audio.update();assert.equal(audio.musicGain.gain.value,0);
  audio.setPlaying(true);assert.equal(audio.musicGain.gain.value,audio.volume*0.55*0.4);audio.dispose();
});
test('disposing during an asynchronous start prevents late instrument creation', async () => {
  let release;const gate=new Promise(resolve=>{release=resolve;});
  const GameAudio=await audioClass(),fake=fakeAudio({gate}),audio=new GameAudio({...clone(defaults.audio),music:true},fake.dependencies);
  const pending=audio.start();await new Promise(resolve=>setImmediate(resolve));audio.dispose();release();await assert.rejects(pending,/disposed/);assert.equal(fake.stats.nodes.length,0);assert.equal(fake.stats.closes,1);
});
test('all style/instrument combinations preserve selection and use bounded owned voices', async () => {
  const GameAudio=await audioClass();
  for(const style of Object.keys(MUSIC_STYLES)) for(const instrument of Object.keys(MUSIC_INSTRUMENTS)) {
    const brief={title:'Instrument test',music:true,musicStyle:style,musicInstrument:instrument};
    const {artifact}=await work({brief});assert.deepEqual(validateScore(artifact.score),[]);assert.equal(artifact.score.instrument,instrument);
    assert.equal((await check({brief,artifact})).verdict,'pass');
    assert.equal((await check({brief,artifact:{...artifact,score:{...artifact.score,instrument:instrument==='bell'?'piano':'bell'}}})).verdict,'fail');
    const fake=fakeAudio(),audio=new GameAudio(artifact,fake.dependencies);await audio.start();audio.setPlaying(true);
    assert.equal(!!audio.lead.fm,MUSIC_INSTRUMENTS[instrument].engine==='fm');assert.ok(audio.lead.options.volume<=-15);
    fake.stats.sequences[0].callback(1,'C4');assert.equal(fake.stats.notes.length,1);
    audio.dispose();assert.ok(fake.stats.nodes.every(node=>node.disposed));assert.ok(fake.stats.sequences.every(seq=>seq.disposed));
  }
});
test('instrument boundaries reject paths, prototypes, node parameters and unresolved auto scores', async () => {
  for(const instrument of ['constructor','__proto__','../../.env','https://example.invalid/sample']) {
    assert.throws(()=>instrumentOf(instrument));assert.throws(()=>validateBrief({prompt:'Explore',musicInstrument:instrument}));
    assert.ok(validateScore({...composeScore(),instrument}).length);
  }
  for(const instrument of [null,{},'auto'])assert.ok(validateScore({...composeScore(),instrument}).length);
  assert.ok(validateScore({...composeScore(),nodeOptions:{volume:100}}).length);
  const GameAudio=await audioClass(),fake=fakeAudio();
  assert.throws(()=>new GameAudio({...defaults.audio,score:{...composeScore(),instrument:'../code'}},fake.dependencies));assert.equal(fake.stats.contexts,0);
});
test('legacy scores lacking an instrument remain playable as the original synth', async () => {
  const score=composeScore();delete score.instrument;assert.deepEqual(validateScore(score),[]);
  const GameAudio=await audioClass(),fake=fakeAudio(),audio=new GameAudio({...clone(defaults.audio),score,music:true},fake.dependencies);
  await audio.start();assert.equal(audio.inspect().instrument,'synth');assert.equal(!!audio.lead.fm,false);audio.dispose();
});
