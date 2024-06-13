import {Player} from "textalive-app-api";
import * as THREE from "three";
import WebGL from 'three/addons/capabilities/WebGL.js';

import {isValidUrl} from './utils';

class Main {
    constructor() {
        // set up variables
        this.maxTextSize = 8;
        this.minTextSize = 6;

        this.textSize = this.maxTextSize;
        this.textSizeDelta = this.textSize;

        this.lyrics = document.querySelector("#text");
        this.lyricsDiv = document.querySelector("#lyrics");

        this.playBtns = document.querySelectorAll(".play");
        this.jumpBtn = document.querySelector("#jump");
        this.pauseBtn = document.querySelector("#pause");
        this.rewindBtn = document.querySelector("#rewind");
        this.colorPicker = document.querySelector("#color");
        this.volumeSlider = document.querySelector("#volume");
        this.progressBar = document.querySelector("#progress");
        this.songSelector = document.querySelector("#song");
        this.customSong = document.querySelector("#custom-song");

        this.positionDisplay = document.querySelector("#position strong");

        this.artistSpan = document.querySelector("#artist-name span");
        this.songSpan = document.querySelector("#song-name span");

        this.songList = [
            ["https://piapro.jp/t/hZ35/20240130103028", 4592293, 2727635, 2824326, 59415, 13962],
            ["https://piapro.jp/t/--OD/20240202150903", 4592296, 2727636, 2824327, 59416, 13963],
            ["https://piapro.jp/t/XiaI/20240201203346", 4592297, 2727637, 2824328, 59417, 13964],
            ["https://piapro.jp/t/Rejk/20240202164429", 4592298, 2727638, 2824329, 59418, 13965],
            ["https://piapro.jp/t/ELIC/20240130010349", 4592299, 2727639, 2824330, 59419, 13966],
            ["https://piapro.jp/t/xEA7/20240202002556", 4592300, 2727640, 2824331, 59420, 13967]
        ]

        this._initPlayer();

        if (WebGL.isWebGLAvailable()) {
            this._threeMng = new ThreeManager();
            window.addEventListener("resize", () => this._threeMng.resize());
            this._update();
        } else {
            const warning = WebGL.getWebGLErrorMessage();
            document.getElementById("view").appendChild(warning);
        }
    }

    // initialize textalive player
    _initPlayer() {
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

        player.addListener({
            onAppReady: (app) => this._onAppReady(app),
            onVideoReady: (v) => this._onVideoReady(v),
            onTimerReady: (t) => this._onTimerReady(t),
            onTimeUpdate: (pos) => this._onTimeUpdate(pos),
            onPlay: () => this._onPlay(),
            onPause: () => this._onPause(),
            onStop: () => this._onStop(),
        });

        this._player = player;

    }

    // textalive functions
    _onAppReady(app) {
        if (!app.managed) {
            document.querySelector("#control").style.display = "block";

            // set up controls
            this.playBtns.forEach((playBtn) =>
                playBtn.addEventListener("click", () => {
                    this._player.video && this._player.requestPlay();
                })
            );

            this.jumpBtn.addEventListener(
                "click",
                () =>
                    this._player.video &&
                    this._player.requestMediaSeek(this._player.video.firstChar.startTime)
            );

            this.pauseBtn.addEventListener(
                "click",
                () => this._player.video && this._player.requestPause()
            );

            this.rewindBtn.addEventListener(
                "click",
                () => this._player.video && this._player.requestMediaSeek(0)
            );

            this.colorPicker.addEventListener(
                "change",
                () => this.lyricsDiv.style.textShadow = `0.1em 0.08em ${this.colorPicker.value}`
            );

            this.volumeSlider.addEventListener(
                "input",
                () => this._player.volume = this.volumeSlider.value
            );

            this.progressBar.addEventListener(
                "input",
                () => this._player.requestMediaSeek(this.progressBar.value * this._player.video.duration)
            );

            this.songSelector.addEventListener(
                "change",
                () => {
                    if (this.songSelector.value >= 0) {
                        this.customSong.style.display = "none";
                        this._loadSong(this.songSelector.value, false);
                    } else {
                        this.customSong.style.display = "inline";
                        this._loadSong(this.customSong.value, true);
                    }
                });

            this.customSong.addEventListener(
                "change",
                () => {
                    this._loadSong(this.customSong.value, true);
                }
            );
        }

        if (!app.songUrl) {
            console.log('first load')
            this._loadSong(this.songSelector.value, false);
        }
    }

    _onVideoReady(v) {
        this.artistSpan.textContent = this._player.data.song.artist.name;
        this.songSpan.textContent = this._player.data.song.name;

        let w = this._player.video.firstWord;
        let lyricsList = [];

        while (w) {
            w.animate = this._animateWord.bind(this);
            w = w.next;
            lyricsList.push(w);
        }

        console.log(lyricsList);
    }

