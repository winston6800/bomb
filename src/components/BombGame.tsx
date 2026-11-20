import { useCallback, useEffect, useRef, useState } from "react";
import { computerMove } from "@/lib/computer";

const W = 13, H = 11;
type Tile = 0 | 1 | 2; // empty, wall, crate
type Power = "bomb" | "fire";
type Player = { x: number; y: number; alive: boolean; bombs: number; range: number; dir: string | null; next: number; wins: number };
type Bomb = { x: number; y: number; t: number; owner: number; range: number };
type Fire = { x: number; y: number; t: number };

const START = [{ x: 0, y: 0 }, { x: W - 1, y: H - 1 }, { x: W - 1, y: 0 }, { x: 0, y: H - 1 }];
export const COLORS = ["Red", "Blue", "Green", "Gold"];
const STEP = 150, FUSE = 2200, BLAST = 500;

function makeMap(): Tile[][] {
  const g: Tile[][] = [];
  for (let y = 0; y < H; y++) {
    g.push([]);
    for (let x = 0; x < W; x++) {
      const wall = x % 2 === 1 && y % 2 === 1;
      const safe = Math.min(x, W - 1 - x) + Math.min(y, H - 1 - y) <= 1;
      g[y]!.push(wall ? 1 : !safe && Math.random() < 0.7 ? 2 : 0);
    }
  }
  return g;
}

function newRound(n: number, wins: number[] = []) {
  return {
    map: makeMap(),
    powers: new Map<string, Power>(),
    players: START.slice(0, n).map((s, i) => ({ ...s, alive: true, bombs: 1, range: 2, dir: null, next: 0, wins: wins[i] ?? 0 })) as Player[],
    bombs: [] as Bomb[],
    fires: [] as Fire[],
    over: null as null | string,
  };
}

const KEYS: Record<string, [number, string]> = {
  KeyW: [0, "up"], KeyS: [0, "down"], KeyA: [0, "left"], KeyD: [0, "right"],
  ArrowUp: [1, "up"], ArrowDown: [1, "down"], ArrowLeft: [1, "left"], ArrowRight: [1, "right"],
};
const BOMB_KEYS: Record<string, number> = { KeyF: 0, Space: 0, Enter: 1, Slash: 1 };
const D: Record<string, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export type GameApi = { press: (i: number, d: string) => void; release: (i: number, d: string) => void; drop: (i: number) => void; restart: () => void };

