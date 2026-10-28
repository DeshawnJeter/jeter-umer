import { ROLES, validateArtifact } from '../../../../shared/contracts/index.js';
import { inspectLevel } from '../../../../agents/levels/checker.js';
export const HUMAN_CHECKS = ['movement', 'collectAndWin', 'timeoutAndRestart', 'audioControls', 'presentation'];
export function validateGame(config) {
  const findings = ROLES.flatMap(role => validateArtifact(role, config[role]).map(message => `${role}: ${message}`));
  if (!findings.length) {
    findings.push(...inspectLevel(config.levels).findings);
    if (config.ui.title !== config.planner.title) findings.push('Integrated title mismatch');
  }
  return { passed: findings.length === 0, findings, evidence: ['Validated every integrated role contract', 'Checked objective reachability and title consistency'], scope: 'Static integration checks only. Browser behavior and audio need human playtesting.' };
}
