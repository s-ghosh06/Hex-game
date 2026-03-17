// ═══════════════════════════════════════════════════════════════════
//  HEX STRATEGY — script.js
//
//  Modes: vs AI  → Player (Teal) vs Minimax AI (Gold)
//         2P     → Player 1 (Teal) vs Player 2 (Gold), no AI
//
//  Algorithms:
//    1. Minimax Search        — Shannon (1950), Philosophical Magazine
//    2. Alpha-Beta Pruning    — Knuth & Moore (1975), AI Journal
//    3. Union-Find (win check)— Tarjan (1975), Journal of the ACM
//    4. Dijkstra heuristic    — Board evaluation / path cost
// ═══════════════════════════════════════════════════════════════════

// ─── CONSTANTS ──────────────────────────────────────────────────────
const EMPTY  = 0;
const PLAYER = 1;   // Teal  — Left → Right
const AI     = 2;   // Gold  — Top  → Bottom

const DIFF_DEPTH = { easy: 1, medium: 2, hard: 3 };

// 6 neighbours on a pointy-top offset hex grid
const HEX_DIRS = [[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0]];

// ─── GAME STATE ─────────────────────────────────────────────────────
let N           = 7;
let board       = [];
let currentTurn = PLAYER;
let gameOver    = false;
let diff        = 'easy';
let gameMode    = 'ai';    // 'ai' | '2p'
let moveHistory = [];
let totalNodes  = 0;
let totalPruned = 0;
let lastAIMove  = null;

// ─── UNION-FIND ──────────────────────────────────────────────────────
// O(α(n)) ≈ O(1) win detection via Disjoint Set Union.
// Virtual nodes: [N*N] = source edge, [N*N+1] = target edge
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

let ufPlayer, ufAI;
const P_LEFT  = () => N*N;
const P_RIGHT = () => N*N+1;
const A_TOP   = () => N*N;
const A_BOT   = () => N*N+1;

function idx(r, c) { return r*N + c; }

// Rebuild Union-Find from scratch (needed after undo / minimax rollback)
function initUF() {
  ufPlayer = new UnionFind(N*N+2);
  ufAI     = new UnionFind(N*N+2);
  for (let r=0; r<N; r++)
    for (let c=0; c<N; c++) {
      if (board[r][c] === PLAYER) mergePlayer(r, c);
      if (board[r][c] === AI)     mergeAI(r, c);
    }
}

function mergePlayer(r, c) {
  if (c === 0)     ufPlayer.union(idx(r,c), P_LEFT());
  if (c === N-1)   ufPlayer.union(idx(r,c), P_RIGHT());
  for (const [nr,nc] of neighbors(r,c))
    if (board[nr][nc] === PLAYER) ufPlayer.union(idx(r,c), idx(nr,nc));
}

function mergeAI(r, c) {
  if (r === 0)     ufAI.union(idx(r,c), A_TOP());
  if (r === N-1)   ufAI.union(idx(r,c), A_BOT());
  for (const [nr,nc] of neighbors(r,c))
    if (board[nr][nc] === AI) ufAI.union(idx(r,c), idx(nr,nc));
}

function checkWin(who) {
  if (who === PLAYER) return ufPlayer.connected(P_LEFT(), P_RIGHT());
  return ufAI.connected(A_TOP(), A_BOT());
}

// ─── HEX NEIGHBORS ──────────────────────────────────────────────────
function neighbors(r, c) {
  return HEX_DIRS
    .map(([dr,dc]) => [r+dr, c+dc])
    .filter(([nr,nc]) => nr>=0 && nr<N && nc>=0 && nc<N);
}

