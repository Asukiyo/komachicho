import { z } from "zod";
import { initialProgress, progressSchema, wallet, districts, type ProgressState } from "./types";
import { commissions } from "../town/content";
import { filesSchema, filesHash } from "../town/types";

const projectId = z.number().int().min(0).max(7), lessonId = z.number().int().min(0).max(31);
export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("townAccept"), id: projectId }),
  z.object({ type: z.literal("townDraft"), id: projectId, files: filesSchema }),
  z.object({ type: z.literal("townStep"), id: projectId, step: z.number().int().min(0).max(2), files: filesSchema }),
  z.object({ type: z.literal("townDeliver"), id: projectId }),
  z.object({ type: z.literal("townPosition"), x: z.number().min(-77).max(77), z: z.number().min(-62).max(62), hour: z.number().min(0).max(24).optional() }),
  z.object({ type: z.literal("draft"), id: lessonId, code: z.string().max(30000) }),
  z.object({ type: z.literal("active"), id: lessonId }),
  z.object({ type: z.literal("complete"), id: lessonId }),
  z.object({ type: z.literal("build"), id: projectId }),
]);
export const MAX_SAVE_BYTES = 2_000_000;
export function parseSave(value: unknown): ProgressState {
  if (typeof value === "object" && value !== null) {
    const candidate = value as { drafts?: unknown; town?: { projects?: unknown } };
    for (const record of [candidate.drafts, candidate.town?.projects]) {
      if (record && typeof record === "object" && Object.hasOwn(record, "__proto__")) throw new Error("保存データに無効な項目があります。");
    }
  }
  const result = progressSchema.safeParse(value);
  if (!result.success) throw new Error("保存データの形式が正しくありません。元のデータは変更していません。");
  const state = result.data;
  state.completed = [...new Set(state.completed)]; state.built = [...new Set(state.built)];
  for (const project of Object.values(state.town.projects)) project.steps = [...new Set(project.steps)];
  return state;
}
export async function applyProgress(current: ProgressState, input: unknown): Promise<ProgressState> {
  const action = actionSchema.parse(input), next = structuredClone(current);
  const unlocked = "id" in action && (action.id === 0 || current.completed.includes(action.id - 1) || current.completed.includes(action.id));
  if (action.type === "townPosition") { next.town.position = { x: action.x, z: action.z }; if (action.hour !== undefined) next.town.hour = action.hour; }
  if (action.type === "townAccept") {
    next.town.activeProject = action.id;
    next.town.projects[action.id] ??= { files: { ...commissions[action.id].starter }, steps: [], accepted: true };
  }
  if (action.type === "townDraft" || action.type === "townStep" || action.type === "townDeliver") {
    const project = next.town.projects[action.id];
    if (!project) throw new Error("先に住民の依頼を引き受けましょう。");
    if (action.type === "townDraft") { project.files = action.files; if (project.approvedHash !== await filesHash(action.files)) delete project.approvedHash; }
    if (action.type === "townStep") {
      if (action.step > 0 && !project.steps.includes(action.step - 1)) throw new Error("HTML・CSS・TypeScriptの順番で仕上げましょう。");
      project.files = action.files;
      if (!project.steps.includes(action.step)) project.steps.push(action.step);
      project.approvedHash = action.step === 2 ? await filesHash(action.files) : undefined;
    }
    if (action.type === "townDeliver") {
      if (project.steps.length !== 3 || project.approvedHash !== await filesHash(project.files)) throw new Error("制作室で最後の動作確認を通してから納品しましょう。");
      project.published = { ...project.files }; project.deliveredAt ??= new Date().toISOString();
    }
  }
  if (action.type === "draft") next.drafts[action.id] = action.code;
  if (action.type === "active") { if (!unlocked) throw new Error("前の依頼から順番に進めましょう。"); next.active = action.id; }
  if (action.type === "complete") { if (!unlocked) throw new Error("前の依頼を完成させましょう。"); if (!next.completed.includes(action.id)) next.completed.push(action.id); }
  if (action.type === "build" && !next.built.includes(action.id)) {
    if (![0, 1, 2, 3].every(n => current.completed.includes(action.id * 4 + n)) || wallet(current) < districts[action.id].cost) throw new Error("地区の4依頼を達成し、建設費を集めましょう。");
    next.built.push(action.id);
  }
  next.revision = current.revision + 1; return next;
}

export function createProgressStore(storage: Pick<Storage, "getItem" | "setItem">, key: string, lock: <T>(callback: () => Promise<T>) => Promise<T>) {
  const load = async () => {
    let raw: string | null;
    try { raw = storage.getItem(key); } catch { throw new Error("ブラウザの保存領域を利用できません。サイトデータの保存を許可してください。"); }
    if (raw === null) return structuredClone(initialProgress);
    if (new TextEncoder().encode(raw).length > MAX_SAVE_BYTES) throw new Error("保存データが大きすぎます。元のデータは変更していません。");
    let value: unknown; try { value = JSON.parse(raw); } catch { throw new Error("保存データを読み込めません。バックアップを読み込んでください。"); }
    return parseSave(value);
  };
  const write = (state: ProgressState) => {
    const raw = JSON.stringify(state);
    if (new TextEncoder().encode(raw).length > MAX_SAVE_BYTES) throw new Error("保存できるデータ量を超えました。バックアップを書き出してください。");
    try { storage.setItem(key, raw); } catch { throw new Error("保存できませんでした。ブラウザの空き容量と保存設定を確認してください。"); }
  };
  return {
    load,
    update: (input: unknown) => lock(async () => { const next = await applyProgress(await load(), input); write(next); return next; }),
    import: (input: unknown) => lock(async () => {
      const next = parseSave(input);
      // Import can repair a corrupt record; validate before touching it.
      let revision = 0; try { revision = (await load()).revision; } catch { /* Explicit import replaces unreadable saves. */ }
      next.revision = Math.max(revision, next.revision) + 1; write(next); return next;
    }),
  };
}
let store: ReturnType<typeof createProgressStore> | undefined;
function browserStore() {
  if (!store) {
    const key = `koharu-town:v1:${new URL(".", document.baseURI).pathname}`;
    store = createProgressStore(localStorage, key, async callback => {
      if (!navigator.locks) throw new Error("保存にはWeb Locks対応のブラウザが必要です。最新版のChrome・Edge・Firefox・Safariで開いてください。");
      return await navigator.locks.request(key, callback);
    });
  }
  return store;
}
export const loadProgress = () => browserStore().load();
export const updateProgress = (input: unknown) => browserStore().update(input);
export const importProgress = (input: unknown) => browserStore().import(input);
export function parseBackup(text: string): ProgressState {
  if (new TextEncoder().encode(text).length > MAX_SAVE_BYTES) throw new Error("バックアップは2MB以内のJSONファイルを選んでください。");
  let value: unknown; try { value = JSON.parse(text); } catch { throw new Error("JSON形式のバックアップを選んでください。"); }
  const envelope = z.object({ format: z.literal("koharu-town-save"), version: z.literal(1), progress: z.unknown() }).safeParse(value);
  return parseSave(envelope.success ? envelope.data.progress : value);
}
export function backupText(progress: ProgressState) { return JSON.stringify({ format: "koharu-town-save", version: 1, exportedAt: new Date().toISOString(), progress: parseSave(progress) }, null, 2); }
