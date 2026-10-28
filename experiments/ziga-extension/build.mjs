import './settings.mjs';
import { createRequire } from 'node:module';
import {writeFile,rename,rm} from 'node:fs/promises';
const require = createRequire(import.meta.url);
let esbuild;
try { esbuild = require('esbuild'); }
catch { esbuild = require('../../node_modules/esbuild'); }
const built=await esbuild.build({entryPoints:['src/main.js','src/background.js','src/ad-frame-entry.js'],bundle:true,format:'iife',target:'chrome111',outdir:'extension',write:false});
// Replace each artifact atomically: Chromium may still have the old file mapped.
for(const file of built.outputFiles){
  const temporary=file.path+'.'+process.pid+'.tmp';
  try{await writeFile(temporary,file.contents);await rename(temporary,file.path);}
  catch(error){await rm(temporary,{force:true});throw error;}
}
console.log('Built extension/main.js');
