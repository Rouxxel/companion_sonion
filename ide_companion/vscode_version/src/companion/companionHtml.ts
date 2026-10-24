import { RenderMode, SIZE_LIMITS, SIZE_STEP } from './constants';
import { diffCompanions } from './renderDiff';

/**
 * Shared companion renderer.
 * Both the WebviewPanel (panel mode) and the Explorer WebviewViewProvider
 * (explorer mode) use this function to produce the HTML that renders
 * companions inside their respective webview containers.
 */
export function getCompanionHtml(mode: RenderMode): string {
    const isExplorer = mode === 'explorer';
    const limits = SIZE_LIMITS[mode];

    return `
    <!DOCTYPE html>
    <html>
    <body style="margin:0; overflow:hidden;" data-mode="${mode}">

        <style>
            #world {
                position: relative;
                width: 100vw;
                height: 100vh;
            }

            /* Wrapper per companion: positioned, receives all pointer events */
            .companion {
                position: absolute;
                user-select: none;
                cursor: grab;
            }

            .companion > .media {
                display: block;
                width: 100%;
                pointer-events: none;
                -webkit-user-drag: none;
            }

            .companion.hovered {
                opacity: 0.3;
            }

            .companion.dragging {
                cursor: grabbing;
            }

            .companion.locked {
                cursor: not-allowed;
            }

            /* Fallback animations for states without their own asset */
            .companion.css-anim[data-state="typing"] > .media {
                animation: companion-bob 0.3s ease-in-out infinite alternate;
            }

            .companion.css-anim[data-state="excited"] > .media {
                animation: companion-bounce 0.45s ease-in-out infinite;
            }

            .companion.css-anim[data-state="reacting"] > .media {
                animation: companion-shake 0.5s ease-in-out 1;
            }

            .companion.css-anim[data-state="sleeping"] > .media {
                animation: companion-breathe 3s ease-in-out infinite;
                filter: grayscale(0.6) brightness(0.8);
            }

            .companion.css-anim[data-state="sleeping"]::after {
                content: 'z z';
                position: absolute;
                top: -1.2em;
                right: 0;
                font: italic bold 14px sans-serif;
                color: var(--vscode-foreground, #888);
                animation: companion-float 2.5s ease-in-out infinite;
                pointer-events: none;
            }

            @keyframes companion-bob {
                from { transform: translateY(0); }
                to { transform: translateY(-2px); }
            }

            @keyframes companion-bounce {
                0%, 100% { transform: translateY(0) scale(1); }
                50% { transform: translateY(-8%) scale(1.05); }
            }

            @keyframes companion-shake {
                0%, 100% { transform: translateX(0); }
                20%, 60% { transform: translateX(-4%) rotate(-3deg); }
                40%, 80% { transform: translateX(4%) rotate(3deg); }
            }

            @keyframes companion-breathe {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(0.97); }
            }

            @keyframes companion-float {
                0%, 100% { transform: translateY(0); opacity: 0.6; }
                50% { transform: translateY(-4px); opacity: 1; }
            }

            @media (prefers-reduced-motion: reduce) {
                .companion.css-anim > .media,
                .companion.css-anim::after {
                    animation: none !important;
                }
            }
        </style>

        <div id="world"></div>

        <script>
            const vscode = acquireVsCodeApi();
            const world = document.getElementById('world');
            const MODE = document.body.dataset.mode; // 'panel' | 'explorer'
            const CLAMP_TO_VIEW = ${isExplorer};
            const SIZE_MIN = ${limits.min};
            const SIZE_MAX = ${limits.max};
            const SIZE_STEP = ${SIZE_STEP};

            ${diffCompanions.toString()}

            // Rendered companions in render order, and id -> { data, el, media, src, kind }
            let companions = [];
            const entries = new Map();
            let animationsEnabled = true;
            // Render received while dragging; applied on mouseup
            let pendingRender = null;

            const dragState = {
                entry: null,
                offsetX: 0,
                offsetY: 0
            };

            window.addEventListener('message', event => {
                const msg = event.data;
                if (msg.command === 'render') {
                    if (msg.animations !== undefined && msg.animations !== animationsEnabled) {
                        animationsEnabled = msg.animations;
                        entries.forEach(applyVisual);
                    }
                    if (dragState.entry) {
                        pendingRender = msg.companions;
                    } else {
                        applyRender(msg.companions);
                    }
                }
                if (msg.command === 'state') {
                    const entry = entries.get(msg.id);
                    if (!entry) return;
                    entry.data.state = msg.state;
                    applyVisual(entry);
                }
            });

            // Tell the extension the user is here (wakes sleeping companions); at most once per second
            let lastActivity = 0;
            function reportActivity() {
                const now = Date.now();
                if (now - lastActivity < 1000) return;
                lastActivity = now;
                vscode.postMessage({ command: 'activity' });
            }

            // Own asset for the current state, if the companion has one
            function stateVisual(c) {
                return c.state && c.stateVisuals ? c.stateVisuals[c.state] || null : null;
            }

            // Asset shown for the current state; falls back to the base asset
            function visualFor(c) {
                return stateVisual(c) || { src: c.assetPath, kind: c.assetKind || 'image' };
            }

            function createMedia(kind) {
                const media = document.createElement(kind === 'video' ? 'video' : 'img');
                if (kind === 'video') {
                    media.autoplay = true;
                    media.loop = true;
                    media.muted = true;
                    media.playsInline = true;
                    media.setAttribute('playsinline', '');
                }
                media.className = 'media';
                media.draggable = false;
                return media;
            }

            function applyVisual(entry) {
                const c = entry.data;
                const v = visualFor(c);

                if (c.state && c.state !== 'idle') {
                    entry.el.dataset.state = c.state;
                } else {
                    delete entry.el.dataset.state;
                }
                entry.el.classList.toggle('css-anim', animationsEnabled && !stateVisual(c));

                if (v.kind !== entry.kind) {
                    // img <-> video: replace only the media element
                    const media = createMedia(v.kind);
                    if (entry.media) {
                        entry.media.replaceWith(media);
                    } else {
                        entry.el.appendChild(media);
                    }
                    entry.media = media;
                    entry.kind = v.kind;
                    entry.src = null;
                }
                if (v.src !== entry.src) {
                    entry.media.src = v.src;
                    entry.src = v.src;
                }
            }

            function layout(entry) {
                const c = entry.data;
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;

                // Convert percentage to pixels
                let pixelX = c.x * windowWidth;
                let pixelY = c.y * windowHeight;

                if (CLAMP_TO_VIEW) {
                    // Explorer mode: clamp positions so companion stays in view
                    const maxX = Math.max(0, windowWidth - c.size);
                    const maxY = Math.max(0, windowHeight - c.size);
                    pixelX = Math.max(0, Math.min(pixelX, maxX));
                    pixelY = Math.max(0, Math.min(pixelY, maxY));
                }

                entry.el.style.left = pixelX + 'px';
                entry.el.style.top = pixelY + 'px';
                entry.el.style.width = c.size + 'px';
                entry.el.classList.toggle('locked', !!c.locked);
            }

            function applyRender(next) {
                const diff = diffCompanions(companions, next);

                diff.removed.forEach(id => {
                    const entry = entries.get(id);
                    if (entry) {
                        entry.el.remove();
                        entries.delete(id);
                    }
                });

                diff.added.forEach(c => {
                    const el = document.createElement('div');
                    el.className = 'companion';
                    const entry = { data: c, el, media: null, src: null, kind: null };
                    attachListeners(el, c.id);
                    entries.set(c.id, entry);
                    world.appendChild(el);
                    applyVisual(entry);
                    layout(entry);
                });

                diff.updated.forEach(c => {
                    const entry = entries.get(c.id);
                    if (!entry) return;
                    entry.data = c;
                    applyVisual(entry);
                    layout(entry);
                });

                companions = next;
            }

            function attachListeners(el, id) {
                el.addEventListener('mousedown', (e) => {
                    reportActivity();
                    const entry = entries.get(id);
                    if (!entry || entry.data.locked || e.button !== 0) return;
                    e.preventDefault();

                    dragState.entry = entry;
                    dragState.offsetX = e.clientX - entry.el.offsetLeft;
                    dragState.offsetY = e.clientY - entry.el.offsetTop;
                    entry.el.classList.add('dragging');
                });

                el.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    const entry = entries.get(id);
                    if (!entry) return;

                    const size = Math.max(SIZE_MIN, Math.min(SIZE_MAX, entry.data.size + (e.deltaY < 0 ? SIZE_STEP : -SIZE_STEP)));
                    if (size === entry.data.size) return;

                    vscode.postMessage({
                        command: 'resize',
                        id,
                        size
                    });
                }, { passive: false });

                el.addEventListener('contextmenu', (e) => {
                    e.preventDefault();

                    vscode.postMessage({
                        command: 'contextMenu',
                        id
                    });
                });

                el.addEventListener('dblclick', (e) => {
                    e.preventDefault();

                    vscode.postMessage({
                        command: 'delete',
                        id
                    });
                });

                el.addEventListener('mouseenter', () => {
                    reportActivity();
                    el.classList.add('hovered');
                });

                el.addEventListener('mouseleave', () => {
                    el.classList.remove('hovered');
                });
            }

            document.addEventListener('mousemove', (e) => {
                const entry = dragState.entry;
                if (!entry) return;

                let newX = e.clientX - dragState.offsetX;
                let newY = e.clientY - dragState.offsetY;

                if (CLAMP_TO_VIEW) {
                    // Explorer mode: clamp to viewport
                    const maxW = window.innerWidth - entry.el.offsetWidth;
                    const maxH = window.innerHeight - entry.el.offsetHeight;
                    newX = Math.max(0, Math.min(newX, maxW));
                    newY = Math.max(0, Math.min(newY, maxH));
                }

                entry.el.style.left = newX + 'px';
                entry.el.style.top = newY + 'px';
            });

            document.addEventListener('mouseup', () => {
                const entry = dragState.entry;
                if (!entry) return;

                entry.el.classList.remove('dragging');

                // Convert pixel position back to percentage
                const percentX = parseFloat(entry.el.style.left) / window.innerWidth;
                const percentY = parseFloat(entry.el.style.top) / window.innerHeight;

                // Keep local data in sync so a re-layout before the next render doesn't jump back
                entry.data.x = percentX;
                entry.data.y = percentY;

                vscode.postMessage({
                    command: 'savePosition',
                    id: entry.data.id,
                    x: percentX,
                    y: percentY
                });

                dragState.entry = null;

                if (pendingRender) {
                    // The queued render predates this drag; keep the dropped position
                    const next = pendingRender.map(c => c.id === entry.data.id ? Object.assign({}, c, { x: percentX, y: percentY }) : c);
                    pendingRender = null;
                    applyRender(next);
                }
            });

            if (CLAMP_TO_VIEW) {
                // Resize observer: reflow companions when sidebar is resized
                const resizeObserver = new ResizeObserver(() => {
                    if (!dragState.entry) {
                        entries.forEach(layout);
                    }
                });
                resizeObserver.observe(document.body);
            }
        </script>
    </body>
    </html>
    `;
}
