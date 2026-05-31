import { RPC } from "playroomkit";
import { For, onCleanup, onMount } from "solid-js";
import { AudioManager } from "../../src/components/AudioManager";

const ReactionType = Object.freeze({
  // key,    img,     audio
  "angry": ["/reactions/tomato.png", "/audio/tomatosplashtomderb.mp3"],
  "cool": ["/reactions/cool.png", "/audio/coolmeowreact.mp3"],
  "ellipsis": ["/reactions/ellipsis.png", "/audio/dotdotdotreact.mp3"],
  "question": ["/reactions/question.png", "/audio/questionmarkreact.mp3"],
  "sad": ["/reactions/sad.png", "/audio/sadbunreact.mp3"],
  "laugh": ["/reactions/laugh.png", "/audio/bark.mp3"],
});

type ReactionKey = keyof typeof ReactionType;

export function ReactionBar() {
  const playReaction = (reactionKey: ReactionKey) => {
    const entry = ReactionType[reactionKey];
    if (!entry) return;
    const [img, audio] = entry;

    AudioManager.playSound(audio);

    const button_list = document.getElementsByClassName('reac-button');
    for (let i = 0; i < button_list.length; i++) {
      (button_list[i] as HTMLButtonElement).disabled = true;
    }

    const reaction = document.createElement("img");
    reaction.src = img;
    reaction.classList.add("reac-element");
    Object.assign(reaction.style, {
      width: `50px`,
      animation: `moveUp 2s ease-out`,
      zIndex: `10`,
    });

    document.body.appendChild(reaction);
    setTimeout(() => {
      reaction.remove();
      for (let i = 0; i < button_list.length; i++) {
        (button_list[i] as HTMLButtonElement).disabled = false;
      }
    }, 2000);
  };

  onMount(() => {
    const reactionClean = RPC.register("play-reaction", async (data: { reactionKey: ReactionKey }) => {
      playReaction(data.reactionKey);
    });
    onCleanup(() => {
      reactionClean();
    });
  });

  return (
    <>
      {/* Reactions */}
      <div class="reac-container">
        <For each={Object.keys(ReactionType) as ReactionKey[]}>
          {(key) => (
            <button class="reac-button" onClick={() => {
              RPC.call("play-reaction", { reactionKey: key }, RPC.Mode.ALL);
            }}>
              <img src={ReactionType[key][0]} class="reac-img" alt={key} />
            </button>
          )}
        </For>
      </div>
      {/********************************************************************************/}
    </>
  );
}
