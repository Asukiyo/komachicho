"use client";
import {useEffect,useRef,useState} from "react";
import {assetUrl} from "@/lib/assets";
import {documentFrame} from "@/lib/town/frame";
import type {WebFiles,WebCheck} from "@/lib/town/types";
export type Result={label:string;ok:boolean;message:string};
export type PreviewRequest={files:WebFiles;checks:WebCheck[];nonce:number};
export default function DocumentPreview({request,onResult,onError,title="制作中の町のページ"}:{request:PreviewRequest|null;onResult?:(results:Result[])=>void;onError?:(message:string)=>void;title?:string}){
 const frame=useRef<HTMLIFrameElement>(null),callbacks=useRef({onResult,onError}),[src,setSrc]=useState(""),[message,setMessage]=useState("実行すると、あなたのページがここに表示されます。"),[logs,setLogs]=useState<string[]>([]);callbacks.current={onResult,onError};
 useEffect(()=>{
 if(!request)return;let disposed=false;const id=crypto.randomUUID();const worker=new Worker(assetUrl("engine/compiler-worker.js"));let timer:ReturnType<typeof setTimeout>;setSrc("");setMessage("TypeScriptの型を確認しています…");setLogs([]);
 const fail=(message:string)=>{if(disposed)return;clearTimeout(timer);worker.terminate();setMessage(message);callbacks.current.onError?.(message);};
 timer=setTimeout(()=>fail("準備がタイムアウトしました。もう一度実行してください。"),20000);
 worker.onerror=()=>fail("実行の準備ができませんでした。再実行してください。");
 worker.onmessage=async event=>{
  if(disposed||event.data.id!==id)return;
  if(event.data.errors?.length){fail(event.data.errors.map((e:{line:number;message:string})=>`main.ts ${e.line}行目：${e.message}`).join("\n"));return;}
  try{const response=await fetch(assetUrl("engine/document-runner.js"));if(!response.ok)throw new Error("プレビューを読み込めませんでした。");const runner=await response.text();if(disposed)return;clearTimeout(timer);timer=setTimeout(()=>{setSrc("");fail("処理を止めました。繰り返しの終了条件を確認してください。");},7000);setMessage("");setSrc(documentFrame(runner,id,request.files,event.data,request.checks));}catch(e){fail(e instanceof Error?e.message:String(e));}
 };
 const receive=(event:MessageEvent)=>{if(disposed||event.source!==frame.current?.contentWindow||event.data?.source!=="koharu-document"||event.data.id!==id)return;
  if(event.data.type==="result"){clearTimeout(timer);callbacks.current.onResult?.(event.data.results);}
  if(event.data.type==="error")fail(event.data.message);
  if(event.data.type==="logs")setLogs(event.data.logs);
 };
 window.addEventListener("message",receive);worker.postMessage({id,code:request.files.ts,lesson:{checks:[],preview:"null"}});
 return ()=>{disposed=true;clearTimeout(timer);worker.terminate();window.removeEventListener("message",receive);};
 },[request]);
 return <div className="document-preview"><div className="paper-address"><span/><span/><span/><small>koharu.town / {title}</small></div>{message&&<div className="preview-message" role="status"><pre>{message}</pre>{message.includes("行目")&&<p>行番号を手がかりに、括弧・名前・値の型を確認してみましょう。</p>}</div>}{src&&<iframe ref={frame} sandbox="allow-scripts" title={title} srcDoc={src}/>} {!!logs.length&&<details className="web-logs"><summary>console.log · {logs.length}件</summary>{logs.map((log,i)=><pre key={i}>{log}</pre>)}</details>}</div>;
}
