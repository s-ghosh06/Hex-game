// ═══════════════════════════════════════════════════════════════════
//  HEX STRATEGY — script.js
//
//  FIXES IN THIS VERSION:
//    #1  How to Play text simplified (HTML only)
//    #2  toggleSection() — single function handles both collapsibles
//    #3  Header centered (CSS only)
//    #4  Move/Nodes/Depth/Turn moved inside AI Brain card
//    #5  Player side selection — player picks LR or TB before game
//
//  Algorithms:
//    1. Minimax Search        — Shannon (1950), Philosophical Magazine
//    2. Alpha-Beta Pruning    — Knuth & Moore (1975), AI Journal
//    3. Union-Find (win check)— Tarjan (1975), Journal of the ACM
//    4. Dijkstra heuristic    — Board evaluation / path cost
// ═══════════════════════════════════════════════════════════════════

const EMPTY  = 0;
const PIECE1 = 1;  // Left→Right connector (Teal)
const PIECE2 = 2;  // Top→Bottom connector (Gold)

const DIFF_DEPTH = { easy: 1, medium: 2, hard: 3 };
const HEX_DIRS   = [[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0]];

// ─── GAME STATE ─────────────────────────────────────────────────────
let N           = 7;
let board       = [];
let currentTurn = PIECE1;
let gameOver    = false;
let diff        = 'easy';
let gameMode    = 'ai';
let playerSide  = 'LR';   // 'LR' = player is PIECE1 (teal), 'TB' = player is PIECE2 (gold)
let aiAlgo      = 'alphabeta'; // minimax, alphabeta, dijkstra
let moveHistory = [];
let totalNodes  = 0;
let totalPruned = 0;
let lastAIMove  = null;
let lastAITime  = 0;
let hintHex     = null;

function getPlayerPiece() { return playerSide === 'LR' ? PIECE1 : PIECE2; }
function getAIPiece()     { return playerSide === 'LR' ? PIECE2 : PIECE1; }

function setAlgorithm(algo) {
  aiAlgo = algo;
  const els = ['algo-mm','algo-ab-only','algo-ab','algo-dj'];
  els.forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('active'); });
  if (algo==='minimax')   document.getElementById('algo-mm').classList.add('active');
  if (algo==='abonly')    document.getElementById('algo-ab-only').classList.add('active');
  if (algo==='alphabeta') document.getElementById('algo-ab').classList.add('active');
  if (algo==='dijkstra')  document.getElementById('algo-dj').classList.add('active');
  
  const map = { minimax: 'Minimax ONLY', abonly: 'Alpha-Beta (Unsorted)', alphabeta: 'Minimax + α-β', dijkstra: 'Dijkstra Heur' };
  const el = document.getElementById('t-algo');
  if (el) el.textContent = map[algo];
}

// ─── UNION-FIND ──────────────────────────────────────────────────────
class UnionFind {
  constructor(n) {
    this.parent = Array.from({length:n}, (_,i) => i);
    this.rank   = new Array(n).fill(0);
  }
  find(x) {
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }
  union(a, b) {
    const ra = this.find(a), rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra] < this.rank[rb]) this.parent[ra] = rb;
    else if (this.rank[ra] > this.rank[rb]) this.parent[rb] = ra;
    else { this.parent[rb] = ra; this.rank[ra]++; }
  }
  connected(a, b) { return this.find(a) === this.find(b); }
}

let uf1, uf2;
const LR_LEFT  = () => N*N;
const LR_RIGHT = () => N*N+1;
const TB_TOP   = () => N*N;
const TB_BOT   = () => N*N+1;

function idx(r, c) { return r*N + c; }

function initUF() {
  uf1 = new UnionFind(N*N+2);
  uf2 = new UnionFind(N*N+2);
  for (let r=0; r<N; r++)
    for (let c=0; c<N; c++) {
      if (board[r][c] === PIECE1) _merge1(r, c);
      if (board[r][c] === PIECE2) _merge2(r, c);
    }
}

function _merge1(r, c) {
  if (c === 0)   uf1.union(idx(r,c), LR_LEFT());
  if (c === N-1) uf1.union(idx(r,c), LR_RIGHT());
  for (const [nr,nc] of neighbors(r,c))
    if (board[nr][nc] === PIECE1) uf1.union(idx(r,c), idx(nr,nc));
}
function _merge2(r, c) {
  if (r === 0)   uf2.union(idx(r,c), TB_TOP());
  if (r === N-1) uf2.union(idx(r,c), TB_BOT());
  for (const [nr,nc] of neighbors(r,c))
    if (board[nr][nc] === PIECE2) uf2.union(idx(r,c), idx(nr,nc));
}

function merge(piece, r, c) {
  if (piece === PIECE1) _merge1(r, c);
  else                  _merge2(r, c);
}

function checkWin(piece) {
  if (piece === PIECE1) return uf1.connected(LR_LEFT(), LR_RIGHT());
  return uf2.connected(TB_TOP(), TB_BOT());
}

