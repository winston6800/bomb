export function controllerUrl(origin: string, code: string) {
  return `${origin}/play?code=${encodeURIComponent(code)}`;
}

export function roomCode(value: unknown) {
  return typeof value === "string" && /^[A-Z]{4}$/.test(value.toUpperCase()) ? value.toUpperCase() : "";
}

export function matchPlayers(humans: number) {
  return Math.max(2, humans);
}