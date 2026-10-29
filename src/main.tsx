import { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import "../app/town.css";
const TownGame = lazy(() => import("../components/town/TownGame"));
const Game = lazy(() => import("../components/game/Game"));
function App() {
  const [practice, setPractice] = useState(location.hash === "#/practice");
  useEffect(() => { const change = () => setPractice(location.hash === "#/practice"); window.addEventListener("hashchange", change); return () => window.removeEventListener("hashchange", change); }, []);
  return <Suspense fallback={<main className="koharu-loading"><h1>小春町</h1><p>制作の準備をしています…</p></main>}>
    {practice ? <><a className="practice-return" href="#/">小春町へ戻る</a><Game /></> : <TownGame />}
  </Suspense>;
}
createRoot(document.getElementById("root")!).render(<App />);
