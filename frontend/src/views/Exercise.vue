<template>

  <div class="card exercise-card" :class="`mode-${inputMode}`">

    <header class="mobile-training-header">
      <router-link to="/" class="mobile-back" aria-label="返回首页">‹</router-link>
      <div class="mobile-training-title">
        <strong>{{ currentExerciseName || "开始训练" }}</strong>
        <span>{{ trainingStatusText }}</span>
      </div>
      <span class="mobile-status-dot" :class="{ active: camOn || session }" aria-hidden="true"></span>
    </header>

    <h2 class="desktop-training-title">开始训练</h2>
    <p v-if="session" class="muted desktop-training-meta">训练 #{{ session.id }} 已保存。刷新或离开后，可从训练记录继续。</p>
    <p v-if="savedPayload" class="ok desktop-training-meta">已恢复上次未完成训练，可继续完成并生成报告。</p>
    <router-link class="desktop-training-meta" to="/history">查看训练记录</router-link>

    <p class="muted desktop-training-meta">

      支持上传训练视频或使用实时摄像头，完成后可生成训练报告。

    </p>

    <div class="input-segments" role="tablist" aria-label="训练输入方式">
      <button
        type="button"
        role="tab"
        :aria-selected="inputMode === 'video'"
        :class="{ selected: inputMode === 'video' }"
        :disabled="!!session || busy || recordingState === 'recording' || recordingState === 'processing'"
        @click="setInputMode('video')"
      >视频训练</button>
      <button
        type="button"
        role="tab"
        :aria-selected="inputMode === 'camera'"
        :class="{ selected: inputMode === 'camera' }"
        :disabled="!!session || busy || recordingState === 'recording' || recordingState === 'processing'"
        @click="setInputMode('camera')"
      >实时摄像头</button>
    </div>

    <div class="row input-config">

      <label class="tag gray">输入</label>

      <select
        v-model="inputMode"
        :disabled="!!session || busy || recordingState === 'recording' || recordingState === 'processing'"
      >

        <option value="video">离线视频（推荐验证）</option>

        <option value="camera">摄像头</option>

      </select>

      <select v-model="exerciseId" :disabled="!!session || busy">

        <option v-for="e in exercises" :key="e.id" :value="e.id">{{ e.name }}</option>

      </select>

    </div>

    <div class="row demo-picker" v-if="inputMode === 'video'">

      <label class="tag gray">演示样本</label>

      <select v-model="demoPickId" :disabled="busy || !!session" @change="onDemoPicked">

        <option value="">（选手动选文件或下方样本）</option>

        <option v-for="d in demoVideosFiltered" :key="d.id" :value="d.id">{{ d.label }}</option>

      </select>

      <button
        @click="loadRecommendedDemo"
        :disabled="busy || !!session || !recommendedDemo"
      >
        一键推荐深蹲
      </button>

    </div>

    <div class="video-upload-panel" v-if="inputMode === 'video'">

      <div class="row video-pickers">
        <label class="secondary-link file-picker" :class="{ disabled: busy }">
          选择手机视频
          <input
            ref="galleryInputEl"
            type="file"
            accept="video/*"
            :disabled="busy"
            @change="onVideoPicked($event, 'gallery')"
          />
        </label>

        <label class="secondary-link file-picker" :class="{ disabled: busy }">
          拍摄视频
          <input
            ref="captureInputEl"
            type="file"
            accept="video/*"
            capture="environment"
            :disabled="busy"
            @change="onVideoPicked($event, 'capture')"
          />
        </label>
      </div>

      <p class="muted upload-limit">支持 MP4、MOV、AVI、WebM、MKV，单个视频不能超过 100 MB。</p>

      <div v-if="videoFile && !demoRelPath" class="selected-video" aria-live="polite">
        <div>
          <strong>{{ selectedVideoName }}</strong>
          <span class="muted">{{ selectedVideoSizeLabel }} · {{ selectedVideoSourceLabel }}</span>
        </div>
        <div class="row">
          <button @click="runVideoProcess" :disabled="busy || uploadState === 'uploading' || uploadState === 'analyzing'">
            {{ uploadState === "error" ? "重新上传并分析" : "上传并分析" }}
          </button>
          <button class="secondary" @click="clearSelectedVideo" :disabled="busy">清除视频</button>
        </div>
      </div>

      <div v-if="demoRelPath" class="row">
        <span class="muted" v-if="videoLabel">{{ videoLabel }} · {{ mpFrameCount }} 姿态帧</span>
        <button class="secondary" @click="reprocessVideo" :disabled="busy">重新分析演示视频</button>
      </div>

      <div v-if="uploadState !== 'idle'" class="upload-state" :class="`state-${uploadState}`" aria-live="polite">
        <strong>{{ uploadStatusText }}</strong>
        <progress v-if="uploadState === 'uploading'" max="100" :value="uploadProgress"></progress>
        <progress v-else-if="uploadState === 'analyzing'"></progress>
      </div>

    </div>

    <div class="camera-tools" v-else>

      <div class="row desktop-camera-actions">

      <button @click="startCam" :disabled="camOn || busy || cameraStarting">打开摄像头</button>

      <button
        class="secondary"
        @click="switchCamera"
        :disabled="!camOn || busy || recordingState === 'recording' || recordingState === 'processing'"
      >
        切换到{{ facingMode === "user" ? "后置" : "前置" }}摄像头
      </button>

      <button
        class="secondary"
        @click="stopCam"
        :disabled="!camOn || recordingState === 'recording' || recordingState === 'processing'"
      >关闭摄像头</button>

      </div>

      <div class="mobile-camera-actions" aria-label="实时训练主要操作">
        <button
          v-if="!camOn"
          class="camera-toggle"
          @click="startCam"
          :disabled="busy || cameraStarting"
        >{{ cameraStarting ? "正在打开…" : "打开摄像头" }}</button>
        <button
          v-else
          class="secondary camera-toggle"
          @click="stopCam"
          :disabled="busy || recordingState === 'recording' || recordingState === 'processing'"
        >关闭摄像头</button>
        <button
          class="secondary"
          @click="switchCamera"
          :disabled="!camOn || busy || cameraStarting || recordingState === 'recording' || recordingState === 'processing'"
        >切换摄像头</button>
        <button
          v-if="!session"
          @click="start"
          :disabled="busy || !canStart || cameraStarting"
        >开始训练</button>
        <button
          v-else
          @click="finish"
          :disabled="busy || recordingState === 'recording' || recordingState === 'processing'"
        >结束并生成报告</button>
      </div>

      <details class="recording-options">
        <summary>训练录像</summary>

      <div class="row recording-actions">

        <button
          @click="startRecording"
          :disabled="!camOn || busy || !recorderSupported || recordingState === 'recording' || recordingState === 'processing'"
        >开始录像</button>

        <button
          class="secondary"
          @click="stopRecording"
          :disabled="recordingState !== 'recording'"
        >停止录像</button>

        <span class="recording-status" :class="{ active: recordingState === 'recording' }" aria-live="polite">
          {{ recordingStatusLabel }}
        </span>

        <a
          v-if="recordingState === 'ready' && recordedUrl"
          class="secondary-link"
          :href="recordedUrl"
          :download="recordedFileName"
        >下载训练录像</a>

        <button
          v-if="recordingState === 'ready' && recordedFile"
          class="secondary"
          @click="uploadRecordedVideo"
          :disabled="busy"
        >上传并分析此录像</button>

      </div>

      <p v-if="!recorderSupported" class="muted recording-help">
        当前浏览器不支持网页内录像，摄像头训练仍可使用；如需保存视频，请切换到“离线视频”后拍摄或选择视频。
      </p>

      <p v-else class="muted recording-help">
        录像只保存在当前浏览器中，不会自动上传；录像准备完成后，请自行确认并下载。
      </p>

      </details>

    </div>

    <div class="row session-actions">

      <button @click="start" :disabled="!!session || busy || !canStart">开始训练</button>

      <button
        class="secondary"
        @click="finish"
        :disabled="!session || busy || recordingState === 'recording' || recordingState === 'processing'"
      >结束并生成报告</button>
      <button
        class="secondary"
        v-if="session"
        @click="cancelSession"
        :disabled="busy || recordingState === 'recording' || recordingState === 'processing'"
      >取消本次训练</button>

    </div>

    <p v-if="hint" class="ok technical-hint">{{ hint }}</p>

    <p v-if="err" class="err page-error">{{ err }}</p>

    <div class="grid-2 training-visual" style="margin-top:12px">

      <div
        class="cam-wrap training-stage"
        :class="{ 'offline-play': inputMode === 'video' && previewOn }"
        :style="inputMode === 'camera' ? { '--camera-aspect': cameraAspectRatio } : undefined"
      >

        <video
          ref="videoEl"
          playsinline
          muted
          autoplay
          :controls="inputMode === 'video' && previewOn"
          @play="onVideoPlay"
          @pause="onVideoPause"
          @seeked="paintPoseOverlay"
          @timeupdate="paintPoseOverlay"
          @ended="onVideoEnded"
        ></video>

        <canvas ref="canvasEl"></canvas>

        <div v-if="!previewOn" class="hint">

          {{ inputMode === "video" ? "请选择或拍摄训练视频" : "摄像头尚未开启" }}

        </div>

      </div>

      <div class="training-details">

        <div class="row" v-if="inputMode === 'video' && previewOn" style="margin-bottom:8px">

          <button class="secondary" @click="playWithPose" :disabled="busy || videoPlaying">播放</button>

          <button class="secondary" @click="pausePosePlayback" :disabled="busy || !videoPlaying">暂停</button>

          <button class="secondary" @click="replayWithPose" :disabled="busy">重播</button>

          <button
            class="secondary"
            @click="exportPoseJson"
            :disabled="busy || !overlayCocoFrames.length"
          >
            导出姿态 JSON
          </button>

        </div>

        <div class="stat pose-strip"><span>姿态</span><b>{{ poseHint || "等待输入" }}</b></div>

        <div class="stat" v-if="liveHud.t != null" style="margin-top:8px">
          <span>播放位置</span>
          <b style="font-size:15px">{{ liveHud.t }} · 膝角 {{ liveHud.knee }}</b>
        </div>

        <div v-if="kneeSeries.length > 1" style="margin-top:12px">
          <p class="muted" style="margin:0 0 6px">膝角曲线（整段，°）· 绿点=当前时刻</p>
          <canvas ref="kneeChartEl" class="knee-chart" width="360" height="90"></canvas>
          <p class="muted" v-if="kneeStats">
            最小 {{ kneeStats.min }}° · 最大 {{ kneeStats.max }}° · 均值 {{ kneeStats.mean }}°
          </p>
        </div>

        <p v-if="session" style="margin-top:12px"><span class="tag on">会话 #{{ session.id }} 进行中</span></p>

        <p class="muted" v-if="inputMode === 'video'">

          视频动作分析已启用，完成后可生成训练报告。

        </p>

        <ol class="muted" style="padding-left:18px">

          <li v-if="inputMode === 'video'">一键推荐 / 选视频 → 等待解析 → 播放看骨架</li>

          <li v-else>打开摄像头，全身入画</li>

          <li>开始训练 → 完成动作 → 查看训练报告</li>

        </ol>

      </div>

    </div>

    <p v-if="inputMode === 'camera' && cameraError" class="err camera-error" role="alert">
      {{ cameraError }}
    </p>

    <details class="more-information">
      <summary>更多信息</summary>
      <p v-if="savedPayload" class="muted">已恢复上次未完成训练的数据。</p>
      <p v-if="hint" class="muted">{{ hint }}</p>
      <p class="muted">视频训练、演示样本和动作分析功能均保留；演示数据不代表你的真实训练结果。</p>
      <router-link to="/history">查看训练记录</router-link>
    </details>

    <details class="camera-diagnostics">
      <summary>摄像头诊断信息</summary>
      <dl>
        <div><dt>安全环境</dt><dd>{{ cameraDiagnostics.secure ? "是" : "否，需要HTTPS" }}</dd></div>
        <div><dt>浏览器摄像头接口</dt><dd>{{ cameraDiagnostics.mediaDevices ? "支持" : "不支持" }}</dd></div>
        <div><dt>打开摄像头能力</dt><dd>{{ cameraDiagnostics.getUserMedia ? "支持" : "不支持" }}</dd></div>
        <div><dt>当前摄像头</dt><dd>{{ facingMode === "environment" ? "后置" : "前置" }}</dd></div>
        <div><dt>运行方式</dt><dd>{{ browserContextLabel }}</dd></div>
        <div><dt>最近错误</dt><dd>{{ lastCameraErrorName || "无" }}</dd></div>
      </dl>
    </details>

  </div>

