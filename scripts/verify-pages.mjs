import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root="docs", html=await fs.readFile(path.join(root,"index.html"),"utf8");
assert.ok(!/(?:src|href)="\/(?!\/)/.test(html),"HTML assets must work below /repository/");
for(const file of [".nojekyll","engine/compiler-worker.js","engine/typescript.js","engine/types.json","engine/frame-runner.js","engine/document-runner.js","engine/execution-worker.js","models/koharu-citizen.glb","models/koharu-interior.glb","models/koharu-architecture.glb","models/koharu-environment.glb","audio/Day.wav","audio/Night.wav"])await fs.access(path.join(root,file));
const pkg=JSON.parse(await fs.readFile("package.json","utf8"));
for(const name of ["next","vinext","react-server-dom-webpack","@cloudflare/vite-plugin","wrangler","drizzle-orm"])assert.ok(!pkg.dependencies?.[name]&&!pkg.devDependencies?.[name],name+" must not be deployed");
const compiler=await fs.readFile(path.join(root,"engine/compiler-worker.js"),"utf8");assert.ok(!compiler.includes('"/engine/'));
for(const file of ["components/town/TownGame.tsx","components/game/Game.tsx"])assert.ok(!(await fs.readFile(file,"utf8")).includes('fetch("/api/progress"'));
for(const file of ["components/game/Workshop.tsx","components/town/DocumentPreview.tsx"]){const source=await fs.readFile(file,"utf8");assert.ok(source.includes('sandbox="allow-scripts"'));assert.ok(!source.includes('allow-same-origin'));}
const lock=JSON.parse(await fs.readFile("package-lock.json","utf8"));assert.ok(!Object.keys(lock.packages).some(p=>p.includes("react-server-dom")));
await fs.writeFile(path.join(root,"404.html"),html);
console.log("PASS: repository-relative assets, standalone static output, sandbox restrictions, no server runtime or API dependency.");
