// import necessary modules
import * as THREE from "three";

import {
    maxTextScale,
    minTextScale,
    punctuation,
} from "./constants.js";

// lyrics information
export class LyricsData {
    constructor(app) {
        this.app = app;
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

        this.rawCharList = []
        this.sortedCharsList = []

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

        if (this.valence >= 0 && this.arousal >= 0) {
            const r = (1.1 - this.valence) * 2;
            const b = (0.85 - this.arousal) * 2;
            const g = -0.5 * ((r ** 2 + b ** 2) ** 0.5 - 2);

            this.moodColor = new THREE.Color(THREE.MathUtils.clamp(r, 0, 1), THREE.MathUtils.clamp(g, 0, 1), THREE.MathUtils.clamp(b, 0, 1)).offsetHSL(0, 1, 0);
        } else {
            this.moodColor = new THREE.Color(1, 1, 1);
        }

        if (!this.stretch || !this.textScale || !this.textScaleDelta) {
            this.textScale = 1;
            this.textScaleDelta = 1;
            this.stretch = 0;
        }
    }

    normalizeValenceArousal(valenceArousal) {
        [this.valence, this.arousal] = [(valenceArousal.v + 1) / 2, (valenceArousal.a + 1) / 2];
    }

    calculateNotebook() {
        this.rawCharList = Array.from(this.previousUnits).sort(function (a, b) {
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
}
