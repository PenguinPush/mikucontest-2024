// constants
export const maxTextScale = 1.1;
export const minTextScale = 0.9;
export const baseTextSize = 0.6;
export const baseFov = 60;
export const minFov = 60;
export const maxFov = 90;

export const songList = [
    ["https://piapro.jp/t/hZ35/20240130103028", 4592293, 2727635, 2824326, 59415, 13962],
    ["https://piapro.jp/t/--OD/20240202150903", 4592296, 2727636, 2824327, 59416, 13963],
    ["https://piapro.jp/t/XiaI/20240201203346", 4592297, 2727637, 2824328, 59417, 13964],
    ["https://piapro.jp/t/Rejk/20240202164429", 4592298, 2727638, 2824329, 59418, 13965],
    ["https://piapro.jp/t/ELIC/20240130010349", 4592299, 2727639, 2824330, 59419, 13966],
    ["https://piapro.jp/t/xEA7/20240202002556", 4592300, 2727640, 2824331, 59420, 13967]
];

export const cameraPositions = [
    { // Bed
        pos: [5.68, 1.27, 1.6],
        rot: [Math.PI / 3, Math.PI / 2],
        text: [2.71, 1.3, -0.04]
    },
    { // Window
        pos: [1.85, 1.2, 0.7],
        rot: [Math.PI, Math.PI / 2],
        text: [2.71, -10, -0.04]
    },
    { // TV
        pos: [2.2, 1.07, -0.1],
        rot: [Math.PI / 2, Math.PI / 2],
        text: [2.71, -10, -0.04]
    },

    { // Coffee Table
        pos: [2.2, 1.07, -0.1],
        rot: [Math.PI / 2, Math.PI/6],
        text: [1, 1.07, 0]
    },

    { // Full view
        pos: [0.6, 1.1, -1.2],
        rot: [-1.9 * Math.PI / 3, Math.PI/2],
        text: [3.3, 1.2, 0]
    },

    { // table
        pos: [4.8, 1.2, -1.1],
        rot: [0, Math.PI/2],
        text: [2.71, -10, -0.04]
    },
]

export const BEDROOM = 0;
export const WINDOW = 1;
export const TV = 2;
export const FULL_VIEW = 3;
export const NOTEBOOK = 4;

export const noShadows = ["polaroidline", "line", "MikuAcrylic"]
export const WINDOW_TEXT_SIZE = baseTextSize / 3;

export const MAX_CHARS_PER_LINE = 11;
export const MAX_LINES = 9;
export const NOTEBOOK_TEXT_SIZE = baseTextSize / 12;
