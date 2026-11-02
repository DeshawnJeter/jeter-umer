import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {mkdir,writeFile,readFile,chmod} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
import {passwordHash} from '../apps/server/src/deployment/control.js';
// Password input is consumed from stdin and never echoed or placed in arguments.
const output=resolve(process.argv[2]||'.env/hosted.env');
if(!basename(dirname(output)).startsWith('.env')||!basename(output).endsWith('.env'))throw Error('Write secrets inside an ignored .env directory');
const password=readFileSync(0,'utf8').replace(/\r?\n$/,'');
await mkdir(dirname(output),{recursive:true,mode:0o700});
await writeFile(output,`WORKSHOP_PASSWORD_HASH=${await passwordHash(password)}\nWORKSHOP_SESSION_SECRET=${randomBytes(32).toString('hex')}\nWORKSHOP_BACKUP_KEY=${randomBytes(32).toString('hex')}\n`,{flag:'wx',mode:0o600});
await chmod(output,0o600);console.log('Created private deployment secrets. Keep the backup key in a separate password manager; no model key was copied.');