    _onTimerReady(t) {
        if (!this._player.app.managed) {
            document
                .querySelectorAll("#control *")
                .forEach((item) => (item.disabled = false));
        }

        this.jumpBtn.disabled = !this._player.video.firstChar;
    }

    _onTimeUpdate(pos) {
        this.positionDisplay.textContent = String(Math.floor(pos));
        this.progressBar.value = pos / this._player.video.duration;

        if (pos < this._player.video.firstChar.startTime) {
            this.lyrics.textContent = "-";
        }

        this._position = pos;
        this._needUpdate = true;
    }

    _onPlay() {
        this.playBtns.forEach((playBtn) => playBtn.style.display = "none");
        this.pauseBtn.style.display = "inline"
    }

    _onPause() {
        this.playBtns.forEach((playBtn) => playBtn.style.display = "inline");
        this.pauseBtn.style.display = "none"
    }

    _onStop() {
        this.lyrics.textContent = "-";

        this.playBtns.forEach((playBtn) => playBtn.style.display = "inline");
        this.pauseBtn.style.display = "none"
    }

    _loadSong(value, isCustom) {
        // song loading system
        this._player.video && this._player.requestPause();

        this.lyricsDiv.style.fontSize = "1em";
        this.lyricsDiv.style.transform = "scale(1, 1)";
        this.lyricsDiv.style.letterSpacing = "0px";

        this.lyrics.textContent = "loading...";
        this.songSpan.textContent = "";
        this.artistSpan.textContent = "";

        document
            .querySelectorAll("#control *")
            .forEach((item) => (item.disabled = true));

        if (!isCustom) {
            this._player.createFromSongUrl(this.songList[value][0], {
                video: {
                    beatId: this.songList[value][1],
                    chordId: this.songList[value][2],
                    repetitiveSegmentId: this.songList[value][3],
                    lyricId: this.songList[value][4],
                    lyricDiffId: this.songList[value][5]
                }
            }).then(() => this.lyrics.textContent = "-");
        } else {
            if (isValidUrl(value)) {
                this._player.createFromSongUrl(value).then(() => this.lyrics.textContent = "-");
            } else {
                this.lyrics.textContent = "invalid url";

                document
                    .querySelectorAll("#control *")
                    .forEach((item) => (item.disabled = false));
            }
        }
    }

    _animateWord(pos, unit) {
        // set up the appearance of the words
        if (unit.contains(pos)) {
            this.lyrics.textContent = unit.text;

            this.textSizeDelta = this.textSize

            // resize text
            let ratio = this._player.getVocalAmplitude(pos) / this._player.getMaxVocalAmplitude();
            this.textSize = this.minTextSize + (this.maxTextSize - this.minTextSize) * Math.log(ratio * this.maxTextSize + 1) / Math.log(this.maxTextSize + 1)

            this.lyricsDiv.style.fontSize = this.textSize + "em";

            // calculate how much squash and stretch to apply
            let stretch = (this.textSize - this.textSizeDelta) / 10;
            this.lyricsDiv.style.transform = `scale(${Math.sqrt(1 - stretch ** 2)}, ${stretch + 1})`;

            this.lyricsDiv.style.letterSpacing = `${stretch * 50}px`
        }
    }

    _update() {
        // rerender the scene if something changed
        if (this._needUpdate) {
            this._threeMng.update(this._position);
            this._threeMng.render();

            this._needUpdate = false;
        }

        window.requestAnimationFrame(() => this._update());
    }

}

class ThreeManager {
    constructor() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // set up renderer
        const renderer = new THREE.WebGLRenderer({antialias: true, alpha: false});
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(this.width, this.height);
        document.getElementById("view").appendChild(renderer.domElement);

        // set up scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x2d2a2e)

        this._can = document.createElement("canvas");
        this._ctx = this._can.getContext("2d");

        this._geometry = new THREE.BoxGeometry(1, 1, 1);
        this._material = new THREE.MeshBasicMaterial({color: 0x00ff00});
        this._cube = new THREE.Mesh(this._geometry, this._material);

        scene.add(this._cube);

        // set up camera
        const camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
        camera.position.z = 5;
        camera.lookAt(0, 0, 0);

        this._renderer = renderer;
        this._scene = scene;
        this._camera = camera;
    }

    update(t) {
        const rotationSpeed = 0.001; // Adjust this value to change the rotation speed
        const angle = t * rotationSpeed;
        this._cube.rotation.x = Math.sin(angle);
        this._cube.rotation.y = Math.cos(angle);
    }

    render() {
        this._renderer.render(this._scene, this._camera);
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this._camera.aspect = this.width / this.height;
        this._camera.updateProjectionMatrix();

        this._renderer.setSize(this.width, this.height);

        this.render()
    }
}

new Main()