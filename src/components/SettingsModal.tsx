import { isHost, getState, setState, RPC, myPlayer } from "playroomkit";
import { createSignal, For, Show, createEffect, onCleanup } from "solid-js";
import { AudioManager } from "./AudioManager";
import "../../style/settings.css";

export const DEFAULT_TIMER = 60;
export const DEFAULT_PROMPT_TIMER = 15;

const MIN_ROUNDS = 1;
const MIN_TIMER = 10;
const MAX_TIMER = 300;
const TIMER_INCREMENT = 10;
const MIN_PROMPT_TIMER = 5;
const MAX_PROMPT_TIMER = 60;
const PROMPT_TIMER_INCREMENT = 5;

export function SettingsModal(props: {
  timerSeconds: number;
  onClose: () => void;
  hideGameSettings?: boolean;
  hideControls?: boolean;
}) {
  const tabs = [
    ...(props.hideGameSettings ? [] : ["Game Settings"]),
    "Audio",
    ...(props.hideControls ? [] : ["Controls"]),
  ];
  const [activeTab, setActiveTab] = createSignal(tabs[0]);
  const tabImgs: Record<string, string[]> = {
    "Game Settings": [
      "/settings/golden_apple_icon.png",
      "/settings/golden_apple_bite_icon.png",
    ],
    Audio: [
      "/settings/green_apple_icon.png",
      "/settings/green_apple_bite_icon.png",
    ],
    Controls: [
      "/settings/red_apple_icon.png",
      "/settings/red_apple_bite_icon.png",
    ],
    Drawing: [
      "/settings/pink_apple_icon.png",
      "/settings/pink_apple_bite_icon.png",
    ],
  };

  const [localTimer, setLocalTimer] = createSignal(
    getState("timer-seconds-settings") ?? DEFAULT_TIMER,
  );
  const [localRounds, setLocalRounds] = createSignal(
    getState("number-rounds") ?? MIN_ROUNDS,
  );
  const [localPromptTimer, setLocalPromptTimer] = createSignal(
    getState("prompt-timer-seconds-settings") ?? DEFAULT_PROMPT_TIMER,
  );

  const updateLocalRounds = (amt: number) => {
    setLocalRounds((prev) => Math.max(MIN_ROUNDS, prev + amt));
  };

  const updateLocalTimer = (amt: number) => {
    setLocalTimer((prev) =>
      Math.min(MAX_TIMER, Math.max(MIN_TIMER, prev + amt)),
    );
  };

  const updateLocalPromptTimer = (amt: number) => {
    setLocalPromptTimer((prev) =>
      Math.min(MAX_PROMPT_TIMER, Math.max(MIN_PROMPT_TIMER, prev + amt)),
    );
  };

  const handleConfirm = () => {
    if (!isHost()) return;
    setState("timer-seconds-settings", localTimer(), true);
    setState("number-rounds", localRounds(), true);
    setState("prompt-timer-seconds-settings", localPromptTimer(), true);

    RPC.call("refresh_lobby_ui", {}, RPC.Mode.ALL);
    props.onClose();
  };

  const handleReset = () => {
    setLocalTimer(DEFAULT_TIMER);
    setLocalRounds(MIN_ROUNDS);
    setLocalPromptTimer(DEFAULT_PROMPT_TIMER);
  };

  return (
    <div
      id="settingsMenu"
      class="modal"
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
      }}
    >
      <div class="modal-content">
        <div class="settings-layout">
          {/* Left Sidebar - Tab Navigation */}
          <div class="settings-sidebar">
            <div class="tab-buttons">
              <For each={tabs}>
                {(tab) => (
                  <SettingsHeader
                    baseSrc={tabImgs[tab][0]}
                    activeSrc={tabImgs[tab][1]}
                    label={tab}
                    activeTab={activeTab()}
                    onClick={() => setActiveTab(tab)}
                  ></SettingsHeader>
                )}
              </For>
            </div>
          </div>

          {/* Right Side - Dynamic Content */}
          <div class="settings-main-wrapper">
            <button
              class="kick-btn settings-close-btn"
              onClick={props.onClose}
              aria-label="Close settings"
            >
              &times;
            </button>
            <div class="settings-main">
              <div class="settings-content">
                <Show when={activeTab() === "Game Settings"}>
                  <div class="settings-section">
                    <h3>Match Rules</h3>
                    <Show
                      when={isHost()}
                      fallback={
                        <p class="host-only-msg">
                          Only the host can change game rules.
                        </p>
                      }
                    >
                      <SettingRow
                        label="Number of Rounds"
                        value={`${localRounds()}`}
                        onUpdate={(dir) => updateLocalRounds(dir)}
                      />
                      <SettingRow
                        label="Round Timer"
                        value={`${localTimer()}s`}
                        onUpdate={(dir) => updateLocalTimer(dir * TIMER_INCREMENT)}
                      />
                      <SettingRow
                        label="Prompt Timer"
                        value={`${localPromptTimer()}s`}
                        onUpdate={(dir) =>
                          updateLocalPromptTimer(dir * PROMPT_TIMER_INCREMENT)
                        }
                      />
                      <div
                        class="settings-actions"
                        style={{
                          display: "flex",
                          gap: "10px",
                          "margin-top": "20px",
                        }}
                      >
                        <button class="reset-btn" onClick={handleReset}>
                          Reset
                        </button>
                        <button class="confirm-btn" onClick={handleConfirm}>
                          Confirm
                        </button>
                      </div>
                    </Show>
                  </div>
                </Show>

                <Show when={activeTab() === "Audio"}>
                  <div class="settings-section">
                    <h3>Audio Preferences</h3>
                    <AudioControls />
                  </div>
                </Show>

                <Show when={activeTab() === "Controls"}>
                  <ControlsTab />
                </Show>

                {/* <Show when={activeTab() === "Drawing"}>
                <div class="settings-section">
                  <h3>Canvas Settings</h3>
                  <p>Brush smoothing and pressure sensitivity options.</p>
                </div>
              </Show> */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlsTab() {
  const me = myPlayer();
  const [eraseKey, setEraseKey] = createSignal(
    me.getState("hotkey-erase") ?? "e",
  );
  const [undoKey, setUndoKey] = createSignal(
    me.getState("hotkey-undo") ?? "u",
  );
  const [redoKey, setRedoKey] = createSignal(
    me.getState("hotkey-redo") ?? "r",
  );
  const [fillKey, setFillKey] = createSignal(
    me.getState("hotkey-fill") ?? "f",
  );
  const [drawKey, setDrawKey] = createSignal(
    me.getState("hotkey-draw") ?? "b",
  );
  const [listeningAction, setListeningAction] = createSignal<string | null>(
    null,
  );

  const isKeyTaken = (key: string, currentAction: string) => {
    const currentBindings: Record<string, string> = {
      Erase: eraseKey(),
      Undo: undoKey(),
      Redo: redoKey(),
      Fill: fillKey(),
    };

    return Object.entries(currentBindings).some(
      ([action, binding]) => action !== currentAction && binding === key,
    );
  };

  const handleControlsConfirm = () => {
    me.setState("hotkey-erase", eraseKey(), true);
    me.setState("hotkey-undo", undoKey(), true);
    me.setState("hotkey-redo", redoKey(), true);
    me.setState("hotkey-fill", fillKey(), true);
  };

  const handleControlsReset = () => {
    setEraseKey("e");
    setUndoKey("u");
    setRedoKey("r");
    setFillKey("f");
  };

  return (
    <div class="settings-section">
      <h3>Input Settings</h3>
      <div class="hotkey-list">
        <HotkeyRow
          label="Erase"
          value={eraseKey()}
          isListening={listeningAction() === "Erase"}
          onStart={() => setListeningAction("Erase")}
          onUpdate={(k) => {
            if (!isKeyTaken(k, "Erase")) setEraseKey(k);
            setListeningAction(null);
          }}
          onCancel={() => setListeningAction(null)}
        />
        <HotkeyRow
          label="Undo"
          value={undoKey()}
          isListening={listeningAction() === "Undo"}
          onStart={() => setListeningAction("Undo")}
          onUpdate={(k) => {
            if (!isKeyTaken(k, "Undo")) setUndoKey(k);
            setListeningAction(null);
          }}
          onCancel={() => setListeningAction(null)}
        />
        <HotkeyRow
          label="Redo"
          value={redoKey()}
          isListening={listeningAction() === "Redo"}
          onStart={() => setListeningAction("Redo")}
          onUpdate={(k) => {
            if (!isKeyTaken(k, "Redo")) setRedoKey(k);
            setListeningAction(null);
          }}
          onCancel={() => setListeningAction(null)}
        />
        <HotkeyRow
          label="Fill"
          value={fillKey()}
          isListening={listeningAction() === "Fill"}
          onStart={() => setListeningAction("Fill")}
          onUpdate={(k) => {
            if (!isKeyTaken(k, "Fill")) setFillKey(k);
            setListeningAction(null);
          }}
          onCancel={() => setListeningAction(null)}
        />
        <HotkeyRow
          label="Draw"
          value={drawKey()}
          isListening={listeningAction() === "Draw"}
          onStart={() => setListeningAction("Draw")}
          onUpdate={(k) => {
            if (!isKeyTaken(k, "Draw")) setDrawKey(k);
            setListeningAction(null);
          }}
          onCancel={() => setListeningAction(null)}
        />
      </div>

      <div
        class="settings-actions"
        style={{
          display: "flex",
          gap: "10px",
          "margin-top": "20px",
        }}
      >
        <button class="reset-btn" onClick={handleControlsReset}>
          Reset
        </button>
        <button class="confirm-btn" onClick={handleControlsConfirm}>
          Confirm
        </button>
      </div>
    </div>
  );
}

function HotkeyRow(props: {
  label: string;
  value: string;
  isListening: boolean;
  onStart: () => void;
  onUpdate: (k: string) => void;
  onCancel: () => void;
}) {
  createEffect(() => {
    if (props.isListening) {
      const listener = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          props.onCancel();
          return;
        }

        e.preventDefault();
        props.onUpdate(e.key.toLowerCase());
      };

      window.addEventListener("keydown", listener);
      onCleanup(() => window.removeEventListener("keydown", listener));
    }
  });

  return (
    <div class="setting-row">
      <span class="setting-label">{props.label}</span>
      <button
        class="step-btn"
        style={{
          width: "100px",
          margin: "10px",
          background: props.isListening ? "#fffbe6" : "white",
          border: props.isListening ? "2px solid #ffe58f" : "1px solid #ccc",
          "font-weight": props.isListening ? "bold" : "normal",
        }}
        onClick={() => props.onStart()}
      >
        {props.isListening ? "..." : props.value.toUpperCase()}
      </button>
    </div>
  );
}

