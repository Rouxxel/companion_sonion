export interface Companion {
    id: string;
    x: number; // percentage (0-1) of window width
    y: number; // percentage (0-1) of window height
    size: number;
    assetPath: string;
    locked: boolean;
    renderMode?: 'panel' | 'explorer'; // defaults to 'panel' when undefined
}