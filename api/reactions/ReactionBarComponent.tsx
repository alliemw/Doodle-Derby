import { getState, setState, RPC } from "playroomkit";
import { onCleanup, onMount } from "solid-js";
import { AudioManager } from "../../src/components/AudioManager";

export function ReactionBar() {
  /********************************************************************************/
  /* BEGIN REACTIONS */

  const reactionURL = () => {
    return getState("reactionPressed");
  }

  const newReaction = () => {
    const button_list = document.getElementsByClassName('reac-button');
    for (let i = 0; i < button_list.length; i++) {
      const button = button_list[i] as HTMLButtonElement;
      button.disabled = true;
    }

    const reaction = document.createElement("img");
    reaction.src = reactionURL();
    reaction.classList.add("reac-element");
    Object.assign(reaction.style, {
      width: `50px`,
      animation: `moveUp 2s ease-out`,
      zIndex: `10`,
    });
    AudioManager.playSound("/audio/bark.mp3");

    document.body.appendChild(reaction);
    setTimeout(() => {
      reaction.remove();
      for (let i = 0; i < button_list.length; i++) {
        const button = button_list[i] as HTMLButtonElement;
        button.disabled = false;
      }
    }, 2000);
  }

  /* END REACTIONS */
  /********************************************************************************/

  onMount(() => {
    const reactionClean = RPC.register("new-reaction", async () => newReaction());
    const tomatoSoundClean = RPC.register("tomato-sound", async () => {
      AudioManager.playSound("/audio/tomatosplashtomderb.mp3");
    });
    onCleanup(() => {
      reactionClean();
      tomatoSoundClean();
    });
  });

  return (
    <>
      {/* Reactions */}
      <div class="reac-container">
        <button class="reac-button" onClick={() => {
          setState("reactionPressed", "/reactions/cool.png");
          RPC.call("new-reaction", {}, RPC.Mode.ALL);
        }}>
          <img src="/reactions/cool.png" class="reac-img" alt="Cool" />
        </button>
        <button class="reac-button" onClick={() => {
          setState("reactionPressed", "/reactions/ellipsis.png");
          RPC.call("new-reaction", {}, RPC.Mode.ALL);
        }}>
          <img src="/reactions/ellipsis.png" class="reac-img" alt="Ellipsis" />
        </button>
        <button class="reac-button" onClick={() => {
          setState("reactionPressed", "/reactions/laugh.png");
          RPC.call("new-reaction", {}, RPC.Mode.ALL);
        }}>
          <img src="/reactions/laugh.png" class="reac-img" alt="Laugh" />
        </button>
        <button class="reac-button" onClick={() => {
          setState("reactionPressed", "/reactions/question.png");
          RPC.call("new-reaction", {}, RPC.Mode.ALL);
        }}>
          <img src="/reactions/question.png" class="reac-img" alt="Question" />
        </button>
        <button class="reac-button" onClick={() => {
          setState("reactionPressed", "/reactions/sad.png");
          RPC.call("new-reaction", {}, RPC.Mode.ALL);
        }}>
          <img src="/reactions/sad.png" class="reac-img" alt="Sad" />
        </button>
        <button class="reac-button" onClick={() => {
          setState("reactionPressed", "/reactions/tomato.png");
          RPC.call("new-reaction", {}, RPC.Mode.ALL);
          RPC.call("tomato-sound", {}, RPC.Mode.ALL);
        }}>
          <img src="/reactions/tomato.png" class="reac-img" alt="Tomato" />
        </button>
      </div>
      {/********************************************************************************/}
    </>
  )
}
