// Compiler and AST instrumentation shared by the browser worker and curriculum validation.
export function inspectSyntax(ts, source) {
  const result={ifCount:0,awaitCount:0,binaryOperators:[],typeMembers:{},jsxAttributes:[],calls:[]};
  function visit(n) {
    if(ts.isIfStatement(n)) result.ifCount++;
    if(ts.isAwaitExpression(n)) result.awaitCount++;
    if(ts.isBinaryExpression(n)) result.binaryOperators.push(n.operatorToken.getText(source));
    if(ts.isTypeAliasDeclaration(n)&&ts.isTypeLiteralNode(n.type)) result.typeMembers[n.name.text]=n.type.members.map(m=>m.name?.getText(source));
    if(ts.isJsxAttribute(n)) result.jsxAttributes.push(n.name.getText(source));
    if(ts.isCallExpression(n)) result.calls.push(n.expression.getText(source));
    ts.forEachChild(n,visit);
  }
  visit(source);return result;
}
export function guardTransform(ts) {
  return context=>{
    const f=context.factory;
    const guard=()=>f.createExpressionStatement(f.createCallExpression(f.createIdentifier("__townGuard"),undefined,[]));
    function visit(node){
      const next=ts.visitEachChild(node,visit,context);
      if(ts.isWhileStatement(next)) return f.updateWhileStatement(next,next.expression,guarded(next.statement));
      if(ts.isDoStatement(next)) return f.updateDoStatement(next,guarded(next.statement),next.expression);
      if(ts.isForStatement(next)) return f.updateForStatement(next,next.initializer,next.condition,next.incrementor,guarded(next.statement));
      if(ts.isForOfStatement(next)) return f.updateForOfStatement(next,next.awaitModifier,next.initializer,next.expression,guarded(next.statement));
      if(ts.isForInStatement(next)) return f.updateForInStatement(next,next.initializer,next.expression,guarded(next.statement));
      if(ts.isFunctionDeclaration(next)&&next.body) return f.updateFunctionDeclaration(next,next.modifiers,next.asteriskToken,next.name,next.typeParameters,next.parameters,next.type,guarded(next.body));
      if(ts.isFunctionExpression(next)) return f.updateFunctionExpression(next,next.modifiers,next.asteriskToken,next.name,next.typeParameters,next.parameters,next.type,guarded(next.body));
      if(ts.isArrowFunction(next)) return f.updateArrowFunction(next,next.modifiers,next.typeParameters,next.parameters,next.type,next.equalsGreaterThanToken,ts.isBlock(next.body)?guarded(next.body):f.createBlock([guard(),f.createReturnStatement(next.body)],true));
      if(ts.isMethodDeclaration(next)&&next.body) return f.updateMethodDeclaration(next,next.modifiers,next.asteriskToken,next.name,next.questionToken,next.typeParameters,next.parameters,next.type,guarded(next.body));
      return next;
    }
    function guarded(statement) { return f.createBlock([guard(),...(ts.isBlock(statement)?statement.statements:[statement])],true); }
    return source=>ts.visitNode(source,visit);
  };
}
export function compile(ts, libs, {code,lesson}) {
  if(code.length>30000) return {errors:[{message:"コードは30,000文字以内で試しましょう。",line:1,character:1,code:0}]};
  const files={...libs,"/main.tsx":code+"\nexport {};"};
  for(const [name,content] of Object.entries(lesson.files||{})) files["/"+name]=content;
  const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,strict:true,skipLibCheck:true,esModuleInterop:true,allowSyntheticDefaultImports:true,moduleResolution:ts.ModuleResolutionKind.Node10,lib:["lib.es2022.d.ts","lib.dom.d.ts"],types:[],noEmit:true};
  const clean=p=>p.replaceAll("\\","/");
  const host={
    getSourceFile:(name,version)=> files[clean(name)]!==undefined?ts.createSourceFile(name,files[clean(name)],version,true):undefined,
    getDefaultLibFileName:()=>"/lib.es2022.d.ts",writeFile:()=>{},getCurrentDirectory:()=>"/",getDirectories:()=>[],
    fileExists:p=>files[clean(p)]!==undefined,readFile:p=>files[clean(p)],getCanonicalFileName:p=>p,useCaseSensitiveFileNames:()=>true,getNewLine:()=>"\n",
    directoryExists:p=>Object.keys(files).some(name=>name.startsWith(p.replace(/\/$/,"")+"/")),
    resolveModuleNames:names=>names.map(name=>{
      let path=name==="react"?"/node_modules/@types/react/index.d.ts":name==="react/jsx-runtime"?"/node_modules/@types/react/jsx-runtime.d.ts":name==="csstype"?"/node_modules/csstype/index.d.ts":name.startsWith("./")?"/"+name.slice(2)+(name.endsWith(".ts")||name.endsWith(".tsx")?"":".ts"):null;
      if(name==="./" || name==="./index") path="/node_modules/@types/react/index.d.ts";
      if(!path||!files[path]) return undefined;
      return {resolvedFileName:path,extension:path.endsWith(".d.ts")?ts.Extension.Dts:ts.Extension.Ts,isExternalLibraryImport:name.startsWith("react")||name==="csstype"};
    })
  };
  const program=ts.createProgram(["/main.tsx"],options,host);
  const diagnostics=ts.getPreEmitDiagnostics(program).filter(d=>d.category===ts.DiagnosticCategory.Error);
  if(diagnostics.length) return {errors:diagnostics.slice(0,8).map(d=>{const loc=d.file?.getLineAndCharacterOfPosition(d.start||0);return {code:d.code,line:(loc?.line||0)+1,character:(loc?.character||0)+1,file:d.file?.fileName?.replace(/^\//,""),message:ts.flattenDiagnosticMessageText(d.messageText,"\n")};})};
  const syntax=inspectSyntax(ts,program.getSourceFile("/main.tsx"));
  const checks=lesson.checks.map(c=>`try { checks.push({ label: ${JSON.stringify(c.label)}, pass: Boolean(await (${c.test})) }); } catch(error) { checks.push({ label: ${JSON.stringify(c.label)}, pass: false, error: String(error?.message || error) }); }`).join("\n");
  const harness=`\nasync function __townRun(ctx) {\nconst {logs,ui,card,listCard,equal,syntax,React}=ctx;\nconst checks=[];\n${checks}\nlet preview=null;\ntry { ${lesson.kind==="react"?'await ui.unmount(); preview = '+lesson.preview+';':'preview = await ('+lesson.preview+');'} } catch(error) { preview={title:"プレビューの準備中",headline:String(error?.message||error),detail:"条件を満たすとお店の画面が完成します"}; }\nreturn {checks,preview};\n}\nexports.__townRun = __townRun;`;
  const transpile=(text,file)=>ts.transpileModule(text,{fileName:file,compilerOptions:{...options,noEmit:false},transformers:{before:[guardTransform(ts)]}}).outputText;
  const modules={};
  for(const [file,text] of Object.entries(lesson.files||{})) modules["./"+file.replace(/\.tsx?$/,"")]=transpile(text,file);
  return {errors:[],js:transpile(code+harness,"main.tsx"),modules,syntax,kind:lesson.kind||"ts"};
}
