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
import { AudioManager } from "../components/AudioManager";
import { ChatGuesser } from "../../api/guess/GuessComponent";
import { ReactionBar } from "../../api/reactions/ReactionBarComponent";
import "../../style/spectator-page.css";

interface SpectatorPageProps {
  artistList: PlayerState[];
}

export function SpectatorPage(props: SpectatorPageProps) {
  let [prompts, setPrompts] = createSignal<string[]>([]);
  let [hiddenPrompts, setHiddenPrompts] = createSignal<string[]>([]);
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
          <h1 class="round-header">Round {getState("roundsPlayed") || 0}</h1>
          <MuteButton
            onClick={() => {
              if (!AudioManager.isMuted())
                AudioManager.playLoop("/audio/DDsong.mp3");
            }}
          />
        </div>
        <div class="audience-canvases-row">
          <For each={visibleArtists()}>
            {(artist, index) => (
              <div class="audience-canvas-container">
                <SpectatorCanvas
                  artist={artist}
                  hiddenPrompt={hiddenPrompts()[index()]}
                />
              </div>
            )}
          </For>
        </div>
      </Show>
      <div class="audience-chat-container">
        <ChatGuesser
          promptList={prompts()}
          artists={props.artistList}
          notArtist={true}
        />
        <ReactionBar />
      </div>
      <PlayerList useRowLayout={true} />
    </div>
  );
}
