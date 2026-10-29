import { z } from "zod";
export const filesSchema=z.object({html:z.string().max(30000),css:z.string().max(20000),ts:z.string().max(30000)});
export type WebFiles=z.infer<typeof filesSchema>;
export const townProjectSchema=z.object({files:filesSchema,steps:z.array(z.number().int().min(0).max(2)).max(3).default([]),accepted:z.boolean().default(true),approvedHash:z.string().optional(),published:filesSchema.optional(),deliveredAt:z.string().optional()});
export type TownProjectSave=z.infer<typeof townProjectSchema>;
export const townStateSchema=z.object({projects:z.record(z.string().regex(/^[0-7]$/),townProjectSchema).default({}),position:z.object({x:z.number().min(-77).max(77),z:z.number().min(-62).max(62)}).default({x:0,z:36}),hour:z.number().min(0).max(24).default(9),activeProject:z.number().int().min(0).max(7).default(0)});
export type TownState=z.infer<typeof townStateSchema>;
export const emptyTown:TownState={projects:{},position:{x:0,z:36},hour:9,activeProject:0};
export type WebCheck={label:string;test:string};
export type WebStage={title:string;language:keyof WebFiles;intro:string;learn:{title:string;body:string;code?:string}[];tasks:string[];hints:string[];checks:WebCheck[]};
export type Commission={id:number;slug:string;name:string;npc:string;role:string;location:string;position:[number,number];building:[number,number];color:string;fee:number;brief:string;delivered:string;starter:WebFiles;solution:WebFiles;stages:WebStage[]};
export const languages={html:{name:"HTML",file:"index.html",role:"構造"},css:{name:"CSS",file:"style.css",role:"見た目"},ts:{name:"TypeScript",file:"main.ts",role:"動き"}};
export function filesKey(files:WebFiles){return JSON.stringify([files.html,files.css,files.ts]);}
export async function filesHash(files:WebFiles){const bytes=new TextEncoder().encode(filesKey(files));const digest=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,"0")).join("");}
