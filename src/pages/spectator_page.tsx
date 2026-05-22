import {
  For,
  Show,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { PlayerState, getState } from "playroomkit";
import { SpectatorCanvas } from "../../api/draw/ArtistCanvasComponent";
import { PlayerList } from "../components/PlayerList";
import { MuteButton } from "../components/MuteButton";
import { IconButton } from "../components/IconButton";
import { AudioManager } from "../components/AudioManager";
import { DEFAULT_TIMER, SettingsModal } from "../components/SettingsModal";
import { ChatGuesser } from "../../api/guess/GuessComponent";
import { ReactionBar } from "../../api/reactions/ReactionBarComponent";
import "../../style/spectator-page.css";

interface SpectatorPageProps {
  artistList: PlayerState[];
}

const NARROW_BREAKPOINT = 1200;

export function SpectatorPage(props: SpectatorPageProps) {
  let [prompts, setPrompts] = createSignal<string[]>([]);
  let [hiddenPrompts, setHiddenPrompts] = createSignal<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false);
  const [isNarrow, setIsNarrow] = createSignal(
    typeof window !== "undefined" && window.innerWidth < NARROW_BREAKPOINT,
  );
  const visibleArtists = createMemo(() => props.artistList.slice(0, 2));

  const hangman = (prompt: string) => {
    let hidden = "";
    for (let i = 0; i < prompt.length; i++) {
      if (prompt.charAt(i) === " ") {
        hidden += " ";
      } else {
        hidden += "_";
      }
      hidden += " ";
    }
    return hidden;
  };

  onMount(() => {
    const updatePrompts = () => {
      if (props.artistList.length < 2) return;
      const nextPrompts = [
        props.artistList[0].getState("prompt") || "",
        props.artistList[1].getState("prompt") || "",
      ];
      const current = prompts();
      if (
        current.length !== nextPrompts.length ||
        current[0] !== nextPrompts[0] ||
        current[1] !== nextPrompts[1]
      ) {
        setPrompts(nextPrompts);
        setHiddenPrompts([hangman(nextPrompts[0]), hangman(nextPrompts[1])]);
      }
    };

    updatePrompts();
    const interval = setInterval(updatePrompts, 250);
    onCleanup(() => clearInterval(interval));

    const updateNarrow = () =>
      setIsNarrow(window.innerWidth < NARROW_BREAKPOINT);
    updateNarrow();
    window.addEventListener("resize", updateNarrow);
    onCleanup(() => window.removeEventListener("resize", updateNarrow));
  });

  return (
    <div class="audience-page">
      <Show
        when={visibleArtists().length >= 2}
        fallback={
          <div class="waiting-screen">
            <img
              src="/sheep_thinking.gif"
              alt="thinking sheep"
              class="waiting-sheep"
            />
            <div class="waiting-content">
              <p class="waiting-label">Loading artists...</p>
            </div>
          </div>
        }
      >
        <div class="spectator-header">
          <h1 class="round-header">
            Derby {(getState("roundsPlayed") ?? 0) + 1}
          </h1>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "0px",
            }}
          >
            <MuteButton
              onClick={() => {
                if (!AudioManager.isMuted())
                  AudioManager.playLoop("/audio/DDsong.mp3");
              }}
            />
            <IconButton
              id="icon-btn"
              defaultImg="/lobby/settings_icon.png"
              hoverImg="/lobby/settings_icon_highlighted.png"
              altText="Settings"
              onClick={() => setIsSettingsOpen(true)}
            />

          </div>
          <div class="audience-players-container">
               <PlayerList useRowLayout={isNarrow()}/>
          </div>
         
        </div>
        <For each={visibleArtists()}>
          {(artist, index) => (
            <div
              class={`audience-canvas-container audience-canvas-container${index()}`}
            >
              <SpectatorCanvas
                artist={artist}
                hiddenPrompt={hiddenPrompts()[index()]}
              />
            </div>
          )}
        </For>
        <div class="audience-chat-container">
          <ChatGuesser
            promptList={prompts()}
            artists={props.artistList}
            notArtist={true}
          />
          <ReactionBar />
        </div>
      </Show>

      <Show when={isSettingsOpen()}>
        <SettingsModal
          timerSeconds={getState("timer-seconds") ?? DEFAULT_TIMER}
          onClose={() => setIsSettingsOpen(false)}
          hideGameSettings={true}
        />
      </Show>
    </div>
  );
}
