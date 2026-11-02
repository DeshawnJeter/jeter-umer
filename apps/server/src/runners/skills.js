import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export const SKILLS = Object.freeze(['planning', 'phaser-scenes', 'tilemap-reachability', 'game-events', 'web-audio', 'playtest-evidence', 'story-and-ui']);
export async function loadSkills(names) {
  if (!Array.isArray(names) || new Set(names).size !== names.length || names.some(name => !SKILLS.includes(name))) throw new Error('Unknown or duplicate application skill');
  return Promise.all(names.map(async name => {
    const instructions = await readFile(resolve('skills', name, 'SKILL.md'), 'utf8');
    if (!instructions.trim()) throw new Error(`Empty skill: ${name}`);
    return { name, instructions };
  }));
}
