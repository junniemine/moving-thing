/* ==========================================
   INTERACTIVE PAPER POSTER

   - 직사각형 종이 뜯기
   - 종이 낙하
   - 힘 버튼 및 숫자 PNG
   - 힘 단계별 여러 칸 뜯기
   - 커튼 인터랙션
   - 드래그에 따른 음악 볼륨
   - 음악 종료 후 구멍 복원
   - 모바일 터치 지원
========================================== */


/* ==========================================
   HTML 요소
========================================== */

const poster = document.querySelector("#poster");
const canvas = document.querySelector("#paperCanvas");
const ctx = canvas.getContext("2d");

const powerControl = document.querySelector("#powerControl");
const plusButton = document.querySelector("#plusButton");
const minusButton = document.querySelector("#minusButton");

const layout = poster.closest(".poster-layout");


/* ==========================================
   이미지 경로
========================================== */

const POSTER_IMAGE = new URL(
  "./처음화면.png",
  import.meta.url
).href;

const MASK_IMAGE = new URL(
  "./커튼.png",
  import.meta.url
).href;

const POWER_IMAGES = [
  new URL("./숫자-22.png", import.meta.url).href,
  new URL("./숫자-23.png", import.meta.url).href,
  new URL("./숫자-24.png", import.meta.url).href,
  new URL("./숫자-25.png", import.meta.url).href,
  new URL("./숫자-26.png", import.meta.url).href
];


/* ==========================================
   기본 설정
========================================== */

const BASE_WIDTH = 960;
const BASE_HEIGHT = 1600;

const POWER_UNLOCK_COUNT = 5;
const MAX_POWER = 5;

const POWER_UNLOCK_THRESHOLDS = [
  5, 15, 26, 45
];

const STRIP_COUNT = 24;
const SEGMENT_COUNT = 90;

const CURTAIN_SIDE_PADDING = 1.6;

const REVERSE_LOOP_DURATION = 2300;
const REVERSE_LOOP_STAGGER = 800;


/* ==========================================
   상태
========================================== */

let power = 1;
let removedCount = 0;

let curtainMode = false;
let dragging = false;

let previousX = 0;
let dragX = 0;
let dragVelocity = 0;
let activeColumn = 0;

let lastTime = 0;

let IMAGE_WIDTH = 0;
let IMAGE_HEIGHT = 0;

let initialized = false;
let pendingTears = 0;

let reverseLoopPlaying = false;
let reverseLoopStart = 0;

let audioStarted = false;

let shakeStart = 0;
let shakeDuration = 0;

let curtainHintShown = false;

const pieces = [];
const fallingPieces = [];
const reversePieces = [];

let posterImage = null;
let maskImage = null;


/* ==========================================
   힘 단계 숫자 이미지
========================================== */

const powerNumber = document.createElement("img");

powerNumber.id = "powerNumber";
powerNumber.alt = "현재 힘 단계";
powerNumber.draggable = false;

layout.appendChild(powerNumber);


/* ==========================================
   힘 버튼 / 숫자 위치 및 표시
========================================== */

function updatePowerUI() {

  if (!layout) return;

  const posterRect = poster.getBoundingClientRect();
  const layoutRect = layout.getBoundingClientRect();

  const buttonHeight = powerControl.offsetHeight;

  const top =
    posterRect.top -
    layoutRect.top -
    buttonHeight -
    8;

  // 포스터 왼쪽 끝
  powerControl.style.left =
  `${posterRect.left - layoutRect.left +
  (posterRect.width - powerControl.offsetWidth) / 2}px`;

  powerControl.style.top =
    `${top}px`;

  // 현재 힘 단계 이미지
  const level = Math.max(
    1,
    Math.min(MAX_POWER, power)
  );

  if (powerNumber.dataset.level !== String(level)) {

    powerNumber.src = POWER_IMAGES[level - 1];

    powerNumber.dataset.level = String(level);

  }

  // 포스터 오른쪽 끝
  powerNumber.style.left =
    `${posterRect.right - layoutRect.left - powerNumber.offsetWidth}px`;

  powerNumber.style.top =
    `${top + (buttonHeight - powerNumber.offsetHeight) / 2}px`;

  const visible =
    powerControl.classList.contains("visible");

  powerNumber.classList.toggle(
    "visible",
    visible
  );

}


/* ==========================================
   효과음
========================================== */

const buttonClickSound = new Audio(
  new URL("./click.mp3", import.meta.url).href
);

buttonClickSound.preload = "auto";
buttonClickSound.volume = 0.45;

const paperTearSound = new Audio(
  new URL("./papertear.mp3", import.meta.url).href
);

paperTearSound.preload = "auto";
paperTearSound.volume = 0.55;


