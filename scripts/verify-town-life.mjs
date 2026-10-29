import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Box3 } from "three";

// Import the production loaders and collision rules, with a local asset transport.
const output = await build({ stdin: { contents: 'export * from "./components/town/loadTownLife";export * from "./lib/town/places";export * from "./lib/town/world";', resolveDir: process.cwd(), loader: "ts" }, write: false, bundle: true, platform: "node", format: "esm" });
const life = await import("data:text/javascript;base64," + Buffer.from(output.outputFiles[0].text).toString("base64"));
const NativeRequest = globalThis.Request, originalFetch = globalThis.fetch;
globalThis.document = { baseURI: "https://assets.test/" };
globalThis.Request = class extends NativeRequest { constructor(input, init) { super(typeof input === "string" && input.startsWith("/") ? `https://assets.test${input}` : input, init); } };
globalThis.ProgressEvent = class { constructor(type, data) { this.type = type; Object.assign(this, data); } };
globalThis.fetch = async request => {
  const url = new URL(typeof request === "string" ? request : request.url);
  assert.equal(url.origin, "https://assets.test"); assert.match(url.pathname, /^\/models\/koharu-(citizen|interior)\.glb$/);
  const bytes = await fs.readFile(`public${url.pathname}`);
  return new Response(bytes, { headers: { "Content-Length": String(bytes.length) } });
};

try {
  const citizens = await life.loadCitizens(), a = citizens.create("#335566"), b = citizens.create("#aa5544");
  const skins = root => { const result = []; root.traverse(o => { if (o.isSkinnedMesh) result.push(o); }); return result; };
  const aSkin = skins(a.root)[0], bSkin = skins(b.root)[0];
  assert.ok(aSkin && bSkin); assert.notEqual(aSkin.skeleton.bones[0], bSkin.skeleton.bones[0], "independent rigs");
  const bBefore = bSkin.skeleton.bones.map(bone => bone.quaternion.toArray());
  const aBefore = aSkin.skeleton.bones.map(bone => bone.quaternion.toArray());
  a.update(.25, 2.65); a.root.updateMatrixWorld(true);
  assert.notDeepEqual(aSkin.skeleton.bones.map(bone => bone.quaternion.toArray()), aBefore, "walk clip moves the rig");
  assert.deepEqual(bSkin.skeleton.bones.map(bone => bone.quaternion.toArray()), bBefore, "other residents are unaffected");
  b.update(.25, 0); b.root.updateMatrixWorld(true); citizens.dispose();
  const interior = await life.loadInterior();
  assert.ok(interior.products.children.length > 0, "delivery reveals the product display");
  let batches = 0; interior.root.traverse(o => { if (o.isMesh) { batches++; assert.ok(o.geometry.attributes.position.count > 0); } });
  assert.ok(batches < 20, `interior batching must stay efficient: ${batches}`); interior.dispose();
  console.log(`PASS: actual Three.js citizen loader, independent rigs, working walk animation and ${batches} indoor draw batches.`);
} finally { globalThis.Request = NativeRequest; globalThis.fetch = originalFetch; delete globalThis.ProgressEvent; delete globalThis.document; }

for (const name of ["citizen", "interior"]) {
  const bytes = await fs.readFile(`public/models/koharu-${name}.glb`);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  const box = new Box3().setFromObject(gltf.scene);
  if (name === "citizen") {
    assert.ok(box.max.y > 1.6 && box.max.y < 2.1, "human scale is in meters and Y-up");
    assert.ok(box.min.y > -.1 && box.min.y < .1, "feet are on the street");
    assert.deepEqual(gltf.animations.map(a => a.name).sort(), ["Idle", "Walk"]);
  } else {
    assert.ok(box.min.x < -3.9 && box.max.x > 3.9); assert.ok(box.max.y > 3.3);
    assert.ok(gltf.scene.getObjectByName("Computer_display")); assert.ok(gltf.scene.getObjectByName("Exit_door"));
  }
}

// Flood-fill actual collision functions, checking both entrances and interaction spots.
function reachable(walkable, start, step, max) {
  const key = (x, z) => `${x},${z}`, todo = [start], visited = new Set([key(...start)]);
  for (let i = 0; i < todo.length; i++) {
    const [x, z] = todo[i];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, k = key(nx, nz);
      if (Math.abs(nx) > max || Math.abs(nz) > max || visited.has(k) || !walkable(nx * step, nz * step)) continue;
      visited.add(k); todo.push([nx, nz]);
    }
  }
  return todo.map(([x, z]) => ({ x: x * step, z: z * step }));
}
const outside = reachable(life.canWalk, [0, 36], 1, 80);
for (const door of life.entrances) {
  assert.ok(life.canWalk(door.x, door.z), `entrance ${door.id} must be on walkable ground`);
  assert.ok(outside.some(p => Math.hypot(p.x - door.x, p.z - door.z) < 1.2), `entrance ${door.id} must be reachable`);
  const resident = life.residentPosition(door.id); assert.ok(life.canWalk(resident.x, resident.z));
  assert.ok(Math.hypot(resident.x - door.x, resident.z - door.z) > 1.6, "residents must not stand in doors");
}
const inside = reachable(life.canWalkInside, [0, 11], .25, 20);
for (const spot of [life.roomDesk, life.roomExit]) assert.ok(inside.some(p => Math.hypot(p.x - spot.x, p.z - spot.z) < 1.1), "desk and exit must be reachable around furniture");
assert.equal(life.canWalkInside(-2.5, -2.1), false); assert.equal(life.canWalkInside(4.2, 0), false);
console.log("PASS: Y-up Blender assets, all 8 doors reachable, unobstructed residents, and an indoor path to the desk and exit.");
