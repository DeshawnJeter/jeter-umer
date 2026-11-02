export const ROLES = ['planner', 'gameplay', 'levels', 'ui', 'story', 'audio'];
export const SPECIALISTS = ROLES.filter(role => role !== 'planner');
export const defaults = {
  planner: { title: 'Star Collector', objective: 'Collect every star and reach the exit.', difficulty: 'beginner' },
  gameplay: { speed: 190, timeLimit: 60 },
  levels: { spawn: { x: 1, y: 1 }, exit: { x: 13, y: 8 }, stars: [{ x: 3, y: 2 }, { x: 8, y: 3 }, { x: 11, y: 6 }], walls: [{ x: 5, y: 4 }, { x: 6, y: 4 }, { x: 7, y: 4 }] },
  ui: { title: 'Star Collector', playerColor: '#66e3bd', backgroundColor: '#111d30' },
  story: { intro: 'Recover the scattered stars, then find the portal.', victory: 'All stars recovered. Mission complete!', defeat: 'Time ran out. Try again!' },
  audio: { enabled: true, volume: 0.18, music: false, pickupFrequency: 660, winFrequency: 880 }
};
export const clone = value => structuredClone(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = (v, max = 180) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const number = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
const point = v => object(v) && Number.isInteger(v.x) && Number.isInteger(v.y) && number(v.x, 0, 14) && number(v.y, 0, 9);
export function validateArtifact(role, value) {
  if (!ROLES.includes(role) || !object(value)) return ['Unknown role or invalid artifact'];
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  if (role === 'planner') {
    check(string(value.title, 60), 'A short game title is required');
    check(string(value.objective), 'A game objective is required');
    check(['beginner', 'experienced'].includes(value.difficulty), 'Difficulty must be beginner or experienced');
  }
  if (role === 'gameplay') { check(number(value.speed, 100, 300), 'Speed must be 100–300'); check(number(value.timeLimit, 20, 180), 'Time limit must be 20–180 seconds'); }
  if (role === 'levels') {
    check(point(value.spawn) && point(value.exit), 'Spawn and exit must be inside the 15 by 10 grid');
    check(Array.isArray(value.stars) && value.stars.length >= 1 && value.stars.length <= 12 && value.stars.every(point), 'Provide 1–12 valid stars');
    check(Array.isArray(value.walls) && value.walls.length <= 60 && value.walls.every(point), 'Provide at most 60 valid walls');
  }
  if (role === 'ui') { check(string(value.title, 60), 'UI title is required'); for (const key of ['playerColor', 'backgroundColor']) check(/^#[0-9a-f]{6}$/i.test(value[key]), `Invalid ${key}`); }
  if (role === 'story') for (const key of ['intro', 'victory', 'defeat']) check(string(value[key]), `Missing or long ${key}`);
  if (role === 'audio') {
    check(typeof value.enabled === 'boolean' && typeof value.music === 'boolean', 'Audio switches must be booleans');
    check(number(value.volume, 0, 0.5), 'Volume must be 0–0.5');
    check(number(value.pickupFrequency, 100, 2000) && number(value.winFrequency, 100, 2000), 'Tone frequencies must be 100–2000 Hz');
  }
  return errors;
}
export function validateBrief(brief) {
  if (!object(brief) || !string(brief.prompt, 2000)) throw new Error('Describe the game in 1–2000 characters');
  if (!['', 'beginner', 'experienced'].includes(brief.difficulty ?? '')) throw new Error('Invalid difficulty');
  if (brief.title !== undefined && !string(brief.title, 60)) throw new Error('Title must be 1–60 characters');
  return { prompt: brief.prompt.trim(), title: brief.title?.trim() || 'Star Collector', difficulty: brief.difficulty || '', music: brief.music === true, askStory: brief.askStory === true };
}
