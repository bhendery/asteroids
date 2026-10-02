(function () {
  const PIECE_ICON = {
    k: '👽',
    q: '🛸',
    r: '🪐',
    b: '☄️',
    n: '👾',
    p: '🛰️',
  };
  const PIECE_NAME = {
    k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn',
  };

  const BOARD_SIZE = 480;
  const SQUARE = BOARD_SIZE / 8;
  let canvas, ctx, boardX, boardY;
  let board, turn, selected, legalForSelected, gameOver, lastMove;
  let running = false;
  let starField = [];

  function initStarField() {
    starField = [];
    for (let i = 0; i < 120; i++) {
      starField.push({
        x: Math.random() * 800,
        y: Math.random() * 600,
        r: Math.random() * 1.4 + 0.2,
        a: Math.random() * 0.6 + 0.2,
      });
    }
  }

  function newBoard() {
    const back = ['r','n','b','q','k','b','n','r'];
    const b = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let c = 0; c < 8; c++) {
      b[0][c] = { type: back[c], color: 'b' };
      b[1][c] = { type: 'p', color: 'b' };
      b[6][c] = { type: 'p', color: 'w' };
      b[7][c] = { type: back[c], color: 'w' };
    }
    return b;
  }

  function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

  function findKing(b, color) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (p && p.type === 'k' && p.color === color) return { r, c };
      }
    return null;
  }

  function pseudoMoves(b, r, c) {
    const p = b[r][c];
    if (!p) return [];
    const moves = [];
    const dir = p.color === 'w' ? -1 : 1;
    const add = (nr, nc) => {
      if (!inBounds(nr, nc)) return false;
      const t = b[nr][nc];
      if (!t) { moves.push({ r: nr, c: nc }); return true; }
      if (t.color !== p.color) moves.push({ r: nr, c: nc, capture: true });
      return false;
    };
    if (p.type === 'p') {
      if (inBounds(r + dir, c) && !b[r + dir][c]) {
        moves.push({ r: r + dir, c });
        const startRow = p.color === 'w' ? 6 : 1;
        if (r === startRow && !b[r + 2 * dir][c]) {
          moves.push({ r: r + 2 * dir, c });
        }
      }
      for (const dc of [-1, 1]) {
        const nr = r + dir, nc = c + dc;
        if (inBounds(nr, nc) && b[nr][nc] && b[nr][nc].color !== p.color) {
          moves.push({ r: nr, c: nc, capture: true });
        }
      }
    } else if (p.type === 'n') {
      const deltas = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for (const [dr, dc] of deltas) add(r + dr, c + dc);
    } else if (p.type === 'k') {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (dr || dc) add(r + dr, c + dc);
    } else {
      const dirs = [];
      if (p.type === 'r' || p.type === 'q') dirs.push([-1,0],[1,0],[0,-1],[0,1]);
      if (p.type === 'b' || p.type === 'q') dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
      for (const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        while (inBounds(nr, nc)) {
          if (!add(nr, nc)) break;
          nr += dr; nc += dc;
        }
      }
    }
    return moves;
  }

  function isSquareAttacked(b, r, c, byColor) {
    for (let rr = 0; rr < 8; rr++) {
      for (let cc = 0; cc < 8; cc++) {
        const p = b[rr][cc];
        if (!p || p.color !== byColor) continue;
        if (p.type === 'p') {
          const dir = p.color === 'w' ? -1 : 1;
          if (rr + dir === r && (cc - 1 === c || cc + 1 === c)) return true;
        } else {
          const moves = pseudoMoves(b, rr, cc);
          for (const m of moves) if (m.r === r && m.c === c) return true;
        }
      }
    }
    return false;
  }

  function inCheck(b, color) {
    const k = findKing(b, color);
    if (!k) return false;
    return isSquareAttacked(b, k.r, k.c, color === 'w' ? 'b' : 'w');
  }

  function applyMove(b, fr, fc, tr, tc) {
    const nb = b.map((row) => row.slice());
    const piece = nb[fr][fc];
    nb[tr][tc] = piece;
    nb[fr][fc] = null;
    if (piece.type === 'p' && (tr === 0 || tr === 7)) {
      nb[tr][tc] = { type: 'q', color: piece.color };
    }
    return nb;
  }

  function legalMoves(b, r, c) {
    const p = b[r][c];
    if (!p) return [];
    const result = [];
    for (const m of pseudoMoves(b, r, c)) {
      const nb = applyMove(b, r, c, m.r, m.c);
      if (!inCheck(nb, p.color)) result.push(m);
    }
    return result;
  }

  function anyLegalMoves(b, color) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (p && p.color === color) {
          if (legalMoves(b, r, c).length > 0) return true;
        }
      }
    return false;
  }

  function setStatus(text) {
    const el = document.getElementById('chessStatus');
    if (el) el.textContent = text;
  }

  function updateStatus() {
    if (gameOver) return;
    const colorName = turn === 'w' ? 'WHITE' : 'BLACK';
    const check = inCheck(board, turn) ? ' — CHECK!' : '';
    setStatus(`${colorName} TO MOVE${check}`);
  }

  function endGame(title, msg) {
    gameOver = true;
    document.getElementById('chessOverTitle').textContent = title;
    document.getElementById('chessOverMsg').textContent = msg;
    document.getElementById('chessOverScreen').classList.remove('hidden');
  }

  function checkGameEnd() {
    const hasMoves = anyLegalMoves(board, turn);
    if (!hasMoves) {
      if (inCheck(board, turn)) {
        const winner = turn === 'w' ? 'Black' : 'White';
        endGame('CHECKMATE', `${winner} wins!`);
      } else {
        endGame('STALEMATE', 'Draw — no legal moves.');
      }
    }
  }

  function onClick(e) {
    if (!running || gameOver) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    if (x < boardX || x >= boardX + BOARD_SIZE || y < boardY || y >= boardY + BOARD_SIZE) return;
    const c = Math.floor((x - boardX) / SQUARE);
    const r = Math.floor((y - boardY) / SQUARE);
    if (selected) {
      const match = legalForSelected.find((m) => m.r === r && m.c === c);
      if (match) {
        board = applyMove(board, selected.r, selected.c, r, c);
        lastMove = { from: { r: selected.r, c: selected.c }, to: { r, c } };
        selected = null;
        legalForSelected = [];
        turn = turn === 'w' ? 'b' : 'w';
        updateStatus();
        checkGameEnd();
        return;
      }
      const piece = board[r][c];
      if (piece && piece.color === turn) {
        selected = { r, c };
        legalForSelected = legalMoves(board, r, c);
      } else {
        selected = null;
        legalForSelected = [];
      }
    } else {
      const piece = board[r][c];
      if (piece && piece.color === turn) {
        selected = { r, c };
        legalForSelected = legalMoves(board, r, c);
      }
    }
  }

  function drawStars() {
    for (const s of starField) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = '#cfd8ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBoard() {
    ctx.fillStyle = 'rgba(8, 12, 32, 0.55)';
    ctx.fillRect(boardX - 8, boardY - 8, BOARD_SIZE + 16, BOARD_SIZE + 16);
    ctx.strokeStyle = '#4a6aaa';
    ctx.lineWidth = 2;
    ctx.strokeRect(boardX - 8, boardY - 8, BOARD_SIZE + 16, BOARD_SIZE + 16);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const light = (r + c) % 2 === 0;
        ctx.fillStyle = light ? '#28315a' : '#141a36';
        ctx.fillRect(boardX + c * SQUARE, boardY + r * SQUARE, SQUARE, SQUARE);
      }
    }
    if (lastMove) {
      ctx.fillStyle = 'rgba(255, 220, 100, 0.18)';
      ctx.fillRect(boardX + lastMove.from.c * SQUARE, boardY + lastMove.from.r * SQUARE, SQUARE, SQUARE);
      ctx.fillRect(boardX + lastMove.to.c * SQUARE, boardY + lastMove.to.r * SQUARE, SQUARE, SQUARE);
    }
    if (selected) {
      ctx.fillStyle = 'rgba(120, 200, 255, 0.35)';
      ctx.fillRect(boardX + selected.c * SQUARE, boardY + selected.r * SQUARE, SQUARE, SQUARE);
    }
    for (const m of legalForSelected) {
      const cx = boardX + m.c * SQUARE + SQUARE / 2;
      const cy = boardY + m.r * SQUARE + SQUARE / 2;
      if (m.capture) {
        ctx.strokeStyle = 'rgba(255, 120, 120, 0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, SQUARE * 0.42, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(124, 252, 0, 0.55)';
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (inCheck(board, turn) && !gameOver) {
      const k = findKing(board, turn);
      if (k) {
        ctx.strokeStyle = 'rgba(255, 80, 80, 0.9)';
        ctx.lineWidth = 3;
        ctx.strokeRect(boardX + k.c * SQUARE + 2, boardY + k.r * SQUARE + 2, SQUARE - 4, SQUARE - 4);
      }
    }
  }

  function drawPieces() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        const cx = boardX + c * SQUARE + SQUARE / 2;
        const cy = boardY + r * SQUARE + SQUARE / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, SQUARE * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = p.color === 'w' ? 'rgba(180, 220, 255, 0.85)' : 'rgba(80, 30, 120, 0.85)';
        ctx.fill();
        ctx.strokeStyle = p.color === 'w' ? '#e0f0ff' : '#c890ff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = `${Math.floor(SQUARE * 0.6)}px serif`;
        ctx.fillText(PIECE_ICON[p.type], cx, cy + 2);
      }
    }
  }

  function drawLabels() {
    ctx.fillStyle = 'rgba(200, 220, 255, 0.5)';
    ctx.font = '12px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let c = 0; c < 8; c++) {
      const letter = String.fromCharCode('a'.charCodeAt(0) + c);
      ctx.fillText(letter, boardX + c * SQUARE + SQUARE / 2, boardY + BOARD_SIZE + 16);
    }
    for (let r = 0; r < 8; r++) {
      ctx.fillText(String(8 - r), boardX - 16, boardY + r * SQUARE + SQUARE / 2);
    }
  }

  function drawLegend() {
    const lx = boardX + BOARD_SIZE + 30;
    const ly = boardY + 8;
    ctx.fillStyle = 'rgba(200, 220, 255, 0.85)';
    ctx.font = 'bold 12px Orbitron, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('ALIEN CREW', lx, ly);
    ctx.font = '14px serif';
    const order = ['k', 'q', 'r', 'b', 'n', 'p'];
    let y = ly + 22;
    for (const t of order) {
      ctx.fillText(PIECE_ICON[t], lx, y);
      ctx.font = '11px Orbitron, monospace';
      ctx.fillText(PIECE_NAME[t].toUpperCase(), lx + 24, y + 2);
      ctx.font = '14px serif';
      y += 24;
    }
  }

  function render() {
    if (!running) return;
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawStars();
    drawBoard();
    drawPieces();
    drawLabels();
    drawLegend();
    requestAnimationFrame(render);
  }

  function start() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    boardX = Math.floor((canvas.width - BOARD_SIZE) / 2) - 60;
    boardY = Math.floor((canvas.height - BOARD_SIZE) / 2);
    board = newBoard();
    turn = 'w';
    selected = null;
    legalForSelected = [];
    lastMove = null;
    gameOver = false;
    if (starField.length === 0) initStarField();
    canvas.removeEventListener('click', onClick);
    canvas.addEventListener('click', onClick);
    canvas.style.cursor = 'pointer';
    if (!running) {
      running = true;
      requestAnimationFrame(render);
    }
    updateStatus();
  }

  function stop() {
    running = false;
    if (canvas) {
      canvas.removeEventListener('click', onClick);
      canvas.style.cursor = 'none';
    }
  }

  window.chessGame = { start, stop };
})();
