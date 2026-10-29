import { ROLES, validateArtifact } from '../../../../shared/contracts/index.js';
import { inspectLevel } from '../../../../agents/levels/checker.js';
import { validateHud } from '../../../../shared/player-ui.js';
import {CORE_ROLES,EXTENSION_SPECS} from '../../../../shared/specialists.js';
import {BASE_HUMAN_CHECKS} from '../../../../shared/lifecycle.js';
export const HUMAN_CHECKS = BASE_HUMAN_CHECKS;
export function validateGame(config) {
  const findings = [...CORE_ROLES,...Object.keys(EXTENSION_SPECS).filter(role=>Object.hasOwn(config,role))].flatMap(role => validateArtifact(role, config[role]).map(message => `${role}: ${message}`));
  if (!findings.length) {
    findings.push(...inspectLevel(config.levels, config.genre).findings);
    if (config.ui.title !== config.planner.title) findings.push('Integrated title mismatch');
    if (config.ui.hud !== undefined) findings.push(...validateHud(config.ui.hud, config.genre || 'collector'));
  }
  return { passed: findings.length === 0, findings, evidence: ['Validated every integrated role contract', 'Checked objective reachability and title consistency'], scope: 'Static integration checks only. Browser behavior and audio need human playtesting.' };
}