function playPaperTearSound() {

  paperTearSound.pause();
  paperTearSound.currentTime = 0;

  paperTearSound.play().catch(error => {
    console.warn("종이 효과음 재생 실패:", error);
  });

}


/* ==========================================
   힘 버튼 피드백
========================================== */

function playPowerButtonFeedback() {

  const image = powerControl.querySelector("img");

  if (image) {

    image.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(0.94)" },
        { transform: "scale(1.035)" },
        { transform: "scale(1)" }
      ],
      {
        duration: 280,
        easing: "ease-out"
      }
    );

  }

  buttonClickSound.pause();
  buttonClickSound.currentTime = 0;

  buttonClickSound.play().catch(error => {
    console.warn("버튼 효과음 재생 실패:", error);
  });

}


/* ==========================================
   힘 단계 해금
========================================== */

function getMaxUnlockedPower() {

  let unlocked = 1;

  for (const threshold of POWER_UNLOCK_THRESHOLDS) {

    if (removedCount >= threshold) {
      unlocked++;
    }

  }

  return Math.min(unlocked, MAX_POWER);

}


/* ==========================================
   힘 버튼 클릭
========================================== */

plusButton.addEventListener("click", event => {

  event.preventDefault();
  event.stopPropagation();

  const maxAllowedPower = curtainMode
    ? MAX_POWER
    : getMaxUnlockedPower();

  if (power >= maxAllowedPower) return;

  power = Math.min(maxAllowedPower, power + 1);

  playPowerButtonFeedback();
  updatePowerUI();

  console.log("현재 힘:", power);

});


minusButton.addEventListener("click", event => {

  event.preventDefault();
  event.stopPropagation();

  if (power <= 1) return;

  power = Math.max(1, power - 1);

  playPowerButtonFeedback();
  updatePowerUI();

  console.log("현재 힘:", power);

});


/* ==========================================
   음악
========================================== */

const curtainAudio = new Audio(
  new URL("./창문.mp3", import.meta.url).href
);

curtainAudio.preload = "auto";
curtainAudio.loop = false;
curtainAudio.volume = 0;


function startCurtainAudio() {

  if (audioStarted || reverseLoopPlaying) return;

  audioStarted = true;
  curtainAudio.muted = false;

  curtainAudio.play().catch(error => {

    audioStarted = false;

    console.error("음악 재생 실패:", error);

  });

}


/* ==========================================
   커튼 움직임에 따른 음량
========================================== */

function updateCurtainAudio() {

  if (
    !curtainMode ||
    !audioStarted ||
    reverseLoopPlaying
  ) {
    return;
  }

  if (!dragging) {

    curtainAudio.muted = true;
    curtainAudio.volume = 0;

    return;

  }

  curtainAudio.muted = false;

  const pullStrength =
    1 + (power - 1) * 1.1;

  const opening =
    Math.abs(dragX) * pullStrength;

  const maxOpening =
    IMAGE_WIDTH * 0.45;

  const openingRatio = Math.min(
    1,
    Math.max(0, opening / maxOpening)
  );

  const powerBoost =
    1 + (power - 1) * 0.3;

  curtainAudio.volume = Math.min(
    1,
    openingRatio * powerBoost
  );

}


/* ==========================================
   이미지 로딩
========================================== */

function loadImage(src) {

  return new Promise((resolve, reject) => {

    const img = new Image();

    img.onload = () => resolve(img);

    img.onerror = () => {
      reject(new Error(`이미지 로딩 실패: ${src}`));
    };

    img.src = src;

  });

}


/* ==========================================
   종이 표면
========================================== */

const paperSurface = document.createElement("canvas");
const paperCtx = paperSurface.getContext("2d");


/* ==========================================
   격자 좌표
========================================== */

const GRID_X = [
  18, 62, 108, 153, 199, 245,
  290, 336, 380, 425, 470,
  490, 535, 580, 625, 670,
  714, 759, 804, 850, 898, 941
];

const GRID_ROWS = [
  [28, 129],
  [137, 236],
  [351, 450],
  [461, 557],
  [571, 670],
  [681, 780],
  [814, 914],
  [921, 1019],
  [1027, 1126],
  [1137, 1235],
  [1247, 1345],
  [1357, 1456],
  [1468, 1585]
];


/* ==========================================
   예비 뜯기 영역
========================================== */

