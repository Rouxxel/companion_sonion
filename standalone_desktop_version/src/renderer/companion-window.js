(() => {
  "use strict";

  /** @typedef {{ locked?: boolean, assetUrl?: string, opacity?: number }} CompanionState */
  /** @typedef {{
   * moveBy?: (delta: { x: number, y: number }) => Promise<void> | void,
   * resize?: (delta: number) => Promise<void> | void,
   * setHoverOpacity?: (opacity: number) => Promise<void> | void,
   * toggleLock?: () => Promise<CompanionState | void> | CompanionState | void,
   * remove?: () => Promise<void> | void,
   * chooseLocalAsset?: () => Promise<CompanionState | void> | CompanionState | void,
   * setAssetUrl?: (url: string) => Promise<CompanionState | void> | CompanionState | void,
   * clearLocalAsset?: () => Promise<CompanionState | void> | CompanionState | void,
   * bringToFront?: () => Promise<void> | void,
   * reportAssetError?: () => Promise<CompanionState | void> | CompanionState | void,
   * onState?: (listener: (state: CompanionState) => void) => (() => void) | void
   * }} CompanionBridge */

  /** @type {CompanionBridge} */
  const bridge = window.companion || {};
  const main = document.querySelector("main");
  const image = document.querySelector("#companion-image");
  const video = document.querySelector("#companion-video");
  const menu = document.querySelector("#context-menu");
  const urlDialog = document.querySelector("#url-dialog");
  const urlInput = document.querySelector("#asset-url");
  const urlError = document.querySelector("#url-error");
  const lockButton = document.querySelector('[data-action="toggle-lock"]');

  let locked = false;
  let dragging = false;
  let lastPointer = null;
  let menuOpen = false;

  const call = async (name, ...args) => {
    const method = bridge[name];
    if (typeof method !== "function") return undefined;
    return method(...args);
  };

  const applyState = (state) => {
    if (!state) return;
    if (typeof state.locked === "boolean") locked = state.locked;
    main.classList.toggle("locked", locked);
    lockButton.textContent = locked ? "Unlock position" : "Lock position";
    if (typeof state.assetUrl === "string" && state.assetUrl) setAsset(state.assetUrl);
    if (typeof state.opacity === "number") {
      image.style.opacity = String(state.opacity);
      video.style.opacity = String(state.opacity);
    }
  };

  const setAsset = (assetPath) => {
    const isWebm = /\.webm(?:[?#]|$)/i.test(assetPath);
    const currentSrc = isWebm ? video.src : image.src;
    // Skip if asset hasn't changed to avoid re-triggering load/aspect-ratio events
    if (currentSrc === assetPath) return;
    image.hidden = isWebm;
    video.hidden = !isWebm;
    if (isWebm) {
      video.src = assetPath;
      void video.play().catch(() => undefined);
    } else {
      image.src = assetPath;
      video.removeAttribute("src");
      video.load();
    }
  };

  const hideMenu = () => {
    menu.hidden = true;
    menuOpen = false;
    void call("restoreSize");
  };

  const hideUrlDialog = () => {
    urlDialog.hidden = true;
    urlError.hidden = true;
    urlError.textContent = "";
  };

  const showUrlDialog = () => {
    hideMenu();
    const currentSource = video.hidden ? image.src : video.src;
    urlInput.value = currentSource.startsWith("http") ? currentSource : "";
    urlDialog.hidden = false;
    urlInput.focus();
  };

  const showMenu = (event) => {
    event.preventDefault();
    hideUrlDialog();
    // If menu is already open, just reposition it without expanding again
    if (menuOpen) {
      const margin = 4;
      menu.style.left = `${Math.max(margin, Math.min(event.clientX, window.innerWidth - menu.offsetWidth - margin))}px`;
      menu.style.top = `${Math.max(margin, Math.min(event.clientY, window.innerHeight - menu.offsetHeight - margin))}px`;
      return;
    }
    // Temporarily expand window so the menu isn't clipped
    const menuWidth = 180;
    const menuHeight = 260;
    const neededWidth = Math.max(window.innerWidth, event.clientX + menuWidth + 8);
    const neededHeight = Math.max(window.innerHeight, event.clientY + menuHeight + 8);
    if (neededWidth > window.innerWidth || neededHeight > window.innerHeight) {
      void call("expandForMenu", { width: Math.ceil(neededWidth), height: Math.ceil(neededHeight) });
    }
    const margin = 4;
    menu.hidden = false;
    menu.style.left = `${Math.max(margin, Math.min(event.clientX, neededWidth - menuWidth - margin))}px`;
    menu.style.top = `${Math.max(margin, Math.min(event.clientY, neededHeight - menuHeight - margin))}px`;
    menuOpen = true;
  };

  main.addEventListener("pointerdown", async (event) => {
    if (event.button !== 0 || menuOpen || !urlDialog.hidden) return;
    await call("bringToFront");
    if (locked) return;
    dragging = true;
    lastPointer = { x: event.screenX, y: event.screenY };
    main.classList.add("dragging");
    main.setPointerCapture(event.pointerId);
  });

  main.addEventListener("pointermove", (event) => {
    if (!dragging || !lastPointer) return;
    const next = { x: event.screenX, y: event.screenY };
    const delta = { x: next.x - lastPointer.x, y: next.y - lastPointer.y };
    lastPointer = next;
    if (delta.x || delta.y) void call("moveBy", delta);
  });

  const endDrag = (event) => {
    if (!dragging) return;
    dragging = false;
    lastPointer = null;
    main.classList.remove("dragging");
    if (main.hasPointerCapture(event.pointerId)) main.releasePointerCapture(event.pointerId);
  };
  main.addEventListener("pointerup", endDrag);
  main.addEventListener("pointercancel", endDrag);

  main.addEventListener("wheel", (event) => {
    if (locked || menuOpen || !urlDialog.hidden) return;
    event.preventDefault();
    void call("resize", event.deltaY < 0 ? 12 : -12);
  }, { passive: false });

  const setHoverOpacity = (opacity) => {
    image.style.opacity = String(opacity);
    video.style.opacity = String(opacity);
    void call("setHoverOpacity", opacity);
  };
  main.addEventListener("mouseenter", () => { if (!menuOpen) setHoverOpacity(0.3); });
  main.addEventListener("mouseleave", () => { if (!dragging) setHoverOpacity(1); });
  main.addEventListener("contextmenu", showMenu);
  image.addEventListener("error", () => void call("reportAssetError"));
  video.addEventListener("error", () => void call("reportAssetError"));

  image.addEventListener("load", () => {
    const nw = image.naturalWidth;
    const nh = image.naturalHeight;
    if (nw && nh) void call("reportAspectRatio", { width: nw, height: nh });
  });

  video.addEventListener("loadedmetadata", () => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw && vh) void call("reportAspectRatio", { width: vw, height: vh });
  });

  menu.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    hideMenu();
    if (action === "toggle-lock") applyState(await call("toggleLock"));
    if (action === "bring-to-front") await call("bringToFront");
    if (action === "change-url") showUrlDialog();
    if (action === "import-local") applyState(await call("chooseLocalAsset"));
    if (action === "clear-local") applyState(await call("clearLocalAsset"));
    if (action === "delete") await call("remove");
    if (action === "close-menu") { /* already hidden by hideMenu() above */ }
  });

  urlDialog.addEventListener("submit", async (event) => {
    event.preventDefault();
    const url = urlInput.value.trim();
    try {
      new URL(url);
      applyState(await call("setAssetUrl", url));
      hideUrlDialog();
    } catch {
      urlError.textContent = "Enter a valid absolute URL.";
      urlError.hidden = false;
    }
  });

  document.querySelector('[data-action="cancel-url"]').addEventListener("click", hideUrlDialog);

  document.addEventListener("click", (event) => {
    if (menuOpen && !menu.contains(event.target)) hideMenu();
  });

  document.addEventListener("keydown", async (event) => {
    if (event.key === "Escape") { hideMenu(); hideUrlDialog(); return; }
    if (!urlDialog.hidden) return;
    if (event.key === "Delete") { event.preventDefault(); await call("remove"); }
    if (event.key.toLowerCase() === "l") applyState(await call("toggleLock"));
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") { event.preventDefault(); applyState(await call("chooseLocalAsset")); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "u") { event.preventDefault(); showUrlDialog(); }
  });

  if (typeof bridge.onState === "function") bridge.onState(applyState);
  void call("getState").then(applyState);
  applyState({ locked: false });
})();
