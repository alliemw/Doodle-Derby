import { Page } from "../../api/page";
import { render, For } from "solid-js/web";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { ChatGuesser } from "../../api/guess/GuessComponent";

import {
  getParticipants,
  PlayerState,
  me,
  RPC,
  setState,
  isHost,
  getState,
} from "playroomkit";

import {
  ArtistCanvasComponent,
  SpectatorCanvas,
} from "../../api/draw/ArtistCanvasComponent";

import { SpectatorPage } from "./spectator_page";

import { ReactionBar } from "../../api/reactions/ReactionBarComponent";

import "../../style/game.css";
import "../../style/prompt-selection.css";
import { AudioManager } from "../components/AudioManager";
import { routerNavigate } from "../../api/tiny_router";
import { PlayerList } from "../components/PlayerList";
import { MuteButton } from "../components/MuteButton";
import { IconButton } from "../components/IconButton";
import { PromptButton } from "../components/PromptButton";
import { getTimerInterval, PromptSelectionTimer, TimerDisplay } from "../components/TimerDisplay"
import DerbyTransition from "../components/DerbyTransition"
import { DEFAULT_PROMPT_TIMER, DEFAULT_TIMER, SettingsModal } from "../components/SettingsModal";


// Functions here are throwaways and only serve as substitutes
const randInt = (length: number) => {
  return Math.floor(Math.random() * length);
};

const logRoundState = (context: string) => {
  const participants = Object.values(getParticipants());
  const snapshot = participants.map((player) => ({
    id: player.id,
    name: player.getState("name"),
    isArtist: player.getState("isArtist"),
    prompt: player.getState("prompt"),
    promptChoices: player.getState("promptChoices"),
    hasChosen: player.getState("hasChosen"),
    score: player.getState("score"),
    rightGuesses: player.getState("rightGuesses"),
    pickedWords: player.getState("picked_words"),
    wordsComplete: player.getState("words_complete"),
  }));
  console.info("[DD][Round]", context, {
    roundsPlayed: getState("roundsPlayed"),
    maxRounds: getState("number-rounds"),
    participantCount: participants.length,
    players: snapshot,
  });
};

function pickPrompts() {
  let participants = Object.values(getParticipants());

  let artists: PlayerState[] = [];
  let artistChoices: Map<string, string[]> = new Map();

  participants.forEach((player) => {
    if (player.getState("isArtist")) {
      artists.push(player);

      let wordPool: string[] = player.getState("words");
      wordPool.sort(() => Math.random() - 0.5);
      const choices = wordPool.splice(0, 2);
      artistChoices.set(player.id, [...choices]);

      player.setState("words", wordPool, true);
    }
  });

  // These will exist!!! They will not be
  // undefined!!!

  let firstArtist = artists[0];
  let firstArtistPrompts = artistChoices.get(firstArtist.id) as string[];
  let secondArtist = artists[1];
  let secondArtistPrompts = artistChoices.get(secondArtist.id) as string[];

  // Give the artist their choices via state
  firstArtist.setState("promptChoices", secondArtistPrompts, true);
  firstArtist.setState("prompt", "", true);

  secondArtist.setState("promptChoices", firstArtistPrompts, true);
  secondArtist.setState("prompt", "", true);

  logRoundState("pickPrompts:promptChoicesAssigned");
}

function isGameOver() {
  let participants = Object.values(getParticipants());
  let currentArtistPool = participants.filter((player) => {
    return !player.getState("hasChosen");
  });

  if (currentArtistPool.length == 0) {
    let roundsPlayed = getState("roundsPlayed") + 1;
    let maxRounds = getState("number-rounds");

    return roundsPlayed >= maxRounds;
  }

  return false;
}