const FALLBACK_ROWS = [

  [28, 129, [
    [200,246], [246,290],
    [490,535], [535,580],
    [580,625], [625,670],
    [670,714], [714,759],
    [759,804], [804,850],
    [850,898], [898,941]
  ]],

  [137, 236, [
    [18,62], [62,108],
    [108,153], [153,199],
    [290,336], [336,380],
    [380,425], [425,470],
    [490,535], [535,580],
    [580,625], [625,670],
    [670,714], [714,759],
    [759,804], [804,850],
    [850,898], [898,941]
  ]],

  [351, 450, [
    [18,62], [62,108],
    [108,153], [153,199],
    [199,245], [245,290],
    [290,336], [336,380],
    [425,470],
    [580,625], [625,670],
    [670,714], [714,759],
    [759,804], [804,850]
  ]],

  [461, 557, [
    [18,62], [62,108],
    [108,153], [153,199],
    [199,245], [245,290],
    [290,336], [336,380],
    [380,425], [425,470]
  ]],

  [571, 670, [
    [18,62],
    [108,153], [153,199],
    [199,245], [245,290],
    [290,336], [336,380],
    [425,470],
    [490,535], [535,580],
    [580,625], [625,670],
    [670,714], [714,759],
    [759,804], [804,850],
    [850,898], [898,941]
  ]],

  [681, 780, [
    [18,62],
    [108,153], [153,199],
    [199,245], [245,290],
    [290,336], [336,380],
    [425,470],
    [490,535], [535,580],
    [580,625], [625,670],
    [670,714], [714,759],
    [759,804], [804,850],
    [850,898], [898,941]
  ]],

  [814, 914, [
    [108,153], [153,199],
    [199,245], [245,290],
    [290,336],
    [580,625], [625,670],
    [670,714], [714,759],
    [759,804], [804,850]
  ]],

  [921, 1019, [
    [18,62], [62,108],
    [425,470],
    [490,535], [535,580],
    [898,941]
  ]],

  [1027, 1126, [
    [108,153], [153,199],
    [199,245], [245,290],
    [290,336],
    [580,625], [625,670],
    [670,714], [714,759],
    [759,804], [804,850]
  ]],

  [1137, 1235, [
    [490,535],
    [580,625], [625,670],
    [670,714],
    [759,804], [804,850],
    [850,898], [898,941]
  ]],

  [1247, 1345, [
    [18,62], [62,108],
    [108,153], [153,199],
    [199,245], [245,290],
    [290,336], [336,380],
    [490,535], [535,580],
    [580,625], [625,670],
    [670,714], [714,759],
    [759,804], [804,850]
  ]],

  [1357, 1456, [
    [200,246], [246,290],
    [490,535], [535,580],
    [580,625], [625,670],
    [670,714], [714,759],
    [759,804], [804,850]
  ]],

  [1468, 1585, [
    [200,246], [246,290],
    [290,336], [336,380],
    [380,425], [425,470],
    [490,535], [535,580],
    [580,625], [625,670],
    [670,714], [714,759],
    [759,804], [804,850],
    [850,898], [898,941]
  ]]

];


/* ==========================================
   픽셀 분석
========================================== */

function getPixel(data, width, x, y) {

  x = Math.max(
    0,
    Math.min(width - 1, Math.round(x))
  );

  const height = data.length / 4 / width;

  y = Math.max(
    0,
    Math.min(height - 1, Math.round(y))
  );

  const i = (y * width + x) * 4;

  return [
    data[i],
    data[i + 1],
    data[i + 2],
    data[i + 3]
  ];

}


function luminance(color) {

  return (
    color[0] * 0.2126 +
    color[1] * 0.7152 +
    color[2] * 0.0722
  );

}


/* ==========================================
   격자 후보 생성
========================================== */

function createGridCandidates() {

  const candidates = [];

  const sx = IMAGE_WIDTH / BASE_WIDTH;
  const sy = IMAGE_HEIGHT / BASE_HEIGHT;

  const columns = [];

  for (let i = 0; i < GRID_X.length - 1; i++) {

    const left = GRID_X[i];
    const right = GRID_X[i + 1];

    if (right - left > 55) continue;

    columns.push([left, right]);

  }

  GRID_ROWS.forEach(([top, bottom]) => {

    columns.forEach(([left, right]) => {

      candidates.push({

        x: left * sx,
        y: top * sy,

        width: (right - left) * sx,
        height: (bottom - top) * sy,

        removed: false,
        pending: false,
        tearOrder: undefined

      });

    });

  });

  return candidates;

}


/* ==========================================
   마스크로 뜯기 영역 판별
========================================== */

