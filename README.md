# Bomb Buddies Arena

Bomb Buddies Arena is a browser party game. The host screen runs the match, and players join from their phones using a QR code or room code. The host can also add computer opponents.

## Development

Use Node.js 24 and Bun 1.4.5. Install dependencies from the checked-in lockfile and start Vite.

```sh
bun install --frozen-lockfile
bun run dev --host 0.0.0.0
```

Open the URL printed by Vite to host a match. To join from a phone, open the host page using an address the phone can reach before sharing the QR code. The QR code uses the origin of the host page.

## Multiplayer configuration

In a local `.env` file, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to your Supabase project URL and publishable key. The host and phones use Supabase Realtime broadcast for room joins and controller inputs. The host runs all game logic. Keep private keys in your local environment and out of Git.

## Checks

```sh
bun run test
bun run build
bun run lint
```

The app uses React, TanStack Start, TypeScript, Tailwind CSS, and Supabase Realtime. Host and controller routes are in `src/routes/`. Update this README when setup commands, configuration, or the player flow change.
