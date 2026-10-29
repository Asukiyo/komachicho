import fs from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
await fs.mkdir("public/engine",{recursive:true});
await fs.copyFile("node_modules/typescript/lib/typescript.js","public/engine/typescript.js");
await fs.copyFile("node_modules/typescript/LICENSE.txt","public/engine/typescript-LICENSE.txt");
const libs={};
for(const file of await fs.readdir("node_modules/typescript/lib")){
 if(/^lib\..*\.d\.ts$/.test(file))libs["/"+file]=await fs.readFile("node_modules/typescript/lib/"+file,"utf8");
}
for(const file of ["index.d.ts","global.d.ts","jsx-runtime.d.ts"]){libs["/node_modules/@types/react/"+file]=await fs.readFile("node_modules/@types/react/"+file,"utf8");}
libs["/node_modules/csstype/index.d.ts"]=await fs.readFile("node_modules/csstype/index.d.ts","utf8");
await fs.writeFile("public/engine/types.json",JSON.stringify(libs));
for(const [entry,out] of [["engine/compiler-worker.js","compiler-worker.js"],["engine/execution-worker.js","execution-worker.js"],["engine/frame-runner.tsx","frame-runner.js"],["engine/document-runner.js","document-runner.js"]]){
 await build({entryPoints:[entry],outfile:path.join("public/engine",out),bundle:true,format:"iife",platform:"browser",minify:true,define:{"process.env.NODE_ENV":'"production"'},legalComments:"eof"});
}
console.log("Prepared local TypeScript compiler, complete type libraries, and isolated runners.");
