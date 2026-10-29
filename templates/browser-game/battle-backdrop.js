// A presentation layer above the overworld, below combat sprites and effects.
export function createBattleBackdrop(scene,theme,style='themed'){
  const kind=style==='themed'?theme:style;
  const palettes={forest:[0x071f20,0x214c38],space:[0x11132f,0x39325d],neon:[0x20102f,0x62325c],ruins:[0x161c29,0x3d4658],cavern:[0x151322,0x37304c]};
  const [sky,ground]=palettes[kind]||palettes.space;
  const g=scene.add.graphics().setDepth(10);g.fillStyle(sky,1);g.fillRect(0,0,720,480);g.fillStyle(ground,1);g.fillRect(0,280,720,200);
  for(let i=0;i<9;i++){
    g.fillStyle(ground,0.7);
    if(kind==='forest')g.fillTriangle(i*90-30,300,i*90+35,35+i%3*30,i*90+95,300);
    else if(kind==='cavern')g.fillTriangle(i*90,0,i*90+45,100+i%3*35,i*90+80,0);
    else if(kind==='ruins')g.fillRect(i*95,80+i%2*35,35,220);
    else g.fillCircle((i*137+30)%720,50+i%4*45,3+i%3);
  }
  g.lineStyle(2,0xffffff,0.15);g.lineBetween(0,280,720,280);return g;
}
