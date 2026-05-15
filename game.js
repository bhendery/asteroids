const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
let gameRunning = false;
let score = 0;
let lives = 3;
let gameTime = 0;
let keys = { up: false, down: false, left: false, right: false, fire: false };

// Player
const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  angle: -Math.PI / 2,
  speed: 0,
  maxSpeed: 5,
  acceleration: 0.15,
  friction: 0.98,
  turnSpeed: 0.08,
  radius: 18,
  invincibleUntil: 0,
};

let bullets = [];
let enemyBullets = [];
let asteroids = [];
let saucers = [];
let particles = [];
let stars = [];
let firstSaucerSpawned = false;
let megaship = null;
let megashipSpawned = false;
let warning = null;

const ASTEROID_SIZES = { large: 3, medium: 2, small: 1 };
const ASTEROID_POINTS = { large: 20, medium: 50, small: 100 };
const ASTEROID_RADII = { large: 45, medium: 28, small: 14 };
const SAUCER_RADIUS = 14;
const SAUCER_POINTS = 150;
const SAUCER_FIRE_INTERVAL = 150;
const SAUCER_SPEED = 1.2;
const ELITE_SAUCER_RADIUS = 24;
const ELITE_SAUCER_POINTS = 500;
const ELITE_SAUCER_FIRE_INTERVAL = 110;
const ELITE_SAUCER_SPEED = 0.9;
const ELITE_SAUCER_HP = 3;
const MEGASHIP_RADIUS = 72;
const MEGASHIP_HP = 12;
const MEGASHIP_POINTS = 2000;
const MEGASHIP_SPEED = 0.35;
const MEGASHIP_FIRE_INTERVAL = 70;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function generateStars() {
  const w = canvas.width;
  const h = canvas.height;
  stars = [];
  const numClusters = 4 + Math.floor(Math.random() * 3);
  const numVoids = 3 + Math.floor(Math.random() * 2);
  const clusterCenters = [];
  for (let i = 0; i < numClusters; i++) {
    clusterCenters.push({ x: rand(0, w), y: rand(0, h) });
  }
  const voids = [];
  for (let i = 0; i < numVoids; i++) {
    voids.push({
      x: rand(w * 0.2, w * 0.8),
      y: rand(h * 0.2, h * 0.8),
      r: rand(40, 90),
    });
  }
  function isInVoid(x, y) {
    for (const v of voids) {
      if ((x - v.x) ** 2 + (y - v.y) ** 2 < v.r * v.r) return true;
    }
    return false;
  }
  const clusterStarCount = 45 + Math.floor(Math.random() * 30);
  for (let i = 0; i < clusterStarCount; i++) {
    const c = clusterCenters[i % clusterCenters.length];
    const dist = rand(0, 60) + Math.random() * 35;
    const angle = Math.random() * Math.PI * 2;
    let x = c.x + Math.cos(angle) * dist;
    let y = c.y + Math.sin(angle) * dist;
    x = (x + w) % w;
    y = (y + h) % h;
    if (!isInVoid(x, y)) stars.push({ x, y });
  }
  const fieldStarCount = 50 + Math.floor(Math.random() * 35);
  for (let i = 0; i < fieldStarCount; i++) {
    const x = rand(0, w);
    const y = rand(0, h);
    if (!isInVoid(x, y)) stars.push({ x, y });
  }
}

function spawnAsteroid(size = 'large', atX, atY) {
  const radius = ASTEROID_RADII[size];
  let x = atX ?? (Math.random() < 0.5 ? (Math.random() < 0.5 ? -radius - 10 : canvas.width + radius + 10) : rand(0, canvas.width));
  let y = atY ?? (Math.random() < 0.5 ? (Math.random() < 0.5 ? -radius - 10 : canvas.height + radius + 10) : rand(0, canvas.height));
  if (atX != null && atY != null) {
    x = atX;
    y = atY;
  }
  const baseSpeed = size === 'large' ? rand(0.5, 1.1) : size === 'medium' ? rand(0.7, 1.4) : rand(0.9, 1.8);
  const towardPlayer = Math.atan2(canvas.height / 2 - y, canvas.width / 2 - x);
  const angle = towardPlayer + rand(-0.8, 0.8);
  const speed = baseSpeed * (0.5 + Math.min(gameTime / 500, 0.9));
  const verts = 8 + Math.floor(Math.random() * 4);
  const shape = [];
  for (let i = 0; i < verts; i++) {
    shape.push(radius * (0.7 + Math.random() * 0.6));
  }
  asteroids.push({
    x, y, angle, speed, size, radius, shape, verts,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  });
}

