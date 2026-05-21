import {
  getParticipants,
  getRoomCode,
  isHost,
  myPlayer,
  setState,
  getState,
  RPC,
  PlayerState,
  onDisconnect,
} from "playroomkit";

import { Page } from "../../api/page";
import { routerNavigate } from "../../api/tiny_router";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { render } from "solid-js/web";

import { getRandomName } from "../../api/random_name";

import "../../style/lobby.css";
import { AudioManager } from "../components/AudioManager";
import { IconButton } from "../components/IconButton";
import { MuteButton } from "../components/MuteButton";
import { DEFAULT_TIMER, SettingsModal } from "../components/SettingsModal";

const MAX_NAME_LENGTH = 16;

const CHARACTER_PATHS = [
  "/characters/bear_icon.png",
  "/characters/bunny_icon.png",
  "/characters/chameleon_icon.png",
  "/characters/dog_icon.png",
  "/characters/fish_icon.png",
  "/characters/puppy_icon.png",
  "/characters/sheep_icon.png",
  "/characters/timmy_icon.png",
];

const ASSORTMENTS = [
  [
    "/accessories/top_hat.PNG",
    "/accessories/chef.PNG",
    "/accessories/clown.PNG",
    "/accessories/red_access.PNG",
  ],
  [
    "/accessories/shades.PNG",
    "/accessories/moustache.PNG",
    "/accessories/glasses.PNG",
    "/accessories/bow_tie.PNG",
    "/accessories/red_access.PNG",
  ],
  [
    "/accessories/boba.PNG",
    "/accessories/fishBowl.PNG",
    "/accessories/red_access.PNG",
  ],
];

export const [lobbyTicket, setLobbyTicket] = createSignal(0);
export const refreshLobby = () => setLobbyTicket((t) => t + 1);

export const LobbyPage: Page = {
  async render(root: HTMLElement) {
    onDisconnect((ev) => {
      if (ev.reason === "PLAYER_KICKED") {
        alert("You have been kicked by the host.");
      }
      routerNavigate("/");
    });

    this.onEnd = render(() => <Lobby />, root);
  },
};

