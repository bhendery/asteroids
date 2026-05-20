const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
let gameRunning = false;
let score = 0;
let lives = 3;
let maxLives = 3;
let gameTime = 0;
let keys = { up: false, down: false, left: false, right: false, fire: false };

// Mode + campaign state
let mode = 'arcade'; // 'arcade' | 'campaign'
let campaignLevel = 1;
let levelPhase = 'idle'; // 'idle' | 'intro' | 'playing' | 'upgrade' | 'victory'
let levelIntroTimer = 0;
let levelClearTimer = 0;
let saucerSpawnCooldown = 0;
const TOTAL_LEVELS = 8;

const LEVELS = [
  { large: 3, saucerChance: 0,    eliteChance: 0,    saucerEvery: 0,   boss: false, subtitle: 'Clear the field.' },
  { large: 4, saucerChance: 0.55, eliteChance: 0,    saucerEvery: 540, boss: false, subtitle: 'Saucers inbound.' },
  { large: 5, saucerChance: 0.75, eliteChance: 0,    saucerEvery: 480, boss: false, subtitle: 'Heavier resistance.' },
  { large: 6, saucerChance: 0.4,  eliteChance: 0.5,  saucerEvery: 480, boss: false, subtitle: 'Elites detected.' },
  { large: 7, saucerChance: 0.6,  eliteChance: 0.4,  saucerEvery: 420, boss: false, subtitle: 'Field is dense.' },
  { large: 5, saucerChance: 0.4,  eliteChance: 0.7,  saucerEvery: 380, boss: false, subtitle: 'Elite squadron.' },
  { large: 6, saucerChance: 0.5,  eliteChance: 0.65, saucerEvery: 360, boss: false, subtitle: 'Final approach.' },
  { large: 4, saucerChance: 0,    eliteChance: 0,    saucerEvery: 0,   boss: true,  subtitle: 'BOSS: MEGASHIP' },
];

// Player + upgrades
const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  angle: -Math.PI / 2,
  speed: 0,
  baseMaxSpeed: 5,
  maxSpeed: 5,
  acceleration: 0.15,
  friction: 0.98,
  turnSpeed: 0.08,
  radius: 18,
  invincibleUntil: 0,
};

const playerUpgrades = {
  rapidFire: 0,    // 0 = single-shot on press; 1-3 = held auto-fire, faster per rank
  multishot: 0,    // 0-2 extra side-bullet pairs
  hullPlating: 0,  // +1 max life per rank
  speedBoost: 0,   // +15% top speed per rank
  sharpshooter: 0, // bullets fly faster and longer per rank
};

const UPGRADES = [
  { id: 'rapidFire',    name: 'RAPID FIRE',    max: 3, desc: 'Hold SPACE to auto-fire.' },
  { id: 'multishot',    name: 'SPREAD SHOT',   max: 2, desc: '+1 pair of side bullets per shot.' },
  { id: 'hullPlating',  name: 'HULL PLATING',  max: 3, desc: '+1 max life and refill.' },
  { id: 'speedBoost',   name: 'AFTERBURNER',   max: 3, desc: '+15% top speed.' },
  { id: 'sharpshooter', name: 'SHARPSHOOTER',  max: 3, desc: 'Bullets fly faster and farther.' },
  { id: 'repair',       name: 'EMERGENCY REPAIR', max: 99, desc: 'Restore 1 life.' },
];

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
let fireCooldown = 0;

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

const STORAGE_KEY = 'asteroidsProgress';

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function saveProgress(patch) {
  const p = { ...loadProgress(), ...patch };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
  return p;
}

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
  const difficulty = mode === 'campaign'
    ? 0.6 + campaignLevel * 0.08
    : 0.5 + Math.min(gameTime / 500, 0.9);
  const speed = baseSpeed * difficulty;
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
  if (mode !== 'arcade') return;
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
  if (mode === 'arcade') {
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
    return;
  }
  // Campaign: scheduled saucer waves per level
  if (levelPhase !== 'playing') return;
  const cfg = LEVELS[campaignLevel - 1];
  if (!cfg.saucerEvery || saucers.length >= 2) return;
  saucerSpawnCooldown--;
  if (saucerSpawnCooldown <= 0) {
    saucerSpawnCooldown = cfg.saucerEvery;
    if (Math.random() < cfg.saucerChance + cfg.eliteChance) {
      const eliteRoll = cfg.eliteChance / (cfg.saucerChance + cfg.eliteChance);
      spawnSaucer(Math.random() < eliteRoll);
    }
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
    boss: mode === 'campaign',
  };
  megashipSpawned = true;
  warning = { timer: 180 };
}

