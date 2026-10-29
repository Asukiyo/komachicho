import { useRef, useState } from "react";
import { Download, Upload, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { backupText, importProgress, loadProgress, MAX_SAVE_BYTES, parseBackup } from "@/lib/game/progress";
import type { ProgressState } from "@/lib/game/types";

export default function SaveManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [candidate, setCandidate] = useState<ProgressState | null>(null), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  async function download() {
    try {
      const text = backupText(await loadProgress()), url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `koharu-save-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage("バックアップを書き出しました。");
    } catch (error) { setMessage((error as Error).message); }
  }
  async function choose(selected?: File) {
    setCandidate(null); if (!selected) return;
    try { if (selected.size > MAX_SAVE_BYTES) throw new Error("2MB以内のJSONファイルを選んでください。"); setCandidate(parseBackup(await selected.text())); setMessage(""); }
    catch (error) { setMessage((error as Error).message); }
    if (file.current) file.current.value = "";
  }
  async function restore() {
    if (!candidate) return; setBusy(true);
    try { await importProgress(candidate); window.location.reload(); }
    catch (error) { setMessage((error as Error).message); setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!value && !busy) { setCandidate(null); setMessage(""); onClose(); } }}><DialogContent className="koharu-dialog save-dialog"><DialogHeader>
    <DialogTitle><Save size={20} /> 学習データ</DialogTitle><DialogDescription>進捗とコードは、このブラウザに自動保存されます。別の端末へ移るときや、ブラウザのデータを消す前にバックアップしてください。サーバーへの同期はありません。</DialogDescription>
  </DialogHeader><div className="save-actions"><Button onClick={() => void download()} disabled={busy}><Download size={16} /> バックアップを書き出す</Button><Button onClick={() => file.current?.click()} disabled={busy}><Upload size={16} /> バックアップを選ぶ</Button></div>
    <input ref={file} type="file" accept="application/json,.json" hidden onChange={event => void choose(event.target.files?.[0])} />
    {candidate && <div className="save-confirm"><p>基礎課題 {candidate.completed.length}/32・町の依頼 {Object.values(candidate.town.projects).filter(p => p.deliveredAt).length}/8 件のデータです。読み込むと現在の進捗と書きかけを置き換えます。</p><Button onClick={() => void restore()} disabled={busy}>このデータに置き換える</Button><button onClick={() => setCandidate(null)} disabled={busy}>やめる</button></div>}
    {message && <p role="status">{message}</p>}
  </DialogContent></Dialog>;
}