// ─── BOARD EVALUATION — Dijkstra shortest path cost ─────────────────
// Cost to cross board for each player.
// Friendly cell = 0, empty = 1, enemy = Infinity.
function dijkstraCost(who) {
  const INF   = 1e9;
  const dist2 = Array.from({length:N}, () => new Array(N).fill(INF));
  const pq    = [];

  if (who === PLAYER) {
    for (let r=0; r<N; r++) {
      const cost = board[r][0]===AI ? INF : board[r][0]===PLAYER ? 0 : 1;
      if (cost < INF) { dist2[r][0] = cost; pq.push([cost,r,0]); }
    }
  } else {
    for (let c=0; c<N; c++) {
      const cost = board[0][c]===PLAYER ? INF : board[0][c]===AI ? 0 : 1;
      if (cost < INF) { dist2[0][c] = cost; pq.push([cost,0,c]); }
    }
  }

  pq.sort((a,b) => a[0]-b[0]);
  while (pq.length) {
    const [d,r,c] = pq.shift();
    if (d > dist2[r][c]) continue;
    for (const [nr,nc] of neighbors(r,c)) {
      const enemy = who===PLAYER ? AI : PLAYER;
      const nc2   = board[nr][nc]===enemy ? INF : board[nr][nc]===who ? 0 : 1;
      if (nc2 === INF) continue;
      const nd = d + nc2;
      if (nd < dist2[nr][nc]) {
        dist2[nr][nc] = nd;
        pq.push([nd,nr,nc]);
        pq.sort((a,b) => a[0]-b[0]);
      }
    }
  }

  let best = INF;
  if (who===PLAYER) for (let r=0;r<N;r++) best = Math.min(best, dist2[r][N-1]);
  else              for (let c=0;c<N;c++) best = Math.min(best, dist2[N-1][c]);
  return best===INF ? 999 : best;
}

// Positive = AI advantage, Negative = Player advantage
function evaluate() {
  if (checkWin(AI))     return  10000;
  if (checkWin(PLAYER)) return -10000;
  return dijkstraCost(PLAYER) - dijkstraCost(AI);
}

// ─── MINIMAX + ALPHA-BETA PRUNING ───────────────────────────────────
// Reference: Knuth & Moore (1975) — Artificial Intelligence Journal
let nodesCount = 0, prunedCount = 0;

function minimax(depth, isMax, alpha, beta) {
  nodesCount++;
  if (checkWin(AI))     return  10000 + depth;
  if (checkWin(PLAYER)) return -10000 - depth;
  if (depth === 0)      return evaluate();

  const empties = [];
  for (let r=0; r<N; r++)
    for (let c=0; c<N; c++)
      if (board[r][c] === EMPTY) empties.push([r,c]);

  if (!empties.length) return evaluate();

  // Move ordering: centre cells first (better pruning)
  const cr = Math.floor(N/2), cc = Math.floor(N/2);
  empties.sort((a,b) =>
    (Math.abs(a[0]-cr)+Math.abs(a[1]-cc)) -
    (Math.abs(b[0]-cr)+Math.abs(b[1]-cc))
  );

  if (isMax) {
    let best = -Infinity;
    for (const [r,c] of empties) {
      board[r][c] = AI; mergeAI(r,c);
      const val = minimax(depth-1, false, alpha, beta);
      board[r][c] = EMPTY; initUF();
      best  = Math.max(best, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) { prunedCount++; break; }   // α-β cut
    }
    return best;
  } else {
    let best = Infinity;
    for (const [r,c] of empties) {
      board[r][c] = PLAYER; mergePlayer(r,c);
      const val = minimax(depth-1, true, alpha, beta);
      board[r][c] = EMPTY; initUF();
      best = Math.min(best, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) { prunedCount++; break; }   // α-β cut
    }
    return best;
  }
}

