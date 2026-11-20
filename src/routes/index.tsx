import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BombGame, COLORS, type GameApi } from "@/components/BombGame";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { controllerUrl, matchPlayers } from "@/lib/room";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bomb It — party bomb battle with phone controllers" },
      { name: "description", content: "Put the game on a big screen, join with a code on your phone and bomb your friends. Up to 4 players." },
      { property: "og:title", content: "Bomb It — party bomb battle" },
      { property: "og:description", content: "Big-screen bomb maze battle. Phones are the controllers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Host,
});

type Joined = { id: string; name: string };

function Host() {
  const [code, setCode] = useState("");
  const [players, setPlayers] = useState<Joined[]>([]);
  const [started, setStarted] = useState(false);
  const [origin, setOrigin] = useState("");
  const api = useRef<GameApi | null>(null);
  const playersRef = useRef<Joined[]>([]);
  const chan = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const c = Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)]).join("");
    setCode(c);
    setOrigin(window.location.origin);
    const ch = supabase.channel(`bombit-${c}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "join" }, ({ payload }) => {
      const { id, name } = payload as Joined;
      let list = playersRef.current;
      let slot = list.findIndex((p) => p.id === id);
      if (slot < 0 && list.length < 4 && !startedRef.current) {
        list = [...list, { id, name: (name || COLORS[list.length] || "Player").slice(0, 12) }];
        slot = list.length - 1;
        playersRef.current = list;
        setPlayers(list);
      }
      ch.send({ type: "broadcast", event: "assign", payload: { id, slot } });
    });
    ch.on("broadcast", { event: "input" }, ({ payload }) => {
      const { slot, kind, dir } = payload as { slot: number; kind: string; dir?: string };
      const a = api.current;
      if (!a) return;
      if (kind === "press" && dir) a.press(slot, dir);
      else if (kind === "release" && dir) a.release(slot, dir);
      else if (kind === "bomb") a.drop(slot);
      else if (kind === "restart") a.restart();
    });
    ch.subscribe();
    chan.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, []);

  const startedRef = useRef(false);
  const start = () => { startedRef.current = true; setStarted(true); };

  return (
    <main className="min-h-screen select-none px-3 py-6">
      <h1 className="mb-4 text-center font-display text-4xl tracking-wider text-primary sm:text-5xl">BOMB IT</h1>
      {started ? (
        <BombGame players={matchPlayers(players.length)} computerSlot={players.length === 1 ? 1 : undefined} apiRef={api} names={players.length === 1 ? [players[0]?.name || "Red", "Computer"] : players.map((p) => p.name)} />
      ) : (
        <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
          <p className="font-display text-lg">Scan to join</p>
          {origin && code ? <a href={controllerUrl(origin, code)} aria-label="Open phone controller" className="qr-code block rounded-lg">
            <QRCodeSVG value={controllerUrl(origin, code)} size={192} marginSize={4} level="M" bgColor="var(--qr-paper)" fgColor="var(--qr-ink)" title="Scan to join this room" />
          </a> : <div className="h-48 w-48" />}
          <p className="font-display text-4xl text-primary">{code || "····"}</p>
          <div className="flex min-h-24 flex-wrap justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`flex h-20 w-24 flex-col items-center justify-center rounded-xl border-2 ${players[i] ? "border-foreground" : "border-dashed border-border"}`}>
                <span className={`mb-1 h-6 w-6 rounded-full ${players[i] ? `bg-player-${i + 1}` : "bg-muted"}`} />
                <span className="text-xs">{players[i]?.name ?? "waiting…"}</span>
              </div>
            ))}
          </div>
          <Button disabled={players.length < 1} onClick={start} className="btn-arcade h-auto">
            {players.length < 1 ? "Waiting for a phone" : players.length === 1 ? "Play vs computer" : "Start game"}
          </Button>
          <Link to="/play" search={{ code }} className="text-sm text-muted-foreground underline">I'm a controller</Link>
        </div>
      )}
    </main>
  );
}
