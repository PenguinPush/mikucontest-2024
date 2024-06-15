// import necessary modules
import {Player} from "textalive-app-api";

import * as THREE from "three";

import {Text} from 'troika-three-text'
import CameraControls from 'camera-controls';

CameraControls.install({THREE: THREE});


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

const maxTextScale = 1.1;
const minTextScale = 0.9;
const baseTextSize = 8;
let textScale = maxTextScale;
let textScaleDelta = textScale;
let stretch = 0
let lyricsTextOld;
let isNewLyrics = false;

let width = window.innerWidth;
let height = window.innerHeight;
let camera, scene, renderer, cameraControls, clock, lyrics;
let pieceIndex = -1;

let mouseX = 0;
let mouseY = 0;

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
            () => lyrics.outlineColor = colorPicker.value
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
        lyrics.text = "-";
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
    lyrics.text = "-";

    playBtns.forEach((playBtn) => playBtn.style.display = "inline");
    pauseBtn.style.display = "none"
}

function loadSong(value, isCustom) {
    // song loading system
    player.video && player.requestPause();
    player.volume = volumeSlider.value

    textScale = 1
    textScaleDelta = 1
    stretch = 0

    lyrics.text = "loading...";
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
        }).then(() => lyrics.text = "-");
    } else {
        if (isValidUrl(value)) {
            player.createFromSongUrl(value).then(() => lyrics.text = "-");
        } else {
            lyrics.text = "invalid url";

            document
                .querySelectorAll("#control *")
                .forEach((item) => (item.disabled = false));
        }
    }
}

function animateWord(pos, unit) {
    if (unit.contains(pos)) {
        // update lyrics
        lyrics.text = unit.text;
        isNewLyrics = lyrics.text !== lyricsTextOld;
        lyricsTextOld = lyrics.text
    }

    // calculate text effects
    textScaleDelta = textScale
    let ratio = player.getVocalAmplitude(pos) / player.getMaxVocalAmplitude();

    textScale = minTextScale + (maxTextScale - minTextScale) * Math.log(ratio * maxTextScale + 1) / Math.log(maxTextScale + 1)
    stretch += (textScale - textScaleDelta) * 5;
    stretch *= 0.9999;
    stretch = Math.min(Math.max(-0.7, stretch), 0.7)
}

function update() {
    // rerender the scene if something changed
    threeMng.update(position);

    window.requestAnimationFrame(() => update());
}

// everything 3d
class ThreeManager {
    constructor() {
        // set up renderer
        renderer = new THREE.WebGLRenderer({antialias: true});
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio)
        document.getElementById("view").appendChild(renderer.domElement);

        // set up camera
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.set(0, 0, 50);
        camera.lookAt(0, 0, 0);

        // set up controls
        clock = new THREE.Clock();

        cameraControls = new CameraControls(camera, renderer.domElement);
        cameraControls.minDistance = cameraControls.maxDistance = 0;
        this.rotateStrength = 10;
        this.movementStrength = 10;

        cameraControls.mouseButtons.left = CameraControls.ACTION.NONE;
        cameraControls.mouseButtons.right = CameraControls.ACTION.NONE;
        cameraControls.mouseButtons.middle = CameraControls.ACTION.NONE;
        cameraControls.mouseButtons.wheel = CameraControls.ACTION.NONE;

        cameraControls.touches.one = CameraControls.ACTION.NONE;
        cameraControls.touches.two = CameraControls.ACTION.NONE;
        cameraControls.touches.three = CameraControls.ACTION.NONE;

        cameraControls.saveState();

        document.addEventListener("mousemove", (event) => {
            mouseX = (event.clientX / window.innerWidth) * 2 - 1;
            mouseY = (event.clientY / window.innerHeight) * 2 - 1;
        })

        // set up scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x2d2a2e);

        lyrics = new Text()
        scene.add(lyrics)

        cameraControls.update(clock.getDelta())
        this._loadScene();
    }

    _loadScene() {
        // load objects into scene
        lyrics.fontSize = baseTextSize;
        lyrics.font = "src/assets/NotoSansJP-Bold.ttf"

        lyrics.textAlign = "center"
        lyrics.anchorX = "50%";
        lyrics.anchorY = "50%";

        lyrics.outlineOffsetX = "8%";
        lyrics.outlineOffsetY = "6%";
        lyrics.outlineColor = colorPicker.value;

        lyrics.depth = 1;
    }

    update(t) {
        if (isNewLyrics) {
            console.log('new line')
        }

        lyrics.fontSize = baseTextSize * textScale;
        lyrics.letterSpacing = stretch / 10;
        lyrics.scale.set(1 + (stretch) ** 3, 1 - (stretch) ** 3);
        lyrics.sync();

        if (mouseX ** 2 + mouseY ** 2 < 1) {

        }

        lyrics.position.x = (mouseX) * innerWidth/25
        lyrics.position.y = (-mouseY) * innerHeight/25

        console.log(lyrics.position)

        // cameraControls.moveTo(mouseX * this.movementStrength,
        //     -mouseY * this.movementStrength, 0, true)
        //
        // cameraControls.lookInDirectionOf(mouseX * this.rotateStrength,
        //     -mouseY * this.rotateStrength, -camera.position.z, true)

        cameraControls.update(clock.getDelta())
        renderer.render(scene, camera);
    }

    resize() {
        width = window.innerWidth;
        height = window.innerHeight;

        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio)

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        this.update()
    }
}

initMain();