import {
  createSignal,
  onMount,
  onCleanup,
  Show,
  createEffect,
  For,
  Index,
} from "solid-js";
import { RPC, getState, setState, myPlayer, PlayerState } from "playroomkit";
import { IconButton } from "../../src/components/IconButton";

export const ChatGuesser = (props: {
  promptList: string[];
  artists: PlayerState[];
  notArtist: boolean;
}) => {
  let chatAreaRef: HTMLDivElement | undefined;
  let [text, setText] = createSignal("");
  let [isDisabled, setIsDisabled] = createSignal(false);
  let [guessedWords, setGuessedWords] = createSignal<string[]>([]);
  let [globalMessages, setGlobalMessages] = createSignal<{text: string, isCorrect: boolean}[]>([]);
  let [correctGuesses, setCorrectGuesses] = createSignal(0);

  const MAX_MESSAGES = 50;

  onMount(() => {
    // Set initial chat messages
    setGlobalMessages(getState("chats") ?? []);

    const newChatClean = RPC.register("newChat", async (newMessage) => {
      setGlobalMessages((prevMessages) => {
        // Create the new message object
        const nextMessage = {
          text: newMessage.message,
          isCorrect: !!newMessage.isCorrect, // Ensure it's a boolean
        };

        let updatedMessages = [...prevMessages, nextMessage];
        if (updatedMessages.length > MAX_MESSAGES) {
          updatedMessages = updatedMessages.slice(
            updatedMessages.length - MAX_MESSAGES,
          );
        }
        return updatedMessages;
      });
    });

    onCleanup(() => {
      newChatClean();
    });
  });

  createEffect(() => {
    // Access the dependency to track it
    const messages = globalMessages();

    if (chatAreaRef) {
      // A zero-delay timeout pushes the scroll to the end of the event loop
      // ensuring the new <p> tags are already rendered.
      setTimeout(() => {
        chatAreaRef.scrollTop = chatAreaRef.scrollHeight;
      }, 0);
    }
  });

  const incrementGuess = () => {
    setCorrectGuesses((previousGuess) => previousGuess + 1);
  };

  const guessChecker = () => {
    const guessWord = text().trim().toLowerCase();
    if (!guessWord) return;

    if (props.promptList.includes(guessWord) && !guessedWords().includes(guessWord)) {
      setGuessedWords(words => [...words, guessWord]);
      incrementGuess();

      let artist = props.artists.find((player) => {
        return player.getState("prompt") === guessWord;
      });

      if (!artist) {
        console.error("Couldn't find artist to assign words to!");
        return;
      }

      // Update artist right guesses to decide how many points guesser recieves
      const rGuess: number = artist.getState("rightGuesses");
      let guess = rGuess;
      artist.setState("rightGuesses", rGuess + 1);

      const addArtistScore = (score_increment: number) => {
        const currentScore = artist.getState("score");
        console.log(
          artist.getState("name"),
          "gets",
          score_increment,
          "points!",
        );
        artist.setState("score", currentScore + score_increment);
      };

      //add score for first guess
      let addition = 0;
      if (guess == 0) {
        addArtistScore(2);
        addition = 5;
      } else if (guess == 1) {
        addition = 3;
        addArtistScore(1);
      } else {
        addition = 1;
        addArtistScore(1);
      }

      const currentScore = myPlayer().getState("score");
      myPlayer().setState("score", currentScore + addition);
      console.log("Right guesses after: " + artist.getState("rightGuesses"));
      console.log("Player score: " + myPlayer().getState("score"));
      console.log("Artist score: " + artist.getState("score"));

      if (correctGuesses() == 2) {
        submitMessage("guessed both words!", true);
        setIsDisabled(true);
        RPC.call("playerGuessed", {}, RPC.Mode.HOST);
        return;
      }
      submitMessage("guessed a word!", true);
    } else {
      submitMessage(guessWord, false);
    }

    if (correctGuesses() >= 2) {
      setIsDisabled(true);
    }
  };

  function displayChat() {
    return (
      <div class="chat-messages-area" ref={chatAreaRef}>
        <For each={globalMessages()}>
          {(message) => <p class={`chat-message-container ${message.isCorrect ? 'correct-guess' : 'normal-guess'}`}>
            {message.text}
          </p>}
        </For>
      </div>
    );
  }

  function submitMessage(currentMessage: string, isCorrect : boolean = false) {
    setText("");
    if (currentMessage.trim().length == 0) return;
    const finalMessage = `${myPlayer().getState("name")}: ${currentMessage}`;
    RPC.call("newChat", { message: finalMessage, isCorrect }, RPC.Mode.ALL);
  }

  return (
    <>
      <div class="guess-container">
        <div class="chat-container">{displayChat()}</div>
        <Show when={props.notArtist}>
          <div class="chat-input-row">
            <input
              class="chat-input-textbox"
              disabled={isDisabled()}
              value={text()}
              type="text"
              onInput={(e) => setText(e.currentTarget.value)}
              placeholder="Type in chat here..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault(); // Prevents line breaks or form reloads
                  guessChecker();
                }
              }}
            />
            <IconButton
              defaultImg="/buttons/submit_icon.png"
              hoverImg="/buttons/submit_hovered_icon.png"
              onClick={() => guessChecker()}
              altText="Submit"
              text="SUBMIT"
              width="90px"
              height="40px"
            ></IconButton>
          </div>
        </Show>
      </div>
    </>
  );
};

export function GuessElement(props: { prompt: string }) {
  let [text, setText] = createSignal("");
  let containerRef: HTMLDivElement | undefined;

  const handleClick = () => {
    const inputs = containerRef?.querySelectorAll(
      "input",
    ) as NodeListOf<HTMLInputElement>;
    let hasInput = Array.from(inputs).find((input) => input.value);
    if (inputs) {
      if (!hasInput) inputs[0].focus();
    }
  };

  const handleInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
    const input = e.currentTarget;
    if (input.value.length >= 1) {
      const next =
        input.parentElement?.nextElementSibling?.querySelector("input");
      if (next) (next as HTMLInputElement).focus();
    }
  };

  const readingInput = () => {
    const inputs = containerRef?.querySelectorAll(
      "input",
    ) as NodeListOf<HTMLInputElement>;

    let currentInput = "";
    inputs.forEach((input) => {
      currentInput += input.value;
    });
    setText(currentInput);
    console.log(currentInput);
  };
  return (
    <>
      <div class="guessContainer" ref={containerRef} onClick={handleClick}>
        <Index each={props.prompt.split("")}>
          {(char, i) => (
            <div class="input-unit">
              {char() === " " ? (
                <div class="space" style={{ width: "20px" }}></div>
              ) : (
                <>
                  <input
                    class="letter-input"
                    type="text"
                    maxlength="1"
                    onInput={(e) => handleInput(e)}
                    onChange={readingInput}
                    autocomplete="off"
                  />
                  <div class="bold-dash"></div>
                </>
              )}
            </div>
          )}
        </Index>
      </div>
      <style>
        {`.guessContainer {
                position: relative;
                display: flex;
                gap: 15px;
                justify-content: center;
                margin-top: 2rem;
            }

            .input-unit {
                position: relative;
                top:100%;
                display: flex;
                flex-direction: column;
                align-items: center;
            }

            .letter-input {
                width: 40px;
                background: transparent;
                border: none;
                text-align: center;
                font-size: 2.5rem;
                font-weight: 500;
                color: #2c3e50;
                text-transform: uppercase;
                outline: none;
            }

            .bold-dash {
                width: 100%;
                height: 6px;
                background-color: #2c3e50;
                border-radius: 10px;
            }`}
      </style>
    </>
  );
}