export function BombGame({ players: n, apiRef, names, computerSlot }: { players: number; apiRef?: { current: GameApi | null }; names?: string[]; computerSlot?: number | undefined }) {
  const s = useRef(newRound(n));
  const [, tick] = useState(0);
  const held = useRef<Record<number, string[]>>({ 0: [], 1: [], 2: [], 3: [] });

  const drop = useCallback((i: number) => {
    const g = s.current, p = g.players[i]!;
    if (!p.alive || g.over) return;
    const mine = g.bombs.filter((b) => b.owner === i).length;
    if (mine >= p.bombs || g.bombs.some((b) => b.x === p.x && b.y === p.y)) return;
    g.bombs.push({ x: p.x, y: p.y, t: performance.now() + FUSE, owner: i, range: p.range });
  }, []);

  const press = useCallback((i: number, d: string) => {
    const h = held.current[i]!;
    if (!h.includes(d)) h.push(d);
  }, []);
  const release = useCallback((i: number, d: string) => {
    held.current[i] = held.current[i]!.filter((x) => x !== d);
  }, []);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (KEYS[e.code]) { e.preventDefault(); press(...KEYS[e.code]!); }
      else if (e.code in BOMB_KEYS) { e.preventDefault(); if (!e.repeat) drop(BOMB_KEYS[e.code]!); }
    };
    const ku = (e: KeyboardEvent) => { if (KEYS[e.code]) release(...KEYS[e.code]!); };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    let raf = 0;
    const loop = () => {
      const g = s.current, now = performance.now();
      if (!g.over) {
        const bot = computerSlot === undefined ? undefined : g.players[computerSlot];
        if (bot?.alive && now >= bot.next && computerSlot !== undefined) {
          const move = computerMove(g.map, bot, g.players.find((p, i) => i !== computerSlot && p.alive), g.bombs, g.fires);
          held.current[computerSlot] = move.dir ? [move.dir] : [];
          if (move.bomb) drop(computerSlot);
        }
        g.players.forEach((p, i) => {
          const dir = held.current[i]!.at(-1);
          if (!p.alive || !dir || now < p.next) return;
          const [dx, dy] = D[dir]!;
          const nx = p.x + dx, ny = p.y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || g.map[ny]![nx] !== 0) return;
          if (g.bombs.some((b) => b.x === nx && b.y === ny)) return;
          p.x = nx; p.y = ny; p.next = now + STEP;
          const k = `${nx},${ny}`, pw = g.powers.get(k);
          if (pw) { if (pw === "bomb") p.bombs++; else p.range++; g.powers.delete(k); }
        });
        // explode
        let exploded = true;
        while (exploded) {
          exploded = false;
          for (const b of [...g.bombs]) {
            if (b.t > now) continue;
            exploded = true;
            g.bombs = g.bombs.filter((x) => x !== b);
            g.fires.push({ x: b.x, y: b.y, t: now + BLAST });
            for (const [dx, dy] of Object.values(D)) {
              for (let r = 1; r <= b.range; r++) {
                const x = b.x + dx * r, y = b.y + dy * r;
                if (x < 0 || y < 0 || x >= W || y >= H || g.map[y]![x] === 1) break;
                g.fires.push({ x, y, t: now + BLAST });
                const other = g.bombs.find((o) => o.x === x && o.y === y);
                if (other) other.t = now;
                if (g.map[y]![x] === 2) {
                  g.map[y]![x] = 0;
                  if (Math.random() < 0.3) g.powers.set(`${x},${y}`, Math.random() < 0.5 ? "bomb" : "fire");
                  break;
                }
                g.powers.delete(`${x},${y}`);
              }
            }
          }
        }
        g.fires = g.fires.filter((f) => f.t > now);
        g.players.forEach((p) => { if (p.alive && g.fires.some((f) => f.x === p.x && f.y === p.y)) p.alive = false; });
        const alive = g.players.filter((p) => p.alive);
        if (alive.length < 2) {
          if (alive.length === 1) { alive[0]!.wins++; const w = g.players.indexOf(alive[0]!); g.over = `${names?.[w] || COLORS[w]} wins!`; }
          else g.over = "Draw!";
        }
      }
      tick((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [drop, press, release, computerSlot, names]);

  const g = s.current;
  const restart = () => { s.current = newRound(n, s.current.players.map((p) => p.wins)); held.current = { 0: [], 1: [], 2: [], 3: [] }; };
  if (apiRef) apiRef.current = { press, release, drop, restart };

  const cells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = g.map[y]![x];
    const fire = g.fires.some((f) => f.x === x && f.y === y);
    const bomb = g.bombs.find((b) => b.x === x && b.y === y);
    const pw = g.powers.get(`${x},${y}`);
    const pi = g.players.findIndex((p) => p.alive && p.x === x && p.y === y);
    cells.push(
      <div key={`${x}-${y}`} className={`tile ${t === 1 ? "tile-wall" : t === 2 ? "tile-crate" : "tile-floor"}`}>
        {pw && !fire && <span className="power">{pw === "bomb" ? "+💣" : "+🔥"}</span>}
        {bomb && <span className="bomb" />}
        {pi >= 0 && <span className={`player player-${pi + 1}`} />}
        {fire && <span className="fire" />}
      </div>,
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-[640px] flex-wrap items-center justify-center gap-4 font-display text-sm">
        {g.players.map((p, i) => (
          <span key={i} className={`text-player-${i + 1} ${p.alive ? "" : "opacity-40"}`}>{names?.[i] || COLORS[i]} {p.wins}</span>
        ))}
      </div>
      <div className="relative w-full max-w-[640px]">
        <div className="board" style={{ gridTemplateColumns: `repeat(${W}, 1fr)` }}>{cells}</div>
        {g.over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl bg-background/80 backdrop-blur-sm">
            <p className="font-display text-3xl text-primary">{g.over}</p>
            <button onClick={restart} className="btn-arcade">Play again</button>
          </div>
        )}
      </div>
      <p className="text-center text-sm text-muted-foreground">Keyboard also works: Red WASD + F · Blue Arrows + Enter</p>
    </div>
  );
}

