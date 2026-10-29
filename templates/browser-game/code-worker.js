import {createGame} from './generated/rules.js';
import {components,inspectSnapshot,SnapshotContractError} from './code-game.js';
let game=createGame(components);
onmessage=event=>{
  let stage='operation';
  try{
    const {operation,dt,input}=event.data;
    if(operation==='reset')game=createGame(components);
    else if(operation==='start')game.start();
    else if(operation==='step')game.update(Math.max(0,Math.min(0.1,dt)),input||{});
    else if(operation!=='inspect')throw Error('Invalid worker operation');
    stage='inspect';const snapshot=game.inspect();stage='validate';postMessage({snapshot:inspectSnapshot(snapshot)});
  }catch(error){postMessage({error:error instanceof SnapshotContractError?error.message:stage==='inspect'?'inspect() threw. Initialize all arrays, health and score during createGame before the first inspect(), not only in start().':'Generated game failed its runtime contract'});}
};
