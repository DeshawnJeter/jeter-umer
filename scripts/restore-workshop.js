import {restoreSnapshot} from '../apps/server/src/deployment/operations.js';
const [folder,target]=process.argv.slice(2);if(!folder||!target)throw Error('Usage: node scripts/restore-workshop.js BACKUP_DIRECTORY EMPTY_DESTINATION');
const count=await restoreSnapshot(folder,target,process.env.WORKSHOP_BACKUP_KEY);console.log(`Restored ${count} authenticated files to an empty destination. Browser sessions were revoked. Point WORKSHOP_DATA_DIR at this directory and restart.`);
