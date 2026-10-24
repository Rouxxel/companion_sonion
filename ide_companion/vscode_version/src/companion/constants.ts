export type RenderMode = 'panel' | 'explorer';

export const DEFAULT_ASSET_URL = 'https://c.tenor.com/Wqi3Xrnz2wwAAAAd/tenor.gif';
export const DEFAULT_SIZE = 180;
export const SIZE_STEP = 10;

export const SIZE_LIMITS: Record<RenderMode, { min: number; max: number }> = {
    panel: { min: 40, max: Infinity },
    explorer: { min: 30, max: 200 }
};

export const ASSET_FILE_FILTERS: Record<string, string[]> = {
    'Images & Videos': ['png', 'jpg', 'jpeg', 'gif', 'webp', 'webm', 'mp4']
};