function detectPiecesFromMask() {

  if (!maskImage) return false;

  const maskCanvas = document.createElement("canvas");

  maskCanvas.width = IMAGE_WIDTH;
  maskCanvas.height = IMAGE_HEIGHT;

  const maskCtx = maskCanvas.getContext(
    "2d",
    { willReadFrequently: true }
  );

  maskCtx.drawImage(
    maskImage,
    0,
    0,
    IMAGE_WIDTH,
    IMAGE_HEIGHT
  );

  const imageData = maskCtx.getImageData(
    0,
    0,
    IMAGE_WIDTH,
    IMAGE_HEIGHT
  );

  const pixels = imageData.data;
  const candidates = createGridCandidates();

  if (candidates.length === 0) return false;

  const samples = candidates.map(piece => {

    let brightness = 0;
    let alpha = 0;
    let count = 0;

    for (let iy = 1; iy <= 3; iy++) {

      for (let ix = 1; ix <= 3; ix++) {

        const x =
          piece.x + piece.width * ix / 4;

        const y =
          piece.y + piece.height * iy / 4;

        const color = getPixel(
          pixels,
          IMAGE_WIDTH,
          x,
          y
        );

        brightness += luminance(color);
        alpha += color[3];

        count++;

      }

    }

    return {

      ...piece,

      brightness: brightness / count,
      alpha: alpha / count

    };

  });

  const brightnessValues =
    samples.map(s => s.brightness);

  const alphaValues =
    samples.map(s => s.alpha);

  const minBrightness =
    Math.min(...brightnessValues);

  const maxBrightness =
    Math.max(...brightnessValues);

  const minAlpha =
    Math.min(...alphaValues);

  const maxAlpha =
    Math.max(...alphaValues);

  let selected = [];

  if (maxAlpha - minAlpha > 80) {

    const threshold =
      (maxAlpha + minAlpha) / 2;

    selected = samples.filter(
      s => s.alpha < threshold
    );

  } else if (maxBrightness - minBrightness > 15) {

    const threshold =
      (maxBrightness + minBrightness) / 2;

    selected = samples.filter(
      s => s.brightness > threshold
    );

  }

  if (
    selected.length < 5 ||
    selected.length > candidates.length * 0.95
  ) {
    return false;
  }

  pieces.length = 0;

  selected.forEach(piece => {

    pieces.push({

      x: piece.x,
      y: piece.y,

      width: piece.width,
      height: piece.height,

      removed: false,
      pending: false,
      tearOrder: undefined

    });

  });

  return true;

}


/* ==========================================
   예비 좌표
========================================== */

function createFallbackPieces() {

  pieces.length = 0;

  const sx = IMAGE_WIDTH / BASE_WIDTH;
  const sy = IMAGE_HEIGHT / BASE_HEIGHT;

  FALLBACK_ROWS.forEach(
    ([top, bottom, columns]) => {

      columns.forEach(([left, right]) => {

        pieces.push({

          x: left * sx,
          y: top * sy,

          width: (right - left) * sx,
          height: (bottom - top) * sy,

          removed: false,
          pending: false,
          tearOrder: undefined

        });

      });

    }
  );

}


/* ==========================================
   뜯기 영역 생성
========================================== */

function createPieces() {

  pieces.length = 0;

  let detected = false;

  if (maskImage) {

    try {

      detected = detectPiecesFromMask();

    } catch (error) {

      console.warn("마스크 분석 실패:", error);

    }

  }

  if (!detected) {

    createFallbackPieces();

    console.warn(
      "마스크 판별이 불확실하여 예비 격자를 사용합니다."
    );

  }

  console.log(
    "터치 가능한 종이 조각:",
    pieces.length
  );

}


/* ==========================================
   종이 표면 업데이트
========================================== */

function updatePaperSurface() {

  if (!posterImage) return;

  paperSurface.width = IMAGE_WIDTH;
  paperSurface.height = IMAGE_HEIGHT;

  paperCtx.clearRect(
    0,
    0,
    IMAGE_WIDTH,
    IMAGE_HEIGHT
  );

  paperCtx.drawImage(
    posterImage,
    0,
    0,
    IMAGE_WIDTH,
    IMAGE_HEIGHT
  );

  paperCtx.save();

  paperCtx.globalCompositeOperation =
    "destination-out";

  pieces.forEach(piece => {

    if (!piece.removed) return;

    paperCtx.fillRect(
      piece.x,
      piece.y,
      piece.width,
      piece.height
    );

  });

  paperCtx.restore();

}


/* ==========================================
   캔버스 크기
========================================== */

function resizeCanvas() {

  if (!initialized) return;

  const rect = poster.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) return;

  const dpr = Math.min(
    window.devicePixelRatio || 1,
    2
  );

  const sideWidth =
    rect.width * CURTAIN_SIDE_PADDING;

  const totalWidth =
    rect.width + sideWidth * 2;

  canvas.style.width = `${totalWidth}px`;
  canvas.style.height = `${rect.height}px`;

  canvas.style.left = `${-sideWidth}px`;
  canvas.style.top = "0px";

  canvas.style.position = "absolute";
  canvas.style.maxWidth = "none";
  canvas.style.maxHeight = "none";

  poster.style.overflow = "visible";

  if (layout) {
    layout.style.overflow = "visible";
  }

  canvas.width = Math.round(totalWidth * dpr);
  canvas.height = Math.round(rect.height * dpr);

  const scale = canvas.height / IMAGE_HEIGHT;

  ctx.setTransform(
    scale,
    0,
    0,
    scale,
    sideWidth * dpr,
    0
  );

  updatePowerUI();

  render();

}


