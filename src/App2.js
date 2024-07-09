// import necessary modules
import {MeshBasicMaterial, MeshStandardMaterial, PCFSoftShadowMap, VSMShadowMap} from "three";

const {Player} = TextAliveApp;
import * as THREE from "three";
import CameraControls from "https://cdn.jsdelivr.net/npm/camera-controls@2.8.5/+esm";
import {Text} from "https://cdn.jsdelivr.net/npm/troika-three-text@0.49.1/+esm";

import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import WebGL from "three/addons/capabilities/WebGL.js";
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {HalftonePass} from 'three/addons/postprocessing/HalftonePass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

import {
    baseFov,
    BASE_TEXT_SIZE,
    BEDROOM,
    cameraPositions,
    FULL_VIEW,
    MAX_CHARS_PER_LINE,
    MAX_LINES,
    maxFov,
    maxTextScale,
    minFov,
    minTextScale,
    noShadows,
    NOTEBOOK_TEXT_SIZE,
    POLAROID_COUNT,
    polaroidPositions,
    POLAROID_TEXT_SIZE,
    punctuation,
    songList,
    TV,
    TV_INSTANCE_COUNT,
    WINDOW,
    WINDOW_TEXT_SIZE
} from "./constants.js";

CameraControls.install({THREE: THREE});

// lyrics information
class LyricsData {
    constructor() {
        this.char = "";
        this.word = "";
        this.phrase = "";
        this.text = "";

        this.floatingChars = [];
        this.previousChars = new Set();
        this.previousWords = new Set();
        this.previousRandom = -1;

        this.textOverride = false; // when true, display this.text instead of the desired character/word/phrase
        this.textScale = 1;
        this.textScaleDelta = 1;

        this.ratio = 1;
        this.stretch = 0;
        this.maxAmplitude = 0;
        this.valence = -1;
        this.arousal = -1;
        this.language = "";
        this.enIndex = 0;

        this.rawCharList = []
        this.sortedCharsList = []

        this.wordList = []

        this.moodColor = new THREE.Color(1, 1, 1);
        this.glyphSize = 32;
        this.choruses = [];
        this.chorusIndex = 0;
        this.textLoaded = false;
    }

    // calculate text effects
    update(amplitude, valenceArousal) {
        this.textScaleDelta = this.textScale
        this.ratio = amplitude / this.maxAmplitude;
        this.normalizeValenceArousal(valenceArousal);

        // algorithm that scales the text (but scales less when the scale is already extreme)
        this.textScale = minTextScale + (maxTextScale - minTextScale) * Math.log(this.ratio * maxTextScale + 1) / Math.log(maxTextScale + 1)

        // determine squash & stretch from how the scale change
        this.stretch += (this.textScale - this.textScaleDelta) * 10;
        this.stretch *= 0.9998; // decay squash & stretch
        this.stretch = THREE.MathUtils.clamp(this.stretch, -0.7, 0.7); // clamp squash & stretch

        if (lyricsData.valence >= 0 && lyricsData.arousal >= 0) {
            const r = (1.1 - lyricsData.valence) * 2;
            const b = (0.85 - lyricsData.arousal) * 2;
            const g = -0.5 * ((r ** 2 + b ** 2) ** 0.5 - 2);

            this.moodColor = new THREE.Color(THREE.MathUtils.clamp(r, 0, 1), THREE.MathUtils.clamp(g, 0, 1), THREE.MathUtils.clamp(b, 0, 1)).offsetHSL(0, 1, 0);
        } else {
            this.moodColor = new THREE.Color(1, 1, 1);
        }
    }

    normalizeValenceArousal(valenceArousal) {
        [this.valence, this.arousal] = [(valenceArousal.v + 1) / 2, (valenceArousal.a + 1) / 2];
    }

    initCharList() {
        this.rawCharList = Array.from(this.previousChars).sort(function (a, b) {
            return a._data.startTime > b._data.startTime;
        });

        // Add spaces
        this.sortedCharsList = [];
        for (let i = 0; i < this.rawCharList.length; i++) {
            this.sortedCharsList.push(this.rawCharList[i]);
            if (this.rawCharList[i].parent.language === "en") {
                if (this.rawCharList[i].parent.next) {
                    if (this.rawCharList[i].parent.lastChar === this.rawCharList[i] && !punctuation.includes(this.rawCharList[i].parent.next.text)) {
                        this.sortedCharsList.push({
                            _data: {
                                startTime: this.rawCharList[i]._data.startTime,
                            }, text: "　"
                        });
                    }
                }

            } else {
                if (this.rawCharList[i].parent.parent.lastChar === this.rawCharList[i]) {
                    this.sortedCharsList.push({
                        _data: {
                            startTime: this.rawCharList[i]._data.startTime,
                        }, text: "　"
                    });
                }
            }
        }
    }

    initWordList() {
        this.wordList = Array.from(this.previousWords).sort(function (a, b) {
            return a._data.startTime > b._data.startTime;
        });
    }
}

// global variables
let player, threeMng;
let lyricsData = new LyricsData();
let position = 0;

