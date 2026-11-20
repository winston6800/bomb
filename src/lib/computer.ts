type Point = { x: number; y: number };
type Bomb = Point & { range: number };
const directions = [{ dir: "up", x: 0, y: -1 }, { dir: "down", x: 0, y: 1 }, { dir: "left", x: -1, y: 0 }, { dir: "right", x: 1, y: 0 }];

export function computerMove(map: number[][], player: Point, target: Point | undefined, bombs: Bomb[], fires: Point[]) {
  const danger = (p: Point) => fires.some(f => f.x === p.x && f.y === p.y) || bombs.some(b => {
    if (p.x !== b.x && p.y !== b.y) return false;
    const distance = Math.abs(p.x - b.x) + Math.abs(p.y - b.y);
    if (distance > b.range) return false;
    const dx = Math.sign(p.x - b.x), dy = Math.sign(p.y - b.y);
    for (let i = 1; i < distance; i++) if (map[b.y + dy * i]?.[b.x + dx * i] !== 0) return false;
    return true;
  });
  const queue = [{ ...player, first: "", steps: 0 }];
  const seen = new Set([`${player.x},${player.y}`]);
  const escaping = danger(player);
  let best = "", score = Infinity;
  for (let index = 0; index < queue.length; index++) {
    const p = queue[index];
    if (!p) continue;
    if (p.steps > 0 && !danger(p)) {
      if (escaping) return { dir: p.first, bomb: false };
      const distance = target ? Math.abs(p.x - target.x) + Math.abs(p.y - target.y) : 0;
      const value = distance + p.steps * 0.2;
      if (value < score) { best = p.first; score = value; }
    }
    for (const d of directions) {
      const x = p.x + d.x, y = p.y + d.y, key = `${x},${y}`;
      if (seen.has(key) || map[y]?.[x] !== 0 || bombs.some(b => b.x === x && b.y === y)) continue;
      if (!escaping && danger({ x, y })) continue;
      seen.add(key);
      queue.push({ x, y, first: p.first || d.dir, steps: p.steps + 1 });
    }
  }
  const nearCrate = directions.some(d => map[player.y + d.y]?.[player.x + d.x] === 2);
  const nearTarget = target && Math.abs(player.x - target.x) + Math.abs(player.y - target.y) <= 2;
  return { dir: best, bomb: !escaping && Boolean(nearCrate || nearTarget) && queue.length > 3 };
}