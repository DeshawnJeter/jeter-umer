function luminance(hex) { const v = hex.slice(1).match(/../g).map(c => parseInt(c, 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722; }
import { validateHud } from '../../shared/player-ui.js';
import { themeOf } from '../../shared/art-catalog.js';
export async function check({ artifact, context, brief = {} }) {
  const a = luminance(artifact.playerColor), b = luminance(artifact.backgroundColor);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); const findings = validateHud(artifact.hud, brief.genre || 'collector');
  if (ratio < 3) findings.push('Player and background need at least 3:1 contrast');
  if (artifact.title !== context.plan.title) findings.push('UI title differs from the plan');
  if (themeOf(artifact.theme) !== themeOf(brief.theme)) findings.push('Art theme differs from the human choice');
  return { verdict: findings.length ? 'fail' : 'pass', findings, evidence: [`Player/background contrast ${ratio.toFixed(2)}:1`, 'Compared title against checked plan'] };
}
