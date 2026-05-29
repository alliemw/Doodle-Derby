import {
  getParticipants,
  isHost,
  myPlayer,
  RPC,
  setState,
  getState,
  PlayerState,
} from "playroomkit";

import { Page } from "../../api/page";
import { routerNavigate } from "../../api/tiny_router";
import { render } from "solid-js/web";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";

import "../../style/pick-words.css";
import { IconButton } from "../components/IconButton";
import { installDisconnectHandler } from "../../api/disconnect";

// Even though you can get the words completed
// through the player state, we must store a changing
// value in order to trigger a rerender of the component,
// because we end up storing the same player references
// every interval
interface PlayerStateWordInfo {
  player: PlayerState;
  wordsCompleted: number;
}

function PlayerCards(props: { maxWords: number }) {
  const [playersList, setPlayersList] = createSignal<PlayerStateWordInfo[]>([]);
  onMount(() => {
    const interval = setInterval(() => {
      const players = Object.values(getParticipants());
      setPlayersList((previousPair) => {
        let newPair = players.map((player) => {
          let playerTuple: PlayerStateWordInfo = {
            player,
            wordsCompleted: player.getState("words_complete") ?? 0,
          };
          return playerTuple;
        });

        if (newPair.length != previousPair.length) {
          return newPair;
        }

        // If new pair matches old pair, then return old pair.
        // We don't want to trigger any rerenders.
        const same = previousPair.every(
          (player, i) => player.wordsCompleted === newPair[i].wordsCompleted,
          newPair,
        );

        return same ? previousPair : newPair;
      });
    }, 250);
    onCleanup(() => clearInterval(interval));
  });

  return (
    <div class="players-progress-list" id="players-progress-list">
      <For each={playersList()} fallback={<h1>Loading players...</h1>}>
        {({ player, wordsCompleted }) => {
          const name = player.getState("name") || "Guest";
          const characterImg = player.getState("character");
          const accessories: string[] = [
            player.getState("acc_0"),
            player.getState("acc_1"),
            player.getState("acc_2"),
          ].filter((a) => a);

          const words_complete = wordsCompleted;
          const progressPercent = (words_complete / props.maxWords) * 100;

          const card = document.createElement("div");
          card.className = "player-progress-card";

          return (
            <div class="player-progress-card">
              <span class="player-name-label">
                {" "}
                {name} {player.id === myPlayer().id ? "(You)" : ""}{" "}
              </span>
              <div class="player-icon-wrapper">
                <div class="mini-stick-man">
                  {characterImg ? (
                    <img src={`${characterImg}`} class="base-char" />
                  ) : (
                    "ツ"
                  )}
                  <For each={accessories}>
                    {(acc) => {
                      acc = acc.replace("/accessories/", "/accessories-equip/");
                      return <img src={acc} class="acc-layer" />;
                    }}
                  </For>
                </div>
              </div>
              <div class="progress-container-vertical">
                <div class="progress-bar-bg">
                  <div
                    class="progress-bar-fill"
                    style={`width: ${progressPercent}%`}
                  ></div>
                </div>
                <span class="progress-text">
                  {words_complete}/{props.maxWords}
                </span>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}

// Consolidated sync function to avoid repeated setState calls
// (NOTE) After rewrite, not sure if this still has intended effect
//        to avoid repeated setState calls
function syncState(words: string[]) {
  myPlayer().setState("words", [...words], true);
  myPlayer().setState("words_complete", words.length, true);
}

function SubmitWord(props: {
  words: string[];
  pushWord: (word: string) => void;
  maxWords: number;
}) {
  const [wordInput, setWordInput] = createSignal("");
  const [invalidInput, setInvalidInput] = createSignal(false);

  const MAX_WORD_LENGTH = 16;

  const submitWord = () => {
    const new_word = wordInput().trim();
    if (props.words.length < props.maxWords && new_word.length > 0) {
      props.pushWord(new_word);
      setWordInput("");
    } else {
      setInvalidInput((invalid) => (invalid = true));
      setTimeout(() => setInvalidInput((invalid) => (invalid = false)), 300);
    }
  };

  const onUpdateWord = (newWord: string) => {
    setWordInput(newWord);
  };

  return (
    <div class="input-group">
      <div>
        <input
          type="text"
          class={invalidInput() ? "error-shake" : ""}
          maxlength={MAX_WORD_LENGTH}
          id="word-input"
          placeholder="Type a word..."
          value={wordInput()}
          onkeydown={(ev) => ev.key === "Enter" && submitWord()}
          onInput={(element) => onUpdateWord(element.currentTarget.value)}
        />
        <IconButton
          onClick={() => {
            submitWord();
          }}
          defaultImg="/buttons/submit_icon.png"
          hoverImg="/buttons/submit_hovered_icon.png"
          altText="Submit"
          text="SUBMIT"
          width="120px"
        ></IconButton>
      </div>
    </div>
  );
}

function WordsList(props: {
  words: string[];
  deleteWord: (word: number) => void;
}) {
  return (
    <div class="word-list-container" id="word-list">
      <For each={props.words}>
        {(word, index) => (
          <div class="word-item">
            <span>{word}</span>
            <button
              class="delete-btn"
              onClick={(_) => props.deleteWord(index())}
            >
              &times;
            </button>
          </div>
        )}
      </For>
    </div>
  );
}

function WaitingPage(props: { readyToStart: boolean; maxWords: number }) {
  let [host, _] = createSignal(isHost());

  const onStart = () => {
    if (host() && !(getState("drawing-transition") ?? false)) {
      RPC.call("players-start-game", {}, RPC.Mode.OTHERS);
      routerNavigate("/game");
      setState("drawing-transition", true);
    }
  };

  return (
    <>
      <div id="waiting-screen" class="waiting-screen" style="flex">
        <h1 class="waiting-label" id="waiting-status-text">
          {
            // For more complex conditions, we should
            // avoid ternary bs
            !props.readyToStart || !host()
              ? !props.readyToStart
                ? "Waiting for other players..."
                : "Waiting for the Host to start..."
              : "Start Doodling!"
          }
        </h1>
        <PlayerCards maxWords={props.maxWords} />
      </div>
      <Show when={props.readyToStart && host()}>
        <div class="continue-btn">
          <IconButton
            onClick={() => {
              onStart();
            }}
            defaultImg="/buttons/start_icon.png"
            hoverImg="/buttons/start_hovered_icon.png"
            altText="Start Game"
            text="START DOODLING!"
            width="150px"
            textColor="#313136"
          ></IconButton>
        </div>
      </Show>
    </>
  );
}

function PickWordsMain() {
  const [wordsList, setWordsList] = createSignal(new Array<string>());
  const [isWaiting, setIsWaiting] = createSignal(false);
  const [allPlayersReady, setAllPlayersReady] = createSignal(false);
  const [maxWords, setMaxWords] = createSignal(4);

  onMount(() => {
    const startClean = RPC.register("players-start-game", async () => {
      routerNavigate("/game");
    });

    const readyClean = RPC.register(
      "all-players-ready",
      async (_payload, _player) => {
        setAllPlayersReady(true);
      },
    );

    const terminateClean = RPC.register("terminateGame", async () => {
      try {
        alert("A player disconnected. The game has ended.");
      } catch {}
      myPlayer().leaveRoom();
      routerNavigate("/");
    });

    const checkAllPicked = () => {
      const players = Object.values(getParticipants());
      const allFinished =
        players.length > 0 &&
        players.every((p) => p.getState("picked_words") === true);
      if (allFinished) {
        RPC.call("all-players-ready", {}, RPC.Mode.ALL);
      }
    };

    const pickClean = RPC.register(
      "player-picked-words",
      async (_payload, _player) => {
        checkAllPicked();
      },
    );

    setMaxWords(
      (prevMaxWord) => prevMaxWord * (getState("number-rounds") ?? 1),
    );

    myPlayer().setState("words", [], true);
    myPlayer().setState("words_complete", 0, true);
    myPlayer().setState("picked_words", false, true);

    const disconnectClean = installDisconnectHandler({
      onTerminate: () => {
        RPC.call("terminateGame", {}, RPC.Mode.ALL);
      },
      // No artists exist yet in this phase, so onArtistLeft never fires.
      onContinue: () => {
        // A player dropped; re-check whether everyone left has picked their words.
        checkAllPicked();
      },
    });

    onCleanup(() => {
      startClean();
      readyClean();
      pickClean();
      terminateClean();
      disconnectClean();
    });
  });

  const deleteWord = (index: number) => {
    setWordsList((words) => {
      words.splice(index, 1);
      return [...words];
    });
    syncState(wordsList());
  };

  const pushWord = (word: string) => {
    setWordsList((words) => [...words, word]);
    syncState(wordsList());
  };

  const continueToWaiting = () => {
    setIsWaiting(true);
    myPlayer().setState("picked_words", true, true);
    RPC.call("player-picked-words", {}, RPC.Mode.HOST);
  };

  return (
    <Show
      when={!isWaiting()}
      fallback={
        <WaitingPage readyToStart={allPlayersReady()} maxWords={maxWords()} />
      }
    >
      <div class="pick-words-container">
        <WordsList words={wordsList()} deleteWord={deleteWord} />
        <h1 class="input-label">
          <strong>
            ({wordsList().length}/{maxWords()})
          </strong>
          <strong>WRITE ANYTHING!</strong>
        </h1>
        <SubmitWord
          words={wordsList()}
          pushWord={pushWord}
          maxWords={maxWords()}
        />
      </div>
      <Show when={wordsList().length >= maxWords()}>
        <div class="continue-btn">
          <IconButton
            onClick={() => {
              continueToWaiting();
            }}
            defaultImg="/buttons/continue_icon.png"
            hoverImg="/buttons/continue_hovered_icon.png"
            altText="Continue"
            text="CONTINUE"
            width="150px"
            textColor="#313136"
          ></IconButton>
        </div>
      </Show>
    </Show>
  );
}

export const PickWordsPage: Page = {
  async render(root: HTMLElement) {
    this.onEnd = render(() => <PickWordsMain />, root);
  },
};