</template>



<script setup>

import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { useRoute, useRouter } from "vue-router";

import api, { errorMessage, getUser } from "../api/client";

import { createPoseCamera } from "../composables/usePoseCamera";

import { processVideoFile } from "../composables/usePoseVideoFile";

import { processVideoServer } from "../composables/usePoseVideoServer";

import { isOfflineRtmpose } from "../config/poseModel.js";

import {
  anglesFromCocoKeypoints,
  buildPoseSummary,
  buildPoseSummaryFromServer,
  drawCoco17Skeleton,
  hintFromAngles,
  mp33FrameToCoco17Keypoints,
} from "../utils/poseFormat";



const user = getUser();

const router = useRouter();
const route = useRoute();
const savedPayload = ref(null);

const exercises = ref([]);

const exerciseId = ref("squat");

const session = ref(null);

const prescriptionId = ref(0);

const videoEl = ref(null);

const canvasEl = ref(null);

const kneeChartEl = ref(null);

const inputMode = ref("video");

const videoFile = ref(null);

const selectedVideoName = ref("");

const selectedVideoSource = ref("");

const uploadState = ref("idle");

const uploadProgress = ref(0);

const galleryInputEl = ref(null);

const captureInputEl = ref(null);

const mpFrames = ref([]);

const serverPoseResult = ref(null);

const videoMeta = ref({ width: 0, height: 0, fileName: "" });

const liveHud = ref({ t: null, knee: "—" });

const mpFrameCount = computed(() => {
  if (serverPoseResult.value?.coco17_frames?.length) {
    return serverPoseResult.value.coco17_frames.length;
  }
  return mpFrames.value.length;
});

const offlinePoseLabel = computed(() =>
  isOfflineRtmpose() ? "服务端视频动作分析" : "浏览器实时动作识别",
);