function SettingsHeader(props: {
  baseSrc: string;
  activeSrc: string;
  label: string;
  description?: string;
  activeTab: string;
  onClick(): void;
}) {
  function isActive() {
    return props.activeTab === props.label;
  }

  const src = () => (isActive() ? props.activeSrc : props.baseSrc);

  return (
    <button
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "0",
        width: "200px",
        height: "75px",
        overflow: "hidden",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        position: "relative",
      }}
      onClick={() => {
        props.onClick();
      }}
    >
      <img
        src={src()}
        style={{
          width: "250px",
          height: "auto",
          "pointer-events": "none",
          "flex-shrink": "0",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "0",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          "padding-top": "18px",
          "padding-right": "8px",
          color: "white",
          "font-weight": "bold",
          "pointer-events": "none",
          "text-shadow": "1px 1px 2px rgba(0,0,0,0.5)",
          "font-family": '"ComicSansMS", "Comic Sans", cursive',
          "-webkit-mask-image": `url(${src()})`,
          "mask-image": `url(${src()})`,
          "mask-size": "250px auto",
          "mask-repeat": "no-repeat",
          "mask-position": "center",
        }}
      >
        {props.label}
      </div>
    </button>
  );
}

function SettingRow(props: {
  label: string;
  value: any;
  onUpdate: (amt: number) => void;
}) {
  return (
    <div class="setting-row">
      <span class="setting-label">{props.label}</span>
      <div class="setting-controls">
        <button class="step-btn" onClick={() => props.onUpdate(-1)}>
          &lt;
        </button>
        <span class="step-value">
          <p>{props.value}</p>
        </span>
        <button class="step-btn" onClick={() => props.onUpdate(1)}>
          &gt;
        </button>
      </div>
    </div>
  );
}

function AudioControls() {
  const { musicVolume, setMusicVolume, sfxVolume, setSfxVolume } = AudioManager;

  return (
    <div
      class="audio-controls"
      style={{
        display: "flex",
        "flex-direction": "column",
        "align-items": "flex-start",
        width: "100%",
        gap: "20px",
      }}
    >
      <VolumeSlider
        label="Music"
        value={musicVolume()}
        onInput={setMusicVolume}
      />
      <VolumeSlider
        label="SFX"
        value={sfxVolume()}
        onInput={setSfxVolume}
      />
    </div>
  );
}

function VolumeSlider(props: {
  label: string;
  value: number;
  onInput: (val: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        "align-items": "flex-start",
        width: "100%",
        gap: "10px",
      }}
    >
      <div
        style={{
          display: "flex",
          "flex-direction": "row",
          "align-items": "center",
          gap: "10px",
        }}
      >
        <img
          src="/audio/Sound_icon_on.png"
          width="40px"
          style={{ height: "40px" }}
        ></img>
        <p>{props.label}: {Math.round(props.value * 100)}%</p>
      </div>

      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={props.value}
        onInput={(e) => props.onInput(parseFloat(e.currentTarget.value))}
        style={{ width: "100%" }}
      />
    </div>
  );
}