/* ==========================================
   커튼 휘어짐
========================================== */

function getBendOffset(x, y) {

  const column =
    x / IMAGE_WIDTH * STRIP_COUNT;

  const distance =
    Math.abs(column - activeColumn);

  const spread =
    10 + (power - 1) * 70;

  const influence =
    Math.exp(
      -(distance * distance) / spread
    );

  const normalizedY = Math.max(
    0,
    (y / IMAGE_HEIGHT - 0.05) / 0.95
  );

  const pullStrength =
    1 + (power - 1) * 0.5;

  return (
    dragX *
    pullStrength *
    influence *
    Math.pow(normalizedY, 1.15)
  );

}


/* ==========================================
   움직이는 커튼
========================================== */

function drawMovingPaper() {

  const stripWidth =
    IMAGE_WIDTH / STRIP_COUNT;

  const segmentHeight =
    IMAGE_HEIGHT / SEGMENT_COUNT;

  for (let col = 0; col < STRIP_COUNT; col++) {

    for (let row = 0; row < SEGMENT_COUNT; row++) {

      const x = col * stripWidth;
      const y = row * segmentHeight;

      const offset = getBendOffset(
        x + stripWidth / 2,
        y + segmentHeight / 2
      );

      ctx.drawImage(

        paperSurface,

        x,
        y,

        stripWidth,
        segmentHeight,

        x + offset,
        y,

        stripWidth + 0.5,
        segmentHeight + 0.5

      );

    }

  }

}


/* ==========================================
   떨어지는 종이
========================================== */

function drawFallingPiece(piece) {

  ctx.save();

  ctx.globalAlpha =
    Math.max(0, piece.opacity);

  ctx.translate(
    piece.currentX + piece.width / 2,
    piece.currentY + piece.height / 2
  );

  ctx.rotate(piece.rotation);

  ctx.drawImage(

    posterImage,

    piece.x,
    piece.y,

    piece.width,
    piece.height,

    -piece.width / 2,
    -piece.height / 2,

    piece.width,
    piece.height

  );

  ctx.restore();

}


/* ==========================================
   마지막 복원 애니메이션

   구멍이 아래에서 위로 차오름
   종이 조각은 날아오지 않음
========================================== */

function drawReverseLoop(time) {
  const elapsed = time - reverseLoopStart;
  const riseDuration = REVERSE_LOOP_DURATION - REVERSE_LOOP_STAGGER;

  // 구멍이 뚫린 포스터 유지
  ctx.drawImage(
    paperSurface,
    0,
    0,
    IMAGE_WIDTH,
    IMAGE_HEIGHT
  );

  reversePieces.forEach(item => {
    const localTime = elapsed - item.delay;

    if (localTime < 0) return;

    const t = Math.max(
      0,
      Math.min(1, localTime / riseDuration)
    );

    // 빠르게 올라오다가 원래 위치에서 부드럽게 멈춤
    const eased = 1 - Math.pow(1 - t, 3);
    const piece = item.piece;

    const inv = 1 - eased;

    // 종이마다 다른 방향에서 올라오기
    const currentX = piece.x + item.offsetX * inv;
    const currentY = piece.y + item.offsetY * inv;

    // 회전하다가 원래 각도로 복귀
    const rotation = item.rotation * inv;

    ctx.save();

    ctx.translate(
      currentX + piece.width / 2,
      currentY + piece.height / 2
    );

    ctx.rotate(rotation);

    ctx.globalAlpha = Math.min(
      1,
      Math.max(0, t * 5)
    );

    ctx.drawImage(
      posterImage,
      piece.x,
      piece.y,
      piece.width,
      piece.height,
      -piece.width / 2,
      -piece.height / 2,
      piece.width,
      piece.height
    );

    ctx.restore();
  });
}


/* ==========================================
   화면 그리기
========================================== */

function render() {

  if (!initialized) return;

  const scale =
    canvas.height / IMAGE_HEIGHT;

  const pad =
    (canvas.width / scale - IMAGE_WIDTH) / 2;

  ctx.clearRect(
    -pad,
    0,
    IMAGE_WIDTH + pad * 2,
    IMAGE_HEIGHT
  );

  if (reverseLoopPlaying) {

    drawReverseLoop(performance.now());

    return;

  }

  if (curtainMode) {

    drawMovingPaper();

  } else {

    ctx.drawImage(
      paperSurface,
      0,
      0,
      IMAGE_WIDTH,
      IMAGE_HEIGHT
    );

  }

  fallingPieces.forEach(drawFallingPiece);

}


