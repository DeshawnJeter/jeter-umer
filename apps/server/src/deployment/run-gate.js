// Limits expensive build/browser work across runs, independently of model role concurrency.
export class RunGate {
 constructor(limit=1){if(!Number.isInteger(limit)||limit<1||limit>5)throw Error('Invalid run concurrency');this.limit=limit;this.active=0;this.waiting=[];}
 acquire(signal){return new Promise((yes,no)=>{const cancel=()=>{const index=this.waiting.indexOf(grant);if(index>=0)this.waiting.splice(index,1);const error=Error('Run suspended while waiting for build capacity');error.suspended=true;no(error);};const grant=()=>{signal?.removeEventListener('abort',cancel);if(signal?.aborted)return cancel();this.active++;let held=true;yes(()=>{if(!held)return;held=false;this.active--;while(this.active<this.limit&&this.waiting.length)this.waiting.shift()();});};if(signal?.aborted)return cancel();if(this.active<this.limit)grant();else{this.waiting.push(grant);signal?.addEventListener('abort',cancel,{once:true});}});}
}
