(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const ui = {
    score: document.getElementById('score'),
    combo: document.getElementById('combo'),
    dangerFill: document.getElementById('dangerFill'),
    runnerIcon: document.getElementById('runnerIcon'),
    dangerText: document.getElementById('dangerText'),
    startPanel: document.getElementById('startPanel'),
    gameOverPanel: document.getElementById('gameOverPanel'),
    resultText: document.getElementById('resultText'),
    startBtn: document.getElementById('startBtn'),
    retryBtn: document.getElementById('retryBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    jumpBtn: document.getElementById('jumpBtn'),
    slideBtn: document.getElementById('slideBtn'),
  };

  const GAME = {
    width: 1280,
    height: 720,
    groundY: 575,
    playerX: 500,
    baseSpeed: 400,
    maxSpeed: 1080,
    gravity: 2300,
    jumpPower: -845,
    slideTime: 0.58,
    startThreat: 27,
    catchThreat: 100,
    recoverOnPass: 4.9,
    threatGainPerSecond: 1.9,
    minSpawnGap: 0.62,
    speedRamp: 8.8,
    speedStageTime: 18,
    speedStageBonus: 34,
  };

  const OBSTACLES = [
    { name: 'bed', kind: 'jump', w: 148, h: 66, hitW: 118, hitH: 44, unlock: 0, weight: 4 },
    { name: 'wheelchair', kind: 'jump', w: 96, h: 94, hitW: 68, hitH: 64, unlock: 6, weight: 4 },
    { name: 'cone', kind: 'jump', w: 70, h: 92, hitW: 48, hitH: 70, unlock: 0, weight: 3 },
    { name: 'curtain', kind: 'slide', w: 160, h: 78, hitW: 130, hitH: 42, yOffset: -126, unlock: 12, weight: 3 },
    { name: 'pipe', kind: 'slide', w: 170, h: 72, hitW: 132, hitH: 38, yOffset: -118, unlock: 18, weight: 3 },
    { name: 'hole', kind: 'hole', w: 150, h: 30, hitW: 114, hitH: 34, unlock: 16, weight: 2 },
  ];

  const ENEMY_SPRITE = {
    primarySrc: 'assets/images/enemy/enemy_run.png',
    fallbackSrc: 'assets/images/enemy/enemy_sheet.png',
    frames: 4,
    fps: 10,
    drawWidth: 166,
    drawHeight: 222,
    farX: -82,
    nearX: 360,
    minScale: 0.96,
    maxScale: 1.08,
  };

  const PLAYER_SPRITES = {
    run: {
      src: 'assets/images/player/player_run.png',
      frames: 4,
      fps: 12,
      drawHeight: 138,
      yOffset: 0,
    },
    jump: {
      src: 'assets/images/player/player_jump.png',
      frames: 4,
      fps: 10,
      drawHeight: 138,
      yOffset: 0,
    },
    slide: {
      src: 'assets/images/player/player_slide.png',
      frames: 4,
      fps: 12,
      drawHeight: 94,
      yOffset: 0,
    },
  };

  const state = {
    mode: 'ready',
    lastTime: 0,
    time: 0,
    speed: GAME.baseSpeed,
    score: 0,
    combo: 0,
    bestCombo: 0,
    threat: GAME.startThreat,
    shake: 0,
    redFlash: 0,
    caughtTimer: 0,
    spawnTimer: 0.9,
    difficultyLevel: 0,
    lastKind: '',
    lastObstacleX: 0,
    flicker: 0,
    bg: [0, 0, 0, 0],
    obstacles: [],
    particles: [],
    messages: [],
  };

  const player = {
    x: GAME.playerX,
    y: GAME.groundY,
    w: 56,
    h: 118,
    vy: 0,
    grounded: true,
    sliding: false,
    slideTimer: 0,
    hurtTimer: 0,
    runStep: 0,
    sprites: createSpriteSet(PLAYER_SPRITES),
  };

  const enemy = {
    x: 96,
    y: GAME.groundY,
    step: 0,
    image: new Image(),
    frameW: 0,
    frameH: 0,
    ready: false,
    triedFallback: false,
  };

  enemy.image.onload = () => {
    enemy.frameW = enemy.image.width / ENEMY_SPRITE.frames;
    enemy.frameH = enemy.image.height;
    enemy.ready = true;
  };

  enemy.image.onerror = () => {
    if (!enemy.triedFallback) {
      enemy.triedFallback = true;
      enemy.image.src = ENEMY_SPRITE.fallbackSrc;
    }
  };

  enemy.image.src = ENEMY_SPRITE.primarySrc;

  function createSpriteSet(definitions) {
    const sprites = {};
    for (const [name, definition] of Object.entries(definitions)) {
      const image = new Image();
      sprites[name] = {
        ...definition,
        image,
        ready: false,
        frameW: 0,
        frameH: 0,
        trims: [],
      };

      image.onload = () => {
        const frames = definition.frames || inferHorizontalFrames(image.width, image.height);
        sprites[name].frames = frames;
        sprites[name].frameW = image.width / frames;
        sprites[name].frameH = image.height;
        sprites[name].trims = computeSpriteTrims(image, frames);
        sprites[name].ready = true;
      };
      image.onerror = () => {
        sprites[name].ready = false;
      };
      image.src = definition.src;
    }
    return sprites;
  }

  function inferHorizontalFrames(width, height) {
    const ratio = width / height;
    if (ratio >= 3.5) return 4;
    if (ratio >= 2.5) return 3;
    if (ratio >= 1.5) return 2;
    return 1;
  }

  function computeSpriteTrims(image, frames) {
    const frameW = image.width / frames;
    const frameH = image.height;
    const scratch = document.createElement('canvas');
    const scratchCtx = scratch.getContext('2d', { willReadFrequently: true });
    scratch.width = image.width;
    scratch.height = image.height;
    scratchCtx.drawImage(image, 0, 0);

    const trims = [];
    for (let frame = 0; frame < frames; frame += 1) {
      const sx = Math.floor(frame * frameW);
      const w = Math.floor(frameW);
      const data = scratchCtx.getImageData(sx, 0, w, frameH).data;
      let minX = w;
      let minY = frameH;
      let maxX = -1;
      let maxY = -1;

      for (let y = 0; y < frameH; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const alpha = data[(y * w + x) * 4 + 3];
          if (alpha > 3) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (maxX < minX || maxY < minY) {
        trims.push({ sx, sy: 0, sw: w, sh: frameH });
      } else {
        const pad = 24;
        const startX = Math.max(0, minX - pad);
        const startY = Math.max(0, minY - pad);
        const endX = Math.min(w, maxX + 1 + pad);
        const endY = Math.min(frameH, maxY + 1 + pad);
        trims.push({
          sx: sx + startX,
          sy: startY,
          sw: endX - startX,
          sh: endY - startY,
        });
      }
    }
    return trims;
  }

  function resetGame() {
    state.mode = 'playing';
    state.lastTime = performance.now();
    state.time = 0;
    state.speed = GAME.baseSpeed;
    state.score = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.threat = GAME.startThreat;
    state.shake = 0;
    state.redFlash = 0;
    state.caughtTimer = 0;
    state.spawnTimer = 1.0;
    state.difficultyLevel = 0;
    state.lastKind = '';
    state.lastObstacleX = GAME.width;
    state.flicker = 0;
    state.bg = [0, 0, 0, 0];
    state.obstacles = [];
    state.particles = [];
    state.messages = [];

    player.y = GAME.groundY;
    player.vy = 0;
    player.grounded = true;
    player.sliding = false;
    player.slideTimer = 0;
    player.hurtTimer = 0;
    player.runStep = 0;

    ui.startPanel.classList.add('hidden');
    ui.gameOverPanel.classList.add('hidden');
    ui.pauseBtn.textContent = 'II';
    updateHud();
  }

  function gameOver() {
    if (state.mode === 'gameover') return;
    state.mode = 'gameover';
    state.caughtTimer = 1;
    state.redFlash = 1;
    state.shake = 1.5;
    ui.resultText.textContent = `SCORE ${Math.floor(state.score)} / BEST COMBO ${state.bestCombo}`;
    ui.gameOverPanel.classList.remove('hidden');
  }

  function togglePause() {
    if (state.mode === 'playing') {
      state.mode = 'paused';
      ui.pauseBtn.textContent = '>';
    } else if (state.mode === 'paused') {
      state.mode = 'playing';
      state.lastTime = performance.now();
      ui.pauseBtn.textContent = 'II';
    }
  }

  function jump() {
    if (state.mode !== 'playing') return;
    if (player.grounded && !player.sliding) {
      player.vy = GAME.jumpPower;
      player.grounded = false;
      addDust(player.x - 12, player.y, 9);
    }
  }

  function slide() {
    if (state.mode !== 'playing') return;
    if (player.grounded && !player.sliding) {
      player.sliding = true;
      player.slideTimer = GAME.slideTime;
      addDust(player.x - 10, player.y, 10);
    }
  }

  function weightedObstacle() {
    const available = OBSTACLES.filter((item) => item.unlock <= state.time);
    const filtered = available.filter((item) => {
      if (state.time < 20 && item.kind === 'hole' && state.lastKind === 'slide') return false;
      if (item.kind === 'hole' && state.lastKind === 'hole') return false;
      if (item.kind === 'slide' && state.lastKind === 'slide' && state.time < 30) return false;
      return true;
    });
    const pool = filtered.length ? filtered : available;
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * total;
    for (const item of pool) {
      roll -= item.weight;
      if (roll <= 0) return item;
    }
    return pool[0];
  }

  function spawnObstacle() {
    const type = weightedObstacle();
    const x = Math.max(GAME.width + 90 + Math.random() * 130, state.lastObstacleX + 280);
    const y = GAME.groundY + (type.yOffset || 0);
    state.obstacles.push({ ...type, x, y, passed: false, hit: false });
    state.lastKind = type.kind;
    state.lastObstacleX = x;
  }

  function addDust(x, y, count, color = '170, 170, 170') {
    for (let i = 0; i < count; i += 1) {
      state.particles.push({
        x,
        y: y - Math.random() * 20,
        vx: -80 - Math.random() * 190,
        vy: -40 - Math.random() * 90,
        life: 0.35 + Math.random() * 0.36,
        maxLife: 0.72,
        size: 3 + Math.random() * 8,
        color,
      });
    }
  }

  function addMessage(text, x, y, color = '#fff') {
    state.messages.push({ text, x, y, color, life: 0.82 });
  }

  function playerBox() {
    if (player.sliding) {
      return { x: player.x - 40, y: player.y - 48, w: 88, h: 38 };
    }
    return { x: player.x - 22, y: player.y - player.h + 8, w: 44, h: player.h - 14 };
  }

  function obstacleBox(obstacle) {
    if (obstacle.kind === 'hole') {
      return {
        x: obstacle.x - obstacle.hitW / 2,
        y: GAME.groundY - 12,
        w: obstacle.hitW,
        h: obstacle.hitH,
      };
    }
    return {
      x: obstacle.x - obstacle.hitW / 2,
      y: obstacle.y - obstacle.hitH,
      w: obstacle.hitW,
      h: obstacle.hitH,
    };
  }

  function intersects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function update(dt) {
    if (state.mode === 'gameover') {
      state.caughtTimer = Math.max(0, state.caughtTimer - dt);
      state.redFlash = Math.max(0, state.redFlash - dt * 1.6);
      state.shake = Math.max(0, state.shake - dt * 2.1);
      return;
    }
    if (state.mode !== 'playing') return;

    state.time += dt;
    const nextLevel = Math.floor(state.time / GAME.speedStageTime);
    if (nextLevel > state.difficultyLevel) {
      state.difficultyLevel = nextLevel;
      state.redFlash = Math.max(state.redFlash, 0.28);
      addMessage('SPEED UP', GAME.width / 2, 214, '#ffeded');
    }

    state.speed = calculateSpeed();
    state.score += dt * (38 + state.speed * 0.09 + state.combo * 1.1);
    state.threat += dt * (GAME.threatGainPerSecond + state.time * 0.02 + state.difficultyLevel * 0.08);
    state.shake = Math.max(0, state.shake - dt * 2.6);
    state.redFlash = Math.max(0, state.redFlash - dt * 2.0);
    state.flicker += dt;

    const dangerClose = state.threat > 76;
    if (dangerClose) state.shake = Math.max(state.shake, 0.22 + (state.threat - 76) / 95);

    state.bg[0] = (state.bg[0] + state.speed * 0.11 * dt) % GAME.width;
    state.bg[1] = (state.bg[1] + state.speed * 0.28 * dt) % GAME.width;
    state.bg[2] = (state.bg[2] + state.speed * 0.56 * dt) % GAME.width;
    state.bg[3] = (state.bg[3] + state.speed * 0.92 * dt) % GAME.width;

    updatePlayer(dt);
    updateObstacles(dt);
    updateEffects(dt);

    if (state.threat >= GAME.catchThreat) gameOver();
    updateHud();
  }

  function calculateSpeed() {
    const smoothRamp = state.time * GAME.speedRamp;
    const stageRamp = state.difficultyLevel * GAME.speedStageBonus;
    const lateRamp = Math.max(0, state.time - 45) * 3.2;
    return Math.min(GAME.maxSpeed, GAME.baseSpeed + smoothRamp + stageRamp + lateRamp);
  }

  function updatePlayer(dt) {
    player.hurtTimer = Math.max(0, player.hurtTimer - dt);
    player.runStep += dt * (10 + state.speed / 90);
    player.vy += GAME.gravity * dt;
    player.y += player.vy * dt;

    if (player.y >= GAME.groundY) {
      if (!player.grounded && player.vy > 420) addDust(player.x - 12, GAME.groundY, 7);
      player.y = GAME.groundY;
      player.vy = 0;
      player.grounded = true;
    }

    if (player.sliding) {
      player.slideTimer -= dt;
      if (player.slideTimer <= 0) player.sliding = false;
    }
  }

  function updateObstacles(dt) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnObstacle();
      const difficulty = Math.min(1, state.time / 85);
      const levelComp = Math.min(0.2, state.difficultyLevel * 0.025);
      const baseGap = 1.42 - difficulty * 0.5 - levelComp;
      const speedComp = Math.max(0, (state.speed - GAME.baseSpeed) / 1300);
      const randomGap = 0.66 - difficulty * 0.25;
      state.spawnTimer = Math.max(GAME.minSpawnGap, baseGap - speedComp) + Math.random() * randomGap;
    }

    const pBox = playerBox();
    for (const obstacle of state.obstacles) {
      obstacle.x -= state.speed * dt;

      if (!obstacle.passed && obstacle.x < player.x - 58) {
        obstacle.passed = true;
        state.combo += 1;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        state.score += 180 + state.combo * 16;
        state.threat = Math.max(8, state.threat - GAME.recoverOnPass - Math.min(3, state.combo * 0.12));
        addMessage(`+${180 + state.combo * 16}`, player.x + 12, player.y - 150, '#f4f4f4');
      }

      if (!obstacle.hit && obstacleHitsPlayer(obstacle, pBox)) {
        obstacle.hit = true;
        state.combo = 0;
        state.threat += obstacle.kind === 'slide' ? 18 : obstacle.kind === 'hole' ? 22 : 15;
        state.shake = 1;
        state.redFlash = 0.82;
        player.hurtTimer = 0.38;
        addDust(player.x + 22, player.y - 20, 18, '155, 30, 30');
        addMessage('MISS', player.x + 20, player.y - 150, '#ff3b3b');
      }
    }

    state.obstacles = state.obstacles.filter((obstacle) => obstacle.x > -220);
    state.lastObstacleX = Math.max(0, state.lastObstacleX - state.speed * dt);
  }

  function obstacleHitsPlayer(obstacle, pBox) {
    if (obstacle.kind === 'hole') {
      const overHole = player.x + 18 > obstacle.x - obstacle.hitW / 2 && player.x - 18 < obstacle.x + obstacle.hitW / 2;
      return overHole && player.y >= GAME.groundY - 4;
    }
    return intersects(pBox, obstacleBox(obstacle));
  }

  function updateEffects(dt) {
    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      p.life -= dt;
    }
    state.particles = state.particles.filter((p) => p.life > 0);

    for (const message of state.messages) {
      message.y -= 48 * dt;
      message.life -= dt;
    }
    state.messages = state.messages.filter((message) => message.life > 0);
  }

  function updateHud() {
    const threat = Math.max(0, Math.min(100, state.threat));
    ui.score.textContent = Math.floor(state.score).toString();
    ui.combo.textContent = state.combo.toString();
    ui.dangerFill.style.width = `${threat}%`;
    ui.runnerIcon.style.left = `${threat}%`;

    if (threat > 82) {
      ui.dangerText.textContent = 'DANGER';
    } else if (threat > 62) {
      ui.dangerText.textContent = 'SHE IS CLOSE';
    } else {
      ui.dangerText.textContent = 'KEEP RUNNING';
    }
  }

  function draw() {
    ctx.save();
    ctx.clearRect(0, 0, GAME.width, GAME.height);

    if (state.shake > 0) {
      const s = state.shake * 9;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    drawBackground();
    drawEnemy();
    drawObstacles();
    drawPlayer();
    drawParticles();
    drawMessages();
    drawOverlays();

    if (state.mode === 'paused') drawPause();
    ctx.restore();
  }

  function drawBackground() {
    const wall = ctx.createLinearGradient(0, 0, 0, GAME.height);
    wall.addColorStop(0, '#050506');
    wall.addColorStop(0.38, '#131416');
    wall.addColorStop(1, '#050505');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, GAME.width, GAME.height);

    drawFarCorridor(-state.bg[0]);
    drawFarCorridor(GAME.width - state.bg[0]);
    drawWardWalls(-state.bg[1]);
    drawWardWalls(GAME.width - state.bg[1]);
    drawFloor();
    drawForegroundShadows(-state.bg[3]);
    drawForegroundShadows(GAME.width - state.bg[3]);
  }

  function drawFarCorridor(offset) {
    ctx.save();
    ctx.translate(offset, 0);
    ctx.fillStyle = '#0b0c0d';
    ctx.fillRect(0, 105, GAME.width, 470);

    for (let i = 0; i < 7; i += 1) {
      const x = i * 210 + 26;
      ctx.fillStyle = '#070708';
      ctx.fillRect(x, 188, 80, 245);
      ctx.fillStyle = 'rgba(210, 225, 230, 0.08)';
      ctx.fillRect(x + 8, 202, 24, 112);
      ctx.fillStyle = '#202225';
      ctx.fillRect(x + 84, 188, 7, 245);
    }

    for (let i = 0; i < 6; i += 1) {
      const x = i * 238 + 96;
      const blink = Math.sin(state.time * 18 + i * 2.3) > 0.72 ? 0.05 : 0.18;
      ctx.fillStyle = `rgba(225, 236, 210, ${blink})`;
      ctx.fillRect(x, 88, 74, 16);
      ctx.fillStyle = `rgba(225, 236, 210, ${blink * 0.24})`;
      ctx.fillRect(x - 82, 112, 238, 34);
    }

    ctx.fillStyle = 'rgba(122, 8, 8, 0.34)';
    ctx.fillRect(756, 351, 28, 94);
    ctx.fillRect(785, 398, 14, 48);
    ctx.font = '34px Impact';
    ctx.fillStyle = 'rgba(130, 22, 22, 0.32)';
    ctx.fillText("DON'T LOOK BACK", 880, 318);
    ctx.restore();
  }

  function drawWardWalls(offset) {
    ctx.save();
    ctx.translate(offset, 0);
    for (let i = 0; i < 9; i += 1) {
      const x = i * 165 + 16;
      ctx.fillStyle = 'rgba(82, 86, 86, 0.34)';
      ctx.fillRect(x, 244 + (i % 2) * 32, 106, 18);
      ctx.fillRect(x, 274 + (i % 2) * 32, 72, 13);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(x + 8, 305 + (i % 2) * 28, 125, 5);
    }
    ctx.restore();
  }

  function drawFloor() {
    ctx.fillStyle = '#202123';
    ctx.fillRect(0, GAME.groundY, GAME.width, GAME.height - GAME.groundY);

    for (let i = -1; i < 12; i += 1) {
      const x = i * 138 - (state.bg[3] % 138);
      ctx.fillStyle = i % 2 === 0 ? '#292a2c' : '#1b1c1e';
      ctx.beginPath();
      ctx.moveTo(x, GAME.groundY);
      ctx.lineTo(x + 126, GAME.groundY);
      ctx.lineTo(x + 184, GAME.height);
      ctx.lineTo(x - 26, GAME.height);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(235, 242, 240, 0.1)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, GAME.groundY);
    ctx.lineTo(GAME.width, GAME.groundY);
    ctx.stroke();
  }

  function drawForegroundShadows(offset) {
    ctx.save();
    ctx.translate(offset, 0);
    for (let i = 0; i < 5; i += 1) {
      const x = i * 310 + 70;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.beginPath();
      ctx.ellipse(x, GAME.groundY + 45, 82, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemy() {
    const close = Math.min(1, state.threat / 100);
    enemy.step += 0.08 + close * 0.05;
    enemy.x = ENEMY_SPRITE.farX +
      (ENEMY_SPRITE.nearX - ENEMY_SPRITE.farX) * close +
      Math.sin(enemy.step * 2) * (4 + close * 5);
    const scale = ENEMY_SPRITE.minScale +
      (ENEMY_SPRITE.maxScale - ENEMY_SPRITE.minScale) * close +
      state.caughtTimer * 0.16;

    ctx.save();
    ctx.translate(enemy.x, enemy.y + 3);
    ctx.scale(scale, scale);

    if (enemy.ready) {
      const frame = Math.floor(state.time * ENEMY_SPRITE.fps) % ENEMY_SPRITE.frames;
      const drawH = ENEMY_SPRITE.drawHeight;
      const drawW = drawH * (enemy.frameW / enemy.frameH);
      const sx = frame * enemy.frameW;

      ctx.shadowColor = `rgba(220, 0, 0, ${0.28 + close * 0.55})`;
      ctx.shadowBlur = 18 + close * 26;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.ellipse(2, 2, drawW * 0.42, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.drawImage(
        enemy.image,
        sx,
        0,
        enemy.frameW,
        enemy.frameH,
        -drawW * 0.46,
        -drawH,
        drawW,
        drawH,
      );
      ctx.restore();
      return;
    }

    const run = Math.sin(enemy.step);
    ctx.shadowColor = `rgba(220, 0, 0, ${0.28 + close * 0.55})`;
    ctx.shadowBlur = 18 + close * 26;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.ellipse(4, 2, 78, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#e8ddd8';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(-16, -27);
    ctx.lineTo(-50, 0 + run * 16);
    ctx.moveTo(18, -27);
    ctx.lineTo(53, -2 - run * 16);
    ctx.moveTo(-23, -86);
    ctx.lineTo(-62, -56 - run * 8);
    ctx.moveTo(20, -84);
    ctx.lineTo(74, -65 + run * 8);
    ctx.stroke();

    ctx.save();
    ctx.translate(82, -66 + run * 8);
    ctx.rotate(-0.18);
    ctx.fillStyle = '#d8d8d8';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(84, -20);
    ctx.lineTo(19, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4a1515';
    ctx.fillRect(-23, -6, 25, 12);
    ctx.restore();

    ctx.fillStyle = '#8e0f19';
    ctx.beginPath();
    ctx.moveTo(-24, -107);
    ctx.lineTo(23, -107);
    ctx.lineTo(49, -18);
    ctx.lineTo(-48, -18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(160, 12, 18, 0.6)';
    ctx.fillRect(-15, -101, 10, 70);

    ctx.fillStyle = '#080808';
    ctx.beginPath();
    ctx.ellipse(-3, -129, 42, 58, 0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#eee6df';
    ctx.beginPath();
    ctx.ellipse(0, -139, 23, 31, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#101010';
    ctx.beginPath();
    ctx.arc(-8, -143, 4, 0, Math.PI * 2);
    ctx.arc(9, -143, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#691010';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-12, -126);
    ctx.quadraticCurveTo(0, -119, 15, -128);
    ctx.stroke();

    ctx.restore();
  }

  function drawPlayer() {
    if (drawPlayerSprite()) return;

    ctx.save();
    ctx.translate(player.x, player.y);
    if (player.hurtTimer > 0) ctx.translate(Math.sin(state.time * 80) * 4, 0);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#2e8f9d';
    ctx.strokeStyle = '#e4f4f8';

    if (player.sliding) {
      ctx.rotate(-0.08);
      ctx.fillRect(-46, -49, 90, 34);
      ctx.strokeStyle = '#e8f6fb';
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(-28, -18);
      ctx.lineTo(-63, -10);
      ctx.moveTo(24, -19);
      ctx.lineTo(67, -12);
      ctx.stroke();
      ctx.fillStyle = '#ead5c5';
      ctx.beginPath();
      ctx.arc(45, -55, 18, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const run = Math.sin(player.runStep);
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.moveTo(-7, -54);
      ctx.lineTo(-36, -17 + run * 11);
      ctx.moveTo(9, -51);
      ctx.lineTo(38, -22 - run * 11);
      ctx.moveTo(-5, -8);
      ctx.lineTo(-31, -1 - run * 15);
      ctx.moveTo(12, -8);
      ctx.lineTo(37, -2 + run * 15);
      ctx.stroke();

      ctx.fillStyle = player.hurtTimer > 0 ? '#8fb9c2' : '#2e8f9d';
      ctx.fillRect(-28, -88, 56, 72);
      ctx.fillStyle = '#ead5c5';
      ctx.beginPath();
      ctx.arc(6, -112, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#121314';
      ctx.fillRect(-11, -132, 31, 18);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(13, -76, 18, 24);
    }
    ctx.restore();
  }

  function drawPlayerSprite() {
    const pose = player.sliding ? 'slide' : player.grounded ? 'run' : 'jump';
    const sprite = player.sprites[pose];
    if (!sprite || !sprite.ready) return false;

    const frame = sprite.frames > 1
      ? Math.floor(state.time * sprite.fps) % sprite.frames
      : 0;
    const trim = sprite.trims[frame] || {
      sx: frame * sprite.frameW,
      sy: 0,
      sw: sprite.frameW,
      sh: sprite.frameH,
    };
    const drawH = sprite.drawHeight;
    const drawW = drawH * (trim.sw / trim.sh);
    const hurtOffset = player.hurtTimer > 0 ? Math.sin(state.time * 80) * 4 : 0;

    ctx.save();
    ctx.translate(player.x + hurtOffset, player.y + sprite.yOffset);
    ctx.shadowColor = 'rgba(120, 230, 245, 0.18)';
    ctx.shadowBlur = player.hurtTimer > 0 ? 16 : 7;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
    ctx.beginPath();
    ctx.ellipse(0, 2, Math.max(36, drawW * 0.34), player.sliding ? 12 : 16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.drawImage(
      sprite.image,
      trim.sx,
      trim.sy,
      trim.sw,
      trim.sh,
      -drawW * 0.5,
      -drawH,
      drawW,
      drawH,
    );
    ctx.restore();
    return true;
  }

  function drawObstacles() {
    for (const obstacle of state.obstacles) {
      ctx.save();
      ctx.translate(obstacle.x, obstacle.y);
      ctx.globalAlpha = obstacle.hit ? 0.55 : 1;
      if (obstacle.name === 'bed') drawBed();
      if (obstacle.name === 'wheelchair') drawWheelchair();
      if (obstacle.name === 'cone') drawCone();
      if (obstacle.name === 'curtain') drawCurtain();
      if (obstacle.name === 'pipe') drawPipe();
      if (obstacle.name === 'hole') drawHole(obstacle.w);
      ctx.restore();
    }
  }

  function drawBed() {
    ctx.strokeStyle = '#a8a8a8';
    ctx.lineWidth = 5;
    ctx.fillStyle = '#3b3f42';
    ctx.fillRect(-72, -63, 144, 37);
    ctx.strokeRect(-72, -63, 144, 37);
    ctx.fillStyle = '#c8d7d8';
    ctx.fillRect(-62, -76, 56, 16);
    ctx.beginPath();
    ctx.moveTo(-48, -26);
    ctx.lineTo(-70, 0);
    ctx.moveTo(44, -26);
    ctx.lineTo(64, 0);
    ctx.stroke();
    ctx.fillStyle = '#101010';
    ctx.beginPath();
    ctx.arc(-70, 0, 10, 0, Math.PI * 2);
    ctx.arc(64, 0, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWheelchair() {
    ctx.strokeStyle = '#a9adb0';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(-28, -18, 23, 0, Math.PI * 2);
    ctx.arc(30, -12, 16, 0, Math.PI * 2);
    ctx.moveTo(-24, -42);
    ctx.lineTo(25, -58);
    ctx.lineTo(44, -30);
    ctx.moveTo(-4, -56);
    ctx.lineTo(20, -18);
    ctx.moveTo(18, -60);
    ctx.lineTo(42, -72);
    ctx.stroke();
    ctx.fillStyle = '#27292b';
    ctx.fillRect(-22, -68, 48, 18);
  }

  function drawCone() {
    ctx.fillStyle = '#c09023';
    ctx.beginPath();
    ctx.moveTo(0, -91);
    ctx.lineTo(35, -10);
    ctx.lineTo(-35, -10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1f2021';
    ctx.fillRect(-42, -12, 84, 12);
    ctx.fillStyle = 'rgba(30, 30, 30, 0.55)';
    ctx.fillRect(-17, -62, 34, 10);
  }

  function drawCurtain() {
    ctx.fillStyle = '#5d1117';
    ctx.fillRect(-78, -75, 156, 42);
    ctx.fillStyle = 'rgba(230, 230, 230, 0.16)';
    for (let x = -66; x < 72; x += 26) ctx.fillRect(x, -75, 8, 42);
    ctx.strokeStyle = '#9c9c9c';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-84, -84);
    ctx.lineTo(84, -84);
    ctx.stroke();
  }

  function drawPipe() {
    ctx.strokeStyle = '#9c9c9c';
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.moveTo(-82, -38);
    ctx.lineTo(82, -38);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(-84, -56, 168, 8);
  }

  function drawHole(width) {
    ctx.fillStyle = '#050505';
    ctx.beginPath();
    ctx.ellipse(0, 2, width / 2, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160, 160, 160, 0.28)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 1, width / 2, 27, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawParticles() {
    for (const p of state.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = `rgba(${p.color}, ${alpha * 0.46})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMessages() {
    ctx.save();
    ctx.font = '34px Impact';
    ctx.textAlign = 'center';
    for (const message of state.messages) {
      ctx.globalAlpha = Math.max(0, message.life / 0.82);
      ctx.fillStyle = message.color;
      ctx.fillText(message.text, message.x, message.y);
    }
    ctx.restore();
  }

  function drawOverlays() {
    const vignette = ctx.createRadialGradient(
      GAME.width * 0.55,
      GAME.height * 0.48,
      130,
      GAME.width * 0.55,
      GAME.height * 0.48,
      770,
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.58, 'rgba(0, 0, 0, 0.12)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.76)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, GAME.width, GAME.height);

    const close = Math.max(0, (state.threat - 68) / 32);
    const pulse = 0.5 + Math.sin(state.time * 13) * 0.5;
    if (close > 0) {
      ctx.fillStyle = `rgba(170, 0, 0, ${close * (0.12 + pulse * 0.12)})`;
      ctx.fillRect(0, 0, 70, GAME.height);
      ctx.fillRect(GAME.width - 70, 0, 70, GAME.height);
      ctx.font = '78px Impact';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255, 52, 52, ${close * (0.2 + pulse * 0.3)})`;
      ctx.fillText('DANGER', GAME.width / 2, 164);
    }

    if (state.redFlash > 0) {
      ctx.fillStyle = `rgba(150, 0, 0, ${state.redFlash * 0.28})`;
      ctx.fillRect(0, 0, GAME.width, GAME.height);
    }

    if (state.caughtTimer > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${state.caughtTimer * 0.36})`;
      ctx.fillRect(0, 0, GAME.width, GAME.height);
    }
  }

  function drawPause() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
    ctx.fillRect(0, 0, GAME.width, GAME.height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.font = '70px Impact';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', GAME.width / 2, GAME.height / 2);
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - state.lastTime) / 1000 || 0);
    state.lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function bindActionButton(button, action) {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      action();
    });
  }

  function bindInput() {
    ui.startBtn.addEventListener('click', resetGame);
    ui.retryBtn.addEventListener('click', resetGame);
    ui.pauseBtn.addEventListener('click', togglePause);
    bindActionButton(ui.jumpBtn, jump);
    bindActionButton(ui.slideBtn, slide);

    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space' || event.code === 'ArrowUp') {
        event.preventDefault();
        if (state.mode === 'ready' || state.mode === 'gameover') resetGame();
        else jump();
      }
      if (event.code === 'ArrowDown') {
        event.preventDefault();
        slide();
      }
      if (event.code === 'KeyP') {
        event.preventDefault();
        togglePause();
      }
      if (event.code === 'Enter' && state.mode === 'gameover') {
        event.preventDefault();
        resetGame();
      }
    });

    canvas.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (state.mode !== 'playing') return;
      const rect = canvas.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      if (localX > rect.width / 2) jump();
      else slide();
    });

    window.addEventListener('contextmenu', (event) => event.preventDefault());
    window.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
    window.addEventListener('dblclick', (event) => event.preventDefault());
  }

  bindInput();
  updateHud();
  requestAnimationFrame(loop);
})();
