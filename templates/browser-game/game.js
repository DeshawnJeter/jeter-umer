import { GameAudio } from './audio.js';
const errors = [];
window.addEventListener('error', event => errors.push(String(event.message)));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
const response = await fetch('config.json'); if (!response.ok) throw new Error('Game configuration unavailable');
const config = await response.json();
const audio = new GameAudio(config.audio);
const title = document.querySelector('#title'), message = document.querySelector('#message'), status = document.querySelector('#status');
title.textContent = config.ui.title; document.title = config.ui.title; message.textContent = config.story.intro;
document.querySelector('#volume').value = config.audio.volume;
const state = { ready: false, phase: 'ready', score: 0, required: config.levels.stars.length, remaining: config.gameplay.timeLimit, x: 0, y: 0 };
let scene, player, stars, portal, cursors, wasd, time = 0, lastCell = '';
const size = 48, center = n => n * size + size / 2;
function end(phase) { state.phase = phase; player.body.setVelocity(0); message.textContent = config.story[phase === 'won' ? 'victory' : 'defeat']; audio.tone(phase === 'won' ? config.audio.winFrequency : 140); }
function reset() { if (scene) scene.scene.restart(); }
function texture(s, name, color, radius) { const g = s.make.graphics({ x: 0, y: 0 }); g.fillStyle(color); g.fillCircle(16, 16, radius); g.generateTexture(name, 32, 32); g.destroy(); }
class Collector extends Phaser.Scene {
  create() {
    scene = this; time = 0; lastCell = ''; Object.assign(state, { ready: true, phase: 'ready', score: 0, remaining: config.gameplay.timeLimit }); message.textContent = config.story.intro;
    if (!this.textures.exists('player')) { texture(this, 'player', Phaser.Display.Color.HexStringToColor(config.ui.playerColor).color, 13); texture(this, 'star', 0xffd275, 9); }
    const graphics = this.add.graphics(); graphics.lineStyle(1, 0x293950);
    for (let x = 0; x <= 15; x++) graphics.lineBetween(x * size, 0, x * size, 480);
    for (let y = 0; y <= 10; y++) graphics.lineBetween(0, y * size, 720, y * size);
    const walls = this.physics.add.staticGroup();
    for (const wall of config.levels.walls) { const box = this.add.rectangle(center(wall.x), center(wall.y), size, size, 0x486078); this.physics.add.existing(box, true); walls.add(box); }
    portal = this.add.rectangle(center(config.levels.exit.x), center(config.levels.exit.y), 36, 36, 0xae82ff); this.physics.add.existing(portal, true);
    player = this.physics.add.sprite(center(config.levels.spawn.x), center(config.levels.spawn.y), 'player'); player.setCollideWorldBounds(true); player.body.setCircle(12, 4, 4); this.physics.add.collider(player, walls);
    stars = this.physics.add.staticGroup(); for (const star of config.levels.stars) stars.create(center(star.x), center(star.y), 'star');
    this.physics.add.overlap(player, stars, (_, star) => { if (state.phase !== 'playing') return; star.destroy(); state.score++; audio.tone(config.audio.pickupFrequency); });
    this.physics.add.overlap(player, portal, () => { if (state.phase === 'playing' && state.score === state.required) end('won'); });
    cursors = this.input.keyboard.createCursorKeys(); wasd = this.input.keyboard.addKeys('W,A,S,D');
  }
  update(_, delta) {
    if (!player) return;
    if (state.phase === 'playing') {
      time += delta / 1000; state.remaining = Math.max(0, config.gameplay.timeLimit - time);
      const x = Number(cursors.right.isDown || wasd.D.isDown) - Number(cursors.left.isDown || wasd.A.isDown);
      const y = Number(cursors.down.isDown || wasd.S.isDown) - Number(cursors.up.isDown || wasd.W.isDown);
      player.body.setVelocity(x, y); if (x || y) player.body.velocity.normalize().scale(config.gameplay.speed);
      if (state.remaining <= 0) end('lost');
    } else player.body.setVelocity(0);
    state.x = player.x; state.y = player.y;
    const cell = `${state.phase}/${state.score}/${Math.ceil(state.remaining)}`;
    if (cell !== lastCell) { status.textContent = `${state.phase.toUpperCase()}   Stars ${state.score}/${state.required}   Time ${Math.ceil(state.remaining)}s`; lastCell = cell; }
  }
}
new Phaser.Game({ type: Phaser.AUTO, width: 720, height: 480, parent: 'game', backgroundColor: config.ui.backgroundColor, physics: { default: 'arcade', arcade: { gravity: { y: 0 } } }, scene: Collector, audio: { noAudio: true } });
document.querySelector('#start').onclick = async () => { try { await audio.start(); } catch { message.textContent = 'Audio unavailable. The game can still run.'; } if (state.phase === 'ready') state.phase = 'playing'; };
document.querySelector('#restart').onclick = reset;
document.querySelector('#mute').onclick = event => { audio.muted = !audio.muted; audio.update(); event.currentTarget.textContent = audio.muted ? 'Unmute' : 'Mute'; event.currentTarget.setAttribute('aria-pressed', String(audio.muted)); };
document.querySelector('#volume').oninput = event => { audio.volume = Number(event.target.value); audio.update(); };
window.addEventListener('pagehide', () => audio.dispose(), { once: true });
// Read-only observability for browser checks. No hidden success or teleport controls.
window.gameState = () => ({ ...state, errors: [...errors], muted: audio.muted, volume: audio.volume });