// ─── NEIGHBORS ──────────────────────────────────────────────────────
function neighbors(r, c) {
  return HEX_DIRS
    .map(([dr,dc]) => [r+dr, c+dc])
    .filter(([nr,nc]) => nr>=0 && nr<N && nc>=0 && nc<N);
}

// ─── BOARD EVALUATION (Dijkstra) ────────────────────────────────────
function dijkstraCost(piece) {
  const INF   = 1e9;
  const dist2 = Array.from({length:N}, () => new Array(N).fill(INF));
  const pq    = [];
  const enemy = piece === PIECE1 ? PIECE2 : PIECE1;

  if (piece === PIECE1) {
    for (let r=0; r<N; r++) {
      const cost = board[r][0]===enemy ? INF : board[r][0]===piece ? 0 : 1;
      if (cost < INF) { dist2[r][0] = cost; pq.push([cost,r,0]); }
    }
  } else {
    for (let c=0; c<N; c++) {
      const cost = board[0][c]===enemy ? INF : board[0][c]===piece ? 0 : 1;
      if (cost < INF) { dist2[0][c] = cost; pq.push([cost,0,c]); }
    }
  }

  pq.sort((a,b) => a[0]-b[0]);
  while (pq.length) {
    const [d,r,c] = pq.shift();
    if (d > dist2[r][c]) continue;
    for (const [nr,nc] of neighbors(r,c)) {
      const nc2 = board[nr][nc]===enemy ? INF : board[nr][nc]===piece ? 0 : 1;
      if (nc2 === INF) continue;
      const nd = d+nc2;
      if (nd < dist2[nr][nc]) {
        dist2[nr][nc] = nd;
        pq.push([nd,nr,nc]);
        pq.sort((a,b) => a[0]-b[0]);
      }
    }
  }

  let best = INF;
  if (piece===PIECE1) for (let r=0;r<N;r++) best = Math.min(best, dist2[r][N-1]);
  else                for (let c=0;c<N;c++) best = Math.min(best, dist2[N-1][c]);
  return best===INF ? 999 : best;
}

// Score: positive = PIECE2 ahead, negative = PIECE1 ahead
function evaluate() {
  if (checkWin(PIECE2)) return  10000;
  if (checkWin(PIECE1)) return -10000;
  return dijkstraCost(PIECE1) - dijkstraCost(PIECE2);
}

// ─── MINIMAX + ALPHA-BETA ────────────────────────────────────────────
let nodesCount = 0, prunedCount = 0;

function minimax(depth, isMax, alpha, beta) {
  nodesCount++;
  if (checkWin(PIECE2)) return  10000 + depth;
  if (checkWin(PIECE1)) return -10000 - depth;
  if (depth === 0)      return evaluate();

  const empties = [];
  for (let r=0; r<N; r++)
    for (let c=0; c<N; c++)
      if (board[r][c] === EMPTY) empties.push([r,c]);
  if (!empties.length) return evaluate();

  let useEmpties = empties;
  if (aiAlgo !== 'abonly') {
    const cr = Math.floor(N/2), cm = Math.floor(N/2);
    useEmpties.sort((a,b) =>
      (Math.abs(a[0]-cr)+Math.abs(a[1]-cm)) -
      (Math.abs(b[0]-cr)+Math.abs(b[1]-cm))
    );
  }

  if (isMax) {
    let best = -Infinity;
    for (const [r,c] of useEmpties) {
      board[r][c] = PIECE2; merge(PIECE2, r, c);
      const val = minimax(depth-1, false, alpha, beta);
      board[r][c] = EMPTY; initUF();
      if (val > best) best = val;
      if (val > alpha) alpha = val;
      if ((aiAlgo === 'alphabeta' || aiAlgo === 'abonly') && beta <= alpha) { prunedCount++; break; }
    }
    return best;
  } else {
    // !isMax = PIECE1's move
    let best = Infinity;
    for (const [r,c] of useEmpties) {
      board[r][c] = PIECE1; merge(PIECE1, r, c);
      const val = minimax(depth-1, true, alpha, beta);
      board[r][c] = EMPTY; initUF();
      if (val < best) best = val;
      if (val < beta) beta = val;
      if ((aiAlgo === 'alphabeta' || aiAlgo === 'abonly') && beta <= alpha) { prunedCount++; break; }
    }
    return best;
  }
}

