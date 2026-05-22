import { getParticipants, PlayerState, myPlayer } from "playroomkit";
import { For, createMemo } from "solid-js";
import { PlayerAvatar } from "./PlayerAvatar";

export function PlayerList(
  props: { useRowLayout?: boolean } = { useRowLayout: false },
) {
  const players = createMemo(() => Object.values(getParticipants()));
  const containerClass = () =>
    props.useRowLayout ? "player-list player-list-row" : "player-list player-list-column";

  return (
    <div class={containerClass()}>
      <For each={players()}>
        {(player: PlayerState) => {
          const name = () => player.getState("name") || "Guest";
          const score = () => player.getState("score") ?? 0;
          const isMe = player.id === myPlayer().id;
          return (
            <div class={`player-list-card${isMe ? " is-me" : ""}`}>
              <PlayerAvatar player={player} />

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
