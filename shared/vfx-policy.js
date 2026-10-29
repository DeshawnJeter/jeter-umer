export const VFX_DEFAULTS=Object.freeze({enabled:true,maxParticles:48,particlesPerBurst:6,shake:0.003,flashMs:80});
export function vfxAllowed(config,settings){return config.enabled&&!settings?.reducedEffects&&config.maxParticles>0;}