function getBestMove() {
  nodesCount = 0; prunedCount = 0;
  const depth   = DIFF_DEPTH[diff];
  const aiPiece = getAIPiece();
  // isMax = true when AI is PIECE2, false when AI is PIECE1
  const aiIsMax = aiPiece === PIECE2;
  const startedTime = performance.now();
  let bestVal = aiIsMax ? -Infinity : Infinity;
  let bestMove = null;

  const empties = [];
  for (let r=0; r<N; r++)
    for (let c=0; c<N; c++)
      if (board[r][c] === EMPTY) empties.push([r,c]);
  if (!empties.length) return null;

  const cr = Math.floor(N/2), cm = Math.floor(N/2);
  empties.sort((a,b) =>
    (Math.abs(a[0]-cr)+Math.abs(a[1]-cm)) -
    (Math.abs(b[0]-cr)+Math.abs(b[1]-cm))
  );

  if (diff === 'easy' && aiAlgo !== 'dijkstra') {
    const top = empties.slice(0, Math.min(6, empties.length));
    nodesCount = top.length;
    lastAITime = performance.now() - startedTime;
    return top[Math.floor(Math.random()*top.length)];
  }

  for (const [r,c] of empties) {
    board[r][c] = aiPiece; merge(aiPiece, r, c);
    // After AI places, next turn is opponent → flip isMax
    let val;
    if (aiAlgo === 'dijkstra') {
      val = evaluate();
      nodesCount++;
    } else {
      val = minimax(depth-1, !aiIsMax, -Infinity, Infinity);
    }
    board[r][c] = EMPTY; initUF();

    if (aiIsMax ? val > bestVal : val < bestVal) {
      bestVal = val;
      bestMove = [r,c];
    }
  }
  lastAITime = performance.now() - startedTime;
  return bestMove;
}

// ═══════════════════════════════════════════════════════════════════
//  GAME CONTROL
// ═══════════════════════════════════════════════════════════════════
function newGame() {
  board       = Array.from({length:N}, () => new Array(N).fill(EMPTY));
  currentTurn = PIECE1;
  gameOver    = false;
  moveHistory = [];
  totalNodes  = 0;
  totalPruned = 0;
  lastAIMove  = null;
  lastAITime  = 0;
  hintHex     = null;

  initUF();
  renderBoard();
  renderMoveHistory();
  updateEdgeLabels();
  updateLegend();
  resetBrainPanel();
  updateTurnUI();

  // If AI goes first (player chose TB = AI is PIECE1), trigger AI
  if (gameMode === 'ai' && currentTurn === getAIPiece()) {
    document.getElementById('think-badge').classList.add('show');
    setTimeout(doAIMove, 600);
  }
}

// ─── FIX #5: Side selection ──────────────────────────────────────────
function setPlayerSide(side) {
  playerSide = side;
  document.getElementById('side-lr').classList.toggle('active', side === 'LR');
  document.getElementById('side-tb').classList.toggle('active', side === 'TB');
  updateEdgeLabels();
  updateLegend();
  newGame();
}

// ─── MODE ───────────────────────────────────────────────────────────
function setMode(m) {
  gameMode = m;
  document.getElementById('mode-ai').classList.toggle('active', m==='ai');
  document.getElementById('mode-2p').classList.toggle('active', m==='2p');

  const sideSel = document.getElementById('side-selection');
  const dg      = document.getElementById('diff-group');
  const brain   = document.getElementById('ai-brain-card');

  if (m === '2p') {
    sideSel.classList.add('hidden');
    dg.classList.add('hidden');
    brain.classList.add('hidden');
  } else {
    sideSel.classList.remove('hidden');
    dg.classList.remove('hidden');
    brain.classList.remove('hidden');
  }

  newGame();
}

// ─── PLAYER MOVE ────────────────────────────────────────────────────
function playerMove(r, c) {
  if (gameOver) return;
  if (gameMode === 'ai' && currentTurn !== getPlayerPiece()) return;
  if (board[r][c] !== EMPTY) return;

  hintHex = null;
  const who = currentTurn;
  board[r][c] = who;
  merge(who, r, c);
  moveHistory.push({who, r, c, move: moveHistory.length+1});

  renderBoard();
  renderMoveHistory();
  if (document.getElementById('review-body')?.classList.contains('open')) runReview();
  checkCompStatus();

  if (checkWin(who)) { endGame(who); return; }

  currentTurn = (currentTurn === PIECE1) ? PIECE2 : PIECE1;
  updateTurnUI();

  if (gameMode === 'ai' && currentTurn === getAIPiece()) {
    document.getElementById('think-badge').classList.add('show');
    setTimeout(doAIMove, 600);
  }
}

// ─── AI MOVE ────────────────────────────────────────────────────────
function doAIMove() {
  if (gameOver || gameMode !== 'ai') return;
  const move = getBestMove();
  if (!move) { endGame(null); return; }

  const [r,c]   = move;
  const aiPiece = getAIPiece();
  board[r][c]   = aiPiece;
  merge(aiPiece, r, c);
  lastAIMove = {r, c};

  totalNodes  += nodesCount;
  totalPruned += prunedCount;
  moveHistory.push({who: aiPiece, r, c, move: moveHistory.length+1});

  updateBrainPanel();
  document.getElementById('think-badge').classList.remove('show');

  renderBoard();
  renderMoveHistory();
  if (document.getElementById('review-body')?.classList.contains('open')) runReview();
  checkCompStatus();

  if (checkWin(aiPiece)) { endGame(aiPiece); return; }

  currentTurn = getPlayerPiece();
  updateTurnUI();
}

