import {VFX_DEFAULTS,vfxAllowed} from './vfx-policy.js';
const colors={damage_taken:0xff677c,enemy_hit:0xffffff,enemy_defeated:0xffc766,spell_cast:0x80dfff,player_shot:0xaaddff,pickup:0x7af0bd,enemy_attack_warning:0xffd166,victory:0x7af0bd,defeat:0xff677c};
export class GameVfx{
  constructor(scene,bus,config={},getSettings=()=>({})){this.scene=scene;this.config={...VFX_DEFAULTS,...config};this.getSettings=getSettings;this.active=[];this.free=[];this.all=new Set();this.time=0;this.tokens=16;this.lastShake=-1;this.dropped=0;this.disposed=false;this.unsubscribe=bus.subscribe(event=>this.receive(event));}
  receive(event){
    if(this.disposed||!vfxAllowed(this.config,this.getSettings()))return;
    const count=Math.min(this.config.particlesPerBurst,this.config.maxParticles-this.active.length,Math.floor(this.tokens));
    this.dropped+=Math.max(0,this.config.particlesPerBurst-count);this.tokens-=count;
    for(let i=0;i<count;i++){
      const node=this.free.pop()||this.scene.add.circle(0,0,3,colors[event.type]||0xffffff).setDepth(40);this.all.add(node);node.setVisible(true).setAlpha(0.8).setFillStyle(colors[event.type]||0xffffff).setPosition(event.x??360,event.y??240);
      const angle=(i/Math.max(1,count))*Math.PI*2,trail=event.type==='player_shot';this.active.push({node,x:event.x??360,y:event.y??240,vx:Math.cos(angle)*(trail?15:65),vy:Math.sin(angle)*(trail?15:65),age:0,life:Math.max(0.08,this.config.flashMs/1000)+(trail?0.08:0.25)});
    }
    if(event.type==='damage_taken'&&this.config.shake>0&&this.time-this.lastShake>=0.5){this.lastShake=this.time;this.scene.cameras.main.shake(Math.min(120,this.config.flashMs+30),this.config.shake);}
  }
  update(dt){if(this.disposed)return;this.time+=dt;this.tokens=Math.min(24,this.tokens+24*dt);const allowed=vfxAllowed(this.config,this.getSettings());for(let i=this.active.length-1;i>=0;i--){const p=this.active[i];p.age+=dt;if(!allowed||p.age>=p.life){p.node.setVisible(false);this.free.push(p.node);this.active.splice(i,1);}else{p.x+=p.vx*dt;p.y+=p.vy*dt;p.node.setPosition(p.x,p.y).setAlpha(0.8*(1-p.age/p.life));}}}
  inspect(){return {active:this.active.length,allocated:this.all.size,limit:this.config.maxParticles,dropped:this.dropped,reduced:!!this.getSettings().reducedEffects};}
  dispose(){if(this.disposed)return;this.disposed=true;this.unsubscribe();for(const node of this.all)node.destroy();this.all.clear();this.active.length=0;this.free.length=0;}
}