const videoLabel = computed(
  () => videoMeta.value.fileName || demoRelPath.value || videoFile.value?.name || "",
);

const recommendedDemo = computed(() => {
  const pin = DEMO_PIN[0];
  return demoVideos.value.find((d) => d.rel_path === pin) || demoVideosFiltered.value[0] || null;
});

const kneeSeries = computed(() => {
  const frames = overlayCocoFrames.value || [];
  return frames.map((f) => {
    const ang = anglesFromCocoKeypoints(f.keypoints || []);
    const knee = ang.knee_flexion_l ?? ang.knee_flexion_r;
    return { t_ms: f.t_ms || 0, knee: knee == null ? null : Number(knee) };
  });
});

const kneeStats = computed(() => {
  const vals = kneeSeries.value.map((x) => x.knee).filter((v) => v != null);
  if (!vals.length) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const mean = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  return { min, max, mean };
});

/** 展示优先样本（全身/动作清晰）；半身自拍类沉底 */
const DEMO_PIN = [
  "squat/repcount_stu4_66.mp4",
  "squat/repcount_stu1_68.mp4",
  "squat/infinite_000000.mp4",
  "jump_jack/repcount_stu6_18.mp4",
  "push_up/repcount_stu7_49.mp4",
];
const DEMO_DEMOTE = ["squat/repcount_stu6_62.mp4"];

function demoRank(d) {
  const rel = d.rel_path || "";
  const pin = DEMO_PIN.indexOf(rel);
  if (pin >= 0) return pin;
  if (DEMO_DEMOTE.includes(rel)) return 900;
  return 100;
}

/** 与当前动作类型匹配的演示样本；推荐置顶 */
const demoVideosFiltered = computed(() => {
  const all = demoVideos.value;
  if (!all.length) return [];
  const matched = all.filter((d) => d.exercise_id === exerciseId.value);
  const list = matched.length ? [...matched] : [...all];
  list.sort((a, b) => demoRank(a) - demoRank(b) || String(a.label).localeCompare(String(b.label)));
  return list.map((d) => {
    const rel = d.rel_path || "";
    if (DEMO_PIN.includes(rel) && !String(d.label).includes("推荐")) {
      return { ...d, label: `★推荐 ${d.label}` };
    }
    return d;
  });
});

const camOn = ref(false);

const facingMode = ref("user");

const cameraStarting = ref(false);

const cameraError = ref("");

const lastCameraErrorName = ref("");

const cameraAspectRatio = ref("3 / 4");

const embeddedBrowser = ref(
  /(MicroMessenger|QQ\/|Weibo|DingTalk|Lark|FBAN|FBAV|Instagram)/i.test(navigator.userAgent),
);

const cameraDiagnostics = ref(readCameraDiagnostics());

const recordingState = ref("idle");

const recorderSupported = ref(
  typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined",
);

const recordedUrl = ref("");

const recordedFileName = ref("");

const recordingMimeType = ref("");

const recordedFile = ref(null);

const previewOn = ref(false);

const hint = ref("");

const err = ref("");

const poseHint = ref("");

const busy = ref(true);

const demoVideos = ref([]);

const demoPickId = ref("");

const demoRelPath = ref("");

const videoPlaying = ref(false);

const overlayCocoFrames = ref([]);

let cameraCtl = null;

let mediaRecorder = null;

let recordingChunks = [];

let recordingStopPromise = null;

let resolveRecordingStop = null;

let discardRecordingOnStop = false;

let playbackRaf = 0;

let localObjectUrl = null;

const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;
const VIDEO_SUFFIXES = [".mp4", ".mov", ".avi", ".webm", ".mkv"];

const selectedVideoSizeLabel = computed(() => formatFileSize(videoFile.value?.size || 0));

const currentExerciseName = computed(
  () => exercises.value.find((item) => item.id === exerciseId.value)?.name || "开始训练",
);

const trainingStatusText = computed(() => {
  if (session.value) return "训练进行中";
  if (camOn.value) return "摄像头已就绪";
  return "尚未开始";
});

const browserContextLabel = computed(() => {
  if (window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone) return "主屏幕应用";
  if (embeddedBrowser.value) return "应用内置浏览器";
  return "Safari或普通浏览器";
});

const selectedVideoSourceLabel = computed(() => {
  if (selectedVideoSource.value === "capture") return "手机现场拍摄";
  if (selectedVideoSource.value === "recording") return "网页训练录像";
  return "手机相册或文件";
});

const uploadStatusText = computed(() => {
  if (uploadState.value === "uploading") {
    return uploadProgress.value > 0 ? `正在上传 ${uploadProgress.value}%` : "正在上传";
  }
  if (uploadState.value === "analyzing") return "正在进行动作分析";
  if (uploadState.value === "success") return "分析完成";
  if (uploadState.value === "error") return "上传失败，视频已保留，可以重新上传";
  return "";
});

const recordingStatusLabel = computed(() => {
  if (recordingState.value === "recording") return "正在录像";
  if (recordingState.value === "processing") return "正在生成文件";
  if (recordingState.value === "ready") return "录像已准备";
  return "未录像";
});

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function readCameraDiagnostics() {
  return {
    secure: Boolean(window.isSecureContext),
    mediaDevices: Boolean(navigator.mediaDevices),
    getUserMedia: typeof navigator.mediaDevices?.getUserMedia === "function",
  };
}

function refreshCameraDiagnostics() {
  cameraDiagnostics.value = readCameraDiagnostics();
}

function videoFileError(file) {
  if (!file || file.size <= 0) return "所选视频为空，请重新选择或拍摄。";
  if (file.size > MAX_VIDEO_UPLOAD_BYTES) return "视频不能超过 100 MB，请压缩或重新拍摄。";
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  const hasVideoSuffix = VIDEO_SUFFIXES.some((suffix) => name.endsWith(suffix));
  if (!type.startsWith("video/") && !hasVideoSuffix) return "所选文件不是支持的视频，请重新选择。";
  return "";
}

function fallbackVideoName(file, source) {
  const given = String(file?.name || "").trim();
  if (given) return given;
  const type = String(file?.type || "").toLowerCase();
  const suffix = type.includes("quicktime") ? "mov" : type.includes("webm") ? "webm" : "mp4";
  const label = source === "capture" ? "现场拍摄" : source === "recording" ? "网页录像" : "手机视频";
  return `${label}-${Date.now()}.${suffix}`;
}

function videoUploadErrorMessage(error) {
  const status = error?.response?.status;
  const code = error?.code;
  if (status === 413) return "视频不能超过 100 MB，请压缩或重新拍摄。";
  if (status === 400) return error?.response?.data?.detail || "视频文件无法识别，请重新选择。";
  if (status === 401) return "登录状态已过期，请重新登录后再上传。";
  if (status === 404) return "当前训练已失效，请返回首页重新开始训练。";
  if (status === 409) return "当前训练已经结束，请开始新的训练。";
  if (status === 502) return "视频上传成功，但暂时无法完成动作分析，请稍后重试。";
  if (status === 503) return "动作分析服务暂时不可用，请稍后重试。";
  if (code === "ECONNABORTED" || /timeout/i.test(error?.message || "")) {
    return "上传或分析时间过长，请检查网络后重试。";
  }
  if (!error?.response) return "网络连接失败，视频已保留，请检查网络后重试。";
  return "视频上传或分析失败，视频已保留，请稍后重试。";
}

