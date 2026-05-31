import { createSignal, onMount, onCleanup, Show } from "solid-js"
import { isHost, getState, setState } from "playroomkit"
import { DEFAULT_TIMER } from "../components/SettingsModal";
import { AudioManager } from "./AudioManager";

export function getTimerInterval(roundEnded: boolean, endRound: (reason: string) => void) {
  return setInterval(() => {
    if (!isHost() || roundEnded) return;
    const endTime = getState("round-end-time");
    if (typeof endTime !== "number") return;
    if (Date.now() >= endTime) {
      endRound("timerExpired");
    }
  }, 250);
}

function createTickPlayer() {
  let last: number | null = null;
  return (next: number) => {
    if (last !== null && next < last && next >= 1 && next <= 5) {
      if (next === 1) {
        AudioManager.playSound("/audio/lasttick.mp3");
      } else {
        AudioManager.playSound("/audio/firsttick.mp3");
      }
    }
    last = next;
  };
}

export function TimerDisplay(props: { playTicks?: boolean }) {
  const [secondsLeft, setSecondsLeft] = createSignal<number | null>(null);
  const shouldPlayTicks = () => props.playTicks !== false;
  const playTick = createTickPlayer();

  onMount(() => {
    // Host starts the round timer.
    if (isHost()) {
      const duration = (getState("timer-seconds") ?? DEFAULT_TIMER) * 1000;
      setState("round-end-time", Date.now() + duration, true);
    }

    const tick = () => {
      const endTime = getState("round-end-time");
      if (typeof endTime !== "number") {
        setSecondsLeft(null);
        return;
      }
      const next = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setSecondsLeft(next);
      if (shouldPlayTicks()) playTick(next);
    };

    tick();
    const id = setInterval(tick, 250);
    onCleanup(() => clearInterval(id));
  });

  return (
    <Show when={secondsLeft() !== null}>
      <div
        class="round-timer"
        classList={{ "round-timer-warning": (secondsLeft() ?? 0) <= 10 }}
      >
        {secondsLeft()}s
      </div>
    </Show>
  );
}

export function PromptSelectionTimer() {
  const [secondsLeft, setSecondsLeft] = createSignal<number | null>(null);
  const playTick = createTickPlayer();

  onMount(() => {
    const tick = () => {
      const endTime = getState("prompt-selection-end-time");
      if (typeof endTime !== "number") {
        setSecondsLeft(null);
        return;
      }
      const next = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setSecondsLeft(next);
      playTick(next);
    };

    tick();
    const id = setInterval(tick, 250);
    onCleanup(() => clearInterval(id));
  });

  return (
    <Show when={secondsLeft() !== null}>
      <div
        class="round-timer"
        classList={{ "round-timer-warning": (secondsLeft() ?? 0) <= 5 }}
      >
        {secondsLeft()}s
      </div>
    </Show>
  );
}