/* ==========================================
   종이 한 칸 뜯기
========================================== */

function tearPiece(piece) {

  if (!piece || piece.removed) {
    return false;
  }

  piece.removed = true;
  piece.pending = false;

  piece.tearOrder = removedCount;

  removedCount++;

  fallingPieces.push({

    ...piece,

    currentX: piece.x,
    currentY: piece.y,

    velocityX:
      (Math.random() - 0.5) *
      IMAGE_WIDTH * 0.12,

    velocityY:
      -IMAGE_HEIGHT * 0.04,

    rotation: 0,

    rotationSpeed:
      (Math.random() - 0.5) * 2.8,

    opacity: 1

  });

  updatePaperSurface();

  // 다섯 칸 뜯으면 버튼 등장
  if (removedCount >= POWER_UNLOCK_COUNT) {

    powerControl.classList.add("visible");

    updatePowerUI();

  }

  // 모든 종이를 뜯으면 커튼 모드
  if (removedCount === pieces.length) {

    setTimeout(() => {

      curtainMode = true;

      power = 1;

      updatePowerUI();

      canvas.style.cursor = "grab";

      startFinalShake();

    }, 500);

  }

  return true;

}


/* ==========================================
   힘에 따른 뜯기 개수
========================================== */

function getTearCount() {

  const counts = [
    1, 3, 6, 10, 16
  ];

  return counts[power - 1];

}


/* ==========================================
   클릭한 종이 찾기
========================================== */

function findPiece(x, y) {

  return pieces.find(piece => {

    if (piece.removed || piece.pending) {
      return false;
    }

    return (
      x >= piece.x &&
      x <= piece.x + piece.width &&
      y >= piece.y &&
      y <= piece.y + piece.height
    );

  }) || null;

}


/* ==========================================
   여러 칸 뜯기
========================================== */

function tearWithPower(centerPiece) {

  if (!centerPiece) return;

  playPaperTearSound();

  const count = getTearCount();

  const centerX =
    centerPiece.x + centerPiece.width / 2;

  const centerY =
    centerPiece.y + centerPiece.height / 2;

  const candidates = pieces

    .filter(piece =>
      !piece.removed && !piece.pending
    )

    .sort((a, b) => {

      const da = Math.hypot(

        (a.x + a.width / 2 - centerX)
          / IMAGE_WIDTH,

        (a.y + a.height / 2 - centerY)
          / IMAGE_HEIGHT

      );

      const db = Math.hypot(

        (b.x + b.width / 2 - centerX)
          / IMAGE_WIDTH,

        (b.y + b.height / 2 - centerY)
          / IMAGE_HEIGHT

      );

      return da - db;

    });

  const selected =
    candidates.slice(0, count);

  selected.forEach(piece => {
    piece.pending = true;
  });

  selected.forEach((piece, index) => {

    setTimeout(() => {

      tearPiece(piece);

      piece.pending = false;

    }, index * 55);

  });

}


/* ==========================================
   포인터 좌표
========================================== */

function getPointerPosition(event) {

  const rect =
    poster.getBoundingClientRect();

  return {

    x:
      (event.clientX - rect.left) /
      rect.width * IMAGE_WIDTH,

    y:
      (event.clientY - rect.top) /
      rect.height * IMAGE_HEIGHT

  };

}


/* ==========================================
   포인터 시작
========================================== */

canvas.addEventListener(
  "pointerdown",
  event => {

    event.preventDefault();

    if (!initialized) return;
    if (reverseLoopPlaying) return;

    const position =
      getPointerPosition(event);

    if (curtainMode) {

      dragging = true;

      curtainAudio.muted = false;

      startCurtainAudio();

      previousX = event.clientX;

      activeColumn =
        position.x /
        IMAGE_WIDTH *
        STRIP_COUNT;

      canvas.setPointerCapture(
        event.pointerId
      );

      canvas.style.cursor = "grabbing";

      return;

    }

    const piece = findPiece(
      position.x,
      position.y
    );

    if (piece) {
      tearWithPower(piece);
    }

  }
);


/* ==========================================
   커튼 드래그
========================================== */

canvas.addEventListener(
  "pointermove",
  event => {

    if (!dragging) return;
    if (reverseLoopPlaying) return;

    event.preventDefault();

    const rect =
      poster.getBoundingClientRect();

    const dx =
      event.clientX - previousX;

    previousX = event.clientX;

    const scaledDX =
      dx * IMAGE_WIDTH / rect.width;

    const maxPull =
      IMAGE_WIDTH *
      (0.24 + (power - 1) * 0.2);

    dragX = Math.max(
      -maxPull,
      Math.min(
        maxPull,
        dragX + scaledDX * 0.85
      )
    );

    dragVelocity =
      scaledDX * 0.16;

  }
);


