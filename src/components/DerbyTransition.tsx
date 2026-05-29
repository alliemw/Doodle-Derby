import { onMount, onCleanup, createSignal, createMemo, For } from "solid-js";
import {
  RPC,
  isHost,
  setState,
  getParticipants,
  myPlayer,
  PlayerState,
} from "playroomkit";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { getTimerInterval, TimerDisplay } from "../components/TimerDisplay";

import "../../style/transition-page.css";

const LEADERBOARD_TIME = 5;
const INTRO_DELAY_MS = 600;
const COUNT_DURATION_MS = 1400;
const COUNT_FPS = 30;

interface LeaderboardEntry {
  id: string;
  player: PlayerState;
  name: string;
  oldScore: number;
  newScore: number;
  delta: number;
  oldRank: number;
}

export default function DerbyTransition() {
  const [entries, setEntries] = createSignal<LeaderboardEntry[]>([]);
  const [displayScores, setDisplayScores] = createSignal<Record<string, number>>({});
  const [animationDone, setAnimationDone] = createSignal(false);

  let roundEnded = false;

  onMount(() => {
    if (isHost()) {
      setState("timer-seconds", LEADERBOARD_TIME);
    }

    const players = Object.values(getParticipants());

    const initial: LeaderboardEntry[] = players.map((player) => {
      const newScore = player.getState("score") ?? 0;
      const oldScore = player.getState("roundStartScore") ?? newScore;
      return {
        id: player.id,
        player,
        name: player.getState("name") ?? "Guest",
        oldScore,
        newScore,
        delta: newScore - oldScore,
        oldRank: 0,
      };
    });

    // Old ranking: sort by score at the start of this round (stable by name on tie).
    const oldOrder = [...initial].sort((a, b) => {
      if (b.oldScore !== a.oldScore) return b.oldScore - a.oldScore;
      return a.name.localeCompare(b.name);
    });
    oldOrder.forEach((entry, i) => {
      entry.oldRank = i;
    });

    setEntries(initial);

    const startingDisplay: Record<string, number> = {};
    initial.forEach((e) => {
      startingDisplay[e.id] = e.oldScore;
    });
    setDisplayScores(startingDisplay);

    // Pause briefly on the old ranking, then animate score counters.
    const introTimeout = setTimeout(() => {
      const steps = Math.max(1, Math.round((COUNT_DURATION_MS / 1000) * COUNT_FPS));
      let step = 0;
      const tickInterval = setInterval(() => {
        step += 1;
        const raw = step / steps;
        // Ease-out cubic for a satisfying settle.
        const t = 1 - Math.pow(1 - Math.min(1, raw), 3);
        const next: Record<string, number> = {};
        initial.forEach((e) => {
          next[e.id] = Math.round(e.oldScore + (e.newScore - e.oldScore) * t);
        });
        setDisplayScores(next);
        if (raw >= 1) {
          clearInterval(tickInterval);
          // Snap to exact final values.
          const final: Record<string, number> = {};
          initial.forEach((e) => {
            final[e.id] = e.newScore;
          });
          setDisplayScores(final);
          setAnimationDone(true);
        }
      }, 1000 / COUNT_FPS);

      onCleanup(() => clearInterval(tickInterval));
    }, INTRO_DELAY_MS);

    onCleanup(() => clearTimeout(introTimeout));

    if (isHost()) {
      const nextRound = (reason: string) => {
        console.info(`[DD][Transition] endTransition:${reason}`);
        RPC.call("nextRound", {}, RPC.Mode.ALL);
      };
      const timerInterval = getTimerInterval(roundEnded, nextRound);
      onCleanup(() => clearInterval(timerInterval));
    }
  });

  // Current ranking, derived from the (animating) display scores. As the
  // counters tick from old → new, rows re-sort and slide into place.
  const ranking = createMemo(() => {
    const scores = displayScores();
    const sorted = [...entries()].sort((a, b) => {
      const sa = scores[a.id] ?? a.oldScore;
      const sb = scores[b.id] ?? b.oldScore;
      if (sb !== sa) return sb - sa;
      return a.name.localeCompare(b.name);
    });
    const map: Record<string, number> = {};
    sorted.forEach((e, i) => {
      map[e.id] = i;
    });
    return map;
  });

  return (
    <div class="derby-transition">
      <div class="derby-transition-header">
        <h1 class="derby-transition-title">Derby Results</h1>
        <span class="derby-transition-subtitle">
          Next derby starting...
        </span>
        <TimerDisplay />
      </div>

      <div
        class="leaderboard"
        style={{
          height: `calc(var(--row-height) * ${entries().length} + var(--row-gap) * ${Math.max(0, entries().length - 1)})`,
        }}
      >
        <For each={entries()}>
          {(entry) => {
            const currentRank = () => ranking()[entry.id] ?? entry.oldRank;
            const isMe = entry.id === myPlayer().id;
            const rankDelta = () => entry.oldRank - currentRank();
            const showDelta = () => animationDone() && entry.delta !== 0;
            const showTrend = () => animationDone();

            return (
              <div
                class="leaderboard-row"
                classList={{
                  "is-me": isMe,
                  "rank-up": animationDone() && rankDelta() > 0,
                  "rank-down": animationDone() && rankDelta() < 0,
                }}
                data-rank={currentRank() + 1}
                style={{
                  transform: `translateY(calc((var(--row-height) + var(--row-gap)) * ${currentRank()}))`,
                }}
              >
                <div class="leaderboard-rank">{currentRank() + 1}</div>
                <PlayerAvatar player={entry.player} />
                <div class="leaderboard-info">
                  <span class="leaderboard-name">
                    {entry.name}
                    {isMe ? " (You)" : ""}
                  </span>
                  <div class="leaderboard-score-line">
                    <span class="leaderboard-score">
                      {displayScores()[entry.id] ?? entry.oldScore}
                    </span>
                    <span class="leaderboard-score-suffix">pts</span>
                    <span
                      class="leaderboard-delta"
                      classList={{
                        show: showDelta(),
                        "delta-zero": entry.delta === 0,
                      }}
                    >
                      +{entry.delta}
                    </span>
                  </div>
                </div>
                <div
                  class="leaderboard-trend"
                  classList={{
                    show: showTrend(),
                    up: rankDelta() > 0,
                    down: rankDelta() < 0,
                    same: rankDelta() === 0,
                  }}
                >
                  {rankDelta() > 0 ? "▲" : rankDelta() < 0 ? "▼" : "—"}
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
