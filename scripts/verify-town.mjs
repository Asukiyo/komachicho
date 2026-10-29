import fs from "node:fs/promises";
import assert from "node:assert/strict";
import ts from "typescript";
import {build} from "esbuild";
import {compile} from "../engine/compiler-core.mjs";
import {makeExecution} from "../engine/runtime-core.mjs";
const bundle=await build({entryPoints:["lib/town/content.ts","lib/town/world.ts"],bundle:true,write:false,outdir:"out",platform:"node",format:"esm"});
const imported=await Promise.all(bundle.outputFiles.map(file=>import("data:text/javascript;base64,"+Buffer.from(file.text).toString("base64"))));
const {commissions}=imported.find(m=>m.commissions),{canWalk,nearestResident}=imported.find(m=>m.canWalk);
const libs=JSON.parse(await fs.readFile("public/engine/types.json","utf8"));
const compiled=[];
for(const c of commissions){const result=compile(ts,libs,{code:c.solution.ts,lesson:{checks:[],preview:"null"}});assert.deepEqual(result.errors,[],`${c.name}: solution must compile`);assert.equal(c.stages.length,3);assert.deepEqual(c.stages.map(s=>s.language),["html","css","ts"]);assert.ok(c.stages.every(s=>s.learn.length&&s.tasks.length&&s.checks.length));for(const s of c.stages)for(const check of s.checks)assert.doesNotThrow(()=>new Function(`return (async()=>(${check.test}))()`));assert.ok(canWalk(...c.position),`${c.location}: NPC must be reachable`);assert.equal(nearestResident(...c.position).id,c.id);compiled.push(result);}
assert.equal(canWalk(28,0),false);assert.equal(canWalk(28,20),true);assert.equal(canWalk(28,-28),true);assert.equal(canWalk(90,0),false);
for(const c of commissions)assert.equal(canWalk(...c.building),false);
// Flood-fill the walking grid to catch isolated objectives and inaccessible bridge crossings.
const visited=new Set(["0,36"]),queue=[[0,36]];for(let i=0;i<queue.length;i++){const [x,z]=queue[i];for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,zz=z+dz,key=`${xx},${zz}`;if(!visited.has(key)&&canWalk(xx,zz)){visited.add(key);queue.push([xx,zz]);}}}
for(const c of commissions)assert.ok(visited.has(c.position.join(",")),`${c.location}: path from station`);
// A tiny event fixture checks program behavior, without opening a browser or rendering pages.
class Element {
 constructor(text=""){this.textContent=text;this.value="";this.hidden=false;this.children=[];this.attributes={};this.listeners={};}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 fire(name){for(const fn of this.listeners[name]??[])fn({preventDefault(){}});}
 setAttribute(name,value){this.attributes[name]=value;}
 replaceChildren(){this.children=[];}
 append(el){this.children.push(el);}
}
function execute(id,elements,lists={}){globalThis.document={querySelector:s=>elements[s]??null,querySelectorAll:s=>lists[s]??[],createElement:()=>new Element()};return makeExecution(compiled[id],{fetch:async url=>{await new Promise(r=>setTimeout(r,5));if(url==="/api/offline")throw Error("offline");return {ok:true,json:async()=>({message:"小春まつりは土曜日18時から"})};}});}
let e={"#guide":new Element(),"#message":new Element()};execute(0,e);e["#guide"].fire("click");assert.equal(e["#message"].textContent,"まずは川沿いの茶屋へどうぞ。");
e={"#people":new Element(),"#calculate":new Element(),"#total":new Element()};execute(1,e);e["#people"].value="3";e["#calculate"].fire("click");assert.equal(e["#total"].textContent,"1800円");
e={"#search":new Element(),"#count":new Element()};const products=["桜もち","草もち","どら焼き"].map(x=>new Element(x));execute(2,e,{".products li":products});e["#search"].value="もち";e["#search"].fire("input");assert.equal(e["#count"].textContent,"2件");assert.equal(products.filter(p=>!p.hidden).length,2);e["#search"].value="";e["#search"].fire("input");assert.equal(e["#count"].textContent,"3件");
e={"#booking":new Element(),"#nights":new Element(),"#price":new Element()};execute(3,e);for(const [value,expected] of [["2","16000円"],["","1泊以上の整数を入力してください"],["1.5","1泊以上の整数を入力してください"],["-2","1泊以上の整数を入力してください"]]){e["#nights"].value=value;e["#booking"].fire("submit");assert.equal(e["#price"].textContent,expected);}
e=Object.fromEntries(["#quantity","#sum","#add","#clear"].map(s=>[s,new Element()]));execute(4,e);e["#add"].fire("click");e["#add"].fire("click");assert.equal(e["#sum"].textContent,"3000円");e["#clear"].fire("click");assert.equal(e["#quantity"].textContent,"0個");
e={"#time":new Element(),"#events":new Element()};e["#time"].value="all";execute(5,e);assert.equal(e["#events"].children.length,3);e["#time"].value="night";e["#time"].fire("change");assert.equal(e["#events"].children.length,2);e["#time"].value="morning";e["#time"].fire("change");assert.equal(e["#events"].children[0].textContent,"朝市");
e=Object.fromEntries(["#hours","#fee","#answer-hours","#answer-fee"].map(s=>[s,new Element()]));e["#answer-hours"].hidden=e["#answer-fee"].hidden=true;execute(6,e);e["#hours"].fire("click");assert.equal(e["#answer-hours"].hidden,false);assert.equal(e["#hours"].attributes["aria-expanded"],"true");assert.equal(e["#answer-fee"].hidden,true);e["#hours"].fire("click");assert.equal(e["#answer-hours"].hidden,true);
e=Object.fromEntries(["#load","#offline","#status"].map(s=>[s,new Element()]));execute(7,e);e["#load"].fire("click");assert.equal(e["#status"].textContent,"読み込み中…");await new Promise(r=>setTimeout(r,20));assert.equal(e["#status"].textContent,"小春まつりは土曜日18時から");e["#offline"].fire("click");await new Promise(r=>setTimeout(r,20));assert.equal(e["#status"].textContent,"通信できませんでした。もう一度お試しください。");delete globalThis.document;
console.log(`PASS: ${commissions.length} strict TypeScript solutions, 24 staged lessons, every check expression, 8 event-driven page behaviors, collision bounds, and walkable paths to every resident.`);
