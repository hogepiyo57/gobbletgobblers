const boardEl = document.getElementById('board');
} else if(payload.src === 'board'){
// 盤上の駒を動かす：トップかつ自分の駒のみ
const sIdx = payload.index;
const srcStack = cells[sIdx];
const srcTop = srcStack[srcStack.length-1];
if(!srcTop) return;
if(srcTop.player !== currentPlayer) return;
if(srcTop.size !== payload.size) return;
move = { player: srcTop.player, size: srcTop.size, from: { type:'board', index:sIdx } };
}
if(!move) return;


// サイズ判定（大きい駒のみ上書き許可）
if(targetTop && targetTop.size >= move.size) return;


// 実行：履歴保存
pushHistory();


if(move.from.type === 'tray'){
tray[move.player][move.size]--; // トレイから減らす
} else {
cells[move.from.index].pop(); // 元セルから外す
}
cells[tIdx].push({ player: move.player, size: move.size });


// 勝敗判定
if(checkWin(move.player)){
gameOver = true;
} else {
currentPlayer = currentPlayer==='green' ? 'orange' : 'green';
}
renderAll();
}


function sizeName(n){ return n===1?'small': n===2?'medium':'large'; }


function checkWin(player){
const topByCell = Array(9).fill(null).map((_,i)=>{
const s = cells[i];
return s.length? s[s.length-1].player : null;
});
const lines = [ [0,1,2],[3,4,5],[6,7,8], [0,3,6],[1,4,7],[2,5,8], [0,4,8],[2,4,6] ];
return lines.some(line => line.every(i => topByCell[i]===player));
}


function undo(){
if(!history.length) return;
const prev = history.pop();
restoreState(prev);
}


function reset(){ initState(); createBoard(); renderAll(); }


undoBtn.addEventListener('click', undo);
resetBtn.addEventListener('click', reset);


// 起動
initState();
createBoard();
renderAll();