// ─── UNDO ───────────────────────────────────────────────────────────
function undoMove() {
  if (gameOver || moveHistory.length < 1) return;
  const toRemove = (gameMode==='ai' && moveHistory.length>=2) ? 2 : 1;
  for (let i=0; i<toRemove && moveHistory.length>0; i++) {
    const m = moveHistory.pop();
    board[m.r][m.c] = EMPTY;
  }
  initUF();
  currentTurn = PIECE1;
  gameOver    = false;
  lastAIMove  = null;
  hintHex     = null;
  renderBoard();
  renderMoveHistory();
  if (document.getElementById('review-body')?.classList.contains('open')) runReview();
  checkCompStatus();
  updateTurnUI();
  setStatus('Move undone — your turn');
}

// ─── WIN PATH ───────────────────────────────────────────────────────
function findWinPath(piece) {
  const visited = new Set(), parent = {}, queue = [];
  if (piece === PIECE1) {
    for (let r=0;r<N;r++) if(board[r][0]===PIECE1){queue.push([r,0]);visited.add(`${r},0`);}
  } else {
    for (let c=0;c<N;c++) if(board[0][c]===PIECE2){queue.push([0,c]);visited.add(`0,${c}`);}
  }
  while (queue.length) {
    const [r,c] = queue.shift();
    const done  = piece===PIECE1 ? c===N-1 : r===N-1;
    if (done) {
      const path=[`${r},${c}`]; let key=`${r},${c}`;
      while(parent[key]){key=parent[key];path.push(key);}
      return new Set(path);
    }
    for (const [nr,nc] of neighbors(r,c)) {
      const k=`${nr},${nc}`;
      if (!visited.has(k)&&board[nr][nc]===piece){visited.add(k);parent[k]=`${r},${c}`;queue.push([nr,nc]);}
    }
  }
  return new Set();
}

// ─── END GAME ───────────────────────────────────────────────────────
function endGame(winner) {
  gameOver = true;
  const winPath = winner ? findWinPath(winner) : new Set();
  renderBoard(winPath);
  if (!winner) { setStatus('Draw — board full'); return; }

  const is2P      = gameMode === '2p';
  const playerWon = winner === getPlayerPiece();

  document.getElementById('m-icon').textContent  = playerWon ? '🏆' : (is2P ? '🏆' : '🤖');
  document.getElementById('m-title').textContent = is2P
    ? (winner===PIECE1 ? 'Player 1 Wins!' : 'Player 2 Wins!')
    : (playerWon ? 'You Win!' : 'AI Wins!');
  document.getElementById('m-sub').textContent = playerWon
    ? 'Your chain connected both edges. Brilliant!'
    : (is2P ? 'Chain connected. Well played!' : 'The AI found the winning path. Try again!');

  document.getElementById('ms-moves').textContent  = moveHistory.length;
  document.getElementById('ms-nodes').textContent  = is2P ? 'N/A' : totalNodes.toLocaleString();
  document.getElementById('ms-pruned').textContent = is2P ? 'N/A' : totalPruned.toLocaleString();
  document.getElementById('ms-diff').textContent   = is2P ? '2P'  : diff.toUpperCase();
  document.getElementById('ms-moves').style.color  = playerWon ? 'var(--teal)' : 'var(--gold)';

  setTimeout(() => document.getElementById('overlay').classList.add('show'), 700);
}
function closeModal() { document.getElementById('overlay').classList.remove('show'); }

