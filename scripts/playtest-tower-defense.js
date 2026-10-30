import {runTowerDefensePlaytest} from '../apps/server/src/validation/tower-defense-playtest.js';
const report=await runTowerDefensePlaytest({url:process.argv[2]||'http://127.0.0.1:3108/',reportFolder:process.argv[3]||'.local/tower-defense-playtest/checks'});
console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
