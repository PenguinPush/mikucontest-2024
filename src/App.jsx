/**
 * TextAlive App API basic example
 * https://github.com/TextAliveJp/textalive-app-basic
 *
 * This is the sample code of the API tutorial "1. Getting Started with Development".
 * Displays the lyrics being spoken word by word.
 * Also, if this app is not connected to a TextAlive host, it will display playback controls.
 * https://developer.textalive.jp/app/
 */

import {Player} from "textalive-app-api";

// If the word is spoken, display it in #text
// Show words being vocalized in #text
const animateWord = function (now, unit) {
    if (unit.contains(now)) {
        document.querySelector("#text").textContent = unit.text;
    }
};

// Make a TextAlive Player
// Instantiate a TextAlive Player instance
const player = new Player({
    app: {
        appAuthor: "Andrew Dai",
        appName: "miku miku",
        token: "voiEWpeaIFwNII7p",
    },
    mediaElement: document.querySelector("#media"),
    mediaBannerPosition: "top right",
    vocalAmplitudeEnabled: true,
    valenceArousalEnabled: true
});

// Register an event listener for TextAlive Player
// Register event listeners
player.addListener({
    onAppReady,
    onVideoReady,
    onTimerReady,
    onThrottledTimeUpdate,
    onPlay,
    onPause,
    onStop
});

const lyrics = document.querySelector("#text");

const playBtns = document.querySelectorAll(".play");
const jumpBtn = document.querySelector("#jump");
const pauseBtn = document.querySelector("#pause");
const rewindBtn = document.querySelector("#rewind");
const volumeSlider = document.querySelector("#volume");
const progressBar = document.querySelector("#progress");
const songSelector = document.querySelector("#song");
const customSong = document.querySelector("#custom-song");

const positionEl = document.querySelector("#position strong");

const artistSpan = document.querySelector("#artist-name span");
const songSpan = document.querySelector("#song-name span");

const maxTextSize = 10
const minTextSize = 2
let textSize = maxTextSize;

const songList = [
    ["https://piapro.jp/t/hZ35/20240130103028", 4592293, 2727635, 2824326, 59415, 13962],
    ["https://piapro.jp/t/--OD/20240202150903", 4592296, 2727636, 2824327, 59416, 13963],
    ["https://piapro.jp/t/XiaI/20240201203346", 4592297, 2727637, 2824328, 59417, 13964],
    ["https://piapro.jp/t/Rejk/20240202164429", 4592298, 2727638, 2824329, 59418, 13965],
    ["https://piapro.jp/t/ELIC/20240130010349", 4592299, 2727639, 2824330, 59419, 13966],
    ["https://piapro.jp/t/xEA7/20240202002556", 4592300, 2727640, 2824331, 59420, 13967]
]

const isValidUrl = urlString => {
    try {
        return Boolean(new URL(urlString));
    } catch (e) {
        return false;
    }
}

const loadSong = (value, custom) => {
    lyrics.textContent = "loading...";
    customSong.style.display = "none";
    songSpan.textContent = "";
    artistSpan.textContent = "";

    document
        .querySelectorAll("#control *")
        .forEach((item) => (item.disabled = true));

    if (custom === false) {
        player.createFromSongUrl(songList[value][0], {
            video: {
                beatId: songList[value][1],
                chordId: songList[value][2],
                repetitiveSegmentId: songList[value][3],
                lyricId: songList[value][4],
                lyricDiffId: songList[value][5]
            }
        }).then(() => lyrics.textContent = "");
    } else {
        if (isValidUrl(value) !== false) {
            player.createFromSongUrl(value).then(() => lyrics.textContent = "");
        }
    }
}

/**
 * Called when the TextAlive App is initialized
 *
 * @param {IPlayerApp} app - https://developer.textalive.jp/packages/textalive-app-api/interfaces/iplayerapp.html
 */
function onAppReady(app) {
    // Show playback control if not connected to TextAlive host
    // Show control if this app is launched standalone (not connected to a TextAlive host)
    if (!app.managed) {
        document.querySelector("#control").style.display = "block";

        // Play button / Start music playback
        playBtns.forEach((playBtn) =>
            playBtn.addEventListener("click", () => {
                player.video && player.requestPlay();
            })
        );

        // Lyrics cue button / Seek to the first character in lyrics text
        jumpBtn.addEventListener(
            "click",
            () =>
                player.video &&
                player.requestMediaSeek(player.video.firstChar.startTime)
        );

        // Pause button / Pause music playback
        pauseBtn.addEventListener(
            "click",
            () => player.video && player.requestPause()
        );

        // Rewind button / Rewind music playback
        rewindBtn.addEventListener(
            "click",
            () => player.video && player.requestMediaSeek(0)
        );

        volumeSlider.addEventListener(
            "input",
            () => player.volume = volumeSlider.value
        );

        progressBar.addEventListener(
            "input",
            () => player.requestMediaSeek(progressBar.value * player.video.duration)
        );

        songSelector.addEventListener(
            "change",
            () => {
                if (songSelector.value >= 0) {
                    loadSong(songSelector.value, false);
                } else {
                    customSong.style.display = "inline";
                    loadSong(customSong.value, true);
                }
            });

        customSong.addEventListener(
            "change",
            () => {
                loadSong(customSong.value, true);
            }
        );
    }

    if (!app.songUrl) {
        console.log('first load')
        loadSong(songSelector.value, false);
    }
}


function onVideoReady(v) {
    artistSpan.textContent = player.data.song.artist.name;
    songSpan.textContent = player.data.song.name;

    let w = player.video.firstWord;
    while (w) {
        w.animate = animateWord;
        w = w.next;
    }
}


function onTimerReady(t) {
    if (!player.app.managed) {
        document
            .querySelectorAll("#control *")
            .forEach((item) => (item.disabled = false));
    }

    jumpBtn.disabled = !player.video.firstChar;
}

function onThrottledTimeUpdate(position) {
    positionEl.textContent = String(Math.floor(position));
    progressBar.value = position / player.video.duration;

    let ratio = player.getVocalAmplitude(position) / player.getMaxVocalAmplitude();
    textSize = minTextSize + (maxTextSize - minTextSize) * Math.log(ratio * maxTextSize + 1) / Math.log(maxTextSize + 1)

    lyrics.style.fontSize = textSize + "em";
}

function onPlay() {
    // document.querySelector("#overlay").style.display = "none";
}

function onPause() {
    document.querySelector("#text").textContent = "-";
}

function onStop() {
    document.querySelector("#text").textContent = "-";
}

