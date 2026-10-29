import { compile } from "./compiler-core.mjs";
importScripts(new URL("typescript.js", self.location.href).href);
let libs;
self.onmessage=async ({data})=>{
  try {
    libs ||= await fetch(new URL("types.json", self.location.href).href).then(r=>{if(!r.ok)throw new Error("型データを読み込めませんでした");return r.json()});
    self.postMessage({id:data.id,...compile(self.ts,libs,data)});
  } catch(error) { self.postMessage({id:data.id,errors:[{code:0,line:1,character:1,message:String(error.message||error)}]}); }
};
