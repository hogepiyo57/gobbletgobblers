const board = document.getElementById('board');
const undoBtn = document.getElementById('undo');
const resetBtn = document.getElementById('reset');

const size = 3;
let currentPlayer = 'green';
let history = [];

// 各マスの状態を保持（スタック構造）
let cells = Array(size * size).fill(0).map(() => []);

function createBoard() {
  for (let i = 0; i < size * size; i++) {
    const cell = document.createElement('div');
    cell.classList.add('cell');
    cell.dataset.index = i;
    cell.addEventListener('dragover', e => e.preventDefault());
    cell.addEventListener('drop', dropPiece);
    board.appendChild(cell);
  }
}

// コマのドラッグ設定（プレイヤーごと）
function setupPieces() {
  const container = document.createElement('div');
  container.id = 'pieces';
  document.body.insertBefore(container, board);

  ['green', 'orange'].forEach(player => {
    [1, 2, 3].forEach(size => {
      const img = document.createElement('img');
      img.src = `images/${player}_${getSizeName(size)}.png`;
      img.id = `${player}_${size}`;
      img.dataset.player = player;
      img.dataset.size = size;
      img.draggable = true;
      img.addEventListener('dragstart', e => {
        e.dataTransfer.setData('piece', img.id);
      });
      container.appendChild(img);
    });
  });
}

function dropPiece(e) {
  e.preventDefault();
  const pieceId = e.dataTransfer.getData('piece');
  const piece = document.getElementById(pieceId);
  const targetIndex = e.currentTarget.dataset.index;
  const targetStack = cells[targetIndex];

  const sizeValue = parseInt(piece.dataset.size);
  const topPiece = targetStack[targetStack.length - 1];

  if (topPiece && topPiece.size >= sizeValue) return; // 大きさで上書きできるか判定
  if (piece.dataset.player !== currentPlayer) return; // 自分のターン以外では置けない

  history.push(JSON.parse(JSON.stringify(cells))); // 履歴保存
  targetStack.push({ player: currentPlayer, size: sizeValue });

  renderBoard();

  if (checkWin(currentPlayer)) {
    setTimeout(() => alert(`${currentPlayer.toUpperCase()} の勝ち！`), 10);
  } else {
    currentPlayer = currentPlayer === 'green' ? 'orange' : 'green';
  }
}

function renderBoard() {
  document.querySelectorAll('.cell').forEach((cell, i) => {
    cell.innerHTML = '';
    const stack = cells[i];
    if (stack.length > 0) {
      const top = stack[stack.length - 1];
      const img = document.createElement('img');
      img.src = `images/${top.player}_${getSizeName(top.size)}.png`;
      cell.appendChild(img);
    }
  });
}

function getSizeName(n) {
  return n === 1 ? 'small' : n === 2 ? 'medium' : 'large';
}

function checkWin(player) {
  const grid = Array(9).fill(null).map((_, i) => {
    const s = cells[i];
    return s.length > 0 ? s[s.length - 1].player : null;
  });

  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  return lines.some(line => line.every(i => grid[i] === player));
}

function undoMove() {
  if (history.length > 0) {
    cells = history.pop();
    renderBoard();
    currentPlayer = currentPlayer === 'green' ? 'orange' : 'green';
  }
}

function resetGame() {
  cells = Array(size * size).fill(0).map(() => []);
  history = [];
  currentPlayer = 'green';
  renderBoard();
}

undoBtn.addEventListener('click', undoMove);
resetBtn.addEventListener('click', resetGame);

createBoard();
setupPieces();
renderBoard();
