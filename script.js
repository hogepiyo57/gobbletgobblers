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

function initState() {
  cells = Array(SIZE * SIZE).fill(0).map(() => []);
  tray = {
    green: { 1: PER_SIZE_COUNT, 2: PER_SIZE_COUNT, 3: PER_SIZE_COUNT },
    orange: { 1: PER_SIZE_COUNT, 2: PER_SIZE_COUNT, 3: PER_SIZE_COUNT }
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
      if (!gameOver && top.player === currentPlayer) {
        img.draggable = true;
        img.classList.add('draggable-piece');
        img.addEventListener('dragstart', e => {
          e.dataTransfer.setData(
            'text/plain',
            JSON.stringify({ src: 'board', index: idx, size: top.size, player: top.player })
          );
        });
      }
      cellEl.appendChild(img);
    }

    // 勝ちラインなら光らせる
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
          e.dataTransfer.setData('text/plain', JSON.stringify({ src: 'tray', player, size }));
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

function onDropToCell(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('droptarget');
  if (gameOver) return;

  const payload = JSON.parse(e.dataTransfer.getData('text/plain'));
  const targetIndex = Number(e.currentTarget.dataset.index);
  const targetStack = cells[targetIndex];
  const targetTop = targetStack[targetStack.length - 1];

  let move = null;

  if (payload.src === 'tray') {
    if (payload.player !== currentPlayer) return;
    if (tray[payload.player][payload.size] <= 0) return;
    move = { player: payload.player, size: payload.size, from: { type: 'tray' } };
  } else if (payload.src === 'board') {
    const srcIndex = payload.index;
    const srcStack = cells[srcIndex];
    const srcTop = srcStack[srcStack.length - 1];
    if (!srcTop) return;
    if (srcTop.player !== currentPlayer) return;
    if (srcTop.size !== payload.size) return;
    if (srcIndex === targetIndex) return;
    move = { player: srcTop.player, size: srcTop.size, from: { type: 'board', index: srcIndex } };
  }

  if (!move) return;
  if (targetTop && targetTop.size >= move.size) return;

  pushHistory();

  if (move.from.type === 'tray') {
    tray[move.player][move.size]--;
  } else {
    cells[move.from.index].pop();
  }

  cells[targetIndex].push({ player: move.player, size: move.size });

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

function sizeName(n) {
  return n === 1 ? 'small' : n === 2 ? 'medium' : 'large';
}

// 勝敗判定：勝ってたら {won:true, line:[...]} を返す
function checkWin(player) {
  const topByCell = Array(9).fill(null).map((_, i) => {
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
    cells: cells.map(stack => stack.map(p => ({ ...p }))),
    tray: { green: { ...tray.green }, orange: { ...tray.orange } },
  };
}

function pushHistory() {
  history.push(deepCloneState());
}

function restoreState(state) {
  currentPlayer = state.currentPlayer;
  gameOver = state.gameOver;
  cells = state.cells.map(stack => stack.map(p => ({ ...p })));
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

function showWinOverlay(player) {
  const name = player === 'green' ? '緑の勝ち！' : 'オレンジの勝ち！';
  winnerTextEl.textContent = name;
  overlayEl.classList.remove('hidden');
}

function hideWinOverlay() {
  overlayEl.classList.add('hidden');
}

// イベント
undoBtn.addEventListener('click', undo);
resetBtn.addEventListener('click', reset);
overlayResetBtn.addEventListener('click', reset);

// 起動
initState();
createBoard();
renderAll();
