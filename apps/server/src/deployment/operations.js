import {mkdir,open,readFile,unlink,rename,readdir,stat,lstat,writeFile,rm} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {resolve,sep,relative,isAbsolute} from 'node:path';
import {createCipheriv,createDecipheriv,randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
const heldRoots=new Set();
export async function exclusiveData(root){
 root=resolve(root);if(heldRoots.has(root))throw Error('Storage is already in use by another process');await mkdir(root,{recursive:true,mode:0o700});const path=resolve(root,'server.lock');
 for(let i=0;i<2;i++)try{const file=await open(path,'wx',0o600);heldRoots.add(root);await file.writeFile(String(process.pid));await file.close();return async()=>{try{await unlink(path);}finally{heldRoots.delete(root);}};}catch(e){if(e.code!=='EEXIST')throw e;if(heldRoots.has(root))throw Error('Storage is already in use by another process');const pid=Number(await readFile(path,'utf8'));if(!Number.isSafeInteger(pid)||pid<=0)throw Error('Invalid storage lock; inspect before removing it');if(pid!==process.pid)try{process.kill(pid,0);throw Error('Storage is already in use by another process');}catch(check){if(check.code!=='ESRCH')throw check;}await unlink(path);}throw Error('Cannot acquire storage lock');
}
export async function listData(root,prefix=''){
 const files=[];for(const entry of await readdir(resolve(root,prefix),{withFileTypes:true})){if(entry.name.endsWith('.tmp')||!prefix&&['backups','server.lock','process.lock'].includes(entry.name))continue;const path=prefix+entry.name;
  if(entry.isSymbolicLink())throw Error('Persistent data cannot contain symbolic links');if(entry.isDirectory())files.push(...await listData(root,path+'/'));else if(entry.isFile()){try{const s=await stat(resolve(root,path));files.push({path,size:s.size});}catch(e){if(e.code!=='ENOENT')throw e;}}else throw Error('Unsupported persistent data entry');
 }return files;
}
export async function storageBytes(root){return (await listData(root)).reduce((n,f)=>n+f.size,0);}
function key(value){if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw Error('WORKSHOP_BACKUP_KEY must be a 32-byte hex secret');return Buffer.from(value,'hex');}
export async function snapshot(root,secret,{now=new Date(),retention=7}={}){
 const encryptionKey=key(secret),backupRoot=resolve(root,'backups');await mkdir(backupRoot,{recursive:true,mode:0o700});const name=now.toISOString().replace(/[:.]/g,'-')+'-'+randomBytes(4).toString('hex'),folder=resolve(backupRoot,'.'+name);await mkdir(folder,{mode:0o700});
 try{const files=await listData(root);const manifest={version:1,createdAt:now.toISOString(),files:[]};
  for(let i=0;i<files.length;i++){const file=files[i],iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey,iv);await pipeline(createReadStream(resolve(root,file.path)),cipher,createWriteStream(resolve(folder,i+'.enc'),{flags:'wx',mode:0o600}));manifest.files.push({...file,blob:i+'.enc',iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex')});}
  const data=JSON.stringify(manifest);await writeFile(resolve(folder,'manifest.json'),JSON.stringify({data,mac:createHmac('sha256',encryptionKey).update(data).digest('hex')}),{mode:0o600});await rename(folder,resolve(backupRoot,name));
  const prior=(await readdir(backupRoot)).filter(n=>/^\d{4}-\d\d-\d\dT[\da-fTZ-]+$/.test(n)).sort().reverse();for(const stale of prior.slice(retention)){const target=resolve(backupRoot,stale);if(!target.startsWith(backupRoot+sep))throw Error('Invalid backup path');await rm(target,{recursive:true});}return name;
 }catch(e){if(folder.startsWith(backupRoot+sep))await rm(folder,{recursive:true,force:true});throw e;}
}
export async function restoreSnapshot(folder,target,secret){
 const encryptionKey=key(secret),envelope=JSON.parse(await readFile(resolve(folder,'manifest.json'),'utf8'));if(typeof envelope.data!=='string'||envelope.data.length>10000000)throw Error('Invalid backup manifest');const expected=createHmac('sha256',encryptionKey).update(envelope.data).digest(),given=Buffer.from(envelope.mac||'','hex');if(given.length!==expected.length||!timingSafeEqual(expected,given))throw Error('Backup authentication failed');
 const manifest=JSON.parse(envelope.data);if(manifest.version!==1||!Array.isArray(manifest.files))throw Error('Invalid backup version');
 await mkdir(target,{recursive:true,mode:0o700});if((await readdir(target)).length)throw Error('Restore requires an empty destination and a stopped server');
 const seen=new Set();try{for(let i=0;i<manifest.files.length;i++){const file=manifest.files[i];if(typeof file.path!=='string'||isAbsolute(file.path)||file.path.includes('\\')||file.path.split('/').some(p=>!p||p==='.'||p==='..')||seen.has(file.path)||file.blob!==i+'.enc'||!Number.isSafeInteger(file.size)||file.size<0)throw Error('Invalid backup file');seen.add(file.path);const destination=resolve(target,file.path);if(!destination.startsWith(resolve(target)+sep))throw Error('Invalid backup path');await mkdir(resolve(destination,'..'),{recursive:true,mode:0o700});const iv=Buffer.from(file.iv,'hex'),tag=Buffer.from(file.tag,'hex');if(iv.length!==12||tag.length!==16)throw Error('Invalid backup cipher');const decrypt=createDecipheriv('aes-256-gcm',encryptionKey,iv);decrypt.setAuthTag(tag);await pipeline(createReadStream(resolve(folder,file.blob)),decrypt,createWriteStream(destination,{flags:'wx',mode:0o600}));if((await stat(destination)).size!==file.size)throw Error('Backup size mismatch');}
  // Restored browser sessions must sign in again, even when restoring old state.
  const control=resolve(target,'control.json');try{const state=JSON.parse(await readFile(control,'utf8'));state.sessions={};await writeFile(control,JSON.stringify(state),{mode:0o600});}catch(e){if(e.code!=='ENOENT')throw e;}return manifest.files.length;
 }catch(e){for(const file of await readdir(target)){const path=resolve(target,file);if(path.startsWith(resolve(target)+sep))await rm(path,{recursive:true,force:true});}throw e;}
}
