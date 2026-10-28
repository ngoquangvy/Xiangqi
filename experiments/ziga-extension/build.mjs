import './settings.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let esbuild;
try { esbuild = require('esbuild'); }
catch { esbuild = require('../../node_modules/esbuild'); }
await esbuild.build({entryPoints:['src/main.js','src/background.js','src/ad-frame-entry.js'],bundle:true,format:'iife',target:'chrome111',outdir:'extension'});
console.log('Built extension/main.js');
