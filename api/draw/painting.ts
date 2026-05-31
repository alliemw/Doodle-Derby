import Konva from "konva";

import { CurveInterpolator } from "curve-interpolator";
import { Vector2d } from "konva/lib/types";

export interface Brush {
  // Hex (RGB) -- Ex: #FFFFFF
  color: string;
  strokeWidth: number;
}

export enum PaintActionType {
  Draw,
  Erase,
  Fill,
}

export interface BoundingBox {
  min: [number, number];
  max: [number, number];
}

function boundingBoxDefault(): BoundingBox {
  return {
    min: [Number.MAX_VALUE, Number.MAX_VALUE],
    max: [Number.MIN_VALUE, Number.MIN_VALUE],
  };
}

interface ImageCapture {
  beforeImage: ImageData | null;
  afterImage: ImageData | null;
  boundingBox: BoundingBox;
}

// TODO: If adding more actions in the future, ensure
//       to create dedicated function to pushing into undo
//       buffer as redo buffer should ALWAYS be cleared when
//       pushing into undo buffer!

export interface PaintAction {
  // Array of connecting points
  strokes: ImageCapture;
  type: PaintActionType;
}

function paintActionDefault(): PaintAction {
  return {
    strokes: {
      beforeImage: null,
      afterImage: null,
      boundingBox: boundingBoxDefault(),
    },
    type: PaintActionType.Draw,
  };
}

export enum PaintMode {
  DRAW,
  ERASE,
  FILL,
}

export type NetworkedFillCallback = (
  x: number,
  y: number,
  color: string,
) => void;

export type NetworkedStrokeCallback = (
  points: [number, number][],
  currentBrush: Brush,
  paintMode: PaintMode,
) => void;

export interface NetworkFillPayload {
  x: number;
  y: number;
  color: string;
}

export interface NetworkStrokePayload {
  points: [number, number][];
  currentBrush: Brush;
  paintMode: PaintMode;
}

