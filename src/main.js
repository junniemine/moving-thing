/* ==========================================
   INTERACTIVE PAPER POSTER

   - 첫 화면 이미지
   - 직사각형 한 칸씩 뜯기
   - 종이 낙하 애니메이션
   - PNG 힘 버튼
   - 힘에 따라 여러 칸 뜯기
   - 모든 칸을 뜯은 뒤 커튼 움직임
   - 드래그에 따른 음악 볼륨
   - 음악 종료 시 REVERSE LOOP
   - 종이가 역순으로 돌아와 포스터 복원
   - 모바일 터치 지원
========================================== */


/* ==========================================
   HTML 요소
========================================== */

const poster =
  document.querySelector("#poster");

const canvas =
  document.querySelector("#paperCanvas");

const ctx =
  canvas.getContext("2d");

const powerControl =
  document.querySelector("#powerControl");

const plusButton =
  document.querySelector("#plusButton");

const minusButton =
  document.querySelector("#minusButton");


/* ==========================================
   POWER BUTTON CLICK FEEDBACK
========================================== */

function showTouchFeedback(event) {

  const button = event.currentTarget;

  const rect = button.getBoundingClientRect();

  const controlRect =
    powerControl.getBoundingClientRect();

  const x =
    rect.left +
    rect.width / 2 -
    controlRect.left;

  const y =
    rect.top +
    rect.height / 2 -
    controlRect.top;

  const ripple =
    document.createElement("span");

  Object.assign(ripple.style, {

    position: "absolute",

    left: `${x}px`,
    top: `${y}px`,

    width: "18px",
    height: "18px",

    border: "1.5px solid white",

    borderRadius: "50%",

    boxShadow:
      "0 0 0 1px rgba(0,0,0,0.3)",

    pointerEvents: "none",

    zIndex: "50"

  });

  powerControl.appendChild(ripple);

  ripple.animate(

    [
      {
        transform:
          "translate(-50%, -50%) scale(0.5)",

        opacity: 1
      },

      {
        transform:
          "translate(-50%, -50%) scale(2.8)",

        opacity: 0
      }
    ],

    {
      duration: 350,
      easing: "ease-out"
    }

  ).onfinish = () => ripple.remove();

}


/* ==========================================
   POWER BUTTON CLICK SOUND
========================================== */

const buttonClickSound = new Audio(
  new URL("./click.mp3", import.meta.url).href
);

buttonClickSound.preload = "auto";

buttonClickSound.volume = 0.45;


/* ==========================================
   PAPER TEAR SOUND
========================================== */

const paperTearSound = new Audio(
  new URL("./papertear.mp3", import.meta.url).href
);

paperTearSound.preload = "auto";

paperTearSound.volume = 0.55;


function playPaperTearSound() {

  paperTearSound.pause();

  paperTearSound.currentTime = 0;

  paperTearSound.play().catch(error => {

    console.warn(
      "종이 뜯기 효과음 재생 실패:",
      error
    );

  });

}


/* ==========================================
   POWER BUTTON PRESS & BOUNCE
========================================== */