// ═══════════════════════════════════════════════════════════════════
//  SVG BOARD RENDER
// ═══════════════════════════════════════════════════════════════════
function renderBoard(winPath = new Set()) {
  const svg  = document.getElementById('board-svg');
  const R    = 22;
  const W    = R * Math.sqrt(3);
  const H    = R * 2;
  const padX = 20, padY = 20;

  const svgW = Math.ceil(padX*2 + (N-1)*W + (N-1)*(W/2) + W);
  const svgH = Math.ceil(padY*2 + (N-1)*(R*1.5) + H);

  svg.setAttribute('width',  svgW);
  svg.setAttribute('height', svgH);
  svg.innerHTML = '';

  const defs   = document.createElementNS('http://www.w3.org/2000/svg','defs');
  const filter = document.createElementNS('http://www.w3.org/2000/svg','filter');
  filter.setAttribute('id','cs');
  filter.innerHTML = '<feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="rgba(27,43,75,0.18)"/>';
  defs.appendChild(filter);
  svg.appendChild(defs);

  const pp = getPlayerPiece();
  const ap = getAIPiece();

  for (let r=0; r<N; r++) {
    for (let c=0; c<N; c++) {
      const hcx = padX + c * W + r * (W/2) + W/2;
      const hcy = padY + r * (R*1.5) + H/2;

      const g = document.createElementNS('http://www.w3.org/2000/svg','g');
      let cls = 'hex-cell';
      if      (board[r][c] === pp) cls += ' player taken';
      else if (board[r][c] === ap) cls += ' ai taken';
      if (lastAIMove && lastAIMove.r===r && lastAIMove.c===c) cls += ' last-move';
      if (winPath.has(`${r},${c}`)) cls += ' win-path';
      if (hintHex && hintHex[0]===r && hintHex[1]===c) cls += ' hint-hex';
      g.setAttribute('class', cls);

      const poly = document.createElementNS('http://www.w3.org/2000/svg','polygon');
      poly.setAttribute('class','hex-bg');
      poly.setAttribute('points', hexPoints(hcx, hcy, R-1.5));
      poly.setAttribute('filter','url(#cs)');
      g.appendChild(poly);

      const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
      txt.setAttribute('x', hcx);
      txt.setAttribute('y', hcy + 2);
      txt.setAttribute('class', 'hex-coord');
      txt.textContent = `${r},${c}`;
      g.appendChild(txt);

      if (board[r][c]===EMPTY && !gameOver) {
        g.addEventListener('click',    () => playerMove(r, c));
        g.addEventListener('touchend', (e) => { e.preventDefault(); playerMove(r,c); });
        g.addEventListener('mouseenter', () => {
          if (currentTurn===pp || gameMode==='2p') setStatus(`Hex (${r},${c}) — tap to place`);
        });
      }
      svg.appendChild(g);
    }
  }
}