function clearRecordedFile() {
  if (recordedUrl.value) URL.revokeObjectURL(recordedUrl.value);
  recordedUrl.value = "";
  recordedFileName.value = "";
  recordingMimeType.value = "";
  recordedFile.value = null;
  if (recordingState.value !== "recording" && recordingState.value !== "processing") {
    recordingState.value = "idle";
  }
}

function pickRecordingMimeType() {
  if (!recorderSupported.value || typeof MediaRecorder.isTypeSupported !== "function") return "";
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function recordingExtension(type) {
  return type?.toLowerCase().includes("mp4") ? "mp4" : "webm";
}

function cameraErrorMessage(error) {
  refreshCameraDiagnostics();
  if (!cameraDiagnostics.value.secure) {
    return "手机摄像头需要通过HTTPS打开。请使用Safari访问系统的HTTPS地址。";
  }
  if (!cameraDiagnostics.value.mediaDevices || !cameraDiagnostics.value.getUserMedia) {
    return "当前浏览器无法使用网页摄像头，请使用最新版Safari打开。";
  }
  if (embeddedBrowser.value) {
    return "当前浏览器可能限制摄像头，请点击右上角并选择在Safari中打开。";
  }
  const name = error?.name || "";
  if ([error?.primaryErrorName, name].includes("OverconstrainedError")
    || [error?.primaryErrorName, name].includes("ConstraintNotSatisfiedError")) {
    return "当前摄像头不支持所请求的画面设置，请重新打开。";
  }
  if (["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(name)) {
    return "摄像头权限未开启。请在iPhone设置中允许Safari访问摄像头后重试。";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "没有检测到可用摄像头。";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "摄像头可能正被其他应用占用，请关闭其他相机应用后重试。";
  }
  if (name === "AbortError") {
    return "摄像头启动被中断，请重新尝试。";
  }
  return "摄像头启动失败，请重新尝试。";
}

function finishRecordingFile(recorder) {
  const shouldDiscard = discardRecordingOnStop;
  const chunks = recordingChunks;
  const actualType = recorder?.mimeType || recordingMimeType.value || chunks[0]?.type || "";

  mediaRecorder = null;
  recordingChunks = [];
  discardRecordingOnStop = false;

  if (!shouldDiscard && chunks.length) {
    const blob = new Blob(chunks, actualType ? { type: actualType } : undefined);
    if (blob.size) {
      if (recordedUrl.value) URL.revokeObjectURL(recordedUrl.value);
      recordedUrl.value = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      recordedFileName.value = `training-${stamp}.${recordingExtension(actualType)}`;
      recordingMimeType.value = actualType;
      recordedFile.value = new File([blob], recordedFileName.value, {
        type: actualType || blob.type || "video/mp4",
      });
      recordingState.value = "ready";
      hint.value = "录像已准备。请确认内容后点击“下载训练录像”保存，本系统不会自动上传。";
    } else {
      recordingState.value = "idle";
      err.value = "录像文件生成失败，请重新录像或改用“拍摄或选择视频”。";
    }
  } else {
    recordingState.value = "idle";
  }

  resolveRecordingStop?.();
  resolveRecordingStop = null;
  recordingStopPromise = null;
}

function cleanupCameraImmediately({ discardRecording = true } = {}) {
  if (mediaRecorder) {
    discardRecordingOnStop = discardRecording;
    if (mediaRecorder.state !== "inactive") {
      try {
        mediaRecorder.stop();
      } catch {
        mediaRecorder = null;
        recordingChunks = [];
        recordingState.value = "idle";
      }
    }
  }

  cameraCtl?.stop();
  cameraCtl = null;
  const stream = videoEl.value?.srcObject;
  stream?.getTracks?.().forEach((track) => track.stop());
  if (videoEl.value) videoEl.value.srcObject = null;
  camOn.value = false;
  previewOn.value = false;
  poseHint.value = "";
}

async function startRecording() {
  err.value = "";
  if (!recorderSupported.value) {
    err.value = "当前浏览器不支持网页内录像，请改用“拍摄或选择视频”。";
    return;
  }
  const stream = cameraCtl?.getStream?.() || videoEl.value?.srcObject;
  if (!stream?.getVideoTracks?.().some((track) => track.readyState === "live")) {
    err.value = "请先打开摄像头，再开始录像。";
    return;
  }

  clearRecordedFile();
  recordingChunks = [];
  discardRecordingOnStop = false;
  const preferredType = pickRecordingMimeType();

  try {
    try {
      mediaRecorder = preferredType
        ? new MediaRecorder(stream, { mimeType: preferredType })
        : new MediaRecorder(stream);
    } catch {
      mediaRecorder = new MediaRecorder(stream);
    }
    recordingMimeType.value = mediaRecorder.mimeType || preferredType;
    const recorder = mediaRecorder;
    recorder.ondataavailable = (event) => {
      if (event.data?.size) recordingChunks.push(event.data);
    };
    recorder.onerror = () => {
      err.value = "录像过程中发生错误，摄像头已关闭。请重新打开后再试。";
      cleanupCameraImmediately();
    };
    recorder.onstop = () => finishRecordingFile(recorder);
    recorder.start(1000);
    recordingState.value = "recording";
    hint.value = "正在录像。完成后请先停止录像，再结束训练。";
  } catch {
    cleanupCameraImmediately();
    err.value = "无法开始录像，摄像头已关闭。你仍可使用“拍摄或选择视频”。";
  }
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    return Promise.resolve();
  }
  if (recordingStopPromise) return recordingStopPromise;

  recordingState.value = "processing";
  recordingStopPromise = new Promise((resolve) => {
    resolveRecordingStop = resolve;
  });
  const pending = recordingStopPromise;
  try {
    mediaRecorder.stop();
  } catch {
    finishRecordingFile(mediaRecorder);
  }
  return pending;
}

function nearestCocoFrame(frames, tMs) {
  if (!frames?.length) return null;
  let best = frames[0];
  let bestD = Math.abs((frames[0].t_ms || 0) - tMs);
  for (let i = 1; i < frames.length; i++) {
    const d = Math.abs((frames[i].t_ms || 0) - tMs);
    if (d < bestD) {
      best = frames[i];
      bestD = d;
    }
  }
  return best;
}

function stopPosePlayback() {
  if (playbackRaf) {
    cancelAnimationFrame(playbackRaf);
    playbackRaf = 0;
  }
  videoPlaying.value = false;
  const v = videoEl.value;
  if (v && !v.paused) v.pause();
}

/** 离线：只在透明 canvas 上叠骨架，底下是可播的 video */
function paintPoseOverlay() {
  const video = videoEl.value;
  const canvas = canvasEl.value;
  if (!video || !canvas || inputMode.value !== "video") return;
  const w = video.videoWidth || videoMeta.value.width || 640;
  const h = video.videoHeight || videoMeta.value.height || 480;
  if (!w || !h) return;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  const frame = nearestCocoFrame(overlayCocoFrames.value, video.currentTime * 1000);
  if (frame?.keypoints) {
    drawCoco17Skeleton(ctx, frame.keypoints, w, h);
    poseHint.value = hintFromAngles(anglesFromCocoKeypoints(frame.keypoints));
  }
}

function playbackTick() {
  paintPoseOverlay();
  const v = videoEl.value;
  if (v && !v.paused && !v.ended) {
    playbackRaf = requestAnimationFrame(playbackTick);
  } else {
    videoPlaying.value = false;
    playbackRaf = 0;
    paintPoseOverlay();
  }
}

function onVideoPlay() {
  videoPlaying.value = true;
  if (playbackRaf) cancelAnimationFrame(playbackRaf);
  playbackRaf = requestAnimationFrame(playbackTick);
}

function onVideoPause() {
  videoPlaying.value = false;
  if (playbackRaf) {
    cancelAnimationFrame(playbackRaf);
    playbackRaf = 0;
  }
  paintPoseOverlay();
}

function onVideoEnded() {
  videoPlaying.value = false;
  if (playbackRaf) {
    cancelAnimationFrame(playbackRaf);
    playbackRaf = 0;
  }
  paintPoseOverlay();
}

async function prepareVideoSrc(src) {
  stopPosePlayback();
  const v = videoEl.value;
  if (!v) return;
  if (localObjectUrl && localObjectUrl !== src) {
    URL.revokeObjectURL(localObjectUrl);
    localObjectUrl = null;
  }
  if (typeof src === "string" && src.startsWith("blob:")) {
    localObjectUrl = src;
  }
  v.src = src;
  await new Promise((resolve, reject) => {
    const onMeta = () => {
      v.removeEventListener("loadedmetadata", onMeta);
      resolve();
    };
    v.addEventListener("loadedmetadata", onMeta);
    v.onerror = () => reject(new Error("视频加载失败"));
  });
  v.currentTime = 0;
  previewOn.value = true;
  await new Promise((resolve) => {
    const done = () => {
      v.removeEventListener("seeked", done);
      resolve();
    };
    v.addEventListener("seeked", done);
    setTimeout(done, 300);
  });
  paintPoseOverlay();
}

async function playWithPose() {
  const v = videoEl.value;
  if (!v?.src || !overlayCocoFrames.value.length) return;
  try {
    await v.play();
  } catch {
    err.value = "浏览器阻止自动播放，请用视频下方控件或再点「播放」";
    return;
  }
}

function pausePosePlayback() {
  stopPosePlayback();
  paintPoseOverlay();
}

async function replayWithPose() {
  const v = videoEl.value;
  if (!v?.src) return;
  stopPosePlayback();
  v.currentTime = 0;
  await playWithPose();
}

const canStart = computed(() => {

  if (inputMode.value === "video") {
    return (
      mpFrames.value.length > 0 ||
      (serverPoseResult.value?.coco17_frames?.length ?? 0) > 0
    );
  }

  return camOn.value;

});



onMounted(async () => {
  window.addEventListener("pagehide", handlePageHide);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  refreshCameraDiagnostics();
  try {

  const { data } = await api.get("/prescriptions/templates");

  const all = [...(data.fitness?.exercises || []), ...(data.medical?.exercises || [])];

  exercises.value = all;

  exerciseId.value = all[0]?.id || "squat";

  try {

    const cur = await api.get(`/prescriptions/current?user_id=${user.id}`);

    prescriptionId.value = cur.data.id;

    if (cur.data.exercises?.length) {

      exercises.value = cur.data.exercises;

      exerciseId.value = cur.data.exercises[0].id;

    }

  } catch {}

  try {

    const { data } = await api.get("/demo-videos/manifest");

    demoVideos.value = data.videos || [];

    if (demoVideos.value.length) {
      const base = `体验视频已就绪：${demoVideos.value.length} 个样本`;
      hint.value = isOfflineRtmpose()
        ? `${base}；视频动作分析服务已连接`
        : `${base}；实时动作识别已就绪`;
    } else {

      hint.value = "体验视频暂不可用，你仍可选择自己的视频进行训练。";

    }

  } catch (e) {

    demoVideos.value = [];

    const detail = e?.response?.data?.detail;

    hint.value =

      typeof detail === "string"

        ? detail

        : "暂时无法加载体验视频，你仍可选择自己的视频进行训练。";

  }

  if (isOfflineRtmpose()) {
    try {
      const { data: est } = await api.get("/pose/estimator");
      if (est?.estimator) {
        hint.value = `${hint.value || ""} · 视频动作分析已就绪`.replace(/^ · /, "");
      }
    } catch {
      err.value = "视频动作分析服务暂时不可用，实时摄像头训练仍可使用。";
    }
  }

  await restoreSession();
  } catch (e) { err.value = errorMessage(e, "训练页面读取失败，请刷新重试"); }
  finally { busy.value = false; }
});

async function restoreSession() {
  const raw = route.query.session_id || localStorage.getItem("ah_last_session");
  if (!raw) return;
  if (!/^\d+$/.test(String(raw)) || Number(raw) < 1) {
    if (route.query.session_id) throw new Error("训练编号无效");
    return;
  }
  try {
    const { data } = await api.get(`/sessions/${raw}`, { params: { user_id: user.id } });
    const row = data.session;
    if (row.status !== "running") {
      if (route.query.session_id) {
        if (row.status === "finished") await router.replace({ path: "/report", query: { session_id: row.id } });
        else err.value = "这次训练已取消，请开始新的训练。";
      }
      return;
    }
    session.value = row;
    exerciseId.value = row.exercise_id;
    if (!exercises.value.some(e => e.id === row.exercise_id)) exercises.value.push({ id: row.exercise_id, name: row.exercise_name });
    prescriptionId.value = row.prescription_id;
    inputMode.value = row.pose_summary?.source === "camera_live_only" ? "camera" : "video";
    savedPayload.value = { video_path: row.video_path || "", pose_summary: row.pose_summary || {} };
    hint.value = "已恢复未完成训练；保存的数据将用于生成报告。";
    localStorage.setItem("ah_last_session", String(row.id));
    await router.replace({ path: "/exercise", query: { session_id: row.id } });
  } catch (e) {
    if (route.query.session_id) throw e;
    if (e?.response?.status !== 404) throw e;
  }
}

async function cancelSession() {
  busy.value = true;
  err.value = "";
  try {
    await api.post(`/sessions/${session.value.id}/cancel`, null, { params: { user_id: user.id } });
    localStorage.removeItem("ah_last_session");
    session.value = null;
    await stopCam();
    await router.push("/history");
  } catch (e) { err.value = errorMessage(e, "取消失败，请重试"); }
  finally { busy.value = false; }
}

async function onDemoPicked() {

  if (!demoPickId.value) return;

  const pick = demoVideos.value.find((d) => d.id === demoPickId.value);

  if (!pick) return;

  err.value = "";

  busy.value = true;

  try {

    selectedVideoName.value = "";
    selectedVideoSource.value = "";
    uploadState.value = "idle";
    uploadProgress.value = 0;

    const res = await api.get("/demo-videos/file", {

      params: { rel: pick.rel_path },

      responseType: "blob",

      timeout: 120000,

    });

    videoFile.value = new File([res.data], pick.file_name, { type: "video/mp4" });

    demoRelPath.value = pick.rel_path;

    if (pick.exercise_id && exercises.value.some((e) => e.id === pick.exercise_id)) {

      exerciseId.value = pick.exercise_id;

    }

    await runVideoProcess();

  } catch (e) {

    err.value = e?.response?.data?.detail || e?.message || "加载演示视频失败";

  } finally {

    busy.value = false;

  }

}

async function loadRecommendedDemo() {
  if (!recommendedDemo.value || busy.value || session.value) return;
  demoPickId.value = recommendedDemo.value.id;
  await onDemoPicked();
}



async function onVideoPicked(ev, source = "gallery") {
  const file = ev.target.files?.[0];
  ev.target.value = "";
  if (!file) return;
  await selectLocalVideo(file, source);
}

async function selectLocalVideo(file, source = "gallery") {
  err.value = "";
  const validationError = videoFileError(file);
  if (validationError) {
    err.value = validationError;
    uploadState.value = "error";
    return false;
  }

  if (camOn.value) await stopCam();
  inputMode.value = "video";
  demoPickId.value = "";
  demoRelPath.value = "";
  videoFile.value = file;
  selectedVideoName.value = fallbackVideoName(file, source);
  selectedVideoSource.value = source;
  uploadState.value = "idle";
  uploadProgress.value = 0;
  mpFrames.value = [];
  serverPoseResult.value = null;
  overlayCocoFrames.value = [];
  poseHint.value = "";
  videoMeta.value = { width: 0, height: 0, fileName: selectedVideoName.value };

  try {
    const objectUrl = URL.createObjectURL(file);
    await prepareVideoSrc(objectUrl);
    const video = videoEl.value;
    video?.pause();
    if (video) video.currentTime = 0;
    videoMeta.value = {
      width: video?.videoWidth || 0,
      height: video?.videoHeight || 0,
      fileName: selectedVideoName.value,
    };
    hint.value = "视频已选择。请确认预览后点击“上传并分析”。";
    return true;
  } catch {
    clearSelectedVideo();
    err.value = "无法预览所选视频，请重新选择或拍摄。";
    uploadState.value = "error";
    return false;
  }
}

function clearSelectedVideo() {
  stopPosePlayback();
  videoFile.value = null;
  selectedVideoName.value = "";
  selectedVideoSource.value = "";
  uploadState.value = "idle";
  uploadProgress.value = 0;
  mpFrames.value = [];
  serverPoseResult.value = null;
  overlayCocoFrames.value = [];
  videoMeta.value = { width: 0, height: 0, fileName: "" };
  poseHint.value = "";
  previewOn.value = false;
  if (localObjectUrl) {
    URL.revokeObjectURL(localObjectUrl);
    localObjectUrl = null;
  }
  if (videoEl.value) {
    videoEl.value.removeAttribute("src");
    videoEl.value.load();
  }
  if (galleryInputEl.value) galleryInputEl.value.value = "";
  if (captureInputEl.value) captureInputEl.value.value = "";
}

async function uploadRecordedVideo() {
  if (!recordedFile.value || busy.value) return;
  const file = recordedFile.value;
  const selected = await selectLocalVideo(file, "recording");
  if (selected) await runVideoProcess();
}



async function reprocessVideo() {

  if (!videoFile.value && !demoRelPath.value) return;

  await runVideoProcess();

}



async function runVideoProcess() {

  if (!videoFile.value && !demoRelPath.value) return;
  err.value = "";

  busy.value = true;

  mpFrames.value = [];

  serverPoseResult.value = null;

  overlayCocoFrames.value = [];

  stopPosePlayback();

  try {

    if (isOfflineRtmpose()) {

      const pathRel = demoRelPath.value ? `data/demo_videos/${demoRelPath.value}` : null;

      if (!pathRel) await ensureSession();

      const result = await processVideoServer({

        videoPathRel: pathRel,

        file: pathRel ? null : videoFile.value,

        sampleHz: 6,

        exerciseId: exerciseId.value,

        sessionId: pathRel ? undefined : session.value?.id,

        onProgress: (p) => {
          if (!pathRel) {
            if (p.phase === "upload") {
              uploadState.value = "uploading";
              uploadProgress.value = Math.round(Math.min(1, (p.progress || 0) / 0.3) * 100);
            } else if (p.phase === "analysis") {
              uploadState.value = "analyzing";
              uploadProgress.value = 100;
            }
          }
          hint.value = p.message || `视频动作分析 ${Math.round(p.progress * 100)}%`;

        },

      });

      serverPoseResult.value = result.serverResult;

      overlayCocoFrames.value = result.cocoFrames || [];

      videoMeta.value = {

        width: result.width,

        height: result.height,

        fileName: selectedVideoName.value || videoFile.value?.name || pathRel?.split("/").pop() || "",

      };

      poseHint.value = result.hint;

      hint.value = `视频动作分析完成（约 ${result.durationSec.toFixed(1)} 秒），正在播放…`;

      if (demoRelPath.value) {
        await prepareVideoSrc(`/api/demo-videos/file?rel=${encodeURIComponent(demoRelPath.value)}`);
      } else if (videoFile.value) {
        localObjectUrl = URL.createObjectURL(videoFile.value);
        await prepareVideoSrc(localObjectUrl);
      }
      await playWithPose();
      await persistDraft();

      if (!pathRel) {
        uploadState.value = "success";
        uploadProgress.value = 100;
      }

      return;

    }

    const result = await processVideoFile({

      video: videoEl.value,

      canvas: canvasEl.value,

      file: videoFile.value,

      sampleHz: 6,

      onProgress: (p) => {

        hint.value = p.message || `解析中 ${Math.round(p.progress * 100)}%`;

      },

    });

    mpFrames.value = result.mpFrames;
    overlayCocoFrames.value = result.mpFrames.map(mp33FrameToCoco17Keypoints);

    videoMeta.value = {

      width: result.width,

      height: result.height,

      fileName: selectedVideoName.value || videoFile.value.name,

    };

    poseHint.value = result.hint;

    hint.value = `实时动作分析完成（约 ${result.durationSec.toFixed(1)} 秒），正在播放…`;

    // processVideoFile 会清空 video.src，需重新挂上本地文件再播
    const blobUrl = URL.createObjectURL(videoFile.value);
    await prepareVideoSrc(blobUrl);
    await playWithPose();
    await persistDraft();

  } catch (e) {

    if (videoFile.value && !demoRelPath.value) {
      uploadState.value = "error";
      err.value = videoUploadErrorMessage(e);
    } else {
      err.value = "演示视频暂时无法分析，请稍后重试。";
    }

  } finally {

    busy.value = false;

  }

}



async function startCam() {

  err.value = "";

  cameraError.value = "";

  lastCameraErrorName.value = "";

  refreshCameraDiagnostics();

  if (cameraStarting.value || camOn.value) return;

  if (!cameraDiagnostics.value.secure) {
    lastCameraErrorName.value = "InsecureContext";
    cameraError.value = cameraErrorMessage({ name: "SecurityError" });
    return;
  }

  if (!cameraDiagnostics.value.mediaDevices || !cameraDiagnostics.value.getUserMedia) {
    lastCameraErrorName.value = "NotSupportedError";
    cameraError.value = cameraErrorMessage({ name: "NotSupportedError" });
    return;
  }

  if (embeddedBrowser.value) {
    lastCameraErrorName.value = "EmbeddedBrowser";
    cameraError.value = cameraErrorMessage({ name: "NotSupportedError" });
    return;
  }

  cameraStarting.value = true;

  try {

    cleanupCameraImmediately({ discardRecording: false });

    cameraCtl = createPoseCamera({

      video: videoEl.value,

      canvas: canvasEl.value,

      facingMode: facingMode.value,

      onHint: (t) => {

        poseHint.value = t;

      },

    });

    await cameraCtl.start();

    facingMode.value = cameraCtl.getFacingMode?.() || facingMode.value;

    camOn.value = true;

    previewOn.value = true;

    const width = videoEl.value?.videoWidth || 3;
    const height = videoEl.value?.videoHeight || 4;
    cameraAspectRatio.value = `${width} / ${height}`;

    hint.value = `已打开${facingMode.value === "user" ? "前置" : "后置"}摄像头`;

  } catch (e) {

    cleanupCameraImmediately();

    lastCameraErrorName.value = e?.primaryErrorName || e?.name || "CameraStartError";

    cameraError.value = cameraErrorMessage(e);

  } finally {

    cameraStarting.value = false;

  }

}



async function stopCam() {

  if (recordingState.value === "recording") await stopRecording();

  cameraCtl?.stop();

  cameraCtl = null;

  const stream = videoEl.value?.srcObject;
  stream?.getTracks?.().forEach((track) => track.stop());

  if (videoEl.value) videoEl.value.srcObject = null;

  camOn.value = false;

  previewOn.value = false;

  poseHint.value = "";

  cameraStarting.value = false;

}

async function switchCamera() {
  if (!camOn.value || recordingState.value === "recording" || recordingState.value === "processing") return;
  err.value = "";
  cameraError.value = "";
  await stopCam();
  facingMode.value = facingMode.value === "user" ? "environment" : "user";
  await startCam();
}

async function setInputMode(mode) {
  if (mode === inputMode.value || session.value || busy.value) return;
  if (mode !== "camera" && camOn.value) await stopCam();
  inputMode.value = mode;
  cameraError.value = "";
}

async function ensureSession() {
  if (session.value) return session.value;
  const name = exercises.value.find((e) => e.id === exerciseId.value)?.name || exerciseId.value;
  const { data } = await api.post("/sessions/start", {
    user_id: user.id,
    exercise_id: exerciseId.value,
    exercise_name: name,
    prescription_id: prescriptionId.value,
    ...buildSubmission(),
  });
  session.value = data.session;
  localStorage.setItem("ah_last_session", String(data.session.id));
  await router.replace({ path: "/exercise", query: { session_id: data.session.id } });
  return data.session;
}



async function start() {

  err.value = "";

  busy.value = true;

  try {

    await ensureSession();

    hint.value =

      inputMode.value === "video"

        ? "会话已开始（离线序列已就绪），可直接结束生成报告"

        : "会话已开始，请完成若干次动作后结束会话";

    if (inputMode.value === "camera" && !camOn.value) await startCam();

  } catch (e) {

    err.value = e?.response?.data?.detail || "开始会话失败";

  } finally {

    busy.value = false;

  }

}



function buildSubmission() {
  if (savedPayload.value && !serverPoseResult.value?.coco17_frames?.length && !mpFrames.value.length && !camOn.value) return savedPayload.value;
    const name = exercises.value.find((e) => e.id === exerciseId.value)?.name || exerciseId.value;

    let poseSummary;

    if (inputMode.value === "video" && serverPoseResult.value?.coco17_frames?.length) {

      poseSummary = buildPoseSummaryFromServer({

        sessionId: session.value?.id ?? null,

        exerciseId: exerciseId.value,

        exerciseName: name,

        serverResult: serverPoseResult.value,

        source: "offline_video",

        videoFileName: videoMeta.value.fileName,

      });

    } else if (inputMode.value === "video" && mpFrames.value.length) {

      poseSummary = buildPoseSummary({

        sessionId: session.value?.id ?? null,

        exerciseId: exerciseId.value,

        exerciseName: name,

        mpFrames: mpFrames.value,

        source: "offline_video",

        videoFileName: videoMeta.value.fileName,

        width: videoMeta.value.width,

        height: videoMeta.value.height,

      });

    } else {

      poseSummary = {

        schema_version: "1.0.0",

        exercise_id: exerciseId.value,

        source: inputMode.value === "video" ? "offline_video_pending" : "camera_live_only",

        live_hint: poseHint.value,

        sequences: { mediapipe33: { frames: [] }, coco17: { frames: [] } },

      };

    }

    let videoPath = "";
    if (inputMode.value === "video" && videoMeta.value.fileName) {
      if (serverPoseResult.value?.upload_rel) {
        videoPath = serverPoseResult.value.upload_rel;
      } else if (demoRelPath.value) {
        videoPath = `demo_videos/${demoRelPath.value}`;
      } else if (serverPoseResult.value?.resolved_path) {
        videoPath = serverPoseResult.value.resolved_path;
      } else {
        // Browser-only analysis does not upload or persist the local video file.
        videoPath = "";
      }
    }



  return { video_path: videoPath, pose_summary: poseSummary };
}

async function persistDraft() {
  if (!session.value) return;
  const submission = buildSubmission();
  await api.put(`/sessions/${session.value.id}/draft`, submission, { params: { user_id: user.id } });
  savedPayload.value = submission;
}

async function finish() {

  err.value = "";

  busy.value = true;

  stopPosePlayback();

  const submission = buildSubmission();

  await stopCam();

  try {

    const { data } = await api.post(`/sessions/${session.value.id}/finish`, {

      ...submission,

    });

    localStorage.setItem("ah_last_session", String(data.session.id));

    session.value = null;

    hint.value = `报告已生成（姿态帧 ${submission.pose_summary.sequences?.coco17?.frames?.length ?? 0}）…`;

    router.push({ path: "/report", query: { session_id: data.session.id } });

  } catch (e) {

    err.value = e?.response?.data?.detail || "结束会话失败";

  } finally {

    busy.value = false;

  }

}



onBeforeUnmount(() => {
  window.removeEventListener("pagehide", handlePageHide);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  stopPosePlayback();
  cleanupCameraImmediately();
  clearRecordedFile();
  if (localObjectUrl) {
    URL.revokeObjectURL(localObjectUrl);
    localObjectUrl = null;
  }
});

function handlePageHide() {
  cleanupCameraImmediately();
}

function handleVisibilityChange() {
  cameraCtl?.setPaused?.(document.hidden);
}

watch(inputMode, (mode) => {
  if (mode !== "camera" && camOn.value) void stopCam();
});

</script>

<style scoped>
.mobile-training-header,
.input-segments,
.mobile-camera-actions {
  display: none;
}

.exercise-card {
  max-width: 100%;
}

.training-stage {
  width: 100%;
  max-width: 100%;
}

.pose-strip b {
  font-size: 15px;
}

.more-information,
.camera-diagnostics,
.recording-options {
  margin-top: 12px;
  border: 1px solid #d8e3de;
  border-radius: 10px;
  background: #f8fbf9;
}

.more-information summary,
.camera-diagnostics summary,
.recording-options summary {
  min-height: 44px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 600;
}

.more-information > :not(summary),
.camera-diagnostics > :not(summary),
.recording-options > :not(summary) {
  margin-left: 12px;
  margin-right: 12px;
}

.camera-diagnostics dl {
  margin-top: 0;
  padding-bottom: 8px;
}

.camera-diagnostics dl > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  border-top: 1px solid #e4ebe7;
}

