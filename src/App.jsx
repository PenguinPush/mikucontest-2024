import React, { useEffect } from 'react';
import './App.css';
import { Player } from "textalive-app-api";

function App() {
    useEffect(() => {
        const animateWord = function (now, unit) {
            if (unit.contains(now)) {
                document.querySelector("#text").textContent = unit.text;
            }
        };

        const player = new Player({
            app: {
                token: "voiEWpeaIFwNII7p",
            }
        });

        player.addListener({
            onVideoReady: (v) => {
                let w = player.video.firstWord;
                while (w) {
                    w.animate = animateWord;
                    w = w.next;
                }
            },

            onAppReady: (app) => {
                if (!app.songUrl) {
                    player.createFromSongUrl("https://piapro.jp/t/Rejk/20240202164429", {
                        video: {
                            beatId: 4592298,
                            chordId: 2727638,
                            repetitiveSegmentId: 2824329,
                            lyricId: 59418,
                            lyricDiffId: 13965
                        },
                    });
                }
                if (!app.managed) {
                    // showControls();
                }
            },

            onTimeUpdate: (position) =>
                console.log(position),
        });
    });

    return (
        <>
            <h1>sekaiiii</h1>
            <span id="text"></span>
        </>
    );
}

export default App;
