import {inspectSnapshot} from './code-game.js';
export class CodeClient{
  constructor(){this.pending=null;this.worker=new Worker(new URL('code-worker.js',import.meta.url),{type:'module'});this.worker.onmessage=e=>{const p=this.pending;if(!p)return;this.pending=null;clearTimeout(p.timer);try{if(e.data.error)throw Error(e.data.error);p.resolve(inspectSnapshot(e.data.snapshot));}catch(error){p.reject(error);}};this.worker.onerror=()=>this.fail('Code worker could not start');}
  fail(message){const pending=this.pending;this.pending=null;if(pending){clearTimeout(pending.timer);pending.reject(Error(message));}this.worker.terminate();}
  request(operation,data={}){if(this.pending)return Promise.reject(Error('Worker request already pending'));return new Promise((resolve,reject)=>{const timer=setTimeout(()=>this.fail('Game code exceeded its response deadline'),1500);this.pending={resolve,reject,timer};this.worker.postMessage({operation,...data});});}
  dispose(){this.fail('Game worker disposed');}
}
