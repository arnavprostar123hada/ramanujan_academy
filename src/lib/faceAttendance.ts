/**
 * Browser-only face descriptor helper for the Ramanujan Academy attendance pilot.
 *
 * The camera stream and source frames are processed locally in the browser.
 * Only a numeric descriptor is sent to the private Supabase template RPC; never upload frames.
 *
 * NOTE: The selected browser model stack is a pilot dependency. Validate accuracy, lighting,
 * skin-tone/age performance, consent workflow and spoof resistance before real attendance use.
 */
let faceApiPromise: Promise<any> | null = null;
const MODEL_URL = "https://cdn.jsdelivr.net/gh/vladmandic/face-api/model";
const SCRIPT_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js";

declare global {
  interface Window {
    faceapi?: any;
  }
}

function loadScript(): Promise<void> {
  if (window.faceapi) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-ra-face-api="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load the local face processing library.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.dataset.raFaceApi = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the face recognition library. Check internet access and retry."));
    document.head.appendChild(script);
  });
}

export async function loadFaceApi(): Promise<any> {
  if (!faceApiPromise) {
    faceApiPromise = (async () => {
      await loadScript();
      const api = window.faceapi;
      if (!api) throw new Error("Face recognition library did not initialize.");
      await Promise.all([
        api.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        api.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        api.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      return api;
    })();
  }
  try {
    return await faceApiPromise;
  } catch (error) {
    faceApiPromise = null;
    throw error;
  }
}

export async function detectSingleFaceDescriptor(video: HTMLVideoElement): Promise<number[]> {
  const faceapi = await loadFaceApi();
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("Camera is not ready yet. Keep the kiosk camera open and retry.");
  }
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.55 });
  const detections = await faceapi
    .detectAllFaces(video, options)
    .withFaceLandmarks()
    .withFaceDescriptors();
  if (detections.length === 0) throw new Error("No face detected. Move into the frame and improve the lighting.");
  if (detections.length > 1) throw new Error("More than one face is visible. Ask others to move out of the camera frame.");
  const descriptor = Array.from(detections[0].descriptor as Float32Array) as number[];
  if (descriptor.length !== 128 || descriptor.some((value) => !Number.isFinite(value))) {
    throw new Error("The face model returned an invalid descriptor. Please retry.");
  }
  return descriptor;
}

export async function captureAveragedFaceDescriptor(
  video: HTMLVideoElement,
  samples = 3,
): Promise<number[]> {
  const count = Math.max(2, Math.min(5, samples));
  const collected: number[][] = [];
  for (let index = 0; index < count; index += 1) {
    collected.push(await detectSingleFaceDescriptor(video));
    if (index < count - 1) await new Promise((resolve) => window.setTimeout(resolve, 350));
  }
  return Array.from({ length: 128 }, (_, i) => {
    const average = collected.reduce((sum, sample) => sum + sample[i], 0) / collected.length;
    return Number(average.toFixed(7));
  });
}