function getBestMove() {
  nodesCount = 0; prunedCount = 0;
  const depth = DIFF_DEPTH[diff];
  let bestVal = -Infinity, bestMove = null;

  const empties = [];
  for (let r=0; r<N; r++)
    for (let c=0; c<N; c++)
      if (board[r][c] === EMPTY) empties.push([r,c]);

  const cr = Math.floor(N/2), cc = Math.floor(N/2);
  empties.sort((a,b) =>
    (Math.abs(a[0]-cr)+Math.abs(a[1]-cc)) -
    (Math.abs(b[0]-cr)+Math.abs(b[1]-cc))
  );

  // Easy: random from top candidates
  if (diff === 'easy') {
    const top = empties.slice(0, Math.min(6, empties.length));
    nodesCount = 1;
    return top[Math.floor(Math.random()*top.length)];
  }

  for (const [r,c] of empties) {
    board[r][c] = AI; mergeAI(r,c);
    const val = minimax(depth-1, false, -Infinity, Infinity);
    board[r][c] = EMPTY; initUF();
    if (val > bestVal) { bestVal = val; bestMove = [r,c]; }
  }
  return bestMove;
}

// ═══════════════════════════════════════════════════════════════════
//  GAME CONTROL
// ═══════════════════════════════════════════════════════════════════

function newGame() {
  board       = Array.from({length:N}, () => new Array(N).fill(EMPTY));
  currentTurn = PLAYER;
  gameOver    = false;
  moveHistory = [];
  totalNodes  = 0;
  totalPruned = 0;
  lastAIMove  = null;

  initUF();
  renderBoard();
  renderMoveHistory();
  updateEdgeLabels();
  updateLegend();
  resetBrainPanel();
  updateTurnUI();
}

// ─── MODE SWITCH ────────────────────────────────────────────────────
function setMode(m) {
  gameMode = m;
  document.getElementById('mode-ai').classList.toggle('active', m==='ai');
  document.getElementById('mode-2p').classList.toggle('active', m==='2p');

  // Show/hide AI difficulty buttons
  const dg = document.getElementById('diff-group');
  if (m === '2p') dg.classList.add('hidden');
  else            dg.classList.remove('hidden');

  // Show/hide AI brain card
  const brain = document.getElementById('ai-brain-card');
  const algo  = document.getElementById('algo-card');
  if (m === '2p') { brain.classList.add('hidden'); algo.classList.add('hidden'); }
  else            { brain.classList.remove('hidden'); algo.classList.remove('hidden'); }

  newGame();
}

// ─── PLAYER MOVE ────────────────────────────────────────────────────
function playerMove(r, c) {
  if (gameOver) return;
  if (gameMode === 'ai' && currentTurn !== PLAYER) return;
  if (board[r][c] !== EMPTY) return;

  const who = currentTurn;
  board[r][c] = who;
  who === PLAYER ? mergePlayer(r,c) : mergeAI(r,c);
  moveHistory.push({who, r, c, move: moveHistory.length+1});

  renderBoard();
  renderMoveHistory();

  if (checkWin(who)) { endGame(who); return; }

  // Switch turns
  currentTurn = (currentTurn === PLAYER) ? AI : PLAYER;
  updateTurnUI();

  // If vs AI and it's now AI's turn — trigger AI
  if (gameMode === 'ai' && currentTurn === AI) {
    document.getElementById('think-badge').classList.add('show');
    setTimeout(doAIMove, 130);
  }
}

// ─── AI MOVE ────────────────────────────────────────────────────────
function doAIMove() {
  if (gameOver) return;
  const move = getBestMove();
  if (!move) { endGame(null); return; }

  const [r,c] = move;
  board[r][c]  = AI;
  mergeAI(r,c);
  lastAIMove   = {r,c};

  totalNodes  += nodesCount;
  totalPruned += prunedCount;
  moveHistory.push({who: AI, r, c, move: moveHistory.length+1});

  updateBrainPanel();
  document.getElementById('think-badge').classList.remove('show');

  renderBoard();
  renderMoveHistory();

  if (checkWin(AI)) { endGame(AI); return; }

  currentTurn = PLAYER;
  updateTurnUI();
}

