import fs from "node:fs/promises";
import ts from "typescript";
import assert from "node:assert/strict";
import { compile } from "../engine/compiler-core.mjs";
import { makeExecution } from "../engine/runtime-core.mjs";
const source=await fs.readFile("lib/game/lessons.ts","utf8");
const emitted=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {lessons}=await import("data:text/javascript;base64,"+Buffer.from(emitted).toString("base64"));
const libs=JSON.parse(await fs.readFile("public/engine/types.json","utf8"));
assert.equal(lessons.length,32);
let cases=0;
for(const lesson of lessons){
 const payload=compile(ts,libs,{code:lesson.solution,lesson});
 assert.deepEqual(payload.errors,[],`Solution ${lesson.id+1}: ${JSON.stringify(payload.errors)}`);
 if(lesson.kind!=="react"){
   const execution=makeExecution(payload);
   const result=await execution.run();
   assert(result.checks.every(c=>c.pass),`Lesson ${lesson.id+1}: ${JSON.stringify(result.checks)}`);
   cases+=result.checks.length;
   const starter=compile(ts,libs,{code:lesson.starter,lesson});
   if(!starter.errors.length){const r=await makeExecution(starter).run();assert(!r.checks.every(c=>c.pass),`Starter ${lesson.id+1} should require work`);}
 }
}
const bad=compile(ts,libs,{code:'const price: number = "300";',lesson:lessons[3]});
assert(bad.errors.some(e=>e.code===2322),"Must perform real semantic type checking");
const loop=compile(ts,libs,{code:'while (true) {}',lesson:lessons[0]});
assert.throws(()=>makeExecution(loop),/繰り返しが長すぎる/);
console.log(`PASS: 32 reference solutions pass TypeScript; ${cases} executable assertions; incomplete starters, semantic type errors, and infinite-loop guard verified. React solutions typechecked; browser interaction QA not performed.`);
