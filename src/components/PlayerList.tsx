import { getParticipants, PlayerState, myPlayer } from "playroomkit";
import { For, createSignal, createMemo, onMount, onCleanup } from "solid-js";
import { PlayerAvatar } from "./PlayerAvatar";

interface PlayerStat {
  name: string
  score: number
  id: string
  finishedGuessing: boolean
}

export function PlayerList(
  props: { useRowLayout?: boolean, forTransition?: boolean } = { useRowLayout: false, forTransition: false },
) {
  const [playerStats, setPlayerStats] = createSignal<PlayerStat[]>([]);
  const [players] = createSignal<PlayerState[]>(Object.values(getParticipants()));

  onMount(() => {
    if (props.forTransition) {
      players().sort((a, b) => b.getState("score") - a.getState("score"));
    }

    const updatePlayerStat = () => {
      setPlayerStats(players().map(player => {
        let playerStat = {
          name: player.getState("name") ?? "Guest",
          score: player.getState("score") ?? 0,
          id: player.id,
          finishedGuessing: player.getState("finishedGuesses")
        };
        return playerStat;
      }));
    }

    const id = setInterval(() => {
      updatePlayerStat();
    }, 250);

    onCleanup(() => {
      clearInterval(id);
    });
  });

  const containerClass = () =>
    props.useRowLayout ? "player-list player-list-row" : "player-list player-list-column";

  return (
    <div class={containerClass()}>
      <For each={playerStats()}>
        {(player: PlayerStat, i) => {
          const name = () => player.name;
          const score = () => player.score;
          const isMe = player.id === myPlayer().id;
          const finished = () => player.finishedGuessing;
          return (
            <div class={`player-list-card${(isMe && (!finished() || props.forTransition)) ? " is-me" : ""}${finished() && !props.forTransition ? " finished" : ""}`}>
              <PlayerAvatar player={players()[i()]} />
              <div class="player-list-card-info">
                <span class="player-list-card-name">
                  {name()} {isMe ? "(You)" : ""}
                </span>
                <span class="player-list-card-score">
                  {score()} points
                </span>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}
