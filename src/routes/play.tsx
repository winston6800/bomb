import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { COLORS } from "@/components/BombGame";
import { roomCode } from "@/lib/room";

export const Route = createFileRoute("/play")({
  validateSearch: (search: Record<string, unknown>) => ({ code: roomCode(search["code"]) }),
  head: () => ({
    meta: [
      { title: "Bomb It — phone controller" },
      { name: "description", content: "Enter the room code to turn your phone into a Bomb It controller." },
      { property: "og:title", content: "Bomb It — phone controller" },
      { property: "og:description", content: "Join a Bomb It game with a code and play from your phone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Controller,
});

function Controller() {
  const search = Route.useSearch();
  const [code, setCode] = useState(search.code);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "joining" | "full" | "ready">("idle");
  const [slot, setSlot] = useState(-1);
  const chan = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const id = useRef("");

  useEffect(() => {
    id.current = sessionStorage.getItem("bombit-id") || crypto.randomUUID();
    sessionStorage.setItem("bombit-id", id.current);
    return () => { if (chan.current) supabase.removeChannel(chan.current); };
  }, []);

  const join = () => {
    const c = code.trim().toUpperCase();
    if (c.length !== 4) return;
    setStatus("joining");
    if (chan.current) supabase.removeChannel(chan.current);
    const ch = supabase.channel(`bombit-${c}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "assign" }, ({ payload }) => {
      const p = payload as { id: string; slot: number };
      if (p.id !== id.current) return;
      if (p.slot < 0) setStatus("full");
      else { setSlot(p.slot); setStatus("ready"); }
    });
    ch.subscribe((s) => {
      if (s === "SUBSCRIBED") ch.send({ type: "broadcast", event: "join", payload: { id: id.current, name: name.trim() } });
    });
    chan.current = ch;
    setTimeout(() => setStatus((st) => (st === "joining" ? "idle" : st)), 6000);
  };

  const send = (kind: string, dir?: string) => {
    navigator.vibrate?.(kind === "bomb" ? 30 : 8);
    chan.current?.send({ type: "broadcast", event: "input", payload: { slot, kind, dir } });
  };

  if (status !== "ready") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
        <h1 className="font-display text-4xl text-primary">BOMB IT</h1>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))} placeholder="CODE"
          className="w-56 rounded-xl border-2 border-border bg-card px-4 py-3 text-center font-display text-3xl tracking-[0.3em] text-foreground outline-none focus:border-primary" />
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, 12))} placeholder="Your name"
          className="w-56 rounded-xl border-2 border-border bg-card px-4 py-3 text-center text-foreground outline-none focus:border-primary" />
        <button onClick={join} disabled={code.length !== 4 || status === "joining"} className="btn-arcade disabled:opacity-40">
          {status === "joining" ? "Joining…" : "Join"}
        </button>
        {status === "full" && <p className="text-destructive">That game is full or already started.</p>}
        <p className="max-w-xs text-center text-sm text-muted-foreground">The code is shown on the big screen.</p>
      </main>
    );
  }

  const hold = (dir: string) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); send("press", dir); },
    onPointerUp: () => send("release", dir),
    onPointerLeave: () => send("release", dir),
    onPointerCancel: () => send("release", dir),
  });

  return (
    <main className="flex min-h-screen touch-none select-none flex-col items-center justify-center gap-8 px-4">
      <p className={`font-display text-2xl text-player-${slot + 1}`}>You are {name || COLORS[slot]}</p>
      <div className="flex w-full max-w-md items-center justify-between">
        <div className="grid grid-cols-3 grid-rows-3 gap-2" style={{ gridTemplateAreas: `". u ." "l . r" ". d ."` }}>
          <button style={{ gridArea: "u" }} className="pad-btn-lg" {...hold("up")}>▲</button>
          <button style={{ gridArea: "l" }} className="pad-btn-lg" {...hold("left")}>◀</button>
          <button style={{ gridArea: "r" }} className="pad-btn-lg" {...hold("right")}>▶</button>
          <button style={{ gridArea: "d" }} className="pad-btn-lg" {...hold("down")}>▼</button>
        </div>
        <button className={`pad-bomb-lg bg-player-${slot + 1}`} onPointerDown={(e) => { e.preventDefault(); send("bomb"); }}>💣</button>
      </div>
      <button onClick={() => send("restart")} className="text-sm text-muted-foreground underline">New round</button>
    </main>
  );
}