function pickRandomArtists() {
  let participants = Object.values(getParticipants());
  let currentArtistPool = participants.filter((player) => {
    player.setState("isArtist", false, true);
    return !player.getState("hasChosen");
  });

  if (currentArtistPool.length == 0) {
    let roundsPlayed = getState("roundsPlayed") + 1;
    let maxRounds = getState("number-rounds");

    // Check if greater just in case,
    // but ideally it should never be greater
    if (roundsPlayed >= maxRounds) {
      RPC.call("gameFinished", {}, RPC.Mode.ALL);
      return false;
    }

    setState("roundsPlayed", roundsPlayed, true);

    // Reset player pool

    participants.forEach((player) => {
      player.setState("hasChosen", false, true);
    });

    currentArtistPool = participants.filter((player) => {
      player.setState("isArtist", false, true);
      return !player.getState("hasChosen");
    });
  }

  let firstIndex = randInt(currentArtistPool.length);
  currentArtistPool[firstIndex].setState("isArtist", true, true);
  currentArtistPool[firstIndex].setState("hasChosen", true, true);

  let secondIndex = firstIndex;
  if (currentArtistPool.length == 1) {
    let secondIndex = randInt(participants.length);
    while (participants[secondIndex].id === currentArtistPool[firstIndex].id) {
      secondIndex = randInt(participants.length);
    }
    participants[secondIndex].setState("isArtist", true, true);
    participants[secondIndex].setState("hasChosen", true, true);
  } else {
    do {
      secondIndex = randInt(currentArtistPool.length);
    } while (secondIndex == firstIndex);
    currentArtistPool[secondIndex].setState("isArtist", true, true);
    currentArtistPool[secondIndex].setState("hasChosen", true, true);
  }

  logRoundState("pickRandomArtists:artistsAssigned");
  return true;
}

function SelectPrompts(props: { onPromptsPicked: () => void }) {
  let [isArtist, setIsArtist] = createSignal(false);
  let hasStarted = false;

  const startGameplay = (context: string) => {
    if (hasStarted) return;
    hasStarted = true;
    logRoundState(context);
    props.onPromptsPicked();
  };

  const artistsHavePrompts = () => {
    const artists = Object.values(getParticipants()).filter((player) =>
      player.getState("isArtist") === true
    );
    if (artists.length > 2) {
      console.error("More than 2 artists selected:", artists);
    }
    return (
      artists.length >= 2 &&
      artists.every((player) => {
        const prompt = player.getState("prompt");
        return !!prompt && String(prompt).length > 0;
      })
    );
  };

  onMount(() => {
    const artistPickedPromptClean = RPC.register(
      "artistPickedPrompt",
      async (payload: { prompt?: string }, player) => {
        if (!isHost()) return;

        const prompt = payload.prompt?.trim().toLowerCase();
        if (!prompt || !player.getState("isArtist")) return;

        player.setState("prompt", prompt, true);

        if (artistsHavePrompts()) {
          logRoundState("artistPickedPrompt:broadcastStartGameplay");
          RPC.call("startGameplay", {}, RPC.Mode.ALL);
        }
      },
    );

    const startGameplayClean = RPC.register("startGameplay", async () => {
      startGameplay("startGameplay:rpcReceived");
    });

    const pickedPromptClean = RPC.register("pickedPrompt", async () => {
      if (artistsHavePrompts()) {
        startGameplay("pickedPrompt:advanceToGameplay");
      }
    });

    const randomArtistsClean = RPC.register("randomArtistsPicked", async () => {
      setIsArtist(me().getState("isArtist"));
      logRoundState("randomArtistsPicked:rpcReceived");
    });

    if (isHost()) {
      const promptDuration =
        (getState("prompt-timer-seconds-settings") ?? DEFAULT_PROMPT_TIMER) *
        1000;
      setState("prompt-selection-end-time", Date.now() + promptDuration, true);
    }

    const promptTimerInterval = setInterval(() => {
      if (!isHost() || hasStarted) return;
      const endTime = getState("prompt-selection-end-time");
      if (typeof endTime !== "number") return;
      if (Date.now() < endTime) return;

      const artists = Object.values(getParticipants()).filter(
        (player) => player.getState("isArtist") === true,
      );

      artists.forEach((artist) => {
        const currentPrompt = artist.getState("prompt");
        if (currentPrompt && String(currentPrompt).length > 0) return;

        const choices: string[] = artist.getState("promptChoices") ?? [];
        if (choices.length === 0) return;

        artist.setState("prompt", String(choices[0]).toLowerCase(), true);
      });

      if (artistsHavePrompts()) {
        logRoundState("promptTimerExpired:broadcastStartGameplay");
        RPC.call("startGameplay", {}, RPC.Mode.ALL);
      }
    }, 250);

    onCleanup(() => {
      artistPickedPromptClean();
      startGameplayClean();
      pickedPromptClean();
      randomArtistsClean();
      clearInterval(promptTimerInterval);
    });
  });

  return (
    <>
      <Show
        when={isArtist()}
        fallback={
          <div class="waiting-screen">
            <img
              src="/sheep_thinking.gif"
              alt="thinking sheep"
              class="waiting-sheep"
            />
            <div class="waiting-content">
              <p class="waiting-label">Waiting for artist to pick prompt...</p>
              <PromptSelectionTimer />
            </div>
          </div>
        }
      >
        <RandomWordSelection
          onSelected={(word) => {
            RPC.call("artistPickedPrompt", { prompt: word }, RPC.Mode.HOST);
            RPC.call("pickedPrompt", {}, RPC.Mode.ALL);
          }}
        />
      </Show>
    </>
  );
}