export interface NetworkPaintCallbacks {
  onFill: NetworkedFillCallback;
  onStrokeBegin: (payload: NetworkStrokePayload) => void;
  onStrokeMove: NetworkedStrokeCallback;
  onStrokeEnd: (boundingBox: BoundingBox) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export interface NetworkFillPayload {
  x: number;
  y: number;
  color: string;
}

export interface NetworkStrokePayload {
  points: [number, number][];
  currentBrush: Brush;
  paintMode: PaintMode;
}

export interface NetworkPaintCallbacks {
  onFill: NetworkedFillCallback;
  onStrokeBegin: (payload: NetworkStrokePayload) => void;
  onStrokeMove: NetworkedStrokeCallback;
  onStrokeEnd: (boundingBox: BoundingBox) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export class PaintCanvas {
  private image: Konva.Image;
  private layer: Konva.Layer;
  private context: CanvasRenderingContext2D;

  private _paintMode: PaintMode = PaintMode.DRAW;
  private currentBrush: Brush;

  private undoBuffer: PaintAction[];
  private redoBuffer: PaintAction[];

  private canvasWidth: number;
  private canvasHeight: number;

  private virtualWidth: number;
  private virtualHeight: number;

  private pointsBuffer: [number, number][] = [];

  private requiredPoints: number = 4;

  // Track if fill bucket was used
  private hasFilled: boolean = false;

  // Track if undo or redo was used
  private hasReverted: boolean = false;

  private networkCallbacks: NetworkPaintCallbacks | null = null;

  private previousClientImageData: ImageData | null = null;
  private canvas: HTMLCanvasElement;

  // Initializes internals of PaintCanvas and sets up
  // callbacks for drawing.
  constructor(
    canvas: HTMLCanvasElement,
    pos: Konva.Vector2d,
    stage: Konva.Stage,
    brush: Brush,
    isSpectator: boolean = false,
    baseSize?: { width: number; height: number },
    virtualSize?: { width: number; height: number },
  ) {
    this.image = new Konva.Image({
      image: canvas,
      x: pos.x,
      y: pos.y,
    });
    this.canvas = canvas;
    this.layer = new Konva.Layer();

    this.layer.add(this.image);

    this.context = canvas.getContext("2d") as CanvasRenderingContext2D;

    this.currentBrush = brush;

    this.undoBuffer = [];
    this.redoBuffer = [];

    if (!isSpectator) {
      this.registerImageCallbacks(stage);
    }

    stage.add(this.layer);

    this.canvasWidth = baseSize ? baseSize.width : canvas.width;
    this.canvasHeight = baseSize ? baseSize.height : canvas.height;

    this.virtualWidth = virtualSize ? virtualSize.width : this.canvasWidth;
    this.virtualHeight = virtualSize ? virtualSize.height : this.canvasHeight;

    if (baseSize) {
      this.canvas.width = baseSize.width;
      this.canvas.height = baseSize.height;
    }

    this.clear();
  }

  /**
   * Handles incoming stroke data from the network and scales it to the local canvas size.
   * @param payload The networked stroke data containing points, brush, and mode.
   * @param referenceSize The virtual resolution used by the network (default 1000x1000).
   */
  public handleRemoteStroke(
    payload: NetworkStrokePayload,
    referenceSize: { width: number; height: number } = {
      width: this.virtualWidth,
      height: this.virtualHeight,
    },
  ) {
    const { points, currentBrush, paintMode } = payload;

    // 1. Calculate the scale factor relative to the reference size
    const scaleX = this.canvasWidth / referenceSize.width;
    const scaleY = this.canvasHeight / referenceSize.height;

    // 2. Scale the incoming points to the local coordinate system
    const localPoints = points.map(
      (p) => [p[0] * scaleX, p[1] * scaleY] as [number, number],
    );

    // 3. Scale the brush stroke width so it remains proportional to the canvas size
    // We use scaleX as a uniform scale factor for the brush width
    const localBrush: Brush = {
      ...currentBrush,
      strokeWidth: currentBrush.strokeWidth * scaleX,
    };

    // 4. Get the current image data to apply the stroke to
    const imageData = this.context.getImageData(
      0,
      0,
      this.canvasWidth,
      this.canvasHeight,
    );

    // 5. Draw the point/segment locally
    const newBoundingBox = this.drawPoint(
      localPoints,
      localBrush,
      paintMode,
      imageData,
    );

    // 6. Update the canvas and layer
    if (newBoundingBox) {
      this.context.putImageData(imageData, 0, 0);
      this.layer.batchDraw();
    }
  }

  public handleRemoteFill(
    x: number,
    y: number,
    color: string,
    referenceSize: { width: number; height: number } = {
      width: this.virtualWidth,
      height: this.virtualHeight,
    },
  ) {
    const scaleX = this.canvasWidth / referenceSize.width;
    const scaleY = this.canvasHeight / referenceSize.height;
    this.fill(x * scaleX, y * scaleY, color);
  }

  private registerImageCallbacks(stage: Konva.Stage) {
    let currentType: PaintActionType = PaintActionType.Draw;
    let isPainting = false;

    let imageData: ImageData | null = null;
    let previousImageData: ImageData | null = null;
    let currentBoundingBox: BoundingBox | null = null;

    const submitDraw = () => {
      if (imageData != null) {
        this.context.putImageData(imageData, 0, 0);
      }

      this.layer.batchDraw();
    };

    const getCanvasPos = (): [number, number] => {
      const pointer = stage.pointerPos as Vector2d;
      const layerPos = this.layer.getPosition();
      const layerScaleX = this.layer.scaleX() || 1;
      const layerScaleY = this.layer.scaleY() || 1;
      return [
        (pointer.x - layerPos.x) / layerScaleX,
        (pointer.y - layerPos.y) / layerScaleY,
      ];
    };

    const draw = (imageData: ImageData, clicked: boolean = false) => {
      let localPos = getCanvasPos();
      const scaleX = this.virtualWidth / this.canvasWidth;
      const scaleY = this.virtualHeight / this.canvasHeight;
      let networkPos: [number, number] = [
        localPos[0] * scaleX,
        localPos[1] * scaleY,
      ];

      this.pointsBuffer.push(localPos);

      if (this.pointsBuffer.length > this.requiredPoints) {
        let segment = this.getSegmentPoints(this.pointsBuffer);
        if (segment.length == 0) return;
        const networkedSegment = segment.map(
          (p) => [p[0] * scaleX, p[1] * scaleY] as [number, number],
        );
        const networkedBrush: Brush = {
          ...this.currentBrush,
          strokeWidth: this.currentBrush.strokeWidth * scaleX,
        };
        this.networkCallbacks?.onStrokeMove(
          networkedSegment, // Send scaled points
          networkedBrush,
          this.paintMode,
        );
        submitDraw();
        this.pointsBuffer.shift();
      }

      let segment = this.getSegmentPoints(this.pointsBuffer);

      if (clicked) {
        segment.push(localPos);
      }

      if (segment.length == 0) return;

      let newBoundingBox = this.drawPoint(
        segment,
        this.currentBrush,
        this.paintMode,
        imageData,
      );

      if (newBoundingBox == null) return;
      if (currentBoundingBox == null) {
        currentBoundingBox = { ...newBoundingBox };
      } else {
        currentBoundingBox.min[0] = Math.min(
          currentBoundingBox.min[0],
          newBoundingBox.min[0],
        );
        currentBoundingBox.min[1] = Math.min(
          currentBoundingBox.min[1],
          newBoundingBox.min[1],
        );

        currentBoundingBox.max[0] = Math.max(
          currentBoundingBox.max[0],
          newBoundingBox.max[0],
        );
        currentBoundingBox.max[1] = Math.max(
          currentBoundingBox.max[1],
          newBoundingBox.max[1],
        );
      }
    };

    const finish = () => {
      if (this.paintMode == PaintMode.FILL) {
        return;
      }

      if (currentBoundingBox == null) {
        console.error("no bounding box created!");
        return;
      }

      const scaleX = this.virtualWidth / this.canvasWidth;
      const scaleY = this.virtualHeight / this.canvasHeight;
      const networkBoundingBox: BoundingBox = {
        min: [
          currentBoundingBox.min[0] * scaleX,
          currentBoundingBox.min[1] * scaleY,
        ],
        max: [
          currentBoundingBox.max[0] * scaleX,
          currentBoundingBox.max[1] * scaleY,
        ],
      };

      this.networkCallbacks?.onStrokeEnd(networkBoundingBox);

      if (previousImageData == null) {
        console.error("previous image data is NULL!");
        return;
      }

      let startX = Math.floor(currentBoundingBox.min[0]);
      let startY = Math.floor(currentBoundingBox.min[1]);
      let endX = Math.floor(currentBoundingBox.max[0]);
      let endY = Math.floor(currentBoundingBox.max[1]);

      let width = endX - startX;
      let height = endY - startY;

      let previousImage = this.getImageSlice(
        previousImageData,
        startX,
        startY,
        width,
        height,
      );

      submitDraw();

      let afterImage = this.context.getImageData(startX, startY, width, height);
      isPainting = false;

      let paintAction = paintActionDefault();

      paintAction.strokes = {
        afterImage,
        beforeImage: previousImage,
        boundingBox: { ...currentBoundingBox },
      };

      this.undoBuffer.push({
        ...paintAction,
      });

      paintAction = paintActionDefault();
      this.pointsBuffer = [];
    };

    this.image.on("mouseup", () => {
      finish();
    });

    this.image.on("mouseleave", () => {
      if (!isPainting) return;
      if (imageData == null) return;
      draw(imageData);
      finish();
    });

    this.image.on("mousedown", (ev) => {
      // Only left clicks are processed
      if (ev.evt.button != 0) return;

      if (imageData == null || this.hasFilled || this.hasReverted) {
        imageData = this.getImageData();
        this.hasFilled = false;
        this.hasReverted = false;
      }

      if (this.paintMode == PaintMode.FILL) {
        let pos = getCanvasPos();
        const scaleX = this.virtualWidth / this.canvasWidth;
        const scaleY = this.virtualHeight / this.canvasHeight;
        const networkPos: [number, number] = [
          pos[0] * scaleX,
          pos[1] * scaleY,
        ];

        this.fill(pos[0], pos[1], this.currentBrush.color);
        this.networkCallbacks?.onFill(
          networkPos[0],
          networkPos[1],
          this.currentBrush.color,
        );
        return;
      }

      let pos = getCanvasPos();

      const scaleX = this.virtualWidth / this.canvasWidth;
      const scaleY = this.virtualHeight / this.canvasHeight;
      const networkPos: [number, number] = [
        pos[0] * scaleX,
        pos[1] * scaleY,
      ];

      const networkedBrush: Brush = {
        ...this.currentBrush,
        strokeWidth: this.currentBrush.strokeWidth * scaleX,
      };
      this.networkCallbacks?.onStrokeBegin({
        points: [networkPos],
        currentBrush: networkedBrush,
        paintMode: this.paintMode,
      });

      previousImageData = this.context.getImageData(
        0,
        0,
        this.canvasWidth,
        this.canvasHeight,
      );

      currentBoundingBox = null;
      isPainting = true;

      currentType =
        this._paintMode == PaintMode.ERASE
          ? PaintActionType.Erase
          : PaintActionType.Draw;

      this.redoBuffer = [];

      draw(imageData, true);
    });

    this.image.on("mousemove", () => {
      if (!isPainting || imageData == null) return;
      draw(imageData);
    });
  }

  public setNetworkCallbacks(callbacks: NetworkPaintCallbacks) {
    this.networkCallbacks = {
      onStrokeBegin: callbacks.onStrokeBegin,
      onStrokeMove: callbacks.onStrokeMove,
      onStrokeEnd: callbacks.onStrokeEnd,
      onFill: callbacks.onFill,
      onUndo: callbacks.onUndo,
      onRedo: callbacks.onRedo,
    };
  }

  public drawPointsClient(
    points: [number, number][],
    brush: Brush,
    paintMode: PaintMode,
  ) {
    let imageData = this.getImageData();

    if (points.length == 0) return;

    this.drawPoint(points, brush, paintMode, imageData);
    this.context.putImageData(imageData, 0, 0);
    this.layer.batchDraw();
  }

  public clientStartRecordStroke() {
    this.previousClientImageData = this.context.getImageData(
      0,
      0,
      this.canvasWidth,
      this.canvasHeight,
    );
    this.redoBuffer = [];
  }

  public registerUndoClient(boundingBox: BoundingBox) {
    const scaleX = this.canvasWidth / this.virtualWidth;
    const scaleY = this.canvasHeight / this.virtualHeight;

    let startX = Math.floor(boundingBox.min[0] * scaleX);
    let startY = Math.floor(boundingBox.min[1] * scaleY);
    let endX = Math.floor(boundingBox.max[0] * scaleX);
    let endY = Math.floor(boundingBox.max[1] * scaleY);

    startX = Math.max(startX, 0);
    startY = Math.max(startY, 0);
    endX = Math.min(endX, this.canvasWidth);
    endY = Math.min(endY, this.canvasHeight);

    let width = endX - startX;
    let height = endY - startY;

    if (this.previousClientImageData == null) {
      console.warn("Never registered previous pixel data of client");
      return;
    }

    let previousImage = this.getImageSlice(
      this.previousClientImageData,
      startX,
      startY,
      width,
      height,
    );

    let afterImage = this.context.getImageData(startX, startY, width, height);

    let paintAction = paintActionDefault();

    paintAction.strokes = {
      afterImage,
      beforeImage: previousImage,
      boundingBox: {
        min: [startX, startY],
        max: [endX, endY],
      },
    };

    this.undoBuffer.push({
      ...paintAction,
    });
  }

  public setPaintMode(mode: PaintMode) {
    this._paintMode = mode;
  }

  public scale(factor: number) {
    this.layer.scale({ x: factor, y: factor });
    this.layer.batchDraw();
  }

  // Resizes the backing canvas to new display pixel dimensions. The virtual
  // coordinate space is unchanged, so in-flight network strokes still map
  // correctly. Existing pixels are rescaled into the new canvas; undo/redo
  // history is cleared because its bounding boxes are in the old pixel space.
  public resize(newWidth: number, newHeight: number) {
    if (newWidth <= 0 || newHeight <= 0) return;
    if (newWidth === this.canvasWidth && newHeight === this.canvasHeight) {
      return;
    }

    const oldWidth = this.canvasWidth;
    const oldHeight = this.canvasHeight;

    const snapshot = document.createElement("canvas");
    snapshot.width = oldWidth;
    snapshot.height = oldHeight;
    const snapshotCtx = snapshot.getContext("2d");
    if (snapshotCtx) {
      snapshotCtx.drawImage(this.canvas, 0, 0);
    }

    this.canvas.width = newWidth;
    this.canvas.height = newHeight;

    this.context.fillStyle = "#ffffff";
    this.context.fillRect(0, 0, newWidth, newHeight);

    if (snapshotCtx) {
      this.context.imageSmoothingEnabled = false;
      this.context.drawImage(
        snapshot,
        0, 0, oldWidth, oldHeight,
        0, 0, newWidth, newHeight,
      );
    }

    this.canvasWidth = newWidth;
    this.canvasHeight = newHeight;

    this.image.width(newWidth);
    this.image.height(newHeight);

    this.undoBuffer = [];
    this.redoBuffer = [];
    this.previousClientImageData = null;
    this.pointsBuffer = [];

    this.layer.batchDraw();
  }

  private getImageData() {
    return this.context.getImageData(0, 0, this.canvasWidth, this.canvasHeight);
  }

  private getImageSlice(
    previousImage: ImageData,
    srcX: number,
    srcY: number,
    srcWidth: number,
    srcHeight: number,
  ): ImageData {
    let startX = Math.floor(srcX);
    let startY = Math.floor(srcY);

    let imageData = this.context.createImageData(srcWidth, srcHeight);

    const rowBytes = srcWidth * 4;
    for (let y = 0; y < srcHeight; ++y) {
      const srcStart = ((startY + y) * this.canvasWidth + startX) * 4;
      const dstStart = y * srcWidth * 4;
      imageData.data.set(
        previousImage.data.subarray(srcStart, srcStart + rowBytes),
        dstStart,
      );
    }

    return imageData;
  }

  get paintMode() {
    return this._paintMode;
  }

  get brushColor() {
    return this.currentBrush.color;
  }

  get brushStrokeWidth() {
    return this.currentBrush.strokeWidth;
  }

  setBrush(brush: Brush) {
    this.currentBrush = brush;
  }

  setBrushColor(color: string) {
    this.currentBrush.color = color;
  }

  setBrushStrokeWidth(strokeWidth: number) {
    if (strokeWidth <= 0) {
      console.error(
        `Trying to update strokeWidth with ${strokeWidth} which doesn't make sense.`,
      );
      return;
    }
    this.currentBrush.strokeWidth = strokeWidth;
  }

  private clear(image?: ImageData) {
    let imageData = image ?? this.getImageData();

    for (let i = 0; i < this.canvasWidth * this.canvasHeight; ++i) {
      let index = i * 4;
      imageData.data[index] = 255;
      imageData.data[index + 1] = 255;
      imageData.data[index + 2] = 255;
      imageData.data[index + 3] = 255;
    }

    if (image) return;

    this.context.putImageData(imageData, 0, 0);
    this.layer.batchDraw();
  }

  private hexToRGB(hex: string) {
    return [
      parseInt(hex.substring(1, 3), 16),
      parseInt(hex.substring(3, 5), 16),
      parseInt(hex.substring(5, 7), 16),
      255,
    ];
  }

  private drawPixel(point: [number, number], color: string, image: ImageData) {
    let colorRGB = this.hexToRGB(color);
    let width = this.canvasWidth;
    let height = this.canvasHeight;

    let y = Math.floor(point[1]);
    let x = Math.floor(point[0]);

    if (x < 0 || x >= width) return;
    if (y < 0 || y >= height) return;

    let index = (y * width + x) * 4;

    image.data[index] = colorRGB[0];
    image.data[index + 1] = colorRGB[1];
    image.data[index + 2] = colorRGB[2];
    image.data[index + 3] = 255;
  }

  /*
    Based on: https://stackoverflow.com/questions/1201200/fast-algorithm-for-drawing-filled-circles
    (AlexGeorg)
  */
  private drawCircle(
    point: [number, number],
    radius: number,
    color: string,
    image: ImageData,
  ) {
    for (let x = -radius; x < radius; ++x) {
      let hh = Math.sqrt(radius * radius - x * x);

      let rx = point[0] + x;
      let ph = point[1] + hh;

      for (let y = point[1] - hh; y <= ph; ++y) {
        if (rx < 0 || y < 0) continue;
        this.drawPixel([rx, y], color, image);
      }
    }
  }

  private getSegmentPoints(points: [number, number][]): [number, number][] {
    if (points.length < this.requiredPoints) return [];

    const interp = new CurveInterpolator(points, { tension: 0, alpha: 0.5 });

    const segments = 100;

    return interp.getPoints(segments);
  }

  private drawSegment(
    segment: [number, number][],
    radius: number,
    color: string,
    image: ImageData,
  ) {
    for (let point of segment) {
      this.drawCircle(point, radius, color, image);
    }
  }

  private drawPoint(
    points: [number, number][],
    brush: Brush,
    paintMode: PaintMode,
    image: ImageData,
  ): BoundingBox | null {
    if (points.length == 0) {
      console.warn("Trying to draw point with 0 points?");
      return null;
    }

    let color = paintMode == PaintMode.ERASE ? "#ffffff" : brush.color;

    let radius = brush.strokeWidth;

    // The radius of the circle drawn doesn't always match
    // the stroke width leading to noticeable bulges at the tip
    // of lines. Halving the radius is arbitrary, but fixes the problem
    // while still being able to draw dots.
    if (radius > 1) {
      radius /= 2;
    }

    let boundingBox: BoundingBox = {
      min: [Math.floor(points[0][0]), Math.floor(points[0][1])],
      max: [Math.floor(points[0][0]), Math.floor(points[0][1])],
    };

    // Subtracting radius alone does not account for all pixels drawn.
    // Use BIAS to widen bounding box, but keep it as small as possible as to not store excessive
    // information.
    const BIAS = 5;

    for (let point of points) {
      boundingBox.min[0] = Math.min(
        boundingBox.min[0],
        Math.floor(point[0] - radius - BIAS),
      );
      boundingBox.min[1] = Math.min(
        boundingBox.min[1],
        Math.floor(point[1] - radius - BIAS),
      );

      boundingBox.min[0] = Math.max(boundingBox.min[0], 0);
      boundingBox.min[1] = Math.max(boundingBox.min[1], 0);

      boundingBox.max[0] = Math.max(
        boundingBox.max[0],
        Math.floor(point[0] + radius + BIAS),
      );
      boundingBox.max[1] = Math.max(
        boundingBox.max[1],
        Math.floor(point[1] + radius + BIAS),
      );

      boundingBox.max[0] = Math.min(boundingBox.max[0], this.canvasWidth);
      boundingBox.max[1] = Math.min(boundingBox.max[1], this.canvasHeight);
    }

    this.drawCircle(points[0], radius, color, image);

    if (points.length > 1) {
      this.drawSegment(points, radius, color, image);
    }

    return boundingBox;
  }

  private recreateBuffer(action: PaintAction, isUndo: boolean) {
    let strokes = action.strokes;

    if (isUndo) {
      if (strokes.beforeImage == null) {
        console.error("Before image shouldn't be NULL!");
        return;
      }
      this.context.putImageData(
        strokes.beforeImage,
        strokes.boundingBox.min[0],
        strokes.boundingBox.min[1],
      );
    } else {
      if (strokes.afterImage == null) {
        console.error("After image shouldn't be NULL!");
        return;
      }
      this.context.putImageData(
        strokes.afterImage,
        strokes.boundingBox.min[0],
        strokes.boundingBox.min[1],
      );
    }

    this.hasReverted = true;
  }

  // Recreates the art canvas by going through undo buffer
  // and sending the last item of the undo buffer into
  // the redo buffer
  undo() {
    if (this.undoBuffer.length == 0) return;

    this.networkCallbacks?.onUndo();

    let lastAction = this.undoBuffer.pop() as PaintAction;
    this.redoBuffer.push(lastAction);

    this.recreateBuffer(lastAction, true);

    this.layer.batchDraw();
  }

  redo() {
    if (this.redoBuffer.length == 0) return;

    this.networkCallbacks?.onRedo();

    let lastAction = this.redoBuffer.pop() as PaintAction;
    this.undoBuffer.push(lastAction);

    this.recreateBuffer(lastAction, false);

    this.layer.batchDraw();
  }

  fill(x: number, y: number, newColor: string) {
    let width = this.canvasWidth;
    let height = this.canvasHeight;

    const isValidCoord = (x: number, y: number) => {
      return x >= 0 && x < width && y >= 0 && y < height;
    };

    if (!isValidCoord(x, y)) {
      console.warn(`Passing in invalid coordinates: ${x}${y}`);
      return;
    }

    let imageData = this.getImageData();
    this.context.imageSmoothingEnabled = false;

    const isSameColor = (a: number[], b: number[], tolerance: number) => {
      const dr = Math.abs(a[0] - b[0]);
      const dg = Math.abs(a[1] - b[1]);
      const db = Math.abs(a[2] - b[2]);
      let res = dr * dr + dg * dg + db * db <= tolerance * tolerance;
      return res;
    };

    const getPixelColor = (x: number, y: number) => {
      let i = (y * width + x) * 4;
      return [
        imageData.data[i],
        imageData.data[i + 1],
        imageData.data[i + 2],
        imageData.data[i + 3],
      ];
    };

    const newColorRGB = this.hexToRGB(newColor);

    let oldColorRGB = getPixelColor(Math.floor(x), Math.floor(y));
    if (isSameColor(newColorRGB, oldColorRGB, 0)) {
      return;
    }

    const getSpan = (x: number, y: number) => {
      let start = 0;
      let end = width - 1;
      for (let startX = x; startX < width; ++startX) {
        const currentColorRGB = getPixelColor(startX, y);
        if (!isSameColor(currentColorRGB, oldColorRGB, 0)) {
          end = startX - 1;
          break;
        }
      }
      for (let startX = x; startX >= 0; --startX) {
        const currentColorRGB = getPixelColor(startX, y);
        if (!isSameColor(currentColorRGB, oldColorRGB, 0)) {
          start = startX + 1;
          break;
        }
      }
      return [start, end, y];
    };

    let pixel_span: Array<[number, number]> = [];
    pixel_span.push([Math.floor(x), Math.floor(y)]);

    const checkPixelForSpan = (x: number, y: number, isInsideSpan: boolean) => {
      if (!isValidCoord(x, y)) {
        return [false, x];
      }

      let topPixelColor = getPixelColor(x, y);
      if (isSameColor(topPixelColor, oldColorRGB, 0) && !isInsideSpan) {
        let adjacentSpan = getSpan(x, y);
        pixel_span.push([x, y]);
        return [true, adjacentSpan[1]];
      }

      return [false, x];
    };

    let fillBoundingBox: BoundingBox = {
      min: [Math.floor(x), Math.floor(y)],
      max: [Math.floor(x), Math.floor(y)],
    };

    // Used to extend the boundaries on the max edges of the
    // bounding box
    const MAX_BIAS = 5;

    while (pixel_span.length > 0) {
      let currentPixelCoord = pixel_span.pop() as [number, number];

      let currentSpan = getSpan(currentPixelCoord[0], currentPixelCoord[1]);

      // Used for checking adjacent rows to current row filled
      let isInsideSpan = false;

      let currentY = currentSpan[2];

      fillBoundingBox.min[0] = Math.min(fillBoundingBox.min[0], currentSpan[0]);
      fillBoundingBox.min[1] = Math.min(fillBoundingBox.min[1], currentY);

      fillBoundingBox.max[0] = Math.max(
        fillBoundingBox.max[0],
        currentSpan[1] + MAX_BIAS,
      );
      fillBoundingBox.max[0] = Math.min(fillBoundingBox.max[0], width);
      fillBoundingBox.max[1] = Math.max(
        fillBoundingBox.max[1],
        currentY + MAX_BIAS,
      );
      fillBoundingBox.max[1] = Math.min(fillBoundingBox.max[1], height);

      // Check above

      for (
        let currentX = currentSpan[0];
        currentX <= currentSpan[1];
        ++currentX
      ) {
        let state = checkPixelForSpan(currentX, currentY - 1, isInsideSpan);
        isInsideSpan = state[0] as boolean;
        let newX = state[1] as number;
        if (newX < currentX) continue;
        currentX = newX;
      }

      isInsideSpan = false;

      // Check below

      for (
        let currentX = currentSpan[0];
        currentX <= currentSpan[1];
        ++currentX
      ) {
        let state = checkPixelForSpan(currentX, currentY + 1, isInsideSpan);
        isInsideSpan = state[0] as boolean;
        let newX = state[1] as number;
        if (newX < currentX) continue;
        currentX = newX;
      }

      // Fill in current span

      for (
        let currentX = currentSpan[0];
        currentX <= currentSpan[1];
        ++currentX
      ) {
        let i = (currentY * width + currentX) * 4;

        imageData.data[i] = newColorRGB[0];
        imageData.data[i + 1] = newColorRGB[1];
        imageData.data[i + 2] = newColorRGB[2];
        imageData.data[i + 3] = 255;
      }
    }

    let minX = Math.floor(fillBoundingBox.min[0]);
    let minY = Math.floor(fillBoundingBox.min[1]);
    let maxX = Math.floor(fillBoundingBox.max[0]);
    let maxY = Math.floor(fillBoundingBox.max[1]);
    let bbWidth = maxX - minX;
    let bbHeight = maxY - minY;

    let beforeImage = this.context.getImageData(minX, minY, bbWidth, bbHeight);

    this.context.putImageData(imageData, 0, 0);

    let afterImage = this.context.getImageData(minX, minY, bbWidth, bbHeight);

    this.layer.batchDraw();
    this.hasFilled = true;

    let fillAction: PaintAction = {
      strokes: {
        beforeImage,
        afterImage,
        boundingBox: fillBoundingBox,
      },
      type: PaintActionType.Fill,
    };

    this.redoBuffer = [];
    this.undoBuffer.push(fillAction);
  }

  public getCanvasSnapshot(): string {
    return this.canvas.toDataURL("image/png");
  }


  public async applyCanvasSnapshot(dataUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.context.drawImage(img, 0, 0);
        this.layer.batchDraw();
        resolve();
      };
      img.onerror = () => {
        reject(new Error("Failed to load snapshot"));
      };
      img.src = dataUrl;
    });
  }

}
