import { genreOf } from '../../shared/game-types.js';
import {advancedProfile} from '../../shared/advanced-games.js';
function platformReachability(level, walls, findings) {
  const key = p => `${p.x},${p.y}`;
  for (let x = 0; x < 15; x++) if (!walls.has(`${x},9`)) { findings.push('Platform levels require an unbroken floor on row 9'); break; }
  const standing = [];
  for (let y = 0; y < 9; y++) for (let x = 0; x < 15; x++) if (!walls.has(`${x},${y}`) && walls.has(`${x},${y + 1}`)) standing.push({ x, y });
  const standingKeys = new Set(standing.map(key));
  const required = [level.spawn, level.exit, ...level.stars];
  if (required.some(p => !standingKeys.has(key(p)))) findings.push('Platform objectives and spawn must stand on solid support');
  const visited = new Set([key(level.spawn)]), queue = [level.spawn];
  for (let i = 0; i < queue.length; i++) for (const next of standing) {
    const from = queue[i], dx = Math.abs(next.x - from.x), rise = from.y - next.y;
    if (visited.has(key(next)) || dx > 1 || rise > 2) continue;
    // Conservative jumps: at most one cell across and two cells up, with clear
    // vertical takeoff/landing columns. These bounds work at the minimum speed.
    let clear = true;
    if (rise > 0) for (let y = next.y; y < from.y; y++) if (walls.has(`${from.x},${y}`)) clear = false;
    if (rise <= 0) for (let y = from.y; y <= next.y; y++) if (walls.has(`${next.x},${y}`)) clear = false;
    if (clear) { visited.add(key(next)); queue.push(next); }
  }
  if (required.some(p => !visited.has(key(p)))) findings.push('Platform objectives exceed the conservative jump reachability bounds');
  return { findings, reachableCells: visited.size };
}
export function inspectLevel(level, genre = 'collector') {
  genreOf(genre);
  const key = p => `${p.x},${p.y}`; const walls = new Set(level.walls.map(key));
  const findings = [];
  const occupied = [level.spawn, level.exit, ...level.stars].map(key);
  if (new Set(occupied).size !== occupied.length) findings.push('Spawn, exit, and stars must occupy distinct cells');
  if (occupied.some(p => walls.has(p))) findings.push('Required objects cannot overlap walls');
  if (genre === 'platformer'||advancedProfile(genre)?.platform) return platformReachability(level, walls, findings);
  const visited = new Set([key(level.spawn)]); const queue = [level.spawn];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: p.x + dx, y: p.y + dy }; const id = key(next);
      if (next.x < 0 || next.x > 14 || next.y < 0 || next.y > 9 || walls.has(id) || visited.has(id)) continue;
      visited.add(id); queue.push(next);
    }
  }
  if (occupied.some(p => !visited.has(p))) findings.push('Every star and the exit must be reachable from spawn');
  if (genre === 'survival' && visited.size < 80) findings.push('Survival arenas need at least 80 reachable cells for evasion');
  return { findings, reachableCells: visited.size };
}
export async function check({ artifact, brief = {} }) {
  const { findings, reachableCells } = inspectLevel(artifact, brief.genre);
  return { verdict: findings.length ? 'fail' : 'pass', findings, evidence: [`Checked ${reachableCells} reachable cells/standing positions for ${genreOf(brief.genre)}`, 'Checked distinct object placement, support and wall overlap'] };
}
