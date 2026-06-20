import { HandLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

export class HandTracker {
    constructor(videoElement, onHandMove, canvasElement) {
        this.videoElement = videoElement;
        this.onHandMove = onHandMove;
        this.canvasElement = canvasElement;
        if (canvasElement) {
            this.canvasCtx = canvasElement.getContext('2d');
            this.drawingUtils = new DrawingUtils(this.canvasCtx);
        }
        this.handLandmarker = null;
        this.lastVideoTime = -1;
    }

    async loadModel(vision) {
        if (this.loadPromise) return this.loadPromise;
        this.loadPromise = (async () => {
            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 1,
                minHandDetectionConfidence: 0.4,
                minHandPresenceConfidence: 0.4,
                minTrackingConfidence: 0.4
            });
        })();
        return this.loadPromise;
    }

    async start() {
        await this.loadPromise;

        const detect = () => {
            // Process every new video frame immediately without artificial throttling
            if (this.videoElement.currentTime !== this.lastVideoTime) {
                this.lastVideoTime = this.videoElement.currentTime;
                const now = performance.now();
                const results = this.handLandmarker.detectForVideo(this.videoElement, now);
                
                if (this.canvasCtx) {
                    this.canvasCtx.save();
                    this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
                }

                if (results.landmarks && results.landmarks.length > 0) {
                    const landmarks = results.landmarks[0];
                    const indexFinger = landmarks[8];
                    const x = 1 - indexFinger.x;
                    const y = indexFinger.y;
                    if (this.onHandMove) this.onHandMove(x, y);

                    // Draw hand landmarks
                    if (this.canvasCtx) {
                        this.drawingUtils.drawConnectors(
                            landmarks,
                            HandLandmarker.HAND_CONNECTIONS,
                            { color: "#4ade80", lineWidth: 3 }
                        );
                        this.drawingUtils.drawLandmarks(
                            landmarks,
                            { color: "#facc15", lineWidth: 2, radius: 3 }
                        );
                    }
                }
                
                if (this.canvasCtx) {
                    this.canvasCtx.restore();
                }
            }
            requestAnimationFrame(detect);
        };
        detect();
    }
}
