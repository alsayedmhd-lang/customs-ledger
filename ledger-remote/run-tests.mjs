import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const tests=(await readdir(new URL('./test/',import.meta.url))).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>'test/'+name);
if(!tests.length)throw Error('No tests found');
const result=spawnSync(process.execPath,['--test',...tests],{cwd:root,stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
