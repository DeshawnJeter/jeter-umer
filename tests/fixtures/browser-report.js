import {requiredBrowserChecks} from '../../apps/server/src/validation/whole-game-acceptance.js';
// Synthetic gate evidence for tests of orchestration/storage, never production QA.
export const passingBrowserReport=(buildHash,genre='collector')=>({scope:'browser-smoke',buildHash,passed:true,browserTested:true,tests:requiredBrowserChecks(genre).map(name=>({name,passed:true}))});