/* ==========================================
   드래그 종료
========================================== */

function endDrag(event) {

  if (!dragging) return;

  dragging = false;

  canvas.style.cursor = "grab";

  if (
    canvas.hasPointerCapture(event.pointerId)
  ) {

    canvas.releasePointerCapture(
      event.pointerId
    );

  }

  curtainAudio.muted = true;
  curtainAudio.volume = 0;

}


canvas.addEventListener(
  "pointerup",
  endDrag
);

canvas.addEventListener(
  "pointercancel",
  endDrag
);

canvas.addEventListener(
  "lostpointercapture",
  () => {

    dragging = false;

    curtainAudio.muted = true;
    curtainAudio.volume = 0;

  }
);

window.addEventListener(
  "blur",
  () => {

    dragging = false;

    curtainAudio.muted = true;
    curtainAudio.volume = 0;

  }
);


/* ==========================================
   마지막 자동 흔들림
========================================== */

function startFinalShake() {

  shakeStart = performance.now();
  shakeDuration = 1500;

  activeColumn = STRIP_COUNT / 2;

}


/* ==========================================
   복원 시작
========================================== */

function startReverseLoop() {

  if (!curtainMode) return;
  if (reverseLoopPlaying) return;

  reverseLoopPlaying = true;

  reverseLoopStart =
    performance.now();

  dragging = false;

  dragX = 0;
  dragVelocity = 0;
  shakeDuration = 0;

  curtainAudio.pause();
  curtainAudio.muted = true;
  curtainAudio.volume = 0;

  canvas.style.cursor = "default";

  // 힘 버튼 숨김
  powerControl.classList.remove("visible");

  updatePowerUI();

  // 볼륨 안내 숨김
  document
    .getElementById("curtainHint")
    ?.remove();

  curtainHintShown = false;

  fallingPieces.length = 0;

  // 마지막에 뜯은 종이부터 복원
  const tornPieces = pieces

    .filter(piece => piece.removed)

    .sort((a, b) =>
      (b.tearOrder ?? 0) -
      (a.tearOrder ?? 0)
    );

  reversePieces.length = 0;

  const count = Math.max(
    1,
    tornPieces.length - 1
  );
tornPieces.forEach((piece, index) => {

  const delay =
    (index / count) * REVERSE_LOOP_STAGGER;

  // 종이마다 서로 다른 움직임 생성
  const seed =
    piece.x * 0.037 +
    piece.y * 0.019 +
    piece.tearOrder * 1.7;

  const variation = Math.sin(seed * 2.31);

  // 좌우로 흩어진 위치에서 출발
  const offsetX =
    variation * IMAGE_WIDTH * 0.65;

  // 아래쪽 서로 다른 높이에서 출발
  const offsetY =
    IMAGE_HEIGHT *
    (0.55 + 0.7 * (
      0.5 + 0.5 * Math.sin(seed * 1.27)
    ));

  // 각 종이의 회전 각도
  const rotation =
    Math.sin(seed * 3.13) * Math.PI * 1.3;

  reversePieces.push({
    piece,
    delay,
    offsetX,
    offsetY,
    rotation
  });

});

}


/* ==========================================
   복원 완료
========================================== */

function finishReverseLoop() {

  if (!reverseLoopPlaying) return;

  reverseLoopPlaying = false;

  reversePieces.length = 0;

  pieces.forEach(piece => {

    piece.removed = false;
    piece.pending = false;
    piece.tearOrder = undefined;

  });

  fallingPieces.length = 0;

  removedCount = 0;
  pendingTears = 0;

  power = 1;

  curtainMode = false;
  dragging = false;

  dragX = 0;
  dragVelocity = 0;
  shakeDuration = 0;

  audioStarted = false;

  curtainAudio.pause();
  curtainAudio.currentTime = 0;
  curtainAudio.volume = 0;
  curtainAudio.muted = true;

  powerControl.classList.remove("visible");

  updatePowerUI();

  document
    .getElementById("curtainHint")
    ?.remove();

  curtainHintShown = false;

  canvas.style.cursor = "pointer";

  updatePaperSurface();

  render();

}


/* ==========================================
   애니메이션
========================================== */

