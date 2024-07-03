// import necessary modules
import {Player} from "textalive-app-api";

import * as THREE from "three";

import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {Reflector} from 'three/addons/objects/Reflector.js';
import {Text} from 'troika-three-text';
import {maxTextScale, minTextScale, baseTextSize, fov, songList} from "./constants";
import WebGL from "three/addons/capabilities/WebGL.js";
import {isValidUrl} from "./utils";
import CameraControls from 'camera-controls';

CameraControls.install({THREE: THREE});

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

class LyricsData {
    constructor() {
        this.char = "";
        this.word = "";
        this.phrase = "";
        this.text = "";

        this.textOverride = false; // when true, display this.text instead of the desired character/word/phrase
        this.textScale = 1;
        this.textScaleDelta = 1;

        this.ratio = 1;
        this.stretch = 0;
        this.maxAmplitude = 0;
        this.valenceArousal = (0, 0);
    }

    // calculate text effects
    update(amplitude, valenceArousal) {
        this.textScaleDelta = this.textScale
        this.ratio = amplitude / this.maxAmplitude;
        this.valenceArousal = valenceArousal;

        // algorithm that scales the text (but scales less when the scale is already extreme)
        this.textScale = minTextScale + (maxTextScale - minTextScale) * Math.log(this.ratio * maxTextScale + 1) / Math.log(maxTextScale + 1)

        // determine squash & stretch from how the scale change
        this.stretch += (this.textScale - this.textScaleDelta) * 5;
        this.stretch *= 0.9999; // decay squash & stretch
        this.stretch = Math.min(Math.max(-0.7, this.stretch), 0.7) // clamp squash & stretch

    }
}

// global variables
let player, threeMng;
let position = 0;
let lyricsData = new LyricsData();

let camera, scene, renderer, cameraControls, clock;
let width = window.innerWidth;
let height = window.innerHeight;

const cameraPos = [2.333595, 1.1, -0.95954];
const cameraRot = [Math.PI * 1.2, Math.PI / 2];

// input
let inputX = 0;
let inputY = 0;
let isTouching = false;

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
                if (songSelector.value >= 0) { // non-custom song
                    customSong.style.display = "none";
                    loadSong(songSelector.value, false);
                } else { // custom song
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
        if (songSelector.value >= 0) { // non-custom song
            customSong.style.display = "none";
            loadSong(songSelector.value, false);
        } else { // custom song
            customSong.style.display = "inline";
            loadSong(customSong.value, true);
        }
    }
}

function onVideoReady(v) {
    artistSpan.textContent = player.data.song.artist.name;
    songSpan.textContent = player.data.song.name;

    let c = player.video.firstChar;
    let w = player.video.firstWord;
    let p = player.video.firstPhrase;

    while (c) {
        c.animate = animateChar.bind(this);
        c = c.next;
    }
    while (w) {
        w.animate = animateWord.bind(this);
        w = w.next;
    }
    while (p) {
        p.animate = animatePhrase.bind(this);
        p = p.next;
    }

    position = 0;
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

    position = pos;
}

function onPlay() {
    playBtns.forEach((playBtn) => playBtn.style.display = "none");
    pauseBtn.style.display = "inline" // toggle button to pause
}

function onPause() {
    playBtns.forEach((playBtn) => playBtn.style.display = "inline");
    pauseBtn.style.display = "none" // toggle button to play
}

function onStop() {
    lyrics.text = "-";

    playBtns.forEach((playBtn) => playBtn.style.display = "inline");
    pauseBtn.style.display = "none" // toggle button to play
}

function loadSong(value, isCustom) {
    // song loading system
    player.video && player.requestPause();
    player.volume = volumeSlider.value

    // initialize lyrics data
    lyricsData = new LyricsData()
    lyricsData.textOverride = true;
    lyricsData.text = "loading...";

    songSpan.textContent = "";
    artistSpan.textContent = "";

    document
        .querySelectorAll("#control *")
        .forEach((item) => (item.disabled = true));

    if (!isCustom) {
        player.createFromSongUrl(songList[value][0], { // fetch from constants
            video: {
                beatId: songList[value][1],
                chordId: songList[value][2],
                repetitiveSegmentId: songList[value][3],
                lyricId: songList[value][4],
                lyricDiffId: songList[value][5]
            }
        }).then(() => {
            lyricsData.text = "-";
            lyricsData.maxAmplitude = player.getMaxVocalAmplitude()
        });
    } else { // fetch from songle
        if (isValidUrl(value)) {
            player.createFromSongUrl(value).then(() => {
                lyricsData.text = "-";
                lyricsData.maxAmplitude = player.getMaxVocalAmplitude()
            });
        } else {
            lyricsData.text = "invalid url";

            document
                .querySelectorAll("#control *")
                .forEach((item) => (item.disabled = false));
        }
    }
}

