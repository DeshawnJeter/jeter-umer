export const emptyUsage = () => ({ calls: 0, pendingCalls: 0, reservedTokens: 0, accountedTokens: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, unreportedCalls: 0 });
export function reserveUsage(usage, limits, estimate) {
  if (usage.calls >= limits.maxCalls || usage.accountedTokens + estimate > limits.maxTotalTokens) {
    const error = new Error('OpenAI call/token budget exhausted. Run remains unfinished.'); error.budgetExhausted = true; throw error;
  }
  if(usage.accountedTokens+usage.reservedTokens+estimate>limits.maxTotalTokens){const error=new Error('OpenAI token budget exhausted by pending reservations; wait for measured usage.');error.budgetPending=true;throw error;}
  usage.calls++; usage.pendingCalls++; usage.reservedTokens += estimate;
}
export function finishUsage(usage, measured, estimate) {
  usage.pendingCalls--; usage.reservedTokens -= estimate;
  if (measured) { usage.inputTokens += measured.inputTokens; usage.outputTokens += measured.outputTokens; usage.totalTokens += measured.totalTokens; usage.accountedTokens += measured.totalTokens; }
  else { usage.unreportedCalls++; usage.accountedTokens += estimate; }
}
export function recoverUsage(usage) {
  usage.accountedTokens += usage.reservedTokens; usage.unreportedCalls += usage.pendingCalls;
  usage.reservedTokens = 0; usage.pendingCalls = 0;
}
