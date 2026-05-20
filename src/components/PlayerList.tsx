import { getParticipants, PlayerState, myPlayer } from "playroomkit";
import { For, createMemo } from "solid-js";
import { PlayerAvatar } from "./PlayerAvatar";

export function PlayerList(
  props: { useRowLayout?: boolean } = { useRowLayout: false },
) {
  // Memoize the players list to handle reactivity when players join/leave or scores change
  const players = createMemo(() => Object.values(getParticipants()));
  // "border": "black 2px solid",
  return (
    <div
      style={{
        display: "flex",
        "flex-direction": props.useRowLayout ? "row" : "column",
        gap: "12px",
        padding: "16px",
        background: "#b3d1ff",
        "border-radius": "16px",
        border: "black 2px solid",
        width: props.useRowLayout ? "min(100%, 1000px)" : undefined,
        "min-height": props.useRowLayout ? "128px" : undefined,
        "max-width": props.useRowLayout ? "1000px" : "800px",
        "max-height": "600px",
        "align-items": props.useRowLayout ? "center" : undefined,
        "overflow-y": props.useRowLayout ? "hidden" : "auto",
        "overflow-x": props.useRowLayout ? "auto" : "hidden",
        "scrollbar-width": "thin",
        "flex-shrink": 0,
      }}
    >
      <For each={players()}>
        {(player: PlayerState) => {
          // Retrieve player state values
          const name = () => player.getState("name") || "Guest";
          const score = () => player.getState("score") ?? 0;
          const isMe = player.id === myPlayer().id;
          // justify-content: space-between
          return (
            <div
              style={{
                display: "flex",
                width: props.useRowLayout ? "220px" : "100%",
                "min-height": props.useRowLayout ? "96px" : undefined,
                "box-sizing": "border-box",
                "flex-shrink": props.useRowLayout ? 0 : 1,
                "align-items": "center",
                gap: "12px",
                padding: "8px",
                background: isMe
                  ? "rgba(255, 255, 255, 0.87)"
                  : "rgba(255, 255, 255, 0.5)",
                "border-radius": "12px",
                border: isMe ? "2px solid #fff" : "none",
                "align-self": "center",
                "justify-content": "flex-start",
              }}
            >
              {/* Reusable Avatar Component */}
              <PlayerAvatar player={player} />

              <div
                style={{
                  display: "flex",
                  "flex-direction": "column",
                  "justify-content": "center",
                }}
              >
                <span
                  style={{
                    "font-weight": "bold",
                    color: "#53524d",
                    "font-size": "1.1rem",
                  }}
                >
                  {name()} {isMe ? "(You)" : ""}
                </span>
                <span
                  style={{
                    color: "#53524d",
                    "font-size": "0.9rem",
                  }}
                >
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
