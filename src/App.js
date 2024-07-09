// import necessary modules
const {Player} = TextAliveApp;

import * as THREE from "three";
import WebGL from "three/addons/capabilities/WebGL.js";
import {ThreeManager} from "./ThreeManager.js";
import {LyricsData} from "./LyricsData.js";

import {
    songList,
} from "./constants.js";

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

class AppManager {
    constructor() {
        this.lyricsData = new LyricsData(this);
        this.threeMng = new ThreeManager(this);
        this.position = 0;
        this.songId = 1;
        this.player = new Player({
            app: {
                appAuthor: "Andrew", appName: "miku miku", token: "voiEWpeaIFwNII7p",
            },
            mediaElement: document.querySelector("#media"),
            mediaBannerPosition: "top right",
            vocalAmplitudeEnabled: true,
            valenceArousalEnabled: true,
        });

        this.initMain();
    }

    // initialize main function
    initMain() {
        if (WebGL.isWebGLAvailable()) {
            window.addEventListener("resize", () => this.threeMng.resize());
            this.update();
        } else {
            const warning = WebGL.getWebGLErrorMessage();
            document.getElementById("view").appendChild(warning);
        }
        this._initPlayer();
    }

    // initialize textalive player
    _initPlayer() {
        this.player.addListener({
            onAppReady, onVideoReady, onTimerReady, onTimeUpdate, onPlay, onPause, onStop,
        });
        this.player.fps = 60;
    }

    loadSong(value, isCustom) {
        // song loading system
        this.songId = value;

        this.player.video && this.player.requestPause();
        this.player.volume = volumeSlider.value

        for (let i = 0; i < this.lyricsData.floatingChars.length; i++) {
            this.threeMng.scene.remove(this.lyricsData.floatingChars[i].object)
        }

        // initialize lyrics data
        this.lyricsData = new LyricsData(this);

        // reset ui
        progressBar.style.background = "repeating-linear-gradient(60deg, #d3d3d3 0%, #d3d3d3 5%, #a9a9a9 5%, #a9a9a9 10%)";
        document
            .querySelectorAll(".textalive-control")
            .forEach((item) => (item.disabled = true));

        if (!isCustom) {
            this.player.createFromSongUrl(songList[value][0], { // fetch from constants
                video: {
                    beatId: songList[value][1],
                    chordId: songList[value][2],
                    repetitiveSegmentId: songList[value][3],
                    lyricId: songList[value][4],
                    lyricDiffId: songList[value][5]
                }
            }).then(() => {
                customSong.disabled = true;
                this.lyricsData.maxAmplitude = this.player.getMaxVocalAmplitude()
                this.lyricsData.normalizeValenceArousal(this.player.getValenceArousal(0));
            });
        } else { // fetch from piapro
            if (checkUrl(value)) {
                customSong.disabled = false;
                this.player.createFromSongUrl(value).then(() => {
                    this.lyricsData.maxAmplitude = this.player.getMaxVocalAmplitude()
                    this.lyricsData.normalizeValenceArousal(this.player.getValenceArousal(0));
                });
            } else {
                this.lyricsData.text = "invalid url";

                document
                    .querySelectorAll(".textalive-control")
                    .forEach((item) => (item.disabled = false));
            }
        }
    }

    animateChar(pos, unit) {
        if (unit.contains(pos)) {
            this.lyricsData.char = unit.text;
        }

        this.lyricsData.update(this.player.getVocalAmplitude(pos), this.player.getValenceArousal(pos))
    }

    animateWord(pos, unit) {
        if (unit.contains(pos)) {
            this.lyricsData.word = unit.text;
        }
        this.lyricsData.update(this.player.getVocalAmplitude(pos), this.player.getValenceArousal(pos))
    }

    animatePhrase(pos, unit) {
        if (unit.contains(pos)) {
            this.lyricsData.phrase = unit.text;
        }
        this.lyricsData.update(this.player.getVocalAmplitude(pos), this.player.getValenceArousal(pos))
    }

    update() {
        if (this.threeMng.ready) {
            this.threeMng.update(this.position);
        }
        window.requestAnimationFrame(() => this.update());
    }