// ─── UNDO ───────────────────────────────────────────────────────────
function undoMove() {
  if (gameOver || moveHistory.length < 1) return;

  // In vs AI: remove last 2 (AI + player). In 2P: remove last 1
  const toRemove = gameMode === 'ai' ? 2 : 1;
  for (let i=0; i<toRemove && moveHistory.length>0; i++) {
    const m = moveHistory.pop();
    board[m.r][m.c] = EMPTY;
  }

  initUF();
  currentTurn = PLAYER;
  gameOver    = false;

  renderBoard();
  renderMoveHistory();
  updateTurnUI();
  setStatus('Move undone — continue playing');
}

// ─── WIN PATH (BFS) ─────────────────────────────────────────────────
function findWinPath(who) {
  const visited = new Set(), parent = {}, queue = [];

  if (who === PLAYER) {
    for (let r=0; r<N; r++)
      if (board[r][0]===PLAYER) { queue.push([r,0]); visited.add(`${r},0`); }
  } else {
    for (let c=0; c<N; c++)
      if (board[0][c]===AI)    { queue.push([0,c]); visited.add(`0,${c}`); }
  }

  while (queue.length) {
    const [r,c] = queue.shift();
    const done  = who===PLAYER ? c===N-1 : r===N-1;
    if (done) {
      const path = [`${r},${c}`]; let key = `${r},${c}`;
      while (parent[key]) { key=parent[key]; path.push(key); }
      return new Set(path);
    }
    for (const [nr,nc] of neighbors(r,c)) {
      const k = `${nr},${nc}`;
      if (!visited.has(k) && board[nr][nc]===who) {
        visited.add(k); parent[k]=`${r},${c}`; queue.push([nr,nc]);
      }
    }
  }
  return new Set();
}

// ─── END GAME ───────────────────────────────────────────────────────
function endGame(winner) {
  gameOver = true;
  const winPath = winner ? findWinPath(winner) : new Set();
  renderBoard(winPath);

  if (!winner) { setStatus('Draw — board is full'); return; }

  const isPlayer = winner === PLAYER;
  const is2P     = gameMode === '2p';

  document.getElementById('m-icon').textContent  = isPlayer ? '🏆' : (is2P ? '🏆' : '🤖');
  document.getElementById('m-title').textContent =
    is2P ? (isPlayer ? 'Player 1 Wins!' : 'Player 2 Wins!') :
           (isPlayer ? 'You Win!'       : 'AI Wins!');
  document.getElementById('m-sub').textContent =
    isPlayer
      ? 'Teal connected Left → Right. Brilliant move!'
      : (is2P ? 'Gold connected Top → Bottom. Well played!' : 'The AI connected Top → Bottom. Try again!');

  document.getElementById('ms-moves').textContent  = moveHistory.length;
  document.getElementById('ms-nodes').textContent  = is2P ? 'N/A' : totalNodes.toLocaleString();
  document.getElementById('ms-pruned').textContent = is2P ? 'N/A' : totalPruned.toLocaleString();
  document.getElementById('ms-diff').textContent   = is2P ? '2P'  : diff.toUpperCase();

  document.getElementById('ms-moves').style.color  = isPlayer ? 'var(--teal)' : 'var(--gold)';

  setTimeout(() => document.getElementById('overlay').classList.add('show'), 700);
}

function closeModal() {
  document.getElementById('overlay').classList.remove('show');
}

