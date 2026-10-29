import { z } from "zod";
import { townStateSchema, emptyTown, type TownState } from "@/lib/town/types";
export type Lesson = {
  id: number; district: number; title: string; topic: string; minutes: number;
  client: string; story: string; goal: string;
  learn: { title: string; body: string; code?: string }[];
  requirements: string[]; starter: string; solution: string; hints: string[];
  checks: { label: string; test: string }[];
  preview: string; takeaway: string;
  files?: Record<string, string>; kind?: "react";
};
export const districts = [
  { name: "はじまりの港", shop: "コハルの屋台", topic: "最初の1行・変数・型", color: "#ffb94f", cost: 250, reward: 150 },
  { name: "カフェ通り", shop: "カフェ・ループ", topic: "条件分岐・関数", color: "#fc8d75", cost: 600, reward: 250 },
  { name: "マーケット広場", shop: "みなとマルシェ", topic: "配列・オブジェクト", color: "#46d6ac", cost: 1000, reward: 400 },
  { name: "職人の路地", shop: "クラフト工房", topic: "型設計・データ変換", color: "#a9a0ff", cost: 1600, reward: 600 },
  { name: "郵便の丘", shop: "ポストオフィス", topic: "モジュール・非同期", color: "#71c9fc", cost: 2400, reward: 850 },
  { name: "ギャラリー街", shop: "ギャラリー・ピース", topic: "HTML・React・Props", color: "#fc88c2", cost: 3400, reward: 1200 },
  { name: "ガーデン地区", shop: "グリーンハウス", topic: "状態・フォーム・Effect", color: "#a9df6f", cost: 4800, reward: 1600 },
  { name: "未来の中心街", shop: "タウンホール", topic: "Hooks・総合制作", color: "#ffd56b", cost: 6500, reward: 2400 },
];
export type ProgressState = {
  completed: number[]; built: number[]; drafts: Record<string, string>; active: number; revision: number; town: TownState;
};
export const initialProgress: ProgressState = { completed: [], built: [], drafts: {}, active: 0, revision: 0, town: emptyTown };
export function wallet(state: Pick<ProgressState,"completed"|"built">) {
  return 100 + state.completed.reduce((sum, id) => sum + districts[Math.floor(id / 4)].reward, 0)
    - state.built.reduce((sum, id) => sum + districts[id].cost, 0);
}

export const progressSchema = z.object({
  completed: z.array(z.number().int().min(0).max(31)).max(32),
  built: z.array(z.number().int().min(0).max(7)).max(8),
  drafts: z.record(z.string().regex(/^(?:[0-9]|[12][0-9]|3[01])$/),z.string().max(30000)),
  active: z.number().int().min(0).max(31),
  revision: z.number().int().min(0),
  town: townStateSchema.default(emptyTown),
});
export function parseProgressResponse(value: unknown, ok: boolean): ProgressState {
  if (!ok) {
    const message = typeof value === "object" && value !== null && "error" in value && typeof value.error === "string"
      ? value.error : "保存の通信に失敗しました。再試行してください。";
    throw new Error(message);
  }
  const result = progressSchema.safeParse(value);
  if (!result.success) throw new Error("進行データを読み込めませんでした。再試行してください。");
  return result.data;
}
