// Run plain TypeScript in a Worker owned by an opaque-origin sandbox, not the app origin.
export function executionFrame(workerSource: string, payload: unknown, runId: number) {
  const boot = JSON.stringify({ workerSource, payload, runId }).replaceAll("<", "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; worker-src blob:; connect-src 'none'; base-uri 'none'; form-action 'none'"></head><body><script type="application/json" id="execution-boot">${boot}</script><script>
  const boot=JSON.parse(document.getElementById('execution-boot').textContent);
  const send=(data)=>parent.postMessage({source:'type-town',runId:boot.runId,mode:'ts',...data},'*');
  const url=URL.createObjectURL(new Blob([boot.workerSource],{type:'text/javascript'}));
  const worker=new Worker(url);
  worker.onmessage=event=>{if(event.data.id!==boot.runId)return;send({...event.data,type:'result'});worker.terminate();URL.revokeObjectURL(url);};
  worker.onerror=()=>{send({type:'error',error:'コードの実行中にエラーが起きました。'});worker.terminate();URL.revokeObjectURL(url);};
  worker.postMessage({id:boot.runId,payload:boot.payload});
  </script></body></html>`;
}
