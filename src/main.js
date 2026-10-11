/* ==========================================
   INTERACTIVE PAPER POSTER

   - 첫 화면 이미지
   - 직사각형 한 칸씩 뜯기
   - 종이 낙하 애니메이션
   - PNG 힘 버튼
   - 힘에 따라 여러 칸 뜯기
   - 모든 칸을 뜯은 뒤 커튼 움직임
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
   이미지 파일
========================================== */

const POSTER_IMAGE =
  "/src/처음화면.png";

const MASK_IMAGE =
  "/src/커튼.png";

/* ==========================================
   CURTAIN AUDIO SYSTEM

   커튼을 잡으면 음악 시작
   커튼을 열수록 음악이 선명해짐
   커튼을 놓으면 무음
   무음이어도 음악 시간은 계속 흐름
========================================== */

// 음악 파일
const curtainAudio = new Audio("/src/창문.mp3");

curtainAudio.preload = "auto";
curtainAudio.loop = false;
curtainAudio.volume = 0;

// 음악이 시작되었는지 확인
let audioStarted = false;

// 음악 시작
function startCurtainAudio() {

  if (audioStarted) return;

  audioStarted = true;

  curtainAudio.play().catch(error => {

    audioStarted = false;

    console.error("음악 재생 실패:", error);

  });

}

// 커튼 움직임에 따른 음량 계산
function updateCurtainAudio() {

  if (!curtainMode || !audioStarted) return;

  // 커튼을 잡고 있지 않으면 무조건 무음
  if (!dragging) {
    curtainAudio.muted = true;
    curtainAudio.volume = 0;
    return;
  }

  // 커튼을 잡고 있으면 음소거 해제
  curtainAudio.muted = false;

  const pullStrength =
    1 + (power - 1) * 0.42;

  const opening =
    Math.abs(dragX) * pullStrength;

  const maxOpening =
    IMAGE_WIDTH * 0.45;

  const volume = Math.min(
    1,
    Math.max(0, opening / maxOpening)
  );

  curtainAudio.volume = volume;

}


/* ==========================================
   설정
========================================== */

const BASE_WIDTH = 960;
const BASE_HEIGHT = 1600;

// 3개 뜯으면 힘 버튼 등장
const POWER_UNLOCK_COUNT = 3;

// 힘 최대 단계
const MAX_POWER = 5;

// 커튼 세로줄
const STRIP_COUNT = 24;

// 세로줄 휘어짐 세분화
const SEGMENT_COUNT = 90;

// 마스크 판별이 어려울 때 사용할 좌표
const USE_GRID_FALLBACK = true;

// 마스크 자동 판별을 사용할지
const USE_IMAGE_MASK = true;


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

   캐시된 이미지도 정상 처리
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

   포스터 원본 기준: 960 × 1600

   가로 경계와 세로 경계를
   개별적으로 정의

   마스크 이미지와 비교하여
   실제 뜯을 칸을 선택
========================================== */

// 세로줄 경계
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

// 가로줄 경계
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
   기존 좌표를 예비 데이터로 사용

   마스크 이미지 분석이 실패했을 때만
   사용됨
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
      [380,425], [425,470],
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
      [380,425], [425,470],
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
      [380,425], [425,470],
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

  const sx = IMAGE_WIDTH / BASE_WIDTH;
  const sy = IMAGE_HEIGHT / BASE_HEIGHT;

  const columns = [];

  // 중앙 여백을 넘는 가로 칸은 만들지 않음
  for (let i = 0; i < GRID_X.length - 1; i++) {

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

        removed: false

      });

    });

  });

  return candidates;

}


/* ==========================================
   마스크 기반 뜯기 영역 판별

   연결된 영역을 탐색하지 않고
   각 직사각형 중앙 색을 비교
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

  const pixels = imageData.data;

  const candidates =
    createGridCandidates();

  if (candidates.length === 0) {
    return false;
  }

  /*
    각 칸 안쪽 9개 위치의 색상을 조사한다.
    점선이나 경계선의 영향을 줄이기 위해
    칸 가장자리는 검사하지 않는다.
  */

  const samples = candidates.map(piece => {

    let brightness = 0;
    let alpha = 0;

    let count = 0;

    for (let iy = 1; iy <= 3; iy++) {

      for (let ix = 1; ix <= 3; ix++) {

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


  /*
    밝은 직사각형과
    어두운 배경의 색상 차이 확인
  */

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


  /*
    투명한 PNG 마스크라면
    투명 영역을 뜯는 칸으로 판단
  */

  if (maxAlpha - minAlpha > 80) {

    const threshold =
      (maxAlpha + minAlpha) / 2;

    selected = samples.filter(
      s => s.alpha < threshold
    );

  }

  /*
    불투명한 PNG라면
    밝은 색상의 칸을 뜯는 영역으로 판단
  */

  else if (
    maxBrightness - minBrightness > 15
  ) {

    const threshold =
      (maxBrightness + minBrightness) / 2;

    selected = samples.filter(
      s => s.brightness > threshold
    );

  }


  /*
    너무 적거나 너무 많은 칸이 선택되면
    자동 분석이 불확실한 것으로 판단
  */

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

      removed: false

    });

  });

  return true;

}


