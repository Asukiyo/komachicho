import * as React from "react";
import * as JSXRuntime from "react/jsx-runtime";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { makeExecution } from "./runtime-core.mjs";
const boot=JSON.parse(document.getElementById("town-payload")!.textContent!);
const send=(data:object)=>parent.postMessage({source:"type-town",runId:boot.runId,...data},"*");
const settle=()=>new Promise(resolve=>setTimeout(resolve,40));
const testHost=document.getElementById("test-root")!;
let root:Root|null=null;
const ui={
  buys:0,
  async mount(Component:React.ElementType,props={}){await ui.unmount();root=createRoot(testHost);flushSync(()=>root!.render(React.createElement(Component,props)));await settle();},
  async update(Component:React.ElementType,props={}){if(!root)return ui.mount(Component,props);flushSync(()=>root!.render(React.createElement(Component,props)));await settle();},
  async unmount(){if(root){flushSync(()=>root!.unmount());root=null;}await settle();},
  text:(selector:string)=>testHost.querySelector(selector)?.textContent?.trim()||"",
  texts:(selector:string)=>Array.from(testHost.querySelectorAll(selector)).map(el=>el.textContent?.trim()||""),
  count:(selector:string)=>testHost.querySelectorAll(selector).length,
  body:()=>testHost.textContent||"",
  async click(selector:string){const el=testHost.querySelector<HTMLElement>(selector);if(!el)throw new Error("ボタンが見つかりません："+selector);flushSync(()=>el.click());await settle();},
  async input(selector:string,value:string){const el=testHost.querySelector<HTMLInputElement>(selector);if(!el)throw new Error("入力欄が見つかりません");const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!;flushSync(()=>{setter.call(el,value);el.dispatchEvent(new Event("input",{bubbles:true}));});await settle();}
};
window.addEventListener("error",e=>send({type:"error",error:e.message}));
window.addEventListener("unhandledrejection",e=>send({type:"error",error:String(e.reason?.message||e.reason)}));
async function start(){
 try{
  const execution=makeExecution(boot.payload,{ui,React,modules:{react:React,"react/jsx-runtime":JSXRuntime},onLog:(logs:string[])=>send({type:"logs",logs})});
  const result=await execution.run();
  // The learner's completed component is mounted separately after assessment.
  execution.resetBudget();
  const preview=createRoot(document.getElementById("preview-root")!);
  preview.render(React.createElement(result.preview));
  await settle();
  send({type:"result",checks:result.checks,logs:execution.logs,title:document.title});
  document.addEventListener("click",()=>{execution.resetBudget();setTimeout(()=>send({type:"title",title:document.title}),100);},true);
  document.addEventListener("input",()=>execution.resetBudget(),true);
  new MutationObserver(()=>send({type:"title",title:document.title})).observe(document.querySelector("title")!,{childList:true,subtree:true,characterData:true});
 }catch(error){send({type:"error",error:String(error instanceof Error?error.message:error)});}
}
start();
