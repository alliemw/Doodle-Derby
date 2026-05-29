import {
  getParticipants,
  isHost,
  onPlayerJoin,
  PlayerState,
} from "playroomkit";

// Minimum participants required for the game to keep running after a drop.
// A disconnect that leaves fewer than this terminates the game.
export const MIN_PLAYERS_TO_CONTINUE = 3;

export type DisconnectVerdict =
  | { kind: "terminate" }
  | { kind: "end-round" }
  | { kind: "continue" };

export function classifyDisconnect(player: PlayerState): DisconnectVerdict {
  const remaining = Object.values(getParticipants()).filter(
    (p) => p.id !== player.id,
  ).length;

  if (remaining < MIN_PLAYERS_TO_CONTINUE) return { kind: "terminate" };
  if (player.getState("isArtist")) return { kind: "end-round" };
  return { kind: "continue" };
}

export function onAnyPlayerQuit(
  handler: (player: PlayerState) => void,
): () => void {
  const quitCleanups: Array<() => void> = [];
  const seen = new Set<string>();

  const cleanupJoin = onPlayerJoin((player) => {
    const cleanup = player.onQuit(() => {
      if (seen.has(player.id)) return;
      seen.add(player.id);
      handler(player);
    });
    quitCleanups.push(cleanup);
  });

  return () => {
    cleanupJoin();
    for (const c of quitCleanups) c();
    quitCleanups.length = 0;
    seen.clear();
  };
}

export interface DisconnectOptions {
  onTerminate?: () => void;
  onArtistLeft?: (player: PlayerState) => void;
  onContinue?: (player: PlayerState) => void;
}

// Only fires callbacks on the current host so the actor is unambiguous.
export function installDisconnectHandler(
  opts: DisconnectOptions,
): () => void {
  return onAnyPlayerQuit((player) => {
    if (!isHost()) return;
    const verdict = classifyDisconnect(player);
    if (verdict.kind === "terminate") {
      opts.onTerminate?.();
      return;
    }
    if (verdict.kind === "end-round") {
      opts.onArtistLeft?.(player);
    } else {
      opts.onContinue?.(player);
    }
  });
}
