// import necessary modules
import {Player} from "textalive-app-api";
import * as THREE from "three";

import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {Reflector} from 'three/addons/objects/Reflector.js';
import {Text} from 'troika-three-text';
import WebGL from "three/addons/capabilities/WebGL.js";
import CameraControls from 'camera-controls';

CameraControls.install({THREE: THREE});

import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {HalftonePass} from 'three/addons/postprocessing/HalftonePass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

import {
    maxTextScale,
    minTextScale,
    baseTextSize,
    baseFov,
    minFov,
    maxFov,
    songList,
    cameraPositions,
    BEDROOM,
    FULL_VIEW,
} from "./constants";

// lyrics information
class LyricsData {
    constructor() {
        this.char = "";
        this.word = "";
        this.phrase = "";
        this.text = "";

        this.floatingChars = [];
        this.previousUnits = new Set();
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

        this.moodColor = new THREE.Color(1, 1, 1);
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

            this.moodColor = new THREE.Color(THREE.MathUtils.clamp(r, 0, 1),
                THREE.MathUtils.clamp(g, 0, 1),
                THREE.MathUtils.clamp(b, 0, 1)).offsetHSL(0, 1, 0);
        } else {
            this.moodColor = new THREE.Color(1, 1, 1);
        }
    }

    normalizeValenceArousal(valenceArousal) {
        [this.valence, this.arousal] = [(valenceArousal.v + 1) / 2, (valenceArousal.a + 1) / 2];
    }
}

// global variables
let player, threeMng;
let lyricsData = new LyricsData();
let position = 0;

// initialize html elements
const playBtns = document.querySelectorAll(".play");
const pauseBtn = document.querySelector("#pause");
const volumeSlider = document.querySelector("#volume");
const progressBar = document.querySelector("#progress");
const songSelector = document.querySelector("#song");
const customSong = document.querySelector("#custom-song");
const accessibility = document.querySelector("#accessibility");
const leftArrow = document.querySelector(".left");
const rightArrow = document.querySelector(".right");

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
    if (!app.managed) {
        document.querySelector("#control").style.display = "block";

        // set up controls
        playBtns.forEach((playBtn) => playBtn.addEventListener("click", () => {
            player.video && player.requestPlay();
        }));

        pauseBtn.addEventListener("click", () => player.video && player.requestPause());

        volumeSlider.addEventListener("input", () => {
            player.volume = volumeSlider.value;
            volumeSlider.style.background = `linear-gradient(90deg, #78f0d7 ${volumeSlider.value}%, #d3d3d3 ${volumeSlider.value}%)`;
        });

        progressBar.addEventListener("input", () => player.requestMediaSeek(progressBar.value * player.video.duration));

        songSelector.addEventListener("change", () => {
            if (songSelector.value >= 0) { // non-custom song
                customSong.style.display = "none";
                loadSong(songSelector.value, false);
            } else { // custom song
                customSong.style.display = "inline";
                loadSong(customSong.value, true);
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
                } else {
                    threeMng.movementStrength = 1 / 10;
                    threeMng.rotateStrength = 1 / 12;
                    threeMng.cameraControls.smoothTime = 0.25;
                }
            }
        });
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
}

function onTimerReady(t) {
    if (!player.app.managed) {
        document
            .querySelectorAll("#control *")
            .forEach((item) => (item.disabled = false));
    }

    // generate progress bar with css gradients
    const choruses = player.getChoruses();
    const colors = ['#78f0d7', '#ff629d'];
    let progressGradient = 'linear-gradient(60deg, ';

    if (choruses.length === 0) {
        progressGradient += `${colors[0]} 0%, ${colors[0]} 100%`;
    } else {
        // place colors at the choruses
        progressGradient += `${colors[0]} 0%, `;
        for (let i = 0; i < choruses.length; i++) {
            let startPercentage = (choruses[i].startTime / player.video.duration) * 100;
            let endPercentage = (choruses[i].endTime / player.video.duration) * 100;
            if (i === 0) {
                // start with non-chorus
                progressGradient += `${colors[0]} ${startPercentage}%, `;
            } else if (i > 0) {
                // end the non-chorus segment with a stop
                progressGradient += `${colors[0]} ${startPercentage}%, `;
            }
            // place the chorus segment stops
            progressGradient += `${colors[1]} ${startPercentage}%, ${colors[1]} ${endPercentage}%, `;
            if (i < choruses.length - 1) {
                // close off the last chorus with a non-chorus stop
                progressGradient += `${colors[0]} ${endPercentage}%, `;
            }
        }
    }
    progressGradient = progressGradient.slice(0, -2); // remove trailing comma and space
    progressGradient += ')';

    progressBar.style.background = progressGradient;
}

