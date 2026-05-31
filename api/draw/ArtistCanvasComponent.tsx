import "solid-js/web";

import konva from "konva";
import { onCleanup, createSignal, createEffect, onMount } from "solid-js";

import { getState, myPlayer, PlayerState } from "playroomkit";

import {
  PaintMode,
  PaintCanvas,
  Brush,
  NetworkFillPayload,
  NetworkStrokePayload,
  BoundingBox,
} from "./painting";

import { RPC } from "playroomkit";
import { PlayerAvatar } from "../../src/components/PlayerAvatar";
import { ArtistBar } from "../../src/components/ArtistBar";

const VIRTUAL_WIDTH = 600;
const VIRTUAL_HEIGHT = 600;

function DrawCanvas(props: { prompt: string }) {
  let containerRef: HTMLDivElement | undefined;

  const DEFAULT_BRUSH = { color: "#000000", strokeWidth: 5 };

  let [paintMode, setPaintMode] = createSignal(PaintMode.DRAW);
  let [brush, setBrush] = createSignal(DEFAULT_BRUSH);
  const [paintCanvas, setPaintCanvas] = createSignal<PaintCanvas>();

  let stage: konva.Stage;
  let canvas: HTMLCanvasElement;

  onMount(() => {
    if (!containerRef) {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent hotkeys from firing if the user is typing in a chat/input field
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      const player = myPlayer();
      const key = e.key.toLowerCase();

      // Get dynamic hotkeys from player state, falling back to defaults
      const eraseKey = player.getState("hotkey-erase") || "e";
      const undoKey = player.getState("hotkey-undo") || "u";
      const redoKey = player.getState("hotkey-redo") || "r";
      const fillKey = player.getState("hotkey-fill") || "f";
      const drawKey = player.getState("hotkey-draw") || "b";

      const pc = paintCanvas();
      if (!pc) return;

      if (key === eraseKey) {
        setPaintMode(PaintMode.ERASE);
        pc.setPaintMode(PaintMode.ERASE);
      } else if (key === fillKey) {
        setPaintMode(PaintMode.FILL);
        pc.setPaintMode(PaintMode.FILL);
      } else if (key === undoKey) {
        pc.undo();
      } else if (key === redoKey) {
        pc.redo();
      } else if (key === drawKey) {
        setPaintMode(PaintMode.DRAW);
        pc.setPaintMode(PaintMode.DRAW);
      }
    };

    const measure = () => {
      const rect = containerRef!.getBoundingClientRect();
      // Fall back to virtual size if CSS hasn't laid out yet (rare).
      const w = Math.max(1, Math.round(rect.width)) || VIRTUAL_WIDTH;
      const h = Math.max(1, Math.round(rect.height)) || VIRTUAL_HEIGHT;
      return { width: w, height: h };
    };

    const initial = measure();

    // The Konva stage matches the displayed pixel size, but the backing
    // canvas stays at the virtual size (VIRTUAL_WIDTH x VIRTUAL_HEIGHT) so
    // strokes are drawn in virtual coordinates and never need to be
    // rescaled when the window resizes — we only adjust the layer scale.
    stage = new konva.Stage({
      container: containerRef,
      width: initial.width,
      height: initial.height,
    });

    canvas = stage.toCanvas();

    const pc = new PaintCanvas(
      canvas,
      { x: 0, y: 0 },
      stage,
      DEFAULT_BRUSH,
      false,
      { width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT },
      { width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT },
    );
    pc.scale(initial.width / VIRTUAL_WIDTH);

    const resizeObserver = new ResizeObserver(() => {
      const next = measure();
      if (next.width === stage.width() && next.height === stage.height()) {
        return;
      }
      stage.size({ width: next.width, height: next.height });
      pc.scale(next.width / VIRTUAL_WIDTH);
    });
    resizeObserver.observe(containerRef);

    pc.setNetworkCallbacks({
      onStrokeBegin: (payload: NetworkStrokePayload) => {
        RPC.call("onStrokeBegin", payload, RPC.Mode.OTHERS);
      },
      onStrokeMove: (
        points: [number, number][],
        currentBrush: Brush,
        currentPaintMode: PaintMode,
      ) => {
        let payload: NetworkStrokePayload = {
          points,
          currentBrush,
          paintMode: currentPaintMode,
        };
        RPC.call("onStrokeMove", payload, RPC.Mode.OTHERS);
      },
      onStrokeEnd: (boundingBox: BoundingBox) => {
        RPC.call("onStrokeEnd", boundingBox, RPC.Mode.OTHERS);
      },
      onFill: (x: number, y: number, color: string) => {
        let payload: NetworkFillPayload = {
          x,
          y,
          color,
        };
        RPC.call("onFill", payload, RPC.Mode.OTHERS);
      },
      onUndo: () => {
        RPC.call("onUndo", {}, RPC.Mode.OTHERS);
      },
      onRedo: () => {
        RPC.call("onRedo", {}, RPC.Mode.OTHERS);
      },
    });

    setPaintCanvas(pc);

    // Periodic snapshot broadcasting
    const roundDuration = getState("timer-seconds-settings") ?? 60;
    const snapshotInterval = (roundDuration / 5) * 1000; // 1/5 of round time

    const snapshotTimer = setInterval(() => {
      try {
        const snapshot = pc.getCanvasSnapshot();
        RPC.call("onSnapshotBroadcast", snapshot, RPC.Mode.OTHERS);
      } catch (error) {
        console.error("Failed to capture/broadcast snapshot:", error);
      }
    }, snapshotInterval);

    window.addEventListener("keydown", handleKeyDown);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      resizeObserver.disconnect();
      stage.destroy();
      clearInterval(snapshotTimer);
    });
  });

  createEffect(() => {
    const pc = paintCanvas();
    if (pc) {
      pc.setPaintMode(paintMode());
      pc.setBrushColor(brush().color);
      pc.setBrushStrokeWidth(brush().strokeWidth);
    }
  });

  return (
    <>
      <div class="draw-root-container">
        <div class="draw-header-container">
          <h2 class="draw-header">{"DRAW:"}</h2>
          <h2>&nbsp;</h2>
          <h2 class="draw-header">{props.prompt}</h2>
        </div>

        <div class="draw-workspace">
          <ArtistBar
            brush={brush}
            setBrush={setBrush}
            paintMode={paintMode}
            setPaintMode={setPaintMode}
            paintCanvas={paintCanvas()}
          />
          <div class="canvas-wrapper">
            <img class="canvas-frame-outer" src="/drawing/canvas_frame.png" />
            <img
              class="canvas-frame-inner"
              src="/drawing/canvas_inner_frame.png"
            />
            <div
              ref={containerRef}
              id="container"
              class="canvas-container"
            ></div>
          </div>
        </div>
      </div>
    </>
  );
}