function aimAtPlayer() {
  const difficultyFactor = Math.min(1 + gameTime / 180, 2.2);
  const spawnRate = 140 + 160 / difficultyFactor;
  if (gameTime > 0 && Math.random() < 1 / spawnRate) {
    spawnAsteroid('large');
  }
}

function spawnSaucer(elite = false) {
  const fromLeft = Math.random() < 0.5;
  const radius = elite ? ELITE_SAUCER_RADIUS : SAUCER_RADIUS;
  const speed = elite ? ELITE_SAUCER_SPEED : SAUCER_SPEED;
  const x = fromLeft ? -radius - 10 : canvas.width + radius + 10;
  const y = rand(80, canvas.height - 80);
  const vx = fromLeft ? speed : -speed;
  const vy = rand(-0.2, 0.2);
  saucers.push({
    x, y, vx, vy,
    radius,
    elite,
    hp: elite ? ELITE_SAUCER_HP : 1,
    lastShot: 0,
    doubleShotPending: 0,
  });
}

function maybeSpawnSaucer() {
  if (!gameRunning) return;
  if (!firstSaucerSpawned && gameTime >= 180 && gameTime <= 600) {
    if (Math.random() < 1 / 80) {
      spawnSaucer(false);
      firstSaucerSpawned = true;
    }
  }
  if (firstSaucerSpawned && saucers.length < 2 && gameTime > 0 && Math.random() < 1 / 450) {
    const elite = gameTime >= 600 && Math.random() < 0.35;
    spawnSaucer(elite);
  }
}

function spawnMegaship() {
  const fromLeft = Math.random() < 0.5;
  const x = fromLeft ? -MEGASHIP_RADIUS - 20 : canvas.width + MEGASHIP_RADIUS + 20;
  const y = rand(canvas.height * 0.25, canvas.height * 0.75);
  megaship = {
    x, y,
    vx: fromLeft ? MEGASHIP_SPEED : -MEGASHIP_SPEED,
    hp: MEGASHIP_HP,
    maxHp: MEGASHIP_HP,
    radius: MEGASHIP_RADIUS,
    angle: fromLeft ? 0 : Math.PI,
    lastShot: gameTime,
    sineOffset: Math.random() * Math.PI * 2,
  };
  megashipSpawned = true;
  warning = { timer: 180 };
}

function maybeSpawnMegaship() {
  if (!gameRunning || megashipSpawned) return;
  if (gameTime >= 1800 && Math.random() < 1 / 300) {
    spawnMegaship();
  }
}

