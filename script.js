const boardEl = document.getElementById('board');
const trayGreenEl = document.getElementById('tray-green');
const trayOrangeEl = document.getElementById('tray-orange');
const undoBtn = document.getElementById('undo');
const resetBtn = document.getElementById('reset');
const turnEl = document.getElementById('turn');
const overlayEl = document.getElementById('overlay');
const winnerTextEl = document.getElementById('winner-text');
const overlayResetBtn = document.getElementById('overlay-reset');

const SIZE = 3;
const PER_SIZE_COUNT = 2;
const SIZES = [1, 2, 3];

let gameOver = false;
let currentPlayer = 'green';
let history = [];
let cells;
let tray;

// --------------- 共通ユーティリティ ----------------
function sizeName(n) {
  return n === 1 ? 'small' : n === 2 ? 'medium' : 'large';
}

// dataTransferから安全にペイロードを取り出す
function getPayloadFromDataTransfer(dt) {
  // 独自タイプを優先
  const custom = dt.getData('application/x-gobblers');
  if (custom) {
    try {
      return JSON.parse(custom);
    } catch (e) {}
  }
  // 通常テキスト
  const txt = dt.getData('text/plain');
  if (txt) {
    try {
      return JSON.parse(txt);
    } catch (e) {}
  }
  return null;
}

// dragstartにつけるヘルパ
function setDragPayload(e, payload) {
  const json = JSON.stringify(payload);
  e.dataTransfer.setData('application/x-gobblers', json);
  e.dataTransfer.setData('text/plain', json);
  e.dataTransfer.effectAllowed = 'move';
}

// --------------- 初期化 ----------------
function initState() {
  cells = Array(SIZE * SIZE).fill(0).map(() => []);
  tray = {
    green: { 1: PER_SIZE_COUNT, 2: PER_SIZE_COUNT, 3: PER_SIZE_COUNT },
    orange: { 1: PER_SIZE_COUNT, 2: PER_SIZE_COUNT, 3: PER_SIZE_COUNT },
  };
  currentPlayer = 'green';
  gameOver = false;
  history = [];
  hideWinOverlay();
}

