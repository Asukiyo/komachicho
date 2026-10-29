import * as THREE from "three";
import {assetUrl} from "@/lib/assets";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import layout from "@/lib/town/layout.json";
import {commissions} from "@/lib/town/content";
import {entrances} from "@/lib/town/places";
export type LoadedTown={root:THREE.Group;growth:THREE.Group[];lanterns:THREE.Vector3[];lanternMaterials:THREE.MeshStandardMaterial[];dispose:()=>void};
function disposeObjects(roots:THREE.Object3D[]){
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
 roots.forEach(root=>root.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}}));
 materials.forEach(m=>{Object.values(m).forEach(v=>{if(v instanceof THREE.Texture)textures.add(v);});m.dispose();});textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());
}
function label(text:string,width:number){
 const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=160;
 const ctx=canvas.getContext("2d")!;ctx.fillStyle="#b39665";ctx.fillRect(0,0,1024,160);
 ctx.fillStyle="#302c25";ctx.font='600 84px "Yu Mincho", "Hiragino Mincho ProN", serif';ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,512,86,960);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,.46),new THREE.MeshStandardMaterial({map:texture,roughness:.86}));mesh.position.set(0,3.55,5.716);return mesh;
}
export async function loadBlenderTown(onProgress:(value:number)=>void):Promise<LoadedTown>{
 const manager=new THREE.LoadingManager();manager.onProgress=(_url,loaded,total)=>onProgress(Math.round(loaded/Math.max(total,1)*100));
 const loader=new GLTFLoader(manager);const outcomes=await Promise.allSettled([loader.loadAsync(assetUrl('models/koharu-architecture.glb')),loader.loadAsync(assetUrl('models/koharu-environment.glb'))]);
 const loaded=outcomes.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
 if(outcomes.some(r=>r.status==='rejected')){disposeObjects(loaded.map(g=>g.scene));throw new Error('町並みを読み込めませんでした。再読み込みするか、町の地図から制作を続けられます。');}
 const architecture=loaded[0].scene,environment=loaded[1].scene,root=new THREE.Group();root.name='Koharu_Blender_Town';root.add(environment);
 const growth:THREE.Group[]=[],lanterns=layout.lamps.map(([x,z])=>new THREE.Vector3(x,3.6,z));
 const lanternMaterials:THREE.MeshStandardMaterial[]=[];
 architecture.traverse(object=>{if(object instanceof THREE.Mesh){for(const m of Array.isArray(object.material)?object.material:[object.material])if(m instanceof THREE.MeshStandardMaterial&&m.name==='Washi lantern'&&!lanternMaterials.includes(m)){m.emissive.set('#ffb66e');m.emissiveIntensity=0;lanternMaterials.push(m);}}});
 const names:Record<string,string>={Antiques:'古道具 風音',Books:'小春文庫',Kimono:'きもの 紬',Pottery:'陶房 土音',Soba:'蕎麦処 竹庵',Incense:'香りの店',RyokanAnnex:'月待ち 別館',Paper:'和紙 こより',Sake:'小春酒舗',DyeStudio:'藍染工房',WestShop:'庭園みやげ',WestResidence:'花屋 はな',EastTea:'川向こう茶屋',EastInn:'川風の宿',Station:'小春駅'};
 function clone(name:string,x:number,z:number,yaw=0){const source=architecture.getObjectByName(name);if(!source)throw new Error('町のモデルが不足しています：'+name);const instance=source.clone(true);instance.position.set(x,0,z);instance.rotation.set(0,yaw,0);root.add(instance);return instance;}
 try{
  for(const b of layout.buildings){const instance=clone(b.kind==='shrine'?'shrine':'machiya_'+b.kind,b.x,b.z,b.yaw);if(b.kind!=='shrine'){instance.add(label('quest' in b?commissions[b.quest!].location:names[b.name]??'小春町',3.9));}}
  layout.lamps.forEach(([x,z])=>clone('street_lamp',x,z));
  for(const [x,z] of [[-5.5,31],[5.5,12],[-5.5,8],[5.5,-10],[-5.5,-12]])clone('planter',x,z);
  clone('torii',45,-33);
  root.updateMatrixWorld(true);
  const batches=new Map<string,THREE.Mesh[]>();
  root.traverse(o=>{if(o instanceof THREE.Mesh){const key=o.geometry.uuid+"|"+(Array.isArray(o.material)?o.material.map(m=>m.uuid).join():o.material.uuid);const batch=batches.get(key)??[];batch.push(o);batches.set(key,batch);}});
  for(const meshes of batches.values()){if(meshes.length<2)continue;const instances=new THREE.InstancedMesh(meshes[0].geometry,meshes[0].material,meshes.length);meshes.forEach((m,i)=>{instances.setMatrixAt(i,m.matrixWorld);m.removeFromParent();});instances.computeBoundingSphere();root.add(instances);}
  // Keep these separate from the static batches: delivery can reveal them immediately.
  for(const door of entrances){
   const group=new THREE.Group();group.name=`Shop_growth_${door.id}`;group.visible=false;
   for(const side of [-1,1]){const planter=architecture.getObjectByName('planter')!.clone(true);planter.position.set(door.x+Math.cos(door.yaw)*2.5*side,0,door.z-Math.sin(door.yaw)*2.5*side);group.add(planter);}
   const sign=label('Webを見てのご来店、ありがとう',2.5);sign.position.set(door.x-Math.sin(door.yaw)*.6,2.6,door.z-Math.cos(door.yaw)*.6);sign.rotation.y=door.yaw;group.add(sign);
   growth[door.id]=group;root.add(group);
  }
  root.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(m=>{if(m instanceof THREE.MeshStandardMaterial&&m.map)m.map.anisotropy=4;});}});
 }catch(error){disposeObjects([root,architecture]);throw error;}
 onProgress(100);return {root,growth,lanterns,lanternMaterials,dispose:()=>disposeObjects([root,architecture])};
}
