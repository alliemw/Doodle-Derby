import { createSignal } from "solid-js";
import "../../style/prompt-selection.css";

export interface PromptButtonProps {
  defaultImg: string;
  hoverImg?: string;
  onClick: () => void;
  text: string;
  id?: string;
  textColor?: string;
  /** Pixels of the source image to preserve as un-stretched corners. */
  borderSlice?: number;
  /** Rendered border thickness in CSS px. Defaults to borderSlice. */
  borderWidth?: number;
}

export function PromptButton(props: PromptButtonProps) {
  const [isHovered, setIsHovered] = createSignal(false);
  const currentImg = () =>
    isHovered() && props.hoverImg ? props.hoverImg : props.defaultImg;
  const slice = () => props.borderSlice ?? 24;
  const borderWidth = () => props.borderWidth ?? slice();

  return (
    <button
      id={props.id}
      class="prompt-btn"
      onClick={props.onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        "border-image-source": `url(${currentImg()})`,
        "border-image-slice": `${slice()} fill`,
        "border-image-width": `${borderWidth()}px`,
        "border-width": `${borderWidth()}px`,
      }}
    >
      <span
        class="prompt-btn__text"
        style={{ "--text-color": props.textColor || "inherit" }}
      >
        {props.text}
      </span>
    </button>
  );
}
