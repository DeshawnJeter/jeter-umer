import { ART_THEMES, themeOf } from './art-catalog.js';
// Original canvas artwork. No downloaded sprites, remote URLs, or model code.
function surface(scene, key, width, height, paint) {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, width, height);
  paint(texture.context); texture.refresh();
}
function rounded(c, x, y, w, h, radius, color) { c.fillStyle = color; c.beginPath(); c.roundRect(x, y, w, h, radius); c.fill(); }
function ellipse(c, x, y, rx, ry, color) { c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
function glow(c, x, y, radius, color) {
  const gradient = c.createRadialGradient(x, y, 0, x, y, radius); gradient.addColorStop(0, color); gradient.addColorStop(1, color.slice(0, 7) + '00');
  c.fillStyle = gradient; c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
export function createArt(scene, ui) {
  const theme = themeOf(ui.theme), palette = ART_THEMES[theme];
  const sprite = (key, draw) => surface(scene, key, 32, 32, c => { c.scale(0.5, 0.5); draw(c); });
  for (const [frame, stride] of [['player', 0], ['player-run-1', -3], ['player-run-2', 3]]) sprite(frame, c => {
    ellipse(c, 32, 58, 19, 4, '#00000055');
    rounded(c, 12, 24, 40, 25, 9, '#132237');
    rounded(c, 17, 19, 30, 30, 9, ui.playerColor);
    rounded(c, 17, 3, 30, 29, 13, '#ecf7f4');
    rounded(c, 21, 8, 23, 17, 8, '#182c48');
    rounded(c, 24, 10, 16, 9, 4, palette.glow);
    rounded(c, 26, 11, 8, 3, 2, '#ffffffbb');
    rounded(c, 18, 43 + stride, 12, 13, 4, '#dae8ec');
    rounded(c, 34, 43 - stride, 12, 13, 4, '#dae8ec');
    rounded(c, 10, 28 - stride, 9, 17, 4, ui.playerColor);
    rounded(c, 45, 28 + stride, 9, 17, 4, ui.playerColor);
    rounded(c, 26, 34, 12, 6, 2, '#182c48');
    ellipse(c, 35, 37, 2, 2, palette.accent);
    if (theme === 'forest') { ellipse(c, 16, 10, 9, 3, palette.accent); ellipse(c, 43, 5, 8, 3, palette.accent); }
    if (theme === 'neon') { rounded(c, 14, 4, 3, 16, 1, palette.accent); rounded(c, 47, 4, 3, 16, 1, palette.accent); }
  });
  sprite('star', c => {
    glow(c, 32, 32, 30, '#ffd26770');
    c.fillStyle = '#ffd56c'; c.strokeStyle = '#fff4c6'; c.lineWidth = 2; c.beginPath();
    for (let i = 0; i < 10; i++) { const angle = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 10 : 22; const x = 32 + Math.cos(angle) * r, y = 32 + Math.sin(angle) * r; if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.closePath(); c.fill(); c.stroke(); ellipse(c, 28, 26, 4, 2, '#fff8dc');
  });
  sprite('enemy', c => {
    glow(c, 32, 32, 30, '#ff4b6c50');
    rounded(c, 8, 22, 48, 24, 10, '#5e203e'); rounded(c, 13, 14, 38, 29, 12, '#ff738d');
    rounded(c, 18, 22, 28, 12, 5, '#291936'); ellipse(c, 32, 28, 7, 5, '#fff1bd');
    c.strokeStyle = '#ffc2cb'; c.lineWidth = 3; c.beginPath(); c.moveTo(15, 16); c.lineTo(8, 7); c.moveTo(49, 16); c.lineTo(56, 7); c.stroke();
    rounded(c, 17, 44, 10, 8, 3, '#b64168'); rounded(c, 37, 44, 10, 8, 3, '#b64168');
  });
  surface(scene, 'wall', 48, 48, c => {
    rounded(c, 1, 1, 46, 46, 5, palette.ground);
    rounded(c, 3, 3, 42, 5, 2, palette.accent);
    c.strokeStyle = '#ffffff15'; c.lineWidth = 1; c.strokeRect(6.5, 11.5, 35, 29);
    c.fillStyle = '#00000025'; c.fillRect(2, 37, 44, 9);
    if (theme === 'forest') { c.fillStyle = '#9cd68e'; for (let x = 6; x < 45; x += 8) c.fillRect(x, 2 + x % 4, 4, 8); }
    else { rounded(c, 8, 19, 13, 4, 1, '#ffffff18'); rounded(c, 27, 27, 12, 4, 1, palette.glow); }
  });
  surface(scene, 'portal', 48, 48, c => {
    glow(c, 24, 24, 24, palette.accent + '70');
    c.strokeStyle = palette.accent; c.lineWidth = 5; c.beginPath(); c.ellipse(24, 24, 15, 19, 0, 0, Math.PI * 2); c.stroke();
    ellipse(c, 24, 24, 11, 16, '#111a3f'); ellipse(c, 24, 24, 6, 12, palette.glow + '90');
    c.strokeStyle = '#f4eeff'; c.lineWidth = 1; c.beginPath(); c.ellipse(24, 24, 17, 21, 0, -1.5, 0.7); c.stroke();
  });
  surface(scene, `backdrop-${theme}`, 720, 480, c => {
    const gradient = c.createLinearGradient(0, 0, 720, 480); gradient.addColorStop(0, ui.backgroundColor); gradient.addColorStop(1, theme === 'forest' ? '#193e37' : theme === 'neon' ? '#352048' : '#21204c');
    c.fillStyle = gradient; c.fillRect(0, 0, 720, 480);
    if (theme === 'space') {
      glow(c, 530, 130, 240, '#6358aa40'); glow(c, 150, 430, 200, '#326b8d35');
      ellipse(c, 592, 91, 40, 40, '#7269a326'); c.strokeStyle = '#ada0de35'; c.lineWidth = 4; c.beginPath(); c.ellipse(592, 91, 65, 14, -0.4, 0, Math.PI * 2); c.stroke();
    } else if (theme === 'forest') {
      ellipse(c, 580, 67, 34, 34, '#d9ebc82b'); glow(c, 580, 67, 95, '#c6efb51c');
      for (let i = 0; i < 18; i++) {
        const x = i * 45, h = 110 + i * 37 % 170;
        c.fillStyle = i % 2 ? '#071a2055' : '#0a302b70'; c.fillRect(x + 12, 480 - h, 12, h);
        for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x + 18, 480 - h - 80 + k * 35); c.lineTo(x - 24, 480 - h + 15 + k * 35); c.lineTo(x + 60, 480 - h + 15 + k * 35); c.fill(); }
      }
    } else {
      for (let i = 0; i < 22; i++) {
        const x = i * 35, h = 40 + i * 41 % 130;
        rounded(c, x, 480 - h, 28, h, 2, '#49305b50');
        c.fillStyle = '#ec68c334'; for (let y = 490 - h; y < 470; y += 14) c.fillRect(x + 8, y, 4, 3);
      }
      glow(c, 350, 220, 230, '#df56b523');
    }
    for (let i = 0; i < 90; i++) {
      const x = (i * 137 + 23) % 720, y = (i * 73 + 11) % 480;
      ellipse(c, x, y, i % 5 ? 0.7 : 1.4, i % 5 ? 0.7 : 1.4, theme === 'forest' ? '#e1ffc83a' : '#e5efff55');
    }
    c.strokeStyle = palette.glow + '0a'; c.lineWidth = 1;
    for (let x = 0; x <= 720; x += 48) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 480); c.stroke(); }
    for (let y = 0; y <= 480; y += 48) { c.beginPath(); c.moveTo(0, y); c.lineTo(720, y); c.stroke(); }
  });
}
export function drawBackdrop(scene, ui) {
  if(ui.importedBackground&&scene.textures.exists('imported-background')){scene.add.image(360,240,'imported-background').setDisplaySize(720,480).setDepth(-10);return;}
  scene.add.image(0, 0, `backdrop-${themeOf(ui.theme)}`).setOrigin(0).setDepth(-10);
  const palette = ART_THEMES[themeOf(ui.theme)];
  for (let i = 0; i < (ui.particleCount??12); i++) {
    const mote = scene.add.circle((i * 173 + 39) % 720, (i * 97 + 40) % 480, i % 2 ? 1 : 2, parseInt(palette.glow.slice(1), 16), 0.25).setDepth(-5);
    scene.tweens.add({ targets: mote, alpha: 0.6, y: mote.y - 10, duration: (ui.animationMs??1400) + i * 110, yoyo: true, repeat: -1 });
  }
}
