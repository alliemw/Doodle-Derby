import { getParticipants, isHost, myPlayer, PlayerState, RPC, setState } from "playroomkit";

import { Page } from "../../api/page";
import { routerNavigate } from "../../api/tiny_router";
import { render } from "solid-js/web";
import { createSignal, onMount, Show, For, Setter, Accessor, onCleanup } from "solid-js";

import "../../style/podium-page.css";

function PlayerCard({
  player,
  playerScale,
}: {
  player: PlayerState;
  playerScale: Accessor<number>;
}) {
  const name = player.getState("name") ?? "Guest";
  const characterImg = player.getState("character");
  const accessories: string[] = [
    player.getState("acc_0"),
    player.getState("acc_1"),
    player.getState("acc_2"),
  ].filter((a) => a);
  const score = player.getState("score") ?? 0;

  return (
    <div class="player-score-card" style={{ scale: playerScale() }}>
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
      <span class="player-score">
        {"score: "}
        {score}
      </span>
    </div>
  );
}

function Podium(props: {
  src: string;
  player: PlayerState;
  playerScale: Accessor<number>;
}) {
  console.log("Rerendered");
  return (
    <Show when={props.player != null && props.src != null}>
      <div class="podium">
        <PlayerCard player={props.player} playerScale={props.playerScale} />
        <img src={props.src}></img>
      </div>
    </Show>
  );
}

// Is this actually needed?

const images = import.meta.glob("/public/podium/*.png", {
  eager: true,
  import: "default", // get the final URL
});

const imageUrls = Object.values(images) as string[];

imageUrls.forEach(src => {
  const img = new Image();
  img.src = src;
  console.log("img url:", img.src);
});

//

function PodiumPageMain() {
  const [firstPlace, setFirstPlace] = createSignal<PlayerState | null>(null);
  const [secondPlace, setSecondPlace] = createSignal<PlayerState | null>(null);
  const [thirdPlace, setThirdPlace] = createSignal<PlayerState | null>(null);

  const [firstPlaceScale, setFirstPlaceScale] = createSignal<number>(0);
  const [secondPlaceScale, setSecondPlaceScale] = createSignal<number>(0);
  const [thirdPlaceScale, setThirdPlaceScale] = createSignal<number>(0);

  const [firstImage, setFirstImage] = createSignal<string | null>(null);
  const [secondImage, setSecondImage] = createSignal<string | null>(null);
  const [thirdImage, setThirdImage] = createSignal<string | null>(null);

  onMount(() => {
    const players = Object.values(getParticipants());

    const quitGameClean = RPC.register('quitGame', async () => {
      myPlayer().leaveRoom();
    });

    const joinLobbyClean = RPC.register('joinLobby', async () => {
      myPlayer().setState("score", 0);
      myPlayer().setState("isReady", false);
      myPlayer().setState("hasChosen", false);
      myPlayer().setState("promptChoices", []);
      myPlayer().setState("prompt", "");

      setState("drawing-transition", false);
      routerNavigate("/lobby");
    });

    onCleanup(() => {
      quitGameClean();
      joinLobbyClean();
    });

    // Sorts in descending order
    let topPlayers = players.sort((playerA, playerB) => {
      let playerAScore = playerA.getState('score') ?? 0;
      let playerBScore = playerB.getState('score') ?? 0;

      return playerBScore - playerAScore;
    }
    ).slice(0, 4)

    // We should probably check if this is 3 players
    // But hopefully no one leaves :))

    setFirstPlace(topPlayers[0]);
    setSecondPlace(topPlayers[1]);
    setThirdPlace(topPlayers[2]);

    const next_img = (
      prefix: string,
      idx: number,
      max: number,
      setter: Setter<string | null>,
      done: () => void,
    ) => {
      setter(`${prefix}${idx}.png`);
      console.log(`setting ${prefix}${idx}.png`);
      if (idx < max)
        setTimeout(() => next_img(prefix, idx + 1, max, setter, done), 300);
      else done();
    };

    next_img("/podium/Third_podium_", 1, 4, setThirdImage, () =>
      setThirdPlaceScale(1),
    );

    console.log(thirdImage(), thirdPlace()?.getState('name'));

    setTimeout(() => {
      next_img("/podium/Second_podium_", 1, 5, setSecondImage, () =>
        setSecondPlaceScale(1),
      );
    }, 1000);
    setTimeout(() => {
      next_img("/podium/First_podium_", 1, 6, setFirstImage, () =>
        setFirstPlaceScale(1),
      );
    }, 3000);
  });

  return (
    <>
      <Show when={isHost()}>
        <div class="cloudcontainer">
          {/** "Quit to home" button (left side) */}
          <button
            class="cloudbutton"
            style="float:left;"
            onClick={() => RPC.call("quitGame", {}, RPC.Mode.ALL)}>
            <img
              src="/podium/quit_cloud.png"
              class="cloudimg" />
          </button>
          {/** "Return to lobby" button (right side) */}
          <button
            class="cloudbutton"
            style="float:right;"
            value="Go to lobby"
            onClick={() => RPC.call("joinLobby", {}, RPC.Mode.ALL)}>
            <img
              src="/podium/return_cloud.png"
              class="cloudimg"
            ></img>
          </button>
        </div>
      </Show>
      <Show when={!isHost()}>
        <div class="cloudcontainer">
          {/** "Quit to home" button (left side) */}
          <button
            class="cloudbutton"
            style="float:left;"
            onClick={() => myPlayer().leaveRoom()}>
            <img
              src="/podium/quit_cloud.png"
              class="cloudimg" />
          </button>
        </div>
      </Show>
      <div class="podium-page">
        <div class="podium-container">
          <Podium
            src={secondImage() as string}
            player={secondPlace() as PlayerState}
            playerScale={secondPlaceScale}
          />
          <Podium
            src={firstImage() as string}
            player={firstPlace() as PlayerState}
            playerScale={firstPlaceScale}
          />
          <Podium
            src={thirdImage() as string}
            player={thirdPlace() as PlayerState}
            playerScale={thirdPlaceScale}
          />
        </div>
      </div>
    </>
  );
}

export const PodiumPage: Page = {
  async render(root: HTMLElement) {
    this.onEnd = render(() => <PodiumPageMain />, root);
  },
};
