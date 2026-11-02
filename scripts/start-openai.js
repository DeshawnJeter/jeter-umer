// Credentials must already be in the server environment. No secret files are auto-loaded.
process.env.GAME_BUILDER_PROVIDER = 'openai';
await import('../apps/server/src/index.js');