// ═══════════════════════════════════════════════════════════════════
//  SVG BOARD RENDER
// ═══════════════════════════════════════════════════════════════════
function renderBoard(winPath = new Set()) {
  const svg  = document.getElementById('board-svg');
  const R    = 24;
  const H    = R * Math.sqrt(3);
  const padX = 28, padY = 28;

  const svgW = padX*2 + N*(R*1.5) + R + 8;
  const svgH = padY*2 + N*H + H*0.5 + 8;

  svg.setAttribute('width',  Math.round(svgW));
  svg.setAttribute('height', Math.round(svgH));
  svg.innerHTML = '';

  // Drop shadow filter
  const defs   = document.createElementNS('http://www.w3.org/2000/svg','defs');
  const filter = document.createElementNS('http://www.w3.org/2000/svg','filter');
  filter.setAttribute('id','cs');
  filter.innerHTML = '<feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="rgba(27,43,75,0.15)"/>';
  defs.appendChild(filter);
  svg.appendChild(defs);

  for (let r=0; r<N; r++) {
    for (let c=0; c<N; c++) {
      // Parallelogram offset: col shifts right, row shifts down-right
      const hcx = padX + c*(R*1.5) + r*(R*0.75) + R;
      const hcy = padY + r*H + c*(H*0.5) + H/2;

      const g = document.createElementNS('http://www.w3.org/2000/svg','g');

      let cls = 'hex-cell';
      if (board[r][c]===PLAYER) cls += ' player taken';
      else if (board[r][c]===AI) cls += ' ai taken';
      if (lastAIMove && lastAIMove.r===r && lastAIMove.c===c) cls += ' last-move';
      if (winPath.has(`${r},${c}`)) cls += ' win-path';
      g.setAttribute('class', cls);

      const poly = document.createElementNS('http://www.w3.org/2000/svg','polygon');
      poly.setAttribute('class','hex-bg');
      poly.setAttribute('points', hexPoints(hcx, hcy, R-2));
      poly.setAttribute('filter','url(#cs)');
      g.appendChild(poly);

      if (board[r][c]===EMPTY && !gameOver) {
        g.addEventListener('click', () => playerMove(r, c));
        // Touch support
        g.addEventListener('touchend', (e) => { e.preventDefault(); playerMove(r,c); });
        g.addEventListener('mouseenter', () => {
          if (currentTurn===PLAYER || gameMode==='2p')
            setStatus(`Hex (${r},${c}) — tap to place`);
        });
      }

      svg.appendChild(g);
    }
  }
}

function hexPoints(cx, cy, r) {
  return Array.from({length:6}, (_,i) => {
    const a = Math.PI/180*(60*i);
    return `${cx + r*Math.cos(a)},${cy + r*Math.sin(a)}`;
  }).join(' ');
}

// ─── MOVE HISTORY ───────────────────────────────────────────────────
function renderMoveHistory() {
  const el = document.getElementById('move-list');
  if (!moveHistory.length) {
    el.innerHTML = '<div class="empty-msg">No moves yet.</div>';
    return;
  }
  const p1Label = gameMode==='2p' ? 'P1' : 'You';
  const p2Label = gameMode==='2p' ? 'P2' : 'AI';
  el.innerHTML = moveHistory.slice().reverse().map(m => `
    <div class="move-entry">
      <span class="move-num">${m.move}</span>
      <span class="move-who" style="background:${m.who===PLAYER?'var(--teal)':'var(--gold)'}"></span>
      <span class="move-coord" style="color:${m.who===PLAYER?'var(--teal)':'var(--gold)'}">(${m.r},${m.c})</span>
      <span class="move-type">${m.who===PLAYER ? p1Label : p2Label}</span>
    </div>`).join('');
}

// ─── TURN UI ────────────────────────────────────────────────────────
function updateTurnUI() {
  const is2P     = gameMode === '2p';
  const isTeal   = currentTurn === PLAYER;

  // Header badge
  const badge = document.getElementById('turn-badge');
  if (isTeal) {
    badge.textContent = is2P ? 'Player 1 Turn' : 'Your Turn';
    badge.className   = 'turn-badge turn-player';
  } else {
    badge.textContent = is2P ? 'Player 2 Turn' : 'AI Thinking';
    badge.className   = 'turn-badge turn-ai';
  }

  // Turn banner (big, mobile-friendly)
  const banner = document.getElementById('turn-banner');
  const dot    = document.getElementById('turn-banner-dot');
  const text   = document.getElementById('turn-banner-text');

  if (isTeal) {
    banner.className    = 'turn-banner teal-turn';
    text.textContent    = is2P ? '🟦 Player 1 — Tap your hex' : '🟦 Your Turn — Tap a hex';
  } else {
    banner.className    = 'turn-banner gold-turn';
    text.textContent    = is2P ? '🟨 Player 2 — Tap your hex' : '🟨 AI is thinking…';
  }

  // Status dot
  document.getElementById('status-dot').className =
    isTeal ? 'status-dot' : 'status-dot ai-dot';

  setStatus(isTeal
    ? (is2P ? 'Player 1 (Teal) — connect Left → Right' : 'Tap any hex to place your piece')
    : (is2P ? 'Player 2 (Gold) — connect Top → Bottom'  : 'AI is thinking…')
  );
}

