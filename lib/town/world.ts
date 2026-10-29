import { commissions } from "./content";
import layout from "./layout.json";
export const bridges=layout.bridges;
export const obstacles=layout.buildings.map(b=>{const w=b.kind==="shrine"?13:10,d=b.kind==="shrine"?10:9;return {x:b.x,z:b.z,w:Math.abs(Math.cos(b.yaw))*w+Math.abs(Math.sin(b.yaw))*d,d:Math.abs(Math.sin(b.yaw))*w+Math.abs(Math.cos(b.yaw))*d};});
export function canWalk(x:number,z:number){
 if(x < -76 || x > 76 || z < -61 || z > 61)return false;
 if(x>21&&x<35&&!bridges.some(b=>Math.abs(z-b)<3.5))return false;
 return !obstacles.some(b=>Math.abs(x-b.x)<b.w/2+.65&&Math.abs(z-b.z)<b.d/2+.65);
}
export function nearestResident(x:number,z:number){
 let id:number|null=null,distance=Infinity;
 for(const c of commissions){const d=Math.hypot(x-c.position[0],z-c.position[1]);if(d<distance){distance=d;id=c.id;}}
 return {id:distance<5?id:null,distance};
}