function playPowerButtonFeedback(event) {

  const image =
    powerControl.querySelector("img");

  if (image) {

    image.animate(

      [
        {
          transform: "scale(1)",
          offset: 0
        },

        {
          transform: "scale(0.94)",
          offset: 0.24
        },

        {
          transform: "scale(1.035)",
          offset: 0.65
        },

        {
          transform: "scale(1)",
          offset: 1
        }
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
  console.warn("힘 버튼 효과음 재생 실패:", error);
});
}

plusButton.addEventListener(
  "click",
  event => {

    // 현재 사용할 수 있는 최대 힘 단계
    const maxAllowedPower = curtainMode
      ? MAX_POWER
      : getMaxUnlockedPower();

    // 다음 단계가 해금되지 않았으면
    // 클릭 모션과 효과음을 실행하지 않음
    if (power >= maxAllowedPower) {
      return;
    }

    // 힘을 올릴 수 있을 때만 클릭 모션 실행
    playPowerButtonFeedback(event);

  }
);

minusButton.addEventListener(
  "click",
  playPowerButtonFeedback
);


/* ==========================================
   이미지 파일
========================================== */

const POSTER_IMAGE = new URL(
  "./처음화면.png",
  import.meta.url
).href;

const MASK_IMAGE = new URL(
  "./커튼.png",
  import.meta.url
).href;


/* ==========================================
   CURTAIN AUDIO SYSTEM
========================================== */

const curtainAudio = new Audio(
  new URL("./창문.mp3", import.meta.url).href
);

curtainAudio.preload = "auto";

curtainAudio.loop = false;

curtainAudio.volume = 0;

let audioStarted = false;


/* ==========================================
   음악 시작
========================================== */

function startCurtainAudio() {

  if (audioStarted) return;

  if (reverseLoopPlaying) return;

  audioStarted = true;

  curtainAudio.muted = false;

  curtainAudio.play().catch(error => {

    audioStarted = false;

    console.error(
      "음악 재생 실패:",
      error
    );

  });

}


/* ==========================================
   커튼 움직임에 따른 음량 계산
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
    Math.max(
      0,
      opening / maxOpening
    )
  );

  const powerBoost =
    1 + (power - 1) * 0.3;

  curtainAudio.volume = Math.min(
    1,
    openingRatio * powerBoost
  );

}


/* ==========================================
   설정
========================================== */

const BASE_WIDTH = 960;

const BASE_HEIGHT = 1600;

const POWER_UNLOCK_COUNT = 5;

const MAX_POWER = 5;
// 힘 단계별 해금 기준

const POWER_UNLOCK_THRESHOLDS = [5, 15, 26, 45];

// 현재 해금된 최대 힘 단계 계산

function getMaxUnlockedPower() {

  let unlocked = 1;

  for (const threshold of POWER_UNLOCK_THRESHOLDS) {

    if (removedCount >= threshold) {

      unlocked++;

    }

  }

  return Math.min(unlocked, MAX_POWER);

}

const STRIP_COUNT = 24;

const SEGMENT_COUNT = 90;
// 포스터 양옆으로 확장할 공간

const CURTAIN_SIDE_PADDING = 1.6;

const USE_GRID_FALLBACK = true;

const USE_IMAGE_MASK = true;


/* ==========================================
   REVERSE LOOP 설정
========================================== */

// 종이가 완전히 복원되는 시간
const REVERSE_LOOP_DURATION = 2300;

// 종이 조각 사이의 복원 시간차
const REVERSE_LOOP_STAGGER = 800;

// 복원 시작 여부
let reverseLoopPlaying = false;

// 복원 시작 시간
let reverseLoopStart = 0;

// 복원되는 종이 조각
const reversePieces = [];


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

// 뜯을 종이
const pieces = [];

// 떨어지는 종이
const fallingPieces = [];


/* ==========================================
   이미지 로딩 함수
========================================== */

function loadImage(src) {

  return new Promise((resolve, reject) => {

    const img = new Image();

    img.onload = () => resolve(img);

    img.onerror = () => {

      reject(
        new Error(
          `이미지를 불러오지 못했습니다: ${src}`
        )
      );

    };

    img.src = src;

  });

}


/* ==========================================
   이미지 객체
========================================== */

let posterImage = null;

let maskImage = null;


/* ==========================================
   종이 표면 캔버스
========================================== */

const paperSurface =
  document.createElement("canvas");

const paperCtx =
  paperSurface.getContext("2d");


/* ==========================================
   직사각형 격자
========================================== */

const GRID_X = [

  18,
  62,
  108,
  153,
  199,
  245,
  290,
  336,
  380,
  425,
  470,

  490,
  535,
  580,
  625,
  670,
  714,
  759,
  804,
  850,
  898,
  941

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
   예비 좌표
========================================== */

const FALLBACK_ROWS = [

  [
    28, 129,
    [
      [200,246], [246,290],
      [490,535], [535,580],
      [580,625], [625,670],
      [670,714], [714,759],
      [759,804], [804,850],
      [850,898], [898,941]
    ]
  ],

  [
    137, 236,
    [
      [18,62], [62,108],
      [108,153], [153,199],
      [290,336], [336,380],
      [380,425], [425,470],
      [490,535], [535,580],
      [580,625], [625,670],
      [670,714], [714,759],
      [759,804], [804,850],
      [850,898], [898,941]
    ]
  ],

  [
    351, 450,
    [
      [18,62], [62,108],
      [108,153], [153,199],
      [199,245], [245,290],
      [290,336], [336,380],
      [425,470],
      [580,625], [625,670],
      [670,714], [714,759],
      [759,804], [804,850]
    ]
  ],

  [
    461, 557,
    [
      [18,62], [62,108],
      [108,153], [153,199],
      [199,245], [245,290],
      [290,336], [336,380],
      [380,425], [425,470]
    ]
  ],

  [
    571, 670,
    [
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
    ]
  ],

  [
    681, 780,
    [
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
    ]
  ],

  [
    814, 914,
    [
      [108,153], [153,199],
      [199,245], [245,290],
      [290,336],
      [580,625], [625,670],
      [670,714], [714,759],
      [759,804], [804,850]
    ]
  ],

  [
    921, 1019,
    [
      [18,62], [62,108],
      [425,470],
      [490,535], [535,580],
      [898,941]
    ]
  ],

  [
    1027, 1126,
    [
      [108,153], [153,199],
      [199,245], [245,290],
      [290,336],
      [580,625], [625,670],
      [670,714], [714,759],
      [759,804], [804,850]
    ]
  ],

  [
    1137, 1235,
    [
      [490,535],
      [580,625], [625,670],
      [670,714],
      [759,804], [804,850],
      [850,898], [898,941]
    ]
  ],

  [
    1247, 1345,
    [
      [18,62], [62,108],
      [108,153], [153,199],
      [199,245], [245,290],
      [290,336], [336,380],
      [490,535], [535,580],
      [580,625], [625,670],
      [670,714], [714,759],
      [759,804], [804,850]
    ]
  ],

  [
    1357, 1456,
    [
      [200,246], [246,290],
      [490,535], [535,580],
      [580,625], [625,670],
      [670,714], [714,759],
      [759,804], [804,850]
    ]
  ],

  [
    1468, 1585,
    [
      [200,246], [246,290],
      [290,336], [336,380],
      [380,425], [425,470],
      [490,535], [535,580],
      [580,625], [625,670],
      [670,714], [714,759],
      [759,804], [804,850],
      [850,898], [898,941]
    ]
  ]

];


/* ==========================================
   색상 계산
========================================== */

function getPixel(data, width, x, y) {

  x = Math.max(
    0,
    Math.min(width - 1, Math.round(x))
  );

  const height =
    data.length / 4 / width;

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

  const sx =
    IMAGE_WIDTH / BASE_WIDTH;

  const sy =
    IMAGE_HEIGHT / BASE_HEIGHT;

  const columns = [];

  for (
    let i = 0;
    i < GRID_X.length - 1;
    i++
  ) {

    const left = GRID_X[i];

    const right = GRID_X[i + 1];

    if (right - left > 55) {
      continue;
    }

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
   마스크 기반 뜯기 영역 판별
========================================== */

function detectPiecesFromMask() {

  if (!maskImage) return false;

  const maskCanvas =
    document.createElement("canvas");

  maskCanvas.width = IMAGE_WIDTH;

  maskCanvas.height = IMAGE_HEIGHT;

  const maskCtx =
    maskCanvas.getContext("2d", {
      willReadFrequently: true
    });

  maskCtx.drawImage(
    maskImage,
    0,
    0,
    IMAGE_WIDTH,
    IMAGE_HEIGHT
  );

  const imageData =
    maskCtx.getImageData(
      0,
      0,
      IMAGE_WIDTH,
      IMAGE_HEIGHT
    );

  const pixels =
    imageData.data;

  const candidates =
    createGridCandidates();

  if (candidates.length === 0) {
    return false;
  }

  const samples =
    candidates.map(piece => {

      let brightness = 0;

      let alpha = 0;

      let count = 0;

      for (
        let iy = 1;
        iy <= 3;
        iy++
      ) {

        for (
          let ix = 1;
          ix <= 3;
          ix++
        ) {

          const x =
            piece.x +
            piece.width * ix / 4;

          const y =
            piece.y +
            piece.height * iy / 4;

          const color = getPixel(
            pixels,
            IMAGE_WIDTH,
            x,
            y
          );

          brightness +=
            luminance(color);

          alpha +=
            color[3];

          count++;

        }

      }

      return {

        ...piece,

        brightness:
          brightness / count,

        alpha:
          alpha / count

      };

    });


  const brightnessValues =
    samples.map(s => s.brightness);

  const minBrightness =
    Math.min(...brightnessValues);

  const maxBrightness =
    Math.max(...brightnessValues);

  const alphaValues =
    samples.map(s => s.alpha);

  const minAlpha =
    Math.min(...alphaValues);

  const maxAlpha =
    Math.max(...alphaValues);

  let selected = [];

  if (
    maxAlpha - minAlpha > 80
  ) {

    const threshold =
      (maxAlpha + minAlpha) / 2;

    selected = samples.filter(
      s => s.alpha < threshold
    );

  }

  else if (
    maxBrightness - minBrightness > 15
  ) {

    const threshold =
      (maxBrightness + minBrightness) / 2;

    selected = samples.filter(
      s => s.brightness > threshold
    );

  }

  if (
    selected.length < 5 ||
    selected.length >
      candidates.length * 0.95
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
   예비 좌표 사용
========================================== */

function createFallbackPieces() {

  pieces.length = 0;

  const sx =
    IMAGE_WIDTH / BASE_WIDTH;

  const sy =
    IMAGE_HEIGHT / BASE_HEIGHT;

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

  if (
    USE_IMAGE_MASK &&
    maskImage
  ) {

    try {

      detected =
        detectPiecesFromMask();

    } catch (error) {

      console.warn(
        "마스크 분석 실패:",
        error
      );

    }

  }

  if (
    !detected &&
    USE_GRID_FALLBACK
  ) {

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

  paperSurface.width =
    IMAGE_WIDTH;

  paperSurface.height =
    IMAGE_HEIGHT;

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

  // 포스터 좌우로 넉넉한 공간 확보
  const sideWidth =
    rect.width * CURTAIN_SIDE_PADDING;

  const totalWidth =
    rect.width + sideWidth * 2;

  // 실제 캔버스 크기 확장
  canvas.style.width = `${totalWidth}px`;
  canvas.style.height = `${rect.height}px`;

  // 원래 포스터를 캔버스 중앙에 배치
  canvas.style.left = `${-sideWidth}px`;
  canvas.style.top = "0px";

  canvas.style.position = "absolute";
  canvas.style.maxWidth = "none";
  canvas.style.maxHeight = "none";

  poster.style.overflow = "visible";

  const layout =
    poster.closest(".poster-layout");

  if (layout) {
    layout.style.overflow = "visible";
  }

  canvas.width = Math.round(totalWidth * dpr);
  canvas.height = Math.round(rect.height * dpr);

  // 원래 포스터 좌표계를 중앙으로 이동
  const scale = canvas.height / IMAGE_HEIGHT;

  ctx.setTransform(
    scale,
    0,
    0,
    scale,
    sideWidth * dpr,
    0
  );

  render();

}


/* ==========================================
   커튼 휘어짐 계산
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

  const normalizedY =
    Math.max(
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
   움직이는 커튼 그리기
========================================== */

function drawMovingPaper() {

  const stripWidth =
    IMAGE_WIDTH / STRIP_COUNT;

  const segmentHeight =
    IMAGE_HEIGHT / SEGMENT_COUNT;

  for (
    let col = 0;
    col < STRIP_COUNT;
    col++
  ) {

    for (
      let row = 0;
      row < SEGMENT_COUNT;
      row++
    ) {

      const x =
        col * stripWidth;

      const y =
        row * segmentHeight;

      const offset =
        getBendOffset(
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
   REVERSE LOOP
   되돌아오는 종이 그리기
========================================== */

function drawReverseLoop(time) {

  const elapsed = time - reverseLoopStart;

  const moveDuration =
    REVERSE_LOOP_DURATION -
    REVERSE_LOOP_STAGGER;

  // 1. 기존에 종이를 뜯어서 구멍이 생긴 포스터 표시
  ctx.drawImage(
    paperSurface,
    0,
    0,
    IMAGE_WIDTH,
    IMAGE_HEIGHT
  );

  // 2. 뜯어낸 직사각형 조각들만 원래 자리로 복귀
  reversePieces.forEach(item => {

    const localTime = elapsed - item.delay;

    const t = Math.max(
      0,
      Math.min(1, localTime / moveDuration)
    );

    const eased =
      1 - Math.pow(1 - t, 3);

    const piece = item.piece;

    // 복원이 완료된 조각은 원래 위치에 고정
    if (t >= 1) {

      ctx.drawImage(
        posterImage,
        piece.x,
        piece.y,
        piece.width,
        piece.height,
        piece.x,
        piece.y,
        piece.width,
        piece.height
      );

      return;
    }

    // 아직 복귀 시간이 되지 않은 조각은 대기
    if (localTime < 0) return;

    const currentX =
      item.startX +
      (piece.x - item.startX) * eased;

    const currentY =
      item.startY +
      (piece.y - item.startY) * eased;

    const rotation =
      item.startRotation * (1 - eased);

    ctx.save();

    ctx.translate(
      currentX + piece.width / 2,
      currentY + piece.height / 2
    );

    ctx.rotate(rotation);

    // 원래 클릭해서 뜯어냈던 부분만 잘라서 그림
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

  // 확장된 캔버스 전체 지우기
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

  // 종이가 돌아오는 애니메이션
  if (reverseLoopPlaying) {

    drawReverseLoop(performance.now());

    return;
  }

  if (curtainMode) {

    // 커튼 모드에서는 경계 제한 없이 그리기
    drawMovingPaper();

  } else {

    // 평소에는 원래 포스터 표시
    ctx.drawImage(
      paperSurface,
      0,
      0,
      IMAGE_WIDTH,
      IMAGE_HEIGHT
    );

  }

  fallingPieces.forEach(
    drawFallingPiece
  );

}


/* ==========================================
   종이 한 칸 뜯기
========================================== */

function tearPiece(piece) {

  if (
    !piece ||
    piece.removed
  ) {
    return false;
  }

  piece.removed = true;

  piece.pending = false;

  // 뜯은 순서 저장
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

  if (
    removedCount >= POWER_UNLOCK_COUNT
  ) {

    powerControl.classList.add(
      "visible"
    );

  }

// 모든 종이를 뜯으면 커튼 모드
if (
  removedCount === pieces.length
) {

  setTimeout(() => {

    curtainMode = true;

    // 커튼 단계 진입 시 힘 초기화
    power = 1;

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
    1,
    3,
    6,
    10,
    16
  ];

  return counts[power - 1];

}


/* ==========================================
   클릭한 직사각형 찾기
========================================== */

function findPiece(x, y) {

  return pieces.find(piece => {

    if (
      piece.removed ||
      piece.pending
    ) {
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
   힘에 따라 여러 칸 뜯기
========================================== */

function tearWithPower(centerPiece) {

  if (!centerPiece) return;

  playPaperTearSound();

  const count =
    getTearCount();

  const centerX =
    centerPiece.x +
    centerPiece.width / 2;

  const centerY =
    centerPiece.y +
    centerPiece.height / 2;

  const candidates = pieces

    .filter(
      piece =>
        !piece.removed &&
        !piece.pending
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
   포스터 좌표 변환
========================================== */

function getPointerPosition(event) {

  // 확장된 캔버스가 아닌 원래 포스터 기준
  const rect = poster.getBoundingClientRect();

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
   터치 / 마우스 시작
========================================== */

canvas.addEventListener(
  "pointerdown",
  event => {

    event.preventDefault();

    if (!initialized) return;

    // 종이 복원 중에는 조작 불가능
    if (reverseLoopPlaying) return;

    const position =
      getPointerPosition(event);

    if (curtainMode) {

      dragging = true;

      curtainAudio.muted = false;

      startCurtainAudio();

      previousX =
        event.clientX;

      activeColumn =
        position.x /
        IMAGE_WIDTH *
        STRIP_COUNT;

      canvas.setPointerCapture(
        event.pointerId
      );

      canvas.style.cursor =
        "grabbing";

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

    previousX =
      event.clientX;

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
    canvas.hasPointerCapture(
      event.pointerId
    )
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


canvas.addEventListener(
  "pointercancel",
  endDrag
);


/* ==========================================
   힘 버튼
========================================== */

plusButton.addEventListener(
  "click",
  event => {

    event.preventDefault();

    event.stopPropagation();

    power = Math.min(

  curtainMode ? MAX_POWER : getMaxUnlockedPower(),

  power + 1

);

    console.log(
      "현재 힘:",
      power
    );

  }
);


minusButton.addEventListener(
  "click",
  event => {

    event.preventDefault();

    event.stopPropagation();

    power = Math.max(
      1,
      power - 1
    );

    console.log(
      "현재 힘:",
      power
    );

  }
);


/* ==========================================
   마지막 자동 흔들림
========================================== */

let shakeStart = 0;

let shakeDuration = 0;


function startFinalShake() {

  shakeStart =
    performance.now();

  shakeDuration = 1500;

  activeColumn =
    STRIP_COUNT / 2;

}


/* ==========================================
   REVERSE LOOP START
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

  canvas.style.cursor =
    "default";

  // 힘 버튼 숨김
  powerControl.classList.remove(
    "visible"
  );

  // 볼륨 안내 이미지 숨김
  document
    .getElementById("curtainHint")
    ?.remove();

  curtainHintShown = false;

  // 기존에 떨어지던 종이 제거
  fallingPieces.length = 0;

  // 마지막에 뜯은 종이부터 복원
  const tornPieces = pieces

    .filter(
      piece => piece.removed
    )

    .sort((a, b) => {

      return (
        (b.tearOrder ?? 0) -
        (a.tearOrder ?? 0)
      );

    });

  reversePieces.length = 0;

  const count = Math.max(
    1,
    tornPieces.length - 1
  );

  tornPieces.forEach(
    (piece, index) => {

      const delay =
        (index / count) *
        REVERSE_LOOP_STAGGER;

      reversePieces.push({

        piece,

        delay,

        // 화면 아래에서 올라옴
        startX:
          piece.x +
          (Math.random() - 0.5) *
          IMAGE_WIDTH * 0.5,

        startY:
          IMAGE_HEIGHT *
          (1.05 + Math.random() * 0.18),

        // 회전된 상태에서 복원
        startRotation:
          (Math.random() - 0.5) *
          Math.PI * 1.5

      });

    }
  );

}


/* ==========================================
   REVERSE LOOP COMPLETE
========================================== */

function finishReverseLoop() {

  if (!reverseLoopPlaying) return;

  reverseLoopPlaying = false;

  reversePieces.length = 0;

  // 모든 종이 복원
  pieces.forEach(piece => {

    piece.removed = false;

    piece.pending = false;

    piece.tearOrder = undefined;

  });

  fallingPieces.length = 0;

  removedCount = 0;

  pendingTears = 0;

  // 힘 초기화
  power = 1;

  // 커튼 모드 종료
  curtainMode = false;

  dragging = false;

  dragX = 0;

  dragVelocity = 0;

  shakeDuration = 0;

  // 음악 초기화
  audioStarted = false;

  curtainAudio.pause();

  curtainAudio.currentTime = 0;

  curtainAudio.volume = 0;

  curtainAudio.muted = true;

  // 버튼 숨기기
  powerControl.classList.remove(
    "visible"
  );

  // 안내 이미지 제거
  document
    .getElementById("curtainHint")
    ?.remove();

  curtainHintShown = false;

  canvas.style.cursor =
    "pointer";

  // 흰색 포스터 복원
  updatePaperSurface();

  render();

  // 다음 반복을 위한 감지
  requestAnimationFrame(
    watchCurtainHint
  );

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


  /* ========================================
     종이 낙하
  ======================================== */

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


  /* ========================================
     화면 밖으로 떨어진 종이 제거
  ======================================== */

  for (
    let i = fallingPieces.length - 1;
    i >= 0;
    i--
  ) {

    const piece =
      fallingPieces[i];

    if (
      piece.opacity <= 0 ||
      piece.currentY >
      IMAGE_HEIGHT * 1.5
    ) {

      fallingPieces.splice(i, 1);

    }

  }


  /* ========================================
     마지막 자동 흔들림
  ======================================== */

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


  /* ========================================
     손을 놓으면 커튼 복귀
  ======================================== */

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


  /* ========================================
     음악 볼륨
  ======================================== */

  updateCurtainAudio();


  /* ========================================
     리버스 루프 완료 확인
  ======================================== */

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

    if (
      now - lastTouchEnd <= 300
    ) {

      event.preventDefault();

    }

    lastTouchEnd = now;

  },
  { passive: false }
);


document.addEventListener(
  "gesturestart",
  event => {

    event.preventDefault();

  },
  { passive: false }
);


document.addEventListener(
  "gesturechange",
  event => {

    event.preventDefault();

  },
  { passive: false }
);


document.addEventListener(
  "touchmove",
  event => {

    event.preventDefault();

  },
  { passive: false }
);


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

    // 종이 조각 생성
    createPieces();

    // 초기 포스터 생성
    updatePaperSurface();

    initialized = true;

    // 캔버스 크기
    resizeCanvas();

    // 애니메이션 시작
    requestAnimationFrame(animate);

    console.log(
      "포스터 초기화 완료"
    );

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


/* ==========================================
   실행
========================================== */

initialize();


/* ==========================================
   CURTAIN IMAGE HINT
========================================== */

let curtainHintShown = false;


function showCurtainHint() {

  if (curtainHintShown) return;

  const layout =
    document.querySelector(".poster-layout");

  if (!layout) return;

  curtainHintShown = true;

  const oldHint =
    document.getElementById("curtainHint");

  if (oldHint) {
    oldHint.remove();
  }

  const hintImage =
    document.createElement("img");

  hintImage.id =
    "curtainHint";

  hintImage.className =
    "curtain-hint";

  hintImage.src = new URL(
    "./volume.png",
    import.meta.url
  ).href;

  hintImage.alt =
    "볼륨 안내";

  hintImage.draggable = false;

  hintImage.addEventListener(
    "error",
    () => {

      console.error(
        "볼륨 이미지를 불러오지 못했습니다:",
        hintImage.src
      );

    }
  );

  layout.appendChild(
    hintImage
  );

  hintImage.classList.add(
    "visible"
  );

}


/* ==========================================
   커튼 전환 감지
========================================== */

function watchCurtainHint() {

  if (curtainMode) {

    showCurtainHint();

    return;

  }

  requestAnimationFrame(
    watchCurtainHint
  );

}


requestAnimationFrame(
  watchCurtainHint
);


/* ==========================================
   음악 종료 → REVERSE LOOP
========================================== */

curtainAudio.addEventListener(
  "ended",
  startReverseLoop
);