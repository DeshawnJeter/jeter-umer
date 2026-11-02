// Original procedural artwork is rendered locally; identifiers never become paths.
export const ART_THEMES = Object.freeze({
  space: { name: 'Astral voyage', playerColor: '#77efce', backgroundColor: '#0d142b', accent: '#a798ff', glow: '#70dfff', ground: '#293b64' },
  forest: { name: 'Moonlit forest', playerColor: '#ffe9ad', backgroundColor: '#0b231e', accent: '#90d48b', glow: '#c8f6ad', ground: '#365b4b' },
  neon: { name: 'Neon city', playerColor: '#62f5ff', backgroundColor: '#190e2e', accent: '#ff70c8', glow: '#60e9ff', ground: '#45305f' }
});
export function themeOf(value) {
  const theme = value ?? 'space';
  if (!Object.hasOwn(ART_THEMES, theme)) throw new Error('Unsupported art theme');
  return theme;
}
export const ART_MANIFEST = Object.freeze({ version: 1, source: 'Original Game Workshop procedural canvas artwork', license: 'MIT; see ASSETS-LICENSE.txt', assets: ['backdrop', 'player', 'player-run-1', 'player-run-2', 'star', 'enemy', 'wall', 'portal'], externalAssets: false });