function onTimeUpdate(pos) {
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
    playBtns.forEach((playBtn) => playBtn.style.display = "inline");
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
    lyricsData.textOverride = true;
    lyricsData.text = "loading...";

    // reset ui
    progressBar.style.background = "repeating-linear-gradient(60deg, #d3d3d3 0%, #d3d3d3 5%, #a9a9a9 5%, #a9a9a9 10%)";
    progressBar.value = 0;
    document
        .querySelectorAll("#control *")
        .forEach((item) => (item.disabled = true));
    accessibility.disabled = false;
    volumeSlider.disabled = false;

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
            lyricsData.maxAmplitude = player.getMaxVocalAmplitude()
            lyricsData.normalizeValenceArousal(player.getValenceArousal(0));
        });
    } else { // fetch from songle
        if (checkUrl(value)) {
            player.createFromSongUrl(value).then(() => {
                lyricsData.maxAmplitude = player.getMaxVocalAmplitude()
                lyricsData.normalizeValenceArousal(player.getValenceArousal(0));
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
    if (!lyricsData.previousUnits.has(unit)) {
        let randomNum = 0.5 - Math.random();
        while (Math.abs(randomNum - lyricsData.previousRandom) < 0.2) {
            randomNum = 0.5 - Math.random();
        }
        lyricsData.previousRandom = randomNum;
        lyricsData.language = player.video.findWord(unit.startTime + 1).language;

        if (lyricsData.language === "en") {
            // place the text closer if it's english
            lyricsData.floatingChars.push({
                text: unit.text,
                object: null,
                startPosition: [1.3, 1.75 - lyricsData.enIndex * 0.2, 3.2],
                creationTime: unit.startTime,
                movementVector: [1, 0, 0],
                currentPosition: [0, 0, 0],
            });

            lyricsData.enIndex = (lyricsData.enIndex + 1) % 5
        } else {
            lyricsData.floatingChars.push({
                text: unit.text,
                object: null,
                startPosition: [1.3, 1.35 + randomNum, 3.2 + (0.5 - Math.random())],
                creationTime: unit.startTime,
                movementVector: [1, 0, 0],
                currentPosition: [0, 0, 0],
            });

            lyricsData.enIndex = 0
        }

        lyricsData.char = unit.text;
        lyricsData.previousUnits.add(unit);
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
    if (threeMng.composer && threeMng.innerSky && threeMng.coloredSky && threeMng.outerSky) {
        // only update once everything is done loading
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

        this.innerSky = null;
        this.coloredSky = null;
        this.outerSky = null;

        leftArrow.addEventListener("click", () => {
            this.goLeft();
        });
        rightArrow.addEventListener("click", () => {
            this.goRight();
        });

        this.renderer.shadowMap.enabled = true;
        this.renderer.autoClear = false;
        // renderer.shadowMap.autoUpdate = false;

        this.initScene();
        this.initCamera();
        this.initControls();
        this.initLyrics();
        this.initPostProcessing();
    }

    goLeft() {
        this.cameraPosIndex -= 1;
        this.cameraPosIndex = (this.cameraPosIndex + cameraPositions.length) % cameraPositions.length;

        this.lyrics.position.set(...cameraPositions[this.cameraPosIndex].text);
        this.lyrics.lookAt(...cameraPositions[this.cameraPosIndex].pos);
    }

    goRight() {
        this.cameraPosIndex += 1;
        this.cameraPosIndex = (this.cameraPosIndex + cameraPositions.length) % cameraPositions.length;

        this.lyrics.position.set(...cameraPositions[this.cameraPosIndex].text);
        this.lyrics.lookAt(...cameraPositions[this.cameraPosIndex].pos);
    }

    initScene() {
        this.scene = new THREE.Scene();
        const loader = new GLTFLoader();

        loader.load("src/assets/models/bedroom_base.glb", function (gltf) {
            const room = gltf.scene;
            let mirrorBase;

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
                }

                if (item.material) {
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

                        mirrorBase = item;
                        threeMng.scene.add(mirror);
                    }
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

            mirrorBase.parent.remove(mirrorBase);
            threeMng.scene.add(room);
        })

        const light = new THREE.PointLight(0xffe7d0, 3, 0, 1);
        light.position.set(3.03, 2.078, 0.05);
        light.castShadow = true;

        this.moodLight = new THREE.RectAreaLight(0xffffff, 0.5, 5, 3);
        this.moodLight.position.set(3.30, 2.67, -0.05);
        this.moodLight.lookAt(this.moodLight.position.x, -10, this.moodLight.position.z);

        const ambientLight = new THREE.AmbientLight(0xd4f8ff, 0.2);

        this.scene.add(light);
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
        })

        document.addEventListener("touchstart", (event) => {
            if (event.touches.length === 1) {
                this.inputX = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
                this.inputY = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
                this.isTouching = true;
            }
        })

        document.addEventListener("touchmove", (event) => {
            if (event.touches.length === 1) {
                this.inputX = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
                this.inputY = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
                this.isTouching = true;
            }
        })

        document.addEventListener("touchend", (event) => {
            setTimeout(() => {
                this.isTouching = false;
            }, 1000 / 30); // delay to fix bug where it gets stuck
        })

        document.addEventListener("touchcancel", (event) => {
            setTimeout(() => {
                this.isTouching = false;
            }, 1000 / 30);
        })

        document.addEventListener("mouseleave", (event) => {
            setTimeout(() => {
                this.isTouching = false;
            }, 1000 / 30);
        })
    }

    initLyrics() {
        this.lyrics = new Text();
        this.scene.add(this.lyrics);

        // set properties for the text
        this.lyrics.fontSize = baseTextSize;
        this.lyrics.font = "src/assets/fonts/NotoSansJP-Bold.ttf"

        this.lyrics.textAlign = "center"
        this.lyrics.anchorX = "50%";
        this.lyrics.anchorY = "50%";
        this.lyrics.outlineOffsetX = "8%";
        this.lyrics.outlineOffsetY = "6%";
        this.lyrics.outlineColor = (0, 0, 0);
        this.lyrics.sdfGlyphSize = 128;

        this.lyrics.position.set(...cameraPositions[this.cameraPosIndex].text);
        this.lyrics.lookAt(...cameraPositions[this.cameraPosIndex].pos);
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

    // Draws all current floating characters
    updateFloatingChars() {
        for (let i = 0; i < lyricsData.floatingChars.length; i++) {
            let currChar = lyricsData.floatingChars[i];
            if (currChar.object == null) {
                let charObject = new Text();
                this.scene.add(charObject);

                charObject.fontSize = baseTextSize / 4;
                charObject.font = "src/assets/fonts/NotoSansJP-Bold.ttf"

                charObject.textAlign = "center"
                charObject.anchorX = "50%";
                charObject.anchorY = "50%";
                charObject.outlineOffsetX = "8%";
                charObject.outlineOffsetY = "6%";
                charObject.sdfGlyphSize = 128;
                charObject.text = currChar.text;

                // TODO: Make the lyrics face the right direction
                charObject.position.set(...currChar.currentPosition);
                charObject.rotation.y = Math.PI;
                charObject.rotation.z = (0.5 - Math.random()) / 4;

                currChar.object = charObject;
            }

            currChar.currentPosition[0] = currChar.startPosition[0] + currChar.movementVector[0] * (player.videoPosition - currChar.creationTime) * 0.001;
            currChar.currentPosition[1] = currChar.startPosition[1] + currChar.movementVector[1] * (player.videoPosition - currChar.creationTime) * 0.001;
            currChar.currentPosition[2] = currChar.startPosition[2] + currChar.movementVector[2] * (player.videoPosition - currChar.creationTime) * 0.001;

            currChar.object.outlineColor = lyricsData.moodColor;
            currChar.object.position.set(...currChar.currentPosition);
            currChar.object.sync();

            // Increment position of char based on a normalized vector of the end - start position
            // Render the char
            // If char has reached the target position, 
        }
    }

    update(pos) {
        let cameraPos = cameraPositions[this.cameraPosIndex].pos
        let cameraRot = cameraPositions[this.cameraPosIndex].rot

        this.updateFloatingChars();

        // update lyrics
        this.lyrics.text = lyricsData.word;
        this.lyrics.fontSize = baseTextSize * lyricsData.textScale;
        this.lyrics.letterSpacing = lyricsData.stretch / 10;
        this.lyrics.scale.set(1 + (lyricsData.stretch) ** 3, 1 - (lyricsData.stretch) ** 3);
        // TODO: Do this in a better way
        if (this.cameraPosIndex != BEDROOM && this.cameraPosIndex != FULL_VIEW) {
            this.lyrics.text = "";
        }
        this.lyrics.sync();

        // calculate colors to update lighting based on valence/arousal values
        this.moodLight.color = lyricsData.moodColor;
        this.lyrics.outlineColor = lyricsData.moodColor;

        this.innerSky.rotation.y = -1 / 6000 * pos;

        this.coloredSky.material.color = new THREE.Color().addColors(lyricsData.moodColor, new THREE.Color(0.2, 0.2, 0.2));
        this.coloredSky.rotation.y = 1 / 6000 * pos;

        this.outerSky.rotation.y = -1 / 8000 * pos;

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