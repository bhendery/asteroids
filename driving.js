// Space Racer - a driving game set in the asteroids universe.
// Exposes window.DrivingGame with init, update, draw, onLaneInput, getScore.

(function () {
  const LANES = 4;
  const ROAD_MARGIN = 80;
  const PLAYER_Y_OFFSET = 90;

  const state = {
    canvas: null,
    ctx: null,
    laneCount: LANES,
    roadLeft: 0,
    roadRight: 0,
    roadWidth: 0,
    laneWidth: 0,
    playerLane: 1,
    playerX: 0,
    playerTargetX: 0,
    playerY: 0,
    speed: 0,
    baseSpeed: 4,
    maxSpeed: 11,
    obstacles: [],
    sparks: [],
    scrollOffset: 0,
    score: 0,
    lives: 3,
    spawnTimer: 0,
    invincibleTimer: 0,
    elapsed: 0,
    stars: [],
    running: false,
  };

  function rand(min, max) { return min + Math.random() * (max - min); }

  function laneCenterX(lane) {
    return state.roadLeft + state.laneWidth * (lane + 0.5);
  }

  function generateStars() {
    state.stars = [];
    for (let i = 0; i < 70; i++) {
      state.stars.push({
        x: rand(0, state.canvas.width),
        y: rand(0, state.canvas.height),
        size: rand(0.5, 1.8),
        speed: rand(0.3, 1.2),
      });
    }
  }

  function init(canvas, ctx) {
    state.canvas = canvas;
    state.ctx = ctx;
    state.roadLeft = ROAD_MARGIN;
    state.roadRight = canvas.width - ROAD_MARGIN;
    state.roadWidth = state.roadRight - state.roadLeft;
    state.laneWidth = state.roadWidth / LANES;
    state.playerLane = 1;
    state.playerX = laneCenterX(state.playerLane);
    state.playerTargetX = state.playerX;
    state.playerY = canvas.height - PLAYER_Y_OFFSET;
    state.speed = state.baseSpeed;
    state.obstacles = [];
    state.sparks = [];
    state.scrollOffset = 0;
    state.score = 0;
    state.lives = 3;
    state.spawnTimer = 30;
    state.invincibleTimer = 60;
    state.elapsed = 0;
    state.running = true;
    generateStars();
  }

  function onLaneInput(direction) {
    if (!state.running) return;
    const next = state.playerLane + direction;
    if (next < 0 || next >= LANES) return;
    state.playerLane = next;
    state.playerTargetX = laneCenterX(next);
  }

  function spawnObstacle() {
    const lane = Math.floor(Math.random() * LANES);
    // Mostly cars; some asteroid debris for variety.
    const type = Math.random() < 0.7 ? 'car' : 'asteroid';
    const radius = type === 'car' ? 22 : rand(16, 26);
    state.obstacles.push({
      lane,
      x: laneCenterX(lane),
      y: -radius - 20,
      type,
      radius,
      hue: type === 'car' ? Math.floor(rand(0, 360)) : 40,
      spin: type === 'asteroid' ? rand(-0.05, 0.05) : 0,
      angle: 0,
      verts: type === 'asteroid' ? 8 + Math.floor(Math.random() * 4) : 0,
      shape: type === 'asteroid'
        ? Array.from({ length: 12 }, () => radius * (0.7 + Math.random() * 0.6))
        : null,
      scored: false,
    });
  }

  function update() {
    if (!state.running) return;
    state.elapsed++;
    if (state.invincibleTimer > 0) state.invincibleTimer--;

    // Smoothly drive player toward target lane.
    const dx = state.playerTargetX - state.playerX;
    state.playerX += dx * 0.22;

    // Speed scales up over time.
    state.speed = Math.min(state.maxSpeed, state.baseSpeed + state.elapsed / 600);

    // Scroll road and stars.
    state.scrollOffset = (state.scrollOffset + state.speed) % 40;
    for (const s of state.stars) {
      s.y += s.speed * (state.speed / state.baseSpeed) * 0.5;
      if (s.y > state.canvas.height) {
        s.y = 0;
        s.x = rand(0, state.canvas.width);
      }
    }

    // Spawn obstacles.
    state.spawnTimer--;
    if (state.spawnTimer <= 0) {
      spawnObstacle();
      const interval = Math.max(18, 60 - state.elapsed / 60);
      state.spawnTimer = interval + Math.random() * 20;
    }

    // Move obstacles, detect collisions and passes.
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const o = state.obstacles[i];
      o.y += state.speed;
      o.angle += o.spin;
      if (!o.scored && o.y > state.playerY + 40) {
        o.scored = true;
        state.score += 10;
      }
      if (o.y - o.radius > state.canvas.height + 30) {
        state.obstacles.splice(i, 1);
        continue;
      }
      // Collision check
      if (state.invincibleTimer <= 0) {
        const ddx = o.x - state.playerX;
        const ddy = o.y - state.playerY;
        const rSum = o.radius + 18;
        if (ddx * ddx + ddy * ddy < rSum * rSum) {
          handleCrash(o);
          state.obstacles.splice(i, 1);
        }
      }
    }

    // Sparks
    for (let i = state.sparks.length - 1; i >= 0; i--) {
      const p = state.sparks[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life -= 0.04;
      if (p.life <= 0) state.sparks.splice(i, 1);
    }

    // Continuous distance scoring.
    if (state.elapsed % 3 === 0) state.score += 1;
  }

  function handleCrash(obstacle) {
    state.lives--;
    state.invincibleTimer = 90;
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(1, 5);
      state.sparks.push({
        x: (state.playerX + obstacle.x) / 2,
        y: (state.playerY + obstacle.y) / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 1,
        color: Math.random() < 0.5 ? '#ffaa33' : '#ff5500',
      });
    }
    if (state.lives <= 0) {
      state.running = false;
      if (typeof state.onGameOver === 'function') state.onGameOver(state.score);
    }
  }

  function drawStarfield() {
    const ctx = state.ctx;
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
    for (const s of state.stars) {
      ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.5 * (s.speed / 1.2)})`;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
  }

  function drawRoad() {
    const ctx = state.ctx;
    const w = state.canvas.width;
    const h = state.canvas.height;

    // Road surface
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, 'rgba(20, 25, 50, 0.85)');
    grd.addColorStop(1, 'rgba(40, 50, 90, 0.95)');
    ctx.fillStyle = grd;
    ctx.fillRect(state.roadLeft, 0, state.roadWidth, h);

    // Glowing side rails
    ctx.strokeStyle = '#6effff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#6effff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(state.roadLeft, 0); ctx.lineTo(state.roadLeft, h);
    ctx.moveTo(state.roadRight, 0); ctx.lineTo(state.roadRight, h);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Lane dividers (dashed, scrolling)
    ctx.strokeStyle = 'rgba(180, 210, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([22, 18]);
    ctx.lineDashOffset = -state.scrollOffset;
    for (let i = 1; i < LANES; i++) {
      const x = state.roadLeft + state.laneWidth * i;
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  function drawCar(x, y, hue, isPlayer) {
    const ctx = state.ctx;
    ctx.save();
    ctx.translate(x, y);
    const w = 26;
    const h = 44;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-w / 2 + 2, -h / 2 + 4, w, h);
    // Body
    const body = isPlayer ? '#7cfc00' : `hsl(${hue}, 70%, 55%)`;
    const bodyDark = isPlayer ? '#4aa000' : `hsl(${hue}, 70%, 35%)`;
    ctx.fillStyle = body;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = bodyDark;
    ctx.fillRect(-w / 2, -h / 2, w, 6);
    ctx.fillRect(-w / 2, h / 2 - 6, w, 6);
    // Windshield
    ctx.fillStyle = 'rgba(120, 200, 255, 0.85)';
    ctx.fillRect(-w / 2 + 3, -h / 2 + 8, w - 6, 10);
    // Rear window
    ctx.fillStyle = 'rgba(120, 200, 255, 0.5)';
    ctx.fillRect(-w / 2 + 3, h / 2 - 16, w - 6, 8);
    // Outline
    ctx.strokeStyle = isPlayer ? '#aaff66' : '#000';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    // Headlights / thrusters
    if (isPlayer) {
      ctx.fillStyle = '#ffeb55';
      ctx.fillRect(-w / 2 + 2, -h / 2 - 2, 5, 3);
      ctx.fillRect(w / 2 - 7, -h / 2 - 2, 5, 3);
      // Glow trail behind player
      const trail = ctx.createLinearGradient(0, h / 2, 0, h / 2 + 20);
      trail.addColorStop(0, 'rgba(124, 252, 0, 0.6)');
      trail.addColorStop(1, 'rgba(124, 252, 0, 0)');
      ctx.fillStyle = trail;
      ctx.fillRect(-w / 2 + 3, h / 2, w - 6, 20);
    } else {
      ctx.fillStyle = '#ff3333';
      ctx.fillRect(-w / 2 + 2, h / 2 - 3, 5, 3);
      ctx.fillRect(w / 2 - 7, h / 2 - 3, 5, 3);
    }
    ctx.restore();
  }

  function drawAsteroidObstacle(o) {
    const ctx = state.ctx;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.angle);
    ctx.strokeStyle = '#c9a227';
    ctx.fillStyle = 'rgba(180, 140, 40, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < o.verts; i++) {
      const r = o.shape[i];
      const a = (i / o.verts) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawLivesHUD() {
    const ctx = state.ctx;
    for (let i = 0; i < state.lives; i++) {
      const x = 18 + i * 26;
      const y = 22;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = 'rgba(124, 252, 0, 0.25)';
      ctx.strokeStyle = '#7cfc00';
      ctx.lineWidth = 2;
      ctx.fillRect(-7, -10, 14, 20);
      ctx.strokeRect(-7, -10, 14, 20);
      ctx.fillStyle = 'rgba(120, 200, 255, 0.85)';
      ctx.fillRect(-5, -6, 10, 5);
      ctx.restore();
    }
  }

  function draw() {
    const ctx = state.ctx;
    drawStarfield();
    drawRoad();

    for (const o of state.obstacles) {
      if (o.type === 'car') drawCar(o.x, o.y, o.hue, false);
      else drawAsteroidObstacle(o);
    }

    // Sparks
    for (const p of state.sparks) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Flicker player when invincible
    const flicker = state.invincibleTimer > 0 && Math.floor(state.elapsed / 6) % 2 === 0;
    if (!flicker) drawCar(state.playerX, state.playerY, 0, true);

    drawLivesHUD();

    // Speed indicator
    ctx.fillStyle = 'rgba(110, 255, 255, 0.85)';
    ctx.font = 'bold 12px Orbitron, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`${Math.round(state.speed * 30)} KM/S`, state.canvas.width - 14, 14);
  }

  function getScore() { return state.score; }
  function isRunning() { return state.running; }
  function setRunning(v) { state.running = v; }
  function setGameOverHandler(fn) { state.onGameOver = fn; }

  window.DrivingGame = {
    init,
    update,
    draw,
    onLaneInput,
    getScore,
    isRunning,
    setRunning,
    setGameOverHandler,
  };
})();
