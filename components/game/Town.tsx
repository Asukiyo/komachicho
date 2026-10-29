"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { districts } from "@/lib/game/types";
import { RotateCcw, ZoomIn, ZoomOut, Move, MapPin, Sun, Moon } from "lucide-react";

type Props={built:number[];active:number;completed:number[];onSelect:(district:number)=>void};
const positions=[[-8,4],[-3,5],[3,5],[8,4],[-8,-3],[-3,-4],[3,-4],[8,-3]];
export default function Town({built,active,completed,onSelect}:Props){
 const container=useRef<HTMLDivElement>(null);
 const actions=useRef<{zoom:(n:number)=>void;reset:()=>void}>({zoom:()=>{},reset:()=>{}});
 const state=useRef({built,active,completed,onSelect});state.current={built,active,completed,onSelect};
 const [failed,setFailed]=useState(false),[night,setNight]=useState(false),[hover,setHover]=useState<number|null>(null);
 useEffect(()=>{
  if(!container.current)return;
  const el=container.current;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"low-power"});}catch{setFailed(true);return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=night?1.05:1.35;
  el.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color(night?"#142d4c":"#82cbdb");scene.fog=new THREE.Fog(night?"#142d4c":"#82cbdb",65,120);
  const camera=new THREE.PerspectiveCamera(35,1,.1,180);camera.position.set(24,27,33);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,0);controls.enableDamping=true;controls.dampingFactor=.07;controls.enablePan=false;controls.minDistance=24;controls.maxDistance=75;controls.minPolarAngle=.28;controls.maxPolarAngle=1.12;controls.autoRotate=false;
  const ambient=new THREE.HemisphereLight(night?"#9fc0f8":"#fff5d9",night?"#46679c":"#69997a",night?1.1:2.8);scene.add(ambient);
  const sun=new THREE.DirectionalLight(night?"#aec6ff":"#fff2cf",night?1:4.2);sun.position.set(-18,30,18);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-23;sun.shadow.camera.right=23;sun.shadow.camera.top=23;sun.shadow.camera.bottom=-23;sun.shadow.normalBias=.025;scene.add(sun);
  const materials=new Map<string,THREE.MeshStandardMaterial>();
  const mat=(color:string)=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.82}));return materials.get(color)!;};
  const geo:THREE.BufferGeometry[]=[];
  function mesh(g:THREE.BufferGeometry,color:string,parent:THREE.Object3D=scene){geo.push(g);const m=new THREE.Mesh(g,mat(color));m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function box(x:number,y:number,z:number,w:number,h:number,d:number,color:string,parent:THREE.Object3D=scene){const m=mesh(new THREE.BoxGeometry(w,h,d),color,parent);m.position.set(x,y,z);return m;}
  function sphere(x:number,y:number,z:number,r:number,color:string,parent:THREE.Object3D=scene){const m=mesh(new THREE.IcosahedronGeometry(r,1),color,parent);m.position.set(x,y,z);return m;}
  function cylinder(x:number,y:number,z:number,r:number,h:number,color:string,parent:THREE.Object3D=scene,top=r,segments=12){const m=mesh(new THREE.CylinderGeometry(top,r,h,segments),color,parent);m.position.set(x,y,z);return m;}
  const ocean=mesh(new THREE.PlaneGeometry(220,220),night?"#173f62":"#63b7d0");ocean.rotation.x=-Math.PI/2;ocean.position.y=-2.0;ocean.castShadow=false;
  const beach=box(0,-1,0,29,1.8,23,"#e8cf93");beach.geometry=new THREE.CylinderGeometry(17,17.4,1.8,8);geo.push(beach.geometry);beach.scale.set(1,.85,.79);beach.rotation.y=Math.PI/8;
  const land=box(0,-.25,0,27,.7,21,"#75b88c");
  // Roads and paving are functional routes between the eight buildable plots.
  box(0,.12,0,25,.15,2.2,"#e7d9b8");box(0,.12,0,2.2,.15,19,"#e7d9b8");
  for(const [x,z] of positions){box(x,.12,z,4.7,.18,5.3,"#cee0ba");box(x,.14,z/2,1,.12,Math.abs(z),"#e7d9b8");}
  const fountain=cylinder(0,.3,0,1.4,.5,"#e2e1ce");cylinder(0,.58,0,1.18,.1,"#5ed8e3");cylinder(0,1,0,.3,.9,"#f4ebcf");sphere(0,1.6,0,.28,"#80e4dc");
  const buildings:THREE.Group[]=[],foundation:THREE.Group[]=[],pins:THREE.Mesh[]=[];
  const glass=night?"#ffd477":"#487681";
  positions.forEach(([x,z],i)=>{
   const group=new THREE.Group();scene.add(group);group.position.set(x,.2,z);buildings.push(group);
   const color=districts[i].color;
   const height=i===7?5.5:i===4?3.8:2.3+(i%3)*.35;
   if(i===0){
    box(0,.6,0,2.8,1.15,1.8,"#e9ad65",group);box(0,1.3,0,3.05,.18,2.1,"#654b40",group);
    for(const a of [-1.3,1.3])for(const b of [-.8,.8])cylinder(a,1.95,b,.065,1.8,"#765542",group);
    for(let stripe=0;stripe<6;stripe++){const awning=box(-1.4+stripe*.55,2.85,0,.55,.12,2.6,stripe%2?"#fff1d5":color,group);awning.rotation.x=.08;}
    for(let n=0;n<4;n++)cylinder(-.9+n*.6,1.52,.1,.17,.3,"#faf1da",group);
   }else{
    box(0,height/2,0,3.35,height,3.25,i===7?"#f0e5ce":i===6?"#d2e9c5":"#f5e9d3",group);
    box(0,.16,0,3.65,.3,3.55,"#d2bca1",group);
    if(i===6){const roof=mesh(new THREE.ConeGeometry(2.6,1.5,4),"#76c8ac",group);roof.position.y=height+.75;roof.rotation.y=Math.PI/4;}
    else if(i===7){box(0,height+.18,0,3.7,.35,3.65,color,group);const tower=cylinder(0,height+1,0,.68,1.7,"#f9f0d8",group);const cap=mesh(new THREE.ConeGeometry(.92,1.3,6),"#46636a",group);cap.position.y=height+2.3;}
    else {const roof=mesh(new THREE.CylinderGeometry(0,2.55,1.5,4,1),color,group);roof.rotation.y=Math.PI/4;roof.position.y=height+.68;roof.scale.z=.95;}
    box(0,.8,1.65,.75,1.6, .09,"#52666c",group);
    for(const wx of [-1.1,1.1]) {box(wx,1.5,1.67,.72,.82,.08,glass,group);box(wx,1.5,1.73,.04,.86,.04,"#faf2d8",group);box(wx,1.5,1.73,.76,.04,.04,"#faf2d8",group);}
    for(const wz of [-.9,.9])box(1.69,1.5,wz,.08,.85,.75,glass,group);
    if(i===1||i===2||i===5)for(let n=0;n<7;n++)box(-1.5+n*.5,2.2,2,.49,.15,1,n%2?"#faf5dd":color,group);
    if(i===4){cylinder(1.2,3.5,0,.12,3,"#555969",group);box(1.4,4.8,0,.6,.6,.07,color,group);}
    if(i===3){box(.8,height+1,0,.55,1.25,.6,"#816f74",group);}
    if(i===6){for(const a of [-1.1,1.1]){cylinder(a,.3,2,.27,.45,"#ba8263",group);sphere(a,.8,2,.5,"#4b9971",group);}}
   }
   if(i===0) group.children.forEach((child,index)=>{if(index>=2)child.userData.requiresBuild=true;});
   const ghost=new THREE.Group();ghost.position.copy(group.position);scene.add(ghost);foundation.push(ghost);
   box(0,.08,0,3.4,.16,3.4,"#bdd6b4",ghost);
   for(const a of [-1.6,1.6]) for(const b of [-1.6,1.6]) {box(a,.45,b,.13,.8,.13,"#d7bc8d",ghost);}
   box(0,.55,1.6,3.25,.12,.1,"#e9d9b1",ghost);
   const pin=mesh(new THREE.OctahedronGeometry(.32),color);pin.position.set(x,4.2,z);pin.userData.district=i;pins.push(pin);
   group.traverse(obj=>{obj.userData.district=i;});ghost.traverse(obj=>{obj.userData.district=i;});
  });
  // Small trees, lamps and boats remain as orientation landmarks as the city grows.
  for(let i=0;i<24;i++){
    const side=i<12?-1:1;const x=-12.2+(i%12)*2.2;const z=side*(8.8+Math.sin(i*2)*.35);
    cylinder(x,.5,z,.1,1,"#85654a");sphere(x,1.5,z,.65,i%3===0?"#b1ce72":i%3===1?"#47926c":"#6da976");
  }
  for(const x of [-10,-5,5,10]){
   cylinder(x,.85,1.8,.055,1.7,"#4a6564");const lamp=sphere(x,1.8,1.8,.16,"#ffe9a6");
   if(night){const l=new THREE.PointLight("#ffc567",3,4);l.position.copy(lamp.position);scene.add(l);}
  }
  for(let p=0;p<7;p++)box(-1.5+p*.5,-.55,12,.45,.18,4,"#ad805b");
  for(const x of [-1.8,1.8])for(const z of [10.4,13.5])cylinder(x,-.55,z,.12,1.8,"#795942");
  const boat=new THREE.Group();boat.position.set(5,-1.3,13);scene.add(boat);
  const hull=mesh(new THREE.CapsuleGeometry(.65,1.8,4,8),"#fff4d5",boat);hull.rotation.z=Math.PI/2;hull.scale.z=.65;
  cylinder(0,1.1,0,.055,2.7,"#705c50",boat);const sail=mesh(new THREE.ConeGeometry(.8,2,3),"#f29b70",boat);sail.position.set(.3,1.6,0);sail.scale.z=.035;
  const ring=mesh(new THREE.TorusGeometry(2.45,.06,6,64),"#ffea86");ring.rotation.x=Math.PI/2;ring.position.y=.3;
  const walkers:THREE.Group[]=[];
  for(let n=0;n<5;n++){const p=new THREE.Group();scene.add(p);cylinder(0,.45,0,.13,.5,["#f3a975","#667e9d","#e4c672","#a995cb","#77c7bf"][n],p);sphere(0,.85,0,.16,"#f0cfaa",p);walkers.push(p);}
  const rays=new THREE.Raycaster(),pointer=new THREE.Vector2();let pointerDown={x:0,y:0};
  const locate=(event:PointerEvent)=>{const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);rays.setFromCamera(pointer,camera);return rays.intersectObjects([...buildings,...foundation,...pins],true).find(hit=>hit.object.userData.district!==undefined)?.object.userData.district as number|undefined;};
  const down=(e:PointerEvent)=>{pointerDown={x:e.clientX,y:e.clientY};};
  const up=(e:PointerEvent)=>{if(Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)<6){const i=locate(e);if(i!==undefined)state.current.onSelect(i);}};
  const move=(e:PointerEvent)=>{const i=locate(e);setHover(i??null);renderer.domElement.style.cursor=i!==undefined?"pointer":"grab";};
  renderer.domElement.addEventListener("pointerdown",down);renderer.domElement.addEventListener("pointerup",up);renderer.domElement.addEventListener("pointermove",move);
  const lost=(event:Event)=>{event.preventDefault();setFailed(true);};renderer.domElement.addEventListener("webglcontextlost",lost);
  actions.current={zoom:n=>{const dir=camera.position.clone().sub(controls.target);dir.multiplyScalar(n);if(dir.length()>=24&&dir.length()<=75)camera.position.copy(controls.target.clone().add(dir));},reset:()=>{camera.position.set(24,27,33);controls.target.set(0,0,0);}};
  const resize=new ResizeObserver(()=>{const {width,height}=el.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/Math.max(height,1);camera.updateProjectionMatrix();});resize.observe(el);
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let frame=0,last=0;
  function animate(time:number){frame=requestAnimationFrame(animate);if(time-last<32||document.hidden)return;last=time;
    const t=time/1000;
    
    buildings.forEach((group,i)=>{const isBuilt=state.current.built.includes(i);group.visible=isBuilt||i===0;foundation[i].visible=!group.visible;const target=group.visible?1:.01;group.scale.y+= (target-group.scale.y)*.1;group.children.forEach(child=>{if(child.userData.requiresBuild)child.visible=isBuilt;});pins[i].visible=i===state.current.active||(!isBuilt&&[0,1,2,3].every(n=>state.current.completed.includes(i*4+n)));pins[i].position.y=(isBuilt?(i===7?8.6:5.2):i===0?3.6:1.65)+(reduced?0:Math.sin(t*2+i)*.15);if(!reduced)pins[i].rotation.y=t;});
    const [x,z]=positions[state.current.active];ring.position.set(x,.31,z);
    if(!reduced){boat.position.y=-1.3+Math.sin(t)*.09;boat.rotation.z=Math.sin(t*.7)*.025;walkers.forEach((p,i)=>{p.position.set(Math.sin(t*.13+i*1.2)*10,.16,Math.cos(i)*.5);p.rotation.z=Math.sin(t*8+i)*.045;});}
    controls.update();renderer.render(scene,camera);
  }
  frame=requestAnimationFrame(animate);
  return ()=>{cancelAnimationFrame(frame);resize.disconnect();controls.dispose();geo.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();};
 },[night]);
 return <div className={`town-scene ${night?"night":""}`}>
  <div ref={container} className="town-canvas" role="img" aria-label="8地区のお店を建設できる3Dの島。ドラッグで回転、ホイールで拡大。地区は学習マップからも選べます。" />
  <div className="town-caption"><span className="eyebrow">YOUR LITTLE WORLD</span><h2>{districts[active].name}</h2><p><MapPin size={14}/>{hover!==null?districts[hover].shop:districts[active].shop}</p></div>
  <div className="town-weather"><button aria-label={night?"昼の街にする":"夜の街にする"} onClick={()=>setNight(!night)}>{night?<Moon size={17}/>:<Sun size={17}/>}<span>{night?"星あかり":"晴れ、制作日和"}</span></button></div>
  <div className="town-controls"><span><Move size={13}/>ドラッグで街を回転</span><div><button aria-label="街を拡大" onClick={()=>actions.current.zoom(.86)}><ZoomIn size={17}/></button><button aria-label="街を縮小" onClick={()=>actions.current.zoom(1.16)}><ZoomOut size={17}/></button><button aria-label="視点を戻す" onClick={()=>actions.current.reset()}><RotateCcw size={16}/></button></div></div>
  {failed&&<div className="webgl-fallback"><strong>この環境では3Dを表示できません</strong><p>学習マップから同じ依頼を進められます。コードの実行と街づくりの記録は利用できます。</p><div>{districts.map((d,i)=><button key={d.name} onClick={()=>onSelect(i)}>{built.includes(i)?"✓ ":""}{d.name}</button>)}</div></div>}
 </div>;
}
