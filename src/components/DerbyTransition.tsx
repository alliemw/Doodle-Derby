import { onMount } from "solid-js"
import { RPC, isHost } from "playroomkit"
import { PlayerList } from "../components/PlayerList"

const LEADERBOARD_TIME = 5000;
export default function DerbyTransition() {
  onMount(() => {
    if (!isHost()) return;
    setTimeout(() => RPC.call("nextRound", {}, RPC.Mode.ALL), LEADERBOARD_TIME);
  });

  return (
    <>
      <h1>Transition Page</h1>
      <div style={{ display: 'flex', "align-items": 'center' }}>
        <PlayerList forTransition={true} />
        <img src="IMPASTA.gif" alt="Impasta" style={{ "margin-left": "16" }} />
      </div>
    </>
  );
}
