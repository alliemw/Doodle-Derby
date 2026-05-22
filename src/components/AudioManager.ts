import { createSignal } from "solid-js";
const [isMuted, setIsMuted] = createSignal(true);
const [volume, setVolume] = createSignal(0.3);

const activeLoops: Record<string, HTMLAudioElement> = {};

export const AudioManager = {
  isMuted,
  volume,
  toggleMute: () => {
    const newState = !isMuted();
    setIsMuted(newState);
    localStorage.setItem("muted", String(newState));

    Object.values(activeLoops).forEach((audio) => {
      if (newState) {
        audio.pause();
      } else {
        audio.play().catch((err) => console.warn("Audio resume failed:", err));
      }
    });
  },
  setVolume: (val: number) => {
    setVolume(val);
    localStorage.setItem("volume", String(val));
    Object.values(activeLoops).forEach((audio) => {
      audio.volume = val;
    });
  },

  playSound: (src: string) => {
    if (isMuted()) return;
    const audio = new Audio(src);
    audio.volume = volume();
    audio.play().catch((err) => console.error("Audio playback failed:", err));
  },
  // Play a looping audio and return the HTMLAudioElement so caller can stop it.
  playLoop: (src: string) => {
    if (isMuted() || !src) return null;

    if (activeLoops[src]) {
      return activeLoops[src];
    }

    const audio = new Audio();
    audio.src = src; // Setting src explicitly
    audio.loop = true;
    audio.volume = volume();

    // Handle the error specifically at the source level
    audio.onerror = () => console.error(`Failed to load audio source: ${src}`);

    // Play only when the browser confirms it can play the file
    audio.oncanplay = () => {
      audio.play().catch((err) => {
        // This catches the 'User must interact with the document first' error
        console.warn("Playback blocked by browser policy:", err);
      });
    };
    activeLoops[src] = audio;
    return audio;
  },
  // Stop a looping audio previously returned from `playLoop`.
  stopLoop: (src: string) => {
    if (!src || !(src in activeLoops)) return;
    const audio = activeLoops[src];

    if (!audio) return;
    try {
      audio.pause();
      audio.src = "";
      audio.load();
     

      delete activeLoops[src];
    } catch (e) {
      console.error("Failed to stop audio loop:", e);
    }
  },
};
