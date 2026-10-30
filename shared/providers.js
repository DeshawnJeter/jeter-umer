export const isModelProvider = mode => ['openai', 'anthropic'].includes(mode);
export const providerLabel = mode => mode === 'anthropic' ? 'Claude / Anthropic' : mode === 'openai' ? 'OpenAI' : 'Local demo';
