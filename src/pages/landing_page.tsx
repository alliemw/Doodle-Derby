import { render } from "solid-js/web";
import { Page } from "../../api/page";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { routerNavigate } from "../../api/tiny_router";
import "../../style/landing-page.css";
import { getState, insertCoin, isHost, myPlayer } from "playroomkit";
import { AudioManager } from "../components/AudioManager";
import { MuteButton } from "../components/MuteButton";

import {
  PromptModal,
  AlertModal,
  AlertModalProps,
  PromptModalState,
} from "../../api/modals/ModalComponents";
import { IconButton } from "../components/IconButton";
import { DEFAULT_TIMER, SettingsModal } from "../components/SettingsModal";
import { PromptButton } from "../components/PromptButton";
import { ReactionBar } from "../../api/reactions/ReactionBarComponent";

function LandingMain() {
  let logoClickCount = 0;
  const logoClickEvent = 20;
  const eventDuration = 10;
  const [alertModal, setAlertModal] = createSignal<AlertModalProps | null>(
    null,
  );
  const [promptModal, setPromptModal] = createSignal<PromptModalState | null>(
    null,
  );
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false);

  const spawnSheep = () => {
    const doodle = document.createElement("img");
    doodle.src = "/landing-page/sheep_loading.png";
    doodle.classList.add("moving-sheep");

    const randomTop = Math.random() * 80;
    const randomDuration = 1 + Math.random() * 1.5;
    const randomSize = 30 + Math.random() * 100;

    Object.assign(doodle.style, {
      top: `${randomTop}%`,
      width: `${randomSize}px`,
      animation: `moveLeft ${randomDuration}s linear forwards`,
      zIndex: Math.floor(Math.random() * 5) - 2,
    });

    document.body.appendChild(doodle);
    setTimeout(() => doodle.remove(), randomDuration * 1000);
  };
  const handleLogoClick = () => {
    logoClickCount++;
    if (logoClickCount >= logoClickEvent) {
      const interval = setInterval(spawnSheep, 50);
      setTimeout(() => clearInterval(interval), eventDuration * 1000);
      logoClickCount = 0;
    }
  };
  const showAlert = (
    title: string | null,
    message: string,
    imgSrc?: string,
  ) => {
    setAlertModal({ title, message, imgSrc });
  };

  const showPrompt = (
    label: string,
    placeholder: string,
    onConfirm: (value: string | null) => void,
  ) => {
    setPromptModal({ label, placeholder, onConfirm });
  };

  const joinLobby = async (code: string) => {
    if (code.length === 4) {
      try {
        await insertCoin({
          gameId: process.env.GAME_ID,
          roomCode: code,
          skipLobby: true,
        });

        if (isHost()) {
          // Leave the accidental new room
          myPlayer().leaveRoom();
          showAlert(null, "Lobby not found. Please check the code.");
          return;
        }

        routerNavigate("/lobby");
        window.location.href = "/#r=R" + code;
      } catch (error) {
        showAlert(null, "Lobby not found. Please check the code.");
        return;
      }
    } else {
      showAlert(null, "Invalid code");
    }
  };

  const handleJoinClick = async () => {
    showPrompt("Enter Game Code:", "e.g. ABC123", async (code) => {
      if (!code) return;
      await joinLobby(code);
    });
  };

  onMount(() => {
    AudioManager.playLoop("/audio/DDsong.mp3");
  });

  const handleCredits = () => {
    showAlert(
      "Credits!!",
      "Producer – Allie Atkinson\n" +
        "Programmers – Seven Flaminiano, Max Fisch, Zidane Ho, Neel Dharm, Adrian Guzman, Isha Pandit, Gloria Lee, Michelle Mitchell, Jack Park, Zhiheng Zhou\n" +
        "Artists – Marissa Morales, Jay Siqueiroz, Bella Lau, Allie Atkinson\n" +
        "Audio – Jay Siqueiroz, Jason Montanez\n" +
        "Design – Emily Le, Zidane Ho\n",
      "group_photo.png",
    );
  };

  const handleHowToPlay = () => {
    showAlert(
      "How to Play",
      "Start by creating a lobby and inviting at least two friends!" +
        " The game will begin by everyone writing word prompts that are drawable." +
        " They can be simple, like “apple pie,” or more personal to your friend group, like “Allie’s cat.”" +
        " After everybody has submitted words, the drawing will begin! If you are an artist, draw your prompt" +
        " accurately and quickly to win the round. If you are in the audience, try to guess both artists’ prompts" +
        " (they’re different!). Faster guesses = more points. " +
        "At the end of the game, a winner will be declared. Let’s doodle!",
    );
  };
  return (
    <div class="landing-page-body">
      <Show when={isSettingsOpen()}>
        <SettingsModal
          timerSeconds={0}
          onClose={() => setIsSettingsOpen(false)}
          hideGameSettings={true}
          hideControls={true}
        />
      </Show>
      <div style={{ position: "absolute", top: "10px", right: "10px" }}>
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
      {/* Main Logo Section */}
      <div class="game-wrapper">
        <button class="logo-button" onClick={handleLogoClick}>
          <img
            src="/landing-page/logo.png"
            alt="Doodle Derby"
            class="logo-img"
          />
        </button>
      </div>

      {/* Center Actions */}
      <div class="button-container">
        <button
          class="image-button"
          onClick={async () => {
            await insertCoin({
              gameId: process.env.GAME_ID,
              skipLobby: true,
            });
            routerNavigate("/lobby");
          }}
        >
          <img src="/landing-page/create_button_flat.png" class="btn-idle" />
          <img src="/landing-page/create_button_hover.png" class="btn-hover" />
        </button>

        <div class="join-input-section">
          <button class="image-button" onClick={() => handleJoinClick()}>
            <img src="/landing-page/join_button_flat.png" class="btn-idle" />
            <img src="/landing-page/join_button_hover.png" class="btn-hover" />
          </button>
        </div>
      </div>

      {/* Footer Navigation */}
      <div class="footer-nav">
        <div>
          <span class="version-text">Version 0.0.1</span>
          <span class="footer-link" onClick={() => handleCredits()}>
            credits
          </span>
          <span class="footer-link" onClick={() => handleHowToPlay()}>
            how to play
          </span>
        </div>
      </div>
      <Show when={alertModal()}>
        {(alert) => (
          <AlertModal {...alert()} onClose={() => setAlertModal(null)} />
        )}
      </Show>
      <Show when={promptModal()}>
        {(prompt) => (
          <PromptModal
            label={prompt().label}
            placeholder={prompt().placeholder}
            onClose={(value) => {
              const current = promptModal();
              setPromptModal(null);
              current?.onConfirm(value);
            }}
          />
        )}
      </Show>
    </div>
  );
}

export const LandingPage: Page = {
  async render(root: HTMLElement) {
    this.onEnd = render(() => <LandingMain />, root);
  },
};
