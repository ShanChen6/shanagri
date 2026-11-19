import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const cwd = new URL('../apps/api/', import.meta.url);
const resolve = createRequire(new URL('package.json', cwd)).resolve;
for (const args of [[resolve('prisma/package.json').replace(/package\.json$/, 'build/index.js'),'generate'],[resolve('prisma/package.json').replace(/package\.json$/, 'build/index.js'),'migrate','deploy'],['prisma/seed.mjs']]) {
  execFileSync(process.execPath,args,{cwd,stdio:'inherit'});
}