function Lobby() {
  // Local state for UI visibility
  const [isLoading, setIsLoading] = createSignal(true);
  const [showCode, setShowCode] = createSignal(false);

  const [isCustomizeOpen, setIsCustomizeOpen] = createSignal(false);
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false);
  const [isKickOpen, setIsKick] = createSignal<PlayerState | null>(null);
  const [copied, setCopied] = createSignal(false);

  const roomCode = getRoomCode();

  const resetKickButton = () => {
    if (isKickOpen()) {
      setIsKick(null);
    }
  };

  const handleCopy = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      // Reset the "Copied!" state after 2 seconds
      setTimeout(() => setCopied(false), 1000);
    } catch (err) {
      console.error("Failed to copy lobby code: ", err);
    }
  };

  onMount(() => {
    const interval = setInterval(() => {
      // This will only trigger updates in parts of the JSX
      // that specifically call lobbyTicket()
      setLobbyTicket((t) => t + 1);
    }, 1000);

    const hostCheck = setInterval(() => {
      if (isHost() && !getState("hostId")) {
        setState("hostId", myPlayer().id, true); // true for reliable state
        clearInterval(hostCheck);
      }
    }, 100);

    // const settingsSync = setInterval(() => {
    //   setCurrentTimer(getState("timer-seconds") ?? DEFAULT_TIMER);
    // }, 100);

    // This is very important, don't remove
    setState("roundsPlayed", 0, true);

    // If number-rounds is undefined set it!
    if (!getState("number-rounds")) {
      setState("number-rounds", 1);
    }

    const me = myPlayer();
    const initSequence = async () => {
      // Wait for connection and room code
      while (!getRoomCode()) await new Promise((r) => setTimeout(r, 100));

      // Initialize character if missing before showing UI
      if (!me.getState("character")) {
        const randomChar =
          CHARACTER_PATHS[Math.floor(Math.random() * CHARACTER_PATHS.length)];
        me.setState("character", randomChar, true);
      }
      if (!me.getState("name")) {
        const randomName = await getRandomName(MAX_NAME_LENGTH);
        me.setState("name", randomName, true);
      }

      // Ensure host ID is established globally
      if (isHost() && !getState("hostId")) {
        setState("hostId", me.id, true);
      }

      // Small delay to allow state to propagate
      setTimeout(() => setIsLoading(false), 800);
    };

    initSequence();

    if (me.getState("character") === undefined && !me.getState("character")) {
      const randomChar =
        CHARACTER_PATHS[Math.floor(Math.random() * CHARACTER_PATHS.length)];
      me.setState("character", randomChar);
    }
    // Sync Playroom state changes to Solid's reactivity

    const refreshClean = RPC.register("refresh_lobby_ui", async () =>
      refreshLobby(),
    );

    const startClean = RPC.register("start-game", async () => {
      routerNavigate("/pick-words");
    });

    // Ensure host is set on mount
    if (isHost()) {
      setState("hostId", myPlayer().id);
    }

    onCleanup(() => {
      clearInterval(interval);
      clearInterval(hostCheck);
      refreshClean();
      startClean();
    });
  });

  const toggleReady = () => {
    const me = myPlayer();
    me.setState("isReady", !me.getState("isReady"));
    // Tell everyone (including yourself) to refresh the UI
    RPC.call("refresh_lobby_ui", {}, RPC.Mode.ALL);
  };

  const players = () => {
    lobbyTicket(); // Reactive dependency
    return Object.values(getParticipants());
  };

  const handleStart = () => {
    const pList = players();

    if (pList.every((p) => p.getState("isReady")) && pList.length >= 3) {
      setState("game-started", true, true);
      AudioManager.playSound("/audio/go forward.mp3");
      RPC.call("start-game", {}, RPC.Mode.ALL);
    } else {
      alert("Need 3+ players and everyone must be ready!");
    }
  };


  return (
    <Show
      when={!isLoading()}
      fallback={
        <div class="lobby-loading-overlay">
          <div class="loading-content">
            <img
              src="/landing-page/sheep_loading.png"
              class="spinning-sheep"
              alt="Loading..."
            />
            <p class="loading-text">Loading...</p>
          </div>
        </div>
      }
    >
      <div id="mainLobby-container" class="lobby-container">
        {/* Header */}
        <header class="lobby-header">
          <div>
            <IconButton
            id="exit-btn"
            defaultImg="/lobby/back_icon.png"
            hoverImg="/lobby/back_icon_highlighted.png"
            altText="Back"
            onClick={() => {
              myPlayer().leaveRoom();
              routerNavigate("/");
            }}
          />
          </div>
          
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "10px",
            }}
          >
            <h1 style={{ margin: 0, "text-align":"end" }}>
              Code: <span id="code-span">{getRoomCode() ?? "Error"}</span>
            </h1>
            <div class="copy-button-container">
              <button class="copy-btn" onClick={handleCopy}>
                <img
                  src="/lobby/copy_icon.png"
                  alt="Copy"
                  style={{ width: "48px", height: "48px" }}
                />
              </button>

              {/* Show ensures the signal doesn't affect the flexbox layout */}
              <Show when={copied()}>
                <span class="copy-status">Copied!</span>
              </Show>
            </div>
          </div>

          <div class="lobby-options-container">
            <MuteButton
              onClick={() => {
                if (!AudioManager.isMuted())
                  AudioManager.playLoop("/audio/DDsong.mp3");
              }}
            ></MuteButton>
            <IconButton
              id="icon-btn"
              defaultImg="/lobby/settings_icon.png"
              hoverImg="/lobby/settings_icon_highlighted.png"
              altText="Settings"
              onClick={() => {
                resetKickButton();
                setIsSettingsOpen(true);
              }}
            />
          </div>
        </header>

        {/* Main Content */}
        <main class="lobby-content">
          <aside class="sticky-note rules-note">
            <h3>RULES:</h3>
            <ul>
              <li>
                Number of Rounds:{" "}
                {(() => {
                  lobbyTicket(); // Listen for changes
                  return getState("number-rounds") ?? 1;
                })()}
              </li>
              {/* <li>
                Time Limit:{" "}
                {(() => {
                  lobbyTicket(); // Listen for changes
                  return getState("timer-seconds") ?? DEFAULT_TIMER;
                })()}
                s
              </li> */}
            </ul>
          </aside>

          <div class="player-grid">
            <For each={players()}>
              {(player) => {
                const [isKick, setIsKick] = createSignal(false);
                return (
                  <div class="player-slot" style={{ position: "relative" }}>
                    <PlayerCard
                      player={player}
                      onKick={() => {
                        if (player.id !== getState("hostId")) {
                          setIsKick(!isKick());
                        }
                      }}
                      onCustomize={() => {
                        resetKickButton();
                        setIsCustomizeOpen(true);
                      }}
                    />
                    <Show when={isHost() && player.id !== myPlayer().id}>
                      <button
                        class="kick-btn"
                        onClick={() => {
                          player.kick();
                        }}
                      >
                        ×
                      </button>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </main>

        {/* Footer */}
        <footer class="lobby-footer">

          <div class="ready-count">
            {players().filter((p) => p.getState("isReady")).length}/
            {players().length} READY
          </div>
          <div class="button-group">
            <button
              class="ready-btn"
              onClick={() => {
                toggleReady();
              }}
            >
              {(() => {
                lobbyTicket(); // Listen for changes
                return myPlayer().getState("isReady") ? "UNREADY" : "READY";
              })()}
            </button>

            <Show when={isHost()}>
              <button class="start-btn" onClick={handleStart}>
                START &gt;&gt;
              </button>
            </Show>
          </div>
        </footer>

        {/* Modals */}
        <Show when={isCustomizeOpen()}>
          <CustomizeModal onClose={() => setIsCustomizeOpen(false)} />
        </Show>
        <Show when={isSettingsOpen()}>
          <SettingsModal
            timerSeconds={getState("timer-seconds") ?? DEFAULT_TIMER}
            onClose={() => setIsSettingsOpen(false)}
          />
        </Show>
      </div>
    </Show>
  );
}

interface PlayerCardProps {
  player: PlayerState; // Ideally use PlayerState from playroomkit if available
  onKick: () => void;
  onCustomize: () => void;
}

interface CustomizeModalProps {
  onClose: () => void;
}

function PlayerCard(props: PlayerCardProps) {
  const isMe = () => props.player.id === myPlayer().id;
  const char = () => {
    lobbyTicket();
    return props.player.getState("character") || CHARACTER_PATHS[0];
  };
  const isReady = () => {
    lobbyTicket();
    return props.player.getState("isReady");
  };
  const isHostPlayer = () => {
    lobbyTicket();
    return props.player.id === getState("hostId");
  };

  const clickPlayerButton = () => {
    if (isMe()) {
      props.onCustomize();
      return;
    }
    if (isHost()) {
      props.onKick();
    }
  };

  return (
    <div class="player-slot">
      <Show when={isHostPlayer()}>
        <img src="/lobby/crown.png" class="crown-img" alt="Host Crown" />
      </Show>

      <button class="player-button" onClick={() => clickPlayerButton()}>
        <div class="stick-man">
          <img src={char()} style="width:100%; height:100%;" />
          <For each={[0, 1, 2]}>
            {(idx) => {
              // Re-evaluate accessory path on every tick
              const accPath = () => {
                lobbyTicket();
                return props.player.getState(`acc_${idx}`);
              };
              return (
                <Show when={accPath()}>
                  <div
                    class="acc-layer"
                    style={{ "background-image": `url(${accPath()})` }}
                  />
                </Show>
              );
            }}
          </For>
        </div>
      </button>

      <Show when={isReady()}>
        <div class="ready-tag">READY!</div>
      </Show>
      <p>
        {(() => {
          lobbyTicket(); // Subscribe to the tick
          return props.player.getState("name") || "Player";
        })()}
        {isMe() ? " (You)" : ""}
      </p>
    </div>
  );
}

function CustomizeModal(props: CustomizeModalProps) {
  const [name, setName] = createSignal(myPlayer().getState("name") || "");
  const [showPicker, setShowPicker] = createSignal(false);
  const [activeSlot, setActiveSlot] = createSignal<number | null>(null);

  const updateName = (val: string) => {
    setName(val);
    myPlayer().setState("name", val);
    RPC.call("refresh_lobby_ui", {}, RPC.Mode.ALL);
  };

  const myChar = () => {
    lobbyTicket(); // Subscribe to updates
    return myPlayer().getState("character") || CHARACTER_PATHS[0];
  };

  const handleOpenPicker = (_e: MouseEvent, index: number) => {
    setActiveSlot(index);
    setShowPicker(true);
  };

  const selectItem = (path: string) => {
    const slot = activeSlot(); // -1 for character, 0-2 for accessories

    if (slot === -1) {
      myPlayer().setState("character", path);
    } else {
      // Convert preview path to high-res equip path
      const equipPath = path.replace("/accessories/", "/accessories-equip/");
      // "red_access.PNG" is usually your "remove" icon
      const finalPath = path.includes("red_access.PNG") ? "" : equipPath;
      myPlayer().setState(`acc_${slot}`, finalPath);
    }

    setShowPicker(false);
    RPC.call("refresh_lobby_ui", {}, RPC.Mode.ALL);
  };

  const currentItems = () => {
    const slot = activeSlot();
    if (slot === -1) return CHARACTER_PATHS;
    if (slot !== null) return ASSORTMENTS[slot];
    return [];
  };

  return (
    <div
      class="modal"
      style={{ display: "flex", "flex-direction": "row", gap: "20px" }}
    >
      {/* The Accessory Picker integrated as a reactive Solid element */}
      <div style={{ width: "400px" }}>
        <Show when={showPicker()}>
          <div class="picker-popup">
            <div class="picker-header">
              <span>SELECT {activeSlot() === -1 ? "CHARACTER" : "ITEM"}</span>
              <button
                class="kick-btn"
                onClick={() => {
                  setShowPicker(false);
                }}
              >
                ×
              </button>
            </div>
            <div class="picker-grid">
              <For each={currentItems()}>
                {(path) => (
                  <div class="picker-item" onClick={() => selectItem(path)}>
                    <img src={path} />
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>

      <div class="modal-content">
        <div>
          <span class="close" onClick={props.onClose}>
            &times;
          </span>

          <div class="customization-body">
            <div class="name-group">
              <input
                type="text"
                value={name()}
                onInput={(e) => updateName(e.currentTarget.value)}
                placeholder="YOUR NAME"
                maxlength={MAX_NAME_LENGTH}
              />
            </div>

            <div class="preview-section">
              <button
                class="preview-button-wrapper"
                onClick={(e) => handleOpenPicker(e, -1)}
              >
                <div class="stick-man preview-size">
                  <img
                    src={myChar()}
                    style="width:100%; height:100%; object-fit:contain;"
                  />
                  <For each={[0, 1, 2]}>
                    {(idx) => {
                      const myAccPath = () => {
                        lobbyTicket(); // Force reactivity
                        return myPlayer().getState(`acc_${idx}`);
                      };
                      return (
                        <Show when={myAccPath()}>
                          <div
                            class="acc-layer"
                            style={{
                              "background-image": `url(${myAccPath()})`,
                              "z-index": idx === 0 ? 10 : idx === 1 ? 15 : 5,
                            }}
                          />
                        </Show>
                      );
                    }}
                  </For>
                </div>
              </button>
            </div>

            <div class="accessory-slots-container">
              <For each={[0, 1, 2]}>
                {(idx) => (
                  <div
                    class="accessory-slot"
                    onClick={(e) => handleOpenPicker(e, idx)}
                  >
                    <div class="slot-label">
                      {idx === 0 ? "HAT" : idx === 1 ? "FACE" : "ITEM"}
                    </div>
                    <div class="slot-display">
                      {(() => {
                        lobbyTicket(); // Listen for changes
                        const path = myPlayer().getState(`acc_${idx}`);
                        return (
                          <Show when={path}>
                            <img src={path.replace("-equip", "")} />
                          </Show>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
