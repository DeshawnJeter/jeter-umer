import {createGame} from './generated/rules.js';
import {components,inspectSnapshot} from './code-game.js';
let game=createGame(components);
onmessage=event=>{
  try{
    const {operation,dt,input}=event.data;
    if(operation==='reset')game=createGame(components);
    else if(operation==='start')game.start();
    else if(operation==='step')game.update(Math.max(0,Math.min(0.1,dt)),input||{});
    else if(operation!=='inspect')throw Error('Invalid worker operation');
    postMessage({snapshot:inspectSnapshot(game.inspect())});
  }catch{postMessage({error:'Generated game failed its runtime contract'});}
};
