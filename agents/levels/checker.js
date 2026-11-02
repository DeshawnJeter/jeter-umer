export function inspectLevel(level) {
  const key = p => `${p.x},${p.y}`; const walls = new Set(level.walls.map(key));
  const findings = [];
  const occupied = [level.spawn, level.exit, ...level.stars].map(key);
  if (new Set(occupied).size !== occupied.length) findings.push('Spawn, exit, and stars must occupy distinct cells');
  if (occupied.some(p => walls.has(p))) findings.push('Required objects cannot overlap walls');
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
  return { findings, reachableCells: visited.size };
}
export async function check({ artifact }) {
  const { findings, reachableCells } = inspectLevel(artifact);
  return { verdict: findings.length ? 'fail' : 'pass', findings, evidence: [`Flood-filled ${reachableCells} grid cells from spawn`, 'Checked distinct object placement and wall overlap'] };
}
