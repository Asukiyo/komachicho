"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Play, RotateCcw, CircleCheck, CircleX, Terminal, Code2, Loader2, Monitor, ChevronDown, Braces } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Lesson } from "@/lib/game/types";
import Editor from "./Editor";
import { assetUrl } from "@/lib/assets";
import { executionFrame } from "@/lib/game/execution-frame";

type Check={label:string;pass:boolean;error?:string};
type Diagnostic={code:number;line:number;character:number;file?:string;message:string};
type Preview={title:string;headline?:string;detail?:string;items?:string[]};
type CompilerResult={errors:Diagnostic[];js?:string;modules?:Record<string,string>;syntax?:object;kind?:string;id:number};
const frameStyle=`*{box-sizing:border-box}body{margin:0;color:#253e44;background:#fbfcf8;font:16px/1.65 system-ui,-apple-system,sans-serif;padding:22px}h1{font-size:24px;line-height:1.4;margin:0 0 18px}h2{font-size:21px;margin:0 0 10px}p{margin:10px 0}article{padding:18px;border:1px solid #d7e5dc;border-radius:12px;background:white}label{display:flex;flex-direction:column;font-size:14px;gap:6px}input{width:100%;border:1px solid #b3c9c3;border-radius:7px;padding:10px 12px;font:inherit;background:white;color:#253e44}button{cursor:pointer;border:0;border-radius:7px;background:#17745f;color:white;padding:9px 14px;font:600 14px/1.5 system-ui;margin:6px 6px 6px 0}button:hover{background:#105642}button:focus-visible,input:focus-visible{outline:3px solid #ffce56;outline-offset:2px}ul{padding:0;list-style:none}li{border-bottom:1px solid #dbe5dd;padding:10px 0;display:flex;align-items:center;justify-content:space-between;gap:10px}small{color:#556c67;font-size:14px}#test-root{position:fixed;top:0;left:-20000px;width:500px}`;
function explain(d:Diagnostic){
 if(d.code===2322||d.code===2345)return "値の種類が合っていません。引用符の有無と、指定された型を確認しましょう。";
 if(d.code===2304||d.code===2552)return "名前が見つかりません。変数を先に作ったか、大文字・小文字が合っているか確認しましょう。";
 if(d.code===2307)return "読み込み先が見つかりません。支給ファイルの名前と import のパスを確認しましょう。";
 if(d.code===2741||d.code===2739)return "必要な項目が足りません。型に書かれた項目を、データにも入れましょう。";
 if(d.code===2339)return "この値には、その名前の項目がありません。項目名とデータの型を確認しましょう。";
 if(d.code===18048||d.code===2532||d.code===18046)return "値があるか、どんな種類かを確かめてから使いましょう。";
 if(d.code===2355||d.code===2366)return "関数が結果を返していません。return と、すべての条件で値を返すかを確認しましょう。";
 if(d.code>=1000&&d.code<1200)return "書き方を確認しましょう。括弧・引用符の閉じ忘れや、全角の記号がないか探してみてください。";
 return "下の行番号とメッセージを手がかりに、少しずつ直してみましょう。";
}
export default function Workshop({lesson,code,onCode,onPassed,completed}:{lesson:Lesson;code:string;onCode:(code:string)=>void;onPassed:()=>void;completed:boolean}){
 const [busy,setBusy]=useState(false),[checks,setChecks]=useState<Check[]>([]),[errors,setErrors]=useState<Diagnostic[]>([]),[runtimeError,setRuntimeError]=useState("");
 const [logs,setLogs]=useState<string[]>([]),[preview,setPreview]=useState<Preview|null>(null),[srcDoc,setSrcDoc]=useState("");
 const [activeFile,setActiveFile]=useState("main"),[output,setOutput]=useState("preview"),[reset,setReset]=useState(false),[frameTitle,setFrameTitle]=useState("");
 const compiler=useRef<Worker|null>(null),executor=useRef<Worker|null>(null),iframe=useRef<HTMLIFrameElement>(null),timeout=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),runID=useRef(0),frameRunner=useRef("");
 const latest=useRef({code,lesson,onPassed});latest.current={code,lesson,onPassed};
 const finish=useCallback((result:{checks?:Check[];logs?:string[];preview?:Preview;error?:string})=>{
  clearTimeout(timeout.current);setBusy(false);executor.current?.terminate();executor.current=null;
  if(result.error){setRuntimeError(result.error);setOutput("console");return;}
  setChecks(result.checks||[]);if(result.logs)setLogs(result.logs);if(result.preview)setPreview(result.preview);
  if(result.checks?.length&&result.checks.every(c=>c.pass)) latest.current.onPassed();
 },[]);
 useEffect(()=>{
  const onMessage=(event:MessageEvent)=>{
   if(event.source!==iframe.current?.contentWindow||event.data?.source!=="type-town"||event.data?.runId!==runID.current)return;
   const data=event.data;
   if(data.type==="result"){finish(data);if(data.mode==="ts")setSrcDoc("");if(data.title)setFrameTitle(data.title);}
   if(data.type==="error")finish({error:data.error});
   if(data.type==="logs")setLogs(data.logs||[]);
   if(data.type==="title")setFrameTitle(data.title);
  };
  window.addEventListener("message",onMessage);
  return ()=>{window.removeEventListener("message",onMessage);compiler.current?.terminate();executor.current?.terminate();clearTimeout(timeout.current);runID.current++;};
 },[finish]);
 const run=async()=>{
  if(busy)return;
  const id=++runID.current;
  setBusy(true);setErrors([]);setRuntimeError("");setChecks([]);setLogs([]);setPreview(null);setSrcDoc("");setFrameTitle("");
  executor.current?.terminate();
  const abort=(message:string)=>{if(id!==runID.current)return;compiler.current?.terminate();compiler.current=null;executor.current?.terminate();setSrcDoc("");finish({error:message});};
  timeout.current=setTimeout(()=>abort("処理が長いため止めました。繰り返しや通信の待ち方を確認して、もう一度実行できます。"),18000);
  try {
   if(!compiler.current)compiler.current=new Worker(assetUrl("engine/compiler-worker.js"));
   const compiled=await new Promise<CompilerResult>((resolve,reject)=>{
    compiler.current!.onmessage=event=>{if(event.data.id===id)resolve(event.data);};
    compiler.current!.onerror=()=>reject(new Error("コードを確認する準備ができませんでした。もう一度実行してください。"));
    compiler.current!.postMessage({id,code:latest.current.code,lesson:latest.current.lesson});
   });
   if(id!==runID.current)return;
   if(compiled.errors.length){clearTimeout(timeout.current);setErrors(compiled.errors);setBusy(false);setOutput("console");return;}
   clearTimeout(timeout.current);timeout.current=setTimeout(()=>abort("実行を止めました。無限ループや、終わらない処理がないか確認しましょう。"),7000);
   if(lesson.kind==="react"){
    if(!frameRunner.current){const response=await fetch(assetUrl("engine/frame-runner.js"));if(!response.ok)throw new Error("プレビューを読み込めませんでした。再実行してください。");frameRunner.current=await response.text();}
    const payload=JSON.stringify({payload:compiled,runId:id}).replaceAll("<","\\u003c");
    setSrcDoc(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none';"><meta name="viewport" content="width=device-width,initial-scale=1"><title>お店のプレビュー</title><style>${frameStyle}</style></head><body><div id="test-root"></div><div id="preview-root"></div><script id="town-payload" type="application/json">${payload}</script><script>${frameRunner.current.replace(/<\/script/gi,"<\\/script")}</script></body></html>`);
    setOutput("preview");
   }else{
    const response=await fetch(assetUrl("engine/execution-worker.js"));
    if(!response.ok)throw new Error("実行の準備ができませんでした。");
    const source=await response.text();if(id!==runID.current)return;
    setSrcDoc(executionFrame(source,compiled,id));setOutput("preview");
   }
  }catch(error){abort(error instanceof Error?error.message:String(error));}
 };
 const passCount=checks.filter(c=>c.pass).length;
 return <section className="workshop" aria-label="コードを書く工房">
  <div className="workshop-bar"><div><Code2 size={18}/><strong>コードの工房</strong><span className="file-tag">{lesson.kind?"React + TSX":"TypeScript"}</span></div><div><button className="icon-button" aria-label="この依頼のコードを最初の状態へ戻す" onClick={()=>setReset(true)} disabled={busy}><RotateCcw size={16}/></button><Button onClick={run} disabled={busy} className="run-button">{busy?<Loader2 size={16} className="spin"/>:<Play size={15} fill="currentColor"/>}{busy?"確かめています":"実行して確かめる"}<kbd>⌘ / Ctrl ↵</kbd></Button></div></div>
  <div className="studio-grid"><div className="editor-column">
   <Tabs value={activeFile} onValueChange={setActiveFile} className="file-tabs"><TabsList variant="line"><TabsTrigger value="main"><span className="ts-badge">TS</span>{lesson.kind?"App.tsx":"main.ts"}</TabsTrigger>{Object.keys(lesson.files||{}).map(name=><TabsTrigger key={name} value={name}>{name}<span className="readonly-label">支給</span></TabsTrigger>)}</TabsList><TabsContent value="main"><Editor value={code} onChange={onCode} onRun={run}/></TabsContent>{Object.entries(lesson.files||{}).map(([name,value])=><TabsContent key={name} value={name}><Editor value={value} onChange={()=>{}} onRun={run} readOnly/></TabsContent>)}</Tabs>
   <div className="editor-status"><span><Braces size={12}/>{lesson.kind?"TypeScript JSX":"TypeScript"}</span><span>半角の記号で入力 · 自動インデント</span></div>
  </div><div className="output-column">
   <Tabs value={output} onValueChange={setOutput} className="output-tabs"><TabsList variant="line"><TabsTrigger value="preview"><Monitor size={15}/>お店のサイト</TabsTrigger><TabsTrigger value="console"><Terminal size={15}/>実行ログ{logs.length>0&&<span className="count-pill">{logs.length}</span>}</TabsTrigger></TabsList>
   <TabsContent value="preview" forceMount hidden={output!=="preview"}><div className="browser-address"><span/><span/><span/><small>{frameTitle||"preview / your-shop"}</small></div>
    {srcDoc?<iframe ref={iframe} sandbox="allow-scripts" title="あなたが書いたReactのお店サイト" srcDoc={srcDoc} className="result-frame"/>:preview?<div className="shop-preview"><span className="shop-kicker">{preview.title}</span>{preview.items?<ul>{preview.items.map((item,i)=><li key={i}>{item}</li>)}</ul>:<><h3>{preview.headline}</h3><p>{preview.detail}</p></>}<div className="shop-footer">MADE IN TYPE TOWN <span>✦</span></div></div>:<div className="preview-empty"><div className="preview-symbol"><Code2 size={28}/></div><strong>{busy?"コードから、お店の画面へ。":"最初の1行が、お店を変える。"}</strong><p>{busy?"型を確認して、コードを動かしています。":"コードを書いて実行すると、ここに結果が表示されます。"}</p></div>}
   </TabsContent><TabsContent value="console"><div className="console-output" aria-live="polite">
    {errors.map((error,i)=><div className="diagnostic" key={i}><strong><CircleX size={15}/> {error.file||"main"} · {error.line}行 {error.character}文字目</strong><p>{explain(error)}</p><details><summary>TypeScriptのメッセージ</summary><pre>{error.message}</pre></details></div>)}
    {runtimeError&&<div className="diagnostic"><strong><CircleX size={15}/>処理を確認しよう</strong><p>{runtimeError}</p></div>}
    {logs.map((log,i)=><pre className="log-line" key={i}><span>{String(i+1).padStart(2,"0")}</span>{log}</pre>)}
    {!logs.length&&!errors.length&&!runtimeError&&<p className="quiet-console">console.logで表示した値がここに並びます。</p>}
   </div></TabsContent></Tabs>
  </div></div>
  <div className={`check-bar ${checks.length&&passCount===checks.length?"all-pass":""}`} aria-live="polite">{checks.length?<><span>{passCount===checks.length?<CircleCheck size={16}/>:<CircleX size={16}/>}チェック {passCount} / {checks.length}{completed&&passCount===checks.length?" · 復習もばっちり":""}</span><details><summary>結果を見る<ChevronDown size={14}/></summary><div className="check-details">{checks.map((check,i)=><p key={i}>{check.pass?<CircleCheck size={15}/>:<CircleX size={15}/>}<span>{check.label}{check.error&&<small>{check.error}</small>}</span></p>)}</div></details></>:<span><CircleCheck size={15}/>{busy?"型と動きをチェック中…":"何度でも試せます。エラーでお金は減りません。"}</span>}</div>
  <AlertDialog open={reset} onOpenChange={setReset}><AlertDialogContent className="town-dialog"><AlertDialogHeader><AlertDialogTitle>このコードを最初から書き直す？</AlertDialogTitle><AlertDialogDescription>この依頼の書きかけだけを初期状態に戻します。達成した依頼や所持金はそのままです。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>続けて編集する</AlertDialogCancel><AlertDialogAction onClick={()=>onCode(lesson.starter)}>初期コードに戻す</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </section>;
}