function hexPoints(cx, cy, r) {
  return Array.from({length:6}, (_,i) => {
    const a = Math.PI/180*(60*i - 30);
    return `${(cx+r*Math.cos(a)).toFixed(2)},${(cy+r*Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

// ─── MOVE HISTORY ───────────────────────────────────────────────────
function renderMoveHistory() {
  const el   = document.getElementById('move-list');
  const pp   = getPlayerPiece();
  const is2P = gameMode === '2p';
  if (!moveHistory.length) { el.innerHTML='<div class="empty-msg">No moves yet.</div>'; return; }
  el.innerHTML = moveHistory.slice().reverse().map(m => {
    const isTeal = m.who === PIECE1;
    const label = is2P
      ? (isTeal ? 'Player 1' : 'Player 2')
      : (m.who === pp ? 'You' : 'AI');
    const color = isTeal ? 'var(--teal)' : 'var(--gold)';
    return `<div class="move-entry">
      <span class="move-num">${m.move}</span>
      <span class="move-who" style="background:${color}"></span>
      <span class="move-coord" style="color:${color}">(${m.r},${m.c})</span>
      <span class="move-type">${label}</span>
    </div>`;
  }).join('');
}

// ─── TURN UI ────────────────────────────────────────────────────────
function updateTurnUI() {
  const is2P     = gameMode === '2p';
  const pp       = getPlayerPiece();
  const isMyTurn = currentTurn === pp;
  const isTeal   = currentTurn === PIECE1;

  const banner = document.getElementById('turn-banner');
  const bannerT= document.getElementById('turn-banner-text');
  const colorEmoji = isTeal ? '🟦' : '🟨';

  banner.className   = 'turn-banner ' + (isTeal ? 'teal-turn' : 'gold-turn');
  bannerT.textContent = is2P
    ? (isTeal ? `${colorEmoji} Player 1 — Tap your hex` : `${colorEmoji} Player 2 — Tap your hex`)
    : (isMyTurn ? `${colorEmoji} Your Turn — Tap a hex`  : `${colorEmoji} AI is thinking…`);

  // Turn inside brain card (Fix #4)
  const dot  = document.getElementById('turn-inline-dot');
  const text = document.getElementById('turn-inline-text');
  if (dot && text) {
    dot.className   = 'turn-inline-dot ' + (isTeal ? 'teal' : 'gold');
    text.textContent = is2P
      ? (isTeal ? 'Player 1 Turn' : 'Player 2 Turn')
      : (isMyTurn ? 'Your Turn'    : 'AI Thinking…');
  }

  document.getElementById('status-dot').className = isTeal ? 'status-dot' : 'status-dot ai-dot';
  setStatus(isMyTurn || is2P
    ? 'Tap any empty hex to place your piece'
    : 'AI is calculating the best move…'
  );
}

// ─── EDGE LABELS & LEGEND ───────────────────────────────────────────
function updateEdgeLabels() {
  const pp   = getPlayerPiece();
  const is2P = gameMode === '2p';
  const tealName = is2P ? 'Player 1' : (pp===PIECE1 ? 'You' : 'AI');
  const goldName = is2P ? 'Player 2' : (pp===PIECE2 ? 'You' : 'AI');

  document.getElementById('top-label').textContent    = `⬡ ${goldName} (Gold) — Top → Bottom`;
  document.getElementById('bottom-label').textContent = `⬡ ${goldName} (Gold) — Top → Bottom`;
  document.getElementById('left-label').textContent   = `⬡ ${tealName} (Teal) — Left → Right`;
  document.getElementById('right-label').textContent  = `⬡ ${tealName} (Teal) — Left → Right`;
}

function updateLegend() {
  const pp   = getPlayerPiece();
  const is2P = gameMode === '2p';
  const tealL = is2P ? 'Player 1 (Teal)' : (pp===PIECE1 ? 'You (Teal)' : 'AI (Teal)');
  const goldL = is2P ? 'Player 2 (Gold)' : (pp===PIECE2 ? 'You (Gold)' : 'AI (Gold)');
  document.getElementById('leg-p1').textContent = `${tealL} — Left → Right`;
  document.getElementById('leg-p2').textContent = `${goldL} — Top → Bottom`;
}

function checkCompStatus() {
  const btn = document.getElementById('btn-run-comp');
  const msg = document.getElementById('comp-status-msg');
  if (!btn || !msg) return;
  if (moveHistory.length > 0) {
    btn.disabled = false; btn.style.opacity = '1';
    msg.textContent = '(Comparing active board state)';
  } else {
    btn.disabled = true; btn.style.opacity = '0.6';
    msg.textContent = '(Requires active board state to compare)';
  }
}

let compDepth = 2;
function setCompDepth(d) {
  compDepth = d;
  document.querySelectorAll('#comp-depth-group .size-btn').forEach(btn => 
    btn.classList.toggle('active', parseInt(btn.dataset.cdepth) === d)
  );
}

// ─── FIX #2: Unified collapsible toggle ─────────────────────────────
function toggleSection(bodyId, arrowId) {
  const body  = document.getElementById(bodyId);
  const arrow = document.getElementById(arrowId);
  if (!body || !arrow) return;
  const open = body.classList.toggle('open');
  arrow.classList.toggle('open', open);
}

// ─── FIX #4: Brain panel ────────────────────────────────────────────
function updateBrainPanel() {
  const s   = evaluate();
  const stx = s > 0 ? `+${s} (AI ahead)` : s < 0 ? `${s} (You ahead)` : '0 (Even)';

  document.getElementById('t-depth').textContent  = DIFF_DEPTH[diff];
  document.getElementById('t-nodes').textContent  = nodesCount.toLocaleString();
  document.getElementById('t-pruned').textContent = prunedCount.toLocaleString();
  document.getElementById('t-score').textContent  = stx;
  document.getElementById('t-best').textContent   = lastAIMove ? `Row ${lastAIMove.r}, Col ${lastAIMove.c}` : '—';
  
  const elTime = document.getElementById('t-time');
  if (elTime) elTime.textContent = lastAITime.toFixed(1) + ' ms';

  const hm = document.getElementById('h-move');
  const hn = document.getElementById('h-nodes');
  const hd = document.getElementById('h-depth');
  if (hm) hm.textContent = moveHistory.length;
  if (hn) hn.textContent = totalNodes.toLocaleString();
  if (hd) hd.textContent = DIFF_DEPTH[diff];

  document.getElementById('depth-fill').style.width = (DIFF_DEPTH[diff]/3*100) + '%';
}

function resetBrainPanel() {
  ['t-nodes','t-pruned','t-depth','t-score','t-best','t-time','h-move','h-nodes','h-depth']
    .forEach(id => { const el=document.getElementById(id); if(el) el.textContent='—'; });
  document.getElementById('depth-fill').style.width = '0%';
  document.getElementById('think-badge').classList.remove('show');
  const dot  = document.getElementById('turn-inline-dot');
  const text = document.getElementById('turn-inline-text');
  if (dot)  dot.className   = 'turn-inline-dot';
  if (text) text.textContent = '—';
}

// ─── AI HINT & REVIEW ───────────────────────────────────────────────
function showHint() {
  if (gameOver || gameMode !== 'ai') return;
  
  const oldSide = playerSide;
  const wasPlayerTurn = currentTurn === getPlayerPiece();
  // if it's the player's turn, temporarily switch context so AI finds move FOR player
  if (wasPlayerTurn) playerSide = (oldSide === 'LR') ? 'TB' : 'LR';
  
  const move = getBestMove();
  playerSide = oldSide; // restore
  
  if (move) {
    hintHex = move;
    renderBoard();
  }
}

function runReview() {
  const panel = document.getElementById('review-content');
  if (!panel || gameOver) return;
  
  const score = evaluate();
  const playerWinDist = dijkstraCost(getPlayerPiece());
  const aiWinDist     = dijkstraCost(getAIPiece());

  let evalStatus = '';
  if (playerWinDist === 0) evalStatus = 'You have connected the edges!';
  else if (aiWinDist === 0) evalStatus = 'Opponent has connected the edges!';
  else if (playerWinDist === 1) evalStatus = '🔥 Threat: You are 1 step away from winning!';
  else if (aiWinDist === 1) evalStatus = '⚠️ Critical Threat: Opponent is 1 step from winning!';
  else if (score > 2) evalStatus = `Opponent is forming a strong path (Adv: +${score})`;
  else if (score < -2) evalStatus = `You are forming a strong path (Adv: +${-score})`;
  else evalStatus = 'Board paths are relatively balanced';

  const oldSide = playerSide;
  const wasPlayerTurn = currentTurn === getPlayerPiece();
  if (wasPlayerTurn && gameMode === 'ai') playerSide = (oldSide === 'LR') ? 'TB' : 'LR';
  
  const aiPiece = getAIPiece();
  const empties = [];
  for (let r=0; r<N; r++) for (let c=0; c<N; c++) if (board[r][c] === EMPTY) empties.push([r,c]);

  let moves = [];
  for (const [r,c] of empties) {
    board[r][c] = aiPiece; merge(aiPiece, r, c);
    moves.push({r, c, val: evaluate()});
    board[r][c] = EMPTY; initUF();
  }
  
  playerSide = oldSide;
  const aiIsMax = aiPiece === PIECE2;
  moves.sort((a,b) => aiIsMax ? b.val - a.val : a.val - b.val);
  const best = moves.slice(0, 3);
  
  // Highlight best move on standard board using hint class optionally
  if (best.length && wasPlayerTurn) { hintHex = [best[0].r, best[0].c]; renderBoard(); }

  let html = `<div class="review-row">
    <div class="instr-card" style="\${(playerWinDist===1||aiWinDist===1) ? 'border-color:var(--red);background:rgba(232,64,64,0.04);' : ''}">
      <div class="instr-icon">📈</div>
      <div class="instr-heading">Live Assessment</div>
      <div class="instr-text" style="color:var(--text);font-weight:600;">${evalStatus}</div>
      <div style="font-size:0.75rem;color:var(--muted);margin-top:6px;">Distance to Win: You (${playerWinDist}) vs Opponent (${aiWinDist})</div>
    </div>`;
    
  if (best.length) {
    const isDefense = aiWinDist === 1 && (score > 100 || score < -100);
    const reason = isDefense ? 'Critical block needed immediately!' : (wasPlayerTurn ? 'Strengthens your connection.' : 'Reduces opponent path advantage.');
    html += `
      <div class="instr-card" style="border-color:var(--teal)">
        <div class="instr-icon">💡</div>
        <div class="instr-heading">Top Suggested Move</div>
        <div class="instr-text">Row ${best[0].r}, Col ${best[0].c}</div>
        <div style="font-size:0.75rem;color:var(--muted);margin-top:4px;">Reason: ${reason}</div>
      </div>
      <div class="instr-card">
        <div class="instr-icon">🔄</div>
        <div class="instr-heading">Alternative Moves</div>
        <div class="instr-text" style="font-size:0.8rem">
          ` + (best[1] ? `• Row ${best[1].r}, Col ${best[1].c} <span style="opacity:0.6">(eval: ${best[1].val})</span><br>` : '') + `
          ` + (best[2] ? `• Row ${best[2].r}, Col ${best[2].c} <span style="opacity:0.6">(eval: ${best[2].val})</span>` : '') + `
        </div>
      </div>
    `;
  } else {
    html += `<div class="instr-card"><div class="instr-text">No empty cells remaining.</div></div>`;
  }
  
  html += `</div>`;
  panel.innerHTML = html;
}

function runCompHelper(algo, depth) {
  let nc = 0, pc = 0;
  const started = performance.now();
  let bestVal = -Infinity; let bestMove = null;
  const aiPiece = PIECE2; const isMax = true;
  
  const empties = [];
  for (let r=0; r<N; r++) for(let c=0; c<N; c++) empties.push([r,c]);
  
  let useEmpties = empties;
  if (algo !== 'abonly') {
    const cr = Math.floor(N/2), cm = Math.floor(N/2);
    useEmpties = [...empties].sort((a,b) => (Math.abs(a[0]-cr)+Math.abs(a[1]-cm)) - (Math.abs(b[0]-cr)+Math.abs(b[1]-cm)));
  }
  
  function tempMinimax(d, mx, alpha, beta) {
    nc++;
    if (d === 0) return evaluate();
    let val = mx ? -Infinity : Infinity;
    for (const [r,c] of useEmpties) {
      if (board[r][c] !== EMPTY) continue;
      board[r][c] = mx ? PIECE2 : PIECE1; merge(board[r][c], r, c);
      const v = tempMinimax(d-1, !mx, alpha, beta);
      board[r][c] = EMPTY; initUF();
      if (mx) {
        if (v > val) val = v;
        if (v > alpha) alpha = v;
        if ((algo === 'alphabeta' || algo === 'abonly') && beta <= alpha) { pc++; break; }
      } else {
        if (v < val) val = v;
        if (v < beta) beta = v;
        if ((algo === 'alphabeta' || algo === 'abonly') && beta <= alpha) { pc++; break; }
      }
    }
    return Math.abs(val)===Infinity ? evaluate() : val;
  }
  
  for (const [r,c] of useEmpties) {
      board[r][c] = aiPiece; merge(aiPiece, r, c);
      let val;
      if (algo === 'dijkstra') {
         val = evaluate(); nc++;
      } else {
         val = tempMinimax(depth-1, false, -Infinity, Infinity);
      }
      board[r][c] = EMPTY; initUF();
      if (val > bestVal) { bestVal = val; bestMove = [r,c]; }
  }
  return { nc, pc, time: performance.now() - started, bestVal, bestMove };
}

function runComparison() {
  if (moveHistory.length === 0) return; // Prevent run on flat board if rules dictate
  
  const cDepth = compDepth;
  
  // Backup state
  const oldBoard = board.map(row => [...row]);
  
  const res = {
    mm: runCompHelper('minimax', cDepth),
    ab: runCompHelper('abonly', cDepth),
    mix: runCompHelper('alphabeta', cDepth),
    dj: runCompHelper('dijkstra', cDepth)
  };
  
  // Restore globals
  board = oldBoard; initUF();
  
  const tbody = document.getElementById('comp-tbody');
  
  const tr = (label, km, k) => {
    const vals = [res.mm[km], res.ab[km], res.mix[km], res.dj[km]];
    // subtle highlight for best in row
    const isMin = km === 'time' || km === 'nc';
    const isMax = km === 'pc';
    let bestIdx = -1;
    if (isMin || isMax) {
      let bVal = isMin ? Infinity : -1;
      vals.forEach((v,i) => { if (isMin && v < bVal) { bVal = v; bestIdx = i; } else if (isMax && v > bVal) { bVal = v; bestIdx = i;} });
    }
    const fmt = v => typeof v === 'number' && km==='time' ? v.toFixed(1)+' ms' : (typeof v === 'number' && typeof v !== 'string' && km!=='bestVal' ? v.toLocaleString() : v);
    return "<tr>" +
      "<td>" + label + "</td>" +
      "<td class='" + (bestIdx===0?"highlight col-mm":"") + " " + (km==="bestMove"||km==="bestVal"?"col-mm":"") + "'>" + fmt(vals[0]) + "</td>" +
      "<td class='" + (bestIdx===1?"highlight col-ab":"") + " " + (km==="bestMove"||km==="bestVal"?"col-ab":"") + "'>" + fmt(vals[1]) + "</td>" +
      "<td class='" + (bestIdx===2?"highlight col-mix":"") + " " + (km==="bestMove"||km==="bestVal"?"col-mix":"") + "'>" + fmt(vals[2]) + "</td>" +
      "<td class='" + (bestIdx===3?"highlight col-dj":"") + " " + (km==="bestMove"||km==="bestVal"?"col-dj":"") + "'>" + fmt(vals[3]) + "</td>" +
    "</tr>";
  };
  
  res.mm.bm = res.mm.bestMove ? "(" + res.mm.bestMove[0] + "," + res.mm.bestMove[1] + ")" : "—";
  res.ab.bm = res.ab.bestMove ? "(" + res.ab.bestMove[0] + "," + res.ab.bestMove[1] + ")" : "—";
  res.mix.bm = res.mix.bestMove ? "(" + res.mix.bestMove[0] + "," + res.mix.bestMove[1] + ")" : "—";
  res.dj.bm = res.dj.bestMove ? "(" + res.dj.bestMove[0] + "," + res.dj.bestMove[1] + ")" : "—";
  
  tbody.innerHTML = 
    tr("Nodes Explored", "nc") +
    tr("Execution Time", "time") +
    "<tr><td>Depth Reached</td><td>" + cDepth + "</td><td>" + cDepth + "</td><td>" + cDepth + "</td><td>1 (Eval)</td></tr>" +
    tr("Branches Pruned", "pc") +
    tr("Board Score", "bestVal") +
    tr("Best Move", "bm");
    
  const saved = res.mm.nc ? ((res.mm.nc - res.mix.nc) / res.mm.nc * 100).toFixed(1) : 0;
  document.getElementById("comp-summary").innerHTML = "Minimax + α-β optimized <strong>" + saved + "%</strong> nodes explored compared to standard Minimax.";
}

// ─── HELPERS ────────────────────────────────────────────────────────
function setStatus(msg) { const el=document.getElementById('status-msg'); if(el) el.textContent=msg; }

function setSize(n) {
  N = n;
  document.querySelectorAll('.size-btn[data-size]').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.size)===n)
  );
  newGame();
}

function setDiff(d) {
  diff = d;
  document.querySelectorAll('.size-btn[data-diff]').forEach(b =>
    b.classList.toggle('active', b.dataset.diff===d)
  );
  const el = document.getElementById('t-depth');
  if (el) el.textContent = DIFF_DEPTH[d];
}

// ─── BOOT ───────────────────────────────────────────────────────────
newGame();