// initialize html elements
const playBtn = document.querySelector("#play");
const pauseBtn = document.querySelector("#pause");
const volumeSlider = document.querySelector("#volume");
const progressBar = document.querySelector("#progress");
const songSelector = document.querySelector("#song");
const settings = document.querySelector("#settings");
const settingsToggle = document.querySelector("#settings-toggle");
const customSong = document.querySelector("#custom-song");
const accessibility = document.querySelector("#accessibility");
const graphics = document.querySelector("#graphics");
const language = document.querySelector("#language");
const credits = document.querySelector("#credits");
const leftArrow = document.querySelectorAll(".left");
const rightArrow = document.querySelectorAll(".right");

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
            appAuthor: "Andrew Dai", appName: "miku miku", token: "voiEWpeaIFwNII7p",
        },
        mediaElement: document.querySelector("#media"),
        mediaBannerPosition: "top right",
        vocalAmplitudeEnabled: true,
        valenceArousalEnabled: true,
    });

    player.addListener({
        onAppReady, onVideoReady, onTimerReady, onTimeUpdate, onPlay, onPause, onStop,
    });
    player.fps = 60;
}

// player event handlers
function onAppReady(app) {
    // set up controls
    playBtn.addEventListener("click", () => player.video && player.requestPlay());

    pauseBtn.addEventListener("click", () => player.video && player.requestPause());

    volumeSlider.addEventListener("input", () => {
        player.volume = volumeSlider.value;
        volumeSlider.style.background = `linear-gradient(90deg, #78f0d7 ${volumeSlider.value}%, #a9a9a9 ${volumeSlider.value}%)`;
    });

    progressBar.addEventListener("input", () => player.requestMediaSeek(progressBar.value * player.video.duration));

    songSelector.addEventListener("change", () => {
        if (songSelector.value >= 0) { // non-custom song
            loadSong(songSelector.value, false);
        } else { // custom song
            // bring up settings
            settingsToggle.checked = true;
            settings.classList.add('show');
            setTimeout(() => {
                settings.style.pointerEvents = "auto";
            }, 100); // wait for the slide animation to finish playing

            loadSong(customSong.value, true);
        }
    });

    settingsToggle.addEventListener("change", () => {
        if (settingsToggle.checked) {
            settings.classList.add('show');

            setTimeout(() => {
                settings.style.pointerEvents = "auto";
            }, 100); // wait for the slide animation to finish playing
        } else {
            settings.classList.remove('show');

            setTimeout(() => {
                settings.style.pointerEvents = "none";
            }, 100); // wait for the slide animation to finish playing
        }
    });

    customSong.addEventListener("change", () => {
        loadSong(customSong.value, true);
    });

    accessibility.addEventListener("change", () => {
        if (threeMng) {
            if (accessibility.checked) {
                threeMng.movementStrength = 0;
                threeMng.rotateStrength = 1 / 24;
                threeMng.cameraControls.smoothTime = 0.1;
                threeMng.skySpeed = 0.1;
            } else {
                threeMng.movementStrength = 1 / 10;
                threeMng.rotateStrength = 1 / 12;
                threeMng.cameraControls.smoothTime = 0.25;
                threeMng.skySpeed = 1;
            }
        }
    });

    graphics.addEventListener("change", () => {
        if (graphics.checked) {
            threeMng.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            threeMng.light.shadow.mapSize.width = 128;
            threeMng.light.shadow.mapSize.height = 128;
            threeMng.lamp.shadow.mapSize.width = 128;
            threeMng.lamp.shadow.mapSize.height = 128;
            threeMng.light.shadow.radius = 2;
            threeMng.lamp.shadow.radius = 2;

            threeMng.mirrorBase.visible = true;
            threeMng.mirrorReflector.visible = false;

            lyricsData.glyphSize = 32;
            threeMng.textObjects.forEach((object => {
                object.sdfGlyphSize = 32;
                object.sync()
            }));

        } else {
            threeMng.renderer.shadowMap.type = THREE.VSMShadowMap;
            threeMng.light.shadow.mapSize.width = 512;
            threeMng.light.shadow.mapSize.height = 512;
            threeMng.lamp.shadow.mapSize.width = 512;
            threeMng.lamp.shadow.mapSize.height = 512;
            threeMng.light.shadow.radius = 5;
            threeMng.lamp.shadow.radius = 5;

            threeMng.mirrorBase.visible = false;
            threeMng.mirrorReflector.visible = true;

            lyricsData.glyphSize = 64;
            threeMng.textObjects.forEach((object => {
                object.sdfGlyphSize = 64;
                object.sync()
            }));
        }

        threeMng.scene.traverse((object) => {
            if (object.isLight && object.shadow) {
                object.shadow.dispose();
            }
        });

        threeMng.renderer.shadowMap.needsUpdate = true;
    });

    language.addEventListener("change", () => {
        if (language.checked) {
            document.querySelector("label[for='graphics']").textContent = "低グラフィックス";
            document.querySelector("label[for='accessibility']").textContent = "動きを減らす";
            credits.textContent = "制作";
        } else {
            document.querySelector("label[for='graphics']").textContent = "Low Graphics";
            document.querySelector("label[for='accessibility']").textContent = "Reduce Motion";
            credits.textContent = "Credits";
        }
    });

    if (!app.songUrl) {
        if (songSelector.value >= 0) { // non-custom song
            loadSong(songSelector.value, false);
        } else { // custom song
            loadSong(customSong.value, true);
        }
    }
}

