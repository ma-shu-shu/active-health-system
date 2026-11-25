/** 浏览器摄像头 + MediaPipe Pose 骨架叠加。 */
import { getPoseLandmarker, drawSkeleton } from "./usePoseLandmarker";

function angle(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const n1 = Math.hypot(ab.x, ab.y);
  const n2 = Math.hypot(cb.x, cb.y);
  if (!n1 || !n2) return null;
  const cos = Math.min(1, Math.max(-1, dot / (n1 * n2)));
  return Math.round((Math.acos(cos) * 180) / Math.PI);
}

export function createPoseCamera({ video, canvas, onHint, facingMode = "user" }) {
  let stream = null;
  let raf = 0;
  let running = false;
  let starting = false;
  let paused = false;
  let lastVideoTime = -1;
  let landmarker = null;
  let activeFacingMode = facingMode;

  function waitForMetadata() {
    if (video.readyState >= 1 && video.videoWidth && video.videoHeight) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => done(new Error("camera metadata timeout")), 10000);
      const onLoaded = () => done();
      const onError = () => done(new Error("camera video unavailable"));
      function done(error) {
        window.clearTimeout(timeout);
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onError);
        error ? reject(error) : resolve();
      }
      video.addEventListener("loadedmetadata", onLoaded, { once: true });
      video.addEventListener("error", onError, { once: true });
    });
  }

  function permissionDenied(error) {
    return ["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(error?.name);
  }

  async function requestStream() {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
    } catch (primaryError) {
      if (permissionDenied(primaryError)) throw primaryError;
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      } catch (fallbackError) {
        const error = new Error("camera fallback failed");
        error.name = fallbackError?.name || primaryError?.name || "CameraStartError";
        error.primaryErrorName = primaryError?.name || "";
        error.fallbackErrorName = fallbackError?.name || "";
        throw error;
      }
    }
  }

  async function start() {
    if (starting || running) return stream;
    starting = true;
    try {
      stop();
      stream = await requestStream();
      activeFacingMode = stream.getVideoTracks()[0]?.getSettings?.().facingMode || facingMode;
      video.removeAttribute("src");
      video.srcObject = stream;
      await waitForMetadata();
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      await video.play();
      running = true;
      paused = document.hidden;
      onHint?.("摄像头已开启，正在加载姿态识别…");
      try {
        landmarker = await getPoseLandmarker();
        onHint?.(
          activeFacingMode === "user"
            ? "姿态识别已就绪，请确保全身入画"
            : "姿态识别已就绪，请调整距离确保全身入画",
        );
      } catch {
        onHint?.("摄像头已开启，姿态识别暂时不可用");
      }
      if (!paused) loop();
      return stream;
    } catch (error) {
      stop();
      throw error;
    } finally {
      starting = false;
    }
  }

  function loop() {
    if (!running || paused) return;
    const ctx = canvas.getContext("2d");
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.clearRect(0, 0, w, h);

    const mirrored = activeFacingMode === "user";
    ctx.save();
    if (mirrored) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    try {
      if (landmarker && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const result = landmarker.detectForVideo(video, performance.now());
        const landmarks = result?.landmarks?.[0];
        if (landmarks) {
          drawSkeleton(ctx, landmarks, w, h, mirrored);
          const knee = angle(landmarks[23], landmarks[25], landmarks[27])
            || angle(landmarks[24], landmarks[26], landmarks[28]);
          onHint?.(
            knee
              ? `膝角约 ${knee}° · ${knee < 70 ? "下蹲较深" : knee > 160 ? "接近站立" : "动作进行中"}`
              : "已识别人体姿态",
          );
        } else {
          onHint?.("请后退一步，确保全身入画");
        }
      }
    } catch {
      /* 姿态推理单帧失败时保留摄像头预览。 */
    }
    if (running && !paused) raf = requestAnimationFrame(loop);
  }

  function setPaused(value) {
    paused = Boolean(value);
    if (paused) {
      cancelAnimationFrame(raf);
      raf = 0;
      return;
    }
    if (running && !raf) raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    paused = false;
    cancelAnimationFrame(raf);
    raf = 0;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    if (video.srcObject) video.srcObject = null;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }

  return {
    start,
    stop,
    setPaused,
    getStream: () => stream,
    getFacingMode: () => activeFacingMode,
  };
}