function createBoard() {
  boardEl.innerHTML = '';
  for (let i = 0; i < SIZE * SIZE; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;
    cell.addEventListener('dragover', e => {
      e.preventDefault();
      cell.classList.add('droptarget');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('droptarget'));
    cell.addEventListener('drop', onDropToCell);
    boardEl.appendChild(cell);
  }
}

// --------------- レンダリング ----------------
function renderBoard(winLine = null) {
  const cellEls = document.querySelectorAll('.cell');
  cellEls.forEach((cellEl, idx) => {
    cellEl.innerHTML = '';
    cellEl.classList.remove('win');
    const stack = cells[idx];
    if (stack.length) {
      const top = stack[stack.length - 1];
      const img = document.createElement('img');
      img.src = `images/${top.player}_${sizeName(top.size)}.png`;
      img.alt = `${top.player} ${sizeName(top.size)}`;
      img.className = `size-${top.size}`;

      // ここがポイント：GitHub上でも確実にdragstartが走るようにする
      if (!gameOver && top.player === currentPlayer) {
        img.draggable = true;
        img.classList.add('draggable-piece');
        img.addEventListener('dragstart', e => {
          e.stopPropagation();
          setDragPayload(e, {
            src: 'board',
            index: idx,
            size: top.size,
            player: top.player,
          });
        });
      }

      cellEl.appendChild(img);
    }

    if (winLine && winLine.includes(idx)) {
      cellEl.classList.add('win');
    }
  });
}

function renderTray() {
  trayGreenEl.innerHTML = '';
  trayOrangeEl.innerHTML = '';
  renderTrayFor('green', trayGreenEl);
  renderTrayFor('orange', trayOrangeEl);
}

function renderTrayFor(player, host) {
  const slots = [];
  const total = SIZES.reduce((sum, s) => sum + tray[player][s], 0);
  const needed = Math.max(total, 6);
  for (let i = 0; i < needed; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    host.appendChild(slot);
    slots.push(slot);
  }

  let k = 0;
  SIZES.forEach(size => {
    for (let n = 0; n < tray[player][size]; n++) {
      const img = document.createElement('img');
      img.src = `images/${player}_${sizeName(size)}.png`;
      img.alt = `${player} ${sizeName(size)}`;
      img.className = `size-${size}`;

      if (!gameOver && currentPlayer === player) {
        img.draggable = true;
        img.classList.add('draggable-piece');
        img.addEventListener('dragstart', e => {
          e.stopPropagation();
          setDragPayload(e, {
            src: 'tray',
            player,
            size,
          });
        });
      }

      slots[k++].appendChild(img);
    }
  });
}

function renderAll(winLine = null) {
  renderBoard(winLine);
  renderTray();
  turnEl.textContent = gameOver
    ? '対局終了'
    : `手番：${currentPlayer === 'green' ? '緑' : 'オレンジ'}`;
}

// --------------- ドロップ処理 ----------------
function onDropToCell(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('droptarget');
  if (gameOver) return;

  const payload = getPayloadFromDataTransfer(e.dataTransfer);
  if (!payload) return;

  const targetIndex = Number(e.currentTarget.dataset.index);
  const targetStack = cells[targetIndex];
  const targetTop = targetStack[targetStack.length - 1];

  let move = null;

  // トレイから
  if (payload.src === 'tray') {
    if (payload.player !== currentPlayer) return;
    if (tray[payload.player][payload.size] <= 0) return;
    move = { player: payload.player, size: payload.size, from: { type: 'tray' } };
  }
  // 盤上から移動
  else if (payload.src === 'board') {
    const srcIndex = payload.index;
    const srcStack = cells[srcIndex];
    const srcTop = srcStack[srcStack.length - 1];
    if (!srcTop) return;
    if (srcTop.player !== currentPlayer) return;
    if (srcTop.size !== payload.size) return;
    if (srcIndex === targetIndex) return;

    move = {
      player: srcTop.player,
      size: srcTop.size,
      from: { type: 'board', index: srcIndex },
    };
  }

  if (!move) return;

  // サイズチェック
  if (targetTop && targetTop.size >= move.size) return;

  pushHistory();

  // 元から削除 or トレイから減らす
  if (move.from.type === 'tray') {
    tray[move.player][move.size]--;
  } else {
    cells[move.from.index].pop();
  }

  // 置く
  cells[targetIndex].push({ player: move.player, size: move.size });

  // 勝ち判定
  const winInfo = checkWin(move.player);
  if (winInfo.won) {
    gameOver = true;
    renderAll(winInfo.line);
    showWinOverlay(move.player);
  } else {
    currentPlayer = currentPlayer === 'green' ? 'orange' : 'green';
    renderAll();
  }
}

// --------------- 勝敗・履歴 ----------------
function checkWin(player) {
  const topByCell = Array(9)
    .fill(null)
    .map((_, i) => {
      const s = cells[i];
      return s.length ? s[s.length - 1].player : null;
    });

  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ];

  for (const line of lines) {
    if (line.every(i => topByCell[i] === player)) {
      return { won: true, line };
    }
  }
  return { won: false, line: null };
}

function deepCloneState() {
  return {
    currentPlayer,
    gameOver,
    cells: cells.map(st => st.map(p => ({ ...p }))),
    tray: { green: { ...tray.green }, orange: { ...tray.orange } },
  };
}

function pushHistory() {
  history.push(deepCloneState());
}

function restoreState(state) {
  currentPlayer = state.currentPlayer;
  gameOver = state.gameOver;
  cells = state.cells.map(st => st.map(p => ({ ...p })));
  tray = { green: { ...state.tray.green }, orange: { ...state.tray.orange } };
  hideWinOverlay();
  renderAll();
}

function undo() {
  if (!history.length) return;
  const prev = history.pop();
  restoreState(prev);
}

function reset() {
  initState();
  createBoard();
  renderAll();
}

// --------------- 勝利オーバーレイ ----------------
function showWinOverlay(player) {
  winnerTextEl.textContent = player === 'green' ? '緑の勝ち！' : 'オレンジの勝ち！';
  overlayEl.classList.remove('hidden');
}
function hideWinOverlay() {
  overlayEl.classList.add('hidden');
}

// --------------- イベント ----------------
undoBtn.addEventListener('click', undo);
resetBtn.addEventListener('click', reset);
overlayResetBtn.addEventListener('click', reset);

// --------------- 起動 ----------------
initState();
createBoard();
renderAll();