function onVideoReady(v) {
    let c = player.video.firstChar;
    let w = player.video.firstWord;
    let p = player.video.firstPhrase;

    while (c) {
        if (!lyricsData.previousChars.has(c)) {
            let randomNum = 0.5 - Math.random();
            while (Math.abs(randomNum - lyricsData.previousRandom) < 0.2) {
                randomNum = 0.5 - Math.random();
            }
            lyricsData.previousRandom = randomNum;
            lyricsData.language = c.parent.language;

            if (lyricsData.language === "en") {
                // place the text closer if it's english
                lyricsData.floatingChars.push({
                    text: c.text,
                    object: null,
                    startPosition: [1.3, 1.75 - lyricsData.enIndex * 0.2, 3.2],
                    creationTime: c.startTime,
                    movementVector: [1, 0, 0],
                    currentPosition: [0, 0, 0],
                });

                lyricsData.enIndex = (lyricsData.enIndex + 1) % 5
            } else {
                lyricsData.floatingChars.push({
                    text: c.text,
                    object: null,
                    startPosition: [1.3, 1.35 + randomNum, 3.2 + (0.5 - Math.random())],
                    creationTime: c.startTime,
                    movementVector: [1, 0, 0],
                    currentPosition: [0, 0, 0],
                });

                lyricsData.enIndex = 0
            }

            lyricsData.previousChars.add(c);
        }

        c.animate = animateChar.bind(this);
        c = c.next;
    }
    while (w) {
        if (!lyricsData.previousWords.has(w)) {
            lyricsData.previousWords.add(w);
        }

        w.animate = animateWord.bind(this);
        w = w.next;
    }
    while (p) {
        p.animate = animatePhrase.bind(this);
        p = p.next;
    }

    threeMng.initAllText().then(() => lyricsData.textLoaded = true);
}

function onTimerReady(t) {
    if (!player.app.managed) {
        document
            .querySelectorAll(".textalive-control")
            .forEach((item) => (item.disabled = false));
    }

    // generate progress bar with css gradients
    lyricsData.choruses = player.getChoruses();
    const colors = ['#78f0d7', '#ff629d'];
    let progressGradient = 'linear-gradient(60deg, ';

    if (lyricsData.choruses.length === 0) {
        progressGradient += `${colors[0]} 0%, ${colors[0]} 100%`;
    } else {
        // place colors at the choruses
        progressGradient += `${colors[0]} 0%, `;
        for (let i = 0; i < lyricsData.choruses.length; i++) {
            let startPercentage = (lyricsData.choruses[i].startTime / player.video.duration) * 100;
            let endPercentage = (lyricsData.choruses[i].endTime / player.video.duration) * 100;
            if (i === 0) {
                // start with non-chorus
                progressGradient += `${colors[0]} ${startPercentage}%, `;
            } else if (i > 0) {
                // end the non-chorus segment with a stop
                progressGradient += `${colors[0]} ${startPercentage}%, `;
            }
            // place the chorus segment stops
            progressGradient += `${colors[1]} ${startPercentage}%, ${colors[1]} ${endPercentage}%, `;
            if (i < lyricsData.choruses.length - 1) {
                // close off the last chorus with a non-chorus stop
                progressGradient += `${colors[0]} ${endPercentage}%, `;
            }
        }
    }
    progressGradient = progressGradient.slice(0, -2); // remove trailing comma and space
    progressGradient += ')';

    progressBar.style.background = progressGradient;

    player.requestMediaSeek(0);
    progressBar.value = 0;
    position = 0;
    player.endVideoSeek();
}

function onTimeUpdate(pos) {
    progressBar.value = pos / player.video.duration;
    position = pos;

    if (pos < player.video.firstChar.startTime) {
        lyricsData.word = "";
    }

    if (lyricsData.choruses[lyricsData.chorusIndex].contains(pos)) {
        // console.log('a');
    }

    // console.log(lyricsData.choruses[lyricsData.chorusIndex]);
}

function onPlay() {
    playBtn.style.display = "none"
    pauseBtn.style.display = "inline" // toggle button to pause
}

function onPause() {
    playBtn.style.display = "inline"
    pauseBtn.style.display = "none" // toggle button to play
}

function onStop() {
    playBtn.style.display = "inline"
    pauseBtn.style.display = "none" // toggle button to play
}

