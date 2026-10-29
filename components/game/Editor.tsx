"use client";
import { useEffect, useRef } from "react";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { oneDark } from "@codemirror/theme-one-dark";
export default function Editor({value,onChange,onRun,readOnly=false,language="ts"}:{value:string;onChange:(code:string)=>void;onRun:()=>void;readOnly?:boolean;language?:"html"|"css"|"ts"}){
 const container=useRef<HTMLDivElement>(null),view=useRef<EditorView|null>(null),callbacks=useRef({onChange,onRun});callbacks.current={onChange,onRun};
 useEffect(()=>{
  if(!container.current)return;
  const editor=new EditorView({parent:container.current,state:EditorState.create({doc:value,extensions:[basicSetup,language==="html"?html():language==="css"?css():javascript({typescript:true,jsx:true}),oneDark,EditorView.lineWrapping,EditorState.readOnly.of(readOnly),EditorView.editable.of(!readOnly),EditorView.contentAttributes.of({"aria-label":readOnly?"支給ファイルのコード（読み取り専用）":`${language.toUpperCase()}のコードエディター`,"spellcheck":"false"}),keymap.of([{key:"Mod-Enter",run:()=>{callbacks.current.onRun();return true;}}]),EditorView.theme({"&":{height:"100%",backgroundColor:"#111d30",fontSize:"15px"},".cm-scroller":{fontFamily:'"Cascadia Code", "SFMono-Regular", Consolas, monospace',lineHeight:"1.75",overflow:"auto"},".cm-content":{padding:"16px 0",minHeight:"220px"},".cm-gutters":{backgroundColor:"#111d30",color:"#74869d",border:"none",paddingRight:"10px"},".cm-activeLine":{backgroundColor:"#ffffff05"},".cm-activeLineGutter":{backgroundColor:"transparent"},"&.cm-focused":{outline:"none"},".cm-line":{paddingLeft:"8px",paddingRight:"16px"}}),EditorView.updateListener.of(update=>{if(update.docChanged)callbacks.current.onChange(update.state.doc.toString());})]})});view.current=editor;
  return ()=>{editor.destroy();view.current=null;};
 // The lesson is keyed by the parent. Document updates are handled below without resetting selection.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[readOnly,language]);
 useEffect(()=>{const editor=view.current;if(editor&&editor.state.doc.toString()!==value)editor.dispatch({changes:{from:0,to:editor.state.doc.length,insert:value}});},[value]);
 return <div className="code-editor" ref={container}/>;
}