// ─── EDGE LABELS ────────────────────────────────────────────────────
function updateEdgeLabels() {
  const is2P = gameMode === '2p';
  document.getElementById('top-label').textContent    = is2P ? '⬡ Player 2 — Gold (Top → Bottom)' : '⬡ AI — Gold (Top → Bottom)';
  document.getElementById('bottom-label').textContent = is2P ? '⬡ Player 2 — Gold (Top → Bottom)' : '⬡ AI — Gold (Top → Bottom)';
  document.getElementById('left-label').innerHTML     = is2P ? 'P1<br>Teal<br>←→' : 'You<br>←→';
  document.getElementById('right-label').innerHTML    = is2P ? 'P1<br>Teal<br>←→' : 'You<br>←→';
}

function updateLegend() {
  const is2P = gameMode === '2p';
  document.getElementById('leg-p1').textContent = is2P ? 'Player 1 (Teal) — Left → Right' : 'You (Teal) — Left → Right';
  document.getElementById('leg-p2').textContent = is2P ? 'Player 2 (Gold) — Top → Bottom'  : 'AI (Gold) — Top → Bottom';
}

// ─── BRAIN PANEL ────────────────────────────────────────────────────
function updateBrainPanel() {
  document.getElementById('t-depth').textContent   = DIFF_DEPTH[diff];
  document.getElementById('t-nodes').textContent   = nodesCount.toLocaleString();
  document.getElementById('t-pruned').textContent  = prunedCount.toLocaleString();
  document.getElementById('t-score').textContent   = evaluate();
  document.getElementById('t-best').textContent    = lastAIMove ? `(${lastAIMove.r},${lastAIMove.c})` : '—';
  document.getElementById('h-nodes').textContent   = totalNodes.toLocaleString();
  document.getElementById('h-depth').textContent   = DIFF_DEPTH[diff];
  document.getElementById('h-move').textContent    = moveHistory.length;
  document.getElementById('depth-fill').style.width = (DIFF_DEPTH[diff]/3*100)+'%';
}

function resetBrainPanel() {
  ['t-nodes','t-pruned','t-depth','t-score','t-best','h-move','h-nodes','h-depth']
    .forEach(id => document.getElementById(id).textContent = '—');
  document.getElementById('depth-fill').style.width = '0%';
  document.getElementById('think-badge').classList.remove('show');
}

// ─── INSTRUCTIONS TOGGLE ────────────────────────────────────────────
function toggleInstructions() {
  const body  = document.getElementById('instructions-body');
  const arrow = document.getElementById('instr-arrow');
  const btn   = document.getElementById('instr-toggle-btn');
  const open  = body.classList.toggle('open');
  arrow.classList.toggle('open', open);
  btn.querySelector('span:first-child').textContent =
    open ? '📖 How to Play' : '📖 How to Play — tap to expand';
}

// ─── HELPERS ────────────────────────────────────────────────────────
function setStatus(msg) {
  document.getElementById('status-msg').textContent = msg;
}

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
  document.getElementById('t-depth').textContent = DIFF_DEPTH[d];
}

// ─── BOOT ───────────────────────────────────────────────────────────
newGame();