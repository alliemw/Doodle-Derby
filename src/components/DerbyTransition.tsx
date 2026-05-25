import { onMount, onCleanup } from "solid-js"
import { RPC, isHost, setState } from "playroomkit"
import { PlayerList } from "../components/PlayerList"
import { getTimerInterval, TimerDisplay } from "../components/TimerDisplay"

const LEADERBOARD_TIME = 5;
export default function DerbyTransition() {
  let roundEnded = false;
  onMount(() => {
    if (!isHost()) return;
    setState("timer-seconds", LEADERBOARD_TIME);

    const nextRound = (reason: string) => {
      console.info(`[DD][Transition] endTransition:${reason}`);
      RPC.call("nextRound", {}, RPC.Mode.ALL);
    }
    let timerInterval = getTimerInterval(roundEnded, nextRound);
    onCleanup(() => {
      clearInterval(timerInterval);
    });
  });

  return (
    <>
      <h1>Transition Page</h1>
      <TimerDisplay />
      <div style={{ display: 'flex', "align-items": 'center' }}>
        <PlayerList forTransition={true} />
        <img src="IMPASTA.gif" alt="Impasta" style={{ "margin-left": "16" }} />
      </div>
    </>
  );
}
