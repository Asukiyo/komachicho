"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Building2, Check, CheckCheck, ChevronLeft, ChevronRight, CircleCheck, CircleHelp, Coins, Compass, Flag, Hammer, Lightbulb, LockKeyhole, Map, MapPin, PartyPopper, Rocket, Sparkles, Star, Terminal, Trophy, WifiOff, X, ArrowUpRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { lessons, glossary } from "@/lib/game/lessons";
import { districts, initialProgress, wallet, type ProgressState } from "@/lib/game/types";
import Town from "./Town";
import {loadProgress,updateProgress} from "@/lib/game/progress";
import Workshop from "./Workshop";

type Action={type:"draft";id:number;code:string}|{type:"active"|"complete"|"build";id:number};
export default function Game(){
 const [progress,setProgress]=useState<ProgressState>(initialProgress),[active,setActive]=useState(0),[code,setCode]=useState(lessons[0].starter);
 const [screen,setScreen]=useState("play"),[lessonTab,setLessonTab]=useState("learn"),[hints,setHints]=useState(0),[solution,setSolution]=useState(false);
 const [loaded,setLoaded]=useState(false),[saveStatus,setSaveStatus]=useState<"loading"|"saved"|"saving"|"error">("loading"),[saveError,setSaveError]=useState("");
 const [buildOpen,setBuildOpen]=useState(false),[guideOpen,setGuideOpen]=useState(false),[reward,setReward]=useState<number|null>(null),[pendingComplete,setPendingComplete]=useState<number|null>(null);
 const [building,setBuilding]=useState<number|null>(null),[glossaryQuery,setGlossaryQuery]=useState("");
 const state=useRef(progress);state.current=progress;
 const current=useRef({active,code});current.current={active,code};
 const queue=useRef<Promise<unknown>>(Promise.resolve()),draftTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),dirty=useRef<Record<string,string>>({}),completion=useRef(new Set<number>()),savingCount=useRef(0),hasLoaded=useRef(false);
 const [banner,setBanner]=useState(true);
 const lesson=lessons[active],district=districts[lesson.district],coins=wallet(progress),done=progress.completed.length;
 const title=done===32?"街のオーナー":done>=24?"街の設計士":done>=12?"評判の制作者":done>=4?"かけだし店主":"見習いクリエイター";
 const level=Math.floor(done/4)+1;
 const load=useCallback(async()=>{
  setSaveStatus("loading");setSaveError("");
  try{const data=await loadProgress();
   setProgress(data);state.current=data;setLoaded(true);hasLoaded.current=true;setSaveStatus("saved");
   const next=data.active;
   setActive(next);setCode(dirty.current[next]??data.drafts[next]??lessons[next].starter);
  }catch(error){setSaveStatus("error");setSaveError(error instanceof Error?error.message:"進行を読み込めませんでした。");}
 },[]);
 useEffect(()=>{load();return ()=>{clearTimeout(draftTimer.current);};},[load]);
 const send=useCallback((action:Action):Promise<ProgressState>=>{
  savingCount.current++;setSaveStatus("saving");
  const work=queue.current.catch(()=>{}).then(async()=>{
   const result=await updateProgress(action);
   setProgress(previous=>result.revision>=previous.revision?result:previous);state.current=result;
   if(action.type==="draft"&&dirty.current[action.id]===action.code)delete dirty.current[action.id];
   return result as ProgressState;
  });
  queue.current=work;
  return work.then(result=>{savingCount.current--;if(!savingCount.current){if(Object.keys(dirty.current).length===0){setSaveStatus("saved");setSaveError("");}}return result;}).catch(error=>{savingCount.current--;setSaveStatus("error");setSaveError(error.message);throw error;});
 },[]);
 const persistDraft=useCallback((id:number,value:string)=>{if(hasLoaded.current)send({type:"draft",id,code:value}).catch(()=>{});},[send]);
 const onCode=(value:string)=>{if(loaded)setSaveStatus("saving");setCode(value);dirty.current[active]=value;clearTimeout(draftTimer.current);draftTimer.current=setTimeout(()=>persistDraft(active,value),900);};
 useEffect(()=>{
  const unload=(event:BeforeUnloadEvent)=>{if(Object.keys(dirty.current).length||savingCount.current){event.preventDefault();event.returnValue="";}};
  const hide=()=>{if(document.visibilityState==="hidden"&&hasLoaded.current){const {active:id,code:value}=current.current;if(dirty.current[id]!==undefined){updateProgress({type:"draft",id,code:value}).catch(()=>{});}}};
  window.addEventListener("beforeunload",unload);document.addEventListener("visibilitychange",hide);
  return ()=>{window.removeEventListener("beforeunload",unload);document.removeEventListener("visibilitychange",hide);};
 },[]);
 const unlocked=(id:number)=>id===0||progress.completed.includes(id-1)||progress.completed.includes(id);
 function openLesson(id:number){
  if(!unlocked(id)){toast("前の依頼を完成させると挑戦できます。",{description:lessons[id].title});return;}
  clearTimeout(draftTimer.current);if(dirty.current[active]!==undefined)persistDraft(active,current.current.code);
  setActive(id);setCode(dirty.current[id]??state.current.drafts[id]??lessons[id].starter);setHints(0);setSolution(false);setLessonTab("learn");setScreen("play");
  if(loaded)send({type:"active",id}).catch(()=>{});
 }
 async function onPassed(){
  const id=active;if(state.current.completed.includes(id)||completion.current.has(id))return;
  if(!loaded){setPendingComplete(id);toast("依頼クリア！進行を読み込めたら、報酬を受け取れます。");return;}
  completion.current.add(id);clearTimeout(draftTimer.current);
  try{await send({type:"draft",id,code:current.current.code});await send({type:"complete",id});setPendingComplete(null);setReward(id);}
  catch{setPendingComplete(id);toast.error("課題はクリアしています。保存を再試行して報酬を受け取れます。");}
  finally{completion.current.delete(id);}
 }
 async function retrySave(){
  if(!loaded){await load();return;}
  try{for(const [id,value] of Object.entries(dirty.current))await send({type:"draft",id:Number(id),code:value});
   if(pendingComplete!==null){await send({type:"complete",id:pendingComplete});setReward(pendingComplete);setPendingComplete(null);}else{await send({type:"active",id:active});}
  }catch{}
 }
 async function build(id:number){
  setBuilding(id);try{await send({type:"build",id});toast.success(`${districts[id].shop}がオープン！`,{description:"あなたのコードで、街にひとつ灯りが増えました。"});}catch{}finally{setBuilding(null);}
 }
 const nextIncomplete=lessons.find(l=>!progress.completed.includes(l.id))?.id??31;
 const constructionReady=districts.some((_,i)=>!progress.built.includes(i)&&[0,1,2,3].every(n=>progress.completed.includes(i*4+n)));
 return <div className="game-app">
  <Toaster position="top-center" richColors/>
  <header className="game-header"><a href="#/" className="wordmark" aria-label="タイプタウンの工房"><span className="brand-symbol"><Terminal size={22}/></span><div>TYPE<span>TOWN</span><small>コードで育てる、あなたの街。</small></div></a>
   <nav className="top-nav" aria-label="ゲームのメニュー"><Tabs value={screen} onValueChange={setScreen}><TabsList variant="line"><TabsTrigger value="play"><Compass size={17}/>街と工房</TabsTrigger><TabsTrigger value="map"><Map size={17}/>学習マップ</TabsTrigger><TabsTrigger value="book"><BookOpen size={17}/>コード図鑑</TabsTrigger></TabsList></Tabs></nav>
   <div className="header-stats"><div className="player-level"><span>Lv.{level}</span><small>{title}</small></div><div className="money"><Coins size={20}/><strong>{coins.toLocaleString()}<small> G</small></strong></div><button className="help-button" aria-label="遊び方を読む" onClick={()=>setGuideOpen(true)}><CircleHelp size={20}/></button></div>
  </header>
  <main>
  {saveStatus==="error"&&<div className="save-error" role="alert"><WifiOff size={17}/><span>{saveError} {loaded?"編集中のコードはこの画面に残っています。":"続きが読み込まれるまで、進行と報酬の保存を待っています。"}</span><button onClick={retrySave}>再試行</button></div>}
  {pendingComplete!==null&&loaded&&<div className="save-error success-pending"><CircleCheck size={17}/><span>依頼はクリアしています。報酬の受け取りを再開できます。</span><button onClick={retrySave}>報酬を受け取る</button></div>}
  {screen==="play"&&<div className="play-layout">
   <div className="main-column">
    <div className="journey-bar"><div><span className="district-dot" style={{background:district.color}}/><strong>CHAPTER {String(lesson.district+1).padStart(2,"0")}</strong><span>{district.topic}</span></div><button className={`build-link ${constructionReady?"ready":""}`} onClick={()=>setBuildOpen(true)}><Hammer size={16}/>街を育てる<span>{progress.built.length}/8</span>{constructionReady&&<span className="ready-dot"/>}</button></div>
    <Town built={progress.built} active={lesson.district} completed={progress.completed} onSelect={i=>{const next=lessons.find(l=>l.district===i&&!progress.completed.includes(l.id));openLesson(next?.id??i*4);}}/>
    {banner&&done===0&&<div className="welcome-note"><Sparkles size={17}/><p><strong>ようこそ、見習いクリエイター。</strong> 最初は1行から。右の「学ぶ」を読んで、工房で試してみよう。</p><button aria-label="案内を閉じる" onClick={()=>setBanner(false)}><X size={15}/></button></div>}
    <Workshop key={active} lesson={lesson} code={code} onCode={onCode} onPassed={onPassed} completed={progress.completed.includes(active)}/>
    <div className="bottom-status"><span className={saveStatus==="error"?"error-label":""}>{saveStatus==="saved"?<CheckCheck size={14}/>:saveStatus==="error"?<WifiOff size={14}/>:<span className="saving-dot"/>}{saveStatus==="loading"?"続きから始める準備中":saveStatus==="saving"?"保存中…":saveStatus==="error"?"保存を再試行できます":"進行とコードを保存済み"}</span><span>32の依頼、あなたのペースで。</span></div>
   </div>
   <aside className="lesson-panel" aria-label="依頼と学習内容">
    <div className="lesson-heading"><div className="lesson-index"><span>QUEST {String(active+1).padStart(2,"0")}</span><span>{lesson.minutes}分めやす</span></div><h1>{lesson.title}</h1><div className="topic-tag">{lesson.topic}</div><div className="quest-reward"><span><Coins size={16}/>{district.reward.toLocaleString()} G</span><span>{progress.completed.includes(active)?<><CircleCheck size={14}/>達成済み</>:<><Star size={14}/>初回達成の報酬</>}</span></div></div>
    <div className="client-message"><div className="client-avatar" style={{background:district.color}}>{lesson.client.slice(-1)}</div><div><strong>{lesson.client}</strong><p>{lesson.story}</p></div></div>
    <Tabs value={lessonTab} onValueChange={setLessonTab} className="lesson-tabs"><TabsList variant="line"><TabsTrigger value="learn"><BookOpen size={15}/>学ぶ</TabsTrigger><TabsTrigger value="mission"><Flag size={15}/>依頼</TabsTrigger><TabsTrigger value="hints"><Lightbulb size={15}/>ヒント</TabsTrigger></TabsList>
     <TabsContent value="learn"><div className="lesson-reading"><div className="goal-box"><span>この依頼でできること</span><p>{lesson.goal}</p></div>{lesson.learn.map((part,i)=><section className="reading-section" key={i}><h3><span>{String(i+1).padStart(2,"0")}</span>{part.title}</h3><p>{part.body}</p>{part.code&&<pre><code>{part.code}</code></pre>}</section>)}<Button className="read-next" onClick={()=>{setLessonTab("mission");}}>依頼を確かめて、書いてみよう<ChevronRight size={16}/></Button></div></TabsContent>
     <TabsContent value="mission"><div className="lesson-reading"><div className="goal-box"><span>つくるもの</span><p>{lesson.goal}</p></div><h3 className="mini-heading">完成の条件</h3><ol className="requirements">{lesson.requirements.map((item,i)=><li key={i}><span>{i+1}</span><p>{item}</p></li>)}</ol><div className="mission-tip"><Terminal size={19}/><p>左の工房にコードを書いて「実行して確かめる」を押そう。いろいろな入力で動くか、自動でチェックします。</p></div>{lesson.files&&<div className="mission-tip"><BookOpen size={19}/><p>「支給」と書かれたファイルはクリックして中身を読めます。編集するのはmain.tsです。</p></div>}<button className="text-link" onClick={()=>setLessonTab("hints")}>手が止まったら、ヒントへ<ChevronRight size={14}/></button></div></TabsContent>
     <TabsContent value="hints"><div className="lesson-reading"><h3 className="mini-heading">考えるための、小さな手がかり。</h3><p className="hint-intro">ひとつずつ開けます。ヒントや解答例を使っても、報酬は減りません。</p>{lesson.hints.slice(0,hints).map((hint,i)=><div className="hint-card" key={i}><span>HINT {i+1}</span><p>{hint}</p></div>)}{hints<lesson.hints.length&&<Button variant="outline" className="hint-button" onClick={()=>setHints(hints+1)}><Lightbulb size={16}/>ヒント {hints+1} を開く</Button>}<div className="solution-section"><button className="text-link" onClick={()=>setSolution(!solution)}>{solution?"解答例を閉じる":"解答例を読む"}<ChevronRight size={14}/></button>{solution&&<><pre><code>{lesson.solution}</code></pre><p>一度動かしたら、どの行が何をするか説明してみよう。次に、見ずに書き直すと理解が深まります。</p><Button variant="outline" onClick={()=>{onCode(lesson.solution);toast("解答例を工房へ入れました。実行して動きを確かめよう。");}}>この解答例を工房で試す</Button></>}</div></div></TabsContent>
    </Tabs>
    <div className="lesson-footer"><div className="quest-steps">{[0,1,2,3].map(n=><button key={n} className={`${active===lesson.district*4+n?"current":""} ${progress.completed.includes(lesson.district*4+n)?"complete":""}`} onClick={()=>openLesson(lesson.district*4+n)} aria-label={`依頼${lesson.district*4+n+1} ${lessons[lesson.district*4+n].title}`} disabled={!unlocked(lesson.district*4+n)}>{progress.completed.includes(lesson.district*4+n)?<Check size={14}/>:n+1}</button>)}</div><span>この地区 {progress.completed.filter(i=>Math.floor(i/4)===lesson.district).length}/4</span></div>
   </aside>
  </div>}
  {screen==="map"&&<div className="collection-screen"><div className="collection-heading"><div><span className="eyebrow">YOUR LEARNING JOURNEY</span><h1>小さな一歩が、街になっていく。</h1><p>8つの地区をめぐって、32の依頼を完成させよう。</p></div><Button onClick={()=>openLesson(nextIncomplete)} className="primary-action"><PlayIcon/>続きから学ぶ</Button></div><div className="journey-progress"><span><Flag size={18}/><strong>{done}</strong> / 32 依頼を達成</span><Progress value={done/32*100} aria-label="全体の学習進捗"/><span>{Math.round(done/32*100)}%</span></div><div className="district-grid">{districts.map((d,i)=>{const cleared=lessons.filter(l=>l.district===i&&progress.completed.includes(l.id)).length;return <section key={d.name} className={`district-card ${cleared===4?"cleared":""}`} style={{"--district-color":d.color} as React.CSSProperties}><div className="district-card-heading"><div className="district-number">{String(i+1).padStart(2,"0")}</div><div><h2>{d.name}</h2><p>{d.topic}</p></div><span>{cleared}/4</span></div><div className="district-missions">{lessons.filter(l=>l.district===i).map(l=><button key={l.id} onClick={()=>openLesson(l.id)} className={progress.completed.includes(l.id)?"mission-done":""} disabled={!unlocked(l.id)}><span>{progress.completed.includes(l.id)?<CircleCheck size={18}/>:!unlocked(l.id)?<LockKeyhole size={16}/>:<span className="mission-number">{String(l.id+1).padStart(2,"0")}</span>}</span><div><strong>{l.title}</strong><small>{l.topic}</small></div><ChevronRight size={16}/></button>)}</div><div className="district-card-footer"><span><Building2 size={15}/>{d.shop}</span><span>{progress.built.includes(i)?"開業済み":cleared===4?"建設できます":"4依頼で建設解放"}</span></div></section>;})}</div></div>}
  {screen==="book"&&<div className="collection-screen book-screen"><div className="collection-heading"><div><span className="eyebrow">A LITTLE CODING COMPANION</span><h1>わからない記号は、ここで。</h1><p>書き方を忘れても大丈夫。使いながら、何度でも確かめよう。</p></div><label className="glossary-search"><BookOpen size={17}/><input value={glossaryQuery} onChange={e=>setGlossaryQuery(e.target.value)} placeholder="用語を探す（例：map）" aria-label="コード図鑑を検索"/></label></div><div className="glossary-grid">{glossary.filter(([name,desc])=>(name+desc).toLowerCase().includes(glossaryQuery.toLowerCase())).map(([name,desc,example,id])=><article className="glossary-card" key={name}><h2>{name}</h2><p>{desc}</p><pre><code>{example}</code></pre><button onClick={()=>openLesson(id)} className="text-link">依頼 {String(id+1).padStart(2,"0")} で練習する<ArrowUpRight size={14}/></button></article>)}</div>{!glossary.some(([name,desc])=>(name+desc).toLowerCase().includes(glossaryQuery.toLowerCase()))&&<p className="empty-search">見つかりませんでした。短い言葉で探してみてください。</p>}<div className="official-links"><span>さらに詳しく読む</span><a href="https://www.typescriptlang.org/docs/handbook/2/everyday-types.html" target="_blank" rel="noreferrer">TypeScript 公式ハンドブック<ArrowUpRight size={14}/></a><a href="https://ja.react.dev/learn" target="_blank" rel="noreferrer">React 公式ラーニング<ArrowUpRight size={14}/></a><a href="https://nextjs.org/docs/app/getting-started/project-structure" target="_blank" rel="noreferrer">Next.js ファイル構成<ArrowUpRight size={14}/></a></div></div>}
  </main>
  <Dialog open={buildOpen} onOpenChange={setBuildOpen}><DialogContent className="town-dialog construction-dialog"><DialogHeader><span className="eyebrow">BUILD YOUR TOWN</span><DialogTitle>稼いだお金で、街を育てよう。</DialogTitle><DialogDescription>その地区の4つの依頼を完成させると建設できます。建物はあなたの街に残ります。</DialogDescription></DialogHeader><div className="construction-balance"><span>使えるお金</span><strong><Coins size={19}/>{coins.toLocaleString()} G</strong></div><div className="construction-list">{districts.map((d,i)=>{const built=progress.built.includes(i),ready=[0,1,2,3].every(n=>progress.completed.includes(i*4+n));return <div className="construction-item" key={d.name}><div className="construction-icon" style={{background:d.color}}><Building2 size={25}/></div><div><strong>{d.shop}</strong><p>{built?"街の仲間になりました":ready?d.cost.toLocaleString()+" G で建設":`${d.name}の4依頼を達成しよう`}</p></div><Button disabled={!loaded||built||!ready||coins<d.cost||building!==null} onClick={()=>build(i)} className={built?"built-button":""}>{built?<><Check size={14}/>開業</>:building===i?"建設中":ready?"建てる":<LockKeyhole size={15}/>}</Button></div>;})}</div></DialogContent></Dialog>
  <Dialog open={reward!==null} onOpenChange={open=>{if(!open)setReward(null);}}><DialogContent className="town-dialog reward-dialog">{reward!==null&&<><div className="reward-emblem">{reward===31?<Trophy size={45}/>:<PartyPopper size={42}/>}</div><DialogHeader><span className="eyebrow">{reward===31?"YOUR TOWN, YOUR CREATION":"QUEST COMPLETE"}</span><DialogTitle>{reward===31?"あなたのコードが、街になった。":"できた！街が一歩、前へ。"}</DialogTitle><DialogDescription>{lessons[reward].title}</DialogDescription></DialogHeader><div className="reward-money"><Coins size={26}/>+ {districts[Math.floor(reward/4)].reward.toLocaleString()}<span>G</span></div><div className="takeaway"><span>持ち帰る、ひとつの知識</span><p>{lessons[reward].takeaway}</p></div>{reward%4===3&&!progress.built.includes(Math.floor(reward/4))&&<Button className="primary-action" onClick={()=>{setReward(null);setBuildOpen(true);}}><Hammer size={17}/>この地区のお店を建てる</Button>}<Button variant={reward%4===3?"outline":"default"} className={reward%4!==3?"primary-action":""} onClick={()=>{const id=reward;setReward(null);if(id<31)openLesson(id+1);else setScreen("map");}}>{reward===31?"歩んだ学習マップを見る":"次の依頼へ"}<ChevronRight size={17}/></Button></>}</DialogContent></Dialog>
  <Dialog open={guideOpen} onOpenChange={setGuideOpen}><DialogContent className="town-dialog guide-dialog"><DialogHeader><span className="eyebrow">WELCOME TO TYPE TOWN</span><DialogTitle>コードを覚えて、小さな街のオーナーへ。</DialogTitle><DialogDescription>プログラミングが初めてでも、最初の1行から始められます。</DialogDescription></DialogHeader><ol className="guide-steps"><li><BookOpen/><div><strong>読む</strong><p>右側の「学ぶ」で、記号と書き方をひとつずつ知る。</p></div></li><li><Terminal/><div><strong>書く・動かす</strong><p>工房へコードを書いて実行。お店の画面とログで結果を確かめる。</p></div></li><li><Coins/><div><strong>依頼を達成して稼ぐ</strong><p>全チェックに通ると初回報酬。失敗やヒントでお金は減りません。</p></div></li><li><Building2/><div><strong>お店を建てる</strong><p>地区の4依頼を終えたら「街を育てる」へ。8店舗の開業を目指そう。</p></div></li></ol><div className="guide-note">進行とコードはこのブラウザに自動保存されます。小春町の「学習データ」からバックアップできます。時間制限や連続ログインのノルマはありません。3Dはドラッグで回転でき、キーボードでは学習マップから地区を選べます。</div><Button className="primary-action" onClick={()=>setGuideOpen(false)}>工房に戻る<ChevronRight size={16}/></Button></DialogContent></Dialog>
 </div>;
}
function PlayIcon(){return <Rocket size={17}/>;}
