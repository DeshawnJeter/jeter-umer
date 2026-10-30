import {inGameHudModel} from './player-ui.js';
export class InGameHud{
  constructor(root,pause){this.root=root;this.stats=root.querySelector('[data-play-stats]');this.pause=root.querySelector('button');this.pause.onclick=pause;this.signature=null;}
  render(state,genre,hud){
    const items=inGameHudModel(genre,hud,state),signature=JSON.stringify([state.phase,state.ready,items]);
    if(signature===this.signature)return;this.signature=signature;
    this.root.hidden=false;this.root.dataset.phase=state.phase;this.pause.disabled=!state.ready;
    const current=[...this.stats.children].map(el=>el.dataset.stat).join(',');
    if(current!==items.map(item=>item.id).join(',')){
      this.stats.replaceChildren(...items.map(item=>{const badge=document.createElement('span');badge.className='play-stat';badge.dataset.stat=item.id;badge.append(document.createElement('span'),document.createElement('strong'));return badge;}));
    }
    for(const [index,item]of items.entries()){const badge=this.stats.children[index];badge.children[0].textContent=item.label;badge.children[1].textContent=item.text;badge.dataset.low=String(item.low);}
  }
}