    checkUrl(urlString) {
        try {
            return Boolean(new URL(urlString));
        } catch (e) {
            return false;
        }
    }
}

let App = new AppManager();

function onAppReady(app) {
    // set up controls
    playBtn.addEventListener("click", () => App.player.video && App.player.requestPlay());

    pauseBtn.addEventListener("click", () => App.player.video && App.player.requestPause());

    volumeSlider.addEventListener("input", () => {
        App.player.volume = volumeSlider.value;
        volumeSlider.style.background = `linear-gradient(90deg, #78f0d7 ${volumeSlider.value}%, #a9a9a9 ${volumeSlider.value}%)`;
    });

    progressBar.addEventListener("input", () => App.player.requestMediaSeek(progressBar.value * App.player.video.duration));

    songSelector.addEventListener("change", () => {
        if (songSelector.value >= 0) { // non-custom song
            App.loadSong(songSelector.value, false);
        } else { // custom song
            // bring up settings
            settingsToggle.checked = true;
            settings.classList.add('show');
            setTimeout(() => {
                settings.style.pointerEvents = "auto";
            }, 100); // wait for the slide animation to finish playing

            App.loadSong(customSong.value, true);
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
        App.loadSong(customSong.value, true);
    });

    accessibility.addEventListener("change", () => {
        if (App.threeMng) {
            if (accessibility.checked) {
                App.threeMng.camera.movementStrength = 0;
                App.threeMng.camera.rotateStrength = 1 / 24;
                App.threeMng.camera.cameraControls.smoothTime = 0.1;
                App.threeMng.skySpeed = 0.1;
            } else {
                App.threeMng.camera.movementStrength = 1 / 10;
                App.threeMng.camera.rotateStrength = 1 / 12;
                App.threeMng.camera.cameraControls.smoothTime = 0.25;
                App.threeMng.skySpeed = 1;
            }
        }
    });

    graphics.addEventListener("change", () => {
        if (!graphics.checked) {
            App.threeMng.renderer.shadowMap.enabled = false;

            App.threeMng.mirrorBase.visible = true;
            App.threeMng.mirrorReflector.visible = false;

            App.threeMng.scene.traverse((object) => {
                if (object.isMesh) {
                    object.castShadow = false;
                    object.receiveShadow = false;
                }
            });

            App.lyricsData.glyphSize = 32;
            App.threeMng.textObjects.forEach((object => {
                object.sdfGlyphSize = 32;
                object.sync()
            }));

        } else {
            App.threeMng.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            App.threeMng.renderer.shadowMap.enabled = true;

            App.threeMng.scene.traverse((object) => {
                if (object.isMesh && object !== App.threeMng.bigLyrics && !App.lyricsData.floatingChars.includes(object)) {
                    object.castShadow = true;
                    object.receiveShadow = true;
                }
            });

            App.threeMng.mirrorBase.visible = false;
            App.threeMng.mirrorReflector.visible = true;

            App.lyricsData.glyphSize = 64;
            App.threeMng.textObjects.forEach((object => {
                object.sdfGlyphSize = 64;
                object.sync()
            }));
        }

        App.threeMng.scene.traverse((object) => {
            if (object.isLight && object.shadow) {
                object.shadow.dispose();
            }
        });

        App.threeMng.renderer.shadowMap.needsUpdate = true;
    });

    language.addEventListener("change", () => {
        if (language.checked) {
            document.querySelector("label[for='graphics']").textContent = "ハイグラフィックス";
            document.querySelector("label[for='accessibility']").textContent = "動きを減らす";
            credits.textContent = "制作";
        } else {
            document.querySelector("label[for='graphics']").textContent = "High Graphics";
            document.querySelector("label[for='accessibility']").textContent = "Reduce Motion";
            credits.textContent = "Credits";
        }
    });

    if (!app.songUrl) {
        if (songSelector.value >= 0) { // non-custom song
            App.loadSong(songSelector.value, false);
        } else { // custom song
            App.loadSong(customSong.value, true);
        }
    }
}

function onVideoReady(v) {
    let c = App.player.video.firstChar;
    let w = App.player.video.firstWord;
    let p = App.player.video.firstPhrase;

    while (c) {
        if (!App.lyricsData.previousUnits.has(c)) {
            let randomNum = 0.5 - Math.random();
            while (Math.abs(randomNum - App.lyricsData.previousRandom) < 0.2) {
                randomNum = 0.5 - Math.random();
            }
            App.lyricsData.previousRandom = randomNum;
            App.lyricsData.language = c.parent.language;

            if (App.lyricsData.language === "en") {
                // place the text closer if it's english
                App.lyricsData.floatingChars.push({
                    text: c.text,
                    object: null,
                    startPosition: [1.3, 1.75 - App.lyricsData.enIndex * 0.2, 3.2],
                    creationTime: c.startTime,
                    movementVector: [1, 0, 0],
                    currentPosition: [0, 0, 0],
                });
                App.lyricsData.enIndex = (App.lyricsData.enIndex + 1) % 5
            } else {
                App.lyricsData.floatingChars.push({
                    text: c.text,
                    object: null,
                    startPosition: [1.3, 1.35 + randomNum, 3.2 + (0.5 - Math.random())],
                    creationTime: c.startTime,
                    movementVector: [1, 0, 0],
                    currentPosition: [0, 0, 0],
                });

                App.lyricsData.enIndex = 0;
            }

            App.lyricsData.previousUnits.add(c);
        }

        c.animate = App.animateChar.bind(App);
        c = c.next;
    }
    while (w) {
        w.animate = App.animateWord.bind(App);
        w = w.next;
    }
    while (p) {
        p.animate = App.animatePhrase.bind(App);
        p = p.next;
    }

    App.threeMng.initAllText().then(() => App.lyricsData.textLoaded = true);
}

function onTimerReady(t) {
    if (!App.player.app.managed) {
        document
            .querySelectorAll(".textalive-control")
            .forEach((item) => (item.disabled = false));
    }

    // generate progress bar with css gradients
    App.lyricsData.choruses = App.player.getChoruses();
    const colors = ['#78f0d7', '#ff629d'];
    let progressGradient = 'linear-gradient(60deg, ';

    if (App.lyricsData.choruses.length === 0) {
        progressGradient += `${colors[0]} 0%, ${colors[0]} 100%`;
    } else {
        // place colors at the choruses
        progressGradient += `${colors[0]} 0%, `;
        for (let i = 0; i < App.lyricsData.choruses.length; i++) {
            let startPercentage = (App.lyricsData.choruses[i].startTime / App.player.video.duration) * 100;
            let endPercentage = (App.lyricsData.choruses[i].endTime / App.player.video.duration) * 100;
            if (i === 0) {
                // start with non-chorus
                progressGradient += `${colors[0]} ${startPercentage}%, `;
            } else if (i > 0) {
                // end the non-chorus segment with a stop
                progressGradient += `${colors[0]} ${startPercentage}%, `;
            }
            // place the chorus segment stops
            progressGradient += `${colors[1]} ${startPercentage}%, ${colors[1]} ${endPercentage}%, `;
            if (i < App.lyricsData.choruses.length - 1) {
                // close off the last chorus with a non-chorus stop
                progressGradient += `${colors[0]} ${endPercentage}%, `;
            }
        }
    }
    progressGradient = progressGradient.slice(0, -2); // remove trailing comma and space
    progressGradient += ')';

    progressBar.style.background = progressGradient;

    App.player.requestMediaSeek(0);
    progressBar.value = 0;
    App.position = 0;
    App.player.endVideoSeek();
}

function onTimeUpdate(pos) {
    progressBar.value = pos / App.player.video.duration;
    App.position = pos;

    if (pos < App.player.video.firstChar.startTime) {
        App.lyricsData.word = "";
        App.lyricsData.phrase = "";
    }

    if (App.lyricsData.choruses[App.lyricsData.chorusIndex].contains(pos)) {
        // console.log('a');
    }

    // console.log(App.lyricsData.choruses[App.lyricsData.chorusIndex]);
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