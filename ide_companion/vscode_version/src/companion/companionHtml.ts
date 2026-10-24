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

            .companion {
                position: absolute;
                -webkit-user-drag: none;
                user-select: none;
                cursor: grab;
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

            // Rendered companions in render order, and id -> { data, el, src, kind }
            let companions = [];
            const entries = new Map();
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

            // Asset shown for the current state; falls back to the base asset
            function visualFor(c) {
                const v = c.state && c.stateVisuals ? c.stateVisuals[c.state] : null;
                return v || { src: c.assetPath, kind: c.assetKind || 'image' };
            }

            function createElement(kind) {
                const el = document.createElement(kind === 'video' ? 'video' : 'img');
                if (kind === 'video') {
                    el.autoplay = true;
                    el.loop = true;
                    el.muted = true;
                    el.playsInline = true;
                    el.setAttribute('playsinline', '');
                }
                el.className = 'companion';
                el.draggable = false;
                return el;
            }

            function applyVisual(entry) {
                const v = visualFor(entry.data);
                if (entry.state !== entry.data.state) {
                    entry.state = entry.data.state;
                    if (entry.data.state) {
                        entry.el.dataset.state = entry.data.state;
                    } else {
                        delete entry.el.dataset.state;
                    }
                }
                if (v.kind !== entry.kind) {
                    // img <-> video: replace the node in place, keep classes and state
                    const el = createElement(v.kind);
                    el.className = entry.el.className;
                    if (entry.el.dataset.state) el.dataset.state = entry.el.dataset.state;
                    el.style.cssText = entry.el.style.cssText;
                    attachListeners(el, entry.data.id);
                    entry.el.replaceWith(el);
                    entry.el = el;
                    entry.kind = v.kind;
                    entry.src = null;
                }
                if (v.src !== entry.src) {
                    entry.el.src = v.src;
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
                    const entry = { data: c, el: null, src: null, kind: null, state: undefined };
                    const v = visualFor(c);
                    entry.el = createElement(v.kind);
                    entry.kind = v.kind;
                    attachListeners(entry.el, c.id);
                    entries.set(c.id, entry);
                    world.appendChild(entry.el);
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
