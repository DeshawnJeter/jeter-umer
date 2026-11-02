// Credentials must already be in the server environment or explicitly loaded
// with Node's --env-file option. Never auto-load secrets during ordinary tests.
process.env.GAME_BUILDER_PROVIDER = 'anthropic';
await import('../apps/server/src/index.js');
