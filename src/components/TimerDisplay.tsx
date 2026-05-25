import { createSignal, onMount, onCleanup, Show } from "solid-js"
import { isHost, getState, setState } from "playroomkit"
import { DEFAULT_TIMER } from "../components/SettingsModal";

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

export function TimerDisplay() {
  const [secondsLeft, setSecondsLeft] = createSignal<number | null>(null);

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
      setSecondsLeft(Math.max(0, Math.ceil((endTime - Date.now()) / 1000)));
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
