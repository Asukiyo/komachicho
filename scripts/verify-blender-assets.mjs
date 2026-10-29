import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Texture,Box3} from 'three';
const layout=JSON.parse(await fs.readFile('lib/town/layout.json','utf8'));
const loader=new GLTFLoader();
// Parse the actual geometry using Three's production loader. Image decoding is a browser concern;
// this fixture avoids a browser while leaving all scene, material and accessor parsing intact.
loader.register(()=>({name:'NODE_TEXTURE_FIXTURE',loadTexture:()=>Promise.resolve(new Texture())}));
for(const name of ['architecture','environment']){
 const file=await fs.readFile(`public/models/koharu-${name}.glb`);
 assert.equal(file.toString('ascii',0,4),'glTF');assert.equal(file.readUInt32LE(4),2);assert.equal(file.readUInt32LE(8),file.length);
 const jsonLength=file.readUInt32LE(12),doc=JSON.parse(file.toString('utf8',20,20+jsonLength));
 assert.match(doc.asset.generator,/Blender/);assert.ok(doc.images.every(image=>Number.isInteger(image.bufferView)),'textures must be embedded');assert.ok(!doc.extensionsRequired?.includes('KHR_draco_mesh_compression'),'no external decoder needed');
 const buffer=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);const gltf=await loader.parseAsync(buffer,'');
 const bounds=new Box3().setFromObject(gltf.scene);assert.ok(Number.isFinite(bounds.min.x)&&Number.isFinite(bounds.max.y));
 let meshes=0,triangles=0;gltf.scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;assert.ok(o.geometry.attributes.normal);}});
 if(name==='architecture'){
  for(const root of ['machiya_tea','machiya_merchant','machiya_inn','shrine','street_lamp','planter','torii'])assert.ok(gltf.scene.getObjectByName(root),root);
  const house=gltf.scene.getObjectByName('machiya_tea');const box=new Box3().setFromObject(house);assert.ok(box.max.y>7&&box.max.y<10,'Y-up export');assert.ok(box.max.z>5,'front facade faces +Z');
 }
 assert.ok(file.length<25*1024*1024);console.log(`PASS: Blender ${name}: ${meshes} meshes, ${triangles} triangles, embedded textures, valid GLB and successful Three.js geometry import.`);
}
const report=JSON.parse(await fs.readFile('assets/blender/asset-report.json','utf8'));assert.equal(report.buildings,layout.buildings.length);
assert.ok((await fs.stat('assets/blender/koharu-town.blend')).size>100000);
console.log(`PASS: editable Blender town, ${layout.buildings.length} buildings and synchronized layout.`);
