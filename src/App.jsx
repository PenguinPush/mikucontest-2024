// import necessary modules
import {Player} from "textalive-app-api";

import * as THREE from "three";

import {CSS3DRenderer, CSS3DObject} from 'three/addons/renderers/CSS3DRenderer.js';

import WebGL from "three/addons/capabilities/WebGL.js";
import {isValidUrl} from "./utils";

// initialize variables
const playBtns = document.querySelectorAll(".play");
const jumpBtn = document.querySelector("#jump");
const pauseBtn = document.querySelector("#pause");
const rewindBtn = document.querySelector("#rewind");
const colorPicker = document.querySelector("#color");
const volumeSlider = document.querySelector("#volume");
const progressBar = document.querySelector("#progress");
const songSelector = document.querySelector("#song");
const customSong = document.querySelector("#custom-song");

const positionDisplay = document.querySelector("#position strong");
const artistSpan = document.querySelector("#artist-name span");
const songSpan = document.querySelector("#song-name span");

const songList = [
    ["https://piapro.jp/t/hZ35/20240130103028", 4592293, 2727635, 2824326, 59415, 13962],
    ["https://piapro.jp/t/--OD/20240202150903", 4592296, 2727636, 2824327, 59416, 13963],
    ["https://piapro.jp/t/XiaI/20240201203346", 4592297, 2727637, 2824328, 59417, 13964],
    ["https://piapro.jp/t/Rejk/20240202164429", 4592298, 2727638, 2824329, 59418, 13965],
    ["https://piapro.jp/t/ELIC/20240130010349", 4592299, 2727639, 2824330, 59419, 13966],
    ["https://piapro.jp/t/xEA7/20240202002556", 4592300, 2727640, 2824331, 59420, 13967]
];

let player;
let threeMng;
let position = 0;

const maxTextSize = 8;
const minTextSize = 6;
let textSize = maxTextSize;
let textSizeDelta = textSize;
let stretch = 0

let width = window.innerWidth;
let height = window.innerHeight;
let camera, scene, renderer, lyrics3d;
let text, root;

// initialize main function
function initMain() {
    if (WebGL.isWebGLAvailable()) {
        threeMng = new ThreeManager();
        window.addEventListener("resize", () => threeMng.resize());
        update();
    } else {
        const warning = WebGL.getWebGLErrorMessage();
        document.getElementById("view").appendChild(warning);
    }

    _initPlayer();
}

// initialize textalive player
function _initPlayer() {
    player = new Player({
        app: {
            appAuthor: "Andrew Dai",
            appName: "miku miku",
            token: "voiEWpeaIFwNII7p",
        },
        mediaElement: document.querySelector("#media"),
        mediaBannerPosition: "top right",
        vocalAmplitudeEnabled: true,
        valenceArousalEnabled: true,
    });

    player.addListener({
        onAppReady,
        onVideoReady,
        onTimerReady,
        onTimeUpdate,
        onPlay,
        onPause,
        onStop,
    });
}