export function SpectatorCanvas(props: {
  artist: PlayerState;
  size?: "small" | "default";
  isSecondArtist?: boolean;
  hiddenPrompt?: string;
}) {
  let containerRef: HTMLDivElement | undefined;
  const DEFAULT_BRUSH = { color: "#000000", strokeWidth: 5 };

  let stage: konva.Stage;
  let canvas: HTMLCanvasElement;
  let paintCanvas: PaintCanvas;

  onMount(() => {
    if (!containerRef) {
      return;
    }

    const measure = () => {
      const rect = containerRef!.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width)) || VIRTUAL_WIDTH;
      const h = Math.max(1, Math.round(rect.height)) || VIRTUAL_HEIGHT;
      return { width: w, height: h };
    };

    // State machine to ensure strict sequencing of stroke packets
    let isStrokeActive = false;
    let pendingStrokeMoves: NetworkStrokePayload[] = [];
    let pendingStrokeEnd: BoundingBox | null = null;
    let strokeWaitTimeout: ReturnType<typeof setTimeout> | null = null;
    const STROKE_TIMEOUT_MS = 5000; // Wait up to 5 seconds for onStrokeBegin

    const clearStrokeState = () => {
      isStrokeActive = false;
      pendingStrokeMoves = [];
      pendingStrokeEnd = null;
      if (strokeWaitTimeout !== null) {
        clearTimeout(strokeWaitTimeout);
        strokeWaitTimeout = null;
      }
    };

    const processPendingMoves = () => {
      while (pendingStrokeMoves.length > 0) {
        const payload = pendingStrokeMoves.shift()!;
        paintCanvas.handleRemoteStroke(payload);
      }
    };

    const processPendingEnd = () => {
      if (pendingStrokeEnd !== null) {
        const boundingBox = pendingStrokeEnd;
        pendingStrokeEnd = null;
        paintCanvas.registerUndoClient(boundingBox);
        isStrokeActive = false;
      }
    };

    const setStrokeTimeout = () => {
      if (strokeWaitTimeout !== null) {
        clearTimeout(strokeWaitTimeout);
      }
      strokeWaitTimeout = setTimeout(() => {
        // Timeout waiting for stroke begin - discard buffered data
        if (!isStrokeActive && (pendingStrokeMoves.length > 0 || pendingStrokeEnd !== null)) {
          console.warn(
            "Stroke packet sequence timeout: discarding buffered data. " +
            "This suggests network instability or packet loss."
          );
          clearStrokeState();
        }
      }, STROKE_TIMEOUT_MS);
    };

    const onStrokeBeginClean = RPC.register(
      "onStrokeBegin",
      async (payload: NetworkStrokePayload, player) => {
        if (player.id !== props.artist.id) return;

        // If a stroke was already active, finalize it first
        if (isStrokeActive) {
          processPendingEnd();
        }

        clearStrokeState();
        isStrokeActive = true;

        paintCanvas.clientStartRecordStroke();
        paintCanvas.handleRemoteStroke(payload);
      },
    );

    const onStrokeMoveClean = RPC.register(
      "onStrokeMove",
      async (payload: NetworkStrokePayload, player) => {
        if (player.id !== props.artist.id) return;

        if (!isStrokeActive) {
          // Stroke move arrived before stroke begin - buffer it and set timeout
          pendingStrokeMoves.push(payload);
          setStrokeTimeout();
          return;
        }

        // Process any buffered moves first
        processPendingMoves();
        paintCanvas.handleRemoteStroke(payload);
      },
    );

    const onStrokeEndClean = RPC.register(
      "onStrokeEnd",
      async (payload: BoundingBox, player) => {
        if (player.id !== props.artist.id) return;

        if (!isStrokeActive) {
          // Stroke end arrived before stroke begin - buffer it and set timeout
          pendingStrokeEnd = payload;
          setStrokeTimeout();
          return;
        }

        // Process any buffered moves
        processPendingMoves();
        pendingStrokeEnd = payload;
        processPendingEnd();
      },
    );

    const onFillClean = RPC.register(
      "onFill",
      async (payload: NetworkFillPayload, player) => {
        if (player.id !== props.artist.id) return;
        paintCanvas.handleRemoteFill(payload.x, payload.y, payload.color);
      },
    );

    const onUndoClean = RPC.register("onUndo", async (_, player) => {
      if (player.id !== props.artist.id) return;
      paintCanvas.undo();
    });

    const onRedoClean = RPC.register("onRedo", async (_, player) => {
      if (player.id !== props.artist.id) return;
      paintCanvas.redo();
    });


    const onSnapshotBroadcastClean = RPC.register(
      "onSnapshotBroadcast",
      async (snapshot: string, player) => {
        if (player.id !== props.artist.id) return;
        try {
          await paintCanvas.applyCanvasSnapshot(snapshot);
          console.log("Canvas snapshot applied");
        } catch (error) {
          console.error("Failed to apply snapshot:", error);
        }
      },
    );

    const initial = measure();

    // Same architecture as the artist: backing canvas locked to virtual
    // size, stage matches display pixels, layer scaled to fit. Resizes
    // are then just stage.size() + pc.scale().
    stage = new konva.Stage({
      container: containerRef,
      width: initial.width,
      height: initial.height,
    });

    canvas = stage.toCanvas();

    paintCanvas = new PaintCanvas(
      canvas,
      { x: 0, y: 0 },
      stage,
      DEFAULT_BRUSH,
      true, // isSpectator
      { width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT },
      { width: VIRTUAL_WIDTH, height: VIRTUAL_HEIGHT },
    );
    paintCanvas.scale(initial.width / VIRTUAL_WIDTH);

    const resizeObserver = new ResizeObserver(() => {
      const next = measure();
      if (next.width === stage.width() && next.height === stage.height()) {
        return;
      }
      stage.size({ width: next.width, height: next.height });
      paintCanvas.scale(next.width / VIRTUAL_WIDTH);
    });
    resizeObserver.observe(containerRef);

    onCleanup(() => {
      resizeObserver.disconnect();
      stage.destroy();
      onStrokeBeginClean();
      onStrokeEndClean();
      onStrokeMoveClean();
      onFillClean();
      onUndoClean();
      onRedoClean();
      onSnapshotBroadcastClean();
    });
  });

  const wrapperClass = () =>
    props.size === "small"
      ? "canvas-wrapper spectator-small"
      : "canvas-wrapper spectator";

  return (
    <>
      <div class="draw-root-container">
        <div class="spectator-header-container">
          <PlayerAvatar player={props.artist}></PlayerAvatar>
          <div>
            <div class="spectator-name-header">
              {props.artist.getState("name")}
            </div>
            <h1 class="spectator-prompt-header">
              <pre>{props.hiddenPrompt}</pre>
            </h1>
          </div>
        </div>

        <div class={wrapperClass()}>
          <img class="canvas-frame-outer" src="/drawing/canvas_frame.png" />
          <img
            class="canvas-frame-inner"
            src="/drawing/canvas_inner_frame.png"
          />
          <div ref={containerRef} id="container" class="canvas-container"></div>
        </div>
      </div>
    </>
  );
}

export function GuessElement(props: { promptLength: number }) {
  let [text, setText] = createSignal("");
  let containerRef: HTMLDivElement | undefined;

  const handleContainerClick = () => {
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
  return (
    <>
      <div
        class="guessContainer"
        ref={containerRef}
        onClick={handleContainerClick}
      >
        {Array.from({ length: props.promptLength }).map(() => (
          <>
            <div class="input-unit">
              <input
                class="letter-input"
                type="text"
                maxlength="1"
                onInput={handleInput}
                onChange={(c) =>
                  setText((text) => (text = c.currentTarget.value))
                }
              />
              <div class="bold-dash"></div>
            </div>
          </>
        ))}
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

export function ArtistCanvasComponent(props: { prompt: string }) {
  return (
    <div class="artist-canvas-component">
      <DrawCanvas prompt={props.prompt} />
    </div>
  );
}
