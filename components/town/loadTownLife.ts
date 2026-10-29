import * as THREE from "three";
import { assetUrl } from "@/lib/assets";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function disposeModel(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose();
  });
  geometries.forEach(g => g.dispose());
  materials.forEach(m => m.dispose());
}

export type Citizen = { root: THREE.Object3D; update: (dt: number, speed: number) => void };
export type Citizens = { create: (color: string, height?: number) => Citizen; dispose: () => void };
export async function loadCitizens(): Promise<Citizens> {
  const model = await new GLTFLoader().loadAsync(assetUrl("models/koharu-citizen.glb"));
  const idle = model.animations.find(a => a.name === "Idle"), walk = model.animations.find(a => a.name === "Walk");
  if (!idle || !walk) { disposeModel(model.scene); throw new Error("人物のアニメーションを読み込めませんでした。"); }
  const instances: { root: THREE.Object3D; mixer: THREE.AnimationMixer; tint: THREE.Material[] }[] = [];
  return {
    create(color, height = 1) {
      const root = clone(model.scene), tint: THREE.Material[] = [];
      root.scale.setScalar(height);
      root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = true; object.receiveShadow = true;
        const replace = (m: THREE.Material) => {
          if (m.name !== "Citizen_Indigo" || !(m instanceof THREE.MeshStandardMaterial)) return m;
          const copy = m.clone(); copy.color.set(color); tint.push(copy); return copy;
        };
        object.material = Array.isArray(object.material) ? object.material.map(replace) : replace(object.material);
      });
      const mixer = new THREE.AnimationMixer(root), idleAction = mixer.clipAction(idle).play(), walkAction = mixer.clipAction(walk).play();
      walkAction.setEffectiveWeight(0);
      let blend = 0;
      // Offset breathing so residents don't all move at the same instant.
      idleAction.time = instances.length * .37 % idle.duration;
      instances.push({ root, mixer, tint });
      return { root, update(dt, speed) {
        blend = THREE.MathUtils.damp(blend, speed > .05 ? 1 : 0, 12, dt);
        idleAction.setEffectiveWeight(1 - blend); walkAction.setEffectiveWeight(blend);
        walkAction.setEffectiveTimeScale(Math.max(.8, speed / 2.5)); mixer.update(dt);
      } };
    },
    dispose() {
      for (const { root, mixer, tint } of instances) {
        mixer.stopAllAction(); mixer.uncacheRoot(root); tint.forEach(m => m.dispose());
        root.traverse(o => { if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose(); });
      }
      disposeModel(model.scene);
    },
  };
}

export type Interior = { root: THREE.Group; products: THREE.Group; dispose: () => void };
export async function loadInterior(): Promise<Interior> {
  const model = await new GLTFLoader().loadAsync(assetUrl("models/koharu-interior.glb"));
  const productsSource = model.scene.getObjectByName("Delivered_products");
  if (!productsSource) { disposeModel(model.scene); throw new Error("店内のモデルを読み込めませんでした。"); }
  model.scene.updateMatrixWorld(true);
  const root = new THREE.Group(), products = new THREE.Group(); root.add(products);
  const buckets = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[]; growth: boolean }>();
  model.scene.traverse(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    let growth = false;
    for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (parent === productsSource) growth = true;
    const key = object.material.uuid + growth;
    const bucket = buckets.get(key) ?? { material: object.material, geometries: [] as THREE.BufferGeometry[], growth };
    bucket.geometries.push(object.geometry.clone().applyMatrix4(object.matrixWorld)); buckets.set(key, bucket);
  });
  for (const bucket of buckets.values()) {
    const merged = mergeGeometries(bucket.geometries);
    if (merged) {
      const mesh = new THREE.Mesh(merged, bucket.material.clone()); mesh.castShadow = true; mesh.receiveShadow = true;
      (bucket.growth ? products : root).add(mesh);
    } else {
      // Keep the room usable if future assets have different vertex attributes.
      for (const geometry of bucket.geometries) {
        const mesh = new THREE.Mesh(geometry.clone(), bucket.material.clone()); mesh.castShadow = true; mesh.receiveShadow = true;
        (bucket.growth ? products : root).add(mesh);
      }
    }
    bucket.geometries.forEach(g => g.dispose());
  }
  disposeModel(model.scene);
  return { root, products, dispose: () => disposeModel(root) };
}
