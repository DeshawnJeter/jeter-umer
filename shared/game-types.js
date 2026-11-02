// Delivered with the game as rules.js. Keep this module browser-compatible.
import {EXTRA_GAME_TYPES} from './extra-game-types.js';
export const GAME_TYPES = Object.freeze({
  collector: { name: 'Star collector', objective: 'Collect every star and reach the exit.', controls: 'Arrow keys or WASD to move. Collect every star, then enter the portal.', intro: 'Recover the scattered stars, then find the portal.', victory: 'All stars recovered. Mission complete!', defeat: 'Time ran out. Try again!' },
  maze: { name: 'Maze escape', objective: 'Find a route through the maze and reach the exit before time runs out.', controls: 'Arrow keys or WASD to move. Find the portal before time runs out. Stars are optional bonuses.', intro: 'Find your way through the maze to the exit. Stars are optional bonuses.', victory: 'You escaped the maze!', defeat: 'The maze timer ran out. Try another route!' },
  platformer: { name: 'Platform adventure', objective: 'Jump between platforms, collect every star, and reach the exit.', controls: 'Left/right or A/D to move. Space, Up or W to jump. Collect every star, then reach the portal.', intro: 'Jump onto platforms, recover every star, and reach the portal.', victory: 'Every star recovered. You cleared the platforms!', defeat: 'Time ran out. Restart and try your jumps again!' },
  survival: { name: 'Survival arena', objective: 'Survive the arena until the timer ends while avoiding the pursuing enemies.', controls: 'Arrow keys or WASD to move. Dodge the drones until time runs out. Stars restore one shield.', intro: 'Survive until the timer ends. Avoid drones; stars restore a shield.', victory: 'You survived the arena!', defeat: 'Your shields ran out. Restart and keep moving!' },
  ...EXTRA_GAME_TYPES
});
export const genreOf = value => {
  const genre = value ?? 'collector';
  if (!Object.hasOwn(GAME_TYPES, genre)) throw new Error('Unsupported game type');
  return genre;
};
export function referenceLevel(genre = 'collector') {
  genreOf(genre);
  const base = { spawn: { x: 1, y: 1 }, exit: { x: 13, y: 8 }, stars: [{ x: 3, y: 2 }, { x: 8, y: 3 }, { x: 11, y: 6 }], walls: [{ x: 5, y: 4 }, { x: 6, y: 4 }, { x: 7, y: 4 }] };
  if (genre === 'maze') base.walls = [3, 7, 11].flatMap((x, column) => Array.from({ length: 8 }, (_, i) => ({ x, y: i + 1 })).filter(p => p.y !== (column % 2 ? 2 : 7))).filter(p => ![base.spawn, base.exit, ...base.stars].some(o => o.x === p.x && o.y === p.y));
  if (genre === 'platformer') {
    base.spawn = { x: 1, y: 8 }; base.stars = [{ x: 3, y: 8 }, { x: 8, y: 6 }, { x: 11, y: 8 }];
    base.walls = [...Array.from({ length: 15 }, (_, x) => ({ x, y: 9 })), ...[7, 8, 9].map(x => ({ x, y: 7 }))];
  }
  if (genre === 'survival') base.walls = [];
  return base;
}
export function roundOutcome({ genre = 'collector', remaining, score, required, atExit = false, health = 3 }) {
  genreOf(genre);
  if (genre === 'survival') return health <= 0 ? 'lost' : remaining <= 0 ? 'won' : 'playing';
  if (remaining <= 0) return 'lost';
  return atExit && (genre === 'maze' || score >= required) ? 'won' : 'playing';
}
