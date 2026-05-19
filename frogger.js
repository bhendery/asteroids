(function() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const CELL = 50;
  const COLS = 16;
  const ROWS = 12;
  const GOAL_COLS = [1, 4, 7, 10, 13];

  let state = null;

  function makeLane(row, speed, gap, kind) {
    const items = [];
    const count = Math.ceil(canvas.width / gap) + 1;
    for (let i = 0; i < count; i++) {
      items.push({ x: i * gap + Math.random() * 30 });
    }
    return { row, speed, gap, kind, items };
  }

  function reset() {
    const lanes = [];
    for (let r = 1; r <= 5; r++) {
      const dir = r % 2 === 0 ? 1 : -1;
      const speed = (1.0 + (r - 1) * 0.3) * dir;
      lanes.push(makeLane(r, speed, 180 + r * 20, 'ship'));
    }
    for (let r = 7; r <= 10; r++) {
      const dir = r % 2 === 0 ? 1 : -1;
      const speed = (0.7 + (10 - r) * 0.2) * dir;
      lanes.push(makeLane(r, speed, 220 - (10 - r) * 20, 'asteroid'));
    }
    state = {
      lanes,
      goals: [false, false, false, false, false],
      lives: 3,
      score: 0,
      maxRow: 11,
      player: { col: 8, row: 11, x: 8 * CELL + CELL / 2, y: 11 * CELL + CELL / 2, tx: 0, ty: 0 },
      running: true,
      flash: 0,
    };
    state.player.tx = state.player.x;
    state.player.ty = state.player.y;
  }

  function renderLives() {
    const c = document.getElementById('lives');
    c.innerHTML = '';
    for (let i = 0; i < state.lives; i++) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '-20 -24 40 44');
      const head = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      head.setAttribute('cx', '0'); head.setAttribute('cy', '-4');
      head.setAttribute('rx', '11'); head.setAttribute('ry', '13');
      head.setAttribute('fill', 'rgba(124, 252, 0, 0.3)');
      head.setAttribute('stroke', '#7cfc00');
      head.setAttribute('stroke-width', '2');
      svg.appendChild(head);
      for (const ex of [-4, 4]) {
        const eye = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        eye.setAttribute('cx', ex); eye.setAttribute('cy', '-5'); eye.setAttribute('r', '2');
        eye.setAttribute('fill', '#050508');
        svg.appendChild(eye);
      }
      c.appendChild(svg);
    }
  }

  function goalSlotForCol(col) {
    const idx = GOAL_COLS.indexOf(col);
    return idx === -1 ? null : idx;
  }

  function respawn() {
    const p = state.player;
    p.row = 11; p.col = 8;
    p.x = p.tx = 8 * CELL + CELL / 2;
    p.y = p.ty = 11 * CELL + CELL / 2;
    state.maxRow = 11;
  }

  function hurt() {
    state.lives--;
    state.flash = 30;
    renderLives();
    if (state.lives <= 0) {
      state.running = false;
      document.getElementById('finalScore').textContent = state.score;
      document.getElementById('gameOverScreen').classList.remove('hidden');
      return;
    }
    respawn();
  }

  function tryMove(dr, dc) {
    if (!state || !state.running) return;
    const p = state.player;
    const nr = p.row + dr;
    const nc = p.col + dc;
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return;
    if (nr === 0) {
      const idx = goalSlotForCol(nc);
      if (idx == null || state.goals[idx]) return;
      state.goals[idx] = true;
      state.score += 200;
      if (state.goals.every(g => g)) {
        state.score += 1000;
        state.goals = state.goals.map(() => false);
        for (const l of state.lanes) l.speed *= 1.15;
      }
      document.getElementById('score').textContent = state.score;
      respawn();
      return;
    }
    p.row = nr; p.col = nc;
    p.tx = nc * CELL + CELL / 2;
    p.ty = nr * CELL + CELL / 2;
    if (p.row < state.maxRow) {
      state.score += 10;
      state.maxRow = p.row;
      document.getElementById('score').textContent = state.score;
    }
  }

  function update() {
    if (!state || !state.running) return;
    if (state.flash > 0) state.flash--;

    const p = state.player;
    p.x += (p.tx - p.x) * 0.4;
    p.y += (p.ty - p.y) * 0.4;

    for (const lane of state.lanes) {
      const span = lane.items.length * lane.gap;
      for (const it of lane.items) {
        it.x += lane.speed;
        if (lane.speed > 0 && it.x > canvas.width + 60) it.x -= span;
        else if (lane.speed < 0 && it.x < -60) it.x += span;
      }
    }

    if (state.flash === 0) {
      for (const lane of state.lanes) {
        if (lane.row !== p.row) continue;
        const hw = lane.kind === 'ship' ? 30 : 22;
        const hh = lane.kind === 'ship' ? 12 : 18;
        const cy = lane.row * CELL + CELL / 2;
        for (const it of lane.items) {
          if (Math.abs(p.x - it.x) < hw + 10 && Math.abs(p.y - cy) < hh + 10) {
            hurt();
            return;
          }
        }
      }
    }
  }

  function drawAlien(cx, cy, scale, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(124, 252, 0, 0.3)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 6, 13, 8, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -5, 11, 12, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#050508';
    ctx.beginPath(); ctx.arc(-4, -5, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -5, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(-5, -15); ctx.lineTo(-8, -21);
    ctx.moveTo(5, -15); ctx.lineTo(8, -21);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(-8, -21, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, -21, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawShip(cx, cy, dir) {
    ctx.save();
    ctx.translate(cx, cy);
    if (dir < 0) ctx.scale(-1, 1);
    ctx.strokeStyle = '#ff4d6d';
    ctx.fillStyle = 'rgba(255, 77, 109, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 9, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-4, -5, 10, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 200, 100, 0.75)';
    ctx.beginPath();
    ctx.moveTo(-28, -3);
    ctx.lineTo(-38, 0);
    ctx.lineTo(-28, 3);
    ctx.fill();
    ctx.restore();
  }

  function drawAsteroid(cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#c9a227';
    ctx.fillStyle = 'rgba(180, 140, 40, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const verts = 9;
    for (let i = 0; i < verts; i++) {
      const a = (i / verts) * Math.PI * 2;
      const r = 18 + ((i * 7) % 6);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 80; i++) {
      const x = (i * 97) % canvas.width;
      const y = (i * 53) % canvas.height;
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    ctx.fillStyle = 'rgba(80, 50, 130, 0.4)';
    ctx.fillRect(0, 6 * CELL, canvas.width, CELL);

    ctx.fillStyle = 'rgba(60, 140, 60, 0.22)';
    ctx.fillRect(0, 11 * CELL, canvas.width, CELL);

    ctx.fillStyle = 'rgba(40, 80, 140, 0.4)';
    ctx.fillRect(0, 0, canvas.width, CELL);
    for (let i = 0; i < GOAL_COLS.length; i++) {
      const col = GOAL_COLS[i];
      const x = col * CELL;
      ctx.strokeStyle = state.goals[i] ? '#7cfc00' : '#4a6aaa';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 4, 4, CELL - 8, CELL - 8);
      if (state.goals[i]) drawAlien(x + CELL / 2, CELL / 2 + 4, 0.7, '#7cfc00');
    }

    for (const lane of state.lanes) {
      const y = lane.row * CELL + CELL / 2;
      for (const it of lane.items) {
        if (lane.kind === 'ship') drawShip(it.x, y, lane.speed);
        else drawAsteroid(it.x, y);
      }
    }

    const p = state.player;
    if (state.flash === 0 || Math.floor(state.flash / 4) % 2 === 0) {
      drawAlien(p.x, p.y, 1, '#7cfc00');
    }
  }

  function loop() {
    if (window.gameMode === 'frogger') {
      update();
      draw();
    }
    requestAnimationFrame(loop);
  }

  window.startFrogger = function() {
    window.gameMode = 'frogger';
    document.getElementById('gameTitle').textContent = 'SPACE FROGGER';
    document.getElementById('instructions').textContent = 'ARROWS / WASD — HOP  |  Cross the void and fill the goal slots!';
    document.getElementById('lives').style.display = '';
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    reset();
    renderLives();
    document.getElementById('score').textContent = '0';
  };

  document.getElementById('startFrogger').onclick = window.startFrogger;

  window.addEventListener('keydown', (e) => {
    if (window.gameMode !== 'frogger' || e.repeat) return;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); tryMove(-1, 0); }
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); tryMove(1, 0); }
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); tryMove(0, -1); }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); tryMove(0, 1); }
  });

  loop();
})();
