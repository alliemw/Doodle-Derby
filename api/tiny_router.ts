import { Page } from "./page"

let currentPage: Page | null = null

let pages: Map<string, Page> = new Map();

const FADE_MS = 200;

export function addPage(relativePath: string, page: Page) {
  pages.set(relativePath, page);
}

export function getPage(relativepath: string): Page | null {
  return pages.get(relativepath) || null;
}

export async function routerNavigate(relativePath: string) {
  if (!pages.has(relativePath)) {
    console.error(`${relativePath} could not be found, therefore can't switch!`);
    return;
  }

  const app = document.getElementById("app") as HTMLDivElement;
  const next = pages.get(relativePath) as Page;

  const swap = () => {
    if (currentPage?.onEnd) {
      currentPage.onEnd();
    }
    currentPage = next;
    if (relativePath === "/") {
      history.replaceState(null, "", "/");
    }
    next.render(app);
  };

  if (!currentPage) {
    swap();
    return;
  }

  // Snapshot the old page and fade it out on top while the new page renders underneath.
  const snapshot = app.cloneNode(true) as HTMLDivElement;
  snapshot.removeAttribute("id");
  Object.assign(snapshot.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: "9998",
    opacity: "1",
    transition: `opacity ${FADE_MS}ms ease`,
  });
  document.body.appendChild(snapshot);

  swap();

  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  snapshot.style.opacity = "0";
  await new Promise<void>((resolve) => setTimeout(resolve, FADE_MS));
  snapshot.remove();
}