// player event handlers
function onAppReady(app) {
    if (!app.managed) {
        document.querySelector("#control").style.display = "block";

        // set up controls
        playBtns.forEach((playBtn) =>
            playBtn.addEventListener("click", () => {
                player.video && player.requestPlay();
            })
        );

        jumpBtn.addEventListener(
            "click",
            () =>
                player.video &&
                player.requestMediaSeek(player.video.firstChar.startTime)
        );

        pauseBtn.addEventListener(
            "click",
            () => player.video && player.requestPause()
        );

        rewindBtn.addEventListener(
            "click",
            () => player.video && player.requestMediaSeek(0)
        );

        colorPicker.addEventListener(
            "change",
            () => lyrics3d.style.textShadow = `0.1em 0.08em ${colorPicker.value}`
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
                    customSong.style.display = "none";
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
        console.log("first load")
        loadSong(songSelector.value, false);
    }
}

function onVideoReady(v) {
    artistSpan.textContent = player.data.song.artist.name;
    songSpan.textContent = player.data.song.name;

    let w = player.video.firstWord;
    let lyricsList = [w];

    while (w) {
        w.animate = animateWord.bind(this);
        w = w.next;

        lyricsList.push(w)
    }

    position = 0;

    console.log(lyricsList);
}

function onTimerReady(t) {
    if (!player.app.managed) {
        document
            .querySelectorAll("#control *")
            .forEach((item) => (item.disabled = false));
    }

    jumpBtn.disabled = !player.video.firstChar;
}

function onTimeUpdate(pos) {
    positionDisplay.textContent = String(Math.floor(pos));
    progressBar.value = pos / player.video.duration;

    if (pos < player.video.firstChar.startTime) {
        lyrics3d.textContent = "-";
    }

    position = pos;

}

function onPlay() {
    playBtns.forEach((playBtn) => playBtn.style.display = "none");
    pauseBtn.style.display = "inline"
}

function onPause() {
    playBtns.forEach((playBtn) => playBtn.style.display = "inline");
    pauseBtn.style.display = "none"
}

function onStop() {
    lyrics3d.textContent = "-";

    playBtns.forEach((playBtn) => playBtn.style.display = "inline");
    pauseBtn.style.display = "none"
}

function loadSong(value, isCustom) {
    // song loading system
    player.video && player.requestPause();

    lyrics3d.style.fontSize = "1em";
    lyrics3d.style.letterSpacing = "0px";

    lyrics3d.scale

    lyrics3d.textContent = "loading...";
    songSpan.textContent = "";
    artistSpan.textContent = "";

    document
        .querySelectorAll("#control *")
        .forEach((item) => (item.disabled = true));

    if (!isCustom) {
        player.createFromSongUrl(songList[value][0], {
            video: {
                beatId: songList[value][1],
                chordId: songList[value][2],
                repetitiveSegmentId: songList[value][3],
                lyricId: songList[value][4],
                lyricDiffId: songList[value][5]
            }
        }).then(() => lyrics3d.textContent = "-");
    } else {
        if (isValidUrl(value)) {
            player.createFromSongUrl(value).then(() => lyrics3d.textContent = "-");
        } else {
            lyrics3d.textContent = "invalid url";

            document
                .querySelectorAll("#control *")
                .forEach((item) => (item.disabled = false));
        }
    }
}

function animateWord(pos, unit) {
    // set up the appearance of the words
    if (unit.contains(pos)) {
        lyrics3d.textContent = unit.text;

        // calculate and apply text effects
        textSizeDelta = textSize

        let ratio = player.getVocalAmplitude(pos) / player.getMaxVocalAmplitude();
        textSize = minTextSize + (maxTextSize - minTextSize) * Math.log(ratio * maxTextSize + 1) / Math.log(maxTextSize + 1)

        stretch = (textSize - textSizeDelta) / 10;

        lyrics3d.style.fontSize = textSize + "em";
        // lyrics3d.style.transform = `scale(${Math.sqrt(1 - stretch ** 2)}, ${stretch + 1})`;
        lyrics3d.style.letterSpacing = `${stretch * 50}px`
    }
}

function update() {
    // rerender the scene if something changed
    threeMng.update(position);
    threeMng.render();

    window.requestAnimationFrame(() => update());
}

// everything 3d
class ThreeManager {
    constructor() {
        // set up renderer
        renderer = new CSS3DRenderer();
        renderer.setSize(width, height);
        document.getElementById("view").appendChild(renderer.domElement);

        // set up scene
        scene = new THREE.Scene();
        scene.scale.set(0.1, 0.1, 0.1);
        scene.background = new THREE.Color(0x2d2a2e)

        // set up camera
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.z = 50;
        camera.lookAt(0, 0, 0);

        this._loadScene()
    }

    _loadScene() {
        // load objects into scene
        lyrics3d = document.createElement("div")

        text = new CSS3DObject(lyrics3d);
        scene.add(text);
    }

    update(t) {

    }

    render() {
        renderer.render(scene, camera);
    }

    resize() {
        width = window.innerWidth;
        height = window.innerHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.setSize(width, height);

        this.render()
    }
}

initMain();