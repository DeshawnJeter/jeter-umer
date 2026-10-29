import { hudFor } from '../../shared/player-ui.js';
import { defaults, clone } from '../../shared/contracts/index.js';
import { ART_THEMES, themeOf } from '../../shared/art-catalog.js';
export async function work({ context, brief = {} }) {
  const theme = themeOf(brief.theme), colors = ART_THEMES[theme];
  return { artifact: { ...clone(defaults.ui), title: context.plan.title, hud: hudFor(brief.genre), theme, playerColor: colors.playerColor, backgroundColor: colors.backgroundColor } };
}
