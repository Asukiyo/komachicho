"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {ArrowLeft,Play,Check,BookOpen,Lightbulb,ChevronRight,Save,Loader2} from "lucide-react";
import {Button} from "@/components/ui/button";
import Editor from "@/components/game/Editor";
import type {Commission,TownProjectSave,WebFiles} from "@/lib/town/types";
import {filesKey,languages} from "@/lib/town/types";
import DocumentPreview,{type PreviewRequest,type Result} from "./DocumentPreview";
export default function WebStudio({commission:c,project,onSave,onStep,onClose}:{commission:Commission;project:TownProjectSave;onSave:(files:WebFiles)=>Promise<void>;onStep:(step:number,files:WebFiles)=>Promise<void>;onClose:()=>void}){
 const [files,setFiles]=useState<WebFiles>(project.files),[step,setStep]=useState(Math.min(project.steps.length,2)),[tab,setTab]=useState<keyof WebFiles>(c.stages[Math.min(project.steps.length,2)].language),[request,setRequest]=useState<PreviewRequest|null>(null),[results,setResults]=useState<Result[]>([]),[busy,setBusy]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(""),[savedKey,setSavedKey]=useState(filesKey(project.files)),[hint,setHint]=useState(0),[solution,setSolution]=useState(false),[mobilePanel,setMobilePanel]=useState("code"),[passed,setPassed]=useState<number[]>(project.steps),[verified,setVerified]=useState("");
 const current=useRef(files),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),alive=useRef(true),pending=useRef(Promise.resolve()),savingCount=useRef(0);current.current=files;
 useEffect(()=>{alive.current=true;return ()=>{alive.current=false;clearTimeout(timer.current);};},[]);
 const save=useCallback(async(snapshot:WebFiles)=>{
  savingCount.current++;setSaving(true);
  const task=pending.current.catch(()=>{}).then(()=>onSave(snapshot));pending.current=task;
  try{await task;if(alive.current){setSavedKey(filesKey(snapshot));setError("");}}catch(e){if(alive.current)setError(e instanceof Error?e.message:String(e));throw e;}finally{savingCount.current--;if(alive.current)setSaving(savingCount.current>0);}
 },[onSave]);
 function edit(value:string){const next={...current.current,[tab]:value};setFiles(next);current.current=next;setVerified("");clearTimeout(timer.current);timer.current=setTimeout(()=>{void save(next).catch(()=>{});},1000);}
 async function close(){clearTimeout(timer.current);try{await save(current.current);onClose();}catch{}}
 useEffect(()=>{const handler=(e:BeforeUnloadEvent)=>{if(filesKey(current.current)!==savedKey){e.preventDefault();e.returnValue="";}};window.addEventListener("beforeunload",handler);return ()=>window.removeEventListener("beforeunload",handler);},[savedKey]);
 function run(){if(busy)return;setBusy(true);setError("");setResults([]);setVerified("");setRequest({files:{...current.current},checks:c.stages.slice(0,step+1).flatMap(s=>s.checks),nonce:Date.now()});setMobilePanel("preview");}
 async function checked(checks:Result[]){setResults(checks);setBusy(false);if(!request||!checks.length||!checks.every(r=>r.ok))return;if(filesKey(current.current)!==filesKey(request.files)){setError("実行後にコードが変わりました。新しいコードで再実行しましょう。");return;}
  clearTimeout(timer.current);setSaving(true);
  try{await pending.current.catch(()=>{});await onStep(step,request.files);setSavedKey(filesKey(request.files));setPassed(previous=>Array.from(new Set([...previous,step])));setVerified(filesKey(request.files));}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setSaving(false);}
 }
 function selectStep(index:number){if(busy||saving)return;setStep(index);setTab(c.stages[index].language);setHint(0);setSolution(false);setResults([]);setVerified("");}
 const stage=c.stages[step],isVerified=verified===filesKey(files),dirty=filesKey(files)!==savedKey;
 return <section className="web-studio" aria-label={`${c.name}の制作室`}>
  <header className="studio-top"><button onClick={()=>void close()} disabled={saving} className="studio-back"><ArrowLeft size={17}/>町へ戻る</button><div><small>{c.location}からの依頼</small><h1>{c.name}</h1></div><span className="studio-save"><Save size={14}/>{saving?"保存中…":dirty?"書きかけがあります":"保存済み"}</span></header>
  <nav className="stage-nav" aria-label="制作の段階">{c.stages.map((s,i)=><button key={i} disabled={i>0&&!passed.includes(i-1)||busy||saving} className={i===step?"active":""} onClick={()=>selectStep(i)}><b>{passed.includes(i)?<Check size={15}/>:i+1}</b><span>{languages[s.language].name}<small>{languages[s.language].role}</small></span>{i<2&&<ChevronRight size={14}/>}</button>)}</nav>
  <div className="studio-body"><aside className="lesson-paper"><div className="lesson-kicker"><BookOpen size={15}/>つくりながら学ぶ · {step+1}/3</div><h2>{stage.title}</h2><p>{stage.intro}</p><h3>今回つくるもの</h3><ol>{stage.tasks.map(task=><li key={task}>{task}</li>)}</ol>{stage.learn.map((item,i)=><details key={item.title} open={i===0}><summary>{item.title}</summary><p>{item.body}</p>{item.code&&<pre>{item.code}</pre>}</details>)}<button className="hint-button" onClick={()=>setHint(Math.min(hint+1,stage.hints.length))}><Lightbulb size={15}/>ヒントを見る {hint}/{stage.hints.length}</button>{stage.hints.slice(0,hint).map(h=><p className="hint-text" key={h}>{h}</p>)}<details open={solution} onToggle={e=>setSolution(e.currentTarget.open)}><summary>書き方の完成例を見る</summary><p>読んでから、自分の手で同じ動きを作ってみましょう。</p><pre>{c.solution[stage.language]}</pre></details><p className="gentle-note">間違えても、報酬は減りません。小さく書いて、何度でも実行してみよう。</p></aside>
   <div className="studio-work"><div className="web-toolbar"><div className="web-file-tabs">{(Object.keys(languages) as (keyof WebFiles)[]).map(lang=><button key={lang} className={tab===lang?"active":""} onClick={()=>{setTab(lang);setMobilePanel("code");}}><i className={`lang-dot ${lang}`}/>{languages[lang].file}</button>)}</div><Button onClick={run} disabled={busy||saving}>{busy?<Loader2 className="spin" size={15}/>:<Play size={15}/>}実行して確かめる</Button></div><div className="mobile-work-tabs"><button onClick={()=>setMobilePanel("code")}>コード</button><button onClick={()=>setMobilePanel("preview")}>ページを見る</button></div>
    <div className={`web-split mobile-${mobilePanel}`}><div className="web-editor"><Editor value={files[tab]} language={tab} onChange={edit} onRun={run}/><footer>{languages[tab].name} · 半角で入力 <span>Ctrl / ⌘ + Enter で実行</span></footer></div><DocumentPreview request={request} title={c.slug} onResult={checks=>void checked(checks)} onError={message=>{setError(message);setBusy(false);setVerified("");}}/></div>
    <div className="web-feedback" aria-live="polite">{error&&<div className="web-error"><p>{error}</p>{dirty&&<button onClick={()=>void save(current.current).catch(()=>{})}>書きかけの保存を再試行</button>}</div>}{results.length>0?<><strong>{results.filter(r=>r.ok).length} / {results.length} チェック完了</strong><div className="result-chips">{results.map((r,i)=><span key={i} className={r.ok?"pass":"fail"}>{r.ok?"✓":"○"} {r.label}{!r.ok&&<small>{r.message}</small>}</span>)}</div></>:<p>HTML・CSS・TypeScriptを組み合わせた、実際のページで確認します。</p>}
    {isVerified&&!saving&&<div className="stage-success"><span>✓ {step===2?"ページが完成！住民に納品しましょう。":"この段階をクリアしました。"}</span>{step<2?<Button onClick={()=>selectStep(step+1)}>次は{languages[c.stages[step+1].language].name}<ChevronRight size={15}/></Button>:<Button onClick={()=>void close()}>町へ戻って納品<ArrowLeft size={15}/></Button>}</div>}</div>
   </div>
  </div>
 </section>;
}
