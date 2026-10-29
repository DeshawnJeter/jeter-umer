import {createGameEvents} from './game-events.js';
import { PlayerInterface } from './interface.js';
import { GameAudio } from './audio.js';
import { GAME_TYPES, genreOf, roundOutcome } from './rules.js';
import { createArt, drawBackdrop } from './art.js';
import { MUSIC_STYLES, MUSIC_INSTRUMENTS } from './score.js';
import {advancedProfile} from './advanced-games.js';
import {assembly} from './assembly.js';
import {lifecycleFor,failureReason} from './lifecycle.js';
const errors = [];
window.addEventListener('error', event => errors.push(String(event.message)));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
const response = await fetch('config.json');
if (!response.ok) throw new Error('Game configuration unavailable');
const config = await response.json(), genre = genreOf(config.genre), rules = GAME_TYPES[genre];
if(assembly.runtime!==genre)throw Error('Game assembly/runtime mismatch');
if(!advancedProfile(genre)){const failureNote=document.createElement('p');failureNote.id='failure-rules';failureNote.textContent='Failure: '+lifecycleFor(genre).failure+' Restart is always available.';document.querySelector('#game').before(failureNote);}
if(advancedProfile(genre)){const {startAdvancedGame}=await import('./advanced.js');await startAdvancedGame(config,genre);}else{
const audio = new GameAudio(config.audio);
const title = document.querySelector('#title'), message = document.querySelector('#message'), status = document.querySelector('#status');
title.textContent = config.ui.title; document.title = config.ui.title; message.textContent = config.story.intro;
document.querySelector('#instructions').textContent = rules.controls;
document.querySelector('#genre').textContent = rules.name;
document.querySelector('#volume').value = config.audio.volume;
const musicInfo = document.createElement('p'); musicInfo.id = 'music-info'; musicInfo.textContent = config.audio.music ? 'Music starts with your game' : 'Music off'; status.after(musicInfo);
document.querySelector('#mute').textContent = audio.muted ? 'Unmute' : 'Mute';
document.querySelector('#mute').setAttribute('aria-pressed', String(audio.muted));
const state = { ready: false, genre, phase: 'ready', score: 0, required: config.levels.stars.length, remaining: config.gameplay.timeLimit, health: 3, x: 0, y: 0 };
let events,scene, player, stars, enemies, portal, elapsed = 0, lastHud = '', lastDamage = -2;
const held = new Set(); let touchJump = false;
const ui = new PlayerInterface({ config, genre, state, audio, held, onJump: () => { touchJump = true; },
  onPause: () => { held.clear(); touchJump = false; scene?.scene.pause(); },
  onResume: () => { scene?.scene.resume(); },
  onRestart: () => { if (scene) scene.scene.restart(); }
});
await ui.initialize();
const size = 48, center = n => n * size + size / 2;
function end(phase) {
  if (state.phase !== 'playing') return;
  state.phase = phase;events?.emit(phase==='won'?'victory':'defeat',{x:state.x,y:state.y}); player.body.setVelocity(0); enemies?.setVelocity(0, 0);
  state.failureReason=phase==='lost'?failureReason(genre,state):null;
  message.textContent = config.story[phase === 'won' ? 'victory' : 'defeat']+(state.failureReason?' '+state.failureReason+'. Choose Restart to try again.':'');
  scene.physics.pause();
  audio.tone(phase === 'won' ? config.audio.winFrequency : 140); audio.setPlaying?.(false);
}
class WorkshopGame extends Phaser.Scene {
  create() {
    scene = this;events=createGameEvents();const sceneEvents=events;this.physics.resume(); elapsed = 0; lastHud = ''; lastDamage = -2; held.clear(); touchJump = false;
    Object.assign(state, { ready: true, phase: 'ready', score: 0, remaining: config.gameplay.timeLimit, health: 3,failureReason:null });
    message.textContent = config.story.intro;
    createArt(this, config.ui); drawBackdrop(this, {...config.ui,...config.art});
    const walls = this.physics.add.staticGroup();
    for (const wall of config.levels.walls) {
      const box = this.add.image(center(wall.x), center(wall.y), 'wall');
      this.physics.add.existing(box, true); walls.add(box);
    }
    if (genre !== 'survival') {
      portal = this.add.image(center(config.levels.exit.x), center(config.levels.exit.y), 'portal');
      this.physics.add.existing(portal, true);
      portal.body.setSize(28, 36).setOffset(10, 6);
      this.tweens.add({ targets: portal, alpha: 0.6, duration: 1100, yoyo: true, repeat: -1 });
    } else portal = null;
    player = this.physics.add.sprite(center(config.levels.spawn.x), center(config.levels.spawn.y), 'player');
    player.setCollideWorldBounds(true); player.body.setSize(24, 28).setOffset(4, 2);
    player.body.setGravityY(genre === 'platformer' ? 1000 : 0);
    this.physics.add.collider(player, walls);
    stars = this.physics.add.staticGroup();
    for (const star of config.levels.stars) {
      const pickup = stars.create(center(star.x), center(star.y), 'star');
      this.tweens.add({ targets: pickup, alpha: 0.6, duration: 900 + star.x * 40, yoyo: true, repeat: -1 });
    }
    this.physics.add.overlap(player, stars, (_, star) => {
      if (state.phase !== 'playing') return;
      this.tweens.killTweensOf(star); star.destroy(); state.score++;events.emit('pickup',{x:player.x,y:player.y}); if (genre === 'survival') state.health = Math.min(3, state.health + 1);
      audio.tone(config.audio.pickupFrequency);
    });
    if (portal) this.physics.add.overlap(player, portal, () => {
      if (state.phase !== 'playing') return;
      const outcome = roundOutcome({ ...state, atExit: true }); if (outcome !== 'playing') end(outcome);
    });
    enemies = this.physics.add.group();
    if (genre === 'survival') {
      const blocked = new Set(config.levels.walls.map(p => `${p.x},${p.y}`));
      const candidates = [];
      for (let y = 0; y < 10; y++) for (let x = 0; x < 15; x++) if (!blocked.has(`${x},${y}`)) candidates.push({ x, y, distance: Math.hypot(x - config.levels.spawn.x, y - config.levels.spawn.y) });
      const spawns = [];
      for (const point of candidates.sort((a, b) => b.distance - a.distance)) if (point.distance >= 5 && spawns.every(p => Math.hypot(point.x - p.x, point.y - p.y) >= 3)) {
        spawns.push(point); if (spawns.length === (config.planner.difficulty === 'beginner' ? 2 : 3)) break;
      }
      for (const point of spawns) enemies.create(center(point.x), center(point.y), 'enemy').setCollideWorldBounds(true).setBounce(1);
      this.physics.add.collider(enemies, walls); this.physics.add.collider(enemies, enemies);
      this.physics.add.overlap(player, enemies, () => {
        if (state.phase !== 'playing' || elapsed - lastDamage < 1.2) return;
        state.health--;events.emit('damage_taken',{x:player.x,y:player.y,amount:1}); lastDamage = elapsed; audio.tone(120); this.cameras.main.shake(120, 0.006);
        if (state.health <= 0) end('lost');
      });
    }
    ui.render();
    this.events.once('shutdown', () => { held.clear(); audio.setPlaying?.(false);sceneEvents.dispose(); });
  }
  update(_, delta) {
    if (!player) return;
    if (state.phase === 'playing') {
      elapsed += delta / 1000; state.remaining = Math.max(0, config.gameplay.timeLimit - elapsed);
      const x = Number(ui.isDown('right')) - Number(ui.isDown('left'));
      const y = Number(ui.isDown('down')) - Number(ui.isDown('up'));
      if (genre === 'platformer') {
        player.body.setVelocityX(x * config.gameplay.speed);
        const jump = touchJump;
        if (jump && player.body.blocked.down) player.body.setVelocityY(-480);
      } else { player.body.setVelocity(x, y); if (x || y) player.body.velocity.normalize().scale(config.gameplay.speed); }
      touchJump = false;
      if (genre === 'survival') for (const enemy of enemies.getChildren()) {
        const speed = config.gameplay.speed * (config.planner.difficulty === 'beginner' ? 0.42 : 0.57);
        this.physics.moveToObject(enemy, player, speed);
      }
      player.setAlpha(genre === 'survival' && elapsed - lastDamage < 1.2 ? 0.5 : 1);
      const moving = Math.abs(player.body.velocity.x) + Math.abs(player.body.velocity.y) > 5;
      player.setTexture(moving ? `player-run-${Math.floor(elapsed * 9) % 2 + 1}` : 'player');
      if (x) player.setFlipX(x < 0);
      const outcome = roundOutcome(state); if (outcome !== 'playing') end(outcome);
    } else { player.body.setVelocity(0); enemies?.setVelocity(0, 0); }
    state.x = player.x; state.y = player.y;
    document.querySelector('#game').dataset.phase=state.phase;
    const text = `${state.phase.toUpperCase()} · Stars ${state.score}/${state.required} · ${Math.ceil(state.remaining)}s${genre === 'survival' ? ` · Shields ${state.health}/3` : ''}`;
    if (text !== lastHud) { status.textContent = text; ui.render(); lastHud = text; }
  }
}
new Phaser.Game({ type: Phaser.AUTO, width: 720, height: 480, parent: 'game', backgroundColor: config.ui.backgroundColor, physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 } } }, scene: WorkshopGame, audio: { noAudio: true } });
document.querySelector('#start').onclick = async () => {
  if (!state.ready || state.phase !== 'ready') return;
  state.phase = 'playing'; document.querySelector('#game').focus();
  try { await audio.start(); audio.setPlaying?.(state.phase === 'playing'); document.querySelector('#music-info').textContent = config.audio.music ? `${MUSIC_STYLES[audio.score.style].name} · ${MUSIC_INSTRUMENTS[audio.instrument].name} · ${audio.score.tempo} BPM` : 'Music off · event sounds enabled'; } catch { message.textContent = 'Audio unavailable. The game can still run.'; }
};
document.querySelector('#restart').onclick = () => ui.restart();
for (const button of document.querySelectorAll('[data-control]')) {
  const control = button.dataset.control;
  button.hidden = !['left','right','up','down','jump'].includes(control) || (control === 'jump' ? genre !== 'platformer' : genre === 'platformer' && ['up','down'].includes(control));
  button.onpointerdown = event => { event.preventDefault(); if (state.phase !== 'playing') return; button.setPointerCapture(event.pointerId); held.add(control); if (control === 'jump') touchJump = true; };
  button.onpointerup = button.onpointercancel = button.onlostpointercapture = () => held.delete(control);
}
window.addEventListener('blur', () => { held.clear(); ui.clearInput(); if (state.phase === 'playing') ui.pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state.phase === 'playing') ui.pause(); });
window.addEventListener('pagehide', () => audio.dispose(), { once: true });
window.gameState = () => ({ ...state, errors: [...errors],events:events?.inspect()||[], muted: audio.muted, volume: audio.volume, audio: audio.inspect() });
}
