"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { DoorOpen, Monitor, Moon, Sun, Volume2, VolumeX } from "lucide-react";
import { loadBlenderTown, type LoadedTown } from "./loadBlenderTown";
import { loadCitizens, loadInterior, type Citizen, type Citizens, type Interior } from "./loadTownLife";
import { TownAudio } from "./TownAudio";
import { commissions } from "@/lib/town/content";
import { obstacles, canWalk } from "@/lib/town/world";
import { entrances, roomDesk, roomExit, canWalkInside, residentPosition, visitorPosition } from "@/lib/town/places";

type Point = { x: number; z: number };
type Interaction = { kind: "resident" | "door" | "desk" | "exit"; id: number };
type Props = {
  initial: Point; initialHour: number; paused: boolean; target: number; delivered: number[];
  onNear: (id: number | null) => void; onInteract: (id: number) => void; onStudio: (id: number) => void;
  onInteriorChange: (id: number | null) => void; onPosition: (p: Point & { hour: number }) => void; onMove: (p: Point) => void;
};
const asPoint = (p: THREE.Vector3): Point => ({ x: p.x, z: p.z });

export default function OpenWorld(props: Props) {
  const mount = useRef<HTMLDivElement>(null), state = useRef(props), keys = useRef(new Set<string>());
  const interact = useRef<() => void>(() => {}), changeHour = useRef<() => void>(() => {}), sound = useRef<TownAudio | null>(null);
  const [error, setError] = useState(""), [loading, setLoading] = useState(true), [loadProgress, setLoadProgress] = useState(0);
  const [prompt, setPrompt] = useState<Interaction | null>(null), [inside, setInside] = useState<number | null>(null);
  const [minute, setMinute] = useState(Math.floor(props.initialHour * 60)), [audible, setAudible] = useState(false);
  const [soundBusy, setSoundBusy] = useState(false), [soundError, setSoundError] = useState("");
  state.current = props;

  useEffect(() => {
    const host = mount.current; if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); }
    catch { setLoading(false); setError("3D表示を開始できませんでした。町の地図から住民と制作室を開けます。"); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6)); renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; host.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), outside = new THREE.Group(); scene.add(outside);
    const fog = new THREE.Fog("#b9ced8", 75, 190); scene.fog = fog; scene.background = new THREE.Color("#b9ced8");
    const camera = new THREE.PerspectiveCamera(58, 1, .08, 400);
    const hemi = new THREE.HemisphereLight("#d8e9ff", "#8a7760", 1.15); scene.add(hemi);
    const sky = new Sky(); sky.scale.setScalar(350); scene.add(sky);
    const uniforms = sky.material.uniforms; uniforms.turbidity.value = 3.5; uniforms.rayleigh.value = 1.5;
    uniforms.mieCoefficient.value = .004; uniforms.mieDirectionalG.value = .8;
    const sunlight = new THREE.Vector3(-.45, .75, .55).normalize(); uniforms.sunPosition.value.copy(sunlight);
    const pmrem = new THREE.PMREMGenerator(renderer), skyScene = new THREE.Scene(); skyScene.add(sky.clone());
    const environment = pmrem.fromScene(skyScene, .05); scene.environment = environment.texture; pmrem.dispose();
    const sun = new THREE.DirectionalLight("#fff0d9", 3.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -27, right: 27, top: 27, bottom: -27, near: 1, far: 140 });
    sun.shadow.bias = -.00025; sun.shadow.normalBias = .035; scene.add(sun, sun.target);
    const lamps = Array.from({ length: 4 }, () => {
      const light = new THREE.PointLight("#ffb66e", 0, 14, 2); scene.add(light); return light;
    });
    const roomLight = new THREE.PointLight("#ffe6b3", 0, 14, 1.6); roomLight.position.set(0, 3.05, 0); scene.add(roomLight);
    const windowLight = new THREE.DirectionalLight("#daeaff", 0); windowLight.position.set(-3, 3, 1); scene.add(windowLight);
    const starsGeometry = new THREE.BufferGeometry(), starPositions: number[] = [];
    for (let i = 0; i < 260; i++) {
      const azimuth = i * 2.399963, elevation = .18 + ((i * 37) % 260) / 260 * 1.3;
      starPositions.push(Math.cos(azimuth) * Math.cos(elevation) * 210, Math.sin(elevation) * 210, Math.sin(azimuth) * Math.cos(elevation) * 210);
    }
    starsGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: "#dce8ff", size: .48, transparent: true, depthWrite: false, fog: false });
    const stars = new THREE.Points(starsGeometry, starsMaterial); outside.add(stars);
    const targetRing = new THREE.Mesh(new THREE.RingGeometry(.75, 1, 40), new THREE.MeshBasicMaterial({ color: "#ffdc85", side: THREE.DoubleSide, transparent: true, opacity: .8 }));
    targetRing.rotation.x = -Math.PI / 2; targetRing.position.y = .06; outside.add(targetRing);
    const markerGeometry = new THREE.OctahedronGeometry(.19), markerMaterials: THREE.MeshBasicMaterial[] = [];
    const doorMarker = new THREE.Mesh(new THREE.RingGeometry(.34, .41, 32), new THREE.MeshBasicMaterial({ color: "#dfeec5", side: THREE.DoubleSide, transparent: true, opacity: .65 }));
    doorMarker.rotation.x = -Math.PI / 2; doorMarker.position.y = .05; outside.add(doorMarker); doorMarker.visible = false;

    let disposed = false, ready = false, town: LoadedTown | null = null, citizens: Citizens | null = null, interior: Interior | null = null;
    let player: Citizen | null = null, residents: { citizen: Citizen; marker: THREE.Mesh }[] = [], visitors: Citizen[] = [];
    let place: number | null = null, near: Interaction | null = null, hour = props.initialHour % 24;
    const audio = new TownAudio(); sound.current = audio;
    const position = new THREE.Vector3(props.initial.x, 0, props.initial.z); if (!canWalk(position.x, position.z)) position.set(0, 0, 36);
    const exteriorPosition = position.clone(), notifiedPosition = position.clone();
    let yaw = 0, pitch = .3, exteriorYaw = 0, dragging = false, lastX = 0, lastY = 0;
    let frame = 0, last = performance.now(), lastNotify = 0, lastSave = 0, lastDraw = 0, displayedMinute = -1, snapCamera = true;
    const cameraTarget = new THREE.Vector3(), offset = new THREE.Vector3(), desired = new THREE.Vector3(), hit = new THREE.Vector3();
    const ray = new THREE.Ray(), bounds = obstacles.map(b => new THREE.Box3(new THREE.Vector3(b.x - b.w / 2 - .2, .2, b.z - b.d / 2 - .2), new THREE.Vector3(b.x + b.w / 2 + .2, 9, b.z + b.d / 2 + .2)));
    const nightColor = new THREE.Color("#131e35"), dayColor = new THREE.Color("#b9ced8"), sunsetColor = new THREE.Color("#bd9582"), amber = new THREE.Color("#ffb46f");

    void Promise.allSettled([
      loadBlenderTown(value => { if (!disposed) setLoadProgress(Math.round(value * .75)); }), loadCitizens(), loadInterior(),
    ] as const).then(([t, c, room]) => {
      if (disposed || t.status !== "fulfilled" || c.status !== "fulfilled" || room.status !== "fulfilled") {
        for (const result of [t, c, room]) if (result.status === "fulfilled") result.value.dispose();
        if (!disposed) throw new Error("町のモデルを読み込めませんでした。再読み込みするか、町の地図から制作を続けられます。");
        return;
      }
      town = t.value; citizens = c.value; interior = room.value; outside.add(town.root); scene.add(interior.root); interior.root.visible = false;
      residents = commissions.map(commission => {
        const citizen = citizens!.create(commission.color, .97 + commission.id % 3 * .03), p = residentPosition(commission.id);
        citizen.root.position.set(p.x, 0, p.z); citizen.root.rotation.y = entrances[commission.id].yaw; outside.add(citizen.root);
        const material = new THREE.MeshBasicMaterial({ color: "#ffe299" }); markerMaterials.push(material);
        const marker = new THREE.Mesh(markerGeometry, material); marker.position.set(p.x, 2.3, p.z); outside.add(marker);
        return { citizen, marker };
      });
      visitors = commissions.map(commission => {
        const citizen = citizens!.create(["#a76c51", "#8b8b66", "#657e8d"][commission.id % 3], .94), p = visitorPosition(commission.id);
        citizen.root.position.set(p.x, 0, p.z); citizen.root.lookAt(commission.position[0], 0, commission.position[1]); outside.add(citizen.root); return citizen;
      });
      player = citizens.create("#385f69"); player.root.position.copy(position); scene.add(player.root);
      ready = true; setLoadProgress(100); setLoading(false);
    }).catch(reason => { if (!disposed) { setError(reason instanceof Error ? reason.message : String(reason)); setLoading(false); } });

    function setNear(next: Interaction | null) {
      if (next?.kind === near?.kind && next?.id === near?.id) return;
      near = next; setPrompt(next); state.current.onNear(next?.kind === "resident" ? next.id : null);
    }
    function save() {
      state.current.onPosition({ ...asPoint(place === null ? position : exteriorPosition), hour }); lastSave = performance.now();
    }
    function interactNow() {
      if (state.current.paused || !ready || !near) return;
      const choice = near;
      if (choice.kind === "resident") { state.current.onInteract(choice.id); return; }
      if (choice.kind === "desk") { state.current.onStudio(choice.id); return; }
      if (!interior || !player) return;
      if (choice.kind === "door") {
        exteriorPosition.copy(position); exteriorYaw = yaw; place = choice.id;
        outside.visible = false; interior.root.visible = true; position.set(0, 0, 2.75); yaw = 0; player.root.rotation.y = Math.PI;
      } else {
        place = null; outside.visible = true; interior.root.visible = false; position.copy(exteriorPosition); yaw = exteriorYaw;
        player.root.rotation.y = yaw;
      }
      keys.current.clear(); snapCamera = true; setNear(null); setInside(place); state.current.onInteriorChange(place); save();
    }
    interact.current = interactNow;
    changeHour.current = () => { if (state.current.paused || !ready) return; hour = hour < 15 ? 17.5 : hour < 20 ? 21 : 9; save(); };
    const resize = () => { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h); camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const down = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement;
      if (!ready || state.current.paused || ["INPUT", "TEXTAREA", "SELECT"].includes(element?.tagName) || element?.isContentEditable) return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
      keys.current.add(event.key.toLowerCase()); if (event.key.toLowerCase() === "e" && !event.repeat) interactNow();
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase());
    const blur = () => { keys.current.clear(); dragging = false; };
    const visibility = () => { if (document.hidden) { blur(); if (ready) save(); } };
    const pointerDown = (event: PointerEvent) => {
      if (state.current.paused || !ready) return; dragging = true; lastX = event.clientX; lastY = event.clientY; renderer.domElement.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      if (!dragging || state.current.paused) return; yaw -= (event.clientX - lastX) * .006;
      pitch = THREE.MathUtils.clamp(pitch + (event.clientY - lastY) * .003, .08, .85); lastX = event.clientX; lastY = event.clientY;
    };
    const pointerUp = () => { dragging = false; };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur); document.addEventListener("visibilitychange", visibility);
    renderer.domElement.addEventListener("pointerdown", pointerDown); renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp); renderer.domElement.addEventListener("pointercancel", pointerUp);

    function animate(now: number) {
      frame = requestAnimationFrame(animate); const dt = Math.min((now - last) / 1000, .05); last = now;
      const paused = state.current.paused || document.hidden, indoors = place !== null;
      let speed = 0;
      if (ready && !paused) {
        hour = (hour + dt * 24 / 1800) % 24;
        const k = keys.current;
        let dx = Number(k.has("d") || k.has("arrowright")) - Number(k.has("a") || k.has("arrowleft"));
        let dz = Number(k.has("s") || k.has("arrowdown")) - Number(k.has("w") || k.has("arrowup"));
        const length = Math.hypot(dx, dz);
        if (length) {
          dx /= length; dz /= length; const velocity = k.has("shift") && !indoors ? 5.2 : 2.65;
          const mx = (dx * Math.cos(yaw) + dz * Math.sin(yaw)) * velocity * dt, mz = (-dx * Math.sin(yaw) + dz * Math.cos(yaw)) * velocity * dt;
          const walkable = indoors ? canWalkInside : canWalk, oldX = position.x, oldZ = position.z;
          if (walkable(position.x + mx, position.z)) position.x += mx;
          if (walkable(position.x, position.z + mz)) position.z += mz;
          speed = Math.hypot(position.x - oldX, position.z - oldZ) / Math.max(dt, .001);
          if (player && speed > .05) player.root.rotation.y = Math.atan2(mx, mz);
        }
      } else keys.current.clear();
      player?.root.position.copy(position); player?.update(paused ? 0 : dt, speed);

      const elevation = Math.sin((hour - 6) / 12 * Math.PI), daylight = THREE.MathUtils.smoothstep(elevation, -.14, .45);
      const dusk = Math.max(0, 1 - Math.abs(elevation) * 3) * daylight;
      sunlight.set(-Math.cos((hour - 6) / 12 * Math.PI) * .75, Math.max(.08, elevation), .35).normalize();
      uniforms.sunPosition.value.copy(sunlight); sky.visible = !indoors && daylight > .03; starsMaterial.opacity = 1 - daylight;
      fog.color.copy(nightColor).lerp(dayColor, daylight).lerp(sunsetColor, dusk * .55); (scene.background as THREE.Color).copy(fog.color);
      scene.environmentIntensity = indoors ? .35 : .08 + daylight * .25;
      hemi.intensity = indoors ? .85 : .25 + daylight * .9; sun.visible = !indoors; sun.intensity = daylight * (2 + Math.max(0, elevation) * 1.4);
      sun.color.set("#fff0d9").lerp(amber, dusk * .7);
      sun.target.position.set(position.x, 0, position.z); sun.position.copy(sun.target.position).addScaledVector(sunlight, 65);
      roomLight.intensity = indoors ? 24 : 0; windowLight.intensity = indoors ? .5 + daylight * .8 : 0;
      audio.update(daylight, Math.abs((indoors ? exteriorPosition.x : position.x) - 28), indoors, paused, speed);

      if (ready && now - lastNotify > 140) {
        lastNotify = now;
        if (!paused) {
          let next: Interaction | null = null, nearest = Infinity;
          const consider = (kind: Interaction["kind"], id: number, p: Point, range: number) => {
            const distance = Math.hypot(position.x - p.x, position.z - p.z);
            if (distance < range && distance < nearest) { next = { kind, id }; nearest = distance; }
          };
          if (place !== null) { consider("exit", place, roomExit, 1.5); consider("desk", place, roomDesk, 1.4); }
          else {
            residents.forEach(({ citizen }, id) => consider("resident", id, citizen.root.position, 2.5));
            entrances.forEach(door => consider("door", door.id, door, 1.45));
          }
          setNear(next);
        }
        const savedPosition = indoors ? exteriorPosition : position;
        if (savedPosition.distanceToSquared(notifiedPosition) > .001) { notifiedPosition.copy(savedPosition); state.current.onMove(asPoint(savedPosition)); }
        const currentMinute = Math.floor(hour * 60); if (currentMinute !== displayedMinute) { displayedMinute = currentMinute; setMinute(currentMinute); }
        if (town) {
          const closest = town.lanterns.slice().sort((a, b) => a.distanceToSquared(position) - b.distanceToSquared(position));
          lamps.forEach((lamp, i) => { if (closest[i]) lamp.position.copy(closest[i]); lamp.intensity = indoors ? 0 : 32 * (1 - daylight); });
          town.growth.forEach((group, id) => { group.visible = state.current.delivered.includes(id); });
          town.lanternMaterials.forEach(material => { material.emissiveIntensity = (1 - daylight) * 1.4; });
        }
        visitors.forEach((visitor, id) => { visitor.root.visible = state.current.delivered.includes(id); });
        if (interior && place !== null) interior.products.visible = state.current.delivered.includes(place);
      }
      if (ready && now - lastSave > 10000 && !paused) save();
      residents.forEach(({ citizen, marker }, id) => {
        if (!paused && !indoors) {
          citizen.update(dt, 0);
          if (citizen.root.position.distanceTo(position) < 5) citizen.root.lookAt(position.x, 0, position.z);
        }
        marker.position.y = 2.3 + Math.sin(now * .0015 + id) * .1; marker.rotation.y = now * .0007;
        (marker.material as THREE.MeshBasicMaterial).color.set(state.current.delivered.includes(id) ? "#8dc9a5" : "#ffe299");
      });
      if (!paused && !indoors) visitors.forEach(visitor => { if (visitor.root.visible) visitor.update(dt, 0); });
      const target = residentPosition(state.current.target); targetRing.position.x = target.x; targetRing.position.z = target.z;
      doorMarker.visible = near?.kind === "door";
      if (near?.kind === "door") { doorMarker.position.x = entrances[near.id].x; doorMarker.position.z = entrances[near.id].z; }

      cameraTarget.set(position.x, 1.28, position.z);
      const length = indoors ? 3.1 : 5.25;
      offset.set(Math.sin(yaw) * length * Math.cos(pitch), Math.sin(pitch) * length, Math.cos(yaw) * length * Math.cos(pitch));
      ray.set(cameraTarget, offset.clone().normalize()); let distance = length;
      if (!indoors) for (const box of bounds) if (ray.intersectBox(box, hit)) {
        const d = cameraTarget.distanceTo(hit) - .25; if (d > 0) distance = Math.min(distance, d);
      }
      desired.copy(cameraTarget).add(offset.normalize().multiplyScalar(Math.max(.6, distance)));
      if (indoors) { desired.x = THREE.MathUtils.clamp(desired.x, -3.6, 3.6); desired.z = THREE.MathUtils.clamp(desired.z, -4.05, 4.05); desired.y = Math.min(desired.y, 3.15); }
      if (snapCamera) { camera.position.copy(desired); snapCamera = false; } else camera.position.lerp(desired, 1 - Math.exp(-dt * 14));
      camera.lookAt(cameraTarget);
      // The editor and dialogs freeze movement and reduce background GPU work.
      if (!document.hidden && (!paused || now - lastDraw > 250)) { renderer.render(scene, camera); lastDraw = now; }
    }
    frame = requestAnimationFrame(animate);
    return () => {
      disposed = true; cancelAnimationFrame(frame); audio.dispose(); sound.current = null; observer.disconnect();
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", visibility);
      renderer.domElement.removeEventListener("pointerdown", pointerDown); renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp); renderer.domElement.removeEventListener("pointercancel", pointerUp);
      town?.dispose(); citizens?.dispose(); interior?.dispose(); environment.dispose(); sky.geometry.dispose(); sky.material.dispose();
      starsGeometry.dispose(); starsMaterial.dispose(); markerGeometry.dispose(); markerMaterials.forEach(m => m.dispose());
      targetRing.geometry.dispose(); targetRing.material.dispose(); doorMarker.geometry.dispose(); doorMarker.material.dispose(); sun.shadow.dispose();
      renderer.dispose(); renderer.domElement.remove(); keys.current.clear(); interact.current = () => {}; changeHour.current = () => {};
    };
    // World resources survive React HUD updates; current props are read through state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleSound() {
    const instance = sound.current; if (!instance) return;
    setSoundBusy(true); setSoundError("");
    try { const enabled = await instance.toggle(); if (sound.current === instance) setAudible(enabled); }
    catch (reason) { if (sound.current === instance) { setAudible(false); setSoundError(reason instanceof Error ? reason.message : "音を再生できませんでした。"); } }
    finally { if (sound.current === instance) setSoundBusy(false); }
  }
  function touch(key: string, pressed: boolean) { if (pressed) keys.current.add(key); else keys.current.delete(key); }
  const hour = Math.floor(minute / 60), isNight = hour >= 19 || hour < 6;
  const location = inside !== null ? commissions[inside].location : null;
  return <>
    <div className="koharu-world" ref={mount} aria-label="小春町の3Dオープンワールド" />
    {loading && <div className="model-loading" role="status"><span>小春町</span><strong>町と住民を迎える準備をしています</strong><p>瓦屋根の通りから、店の中へ。</p><progress max="100" value={loadProgress} /></div>}
    {error && <div className="world-error" role="alert">{error}<button onClick={() => window.location.reload()}>町を再読み込み</button></div>}
    {!loading && !error && <div className="world-environment" hidden={props.paused}>
      <button className="world-clock" onClick={() => changeHour.current()} title="朝・夕方・夜へ時間を進める" aria-label="町の時間を朝・夕方・夜へ進める">
        {isNight ? <Moon size={16} /> : <Sun size={16} />}<b>{String(hour).padStart(2, "0") }:{String(minute % 60).padStart(2, "0")}</b><small>時間を進める</small>
      </button>
      <button className="world-sound" onClick={() => void toggleSound()} disabled={soundBusy} aria-pressed={audible} aria-label={audible ? "環境音を消す" : "環境音を流す"}>
        {audible ? <Volume2 size={16} /> : <VolumeX size={16} />}<span>{soundBusy ? "準備中" : audible ? "音あり" : "音なし"}</span>
      </button>
      {soundError && <p role="alert">{soundError}</p>}
    </div>}
    {location && !props.paused && <div className="interior-label"><DoorOpen size={17} /><div><small>店内 · 奥の机でWeb制作</small><strong>{location}</strong></div></div>}
    {prompt && prompt.kind !== "resident" && !props.paused && <button className="talk-prompt place-prompt" onClick={() => interact.current()}>
      <span className="key-e">E</span><span><small>{prompt.kind === "door" ? commissions[prompt.id].location : location}</small>{prompt.kind === "door" ? "中に入る" : prompt.kind === "desk" ? "制作室を開く" : "通りへ戻る"}</span>{prompt.kind === "desk" ? <Monitor size={20} /> : <DoorOpen size={20} />}
    </button>}
    <div className="walk-controls" aria-label="移動操作" hidden={props.paused || loading}>
      {[["w", "↑"], ["a", "←"], ["s", "↓"], ["d", "→"], ["shift", "走る"]].map(([key, label]) => <button key={key} className={`walk-${key}`} aria-label={key === "shift" ? "押しながら走る" : `${label}へ移動`}
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); touch(key, true); }} onPointerUp={() => touch(key, false)} onPointerCancel={() => touch(key, false)} onLostPointerCapture={() => touch(key, false)}>{label}</button>)}
    </div>
  </>;
}
