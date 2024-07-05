// import necessary modules
import {Player} from "textalive-app-api";
import * as THREE from "three";

import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {Reflector} from 'three/addons/objects/Reflector.js';
import {Text} from 'troika-three-text';
import WebGL from "three/addons/capabilities/WebGL.js";
import CameraControls from 'camera-controls';

CameraControls.install({THREE: THREE});
import {maxTextScale, minTextScale, baseTextSize, baseFov, minFov, maxFov, songList, cameraPositions} from "./constants";

// lyrics information
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
        this.valence = -1;
        this.arousal = -1;
    }

    // calculate text effects
    update(amplitude, valenceArousal) {
        this.textScaleDelta = this.textScale
        this.ratio = amplitude / this.maxAmplitude;
        this.normalizeValenceArousal(valenceArousal);

        // algorithm that scales the text (but scales less when the scale is already extreme)
        this.textScale = minTextScale + (maxTextScale - minTextScale) * Math.log(this.ratio * maxTextScale + 1) / Math.log(maxTextScale + 1)

        // determine squash & stretch from how the scale change
        this.stretch += (this.textScale - this.textScaleDelta) * 5;
        this.stretch *= 0.9999; // decay squash & stretch
        this.stretch = THREE.MathUtils.clamp(this.stretch, -0.7, 0.7); // clamp squash & stretch
    }

    normalizeValenceArousal(valenceArousal) {
        [this.valence, this.arousal] = [(valenceArousal.v + 1) / 2, (valenceArousal.a + 1) / 2];
    }
}

// global variables
let player, threeMng;
let lyricsData = new LyricsData();

// initialize html elements
const playBtns = document.querySelectorAll(".play");
const pauseBtn = document.querySelector("#pause");
const volumeSlider = document.querySelector("#volume");
const progressBar = document.querySelector("#progress");
const songSelector = document.querySelector("#song");
const customSong = document.querySelector("#custom-song");
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

        volumeSlider.addEventListener("input", () => player.volume = volumeSlider.value);

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

    console.log(player.getChoruses())

    // generate progress bar with css gradients
    const choruses = player.getChoruses();
    const colors = ['red', 'blue'];
    let progressGradient = 'linear-gradient(90deg, ';

    if (choruses.length === 0) {
        // If there's no chorus, make it solid of colors[0]
        progressGradient += `${colors[0]} 0%, ${colors[0]} 100%`;
    } else {
        // If there's a chorus, make it solid of colors[1] at that time
        for (let i = 0; i < choruses.length; i++) {
            let startPercentage = (choruses[i].startTime / player.video.duration) * 100;
            let endPercentage = (choruses[i].endTime / player.video.duration) * 100;
            if (i > 0) {
                // Add a colors[0] stop at the start of this chorus
                progressGradient += `${colors[0]} ${startPercentage}%, `;
            }
            progressGradient += `${colors[1]} ${startPercentage}%, ${colors[1]} ${endPercentage}%, `;
            if (i < choruses.length - 1) {
                // Add a colors[0] stop at the end of this chorus
                progressGradient += `${colors[0]} ${endPercentage}%, `;
            }
        }
    }
    progressGradient = progressGradient.slice(0, -2); // Remove trailing comma and space
    progressGradient += ')';

    progressBar.style.background = progressGradient;
}

function onTimerReady(t) {
    if (!player.app.managed) {
        document
            .querySelectorAll("#control *")
            .forEach((item) => (item.disabled = false));
    }
}

function onTimeUpdate(pos) {
    progressBar.value = pos / player.video.duration;
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

    // initialize lyrics data
    lyricsData = new LyricsData()
    lyricsData.textOverride = true;
    lyricsData.text = "loading...";

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
    threeMng.update();
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
        this.cameraPosIndex = 0;
        leftArrow.addEventListener("click", ()=>{
            this.goRight();
        });
        rightArrow.addEventListener("click", ()=>{
            this.goLeft();
        });

        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio)
        document.getElementById("view").appendChild(this.renderer.domElement);

        this.renderer.shadowMap.enabled = true;
        // renderer.shadowMap.autoUpdate = false;

        this.initScene();
        this.initCamera();
        this.initControls();
        this.initLyrics();
    }

    goLeft(){
        this.cameraPosIndex -= 1;
        this.cameraPosIndex = (this.cameraPosIndex + cameraPositions.length) % cameraPositions.length;
    }

    goRight(){
        this.cameraPosIndex += 1;
        this.cameraPosIndex = (this.cameraPosIndex + cameraPositions.length) % cameraPositions.length;
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x22eeff);
        const loader = new GLTFLoader();

        loader.load("src/assets/models/bedroom_base.glb", function (gltf) {
            let room = gltf.scene;
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

                if (item instanceof THREE.PerspectiveCamera) {
                    // log cameras
                    console.log(item.position, item.rotation)
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
                    }
                }
            })

            mirrorBase.parent.remove(mirrorBase);
            threeMng.scene.add(room);
        })

        const light = new THREE.PointLight(0xffe7d0, 3, 0, 1);
        light.position.set(3.3041769266128, 2.0788733959198, -0.049741268157958984);
        light.castShadow = true;

        this.moodLight = new THREE.RectAreaLight(0xffffff, 0.5, 5, 3);
        this.moodLight.position.set(3.3041769266128, 2.6788733959198, -0.049741268157958984);
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

        this.movementStrength = 1 / 10;
        this.rotateStrength = 1 / 12;

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
            }, 30); // delay to fix bug where it gets stuck
        })

        document.addEventListener("touchcancel", (event) => {
            setTimeout(() => {
                this.isTouching = false;
            }, 30);
        })

        document.addEventListener("mouseleave", (event) => {
            setTimeout(() => {
                this.isTouching = false;
            }, 30);
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

    update() {
        let cameraPos = cameraPositions[this.cameraPosIndex].pos
        let cameraRot = cameraPositions[this.cameraPosIndex].rot

        // update lyrics
        this.lyrics.text = lyricsData.word;
        this.lyrics.fontSize = baseTextSize * lyricsData.textScale;
        this.lyrics.letterSpacing = lyricsData.stretch / 10;
        this.lyrics.scale.set(1 + (lyricsData.stretch) ** 3, 1 - (lyricsData.stretch) ** 3);
        this.lyrics.sync();

        // calculate colors to update lighting based on valence/arousal values
        const r = (1.1 - lyricsData.valence) * 2
        const b = (0.85 - lyricsData.arousal) * 2
        const g = -0.5 * ((r ** 2 + b ** 2) ** 0.5 - 2)

        const moodColor = new THREE.Color(THREE.MathUtils.clamp(r, 0, 1), THREE.MathUtils.clamp(g, 0, 1), THREE.MathUtils.clamp(b, 0, 1))
        this.moodLight.color = moodColor.offsetHSL(0, 1, 0);
        this.lyrics.outlineColor = moodColor;
        this.scene.background = moodColor;

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
        this.renderer.render(this.scene, this.camera);
    }

    resize() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio)

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.fov = THREE.MathUtils.clamp(baseFov / this.camera.aspect * 1.5, minFov, maxFov);

        this.camera.updateProjectionMatrix();
        this.update()
    }
}

initMain();