.camera-diagnostics dt {
  color: #52645d;
}

.camera-diagnostics dd {
  margin: 0;
  text-align: right;
  overflow-wrap: anywhere;
}

.camera-tools {
  display: grid;
  gap: 8px;
}

.video-upload-panel {
  display: grid;
  gap: 10px;
  margin: 10px 0;
}

.video-pickers {
  align-items: stretch;
}

.file-picker {
  position: relative;
  cursor: pointer;
}

.file-picker input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.file-picker.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.upload-limit {
  margin: 0;
}

.selected-video {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid #d5e2dc;
  border-radius: 10px;
  background: #f8fbf9;
  overflow-wrap: anywhere;
}

.selected-video strong,
.selected-video span {
  display: block;
}

.selected-video span {
  margin-top: 4px;
}

.upload-state {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #edf7f2;
  color: #205f4b;
}

.upload-state.state-error {
  background: #fff1f0;
  color: #a32920;
}

.upload-state progress {
  width: 100%;
}

.recording-actions {
  align-items: center;
}

.recording-status {
  color: #52645d;
  font-size: 14px;
}

.recording-status.active {
  color: #b42318;
  font-weight: 700;
}

.recording-status.active::before {
  content: "";
  display: inline-block;
  width: 9px;
  height: 9px;
  margin-right: 6px;
  border-radius: 50%;
  background: currentColor;
}

