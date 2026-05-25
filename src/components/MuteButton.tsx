import { createSignal } from "solid-js";
import { AudioManager } from "./AudioManager";
import { IconButton } from "./IconButton";

export interface MuteButtonProps {
    onClick(): void;
}

export function MuteButton(props :MuteButtonProps) {
  const { isMuted, toggleMute } = AudioManager;
  const [isHovered, setIsHovered] = createSignal(false);

  const mutedSrc = "/audio/Sound_icon_muted.png";
  const mutedHiglightedSrc = "/audio/Sound_icon_muted_highlighted.png";
  const unmutedSrc = "/audio/Sound_icon_on.png";
  const unmutedHiglightedSrc = "/audio/Sound_icon_on_highlighted.png";

  return (
    <button
      class="icon-btn mute-btn"
      onClick={() => {
        toggleMute();
        props.onClick();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        class="icon-btn__img"
        src={
          isMuted()
            ? isHovered()
              ? mutedHiglightedSrc
              : mutedSrc
            : isHovered()
              ? unmutedHiglightedSrc
              : unmutedSrc
        }
        alt={isMuted() ? "Unmute" : "Mute"}
      />
    </button>
  );
}
