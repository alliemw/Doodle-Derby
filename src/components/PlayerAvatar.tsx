import { PlayerState } from "playroomkit";
import { Show, For } from "solid-js";

// Component that takes a specific player state to render their character
export function PlayerAvatar(props: { player: PlayerState}) {
  // Access player state reactively
  const character = () => props.player.getState("character");
  const accessories = () => props.player.getState("accessories") || [];

  return (
    <div
      class="player-avatar"
      style={{
        position: "relative",
        width: "var(--player-avatar-size, 60px)",
        height: "var(--player-avatar-size, 60px)",
        display: "flex",
        "justify-content": "center",
        "align-items": "flex-end",
        background: "rgba(255, 255, 255, 0)",
        "border-radius": "12px",
        "flex-shrink": 0,
      }}
    >
      {/* Base Character */}
      <Show when={character()}>
        <img
          src={character()}
          style={{
            width: "100%",
            height: "100%",
            "object-fit": "contain",
            position: "absolute",
            "z-index": 1,
          }}
        />
      </Show>

      {/* Layered Accessories */}
      <For each={accessories()}>
        {(accPath) => (
          <img
            src={accPath}
            style={{
              width: "100%",
              height: "100%",
              "object-fit": "contain",
              position: "absolute",
              "z-index": 2,
              "pointer-events": "none",
            }}
          />
        )}
      </For>
    </div>
  );
}
