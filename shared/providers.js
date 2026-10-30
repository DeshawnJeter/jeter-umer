// OpenAI is recognized only to display preserved historical run identity.
export const isModelProvider = mode => ['openai', 'anthropic'].includes(mode);
export const providerLabel = mode => mode === 'anthropic' ? 'Claude / Anthropic' : mode === 'openai' ? 'Historical OpenAI' : 'Local demo';
