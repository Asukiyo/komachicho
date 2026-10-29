export const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const card=(title,headline,detail)=>({title:String(title),headline:String(headline),detail:String(detail)});
export const listCard=(title,items)=>({title,items:items.map(String)});
export async function mockFetch(url){
  await new Promise(resolve=>setTimeout(resolve,35));
  if(url==="/api/offline") throw new Error("練習用の通信エラー");
  const ok=url==="/api/notice"||url==="/api/invalid";
  return {ok,status:ok?200:404,json:async()=>url==="/api/notice"?{message:"配達完了"}:url==="/api/invalid"?{message:42}:{message:"not found"}};
}
export function makeExecution(payload, extras={}) {
  const logs=[];
  let budget=0,start=Date.now();
  function __townGuard(){
    if(++budget>100000 || Date.now()-start>5000) throw new Error("繰り返しが長すぎるため止めました。終了条件を確認しましょう。");
  }
  const format=v=>typeof v==="string"?v:typeof v==="undefined"?"undefined":JSON.stringify(v);
  const log=(...args)=>{ if(logs.length<100)logs.push(args.map(format).join(" ").slice(0,2000)); extras.onLog?.(logs); };
  const mockConsole={log,info:log,warn:log,error:log};
  const cache={};
  function load(name){
    if(extras.modules?.[name])return extras.modules[name];
    if(cache[name])return cache[name].exports;
    if(!payload.modules[name])throw new Error("読み込めるのはreactと支給ファイルです："+name);
    const module={exports:{}};cache[name]=module;
    evaluate(payload.modules[name],module);return module.exports;
  }
  function evaluate(js,module){
    const run=new Function("exports","module","require","console","fetch","__townGuard",'"use strict";\n'+js);
    run(module.exports,module,load,mockConsole,extras.fetch ?? mockFetch,__townGuard);
  }
  const main={exports:{}};evaluate(payload.js,main);
  const ctx={logs,syntax:payload.syntax,equal,card,listCard,...extras};
  return {logs,main,run:()=>main.exports.__townRun(ctx),resetBudget:()=>{budget=0;start=Date.now();}};
}
