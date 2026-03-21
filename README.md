# ⬡ Hex Nash Game — AI Strategy Board Game

> An interactive web-based strategy game powered by Minimax + Alpha-Beta Pruning AI, built as an academic project demonstrating intelligent decision-making in games.

---

## 📌 Table of Contents

- [About the Project](#about-the-project)
- [Live Demo](#live-demo)
- [Game Rules](#game-rules)
- [AI Algorithms Used](#ai-algorithms-used)
- [Features](#features)
- [Project Structure](#project-structure)
- [How to Run Locally](#how-to-run-locally)
- [How to Deploy](#how-to-deploy)
- [Screenshots](#screenshots)
- [References](#references)

---

## 📖 About the Project

**Hex Nash Game** is a browser-based implementation of the classic **Hex board game**, invented by mathematician **John Nash in 1942**. The game is played on a rhombus-shaped grid of hexagonal cells where two players compete to form an unbroken chain connecting their two assigned edges.

This project demonstrates **AI decision-making** through:
- **Minimax Search** — the AI evaluates all possible future game states
- **Alpha-Beta Pruning** — eliminates branches that cannot affect the outcome
- **Union-Find** — detects winning connections in near O(1) time
- **Dijkstra Heuristic** — evaluates how close each player is to winning

The game is fully playable in any browser — desktop or mobile — with no installation required.

---

## 🌐 Live Demo


```
https://hex-nash-game.vercel.app/
```


---

## 🎮 Game Rules

1. The board is a parallelogram-shaped grid of hexagonal cells (7×7, 9×9, or 11×11)
2. Two players take turns placing one piece per turn on any empty cell
3. **Teal** must connect the **Left edge → Right edge**
4. **Gold** must connect the **Top edge → Bottom edge**
5. The first player to form an unbroken chain connecting their two edges **wins**
6. **There are no draws** — this is mathematically proven (Nash, 1942)

### Side Selection (vs AI mode)
Before starting, you can choose your side:
- **Left → Right** — You play Teal, AI plays Gold
- **Top → Bottom** — You play Gold, AI plays Teal

---

## 🤖 AI Algorithms Used

### 1. Minimax Search
> Shannon, C. (1950). *Programming a computer for playing chess*. Philosophical Magazine.

The AI builds a complete game tree to a fixed depth `d`. At each level it alternates between:
- **MAX nodes** — AI's turn, picks the move with the highest score
- **MIN nodes** — Player's turn, picks the move with the lowest score

**Time Complexity:** `O(b^d)` where `b` = branching factor, `d` = search depth

---

### 2. Alpha-Beta Pruning
> Knuth, D. & Moore, R. (1975). *An analysis of alpha-beta pruning*. Artificial Intelligence Journal.

Optimises Minimax by eliminating branches that cannot affect the final decision:
- `alpha` = best score the MAX player is guaranteed
- `beta` = best score the MIN player is guaranteed
- When `beta ≤ alpha` → prune the branch (skip evaluating it)

**Result:** Reduces `O(b^d)` to `O(b^(d/2))` — AI can search **twice as deep** in the same time.

---

### 3. Union-Find (Win Detection)
> Tarjan, R. (1975). *Efficiency of a good but not linear set union algorithm*. Journal of the ACM.

Detects winning connections in **O(α(n)) ≈ O(1)** amortised time using a Disjoint Set structure. Two virtual "edge" nodes are created per player — a win is detected the moment they merge into the same connected component.

---

### 4. Dijkstra Heuristic (Board Evaluation)
> Dijkstra, E. (1959). *A note on two problems in connexion with graphs*. Numerische Mathematik.

Used as the evaluation function inside Minimax. Computes the minimum "cost" path each player needs to win:
- Friendly cell = cost 0
- Empty cell = cost 1
- Enemy cell = cost ∞ (blocked)

**Board Score** = `PlayerCost − AICost`  
Positive = AI is winning. Negative = Player is winning.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 vs AI Mode | Play against Minimax AI with 3 difficulty levels |
| 👥 2-Player Mode | Pass-and-play on one device |
| 🧠 AI Brain Panel | Live display of nodes evaluated, depth, pruned branches, board score |
| 🎯 Side Selection | Choose Left→Right or Top→Bottom before game starts |
| 📐 3 Board Sizes | 7×7 (easy), 9×9 (medium), 11×11 (hard) |
| ↩ Undo | Take back the last move(s) |
| 📱 Mobile Ready | Fully touch-optimised, works in any browser |
| 🏆 Win Detection | Winning path highlighted at end of game |
| 📖 Instructions | Built-in collapsible How to Play section |
| 🧮 Algo Reference | Collapsible Algorithms Used section with academic references |

---

## 📁 Project Structure

```
hex-game/
│
├── index.html       ← Game layout, UI structure, all sections
├── style.css        ← Gothic Cinzel font, responsive design, animations
└── script.js        ← Full game engine, AI logic, all algorithms
```

### index.html
Contains the full HTML structure including:
- Centered header with game title
- Game mode selector (vs AI / 2 Players)
- Side selection panel
- Collapsible How to Play and Algorithms sections
- Toolbar (board size, difficulty, New Game, Undo)
- Main game area with SVG hex board and side panel
- Win/lose overlay modal

### style.css
- Gothic aesthetic using **Cinzel Decorative** (titles), **Cinzel** (headings), **Crimson Text** (body), **DM Mono** (data)
- CSS variables for consistent theming
- Mobile-first responsive design with breakpoints at 960px and 640px
- Smooth animations for turn banners, win path glow, thinking spinner

### script.js
- `UnionFind` class — Disjoint Set Union for win detection
- `dijkstraCost()` — board evaluation using Dijkstra's algorithm
- `minimax()` — recursive Minimax with Alpha-Beta pruning
- `getBestMove()` — root-level move selection
- `renderBoard()` — SVG hex grid with correct parallelogram geometry
- `playerMove()` / `doAIMove()` — turn management
- `setPlayerSide()` — side selection logic (affects all win conditions)
- `toggleSection()` — collapsible panels

---

## 🚀 How to Run Locally

### Option 1 — VS Code + Live Server (recommended)

1. Install [VS Code](https://code.visualstudio.com/)
2. Install the **Live Server** extension (search in Extensions panel)
3. Open the `hex-game` folder in VS Code
4. Right-click `index.html` → **Open with Live Server**
5. Game opens in your browser at `http://127.0.0.1:5500`

### Option 2 — Direct open

1. Download all 3 files into one folder
2. Double-click `index.html`
3. It opens directly in your default browser

> ⚠️ All 3 files (`index.html`, `style.css`, `script.js`) must be in the **same folder**.

---

## 🌍 How to Deploy

### Netlify Drop (fastest — no account needed)

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag your entire `hex-game` folder onto the page
3. Netlify gives you a live public link instantly (e.g. `https://random-name.netlify.app`)
4. Share the link — anyone can play it on mobile or desktop, no install needed

### Custom URL (free Netlify account)

1. Create a free account at [netlify.com](https://netlify.com)
2. Deploy via drag-and-drop as above
3. Go to **Site Settings → Change site name**
4. Set a custom name like `hexnashgame.netlify.app`

---

## 📚 References

| Author | Year | Title | Journal |
|---|---|---|---|
| Nash, J. | 1942 | Hex board game invention | — |
| Shannon, C. | 1950 | Programming a computer for playing chess | Philosophical Magazine |
| Knuth, D. & Moore, R. | 1975 | An analysis of alpha-beta pruning | Artificial Intelligence Journal |
| Tarjan, R. | 1975 | Efficiency of a good but not linear set union algorithm | Journal of the ACM |
| Dijkstra, E. | 1959 | A note on two problems in connexion with graphs | Numerische Mathematik |

---

## 🏷️ Academic Info

- **Project Type:** Academic Web Project — Artificial Intelligence
- **Concepts Demonstrated:** Game Tree Search, Heuristic Evaluation, Graph Algorithms
- **Tech Stack:** HTML5, CSS3, Vanilla JavaScript, SVG
- **Deployment:** Netlify (static frontend, no backend required)

---

*Built with ❤️ as an academic project showcasing AI decision-making in interactive games.*