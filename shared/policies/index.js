export const policy = Object.freeze({ maxAttempts: 3, concurrency: 3, maxSteps: 40, maxContextChars: 16000 });
export const terminalStates = new Set(['complete', 'cancelled', 'stopped', 'failed']);
export function assertTransition(from, to) {
  const allowed = {
    queued: ['running', 'cancelled'], running: ['awaiting_human', 'awaiting_plan', 'awaiting_review', 'paused', 'failed', 'stopped', 'cancelled'],
    awaiting_plan: ['running', 'cancelled'], awaiting_human: ['running', 'cancelled'], awaiting_review: ['complete', 'running', 'cancelled'], paused: ['running', 'cancelled']
  };
  if (!allowed[from]?.includes(to)) throw new Error(`Invalid transition ${from} -> ${to}`);
}
