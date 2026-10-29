import { makeExecution } from "./runtime-core.mjs";
const boot=JSON.parse(document.getElementById("town-boot").textContent);
const send=(type,data={})=>parent.postMessage({source:"koharu-document",id:boot.id,type,...data},"*");
let execution;
const safeHTML=()=>{
 const doc=new DOMParser().parseFromString(boot.files.html,"text/html");
 doc.querySelectorAll("script,iframe,object,embed,meta,base,link,style").forEach(el=>el.remove());
 for(const el of doc.querySelectorAll("*"))for(const attr of [...el.attributes]){
  if(/^on/i.test(attr.name)||["srcdoc","formaction","action"].includes(attr.name)||(/^\s*(javascript|vbscript):/i.test(attr.value))) el.removeAttribute(attr.name);
 }
 return doc.body.innerHTML;
};
const template=safeHTML();
async function fakeFetch(url){
 await new Promise(resolve=>setTimeout(resolve,35));
 if(url==="/api/offline")throw new Error("通信失敗");
 return {ok:url==="/api/notice",status:url==="/api/notice"?200:404,json:async()=>({message:"小春まつりは土曜日18時から"})};
}
function reset(){
 document.body.innerHTML=template;
 const sheet=document.createElement("style");sheet.textContent=boot.files.css;document.body.append(sheet);
 execution=makeExecution(boot.compiled,{fetch:fakeFetch,onLog:logs=>send("logs",{logs})});
}
const get=s=>{const el=document.querySelector(s);if(!el)throw new Error(s+" が見つかりません。");return el;};
const all=s=>[...document.querySelectorAll(s)];
const text=s=>get(s).textContent.trim();
const style=s=>getComputedStyle(get(s));
const input=(s,v)=>{const el=get(s);el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));};
const click=s=>get(s).click();
const submit=s=>get(s).dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
window.addEventListener("error",event=>send("error",{message:event.message}));
window.addEventListener("unhandledrejection",event=>send("error",{message:String(event.reason?.message??event.reason)}));
document.addEventListener("click",event=>{execution?.resetBudget();if(event.target.closest?.("a"))event.preventDefault();},true);
document.addEventListener("input",()=>execution?.resetBudget(),true);
document.addEventListener("submit",event=>event.preventDefault());
(async()=>{
 const results=[];
 for(const check of boot.checks){
  try{reset();const run=new Function("get","all","text","style","input","click","submit","wait",`return (async()=>(${check.test}))()`);const ok=Boolean(await run(get,all,text,style,input,click,submit,wait));results.push({label:check.label,ok,message:ok?"できました":"条件をもう一度確認しましょう"});}
  catch(error){results.push({label:check.label,ok:false,message:error.message});}
 }
 reset();send("result",{results});
})().catch(error=>send("error",{message:error.message}));
