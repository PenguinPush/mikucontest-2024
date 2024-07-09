// import necessary modules
import * as THREE from "three";
import CameraControls from "https://cdn.jsdelivr.net/npm/camera-controls@2.8.5/+esm";

import {
    baseFov,
    cameraPositions,
    maxFov,
    minFov,
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

        this.movementStrength = 1 / 10;
        this.rotateStrength = 1 / 12;
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

        if (this.app.threeMng.bigLyrics){
            this.app.threeMng.bigLyrics.position.set(...cameraPositions[this.index].text);
            this.app.threeMng.bigLyrics.lookAt(...cameraPositions[this.index].pos);
        }
    }

    goRight() {
        this.index += 1;
        this.index = (this.index + cameraPositions.length) % cameraPositions.length;

        if (this.app.threeMng.bigLyrics){
            this.app.threeMng.bigLyrics.position.set(...cameraPositions[this.index].text);
            this.app.threeMng.bigLyrics.lookAt(...cameraPositions[this.index].pos);
        }
    }

    update(inputX, inputY, isTouching){
        let cameraPos = cameraPositions[this.index].pos
        let cameraRot = cameraPositions[this.index].rot

        // set camera movement modifier
        let movementDampener = 100 / this.camera.fov;
        if (inputX ** 2 + inputY ** 2 > 1) {
            movementDampener = 100 / (inputX ** 2 + inputY ** 2) ** 0.5 / this.camera.fov;
        } // if the cursor exits the radius, scale the strength of the movement down in tandem with how far the cursor goes

        if (isTouching) {
            // easy math to make the camera translate along its local z plane instead of the global one
            let forward = this.camera.getWorldDirection(new THREE.Vector3()).negate();
            let up = this.camera.up.clone();
            let right = new THREE.Vector3().crossVectors(forward, up);
            let movementX = right.multiplyScalar(-inputX * this.movementStrength * movementDampener);
            let movementY = up.multiplyScalar(inputY * this.movementStrength * movementDampener);
            let targetPosition = new THREE.Vector3(...cameraPos).add(movementX).add(movementY);

            this.cameraControls.moveTo(targetPosition.x, targetPosition.y, targetPosition.z, true);
            this.cameraControls.rotateTo(cameraRot[0] - inputX * this.rotateStrength, cameraRot[1] + inputY * this.rotateStrength, true)
        } else {
            // set to default positions
            this.cameraControls.moveTo(cameraPos[0], cameraPos[1], cameraPos[2], true)
            this.cameraControls.rotateTo(cameraRot[0], cameraRot[1], true)
        }

        this.cameraControls.update(this.clock.getDelta())
    }
}