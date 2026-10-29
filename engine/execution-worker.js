import { makeExecution } from "./runtime-core.mjs";
self.onmessage=async ({data})=>{
  try { const execution=makeExecution(data.payload); const result=await execution.run(); self.postMessage({id:data.id,...result,logs:execution.logs}); }
  catch(error){ self.postMessage({id:data.id,error:String(error.message||error),logs:[]}); }
};