function maybeSpawnMegaship() {
  if (!gameRunning || megashipSpawned) return;
  if (mode === 'arcade') {
    if (gameTime >= 1800 && Math.random() < 1 / 300) spawnMegaship();
  }
  // Campaign boss is spawned explicitly at level start.
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

  for (const sign of [1, -1]) {
    const grd = ctx.createRadialGradient(-R * 0.82, sign * R * 0.5, 0, -R * 0.82, sign * R * 0.5, R * 0.24);
    grd.addColorStop(0, 'rgba(255, 140, 20, 0.9)');
    grd.addColorStop(1, 'rgba(255, 80, 0, 0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(-R * 0.82, sign * R * 0.5, R * 0.24, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = '#ff5500';
  ctx.fillStyle = 'rgba(140, 40, 5, 0.6)';
  ctx.lineWidth = 2;
  for (const sign of [1, -1]) {
    ctx.beginPath();
    ctx.ellipse(-R * 0.48, sign * R * 0.52, R * 0.34, R * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

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

  ctx.strokeStyle = 'rgba(255, 140, 60, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(R * 0.6, R * 0.12); ctx.lineTo(-R * 0.55, R * 0.12);
  ctx.moveTo(R * 0.6, -R * 0.12); ctx.lineTo(-R * 0.55, -R * 0.12);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 130, 20, 0.75)';
  ctx.strokeStyle = '#ff9900';
  ctx.lineWidth = 1.5;
  for (const [tx, ty] of [[R * 0.42, R * 0.26], [R * 0.42, -R * 0.26], [-R * 0.1, R * 0.38], [-R * 0.1, -R * 0.38]]) {
    ctx.beginPath();
    ctx.arc(tx, ty, R * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255, 210, 120, 0.55)';
  ctx.strokeStyle = '#ffcc44';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(R * 0.12, 0, R * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();

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
  ctx.fillText(m.boss ? 'BOSS — MEGASHIP' : 'MEGASHIP', m.x, barY - 2);
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
  ctx.moveTo(r, 0);
  ctx.lineTo(r * 0.25, r * 0.5);
  ctx.lineTo(-r * 0.55, r * 0.52);
  ctx.lineTo(-r * 0.92, r * 0.42);
  ctx.lineTo(-r * 0.5, 0);
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
  addScore(saucer.elite ? ELITE_SAUCER_POINTS : SAUCER_POINTS);
  addParticles(saucer.x, saucer.y, saucer.elite ? '#ff4d6d' : '#a0c0e0', saucer.elite ? 18 : 10);
  saucers.splice(saucers.indexOf(saucer), 1);
}

function breakAsteroid(asteroid, bulletIndex) {
  addScore(ASTEROID_POINTS[asteroid.size]);
  addParticles(asteroid.x, asteroid.y, '#c9a227', 12);

  const nextSize = asteroid.size === 'large' ? 'medium' : asteroid.size === 'medium' ? 'small' : null;
  if (nextSize) {
    spawnAsteroid(nextSize, asteroid.x, asteroid.y);
    spawnAsteroid(nextSize, asteroid.x + rand(-15, 15), asteroid.y + rand(-15, 15));
  }

  asteroids.splice(asteroids.indexOf(asteroid), 1);
  if (bulletIndex >= 0) bullets.splice(bulletIndex, 1);
}

function addScore(n) {
  score += n;
  document.getElementById('score').textContent = score;
}

const SHIP_ICON_POINTS = '0,-16 8,-4 8.4,8.8 6.7,14.7 0,8 -6.7,14.7 -8.4,8.8 -8,-4';

function renderLives() {
  const container = document.getElementById('lives');
  container.innerHTML = '';
  for (let i = 0; i < lives; i++) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '-20 -20 40 40');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', SHIP_ICON_POINTS);
    poly.setAttribute('fill', 'rgba(124, 252, 0, 0.2)');
    poly.setAttribute('stroke', '#7cfc00');
    poly.setAttribute('stroke-width', '2');
    poly.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(poly);
    container.appendChild(svg);
  }
}

function renderUpgradesHud() {
  const el = document.getElementById('upgradesHud');
  el.innerHTML = '';
  if (mode !== 'campaign') return;
  for (const u of UPGRADES) {
    if (u.id === 'repair') continue;
    const rank = playerUpgrades[u.id] || 0;
    if (rank <= 0) continue;
    const pip = document.createElement('div');
    pip.className = 'pip';
    pip.textContent = `${u.name} ${'I'.repeat(rank)}`;
    el.appendChild(pip);
  }
}

function renderCampaignHud() {
  const showCampaign = mode === 'campaign' && (levelPhase === 'playing' || levelPhase === 'intro' || levelPhase === 'upgrade');
  document.getElementById('levelLabel').classList.toggle('hidden', !showCampaign);
  document.getElementById('asteroidsLeft').classList.toggle('hidden', !showCampaign);
  if (showCampaign) {
    document.getElementById('levelNum').textContent = campaignLevel;
    document.getElementById('levelTotal').textContent = TOTAL_LEVELS;
    document.getElementById('asteroidsLeftNum').textContent = asteroids.length;
  }
}

function hurtPlayer() {
  lives--;
  const container = document.getElementById('lives');
  const last = container.lastElementChild;
  if (last) {
    last.classList.add('lost');
    setTimeout(() => renderLives(), 400);
  } else {
    renderLives();
  }
  player.invincibleUntil = gameTime + 120;
  addParticles(player.x, player.y, '#ff6b6b', 15);
  if (lives <= 0) endGame();
}

function endGame() {
  gameRunning = false;
  levelPhase = 'idle';
  document.getElementById('finalScore').textContent = score;
  const detail = document.getElementById('gameOverDetail');
  if (mode === 'campaign') {
    detail.textContent = `Reached Level ${campaignLevel} of ${TOTAL_LEVELS}`;
    saveProgress({ bestCampaignLevel: Math.max(loadProgress().bestCampaignLevel || 1, campaignLevel) });
  } else {
    const prev = loadProgress().arcadeHighScore || 0;
    if (score > prev) {
      saveProgress({ arcadeHighScore: score });
      detail.textContent = `NEW HIGH SCORE`;
    } else {
      detail.textContent = `Best: ${prev}`;
    }
  }
  document.getElementById('gameOverScreen').classList.remove('hidden');
}

function applyUpgrade(id) {
  if (id === 'repair') {
    if (lives < maxLives) lives = Math.min(lives + 1, maxLives);
    renderLives();
    return;
  }
  playerUpgrades[id] = (playerUpgrades[id] || 0) + 1;
  if (id === 'hullPlating') {
    maxLives++;
    lives = maxLives;
    renderLives();
  }
  if (id === 'speedBoost') {
    player.maxSpeed = player.baseMaxSpeed * (1 + 0.15 * playerUpgrades.speedBoost);
  }
  renderUpgradesHud();
}

function getAvailableUpgrades() {
  return UPGRADES.filter(u => {
    if (u.id === 'repair') return lives < maxLives;
    return (playerUpgrades[u.id] || 0) < u.max;
  });
}

function pickUpgradeChoices() {
  const pool = getAvailableUpgrades();
  const choices = [];
  const work = [...pool];
  while (choices.length < 3 && work.length > 0) {
    const idx = Math.floor(Math.random() * work.length);
    choices.push(work.splice(idx, 1)[0]);
  }
  return choices;
}

function showUpgradeScreen() {
  levelPhase = 'upgrade';
  const choices = pickUpgradeChoices();
  const wrap = document.getElementById('upgradeChoices');
  wrap.innerHTML = '';
  if (choices.length === 0) {
    advanceToNextLevel();
    return;
  }
  for (const u of choices) {
    const card = document.createElement('button');
    card.className = 'upgrade-card';
    const rank = playerUpgrades[u.id] || 0;
    const rankText = u.id === 'repair' ? '' : `Rank ${rank} → ${rank + 1} (max ${u.max})`;
    card.innerHTML = `
      <span class="upgrade-name">${u.name}</span>
      <span class="upgrade-rank">${rankText}</span>
      <span class="upgrade-desc">${u.desc}</span>
    `;
    card.onclick = () => {
      applyUpgrade(u.id);
      document.getElementById('upgradeScreen').classList.add('hidden');
      advanceToNextLevel();
    };
    wrap.appendChild(card);
  }
  document.getElementById('upgradeScreen').classList.remove('hidden');
}

function startLevel(levelNum) {
  campaignLevel = levelNum;
  levelPhase = 'intro';
  levelIntroTimer = 120;
  const cfg = LEVELS[levelNum - 1];
  asteroids = [];
  saucers = [];
  bullets = [];
  enemyBullets = [];
  megaship = null;
  megashipSpawned = false;
  warning = null;
  firstSaucerSpawned = false;
  saucerSpawnCooldown = cfg.saucerEvery;
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  player.speed = 0;
  player.angle = -Math.PI / 2;
  player.invincibleUntil = gameTime + 90;
  document.getElementById('levelIntroTitle').textContent = `LEVEL ${levelNum}`;
  document.getElementById('levelIntroSubtitle').textContent = cfg.subtitle;
  document.getElementById('levelIntroScreen').classList.remove('hidden');
  renderCampaignHud();
}

function beginLevelPlay() {
  const cfg = LEVELS[campaignLevel - 1];
  document.getElementById('levelIntroScreen').classList.add('hidden');
  for (let i = 0; i < cfg.large; i++) spawnAsteroid('large');
  if (cfg.boss) spawnMegaship();
  levelPhase = 'playing';
}

function advanceToNextLevel() {
  if (campaignLevel >= TOTAL_LEVELS) {
    winCampaign();
    return;
  }
  startLevel(campaignLevel + 1);
}

function winCampaign() {
  gameRunning = false;
  levelPhase = 'victory';
  document.getElementById('victoryScore').textContent = score;
  document.getElementById('victoryScreen').classList.remove('hidden');
  const prev = loadProgress();
  saveProgress({
    bestCampaignLevel: TOTAL_LEVELS,
    campaignClears: (prev.campaignClears || 0) + 1,
    campaignBestScore: Math.max(prev.campaignBestScore || 0, score),
  });
}

function checkLevelClear() {
  if (mode !== 'campaign' || levelPhase !== 'playing') return;
  if (asteroids.length > 0) return;
  if (megaship) return;
  levelClearTimer++;
  if (levelClearTimer >= 60) {
    levelClearTimer = 0;
    if (campaignLevel >= TOTAL_LEVELS) {
      winCampaign();
    } else {
      showUpgradeScreen();
    }
  }
}

function fireBullet() {
  if (fireCooldown > 0) return;
  const baseAngle = player.angle;
  const sharp = playerUpgrades.sharpshooter || 0;
  const bulletSpeed = 12 + sharp * 2;
  const bulletLife = 90 + sharp * 25;
  const ms = playerUpgrades.multishot || 0;
  const offsets = [0];
  for (let i = 1; i <= ms; i++) {
    offsets.push(0.13 * i);
    offsets.push(-0.13 * i);
  }
  for (const off of offsets) {
    const a = baseAngle + off;
    bullets.push({
      x: player.x + Math.cos(a) * player.radius,
      y: player.y + Math.sin(a) * player.radius,
      vx: Math.cos(a) * bulletSpeed,
      vy: Math.sin(a) * bulletSpeed,
      life: bulletLife,
    });
  }
  const rf = playerUpgrades.rapidFire || 0;
  fireCooldown = rf > 0 ? Math.max(4, 14 - rf * 3) : 8;
}

function update(dt) {
  if (!gameRunning) return;
  if (levelPhase === 'intro') {
    levelIntroTimer--;
    if (levelIntroTimer <= 0) beginLevelPlay();
    return;
  }
  if (levelPhase === 'upgrade') return;
  gameTime++;
  if (fireCooldown > 0) fireCooldown--;

  // Auto-fire while held (rapid fire upgrade)
  if (keys.fire && (playerUpgrades.rapidFire || 0) > 0 && fireCooldown === 0) {
    fireBullet();
  }

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
    let consumed = false;
    for (let j = asteroids.length - 1; j >= 0; j--) {
      if (hitTestBulletAsteroid(b, asteroids[j])) {
        breakAsteroid(asteroids[j], i);
        consumed = true;
        break;
      }
    }
    if (consumed) continue;
    for (let j = saucers.length - 1; j >= 0; j--) {
      if (hitTestBulletSaucer(b, saucers[j])) {
        breakSaucer(saucers[j], i);
        consumed = true;
        break;
      }
    }
    if (consumed) continue;
    if (megaship) {
      const mdx = b.x - megaship.x;
      const mdy = b.y - megaship.y;
      if (mdx * mdx + mdy * mdy < (MEGASHIP_RADIUS + 5) * (MEGASHIP_RADIUS + 5)) {
        megaship.hp--;
        bullets.splice(i, 1);
        addParticles(b.x, b.y, '#ff6600', 5);
        if (megaship.hp <= 0) {
          addScore(MEGASHIP_POINTS);
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
    // In campaign boss fight, keep boss on screen by reversing when near edges
    if (megaship.boss) {
      if (megaship.x < MEGASHIP_RADIUS + 20) megaship.vx = Math.abs(megaship.vx);
      if (megaship.x > canvas.width - MEGASHIP_RADIUS - 20) megaship.vx = -Math.abs(megaship.vx);
    }
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
    if (!megaship.boss && (megaship.x < -MEGASHIP_RADIUS * 3 || megaship.x > canvas.width + MEGASHIP_RADIUS * 3)) {
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

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.03;
    if (p.life <= 0) particles.splice(i, 1);
  }

  renderCampaignHud();
  checkLevelClear();
}

function draw() {
  ctx.fillStyle = '#050508';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

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
    ctx.fillStyle = '#ff6600';
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

function resetCommon() {
  score = 0;
  gameTime = 0;
  maxLives = 3;
  lives = 3;
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  player.angle = -Math.PI / 2;
  player.speed = 0;
  player.maxSpeed = player.baseMaxSpeed;
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
  fireCooldown = 0;
  document.getElementById('score').textContent = '0';
  for (const k of Object.keys(playerUpgrades)) playerUpgrades[k] = 0;
  renderUpgradesHud();
  renderLives();
  generateStars();
}

function startArcade() {
  mode = 'arcade';
  hideAllScreens();
  resetCommon();
  levelPhase = 'idle';
  renderCampaignHud();
  gameRunning = true;
}

function startCampaign() {
  mode = 'campaign';
  hideAllScreens();
  resetCommon();
  gameRunning = true;
  startLevel(1);
}

function hideAllScreens() {
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('gameOverScreen').classList.add('hidden');
  document.getElementById('upgradeScreen').classList.add('hidden');
  document.getElementById('victoryScreen').classList.add('hidden');
  document.getElementById('levelIntroScreen').classList.add('hidden');
}

function showMainMenu() {
  hideAllScreens();
  gameRunning = false;
  levelPhase = 'idle';
  renderCampaignHud();
  refreshMenuStats();
  document.getElementById('startScreen').classList.remove('hidden');
}

function refreshMenuStats() {
  const p = loadProgress();
  const a = document.getElementById('arcadeBest');
  a.textContent = p.arcadeHighScore ? `Best: ${p.arcadeHighScore}` : '';
  const c = document.getElementById('campaignBest');
  if (p.campaignClears) {
    c.textContent = `Cleared × ${p.campaignClears} · Best score ${p.campaignBestScore || 0}`;
  } else if (p.bestCampaignLevel) {
    c.textContent = `Best: Level ${p.bestCampaignLevel}`;
  } else {
    c.textContent = '';
  }
}

document.getElementById('arcadeBtn').onclick = startArcade;
document.getElementById('campaignBtn').onclick = startCampaign;
document.getElementById('restartBtn').onclick = () => {
  if (mode === 'campaign') startCampaign();
  else startArcade();
};
document.getElementById('menuBtn').onclick = showMainMenu;
document.getElementById('victoryBtn').onclick = showMainMenu;

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = true;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = true;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'Space') {
    e.preventDefault();
    keys.fire = true;
    if (!e.repeat && gameRunning && levelPhase !== 'intro' && levelPhase !== 'upgrade') {
      fireBullet();
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

refreshMenuStats();
generateStars();
renderLives();
gameLoop();
