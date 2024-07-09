// import necessary modules
import * as THREE from "three";
import CameraControls from "https://cdn.jsdelivr.net/npm/camera-controls@2.8.5/+esm";

import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {HalftonePass} from 'three/addons/postprocessing/HalftonePass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Text} from "https://cdn.jsdelivr.net/npm/troika-three-text@0.49.1/+esm";
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Reflector} from 'three/addons/objects/Reflector.js';

import {
    baseFov,
    BASE_TEXT_SIZE,
    BEDROOM,
    cameraPositions,
    FULL_VIEW,
    MAX_CHARS_PER_LINE,
    MAX_LINES,
    maxFov,
    minFov,
    noShadows,
    NOTEBOOK_TEXT_SIZE,
    POLAROID_COUNT,
    polaroidPositions,
    POLAROID_TEXT_SIZE,
    WINDOW,
    WINDOW_TEXT_SIZE,
} from "./constants.js";

CameraControls.install({THREE: THREE});

export class Camera {
    constructor(app, renderer){
        this.app = app;
        this.renderer = renderer;
        this.index = 0;
        this.camera = new THREE.PerspectiveCamera(THREE.MathUtils.clamp(baseFov / (window.innerWidth / window.innerHeight) * 1.5, minFov, maxFov), window.innerWidth / window.innerHeight, 0.1, 1000);
        this.cameraControls = new CameraControls(this.camera, this.renderer.domElement);
        this.clock = new THREE.Clock();
    }

    initCamera() {
        let cameraPos = cameraPositions[this.index].pos
        let cameraRot = cameraPositions[this.index].rot

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

    resize(){
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.fov = THREE.MathUtils.clamp(baseFov / this.camera.aspect * 1.5, minFov, maxFov);

        this.camera.updateProjectionMatrix();
    }

    goLeft() {
        this.index -= 1;
        this.index = (this.index + cameraPositions.length) % cameraPositions.length;

        if (this.bigLyrics){
            this.bigLyrics.position.set(...cameraPositions[this.index].text);
            this.bigLyrics.lookAt(...cameraPositions[this.index].pos);
        }
    }

    goRight() {
        this.index += 1;
        this.index = (this.index + cameraPositions.length) % cameraPositions.length;

        if (this.bigLyrics){
            this.bigLyrics.position.set(...cameraPositions[this.index].text);
            this.bigLyrics.lookAt(...cameraPositions[this.index].pos);
        }
    }

    update(){
        let cameraPos = cameraPositions[this.index].pos
        let cameraRot = cameraPositions[this.index].rot

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
    }
}