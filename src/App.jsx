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
    mediaElement: document.querySelector("#media")
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

const playBtns = document.querySelectorAll(".play");
const overlay = document.querySelector("#overlay");
const jumpBtn = document.querySelector("#jump");
const pauseBtn = document.querySelector("#pause");
const rewindBtn = document.querySelector("#rewind");
const volumeSlider = document.querySelector("#volume");
const progressBar = document.querySelector("#progress");
const positionEl = document.querySelector("#position strong");

const artistSpan = document.querySelector("#artist span");
const songSpan = document.querySelector("#song span");

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
        console.log()

        // Play button / Start music playback
        playBtns.forEach((playBtn) =>
            playBtn.addEventListener("click", () => {
                player.video && player.requestPlay();
                overlay.style.display = "none";
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

        volumeSlider.addEventListener("input", function () {
            player.volume = volumeSlider.value;
        });

        progressBar.addEventListener("input", function() {
          player.requestMediaSeek(progressBar.value * player.video.duration);
        });
    }

    if (!app.songUrl) {
        // 未来交響曲 / ヤマギシコージ
        player.createFromSongUrl("https://piapro.jp/t/Rejk/20240202164429", {
            video: {
                // 音楽地図訂正履歴
                beatId: 4592298,
                chordId: 2727638,
                repetitiveSegmentId: 2824329,
                // 歌詞タイミング訂正履歴: https://textalive.jp/lyrics/piapro.jp%2Ft%2FRejk%2F20240202164429
                lyricId: 59418,
                lyricDiffId: 13965
            },
        });
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
            .querySelectorAll("button")
            .forEach((btn) => (btn.disabled = false));
    }

    jumpBtn.disabled = !player.video.firstChar;
}

function onThrottledTimeUpdate(position) {
    positionEl.textContent = String(Math.floor(position));
    progressBar.value = position / player.video.duration;
}

function onPlay() {
    document.querySelector("#overlay").style.display = "none";
}

function onPause() {
    document.querySelector("#text").textContent = "-";
}

function onStop() {
    document.querySelector("#text").textContent = "-";
}