/* ==========================================
   예비 좌표 사용
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

          removed: false

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

      detected = detectPiecesFromMask();

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

  const rect =
    poster.getBoundingClientRect();

  if (
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return;
  }

  const dpr = Math.min(
    window.devicePixelRatio || 1,
    2
  );

  canvas.width =
    Math.round(rect.width * dpr);

  canvas.height =
    Math.round(rect.height * dpr);

  ctx.setTransform(
    canvas.width / IMAGE_WIDTH,
    0,
    0,
    canvas.height / IMAGE_HEIGHT,
    0,
    0
  );

  render();

}


/* ==========================================
   커튼 휘어짐 계산

   힘이 높을수록
   - 더 많은 커튼 줄이 함께 움직임
   - 더 멀리 젖혀짐
========================================== */

function getBendOffset(x, y) {

  const column =
    x / IMAGE_WIDTH * STRIP_COUNT;

  const distance =
    Math.abs(column - activeColumn);

  // 힘이 강할수록 움직이는 범위 확대
  const spread =
    10 + (power - 1) * 13;

  const influence =
    Math.exp(
      -(distance * distance) / spread
    );

  // 위쪽은 고정하고 아래쪽으로 갈수록 휘어짐
  const normalizedY =
    Math.max(
      0,
      (y / IMAGE_HEIGHT - 0.05) / 0.95
    );

  // 힘이 강할수록 당겨지는 거리 증가
  const pullStrength =
    1 + (power - 1) * 0.42;

  return (
    dragX *
    pullStrength *
    influence *
    Math.pow(normalizedY, 1.5)
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
   화면 그리기
========================================== */

function render() {

  if (!initialized) return;

  ctx.clearRect(
    0,
    0,
    IMAGE_WIDTH,
    IMAGE_HEIGHT
  );

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

  /*
    3칸 뜯으면
    PNG 힘 버튼 등장
  */

  if (
    removedCount >= POWER_UNLOCK_COUNT
  ) {

    powerControl.classList.add(
      "visible"
    );

  }

  /*
    모든 칸을 뜯으면
    커튼 모드
  */

  if (
    removedCount === pieces.length
  ) {

    setTimeout(() => {

      curtainMode = true;

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

    if (piece.removed) return false;

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

  const count =
    getTearCount();

  const centerX =
    centerPiece.x + centerPiece.width / 2;

  const centerY =
    centerPiece.y + centerPiece.height / 2;

  const candidates = pieces

    .filter(piece => !piece.removed)

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

  // 여러 번 빠르게 눌렀을 때
  // 같은 종이가 중복 예약되지 않도록 처리

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

  const rect =
    canvas.getBoundingClientRect();

  return {

    x:
      (event.clientX - rect.left) /
      rect.width *
      IMAGE_WIDTH,

    y:
      (event.clientY - rect.top) /
      rect.height *
      IMAGE_HEIGHT

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

    const position =
      getPointerPosition(event);

    /*
      커튼 모드
    */

    if (curtainMode) {

  dragging = true;
  curtainAudio.muted = false;

  // 커튼을 처음 잡으면 음악 시작
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

    /*
      종이 뜯기
    */

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

   힘이 강할수록
   더 멀리 잡아당길 수 있음
========================================== */

canvas.addEventListener(
  "pointermove",
  event => {

    if (!dragging) return;

    event.preventDefault();

    const rect =
      canvas.getBoundingClientRect();

    const dx =
      event.clientX - previousX;

    previousX =
      event.clientX;

    const scaledDX =
      dx * IMAGE_WIDTH / rect.width;

    // 힘이 높을수록 최대 당김 거리 증가
    const maxPull =
      IMAGE_WIDTH *
      (0.24 + (power - 1) * 0.09);

    dragX = Math.max(
      -maxPull,
      Math.min(
        maxPull,
        dragX + scaledDX * 0.55
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

}

canvas.addEventListener(
  "pointerup",
  endDrag
);

// 모바일에서 터치 연결이 끊어졌을 때
canvas.addEventListener("lostpointercapture", () => {

  dragging = false;

  curtainAudio.muted = true;
  curtainAudio.volume = 0;

});

// 다른 앱으로 전환했을 때
window.addEventListener("blur", () => {

  dragging = false;

  curtainAudio.muted = true;
  curtainAudio.volume = 0;

});

canvas.addEventListener(
  "pointercancel",
  endDrag
);


/* ==========================================
   힘 버튼

   별도의 숫자나 텍스트를
   화면에 표시하지 않음
========================================== */

plusButton.addEventListener(
  "click",
  event => {

    event.preventDefault();
    event.stopPropagation();

    power = Math.min(
      MAX_POWER,
      power + 1
    );

    console.log("현재 힘:", power);

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

    console.log("현재 힘:", power);

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
   애니메이션
========================================== */

function animate(time) {

  const delta = Math.min(

    (time - (lastTime || time)) / 1000,

    0.04

  );

  lastTime = time;

  /*
    종이 낙하
  */

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


  /*
    화면 밖으로 떨어진 종이 제거
  */

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


  /*
    마지막 자동 흔들림
  */

  if (
    curtainMode &&
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


  /*
    손을 놓으면 원래 위치로 복귀
  */

  if (
    curtainMode &&
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

  // 커튼 움직임에 맞춰 음악 음량 변경
updateCurtainAudio();

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

    /*
      처음 화면 이미지 로드
    */

    posterImage =
      await loadImage(POSTER_IMAGE);

    IMAGE_WIDTH =
      posterImage.naturalWidth;

    IMAGE_HEIGHT =
      posterImage.naturalHeight;


    /*
      마스크 이미지 로드

      마스크를 찾지 못해도
      화면 자체가 멈추지 않도록 처리
    */

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


    /*
      종이 조각 생성
    */

    createPieces();


    /*
      초기 포스터 생성
    */

    updatePaperSurface();


    /*
      초기화 완료
    */

    initialized = true;


    /*
      캔버스 크기
    */

    resizeCanvas();


    /*
      애니메이션 시작
    */

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

   커튼으로 전환되면
   볼륨(1).png 이미지 표시

   글자 애니메이션 없음
========================================== */

let curtainHintShown = false;

function showCurtainHint() {

  if (curtainHintShown) return;

  const layout =
    document.querySelector(".poster-layout");

  if (!layout) return;

  curtainHintShown = true;

  // 이전 안내 문구 제거
  const oldHint =
    document.getElementById("curtainHint");

  if (oldHint) {
    oldHint.remove();
  }

  // PNG 이미지 생성
  const hintImage =
    document.createElement("img");

  hintImage.id = "curtainHint";
  hintImage.className = "curtain-hint";

  hintImage.src = "/src/볼륨(1).png";

  hintImage.alt = "볼륨 안내";
  hintImage.draggable = false;

  // 이미지 로딩 오류 확인
  hintImage.addEventListener("error", () => {
    console.error(
      "볼륨 이미지를 불러오지 못했습니다:",
      hintImage.src
    );
  });

  layout.appendChild(hintImage);

  // 이미지 표시
  hintImage.classList.add("visible");

}


/* ==========================================
   커튼 전환 감지
========================================== */

function watchCurtainHint() {

  if (curtainMode) {

    showCurtainHint();

    return;

  }

  requestAnimationFrame(watchCurtainHint);

}

requestAnimationFrame(watchCurtainHint);

/* ==========================================
   음악 종료 후 커튼 전환
========================================== */

let curtainEndingPlaying = false;

function resetPosterAfterMusic() {

  // 종이 조각 초기화
  pieces.forEach(piece => {
    piece.removed = false;
    piece.pending = false;
  });

  fallingPieces.length = 0;

  removedCount = 0;
  pendingTears = 0;
  power = 1;

  // 커튼 초기화
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

  // 안내 이미지 제거
  curtainHintShown = false;

  document
    .getElementById("curtainHint")
    ?.remove();

  // 힘 버튼 숨기기
  powerControl.classList.remove("visible");

  canvas.style.cursor = "pointer";

  updatePaperSurface();
  render();

  requestAnimationFrame(watchCurtainHint);

}


/* ==========================================
   커튼이 열리는 화면 전환
========================================== */

function playCurtainEnding() {

  if (curtainEndingPlaying || !curtainMode) return;

  curtainEndingPlaying = true;

  dragging = false;

  curtainAudio.muted = true;
  curtainAudio.volume = 0;

  // 전환 화면 생성
  const overlay = document.createElement("div");

  Object.assign(overlay.style, {
    position: "absolute",
    inset: "0",
    overflow: "hidden",
    zIndex: "40",
    pointerEvents: "auto",

    background:
      `white url("${POSTER_IMAGE}") center / 100% 100% no-repeat`
  });

  // 왼쪽과 오른쪽 커튼
  const left = document.createElement("div");
  const right = document.createElement("div");

  for (const [panel, side] of [
    [left, "left"],
    [right, "right"]
  ]) {

    Object.assign(panel.style, {
      position: "absolute",
      top: "0",
      bottom: "0",
      width: "50%",
      [side]: "0",

      backgroundImage: `url("${POSTER_IMAGE}")`,
      backgroundRepeat: "no-repeat",
      backgroundSize: "200% 100%",

      backgroundPosition:
        side === "left"
          ? "left center"
          : "right center",

      transition:
        "transform 1.5s cubic-bezier(.65,0,.25,1)",

      willChange: "transform"
    });

    overlay.appendChild(panel);
  }

  poster.appendChild(overlay);

  // 커튼을 양옆으로 열기
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {

      left.style.transform = "translateX(-102%)";
      right.style.transform = "translateX(102%)";

    });
  });

  // 전환 완료 후 처음 상태로 복귀
  window.setTimeout(() => {

    resetPosterAfterMusic();

    overlay.remove();

    curtainEndingPlaying = false;

  }, 1650);

}


/* ==========================================
   음악 종료 감지
========================================== */

curtainAudio.addEventListener(
  "ended",
  playCurtainEnding
);