function drawSaucer(s) {
  ctx.save();
  ctx.translate(s.x, s.y);
  if (s.elite) {
    ctx.strokeStyle = '#ff4d6d';
    ctx.fillStyle = 'rgba(255, 77, 109, 0.35)';
    ctx.lineWidth = 2.5;
  } else {
    ctx.strokeStyle = '#a0c0e0';
    ctx.fillStyle = 'rgba(160, 192, 224, 0.35)';
    ctx.lineWidth = 2;
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, s.radius * 1.4, s.radius * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, s.radius * 0.9, s.radius * 0.35, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (s.elite) {
    ctx.beginPath();
    ctx.arc(0, -s.radius * 0.1, s.radius * 0.25, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMegaship(m) {
  const R = MEGASHIP_RADIUS;
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(m.angle);

  // Engine nacelle glow (behind hull)
  for (const sign of [1, -1]) {
    const grd = ctx.createRadialGradient(-R * 0.82, sign * R * 0.5, 0, -R * 0.82, sign * R * 0.5, R * 0.24);
    grd.addColorStop(0, 'rgba(255, 140, 20, 0.9)');
    grd.addColorStop(1, 'rgba(255, 80, 0, 0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(-R * 0.82, sign * R * 0.5, R * 0.24, 0, Math.PI * 2);
    ctx.fill();
  }

  // Side nacelles
  ctx.strokeStyle = '#ff5500';
  ctx.fillStyle = 'rgba(140, 40, 5, 0.6)';
  ctx.lineWidth = 2;
  for (const sign of [1, -1]) {
    ctx.beginPath();
    ctx.ellipse(-R * 0.48, sign * R * 0.52, R * 0.34, R * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Main hull
  ctx.strokeStyle = '#ff6600';
  ctx.fillStyle = 'rgba(160, 50, 10, 0.55)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(R, 0);
  ctx.lineTo(R * 0.72, R * 0.28);
  ctx.lineTo(R * 0.2, R * 0.36);
  ctx.lineTo(-R * 0.28, R * 0.4);
  ctx.lineTo(-R * 0.68, R * 0.3);
  ctx.lineTo(-R, R * 0.16);
  ctx.lineTo(-R * 0.82, 0);
  ctx.lineTo(-R, -R * 0.16);
  ctx.lineTo(-R * 0.68, -R * 0.3);
  ctx.lineTo(-R * 0.28, -R * 0.4);
  ctx.lineTo(R * 0.2, -R * 0.36);
  ctx.lineTo(R * 0.72, -R * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Hull detail lines
  ctx.strokeStyle = 'rgba(255, 140, 60, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(R * 0.6, R * 0.12); ctx.lineTo(-R * 0.55, R * 0.12);
  ctx.moveTo(R * 0.6, -R * 0.12); ctx.lineTo(-R * 0.55, -R * 0.12);
  ctx.stroke();

  // Gun turrets
  ctx.fillStyle = 'rgba(255, 130, 20, 0.75)';
  ctx.strokeStyle = '#ff9900';
  ctx.lineWidth = 1.5;
  for (const [tx, ty] of [[R * 0.42, R * 0.26], [R * 0.42, -R * 0.26], [-R * 0.1, R * 0.38], [-R * 0.1, -R * 0.38]]) {
    ctx.beginPath();
    ctx.arc(tx, ty, R * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Bridge dome
  ctx.fillStyle = 'rgba(255, 210, 120, 0.55)';
  ctx.strokeStyle = '#ffcc44';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(R * 0.12, 0, R * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  // Health bar and label (world coordinates)
  ctx.save();
  const barW = R * 2.8;
  const barH = 7;
  const barX = m.x - barW / 2;
  const barY = m.y - R - 22;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
  ctx.fillStyle = '#cc3300';
  ctx.fillRect(barX, barY, barW * (m.hp / m.maxHp), barH);
  ctx.strokeStyle = '#ff6600';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);
  ctx.fillStyle = '#ff9900';
  ctx.font = '9px Orbitron, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('MEGASHIP', m.x, barY - 2);
  ctx.restore();
}

function drawBullet(b) {
  ctx.fillStyle = '#ffdd00';
  ctx.beginPath();
  ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemyBullet(b) {
  if (b.megaship) {
    ctx.fillStyle = '#ff9900';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 180, 0, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    ctx.fillStyle = b.elite ? '#ff4d6d' : '#ff3333';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.elite ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawShip() {
  const r = player.radius;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.strokeStyle = '#7cfc00';
  ctx.fillStyle = 'rgba(124, 252, 0, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Nose (slightly rounded)
  ctx.moveTo(r, 0);
  // Starboard side → rear engine pod
  ctx.lineTo(r * 0.25, r * 0.5);
  ctx.lineTo(-r * 0.55, r * 0.52);
  ctx.lineTo(-r * 0.92, r * 0.42);
  // Center rear
  ctx.lineTo(-r * 0.5, 0);
  // Port rear engine pod → port side
  ctx.lineTo(-r * 0.92, -r * 0.42);
  ctx.lineTo(-r * 0.55, -r * 0.52);
  ctx.lineTo(r * 0.25, -r * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawAsteroid(a) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.angle);
  ctx.strokeStyle = '#c9a227';
  ctx.fillStyle = 'rgba(180, 140, 40, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < a.verts; i++) {
    const r = a.shape[i];
    const angle = (i / a.verts) * Math.PI * 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function addParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = rand(1, 4);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color,
    });
  }
}

function hitTestBulletAsteroid(b, a) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy < (a.radius + 5) * (a.radius + 5);
}

function hitTestPlayerAsteroid(a) {
  if (gameTime < player.invincibleUntil) return false;
  const dx = player.x - a.x;
  const dy = player.y - a.y;
  return dx * dx + dy * dy < (player.radius + a.radius) * (player.radius + a.radius);
}

function hitTestBulletSaucer(b, s) {
  const dx = b.x - s.x;
  const dy = b.y - s.y;
  return dx * dx + dy * dy < (s.radius + 5) * (s.radius + 5);
}

function hitTestPlayerEnemyBullet(b) {
  if (gameTime < player.invincibleUntil) return false;
  const dx = player.x - b.x;
  const dy = player.y - b.y;
  return dx * dx + dy * dy < (player.radius + 4) * (player.radius + 4);
}

function breakSaucer(saucer, bulletIndex) {
  saucer.hp--;
  if (bulletIndex >= 0) bullets.splice(bulletIndex, 1);
  if (saucer.hp > 0) {
    addParticles(saucer.x, saucer.y, saucer.elite ? '#ff4d6d' : '#a0c0e0', 4);
    return;
  }
  score += saucer.elite ? ELITE_SAUCER_POINTS : SAUCER_POINTS;
  document.getElementById('score').textContent = score;
  addParticles(saucer.x, saucer.y, saucer.elite ? '#ff4d6d' : '#a0c0e0', saucer.elite ? 18 : 10);
  saucers.splice(saucers.indexOf(saucer), 1);
}

function breakAsteroid(asteroid, bulletIndex) {
  const pts = ASTEROID_POINTS[asteroid.size];
  score += pts;
  document.getElementById('score').textContent = score;
  addParticles(asteroid.x, asteroid.y, '#c9a227', 12);

  const nextSize = asteroid.size === 'large' ? 'medium' : asteroid.size === 'medium' ? 'small' : null;
  if (nextSize) {
    spawnAsteroid(nextSize, asteroid.x, asteroid.y);
    spawnAsteroid(nextSize, asteroid.x + rand(-15, 15), asteroid.y + rand(-15, 15));
  }

  asteroids.splice(asteroids.indexOf(asteroid), 1);
  if (bulletIndex >= 0) bullets.splice(bulletIndex, 1);
}

function hurtPlayer() {
  lives--;
  document.getElementById('lives').textContent = lives;
  player.invincibleUntil = gameTime + 120;
  addParticles(player.x, player.y, '#ff6b6b', 15);
  if (lives <= 0) endGame();
}

function endGame() {
  gameRunning = false;
  document.getElementById('finalScore').textContent = score;
  document.getElementById('gameOverScreen').classList.remove('hidden');
}

function update(dt) {
  if (!gameRunning) return;
  gameTime++;

  // Player movement
  if (keys.left) player.angle -= player.turnSpeed;
  if (keys.right) player.angle += player.turnSpeed;
  if (keys.up) {
    player.speed = Math.min(player.speed + player.acceleration, player.maxSpeed);
  } else {
    player.speed *= player.friction;
  }
  player.x += Math.cos(player.angle) * player.speed;
  player.y += Math.sin(player.angle) * player.speed;
  player.x = (player.x + canvas.width) % canvas.width;
  player.y = (player.y + canvas.height) % canvas.height;

  // Bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life--;
    if (b.life <= 0 || b.x < -10 || b.x > canvas.width + 10 || b.y < -10 || b.y > canvas.height + 10) {
      bullets.splice(i, 1);
      continue;
    }
    for (let j = asteroids.length - 1; j >= 0; j--) {
      if (hitTestBulletAsteroid(b, asteroids[j])) {
        breakAsteroid(asteroids[j], i);
        break;
      }
    }
    for (let j = saucers.length - 1; j >= 0; j--) {
      if (hitTestBulletSaucer(b, saucers[j])) {
        breakSaucer(saucers[j], i);
        break;
      }
    }
    if (megaship) {
      const mdx = b.x - megaship.x;
      const mdy = b.y - megaship.y;
      if (mdx * mdx + mdy * mdy < (MEGASHIP_RADIUS + 5) * (MEGASHIP_RADIUS + 5)) {
        megaship.hp--;
        bullets.splice(i, 1);
        addParticles(b.x, b.y, '#ff6600', 5);
        if (megaship.hp <= 0) {
          score += MEGASHIP_POINTS;
          document.getElementById('score').textContent = score;
          addParticles(megaship.x, megaship.y, '#ff6600', 40);
          addParticles(megaship.x, megaship.y, '#ffaa00', 30);
          megaship = null;
        }
      }
    }
  }

  // Saucers
  maybeSpawnSaucer();
  for (const s of saucers) {
    s.x += s.vx;
    s.y += s.vy;
    const fireInterval = s.elite ? ELITE_SAUCER_FIRE_INTERVAL : SAUCER_FIRE_INTERVAL;
    const spread = s.elite ? 0.25 : 0.7;
    if (gameTime - s.lastShot >= fireInterval) {
      const angleToPlayer = Math.atan2(player.y - s.y, player.x - s.x);
      const angle = angleToPlayer + rand(-spread, spread);
      const speed = s.elite ? 6 : 5;
      enemyBullets.push({
        x: s.x, y: s.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 120,
        elite: s.elite,
      });
      s.lastShot = gameTime;
      if (Math.random() < 0.15) s.doubleShotPending = 8;
    }
    if (s.doubleShotPending > 0) {
      s.doubleShotPending--;
      if (s.doubleShotPending === 0) {
        const angleToPlayer = Math.atan2(player.y - s.y, player.x - s.x);
        const angle = angleToPlayer + rand(-spread, spread);
        const speed = s.elite ? 6 : 5;
        enemyBullets.push({
          x: s.x, y: s.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 120,
          elite: s.elite,
        });
      }
    }
  }
  for (let i = saucers.length - 1; i >= 0; i--) {
    const s = saucers[i];
    if (s.x < -50 || s.x > canvas.width + 50) saucers.splice(i, 1);
  }

  maybeSpawnMegaship();
  if (megaship) {
    megaship.x += megaship.vx;
    megaship.y += Math.sin(gameTime * 0.025 + megaship.sineOffset) * 0.6;
    if (gameTime - megaship.lastShot >= MEGASHIP_FIRE_INTERVAL) {
      const baseAngle = Math.atan2(player.y - megaship.y, player.x - megaship.x);
      for (const offset of [-0.3, 0, 0.3]) {
        const ang = baseAngle + offset;
        enemyBullets.push({
          x: megaship.x, y: megaship.y,
          vx: Math.cos(ang) * 4.5,
          vy: Math.sin(ang) * 4.5,
          life: 150,
          elite: true,
          megaship: true,
        });
      }
      megaship.lastShot = gameTime;
    }
    if (gameTime >= player.invincibleUntil) {
      const dx = player.x - megaship.x;
      const dy = player.y - megaship.y;
      if (dx * dx + dy * dy < (player.radius + MEGASHIP_RADIUS * 0.6) * (player.radius + MEGASHIP_RADIUS * 0.6)) {
        hurtPlayer();
      }
    }
    if (megaship.x < -MEGASHIP_RADIUS * 3 || megaship.x > canvas.width + MEGASHIP_RADIUS * 3) {
      megaship = null;
    }
  }
  if (warning) {
    warning.timer--;
    if (warning.timer <= 0) warning = null;
  }

  // Enemy bullets
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life--;
    if (b.life <= 0 || b.x < -10 || b.x > canvas.width + 10 || b.y < -10 || b.y > canvas.height + 10) {
      enemyBullets.splice(i, 1);
      continue;
    }
    if (hitTestPlayerEnemyBullet(b)) {
      hurtPlayer();
      enemyBullets.splice(i, 1);
    }
  }

  // Asteroids
  aimAtPlayer();
  for (const a of asteroids) {
    a.x += a.vx;
    a.y += a.vy;
    a.angle += 0.01;
    if (a.x < -a.radius * 2 || a.x > canvas.width + a.radius * 2 ||
        a.y < -a.radius * 2 || a.y > canvas.height + a.radius * 2) {
      asteroids.splice(asteroids.indexOf(a), 1);
    }
    if (hitTestPlayerAsteroid(a)) {
      hurtPlayer();
      addParticles(a.x, a.y, '#c9a227', 8);
      asteroids.splice(asteroids.indexOf(a), 1);
    }
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.03;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function draw() {
  ctx.fillStyle = '#050508';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Stars (size by distance to player: closer = larger, at most 4x smallest)
  const minStarSize = 0.5;
  const maxStarSize = 2;
  const maxDist = Math.hypot(canvas.width, canvas.height) * 0.55;
  for (const s of stars) {
    const dx = s.x - player.x;
    const dy = s.y - player.y;
    const dist = Math.hypot(dx, dy);
    const t = Math.min(1, dist / maxDist);
    const size = Math.max(minStarSize, maxStarSize - (maxStarSize - minStarSize) * t);
    const alpha = 0.4 + 0.35 * (1 - t);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(s.x, s.y, size, size);
  }

  for (const p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  for (const a of asteroids) drawAsteroid(a);
  for (const s of saucers) drawSaucer(s);
  if (megaship) drawMegaship(megaship);
  for (const b of bullets) drawBullet(b);
  for (const b of enemyBullets) drawEnemyBullet(b);
  if (gameTime < player.invincibleUntil && Math.floor(gameTime / 8) % 2 === 0) {} else drawShip();
  if (warning && gameRunning) {
    const pulse = 0.5 + 0.5 * Math.sin(gameTime * 0.2);
    ctx.save();
    ctx.globalAlpha = (warning.timer / 180) * pulse;
    ctx.fillStyle = '#ff69b4';
    ctx.font = 'bold 22px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('-- MEGASHIP INCOMING --', canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }
}

function gameLoop() {
  update(1);
  draw();
  requestAnimationFrame(gameLoop);
}

document.getElementById('startBtn').onclick = () => {
  document.getElementById('startScreen').classList.add('hidden');
  score = 0;
  lives = 3;
  gameTime = 0;
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  player.angle = -Math.PI / 2;
  player.speed = 0;
  player.invincibleUntil = 90;
  bullets = [];
  enemyBullets = [];
  asteroids = [];
  saucers = [];
  particles = [];
  firstSaucerSpawned = false;
  megaship = null;
  megashipSpawned = false;
  warning = null;
  document.getElementById('score').textContent = '0';
  document.getElementById('lives').textContent = '3';
  generateStars();
  gameRunning = true;
};

document.getElementById('restartBtn').onclick = () => {
  document.getElementById('gameOverScreen').classList.add('hidden');
  document.getElementById('startBtn').click();
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = true;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = true;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat && gameRunning) {
      bullets.push({
        x: player.x + Math.cos(player.angle) * player.radius,
        y: player.y + Math.sin(player.angle) * player.radius,
        vx: Math.cos(player.angle) * 12,
        vy: Math.sin(player.angle) * 12,
        life: 90,
      });
    }
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = false;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  if (e.code === 'Space') keys.fire = false;
});

generateStars();
gameLoop();