function loadSong(value, isCustom) {
    // song loading system
    player.video && player.requestPause();
    player.volume = volumeSlider.value

    for (let i = 0; i < lyricsData.floatingChars.length; i++) {
        threeMng.scene.remove(lyricsData.floatingChars[i].object)
    }

    // initialize lyrics data
    lyricsData = new LyricsData()

    // reset ui
    progressBar.style.background = "repeating-linear-gradient(60deg, #d3d3d3 0%, #d3d3d3 5%, #a9a9a9 5%, #a9a9a9 10%)";
    document
        .querySelectorAll(".textalive-control")
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
            customSong.disabled = true;
            lyricsData.maxAmplitude = player.getMaxVocalAmplitude()
            lyricsData.normalizeValenceArousal(player.getValenceArousal(0));
        });
    } else { // fetch from piapro
        if (checkUrl(value)) {
            customSong.disabled = false;
            player.createFromSongUrl(value).then(() => {
                lyricsData.maxAmplitude = player.getMaxVocalAmplitude()
                lyricsData.normalizeValenceArousal(player.getValenceArousal(0));
            });
        } else {
            lyricsData.text = "invalid url";

            document
                .querySelectorAll(".textalive-control")
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
        lyricsData.word = unit;
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
    if (threeMng.ready) {
        threeMng.update(position);
    }
    window.requestAnimationFrame(() => update());
}

function checkUrl(urlString) {
    try {
        return Boolean(new URL(urlString));
    } catch (e) {
        return false;
    }
}

// everything 3d
class ThreeManager {
    constructor() {
        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio)
        document.getElementById("view").appendChild(this.renderer.domElement);

        this.cameraPosIndex = 0;
        this.movementStrength = 1 / 10;
        this.rotateStrength = 1 / 12;
        this.skySpeed = 1;

        this.textObjects = [];

        this.innerSky = null;
        this.coloredSky = null;
        this.outerSky = null;

        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = false;
        this.renderer.shadowMap.needsUpdate = true;

        this.ready = false;
        this.initAllThree().then(() => update());
    }

    goLeft() {
        this.cameraPosIndex -= 1;
        this.cameraPosIndex = (this.cameraPosIndex + cameraPositions.length) % cameraPositions.length;

        this.bigLyrics.position.set(...cameraPositions[this.cameraPosIndex].text);
        this.bigLyrics.lookAt(...cameraPositions[this.cameraPosIndex].pos);
    }

    goRight() {
        this.cameraPosIndex += 1;
        this.cameraPosIndex = (this.cameraPosIndex + cameraPositions.length) % cameraPositions.length;

        this.bigLyrics.position.set(...cameraPositions[this.cameraPosIndex].text);
        this.bigLyrics.lookAt(...cameraPositions[this.cameraPosIndex].pos);
    }

    initScene() {
        this.scene = new THREE.Scene();
        const loader = new GLTFLoader();

        loader.load("src/assets/models/bedroom_base.glb", function (gltf) {
            const room = gltf.scene;

            // edit the bedroom
            room.traverse((item) => {
                if (item.isMesh) {
                    // enable shadows
                    item.castShadow = true;
                    item.receiveShadow = true;
                }

                if (item instanceof THREE.Light) {
                    // disable blender lights, they don't translate well
                    item.intensity = 0;
                    item.dispose();
                }

                if (item.material) {
                    if (noShadows.includes(item.material.name)) {
                        item.castShadow = false;
                        item.receiveShadow = false;
                    }

                    if (item.material.name === "mirror") {
                        // swap out the mirror with a reflector object
                        const mirrorGeometry = new THREE.PlaneGeometry(0.8, 1.6, 1, 1);
                        const mirror = new Reflector(mirrorGeometry, {
                            clipBias: 0.003,
                            textureWidth: window.innerWidth * window.devicePixelRatio,
                            textureHeight: window.innerHeight * window.devicePixelRatio,
                            color: 0xbbbbbb
                        });

                        mirror.position.copy(item.position);
                        mirror.rotation.set(0, -Math.PI / 2, 0)

                        threeMng.mirrorBase = item;
                        threeMng.mirrorReflector = mirror;
                        threeMng.mirrorReflector.visible = false;

                        threeMng.scene.add(threeMng.mirrorReflector);
                    }

                    // if (item.material.name === "polaroid"){
                    //     // log positions of the polaroids in the gltf
                    //     console.log([Math.round(item.position.x * 1000)/1000, Math.round(item.position.y * 1000)/1000].join(", "))
                    // }
                }

                if (item.name === "inner_sky") {
                    item.material.color = new THREE.Color(1, 1, 1);
                    item.material.blending = THREE.AdditiveBlending;
                    item.material.opacity = 0.2;

                    item.castShadow = false;
                    item.receiveShadow = false;

                    threeMng.innerSky = item;
                }

                if (item.name === "colored_sky") {
                    item.material.color = new THREE.Color(0, 0, 0);
                    item.material.opacity = 0.8;

                    item.castShadow = false;
                    item.receiveShadow = false;

                    threeMng.coloredSky = item;
                }

                if (item.name === "outer_sky") {
                    item.castShadow = false;
                    item.receiveShadow = false;

                    threeMng.outerSky = item;
                }
            })

            threeMng.scene.add(room);
        })

        this.light = new THREE.PointLight(0xffe7d0, 3, 0, 1);
        this.light.position.set(2.93, 2.08, 0);
        this.light.castShadow = true;
        this.light.shadow.mapSize.width = 128;
        this.light.shadow.mapSize.height = 128;
        this.light.shadow.radius = 2;
        this.light.shadow.blurSamples = 25;
        this.light.shadow.bias = -0.0001;
        this.light.shadow.camera.near = 0.1;
        this.light.shadow.camera.far = 500;

        this.lamp = new THREE.PointLight(0xffe7d0, 1, 0, 1);
        this.lamp.position.set(4, 1.2, -1.6);
        this.lamp.castShadow = true;
        this.lamp.shadow.mapSize.width = 128;
        this.lamp.shadow.mapSize.height = 128;
        this.lamp.shadow.radius = 2;
        this.lamp.shadow.blurSamples = 25;
        this.lamp.shadow.bias = -0.0001;
        this.lamp.shadow.camera.near = 0.1;
        this.lamp.shadow.camera.far = 500;

        this.moodLight = new THREE.RectAreaLight(0xffffff, 0.5, 5, 3);
        this.moodLight.position.set(3.30, 2.67, -0.05);
        this.moodLight.lookAt(this.moodLight.position.x, -10, this.moodLight.position.z);

        const ambientLight = new THREE.AmbientLight(0xd4f8ff, 0.2);

        this.scene.add(this.light);
        this.scene.add(this.lamp);
        this.scene.add(this.moodLight);
        this.scene.add(ambientLight);
    }

    initCamera() {
        this.camera = new THREE.PerspectiveCamera(THREE.MathUtils.clamp(baseFov / (window.innerWidth / window.innerHeight) * 1.5, minFov, maxFov), window.innerWidth / window.innerHeight, 0.1, 1000);
        this.cameraControls = new CameraControls(this.camera, this.renderer.domElement);
        this.clock = new THREE.Clock();

        let cameraPos = cameraPositions[this.cameraPosIndex].pos
        let cameraRot = cameraPositions[this.cameraPosIndex].rot
        this.camera.position.set(cameraPos[0], cameraPos[1], cameraPos[2]);
        this.cameraControls.rotateTo(cameraRot[0], cameraRot[1], false);
        this.cameraControls.distance = this.cameraControls.minDistance = this.cameraControls.maxDistance = 0.1;

        this.cameraControls.mouseButtons.left = CameraControls.ACTION.NONE;
        this.cameraControls.mouseButtons.right = CameraControls.ACTION.NONE;
        this.cameraControls.mouseButtons.middle = CameraControls.ACTION.NONE;
        this.cameraControls.mouseButtons.wheel = CameraControls.ACTION.NONE;
        this.cameraControls.touches.one = CameraControls.ACTION.NONE;
        this.cameraControls.touches.two = CameraControls.ACTION.NONE;
        this.cameraControls.touches.three = CameraControls.ACTION.NONE;

        this.cameraControls.saveState();
        this.cameraControls.update(this.clock.getDelta())
    }

    initControls() {
        this.inputX = 0;
        this.inputY = 0;
        this.isTouching = false;

        // track the cursor/finger position
        document.addEventListener("mousemove", (event) => {
            this.inputX = (event.clientX / window.innerWidth) * 2 - 1;
            this.inputY = -(event.clientY / window.innerHeight) * 2 + 1;
            this.isTouching = true;
        });

        document.addEventListener("touchstart", (event) => {
            if (event.touches.length === 1) {
                this.inputX = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
                this.inputY = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
                this.isTouching = true;
            }
        });

        document.addEventListener("touchmove", (event) => {
            if (event.touches.length === 1) {
                this.inputX = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
                this.inputY = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
                this.isTouching = true;
            }
        });

        document.addEventListener("touchend", (event) => {
            setTimeout(() => {
                this.isTouching = false;
            }, 1000 / 30); // delay to fix bug where it gets stuck
        });

        document.addEventListener("touchcancel", (event) => {
            setTimeout(() => {
                this.isTouching = false;
            }, 1000 / 30);
        });

        document.addEventListener("mouseleave", (event) => {
            setTimeout(() => {
                this.isTouching = false;
            }, 1000 / 30);
        });

        leftArrow.forEach((leftArrow) => leftArrow.addEventListener("click", () => this.goLeft()));
        rightArrow.forEach((rightArrow) => rightArrow.addEventListener("click", () => this.goRight()));
    }

    initBigLyrics() {
        this.bigLyrics = new Text();
        this.scene.add(this.bigLyrics);
        this.textObjects.push(this.bigLyrics);

        // set properties for the text
        this.bigLyrics.fontSize = BASE_TEXT_SIZE;
        this.bigLyrics.font = "src/assets/fonts/NotoSansJP-Bold.ttf"

        this.bigLyrics.textAlign = "center"
        this.bigLyrics.anchorX = "50%";
        this.bigLyrics.anchorY = "50%";
        this.bigLyrics.outlineOffsetX = "8%";
        this.bigLyrics.outlineOffsetY = "6%";
        this.bigLyrics.sdfGlyphSize = lyricsData.glyphSize;

        this.bigLyrics.position.set(...cameraPositions[this.cameraPosIndex].text);
        this.bigLyrics.lookAt(...cameraPositions[this.cameraPosIndex].pos);
    }

    initFloatingChars() {
        for (let i = 0; i < lyricsData.floatingChars.length; i++) {
            let currChar = lyricsData.floatingChars[i];
            if (currChar.object == null) {
                let charObject = new Text();
                this.scene.add(charObject);

                charObject.fontSize = WINDOW_TEXT_SIZE;
                charObject.font = "src/assets/fonts/NotoSansJP-Bold.ttf"

                charObject.textAlign = "center"
                charObject.anchorX = "50%";
                charObject.anchorY = "50%";
                charObject.outlineOffsetX = "8%";
                charObject.outlineOffsetY = "6%";
                charObject.sdfGlyphSize = lyricsData.glyphSize;
                charObject.text = currChar.text;

                charObject.position.set(...currChar.currentPosition);
                charObject.rotation.y = Math.PI;
                charObject.rotation.z = (0.5 - Math.random()) / 4;

                currChar.object = charObject;
            }
        }
    }

    initTv() {
        this.tvInstances = [];

        for (let i = 0; i < TV_INSTANCE_COUNT; i++) {
            let tvInstance = new Text();
            tvInstance.position.set(0.29, 1.24, -0.05);
            tvInstance.rotation.y = Math.PI / 2;
            tvInstance.clipRect = [-0.79, -0.42, 0.79, 0.46]

            tvInstance.fontSize = 0.1;
            tvInstance.font = "src/assets/fonts/NotoSansJP-Bold.ttf"
            tvInstance.text = ""
            tvInstance.textAlign = "center"
            tvInstance.anchorX = "50%";
            tvInstance.anchorY = "50%";
            tvInstance.sdfGlyphSize = lyricsData.glyphSize;

            tvInstance.depthTest = false;
            tvInstance.transparent = true;

            tvInstance.sync();
            this.scene.add(tvInstance);
            this.tvInstances.push(tvInstance);
            this.textObjects.push(tvInstance);
        }
    }

    initNotebook() {
        this.notebookText = new Text();
        this.scene.add(this.notebookText)
        this.textObjects.push(this.notebookText);

        this.notebookText.fontSize = NOTEBOOK_TEXT_SIZE;
        this.notebookText.lineHeight = 1.02;
        this.notebookText.color = (0, 0, 0);
        this.notebookText.font = "src/assets/fonts/Yomogi-Regular.ttf"

        this.notebookText.sdfGlyphSize = lyricsData.glyphSize;

        this.notebookText.position.set(1.65, 0.35, 0.25);
        this.notebookText.rotation.x = -Math.PI / 2;
        this.notebookText.rotation.z = 16 * Math.PI / 31;
    }

    initPolaroids() {
        this.polaroids = [];

        for (let i = 0; i < POLAROID_COUNT; i++) {
            let polaroidText = new Text();
            let position = polaroidPositions[i];
            polaroidText.position.set(position[0], position[1], position[2]);
            polaroidText.rotation.z = position[3];

            polaroidText.fontSize = POLAROID_TEXT_SIZE;
            polaroidText.font = "src/assets/fonts/NotoSansJP-Bold.ttf"
            polaroidText.text = ""

            polaroidText.textAlign = "center"
            polaroidText.anchorX = "50%";
            polaroidText.anchorY = "50%";
            polaroidText.outlineBlur = 0.05;
            polaroidText.sdfGlyphSize = lyricsData.glyphSize;

            polaroidText.sync();
            this.scene.add(polaroidText);
            this.polaroids.push(polaroidText);
            this.textObjects.push(polaroidText);
        }
    }

    initPostProcessing() {
        this.composer = new EffectComposer(this.renderer);

        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        const params = {
            shape: 4,
            radius: 4,
            rotateR: 0,
            rotateB: 0,
            rotateG: 0,
            scatter: 0,
            blending: 0.5,
            blendingMode: 0,
            greyscale: false,
            disable: false
        };

        const halftonePass = new HalftonePass(window.innerWidth, window.innerHeight, params);
        // this.composer.addPass(halftonePass);

        const outputPass = new OutputPass();
        this.composer.addPass(outputPass);
    }

    updateBigLyrics() {
        if (this.cameraPosIndex !== BEDROOM && this.cameraPosIndex !== FULL_VIEW) {
            this.bigLyrics.visible = false;
        } else {
            if (lyricsData.word) {
                this.bigLyrics.visible = true;
                this.bigLyrics.text = lyricsData.word.text;
                this.bigLyrics.fontSize = BASE_TEXT_SIZE * lyricsData.textScale;
                this.bigLyrics.letterSpacing = lyricsData.stretch / 10;
                this.bigLyrics.scale.set(1 + (lyricsData.stretch) ** 3, 1 - (lyricsData.stretch) ** 3);
                this.bigLyrics.outlineColor = lyricsData.moodColor;
            } else {
                this.bigLyrics.text = "";
            }
        }

        this.bigLyrics.sync();
    }

    updateFloatingChars() {
        for (let i = 0; i < lyricsData.floatingChars.length; i++) {
            let currChar = lyricsData.floatingChars[i];

            if (this.cameraPosIndex === WINDOW) {
                // only calculate for the positions where you can see the window
                if (0 < currChar.currentPosition[0] < 3.5) {
                    // only run calculations for characters in frame
                    currChar.object.visible = true;

                    // Increment position of char based on a normalized vector of the end - start position
                    currChar.currentPosition[0] = currChar.startPosition[0] + currChar.movementVector[0] * (player.videoPosition - currChar.creationTime + 200) * 0.001;
                    currChar.currentPosition[1] = currChar.startPosition[1] + currChar.movementVector[1] * (player.videoPosition - currChar.creationTime + 200) * 0.001;
                    currChar.currentPosition[2] = currChar.startPosition[2] + currChar.movementVector[2] * (player.videoPosition - currChar.creationTime + 200) * 0.001;

                    currChar.object.outlineColor = lyricsData.moodColor;
                    currChar.object.position.set(...currChar.currentPosition);
                    currChar.object.sync();
                } else {
                    currChar.object.visible = false;
                }
            } else {
                currChar.object.visible = false;
            }
        }
    }

    updateTv() {
        let lastWord = lyricsData.wordList.length - 1;
        for (let i = 0; i < lyricsData.wordList.length; i++) {
            if (lyricsData.wordList[i]._data.startTime > player.videoPosition) {
                lastWord = i - 1;
                while (lyricsData.wordList[lastWord] === "　") {
                    lastWord -= 1;
                }
                break;
            }
        }

        this.tvInstances.forEach((instance, i) => {
            if (lyricsData.wordList[lastWord]) {
                if (lastWord % TV_INSTANCE_COUNT === i) {
                    const age = position - lyricsData.wordList[lastWord].startTime;
                    instance.fontSize = 0.1 * (age / 500) ** 2;
                    instance.fillOpacity = Math.max(0.995 ** (age / 300) ** 4, 0.001);
                    instance.letterSpacing = 0.1 * (age / 500) ** 2
                    instance.anchorY = `${50 - (age / 50)}%`

                    instance.text = lyricsData.wordList[lastWord].text;
                    instance.depthOffset = 0;
                    instance.renderOrder = 0;
                    instance.visible = true;
                } else {
                    const relativeIndex = (((lastWord % TV_INSTANCE_COUNT - i) % TV_INSTANCE_COUNT) + TV_INSTANCE_COUNT) % TV_INSTANCE_COUNT // weird modulo to fix javascript bug
                    if (lastWord - relativeIndex >= 0) {
                        const age = position - lyricsData.wordList[lastWord - relativeIndex].startTime;
                        if (age > 3000) {
                            instance.visible = false;
                        }

                        instance.fontSize = 0.1 * (age / 500) ** 2;
                        instance.fillOpacity = Math.max(0.995 ** (age / 300) ** 4, 0.001);
                        instance.letterSpacing = 0.1 * (age / 500) ** 2
                        instance.anchorY = `${50 - (age / 50)}%`

                        instance.text = lyricsData.wordList[lastWord - relativeIndex]
                        instance.depthOffset = -relativeIndex;
                        instance.renderOrder = relativeIndex;
                    }
                }

            }

            if (lastWord === -1) {
                instance.text = "";
            }

            instance.sync();

        })
    }

    updateNotebook() {
        // Find the last character to be rendered
        let lastChar = lyricsData.sortedCharsList.length - 1;
        for (let i = 0; i < lyricsData.sortedCharsList.length; i++) {
            if (lyricsData.sortedCharsList[i]._data.startTime > player.videoPosition) {
                lastChar = i - 1;
                while (lyricsData.sortedCharsList[lastChar] === "　") {
                    lastChar -= 1;
                }
                break;
            }
        }

        let newText = [];
        let cnt = 0;

        let startPos = Math.max(0, Math.floor(lastChar / (MAX_CHARS_PER_LINE * MAX_LINES)) * MAX_CHARS_PER_LINE * MAX_LINES)
        for (let i = startPos; i <= lastChar; i++) {
            newText.push(lyricsData.sortedCharsList[i].text);
            if (cnt % MAX_CHARS_PER_LINE === MAX_CHARS_PER_LINE - 1) {
                newText.push("\n");
            }
            cnt += 1;
        }

        if (!(newText.length === 1 && newText[0] === "　")) {
            this.notebookText.text = newText.join("");
            this.notebookText.sync();
        }
    }

    updatePolaroids() {
        let lastChar = lyricsData.rawCharList.length - 1;
        for (let i = 0; i < lyricsData.rawCharList.length; i++) {
            if (lyricsData.rawCharList[i]._data.startTime > player.videoPosition) {
                lastChar = i - 1;
                while (lyricsData.rawCharList[lastChar] === "　") {
                    lastChar -= 1;
                }
                break;
            }
        }

        this.polaroids.forEach((polaroid, i) => {
            if (lyricsData.rawCharList[lastChar]) {
                if (lastChar % POLAROID_COUNT === i) {
                    polaroid.text = lyricsData.rawCharList[lastChar].text;
                    polaroid.fillOpacity = 1;
                    polaroid.outlineOpacity = 1;
                    polaroid.outlineColor = lyricsData.moodColor;

                    const outlineAge = position - lyricsData.rawCharList[lastChar].startTime
                    polaroid.outlineOpacity = 0.995 ** outlineAge;

                    // text movement (exaggerated, because it's smaller)
                    polaroid.fontSize = POLAROID_TEXT_SIZE * lyricsData.textScale ** 2;
                    polaroid.scale.set(1 + lyricsData.stretch / 5, 1 - lyricsData.stretch / 5);
                } else {
                    // calculate how far behind the active polaroid this polaroid is
                    const relativeIndex = (((lastChar % POLAROID_COUNT - i) % POLAROID_COUNT) + POLAROID_COUNT) % POLAROID_COUNT // weird modulo to fix javascript bug
                    if (lastChar - relativeIndex >= 0) {
                        const fillAge = position - lyricsData.rawCharList[lastChar - relativeIndex].endTime;
                        polaroid.text = lyricsData.rawCharList[lastChar - relativeIndex]

                        // fade out polaroids age they age
                        polaroid.fillOpacity = 0.995 ** fillAge;
                        polaroid.outlineOpacity = 0;
                    }
                }

            }

            if (lastChar === -1) {
                polaroid.text = "";
            }

            polaroid.sync();
        })
    }

    update(pos) {
        let cameraPos = cameraPositions[this.cameraPosIndex].pos
        let cameraRot = cameraPositions[this.cameraPosIndex].rot

        if (lyricsData.textLoaded) {
            this.updateAllText();
        }

        // calculate colors to update lighting based on valence/arousal values
        this.moodLight.color = lyricsData.moodColor;

        // update sky rotation
        if (this.innerSky && this.coloredSky && this.outerSky) {
            this.innerSky.rotation.y = -1 / 6000 * pos * this.skySpeed;
            this.coloredSky.material.color = new THREE.Color().addColors(lyricsData.moodColor, new THREE.Color(0.2, 0.2, 0.2));
            this.coloredSky.rotation.y = 1 / 6000 * pos * this.skySpeed;
            this.outerSky.rotation.y = -1 / 8000 * pos * this.skySpeed;
        }

        // set camera movement modifier
        let movementDampener = 100 / this.camera.fov;
        if (this.inputX ** 2 + this.inputY ** 2 > 1) {
            movementDampener = 100 / (this.inputX ** 2 + this.inputY ** 2) ** 0.5 / this.camera.fov;
        } // if the cursor exits the radius, scale the strength of the movement down in tandem with how far the cursor goes

        if (this.isTouching) {
            // easy math to make the camera translate along its local z plane instead of the global one
            let forward = this.camera.getWorldDirection(new THREE.Vector3()).negate();
            let up = this.camera.up.clone();
            let right = new THREE.Vector3().crossVectors(forward, up);
            let movementX = right.multiplyScalar(-this.inputX * this.movementStrength * movementDampener);
            let movementY = up.multiplyScalar(this.inputY * this.movementStrength * movementDampener);
            let targetPosition = new THREE.Vector3(...cameraPos).add(movementX).add(movementY);

            this.cameraControls.moveTo(targetPosition.x, targetPosition.y, targetPosition.z, true);
            this.cameraControls.rotateTo(cameraRot[0] - this.inputX * this.rotateStrength, cameraRot[1] + this.inputY * this.rotateStrength, true)
        } else {
            // set to default positions
            this.cameraControls.moveTo(cameraPos[0], cameraPos[1], cameraPos[2], true)
            this.cameraControls.rotateTo(cameraRot[0], cameraRot[1], true)
        }

        this.cameraControls.update(this.clock.getDelta())
        this.composer.render(this.scene, this.camera);
    }

    initAllThree() {
        return new Promise((resolve, reject) => {
            try {
                this.initScene();
                this.initCamera();
                this.initControls();
                this.initPostProcessing();
                resolve(this.ready = true);
            } catch (error) {
                reject(error);
            }
        });
    }

    initAllText() {
        return new Promise((resolve, reject) => {
            try {
                threeMng.textObjects.forEach((object => {
                    threeMng.scene.remove(object);
                    object.dispose();
                }));

                this.initBigLyrics();
                this.initFloatingChars();
                this.initTv();
                this.initNotebook();
                this.initPolaroids();

                lyricsData.initCharList();
                lyricsData.initWordList();
                resolve(lyricsData.textLoaded = true);
            } catch (error) {
                reject(error);
            }
        });
    }

    updateAllText() {
        this.updateBigLyrics();
        this.updateFloatingChars();
        this.updateTv();
        this.updateNotebook();
        this.updatePolaroids();
    }

    resize() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio)

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.fov = THREE.MathUtils.clamp(baseFov / this.camera.aspect * 1.5, minFov, maxFov);

        this.camera.updateProjectionMatrix();
        this.update()
    }

}

initMain();