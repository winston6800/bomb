import { describe, expect, it } from "vitest";
import { controllerUrl, matchPlayers, roomCode } from "./room";
import { computerMove } from "./computer";

describe("Phone joining and solo matches", () => {
  it("includes the host's room in the QR destination", () => {
    expect(controllerUrl("https://game.example", "ABCD")).toBe("https://game.example/play?code=ABCD");
    expect(roomCode("abcd")).toBe("ABCD");
    expect(roomCode("bad")).toBe("");
  });
  it("gives one phone a second player without adding opponents to multiplayer", () => {
    expect(matchPlayers(1)).toBe(2);
    expect(matchPlayers(2)).toBe(2);
    expect(matchPlayers(4)).toBe(4);
  });
  it("makes the computer move out of a bomb's blast path", () => {
    const move = computerMove(Array.from({ length: 5 }, () => Array(5).fill(0)), { x: 2, y: 2 }, { x: 0, y: 0 }, [{ x: 2, y: 2, range: 2 }], []);
    expect(["up", "down", "left", "right"]).toContain(move.dir);
    expect(move.bomb).toBe(false);
  });
});