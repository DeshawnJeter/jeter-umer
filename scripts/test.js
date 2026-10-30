import { spawnSync } from 'node:child_process';
// Running tests must never select a paid provider through an inherited environment.
const env = { ...process.env, GAME_BUILDER_PROVIDER: 'demo',GAME_BUILDER_BROWSER_QA:'off' }; delete env.OPENAI_API_KEY; delete env.ANTHROPIC_API_KEY;
const result = spawnSync(process.execPath, ['--test', ...(process.argv.length > 2 ? process.argv.slice(2) : ['tests/*.test.js'])], { stdio: 'inherit', env });
process.exitCode = result.status ?? 1;
