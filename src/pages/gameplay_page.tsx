import { Page } from "../../api/page";
import { render, For } from "solid-js/web";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { ChatGuesser, GuessElement } from "../../api/guess/GuessComponent";

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

import { ReactionBar } from "../../api/reactions/ReactionBarComponent";

import "../../style/game.css";
import { AudioManager } from "../components/AudioManager";
import { routerNavigate } from "../../api/tiny_router";
import { PlayerList } from "../components/PlayerList";
import { MuteButton } from "../components/MuteButton";

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

function pickRandomArtists() {
  let participants = Object.values(getParticipants());
  let currentArtistPool = participants.filter((player) => {
    player.setState("isArtist", false, true);
    return !player.getState("hasChosen");
  });

  if (currentArtistPool.length == 0) {
    let roundsPlayed = getState("roundsPlayed") + 1;
    let maxRounds = getState("number-rounds");

    console.log("end state:", roundsPlayed, maxRounds);
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
      player.getState("isArtist")
    );
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

    const interval = setInterval(() => {
      setIsArtist(me().getState("isArtist") ?? false);

      if (artistsHavePrompts()) {
        startGameplay("promptStatePolling:advanceToGameplay");
      }
    }, 250);

    onCleanup(() => {
      clearInterval(interval);
      artistPickedPromptClean();
      startGameplayClean();
      pickedPromptClean();
      randomArtistsClean();
    });
  });

  return (
    <>
      <Show when={isArtist()} fallback={
        <div class="waiting-screen">
          <img src="/sheep_thinking.gif" alt="thinking sheep" class="waiting-sheep" />
          <div class="waiting-content">
            <p class="waiting-label">Waiting for artist to pick prompt...</p>
          </div>
        </div>
      }>
        <RandomWordSelection
          onSelected={(word) => {
            RPC.call(
              "artistPickedPrompt",
              { prompt: word },
              RPC.Mode.HOST,
            );
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

  onMount(() => {
    const update = () => setIsNarrow(window.innerWidth < NARROW_BREAKPOINT);
    update();
    window.addEventListener("resize", update);
    onCleanup(() => window.removeEventListener("resize", update));
  });

  return (
    <div class="artist-container">
      <div class="artist-topbar">
        <h1 class="round-header artist-round-header">
          Round {getState("roundsPlayed") || 0}
        </h1>
        <MuteButton
          onClick={() => {
            if (!AudioManager.isMuted())
              AudioManager.playLoop("/audio/DDsong.mp3");
          }}
        />
      </div>

      <div class="artist-main-area">
        <div class="artist-canvas-area">
          <div class="artist-canvas-stack">
            <ArtistCanvasComponent prompt={me().getState("prompt")} />
            <Show when={!isNarrow()}>
              <div class="artist-players-area artist-players-area-wide">
                <PlayerList useRowLayout={true} />
              </div>
            </Show>
          </div>
        </div>

        <div class="artist-side-panel">
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
          <Show when={isNarrow()}>
            <div class="artist-players-area">
              <PlayerList useRowLayout={true} />
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}

import { SpectatorPage } from "./spectator_page";

function Gameplay() {
  let [artists, setArtists] = createSignal<PlayerState[]>([]);
  let [isArtist, setIsArtist] = createSignal(false);
  let [numPlayersGuessed, setNumPlayersGuessed] = createSignal(0);

  onMount(() => {
    const interval = setInterval(() => {
      let participants = Object.values(getParticipants());
      participants = participants.filter((player) =>
        player.getState("isArtist")
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

    const playerGuessedClean = RPC.register("playerGuessed", async () => {
      let guesserCount = Object.values(getParticipants()).length - 2;
      setNumPlayersGuessed((previousNum) => {
        let newNum = previousNum + 1;
        if (newNum >= guesserCount) {
          console.info("[DD][Round] playerGuessed:allGuessed");
          RPC.call("nextRound", {}, RPC.Mode.ALL);
        }
        return newNum;
      });
    });

    onCleanup(() => {
      clearInterval(interval);
      nextRoundClean();
      playerGuessedClean();
    });
  });

  return (
    <>
      <Show when={isArtist()}>
        <ArtistPage otherArtist={artists()[0]} />
      </Show>

      <Show when={!isArtist()}>
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
      const nextChoices = me().getState("promptChoices") || [];
      const current = choices();
      if (
        current.length !== nextChoices.length ||
        current.some((word, i) => word !== nextChoices[i])
      ) {
        setChoices([...nextChoices]);
      }
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
    <Show when={!selected()}
      fallback={
        <div class="waiting-screen">
          <img src="/sheep_thinking.gif" alt="thinking sheep" class="waiting-sheep" />
          <div class="waiting-content">
            <p class="waiting-label">Waiting for other artist...</p>
          </div>
        </div>
      }
    >
      <div class="selection-overlay">
        <div class="selection-card">
          <h2>CHOOSE YOUR PROMPT</h2>
          <div class="choices-container">
            <For each={choices()}>
              {(word) => (
                <button
                  class="word-choice-btn"
                  onClick={() => handleSelect(word)}
                >
                  {word.toUpperCase()}
                </button>
              )}
            </For>
          </div>
        </div>
      </div>

      <style>{`
        .selection-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0,0,0,0.85);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        .selection-card {
          background: white;
          padding: 2rem;
          border-radius: 15px;
          text-align: center;
          border: 4px solid #333;
        }
        .choices-container {
          display: flex;
          gap: 20px;
          margin-top: 20px;
          justify-content: center;
        }
        .word-choice-btn {
          padding: 15px 30px;
          font-size: 1.5rem;
          cursor: pointer;
          background: #ffcf00;
          border: 3px solid black;
          font-weight: bold;
          transition: transform 0.1s;
        }
        .word-choice-btn:hover {
          transform: scale(1.05);
          background: #ffe054;
        }
      `}</style>
    </Show>
  );
}
