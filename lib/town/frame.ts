import type { WebCheck, WebFiles } from "./types";
export function documentFrame(runner:string,id:string,files:WebFiles,compiled:unknown,checks:WebCheck[]=[]){
 const boot=JSON.stringify({id,files,compiled,checks}).replaceAll("<","\\u003c");
 const safeRunner=runner.replace(/<\/script/gi,"<\\/script");
 return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'"><style>body{font-family:system-ui,sans-serif;color:#28332d;margin:0;padding:16px;background:white}button,input,select{font:inherit}button{cursor:pointer}[hidden]{display:none!important}*{box-sizing:border-box}</style></head><body><script id="town-boot" type="application/json">${boot}</script><script>${safeRunner}</script></body></html>`;
}