function animate(time) {

  const delta = Math.min(
    (time - (lastTime || time)) / 1000,
    0.04
  );

  lastTime = time;

  // 떨어지는 종이
  fallingPieces.forEach(piece => {

    piece.velocityY +=
      IMAGE_HEIGHT * 1.5 * delta;

    piece.currentX +=
      piece.velocityX * delta;

    piece.currentY +=
      piece.velocityY * delta;

    piece.rotation +=
      piece.rotationSpeed * delta;

    if (
      piece.currentY >
      IMAGE_HEIGHT * 0.8
    ) {

      piece.opacity -=
        delta * 1.8;

    }

  });

  // 화면 밖 종이 제거
  for (
    let i = fallingPieces.length - 1;
    i >= 0;
    i--
  ) {

    const piece = fallingPieces[i];

    if (
      piece.opacity <= 0 ||
      piece.currentY >
      IMAGE_HEIGHT * 1.5
    ) {

      fallingPieces.splice(i, 1);

    }

  }

  // 마지막 자동 흔들림
  if (
    curtainMode &&
    !reverseLoopPlaying &&
    shakeDuration > 0 &&
    !dragging
  ) {

    const elapsed =
      time - shakeStart;

    if (elapsed < shakeDuration) {

      const progress =
        elapsed / shakeDuration;

      const fade =
        Math.pow(1 - progress, 2);

      dragX =
        Math.sin(elapsed * 0.025) *
        IMAGE_WIDTH *
        0.035 *
        fade;

    } else {

      shakeDuration = 0;

      dragX = 0;
      dragVelocity = 0;

    }

  }

  // 손을 놓으면 커튼 복귀
  if (
    curtainMode &&
    !reverseLoopPlaying &&
    !dragging &&
    shakeDuration === 0
  ) {

    dragVelocity +=
      -dragX * 0.07;

    dragVelocity *= 0.75;

    dragX += dragVelocity;

    if (
      Math.abs(dragX) < 0.05 &&
      Math.abs(dragVelocity) < 0.05
    ) {

      dragX = 0;
      dragVelocity = 0;

    }

  }

  updateCurtainAudio();

  // 복원 완료
  if (
    reverseLoopPlaying &&
    time - reverseLoopStart >=
      REVERSE_LOOP_DURATION
  ) {

    finishReverseLoop();

  }

  render();

  requestAnimationFrame(animate);

}


/* ==========================================
   모바일 확대 방지
========================================== */

let lastTouchEnd = 0;

document.addEventListener(
  "touchend",
  event => {

    const now = Date.now();

    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }

    lastTouchEnd = now;

  },
  { passive: false }
);

document.addEventListener(
  "gesturestart",
  event => event.preventDefault(),
  { passive: false }
);

document.addEventListener(
  "gesturechange",
  event => event.preventDefault(),
  { passive: false }
);

document.addEventListener(
  "touchmove",
  event => event.preventDefault(),
  { passive: false }
);


/* ==========================================
   볼륨 안내 이미지
========================================== */

function showCurtainHint() {

  if (
    curtainHintShown &&
    document.getElementById("curtainHint")
  ) {
    return;
  }

  if (!layout) return;

  curtainHintShown = true;

  document
    .getElementById("curtainHint")
    ?.remove();

  const hintImage =
    document.createElement("img");

  hintImage.id = "curtainHint";
  hintImage.className = "curtain-hint";

  hintImage.src = new URL(
    "./volume.png",
    import.meta.url
  ).href;

  hintImage.alt = "볼륨 안내";
  hintImage.draggable = false;

  layout.appendChild(hintImage);

  hintImage.classList.add("visible");

}


/* ==========================================
   커튼 전환 감지
========================================== */

function watchCurtainHint() {

  if (curtainMode && !reverseLoopPlaying) {

    showCurtainHint();

  }

  requestAnimationFrame(watchCurtainHint);

}


/* ==========================================
   초기화
========================================== */

async function initialize() {

  try {

    posterImage =
      await loadImage(POSTER_IMAGE);

    IMAGE_WIDTH =
      posterImage.naturalWidth;

    IMAGE_HEIGHT =
      posterImage.naturalHeight;

    try {

      maskImage =
        await loadImage(MASK_IMAGE);

    } catch (error) {

      console.warn(
        "커튼.png를 불러오지 못했습니다.",
        error
      );

      maskImage = null;

    }

    createPieces();

    updatePaperSurface();

    initialized = true;

    resizeCanvas();

    requestAnimationFrame(animate);

    requestAnimationFrame(watchCurtainHint);

    console.log("포스터 초기화 완료");

  } catch (error) {

    console.error(
      "포스터 실행 실패:",
      error
    );

  }

}


/* ==========================================
   화면 크기 변경
========================================== */

window.addEventListener(
  "resize",
  resizeCanvas
);

powerNumber.addEventListener(
  "load",
  updatePowerUI
);


/* ==========================================
   음악 종료 → 복원
========================================== */

curtainAudio.addEventListener(
  "ended",
  startReverseLoop
);


/* ==========================================
   실행
========================================== */

initialize();