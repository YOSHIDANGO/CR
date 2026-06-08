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
    coyoteTime: 0.09,
    jumpBufferTime: 0.16,
    slideBufferTime: 0.2,
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
    { name: 'shutter', kind: 'slide', w: 168, h: 138, hitW: 132, hitH: 104, yOffset: 0, unlock: 10, weight: 4 },
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
    scale: 1.1,
  };

  const PLAYER_SPRITES = {
    run: {
      src: 'assets/images/player/player_run.png',
      frames: 4,
      fps: 12,
      drawHeight: 222,
      yOffset: 0,
    },
    jump: {
      src: 'assets/images/player/player_jump.png',
      frames: 4,
      fps: 10,
      drawHeight: 222,
      yOffset: 0,
    },
    slide: {
      src: 'assets/images/player/player_slide.png',
      frames: 4,
      fps: 12,
      drawHeight: 158,
      yOffset: 0,
    },
  };

  const BACKGROUND_IMAGES = {
    far: 'assets/images/background/bg_far.png',
    floor: 'assets/images/background/bg_floor.png',
  };

  const ENEMY_ATTACKS = {
    knife: {
      unlockTime: 18,
      interval: 15,
      windup: 0.95,
      cooldown: 3.2,
      speed: 760,
      y: GAME.groundY - 42,
      warningY: GAME.groundY - 42,
      threatOnHit: 26,
    },
    dash: {
      unlockTime: 38,
      interval: 48,
      windup: 1.1,
      duration: 7,
      cooldown: 9,
      threatGain: 4.8,
      obstacleThreatMultiplier: 1.55,
      successRecover: 12,
      scoreBonus: 900,
    },
    grapple: {
      unlockTime: 70,
      minThreat: 76,
      interval: 24,
      windup: 0.75,
      duration: 1.8,
      requiredInputs: 5,
      successRecover: 14,
      failThreat: 32,
      cooldown: 8,
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
    projectiles: [],
    particles: [],
    messages: [],
  };

  const background = createImageSet(BACKGROUND_IMAGES);

  const player = {
    x: GAME.playerX,
    y: GAME.groundY,
    w: 56,
    h: 118,
    vy: 0,
    grounded: true,
    sliding: false,
    airSliding: false,
    slideTimer: 0,
    coyoteTimer: 0,
    jumpBuffer: 0,
    slideBuffer: 0,
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
    attack: {
      type: '',
      phase: 'normal',
      timer: 0,
      cooldown: 0,
      knifeSpawned: false,
      dashStartedThreat: 0,
      grappleInputs: 0,
      nextKnifeTime: ENEMY_ATTACKS.knife.unlockTime,
      nextDashTime: ENEMY_ATTACKS.dash.unlockTime,
      nextGrappleTime: ENEMY_ATTACKS.grapple.unlockTime,
    },
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

  function createImageSet(definitions) {
    const images = {};
    for (const [name, src] of Object.entries(definitions)) {
      const image = new Image();
      images[name] = { image, ready: false, src };
      image.onload = () => {
        images[name].ready = true;
      };
      image.onerror = () => {
        images[name].ready = false;
      };
      image.src = src;
    }
    return images;
  }

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
    enterImmersiveMode();
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
    state.projectiles = [];
    state.particles = [];
    state.messages = [];

    player.y = GAME.groundY;
    player.vy = 0;
    player.grounded = true;
    player.sliding = false;
    player.airSliding = false;
    player.slideTimer = 0;
    player.coyoteTimer = 0;
    player.jumpBuffer = 0;
    player.slideBuffer = 0;
    player.hurtTimer = 0;
    player.runStep = 0;

    enemy.attack.type = '';
    enemy.attack.phase = 'normal';
    enemy.attack.timer = 0;
    enemy.attack.cooldown = 0;
    enemy.attack.knifeSpawned = false;
    enemy.attack.dashStartedThreat = 0;
    enemy.attack.grappleInputs = 0;
    enemy.attack.nextKnifeTime = ENEMY_ATTACKS.knife.unlockTime;
    enemy.attack.nextDashTime = ENEMY_ATTACKS.dash.unlockTime;
    enemy.attack.nextGrappleTime = ENEMY_ATTACKS.grapple.unlockTime;

    ui.startPanel.classList.add('hidden');
    ui.gameOverPanel.classList.add('hidden');
    ui.pauseBtn.textContent = 'II';
    updateHud();
  }

  function enterImmersiveMode() {
    const root = document.documentElement;
    const requestFullscreen =
      root.requestFullscreen ||
      root.webkitRequestFullscreen ||
      root.msRequestFullscreen;

    if (requestFullscreen && !document.fullscreenElement && !document.webkitFullscreenElement) {
      try {
        const result = requestFullscreen.call(root);
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch (error) {
        // Fullscreen/orientation APIs require a user gesture on most mobile browsers.
      }
    }

    if (screen.orientation && typeof screen.orientation.lock === 'function') {
      try {
        const result = screen.orientation.lock('landscape');
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch (error) {
        // Some browsers only allow orientation lock after fullscreen, or not at all.
      }
    }
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
    registerActionInput();
    player.jumpBuffer = GAME.jumpBufferTime;
    tryJump();
  }

  function slide() {
    if (state.mode !== 'playing') return;
    registerActionInput();
    player.slideBuffer = GAME.slideBufferTime;
    trySlide();
  }

  function registerActionInput() {
    if (enemy.attack.type === 'grapple' && enemy.attack.phase === 'active') {
      enemy.attack.grappleInputs += 1;
      state.shake = Math.max(state.shake, 0.26);
      addMessage('TAP', player.x + 18, player.y - 165, '#fff2f2');
    }
  }

  function tryJump() {
    if (player.jumpBuffer <= 0) return false;
    if (player.grounded || player.coyoteTimer > 0 || player.sliding) {
      performJump();
      return true;
    }
    return false;
  }

  function performJump() {
    player.jumpBuffer = 0;
    player.slideBuffer = 0;
    player.sliding = false;
    player.airSliding = false;
    player.slideTimer = 0;
    player.vy = GAME.jumpPower - Math.min(70, Math.max(0, state.speed - GAME.baseSpeed) * 0.08);
    player.grounded = false;
    player.coyoteTimer = 0;
    addDust(player.x - 12, player.y, 10);
  }

  function trySlide() {
    if (player.slideBuffer <= 0) return false;
    if (player.grounded) {
      performGroundSlide();
      return true;
    }
    if (player.vy > -260) {
      player.airSliding = true;
      player.vy = Math.max(player.vy, 360);
    }
    return false;
  }

  function performGroundSlide() {
    player.slideBuffer = 0;
    player.sliding = true;
    player.airSliding = false;
    player.slideTimer = GAME.slideTime;
    addDust(player.x - 10, player.y, 11);
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

  function addDebris(x, y, count) {
    for (let i = 0; i < count; i += 1) {
      state.particles.push({
        type: 'debris',
        x: x + (Math.random() - 0.5) * 80,
        y: y + (Math.random() - 0.5) * 72,
        vx: -180 - Math.random() * 360,
        vy: -220 - Math.random() * 230,
        life: 0.55 + Math.random() * 0.45,
        maxLife: 1,
        size: 7 + Math.random() * 16,
        color: Math.random() > 0.45 ? '120, 126, 128' : '80, 84, 86',
        spin: Math.random() * Math.PI,
        spinSpeed: -8 + Math.random() * 16,
      });
    }
  }

  function addMessage(text, x, y, color = '#fff') {
    state.messages.push({ text, x, y, color, life: 0.82 });
  }

  function playerBox() {
    if (player.sliding || player.airSliding) {
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
    if (obstacle.kind === 'slide') {
      return {
        x: obstacle.x - obstacle.hitW / 2,
        y: 120,
        w: obstacle.hitW,
        h: GAME.groundY - 174,
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

    state.bg[0] = (state.bg[0] + state.speed * 0.22 * dt) % GAME.width;
    state.bg[1] = (state.bg[1] + state.speed * 0.28 * dt) % GAME.width;
    state.bg[2] = (state.bg[2] + state.speed * 0.56 * dt) % GAME.width;
    state.bg[3] = (state.bg[3] + state.speed * 0.92 * dt) % GAME.width;

    updatePlayer(dt);
    updateEnemyAttacks(dt);
    updateObstacles(dt);
    updateProjectiles(dt);
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

  function updateEnemyAttacks(dt) {
    const attack = enemy.attack;
    if (attack.phase === 'cooldown') {
      attack.cooldown = Math.max(0, attack.cooldown - dt);
      if (attack.cooldown <= 0) {
        attack.phase = 'normal';
      }
      return;
    }

    if (attack.phase === 'normal') {
      chooseEnemyAttack();
      return;
    }

    attack.timer -= dt;

    if (attack.type === 'knife') updateKnifeAttack();
    if (attack.type === 'dash') updateDashAttack(dt);
    if (attack.type === 'grapple') updateGrappleAttack();
  }

  function chooseEnemyAttack() {
    const attack = enemy.attack;
    if (attack.cooldown > 0) return;

    if (
      state.time >= attack.nextGrappleTime &&
      state.time >= ENEMY_ATTACKS.grapple.unlockTime &&
      state.threat >= ENEMY_ATTACKS.grapple.minThreat
    ) {
      startEnemyAttack('grapple');
      return;
    }

    if (
      state.time >= attack.nextDashTime &&
      state.time >= ENEMY_ATTACKS.dash.unlockTime &&
      state.difficultyLevel >= 2
    ) {
      startEnemyAttack('dash');
      return;
    }

    if (state.time >= attack.nextKnifeTime && state.time >= ENEMY_ATTACKS.knife.unlockTime) {
      startEnemyAttack('knife');
    }
  }

  function startEnemyAttack(type) {
    const attack = enemy.attack;
    attack.type = type;
    attack.phase = 'windup';
    attack.knifeSpawned = false;
    attack.grappleInputs = 0;

    if (type === 'knife') {
      attack.timer = ENEMY_ATTACKS.knife.windup;
      addMessage('KNIFE', GAME.width / 2, 192, '#ff4b4b');
      state.redFlash = Math.max(state.redFlash, 0.2);
    }

    if (type === 'dash') {
      attack.timer = ENEMY_ATTACKS.dash.windup;
      attack.dashStartedThreat = state.threat;
      addMessage('SHE IS COMING', GAME.width / 2, 192, '#ffeded');
      state.redFlash = Math.max(state.redFlash, 0.35);
      state.shake = Math.max(state.shake, 0.55);
    }

    if (type === 'grapple') {
      attack.timer = ENEMY_ATTACKS.grapple.windup;
      addMessage('SHAKE OFF', GAME.width / 2, 192, '#ffeded');
      state.redFlash = Math.max(state.redFlash, 0.35);
      state.shake = Math.max(state.shake, 0.7);
    }
  }

  function finishEnemyAttack(cooldown) {
    const attack = enemy.attack;
    attack.type = '';
    attack.phase = 'cooldown';
    attack.timer = 0;
    attack.cooldown = cooldown;
    attack.knifeSpawned = false;
    attack.grappleInputs = 0;
  }

  function updateKnifeAttack() {
    const attack = enemy.attack;
    if (attack.phase === 'windup' && attack.timer <= 0) {
      attack.phase = 'active';
      attack.timer = 2.2;
      attack.knifeSpawned = true;
      state.projectiles.push({
        type: 'knife',
        x: Math.max(enemy.x + 88, 80),
        y: ENEMY_ATTACKS.knife.y,
        vx: ENEMY_ATTACKS.knife.speed + state.speed * 0.2,
        w: 82,
        h: 24,
        hit: false,
        spin: -0.15,
      });
    }

    if (attack.phase === 'active' && attack.timer <= 0) {
      enemy.attack.nextKnifeTime = state.time + ENEMY_ATTACKS.knife.interval;
      finishEnemyAttack(ENEMY_ATTACKS.knife.cooldown);
    }
  }

  function updateDashAttack(dt) {
    const attack = enemy.attack;
    if (attack.phase === 'windup' && attack.timer <= 0) {
      attack.phase = 'active';
      attack.timer = ENEMY_ATTACKS.dash.duration;
      addMessage('RUN', GAME.width / 2, 192, '#ffeded');
    }

    if (attack.phase === 'active') {
      state.threat += ENEMY_ATTACKS.dash.threatGain * dt;
      state.shake = Math.max(state.shake, 0.52 + Math.sin(state.time * 18) * 0.08);
      state.redFlash = Math.max(state.redFlash, 0.12);

      if (attack.timer <= 0) {
        state.threat = Math.max(8, state.threat - ENEMY_ATTACKS.dash.successRecover);
        state.score += ENEMY_ATTACKS.dash.scoreBonus;
        addMessage(`ESCAPED +${ENEMY_ATTACKS.dash.scoreBonus}`, player.x + 80, player.y - 165, '#fff2f2');
        attack.nextDashTime = state.time + ENEMY_ATTACKS.dash.interval;
        finishEnemyAttack(ENEMY_ATTACKS.dash.cooldown);
      }
    }
  }

  function updateGrappleAttack() {
    const attack = enemy.attack;
    if (attack.phase === 'windup' && attack.timer <= 0) {
      attack.phase = 'active';
      attack.timer = ENEMY_ATTACKS.grapple.duration;
      attack.grappleInputs = 0;
      addMessage('TAP', GAME.width / 2, 230, '#ffffff');
    }

    if (attack.phase !== 'active') return;

    state.shake = Math.max(state.shake, 0.5);
    if (attack.grappleInputs >= ENEMY_ATTACKS.grapple.requiredInputs) {
      state.threat = Math.max(8, state.threat - ENEMY_ATTACKS.grapple.successRecover);
      state.score += 420;
      addMessage('BROKE FREE', player.x + 35, player.y - 165, '#ffffff');
      attack.nextGrappleTime = state.time + ENEMY_ATTACKS.grapple.interval;
      finishEnemyAttack(ENEMY_ATTACKS.grapple.cooldown);
      return;
    }

    if (attack.timer <= 0) {
      state.threat += ENEMY_ATTACKS.grapple.failThreat;
      state.redFlash = Math.max(state.redFlash, 0.85);
      addMessage('GRABBED', player.x + 35, player.y - 165, '#ff3b3b');
      attack.nextGrappleTime = state.time + ENEMY_ATTACKS.grapple.interval;
      finishEnemyAttack(ENEMY_ATTACKS.grapple.cooldown);
    }
  }

  function updatePlayer(dt) {
    player.hurtTimer = Math.max(0, player.hurtTimer - dt);
    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
    player.slideBuffer = Math.max(0, player.slideBuffer - dt);
    player.coyoteTimer = player.grounded ? GAME.coyoteTime : Math.max(0, player.coyoteTimer - dt);
    player.runStep += dt * (10 + state.speed / 90);
    player.vy += GAME.gravity * (player.airSliding ? 1.22 : 1) * dt;
    player.y += player.vy * dt;

    if (player.y >= GAME.groundY) {
      const landed = !player.grounded;
      if (landed && player.vy > 420) addDust(player.x - 12, GAME.groundY, 7);
      player.y = GAME.groundY;
      player.vy = 0;
      player.grounded = true;
      player.airSliding = false;
      player.coyoteTimer = GAME.coyoteTime;

      if (landed && player.slideBuffer > 0) {
        performGroundSlide();
      } else if (landed && player.jumpBuffer > 0) {
        performJump();
      }
    }

    if (player.sliding || player.airSliding) {
      player.slideTimer -= dt;
      if (player.slideTimer <= 0) player.sliding = false;
    }

    if (!player.grounded) {
      trySlide();
    } else {
      tryJump();
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
        const dashPenalty = enemy.attack.type === 'dash' && enemy.attack.phase === 'active'
          ? ENEMY_ATTACKS.dash.obstacleThreatMultiplier
          : 1;
        state.threat += obstacle.kind === 'slide'
          ? 100
          : (obstacle.kind === 'hole' ? 22 : 15) * dashPenalty;
        state.shake = 1;
        state.redFlash = 0.82;
        player.hurtTimer = 0.38;
        addDust(player.x + 22, player.y - 20, 18, '155, 30, 30');
        addMessage(obstacle.kind === 'slide' ? 'CRASH' : 'MISS', player.x + 20, player.y - 150, '#ff3b3b');
        if (obstacle.kind === 'slide') {
          addDebris(obstacle.x, GAME.groundY - 190, 34);
          gameOver();
          break;
        }
      }

      if (obstacle.kind === 'slide' && !obstacle.broken && obstacle.x < enemy.x + 40) {
        obstacle.broken = true;
        obstacle.hit = true;
        state.shake = Math.max(state.shake, 0.45);
        addDebris(obstacle.x, GAME.groundY - 82, 26);
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

  function updateProjectiles(dt) {
    const pBox = playerBox();
    for (const projectile of state.projectiles) {
      projectile.x += projectile.vx * dt;
      projectile.spin += dt * 9;

      if (!projectile.hit && intersects(pBox, projectileBox(projectile))) {
        projectile.hit = true;
        state.combo = 0;
        state.threat += ENEMY_ATTACKS.knife.threatOnHit;
        state.redFlash = Math.max(state.redFlash, 0.75);
        state.shake = Math.max(state.shake, 0.9);
        player.hurtTimer = 0.38;
        addDust(player.x + 18, player.y - 44, 18, '155, 30, 30');
        addMessage('KNIFE HIT', player.x + 28, player.y - 155, '#ff3b3b');
      }
    }
    state.projectiles = state.projectiles.filter((projectile) => projectile.x < GAME.width + 140 && !projectile.hit);
  }

  function projectileBox(projectile) {
    return {
      x: projectile.x - projectile.w * 0.5,
      y: projectile.y - projectile.h * 0.5,
      w: projectile.w,
      h: projectile.h,
    };
  }

  function updateEffects(dt) {
    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      if (p.type === 'debris') p.spin += p.spinSpeed * dt;
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

    if (enemy.attack.type === 'knife' && enemy.attack.phase === 'windup') {
      ui.dangerText.textContent = 'KNIFE';
    } else if (enemy.attack.type === 'dash') {
      ui.dangerText.textContent = enemy.attack.phase === 'active' ? 'RUN' : 'SHE IS COMING';
    } else if (enemy.attack.type === 'grapple') {
      ui.dangerText.textContent = enemy.attack.phase === 'active' ? 'SHAKE OFF' : 'WATCH OUT';
    } else if (threat > 82) {
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
    drawEnemyAttackWarnings();
    drawObstacles();
    drawProjectiles();
    drawPlayer();
    drawParticles();
    drawMessages();
    drawOverlays();

    if (state.mode === 'paused') drawPause();
    ctx.restore();
  }

  function drawBackground() {
    if (background.far.ready) {
      drawLoopingImage(background.far.image, state.bg[0], 0, 0, GAME.width, GAME.height, 1);

      if (background.floor.ready) {
        const floorSourceY = GAME.groundY - 75;
        drawLoopingImageBand(
          background.floor.image,
          state.bg[3],
          floorSourceY,
          GAME.height - floorSourceY,
          floorSourceY,
          1,
        );
      } else {
        drawFloor();
      }

      drawForegroundShadows(-state.bg[3]);
      drawForegroundShadows(GAME.width - state.bg[3]);
      return;
    }

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

  function drawLoopingImage(image, offset, sx, sy, sw, sh, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const x = -offset % GAME.width;
    ctx.drawImage(image, sx, sy, sw, sh, x, 0, GAME.width, GAME.height);
    ctx.drawImage(image, sx, sy, sw, sh, x + GAME.width, 0, GAME.width, GAME.height);
    if (x > 0) {
      ctx.drawImage(image, sx, sy, sw, sh, x - GAME.width, 0, GAME.width, GAME.height);
    }
    ctx.restore();
  }

  function drawLoopingImageBand(image, offset, sourceY, sourceH, destY, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const x = -offset % GAME.width;
    ctx.drawImage(image, 0, sourceY, image.width, sourceH, x, destY, GAME.width, sourceH);
    ctx.drawImage(image, 0, sourceY, image.width, sourceH, x + GAME.width, destY, GAME.width, sourceH);
    if (x > 0) {
      ctx.drawImage(image, 0, sourceY, image.width, sourceH, x - GAME.width, destY, GAME.width, sourceH);
    }
    ctx.restore();
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
    const dashPush = enemy.attack.type === 'dash' && enemy.attack.phase === 'active'
      ? 74 + Math.sin(state.time * 18) * 12
      : 0;
    const grapplePush = enemy.attack.type === 'grapple'
      ? 38
      : 0;
    enemy.x = ENEMY_SPRITE.farX +
      (ENEMY_SPRITE.nearX - ENEMY_SPRITE.farX) * close +
      Math.sin(enemy.step * 2) * (4 + close * 5) +
      dashPush +
      grapplePush;
    const scale = ENEMY_SPRITE.scale;

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

  function drawEnemyAttackWarnings() {
    const attack = enemy.attack;
    if (attack.phase === 'normal') return;

    ctx.save();
    ctx.textAlign = 'center';

    if (attack.type === 'knife' && attack.phase === 'windup') {
      const pulse = 0.45 + Math.sin(state.time * 18) * 0.25;
      ctx.strokeStyle = `rgba(255, 50, 50, ${pulse})`;
      ctx.lineWidth = 4;
      ctx.setLineDash([18, 12]);
      ctx.beginPath();
      ctx.moveTo(enemy.x + 60, ENEMY_ATTACKS.knife.warningY);
      ctx.lineTo(player.x + 120, ENEMY_ATTACKS.knife.warningY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = `rgba(255, 45, 45, ${0.65 + pulse * 0.3})`;
      ctx.font = '46px Impact';
      ctx.fillText('KNIFE', GAME.width / 2, 176);
    }

    if (attack.type === 'dash') {
      const active = attack.phase === 'active';
      ctx.fillStyle = active ? 'rgba(255, 25, 25, 0.72)' : 'rgba(255, 80, 80, 0.55)';
      ctx.font = active ? '64px Impact' : '52px Impact';
      ctx.fillText(active ? 'RUN' : 'SHE IS COMING', GAME.width / 2, 178);
    }

    if (attack.type === 'grapple') {
      const active = attack.phase === 'active';
      const progress = active
        ? enemy.attack.grappleInputs / ENEMY_ATTACKS.grapple.requiredInputs
        : 0;

      ctx.strokeStyle = 'rgba(232, 222, 216, 0.9)';
      ctx.lineWidth = 13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(enemy.x + 58, GAME.groundY - 86);
      ctx.quadraticCurveTo(enemy.x + 190, GAME.groundY - 150, player.x - 38, player.y - 92);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 58, 58, 0.78)';
      ctx.font = '52px Impact';
      ctx.fillText(active ? 'SHAKE OFF' : 'WATCH OUT', GAME.width / 2, 178);

      if (active) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(GAME.width / 2 - 130, 198, 260, 12);
        ctx.fillStyle = '#ff3b3b';
        ctx.fillRect(GAME.width / 2 - 130, 198, 260 * Math.min(1, progress), 12);
      }
    }

    ctx.restore();
  }

  function drawProjectiles() {
    for (const projectile of state.projectiles) {
      if (projectile.type !== 'knife') continue;
      ctx.save();
      ctx.translate(projectile.x, projectile.y);
      ctx.rotate(projectile.spin);
      ctx.shadowColor = 'rgba(255, 0, 0, 0.55)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#d8d8d8';
      ctx.beginPath();
      ctx.moveTo(-38, -7);
      ctx.lineTo(42, -2);
      ctx.lineTo(-30, 11);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#4a1515';
      ctx.fillRect(-54, -7, 20, 14);
      ctx.restore();
    }
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
    const pose = player.sliding || player.airSliding ? 'slide' : player.grounded ? 'run' : 'jump';
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
      if (obstacle.name === 'shutter') drawShutter(obstacle.broken);
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

  function drawShutter(broken) {
    if (broken) {
      ctx.globalAlpha *= 0.35;
      ctx.fillStyle = '#64696b';
      ctx.fillRect(-74, -430, 32, 138);
      ctx.fillRect(20, -380, 42, 122);
      ctx.fillRect(-36, -250, 58, 74);
      return;
    }

    ctx.fillStyle = '#141618';
    ctx.fillRect(-88, -462, 176, 18);
    ctx.fillStyle = '#777d80';
    ctx.fillRect(-78, -444, 156, 272);

    for (let y = -432; y <= -184; y += 16) {
      ctx.fillStyle = y % 32 === 0 ? '#8f9698' : '#5d6366';
      ctx.fillRect(-78, y, 156, 9);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(-78, y + 9, 156, 4);
    }

    ctx.fillStyle = 'rgba(180, 12, 12, 0.48)';
    ctx.fillRect(-68, -242, 38, 8);
    ctx.fillRect(-31, -238, 16, 6);
    ctx.strokeStyle = '#9ca3a6';
    ctx.lineWidth = 5;
    ctx.strokeRect(-80, -446, 160, 276);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.fillRect(-84, -171, 168, 171);
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
      if (p.type === 'debris') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.fillRect(-p.size * 0.5, -p.size * 0.22, p.size, p.size * 0.44);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
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

    if (enemy.attack.phase !== 'normal') {
      const activeDash = enemy.attack.type === 'dash' && enemy.attack.phase === 'active';
      const activeGrapple = enemy.attack.type === 'grapple' && enemy.attack.phase === 'active';
      const alpha = activeDash || activeGrapple ? 0.18 + pulse * 0.1 : 0.08 + pulse * 0.05;
      ctx.fillStyle = `rgba(190, 0, 0, ${alpha})`;
      ctx.fillRect(0, 0, 92, GAME.height);
      ctx.fillRect(GAME.width - 92, 0, 92, GAME.height);
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
