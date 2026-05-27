/**
 * Shared companion renderer.
 * Both the WebviewPanel (panel mode) and the Explorer WebviewViewProvider
 * (explorer mode) use this function to produce the HTML that renders
 * companions inside their respective webview containers.
 */
export function getCompanionHtml(mode: 'panel' | 'explorer'): string {
    const isExplorer = mode === 'explorer';

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

            img.companion {
                position: absolute;
                -webkit-user-drag: none;
            }

            img.companion:hover {
                opacity: 0.3;
                cursor: grab;
            }
        </style>

        <div id="world"></div>

        <script>
            const vscode = acquireVsCodeApi();
            const world = document.getElementById('world');
            const MODE = document.body.dataset.mode; // 'panel' | 'explorer'

            let companions = [];

            window.addEventListener('message', event => {
                if (event.data.command === 'render') {
                    companions = event.data.companions;
                    render();
                }
            });

            const dragState = {
                item: null,
                id: null,
                offsetX: 0,
                offsetY: 0
            };

            document.addEventListener('mousemove', (e) => {
                if (!dragState.item) return;

                let newX = e.clientX - dragState.offsetX;
                let newY = e.clientY - dragState.offsetY;

                ${isExplorer ? `
                // Explorer mode: clamp to viewport
                const maxW = window.innerWidth - dragState.item.offsetWidth;
                const maxH = window.innerHeight - dragState.item.offsetHeight;
                newX = Math.max(0, Math.min(newX, maxW));
                newY = Math.max(0, Math.min(newY, maxH));
                ` : ''}

                dragState.item.style.left = newX + 'px';
                dragState.item.style.top = newY + 'px';
            });

            document.addEventListener('mouseup', () => {
                if (!dragState.item) return;

                dragState.item.style.cursor = 'grab';

                // Convert pixel position back to percentage
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;
                const pixelX = parseFloat(dragState.item.style.left);
                const pixelY = parseFloat(dragState.item.style.top);
                const percentX = pixelX / windowWidth;
                const percentY = pixelY / windowHeight;

                vscode.postMessage({
                    command: 'savePosition',
                    id: dragState.id,
                    x: percentX,
                    y: percentY
                });

                dragState.item = null;
                dragState.id = null;
            });

            ${isExplorer ? `
            // Resize observer: reflow companions when sidebar is resized
            const resizeObserver = new ResizeObserver(() => {
                if (!dragState.item) {
                    render();
                }
            });
            resizeObserver.observe(document.body);
            ` : ''}

            function render() {
                if (dragState.item) {
                    return;
                }

                world.innerHTML = '';

                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;

                companions.forEach(c => {
                    const img = document.createElement('img');

                    img.className = 'companion';
                    img.src = c.assetPath;
                    img.draggable = false;

                    // Convert percentage to pixels
                    let pixelX = c.x * windowWidth;
                    let pixelY = c.y * windowHeight;

                    ${isExplorer ? `
                    // Explorer mode: clamp positions so companion stays in view
                    const maxX = Math.max(0, windowWidth - c.size);
                    const maxY = Math.max(0, windowHeight - c.size);
                    pixelX = Math.max(0, Math.min(pixelX, maxX));
                    pixelY = Math.max(0, Math.min(pixelY, maxY));
                    ` : ''}

                    img.style.left = pixelX + 'px';
                    img.style.top = pixelY + 'px';
                    img.style.width = c.size + 'px';
                    img.style.opacity = 1;
                    img.style.cursor = c.locked ? 'not-allowed' : 'grab';

                    img.addEventListener('mousedown', (e) => {
                        if (c.locked) return;
                        e.preventDefault();

                        dragState.item = img;
                        dragState.id = c.id;
                        dragState.offsetX = e.clientX - img.offsetLeft;
                        dragState.offsetY = e.clientY - img.offsetTop;
                        img.style.cursor = 'grabbing';
                    });

                    img.addEventListener('wheel', (e) => {
                        e.preventDefault();

                        ${isExplorer
                            ? `const size = Math.max(30, Math.min(200, c.size + (e.deltaY < 0 ? 10 : -10)));`
                            : `const size = Math.max(40, c.size + (e.deltaY < 0 ? 10 : -10));`
                        }

                        vscode.postMessage({
                            command: 'resize',
                            id: c.id,
                            size
                        });
                    });

                    img.addEventListener('contextmenu', (e) => {
                        e.preventDefault();

                        vscode.postMessage({
                            command: 'contextMenu',
                            id: c.id
                        });
                    });

                    img.addEventListener('dblclick', (e) => {
                        e.preventDefault();

                        vscode.postMessage({
                            command: 'delete',
                            id: c.id
                        });
                    });

                    img.addEventListener('mouseenter', () => {
                        img.style.opacity = 0.3;
                    });

                    img.addEventListener('mouseleave', () => {
                        img.style.opacity = 1;
                    });

                    world.appendChild(img);
                });
            }
        </script>
    </body>
    </html>
    `;
}
