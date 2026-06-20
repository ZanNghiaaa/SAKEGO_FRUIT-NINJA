import { FaceLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

export class FaceTracker {
    constructor(videoElement, canvasElement) {
        this.videoElement = videoElement;
        this.canvasElement = canvasElement;
        if (canvasElement) {
            this.canvasCtx = canvasElement.getContext('2d');
            this.drawingUtils = new DrawingUtils(this.canvasCtx);
        }
        this.faceLandmarker = null;
        this.lastVideoTime = -1;
    }

    async loadModel(vision) {
        if (this.loadPromise) return this.loadPromise;
        this.loadPromise = (async () => {
            this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                    delegate: "GPU"
                },
                outputFaceBlendshapes: true,
                outputFacialTransformationMatrixes: false,
                runningMode: "VIDEO",
                numFaces: 1
            });
        })();
        return this.loadPromise;
    }

    async start() {
        await this.loadPromise;
        
        let lastProcessTime = 0;
        const detect = () => {
            const now = performance.now();
            // Throttle to ~15 FPS to prevent lag (every 66ms)
            if (this.videoElement.currentTime !== this.lastVideoTime && now - lastProcessTime > 66) {
                lastProcessTime = now;
                this.lastVideoTime = this.videoElement.currentTime;
                const results = this.faceLandmarker.detectForVideo(this.videoElement, now);
                
                this.canvasCtx.save();
                this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
                if (results.faceLandmarks) {
                    for (const landmarks of results.faceLandmarks) {
                        this.drawingUtils.drawConnectors(
                            landmarks,
                            FaceLandmarker.FACE_LANDMARKS_TESSELATION,
                            { color: "#C0C0C070", lineWidth: 1 }
                        );
                        this.drawingUtils.drawConnectors(
                            landmarks,
                            FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
                            { color: "#4ade80" }
                        );
                        this.drawingUtils.drawConnectors(
                            landmarks,
                            FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
                            { color: "#4ade80" }
                        );
                        this.drawingUtils.drawConnectors(
                            landmarks,
                            FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
                            { color: "#4ade80" }
                        );
                        this.drawingUtils.drawConnectors(
                            landmarks,
                            FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
                            { color: "#4ade80" }
                        );
                        this.drawingUtils.drawConnectors(
                            landmarks,
                            FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
                            { color: "#E0E0E0" }
                        );
                        this.drawingUtils.drawConnectors(
                            landmarks,
                            FaceLandmarker.FACE_LANDMARKS_LIPS,
                            { color: "#E0E0E0" }
                        );
                    }
                }
                this.canvasCtx.restore();
            }
            requestAnimationFrame(detect);
        };
        detect();
    }
}
