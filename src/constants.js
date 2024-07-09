// constants
export const maxTextScale = 1.1;
export const minTextScale = 0.9;
export const BASE_TEXT_SIZE = 0.6;
export const baseFov = 60;
export const minFov = 60;
export const maxFov = 110;

export const songList = [
    ["https://piapro.jp/t/hZ35/20240130103028", 4592293, 2727635, 2824326, 59415, 13962, "SUPERHERO / めろくる"],
    ["https://piapro.jp/t/--OD/20240202150903", 4592296, 2727636, 2824327, 59416, 13963, "いつか君と話したミライは / タケノコ少年<"],
    ["https://piapro.jp/t/XiaI/20240201203346", 4592297, 2727637, 2824328, 59417, 13964, "フューチャーノーツ / shikisai"],
    ["https://piapro.jp/t/Rejk/20240202164429", 4592298, 2727638, 2824329, 59418, 13965, "未来交響曲 / ヤマギシコージ"],
    ["https://piapro.jp/t/ELIC/20240130010349", 4592299, 2727639, 2824330, 59419, 13966, "リアリティ / 歩く人"],
    ["https://piapro.jp/t/xEA7/20240202002556", 4592300, 2727640, 2824331, 59420, 13967, "The Marks / 2ouDNS"]
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
        pos: [2.2, 1.07, -0.05],
        rot: [Math.PI / 2, Math.PI / 2],
        text: [2.71, -10, -0.04]
    },

    { // Coffee Table
        pos: [2.4, 1.07, -0.05],
        rot: [Math.PI / 2, Math.PI / 6],
        text: [2.71, -10, -0.04]
    },

    { // Full view
        pos: [0.6, 1.1, -1.2],
        rot: [-1.9 * Math.PI / 3, Math.PI / 2],
        text: [3.3, 1.2, 0]
    },

    { // table
        pos: [4.76, 1.2, -1.1],
        rot: [0, Math.PI / 2],
        text: [2.71, -10, -0.04]
    },
]
export const polaroidPositions = [[4.43, 1.224, -2.19, -0.23366703581932333],
    [4.55, 1.197, -2.19, -0.11524726739489498],
    [4.695, 1.19, -2.19, 0],
    [4.831, 1.203, -2.19, 0.06181630125869426],
    [4.945, 1.23, -2.19, 0.1286658631629116],
    [5.056, 1.272, -2.19, 0.22665441714058376]]
export const noShadows = ["polaroidline", "line", "MikuAcrylic", "inner sky", "colored sky", "outer sky"]
export const punctuation = ["'", '"', '“', '”', "‘", "’", "(", ")", "!", "?", "%", "/", "*", "•", "$", "#", "@", "-", ":"]
export const BEDROOM = 0;
export const WINDOW = 1;
export const TV = 2;
export const NOTEBOOK = 3;
export const FULL_VIEW = 4;
export const WINDOW_TEXT_SIZE = BASE_TEXT_SIZE / 3;
export const MAX_CHARS_PER_LINE = 9;
export const MAX_LINES = 15;
export const NOTEBOOK_TEXT_SIZE = BASE_TEXT_SIZE / 20;
export const POLAROID_TEXT_SIZE = BASE_TEXT_SIZE / 12;
export const POLAROID_COUNT = 6;
export const TV_INSTANCE_COUNT = 6;