function ArtistPage(props: { otherArtist: PlayerState }) {
  const NARROW_BREAKPOINT = 900;
  const [isNarrow, setIsNarrow] = createSignal(
    typeof window !== "undefined" && window.innerWidth < NARROW_BREAKPOINT,
  );
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false);

  onMount(() => {
    const update = () => setIsNarrow(window.innerWidth < NARROW_BREAKPOINT);
    update();
    window.addEventListener("resize", update);
    onCleanup(() => window.removeEventListener("resize", update));
  });

  return (
    <div class="artist-container">
      <Show when={isSettingsOpen()}>
        <SettingsModal
          timerSeconds={getState("timer-seconds") ?? DEFAULT_TIMER}
          onClose={() => setIsSettingsOpen(false)}
          hideGameSettings={true}
        />
      </Show>

      <div class="artist-main-area">
        <div class="artist-canvas-area">
          <div class="artist-canvas-stack">
            <ArtistCanvasComponent prompt={me().getState("prompt")} />
          </div>
        </div>

        <Show
          when={!isNarrow()}
          fallback={
            <div class="artist-other-area">
              <Show when={props.otherArtist}>
                <SpectatorCanvas artist={props.otherArtist} size="small" />
              </Show>
            </div>
          }
        >
          <div class="artist-side-panel">
            <div class="artist-topbar">
              <h1 class="round-header artist-round-header">
                Derby #{(getState("roundsPlayed") ?? 0) + 1}
              </h1>
              <TimerDisplay />
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "10px",
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
            </div>
            <div class="artist-side-middle">
              <div class="artist-other-area">
                <Show when={props.otherArtist}>
                  <SpectatorCanvas artist={props.otherArtist} size="small" />
                </Show>
              </div>
              <div class="artist-chat-area">
                <div class="artist-chat-area-chat">
                  <ChatGuesser promptList={[]} artists={[]} notArtist={false} />
                </div>
                <div class="artist-chat-area-emotes">
                  <ReactionBar />
                </div>
              </div>
            </div>
            <div class="artist-players-area">
              <PlayerList useRowLayout={true} />
            </div>
          </div>
        </Show>
      </div>

      <Show when={isNarrow()}>
        <div class="artist-topbar artist-topbar-bottom">
          <h1 class="round-header artist-round-header">
            Derby #{(getState("roundsPlayed") ?? 0) + 1}
          </h1>
          <TimerDisplay />
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "10px",
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
        </div>
        <div class="artist-chat-area artist-chat-area-bottom">
          <div class="artist-chat-area-chat">
            <ChatGuesser promptList={[]} artists={[]} notArtist={false} />
          </div>
          <div class="artist-chat-area-emotes">
            <ReactionBar />
          </div>
        </div>
        <div class="artist-players-area">
          <PlayerList useRowLayout={true} />
        </div>
      </Show>
    </div>
  );
}

function Gameplay() {
  let [artists, setArtists] = createSignal<PlayerState[]>([]);
  let [isArtist, setIsArtist] = createSignal(false);
  let [showTransition, setShowTransition] = createSignal(false);
  let numPlayersGuessed = 0;
  let roundEnded = false;

  const endRound = (reason: string) => {
    if (roundEnded) return;
    roundEnded = true;
    console.info(`[DD][Round] endRound:${reason}`);

    setState("round-end-time", 0, true);

    if (isGameOver()) {
      RPC.call("nextRound", {}, RPC.Mode.ALL);
      return;
    }

    RPC.call("transitionPage", {}, RPC.Mode.ALL);
  };

  onMount(() => {

    if (isHost()) {
      setState("timer-seconds", getState("timer-seconds-settings") ?? DEFAULT_TIMER, true);
    }

    const interval = setInterval(() => {
      let participants = Object.values(getParticipants());
      participants = participants.filter((player) =>
        player.getState("isArtist"),
      );

      const meIsArtist = me().getState("isArtist") ?? false;
      setIsArtist(meIsArtist);

      if (meIsArtist) {
        participants = participants.filter((player) => player.id !== me().id);
      }

      setArtists(participants);
    }, 250);


    const nextRoundClean = RPC.register("nextRound", async () => {
      console.info("[DD][Round] nextRound:rpcReceived");
      logRoundState("nextRound:beforeReset");
      setState("chats", [], true);
      routerNavigate("/game");
    });

    const transitionClean = RPC.register("transitionPage", async () => {
      console.info("[DD][Round] transitionPage:rpcReceived");
      logRoundState("nextRound:transitionPage");
      setShowTransition(true);
    });

    const playerGuessedClean = RPC.register("playerGuessed", async () => {
      const guesserCount = Object.values(getParticipants()).length - 2;
      numPlayersGuessed += 1;
      if (numPlayersGuessed >= guesserCount) {
        console.info("[DD][Round] playerGuessed:allGuessed");
        endRound("allGuessed");
      }
    });

    const timerInterval = getTimerInterval(roundEnded, endRound);

    onCleanup(() => {
      clearInterval(interval);
      clearInterval(timerInterval);
      nextRoundClean();
      transitionClean();
      playerGuessedClean();
    });
  });

  return (
    <>
      <Show when={showTransition()}>
        <DerbyTransition />
      </Show>

      <Show when={isArtist() && !showTransition()}>
        <ArtistPage otherArtist={artists()[0]} />
      </Show>

      <Show when={!isArtist() && !showTransition()}>
        <SpectatorPage artistList={artists()} />
      </Show>
    </>
  );
}