function animateChar(pos, unit) {
    if (unit.contains(pos)) {
        lyricsData.char = unit.text;
    }
    lyricsData.update(player.getVocalAmplitude(pos), player.getValenceArousal(pos))
}

function animateWord(pos, unit) {
    if (unit.contains(pos)) {
        lyricsData.word = unit.text;
    }
    lyricsData.update(player.getVocalAmplitude(pos), player.getValenceArousal(pos))
}

function animatePhrase(pos, unit) {
    if (unit.contains(pos)) {
        lyricsData.phrase = unit.text;
    }
    lyricsData.update(player.getVocalAmplitude(pos), player.getValenceArousal(pos))
}

function update() {
    // rerender the scene
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

        clock = new THREE.Clock();

        this.initCamera();
        this.initControls();

        // set up scene
        scene = new THREE.Scene();
        this._loadScene();
        this.loadLyrics();
    }

    initControls() {
        // track the cursor/finger position
        document.addEventListener("mousemove", (event) => {
            this.normalizeInput(event.clientX, event.clientY);
            isTouching = true;
        })

        document.addEventListener("touchstart", (event) => {
            if (event.touches.length === 1) {
                this.normalizeInput(event.touches[0].clientX, event.touches[0].clientY);
                isTouching = true;
            }
        })

        document.addEventListener("touchmove", (event) => {
            if (event.touches.length === 1) {
                this.normalizeInput(event.touches[0].clientX, event.touches[0].clientY);
                isTouching = true;
            }
        })

        document.addEventListener("touchend", (event) => {
            setTimeout(() => {
                isTouching = false;
            }, 30);
        })

        document.addEventListener("touchcancel", (event) => {
            setTimeout(() => {
                isTouching = false;
            }, 30);
        })

        document.addEventListener("mouseleave", (event) => {
            setTimeout(() => {
                isTouching = false;
            }, 30);
        })
    }

    initCamera() {
        camera = new THREE.PerspectiveCamera(Math.max(50, Math.min(fov / (width / height) / 2, 90)),
            width / height, 0.1, 1000);
        camera.position.set(cameraPos[0], cameraPos[1], cameraPos[2]);
        cameraControls = new CameraControls(camera, renderer.domElement);
        cameraControls.minDistance = cameraControls.maxDistance = 0;

        this.movementStrength = 1 / 10;
        this.rotateStrength = 1 / 12;
        cameraControls.mouseButtons.left = CameraControls.ACTION.NONE;
        cameraControls.mouseButtons.right = CameraControls.ACTION.NONE;
        cameraControls.mouseButtons.middle = CameraControls.ACTION.NONE;
        cameraControls.mouseButtons.wheel = CameraControls.ACTION.NONE;

        cameraControls.touches.one = CameraControls.ACTION.NONE;
        cameraControls.touches.two = CameraControls.ACTION.NONE;
        cameraControls.touches.three = CameraControls.ACTION.NONE;

        cameraControls.moveTo(cameraPos[0], cameraPos[1], cameraPos[2], false);
        cameraControls.rotateTo(cameraRot[0], cameraRot[1], false);

        cameraControls.saveState();

        cameraControls.update(clock.getDelta())
    }

    loadLyrics() {
        this.lyrics = new Text();
        scene.add(this.lyrics);

        // set properties for the text
        this.lyrics.fontSize = baseTextSize;
        this.lyrics.font = "src/assets/NotoSansJP-Bold.ttf"

        this.lyrics.textAlign = "center"
        this.lyrics.anchorX = "50%";
        this.lyrics.anchorY = "50%";

        this.lyrics.outlineOffsetX = "8%";
        this.lyrics.outlineOffsetY = "6%";
        this.lyrics.outlineColor = colorPicker.value;

        this.lyrics.sdfGlyphSize = 128;

        this.lyrics.position.set(3.0118091583251953, 1.15475435256958, -0.049741268157958984);
        this.lyrics.lookAt(camera.position);
    }

    _loadScene() {
        scene.background = new THREE.Color(0x2d2a2e);
        // load the environment
        const loader = new GLTFLoader();

        loader.load("src/assets/bedroom_base.glb", function (gltf) {
            let object = gltf.scene;
            let mirrorBase;

            object.traverse((item) => {
                if (item instanceof THREE.Light) {
                    item.intensity = 0;
                }

                if (item.material) {
                    if (item.material.name === "mirror") {
                        const mirrorGeometry = new THREE.PlaneGeometry(0.95, 1.9, 1, 1);
                        const mirror = new Reflector(mirrorGeometry, {
                            clipBias: 0.003,
                            textureWidth: window.innerWidth * window.devicePixelRatio,
                            textureHeight: window.innerHeight * window.devicePixelRatio,
                            color: 0xbbbbbb
                        });

                        mirror.position.copy(item.position);
                        mirror.rotation.set(0, -Math.PI / 2, 0)

                        mirrorBase = item;
                        scene.add(mirror);
                    }
                }
            })

            mirrorBase.parent.remove(mirrorBase);
            scene.add(object);
        })

        const rectLight = new THREE.RectAreaLight(0xFFFFFF, 1, 5, 3);
        rectLight.position.set(3.2118091583251953, 2.545475435256958, -0.049741268157958984);
        rectLight.lookAt(rectLight.position.x, -10, rectLight.position.z);
        scene.add(rectLight)

        const ambientLight = new THREE.AmbientLight()
        ambientLight.color = new THREE.Color(0xffffff)
        ambientLight.intensity = 1
        scene.add(ambientLight)
    }

    update(t) {
        this.lyrics.text = lyricsData.word;
        this.lyrics.fontSize = baseTextSize * lyricsData.textScale;
        this.lyrics.letterSpacing = lyricsData.stretch / 10;
        this.lyrics.scale.set(1 + (lyricsData.stretch) ** 3, 1 - (lyricsData.stretch) ** 3);
        this.lyrics.sync();

        // set camera movement multiplier
        let multiplierX = 100 / camera.fov;
        let multiplierY = 100 / camera.fov;

        // scale down the tracking if it exits the radius
        if (inputX ** 2 + inputY ** 2 > 1) {
            multiplierX = 100 / Math.sqrt(inputX ** 2 + inputY ** 2) / camera.fov;
            multiplierY = 100 / Math.sqrt(inputX ** 2 + inputY ** 2) / camera.fov;
        }

        // rotate and move the camera a little
        if (isTouching) {
            // complicated math to make the camera translate along its local z plane instead of the global one
            let forward = camera.getWorldDirection(new THREE.Vector3()).negate();
            let up = camera.up.clone();
            let right = new THREE.Vector3().crossVectors(forward, up);

            let movementX = right.multiplyScalar(-inputX * this.movementStrength * multiplierX);
            let movementY = up.multiplyScalar(inputY * this.movementStrength * multiplierY);

            let targetPosition = new THREE.Vector3(...cameraPos).add(movementX).add(movementY);

            cameraControls.moveTo(targetPosition.x, targetPosition.y, targetPosition.z, true);

            // just rotating it LOL, nowhere near as hard math
            cameraControls.rotateTo(cameraRot[0] - inputX * this.rotateStrength, cameraRot[1] + inputY * this.rotateStrength, true)
        } else {
            // set to default positions
            cameraControls.moveTo(cameraPos[0],
                cameraPos[1], cameraPos[2], true)
            cameraControls.rotateTo(cameraRot[0], cameraRot[1], true)
        }

        cameraControls.update(clock.getDelta())
        renderer.render(scene, camera);
    }

    resize() {
        width = window.innerWidth;
        height = window.innerHeight;

        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio)

        camera.aspect = width / height;
        camera.fov = Math.max(50, Math.min(fov / camera.aspect / 2, 90));

        camera.updateProjectionMatrix();
        this.update()
    }

    normalizeInput(clientX, clientY, windowWidth, windowHeight) {
        inputX = (clientX / window.innerWidth) * 2 - 1;
        inputY = -(clientY / window.innerHeight) * 2 + 1;
    }
}

initMain();