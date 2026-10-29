import layout from "./layout.json";
import { commissions } from "./content";
import { canWalk } from "./world";

export type Place = { id: number; x: number; z: number; yaw: number; name: string };
export const entrances: Place[] = commissions.map(c => {
  const building = layout.buildings.find(b => b.quest === c.id)!;
  // A little beyond the projecting eaves, on walkable ground.
  const distance = building.kind === "shrine" ? 6.2 : 6;
  return { id: c.id, x: building.x + Math.sin(building.yaw) * distance,
    z: building.z + Math.cos(building.yaw) * distance, yaw: building.yaw, name: c.location };
});
export const roomExit = { x: 0, z: 3.8 };
export const roomDesk = { x: -2.5, z: -1.15 };
export const indoorObstacles = [
  { x: 1.25, z: -2.9, w: 4.1, d: 1 },
  { x: -2.5, z: -2.1, w: 1.8, d: 1 },
  { x: -2.5, z: -1.15, w: .5, d: .55 },
  { x: 1.55, z: 1.35, w: 1.2, d: .85 },
  { x: 0, z: -4.12, w: 7.7, d: .5 },
];
export function canWalkInside(x: number, z: number) {
  return Math.abs(x) < 3.6 && Math.abs(z) < 4.08 &&
    !indoorObstacles.some(b => Math.abs(x - b.x) < b.w / 2 + .27 && Math.abs(z - b.z) < b.d / 2 + .27);
}
export function visitorPosition(id: number) {
  const c = commissions[id];
  for (const [dx, dz] of [[2, 1.7], [-2, 1.7], [0, 2.5], [0, -2.5]])
    if (canWalk(c.position[0] + dx, c.position[1] + dz)) return { x: c.position[0] + dx, z: c.position[1] + dz };
  return { x: c.position[0], z: c.position[1] };
}
export function residentPosition(id: number) {
  const c = commissions[id], door = entrances[id];
  if (Math.hypot(c.position[0] - door.x, c.position[1] - door.z) < 1.8) {
    const x = door.x + Math.cos(door.yaw) * 1.8, z = door.z - Math.sin(door.yaw) * 1.8;
    if (canWalk(x, z)) return { x, z };
  }
  return { x: c.position[0], z: c.position[1] };
}