function GameplayPageMain() {
  let [gameStarted, setIsGameStarted] = createSignal(false);

  onMount(() => {
    const gameFinishedClean = RPC.register("gameFinished", async () => {
      logRoundState("gameFinished:rpcReceived");
      routerNavigate("/podium-page");
    });

    me().setState("rightGuesses", 0, true);

    if (isHost()) {
      let participants: PlayerState[] = Object.values(getParticipants());

      participants.forEach((player) => {
        // Only set the score to 0 on initial run.
        // Do not want to reset between rounds.
        if (player.getState("score") == null) {
          player.setState("score", 0);
        }
        // Snapshot the score at the start of every round so the
        // transition leaderboard can show this round's point delta.
        player.setState("roundStartScore", player.getState("score") ?? 0, true);
      });

      participants.forEach((player) => {
        // Only set hasChosen to false on initial run.
        // Do not want to reset between rounds.
        // This determines the player pool of people who
        // haven't drawn yet.
        if (player.getState("hasChosen") == null) {
          player.setState("hasChosen", false, true);
        }

        player.setState("isArtist", false, true);
        player.setState("finishedGuesses", false, true);
      });

      if (pickRandomArtists()) {
        pickPrompts();
      }

      RPC.call("randomArtistsPicked", {}, RPC.Mode.ALL);
      logRoundState("gameStart:hostInitialized");
    }

    onCleanup(() => {
      gameFinishedClean();
    });
  });

  return (
    <>
      <Show when={!gameStarted()} fallback={<Gameplay />}>
        <SelectPrompts onPromptsPicked={() => setIsGameStarted(true)} />
      </Show>
    </>
  );
}

export const GameplayPage: Page = {
  render(root: HTMLElement) {
    this.onEnd = render(() => <GameplayPageMain />, root);
  },
};

export function RandomWordSelection(props: {
  onSelected: (word: string) => void;
}) {
  const [choices, setChoices] = createSignal<string[]>(
    me().getState("promptChoices") || [],
  );
  const [selected, setSelected] = createSignal<string | null>(null);

  onMount(() => {
    const updateChoices = () => {
      setChoices(me().getState("promptChoices") || []);
    };

    updateChoices();

    const interval = setInterval(updateChoices, 250);
    onCleanup(() => clearInterval(interval));
  });

  const handleSelect = (word: string) => {
    setSelected(word);
    // Set the official prompt on the player state
    me().setState("prompt", word.toLowerCase(), true);
    props.onSelected(word);
  };

  return (
    <Show
      when={!selected()}
      fallback={
        <div class="waiting-screen">
          <img
            src="/sheep_thinking.gif"
            alt="thinking sheep"
            class="waiting-sheep"
          />
          <div class="waiting-content">
            <p class="waiting-label">Waiting for other artist...</p>
          </div>
        </div>
      }
    >
      <div class="selection-overlay">
        <div class="selection-card">
          <h2>CHOOSE YOUR PROMPT</h2>
          <PromptSelectionTimer />
          <div class="choices-container">
            <For each={choices()}>
              {(word) => (
                <PromptButton
                  defaultImg="/buttons/continue_icon.png"
                  hoverImg="/buttons/continue_hovered_icon.png"
                  borderSlice={45}
                  borderWidth={2}
                  text={word.toUpperCase()}
                  textColor="black"
                  onClick={() => handleSelect(word)}
                />
              )}
            </For>
          </div>
        </div>
      </div>

    </Show>
  );
}