.secondary-link {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid #a9bbb3;
  border-radius: 8px;
  color: #1f604b;
  text-decoration: none;
}

.recording-help {
  margin: 0;
}

@media (max-width: 900px) {
  .exercise-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    min-height: calc(100dvh - env(safe-area-inset-top));
    padding: 0 12px calc(92px + env(safe-area-inset-bottom));
  }

  .desktop-training-title,
  .desktop-training-meta {
    display: none;
  }

  .mobile-training-header {
    order: 1;
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 20px;
    align-items: center;
    min-height: calc(56px + env(safe-area-inset-top));
    margin: 0 -12px 8px;
    padding:
      env(safe-area-inset-top)
      max(12px, env(safe-area-inset-right))
      0
      max(12px, env(safe-area-inset-left));
    border-bottom: 1px solid #e1e9e5;
    background: #fff;
  }

  .mobile-back {
    display: grid;
    width: 44px;
    height: 44px;
    place-items: center;
    color: #1f604b;
    font-size: 32px;
    line-height: 1;
    text-decoration: none;
  }

  .mobile-training-title {
    min-width: 0;
    text-align: center;
  }

  .mobile-training-title strong,
  .mobile-training-title span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-training-title strong {
    font-size: 17px;
  }

  .mobile-training-title span {
    margin-top: 2px;
    color: #65766f;
    font-size: 12px;
  }

  .mobile-status-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #aebbb5;
  }

  .mobile-status-dot.active {
    background: #2a9d6a;
    box-shadow: 0 0 0 4px #e0f4ea;
  }

  .input-segments {
    order: 2;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    margin: 0 0 8px;
    padding: 4px;
    border-radius: 12px;
    background: #edf2ef;
  }

  .input-segments button {
    min-height: 44px;
    padding: 8px;
    border: 0;
    background: transparent;
    color: #50625a;
    box-shadow: none;
  }

  .input-segments button.selected {
    background: #fff;
    color: #185943;
    box-shadow: 0 1px 5px rgb(17 55 43 / 12%);
  }

  .input-config {
    order: 3;
    margin-bottom: 8px;
  }

  .input-config > .tag,
  .input-config > select:first-of-type {
    display: none;
  }

  .input-config > select:last-of-type {
    min-height: 44px;
  }

  .mode-camera .training-visual {
    order: 4;
    display: block;
    margin-top: 0 !important;
  }

  .mode-camera .training-stage {
    position: relative;
    width: 100%;
    height: auto;
    min-height: 0 !important;
    max-height: 48dvh;
    aspect-ratio: var(--camera-aspect, 3 / 4);
    border-radius: 14px;
  }

  .mode-camera .training-stage video,
  .mode-camera .training-stage canvas {
    position: absolute !important;
    inset: 0;
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    object-fit: contain;
  }

  .mode-camera .training-stage .hint {
    position: absolute;
    inset: auto 0 0;
    padding: 12px;
  }

  .mode-camera .training-details {
    margin-top: 8px;
  }

  .mode-camera .training-details > :not(.pose-strip) {
    display: none;
  }

  .mode-camera .pose-strip {
    display: flex;
    min-height: 44px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 12px;
    border: 1px solid #d8e5df;
    border-radius: 10px;
    background: #f5faf7;
  }

  .mode-camera .pose-strip span,
  .mode-camera .pose-strip b {
    display: inline;
    margin: 0;
  }

  .mode-camera .pose-strip b {
    font-size: 14px;
    text-align: right;
  }

  .camera-error {
    order: 5;
    margin: 8px 0 0;
    padding: 10px 12px;
    border-radius: 10px;
    background: #fff1f0;
  }

  .mode-camera .camera-tools {
    order: 6;
    margin-top: 8px;
  }

  .desktop-camera-actions {
    display: none;
  }

  .mobile-camera-actions {
    position: sticky;
    bottom: max(8px, env(safe-area-inset-bottom));
    z-index: 20;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 8px;
    border: 1px solid #d8e3de;
    border-radius: 14px;
    background: rgb(255 255 255 / 96%);
    box-shadow: 0 8px 24px rgb(20 53 44 / 18%);
    backdrop-filter: blur(10px);
  }

  .mobile-camera-actions button {
    min-width: 0;
    min-height: 44px;
    padding: 8px 10px;
  }

  .mobile-camera-actions button:last-child {
    grid-column: 1 / -1;
  }

  .mode-camera .session-actions,
  .technical-hint {
    display: none;
  }

  .recording-options {
    margin-top: 0;
  }

  .mode-video .demo-picker {
    order: 4;
  }

  .mode-video .video-upload-panel {
    order: 5;
  }

  .mode-video .training-visual {
    order: 6;
    grid-template-columns: 1fr;
    margin-top: 8px !important;
  }

  .mode-video .training-stage,
  .mode-video .training-stage video,
  .mode-video .training-stage canvas {
    width: 100%;
    max-width: 100%;
    min-height: 0 !important;
    max-height: 52dvh;
  }

  .mode-video .session-actions {
    order: 7;
  }

  .page-error {
    order: 8;
    overflow-wrap: anywhere;
  }

  .mode-video .technical-hint {
    order: 9;
  }

  .more-information {
    order: 20;
  }

  .camera-diagnostics {
    order: 21;
    margin-bottom: calc(8px + env(safe-area-inset-bottom));
  }

  .more-information,
  .camera-diagnostics,
  .recording-options {
    width: 100%;
    min-width: 0;
  }

  .demo-picker,
  .video-upload-panel,
  .training-visual,
  .camera-tools,
  .session-actions,
  .technical-hint,
  .page-error,
  .camera-error {
    width: 100%;
    min-width: 0;
  }

  .demo-picker select,
  .video-upload-panel input,
  .training-stage video,
  .training-stage canvas {
    max-width: 100%;
  }

  .recording-actions > button,
  .recording-actions > .secondary-link {
    flex: 1 1 140px;
    justify-content: center;
  }
}
</style>


