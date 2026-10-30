import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID,createHash} from 'node:crypto';import {validId} from './projects.js';
export function inspectAsset(bytes){
 if(!bytes.length||bytes.length>2*1024*1024)throw Error('Asset must be at most 2 MB');
 if(bytes.length>24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR'){
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);if(!width||!height||width>2048||height>2048)throw Error('PNG dimensions must be 1–2048 pixels');
  let data=false,end=false;for(let pos=8;pos+12<=bytes.length;){const length=bytes.readUInt32BE(pos),tag=bytes.toString('ascii',pos+4,pos+8),next=pos+12+length;if(next>bytes.length)throw Error('Invalid PNG chunk');if(tag==='IDAT'&&length)data=true;if(tag==='IEND'){if(length||next!==bytes.length)throw Error('Invalid PNG ending');end=true;break;}pos=next;}
  if(bytes.readUInt32BE(8)!==13||!data||!end)throw Error('PNG requires complete image data and ending');return {kind:'image',extension:'png',width,height};
 }
 if(bytes.length>44&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE'){
  let format,duration;for(let pos=12;pos+8<=bytes.length;){const tag=bytes.toString('ascii',pos,pos+4),size=bytes.readUInt32LE(pos+4),start=pos+8;if(start+size>bytes.length)throw Error('Invalid WAV chunk');
   if(tag==='fmt '){if(size<16||bytes.readUInt16LE(start)!==1||![1,2].includes(bytes.readUInt16LE(start+2))||bytes.readUInt16LE(start+14)!==16)throw Error('Use 16-bit PCM mono/stereo WAV');const channels=bytes.readUInt16LE(start+2),rate=bytes.readUInt32LE(start+4);if(rate<8000||rate>48000)throw Error('WAV sample rate must be 8–48 kHz');format={channels,sampleRate:rate};}
   if(tag==='data'){if(!format)throw Error('WAV format must precede data');duration=size/(format.channels*format.sampleRate*2);}pos=start+size+(size%2);
  }
  if(!format||!Number.isFinite(duration)||duration<=0||duration>60)throw Error('WAV must contain up to 60 seconds of PCM audio');return {kind:'audio',extension:'wav',...format,duration};
 }
 throw Error('Use PNG images or 16-bit PCM WAV audio; executable/vector formats are not accepted');
}
export class Assets{
 constructor(root,projects){this.root=resolve(root,'project-assets');this.projects=projects;}
 file(projectId,asset){return resolve(this.root,validId(projectId),validId(asset.id)+'.'+(asset.kind==='image'?'png':'wav'));}
 async add(projectId,data){
  await this.projects.get(projectId);for(const [key,max]of [['name',60],['license',120],['attribution',200]])if(typeof data[key]!=='string'||data[key].length>max||key!=='attribution'&&!data[key].trim())throw Error('Asset name and license are required');
  if(typeof data.base64!=='string'||data.base64.length>2800000||!/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64)||data.base64.length%4)throw Error('Invalid asset encoding');
  const bytes=Buffer.from(data.base64,'base64'),details=inspectAsset(bytes),asset={id:randomUUID(),...details,name:data.name.trim(),license:data.license.trim(),attribution:data.attribution.trim(),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,createdAt:new Date().toISOString()};
  await mkdir(resolve(this.root,projectId),{recursive:true});const file=this.file(projectId,asset);await writeFile(file,bytes,{flag:'wx'});
  try{return await this.projects.update(projectId,p=>{p.assets??=[];if(p.assets.length>=24)throw Error('At most 24 assets per project');p.assets.push(asset);});}catch(error){await unlink(file);throw error;}
 }
 async bytes(projectId,id){const project=await this.projects.get(projectId),asset=project.assets?.find(a=>a.id===id);if(!asset)throw Error('Asset not found');const bytes=await readFile(this.file(projectId,asset));if(createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('Asset changed on disk');return {asset,bytes};}
}
