/**
 * IRON FIST FIGHTING GAME
 * Complete Game Engine with jQuery + Bootstrap
 */

$(document).ready(function () {

  // ============================================================
  //  GAME CONFIG
  // ============================================================
  const CONFIG = {
    ARENA_WIDTH: 100,      // % based
    MOVE_SPEED: 0.5,       // % per frame
    ROUND_TIME: 60,        // seconds
    MAX_ROUNDS: 3,
    ROUNDS_TO_WIN: 2,
    PLAYER_START: 15,
    BOT_START: 68,
    PUNCH_RANGE: 22,       // % distance
    KICK_RANGE: 26,
    SPECIAL_RANGE: 30,

    PUNCH_DAMAGE: { min: 8, max: 15 },
    KICK_DAMAGE: { min: 12, max: 22 },
    SPECIAL_DAMAGE: { min: 20, max: 35 },

    BOT_REACTION_TIME: 800,  // ms
    BOT_ATTACK_CHANCE: 0.4,
    BOT_BLOCK_CHANCE: 0.25,

    MOVE_COOLDOWN: 350,
    BLOCK_COOLDOWN: 500,
    SPECIAL_COOLDOWN: 3000,
  };

  const CHARS = [
    {
      name: 'DRAGON',
      style: 'Karate Master',
      color: '#00d4ff',
      specialName: 'DRAGON BLAST',
      specialDmgMult: 1.3,
      speedMult: 1.0,
      defMult: 1.0,
    },
    {
      name: 'PHANTOM',
      style: 'Shadow Warrior',
      color: '#aa44ff',
      specialName: 'SHADOW STRIKE',
      specialDmgMult: 1.1,
      speedMult: 1.3,
      defMult: 0.85,
    },
    {
      name: 'TITAN',
      style: 'Iron Wrestler',
      color: '#ff8800',
      specialName: 'TITAN SMASH',
      specialDmgMult: 1.6,
      speedMult: 0.7,
      defMult: 1.3,
    }
  ];

  const BOT_CHARS = [
    { name: 'SHADOW BOT', style: 'AI Demon', color: '#ff3a3a', specialName: 'HELLFIRE' },
    { name: 'STEEL BOT',  style: 'Machine', color: '#aaaaaa', specialName: 'STEEL RUSH' },
  ];

  const MOVE_NAMES = {
    punch:   ['JAB!', 'CROSS!', 'UPPERCUT!', 'HOOK!', 'COMBO HIT!'],
    kick:    ['SIDE KICK!', 'ROUNDHOUSE!', 'SPIN KICK!', 'SWEEP!', 'HIGH KICK!'],
    special: ['SPECIAL MOVE!', 'POWER STRIKE!', 'FINISHING BLOW!'],
  };

  const HIT_FX_TEXTS = {
    punch:   ['POW!', 'BAM!', 'CRACK!', 'SMASH!'],
    kick:    ['WHAM!', 'BANG!', 'THUD!', 'SLAM!'],
    special: ['BOOM!', '★ULTRA★', 'K.O!', '★POWER★'],
  };

  const HIT_COLORS = {
    punch:   '#ffcc00',
    kick:    '#ff6600',
    special: '#00d4ff',
  };

  // ============================================================
  //  GAME STATE
  // ============================================================
  let state = {
    phase: 'intro',   // intro | charSelect | countdown | fighting | roundEnd | gameEnd
    selectedChar: null,
    p1: null,
    p2: null,
    round: 1,
    p1Rounds: 0,
    p2Rounds: 0,
    timer: CONFIG.ROUND_TIME,
    timerInterval: null,
    gameLoop: null,
    botInterval: null,
    keys: {},
    p1CanAttack: true,
    p2CanAttack: true,
    p1SpecialReady: true,
    p2SpecialReady: true,
    p1Blocking: false,
    p2Blocking: false,
  };

  function createFighter(charData, startX, isBot) {
    return {
      x: startX,
      hp: 100,
      maxHp: 100,
      isBot,
      charData,
      facingRight: !isBot,
      isJumping: false,
      isKO: false,
      attackCooldown: false,
      blockCooldown: false,
      specialCooldown: false,
      speedMult: charData.speedMult || 1.0,
      defMult: charData.defMult || 1.0,
      specialDmgMult: charData.specialDmgMult || 1.0,
    };
  }

  // ============================================================
  //  SCREEN MANAGEMENT
  // ============================================================
  function showScreen(id) {
    $('.screen').removeClass('active');
    $('#' + id).addClass('active');
    state.phase = id.replace('Screen', '');
  }

  // ============================================================
  //  INTRO
  // ============================================================
  $('#startBtn').on('click', function () {
    showScreen('charSelect');
    state.phase = 'charSelect';
    animateCharCards();
  });

  function animateCharCards() {
    $('.char-card').each(function (i) {
      $(this).css({ opacity: 0, transform: 'translateY(40px)' });
      setTimeout(() => {
        $(this).css({ transition: 'all 0.4s ease', opacity: 1, transform: 'translateY(0)' });
      }, i * 150);
    });
  }

  // ============================================================
  //  CHARACTER SELECT
  // ============================================================
  $(document).on('click', '.char-card', function () {
    const charIdx = parseInt($(this).data('char'));
    state.selectedChar = charIdx;
    $('.char-card').removeClass('selected');
    $(this).addClass('selected');

    setTimeout(() => startGame(charIdx), 400);
  });

  // ============================================================
  //  GAME INIT
  // ============================================================
  function startGame(charIdx) {
    const p1Char = CHARS[charIdx];
    const botChar = Object.assign(
      { ...BOT_CHARS[Math.floor(Math.random() * BOT_CHARS.length)] },
      { speedMult: 1.0, defMult: 1.0, specialDmgMult: 1.2 }
    );

    state.p1 = createFighter(p1Char, CONFIG.PLAYER_START, false);
    state.p2 = createFighter(botChar, CONFIG.BOT_START, true);
    state.round = 1;
    state.p1Rounds = 0;
    state.p2Rounds = 0;
    state.timer = CONFIG.ROUND_TIME;
    state.phase = 'countdown';

    // Update HUD names
    $('#p1Name').text(p1Char.name);
    $('#p2Name').text(botChar.name);
    updateHUD();

    showScreen('gameScreen');
    positionFighters();
    beginRound();
  }

  // ============================================================
  //  ROUND SYSTEM
  // ============================================================
  function beginRound() {
    clearAllIntervals();
    state.phase = 'countdown';
    state.timer = CONFIG.ROUND_TIME;
    state.p1CanAttack = true;
    state.p2CanAttack = true;
    state.p1Blocking = false;
    state.p2Blocking = false;

    // Reset fighter positions and HP
    state.p1.x = CONFIG.PLAYER_START;
    state.p2.x = CONFIG.BOT_START;
    state.p1.hp = 100;
    state.p2.hp = 100;
    state.p1.isKO = false;
    state.p2.isKO = false;

    // Remove animation classes
    $('#player1, #player2').removeClass('punching kicking special hit blocking walking-right walking-left jumping ko');

    positionFighters();
    updateHUD();

    $('#roundBadge').text('ROUND ' + state.round);

    showOverlay('ROUND ' + state.round, 'round', 1500, () => {
      showOverlay('FIGHT!', 'fight', 1000, () => {
        state.phase = 'fighting';
        startTimer();
        startGameLoop();
        startBotAI();
      });
    });
  }

  function showOverlay(text, cls, duration, callback) {
    const $overlay = $('#overlay');
    const $text = $('#overlayText');
    $text.attr('class', 'overlay-text ' + cls).text(text);
    $overlay.addClass('active');
    setTimeout(() => {
      $overlay.removeClass('active');
      if (callback) setTimeout(callback, 200);
    }, duration);
  }

  function startTimer() {
    state.timerInterval = setInterval(() => {
      if (state.phase !== 'fighting') return;
      state.timer--;
      $('#timer').text(state.timer);
      if (state.timer <= 10) $('#timer').addClass('low');
      else $('#timer').removeClass('low');

      if (state.timer <= 0) {
        endRound('timeout');
      }
    }, 1000);
  }

  function endRound(reason) {
    if (state.phase === 'roundEnd' || state.phase === 'gameEnd') return;
    state.phase = 'roundEnd';
    clearAllIntervals();

    let winner = null;
    if (reason === 'timeout') {
      winner = state.p1.hp >= state.p2.hp ? 'p1' : (state.p2.hp > state.p1.hp ? 'p2' : null);
    } else if (reason === 'p1ko') {
      winner = 'p2';
      showKOEffect('p1');
    } else if (reason === 'p2ko') {
      winner = 'p1';
      showKOEffect('p2');
    }

    // Award rounds
    if (winner === 'p1') {
      state.p1Rounds++;
      updateRoundDots();
    } else if (winner === 'p2') {
      state.p2Rounds++;
      updateRoundDots();
    }

    const winMsg = winner === 'p1' ? 'PLAYER WINS ROUND!' :
                   winner === 'p2' ? 'BOT WINS ROUND!'   : 'DRAW!';

    setTimeout(() => {
      showOverlay(winMsg, 'win', 2000, () => {
        checkGameEnd();
      });
    }, winner ? 1000 : 0);
  }

  function showKOEffect(who) {
    const $fighter = who === 'p1' ? $('#player1') : $('#player2');
    $fighter.addClass('ko');
    showOverlay('K.O!!!', 'ko', 1500, null);
  }

  function checkGameEnd() {
    if (state.p1Rounds >= CONFIG.ROUNDS_TO_WIN) {
      showVictory('player');
    } else if (state.p2Rounds >= CONFIG.ROUNDS_TO_WIN) {
      showVictory('bot');
    } else {
      state.round++;
      if (state.round > CONFIG.MAX_ROUNDS) {
        const winner = state.p1Rounds > state.p2Rounds ? 'player' : 'bot';
        showVictory(winner);
      } else {
        beginRound();
      }
    }
  }

  function showVictory(who) {
    state.phase = 'gameEnd';
    clearAllIntervals();

    const isPlayer = who === 'player';
    const title = isPlayer ? '🏆 PLAYER WINS!' : '💀 BOT WINS!';
    const msg   = isPlayer ? 'FLAWLESS WARRIOR' : 'BETTER LUCK NEXT TIME';

    $('#victoryTitle').text(title);
    $('#victoryMsg').text(msg);
    $('#scoreDisplay').text(`ROUNDS: YOU ${state.p1Rounds} - ${state.p2Rounds} BOT`);
    $('#victoryChar').html('');

    showScreen('victoryScreen');
  }

  // ============================================================
  //  POSITION & HUD
  // ============================================================
  function positionFighters() {
    const arenaW = $('#arena').width();
    const fighterW = 120;
    $('#player1').css('left', (state.p1.x / 100) * (arenaW - fighterW) + 'px');
    $('#player2').css('left', (state.p2.x / 100) * (arenaW - fighterW) + 'px');
  }

  function updateHUD() {
    const p1Pct = Math.max(0, state.p1.hp);
    const p2Pct = Math.max(0, state.p2.hp);
    $('#p1Health').css('width', p1Pct + '%');
    $('#p2Health').css('width', p2Pct + '%');
  }

  function updateRoundDots() {
    $('#p1Rounds .dot').each(function (i) {
      $(this).toggleClass('won', i < state.p1Rounds);
    });
    $('#p2Rounds .dot').each(function (i) {
      $(this).toggleClass('won', i < state.p2Rounds);
    });
  }

  // ============================================================
  //  GAME LOOP
  // ============================================================
  function startGameLoop() {
    if (state.gameLoop) cancelAnimationFrame(state.gameLoop);

    let last = 0;
    function loop(ts) {
      if (state.phase !== 'fighting') return;
      const dt = ts - last;
      if (dt > 16) {
        last = ts;
        processInput();
        clampPositions();
        positionFighters();
        updateFacingDirection();
      }
      state.gameLoop = requestAnimationFrame(loop);
    }
    state.gameLoop = requestAnimationFrame(loop);
  }

  function processInput() {
    if (state.p1.isKO) return;

    const moveSpd = CONFIG.MOVE_SPEED * (state.p1.speedMult || 1.0);
    let moving = false;

    if (state.keys['ArrowLeft'] || state.keys['a'] || state.keys['A']) {
      state.p1.x -= moveSpd;
      if (!$('#player1').hasClass('punching') && !$('#player1').hasClass('kicking')) {
        $('#player1').removeClass('walking-right').addClass('walking-left');
      }
      moving = true;
    }
    if (state.keys['ArrowRight'] || state.keys['d'] || state.keys['D']) {
      state.p1.x += moveSpd;
      if (!$('#player1').hasClass('punching') && !$('#player1').hasClass('kicking')) {
        $('#player1').removeClass('walking-left').addClass('walking-right');
      }
      moving = true;
    }
    if (!moving) {
      $('#player1').removeClass('walking-left walking-right');
    }

    // Block
    if (state.keys['ArrowDown'] || state.keys['s'] || state.keys['S']) {
      if (!state.p1Blocking) {
        state.p1Blocking = true;
        $('#player1').addClass('blocking');
      }
    } else {
      state.p1Blocking = false;
      $('#player1').removeClass('blocking');
    }
  }

  function clampPositions() {
    state.p1.x = Math.max(0, Math.min(90, state.p1.x));
    state.p2.x = Math.max(0, Math.min(90, state.p2.x));

    // Prevent overlap
    const minDist = 12;
    const dist = state.p2.x - state.p1.x;
    if (Math.abs(dist) < minDist) {
      const push = (minDist - Math.abs(dist)) / 2;
      if (dist >= 0) {
        state.p1.x -= push;
        state.p2.x += push;
      } else {
        state.p1.x += push;
        state.p2.x -= push;
      }
    }
  }

  function updateFacingDirection() {
    state.p1.facingRight = state.p2.x > state.p1.x;
    state.p2.facingRight = state.p1.x > state.p2.x;
  }

  // ============================================================
  //  KEYBOARD INPUT
  // ============================================================
  $(document).on('keydown', function (e) {
    state.keys[e.key] = true;
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) {
      e.preventDefault();
    }

    if (state.phase !== 'fighting') return;

    // Jump
    if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') && !state.p1.isJumping) {
      doJump('p1');
    }
    // Punch
    if (e.key === 'a' || e.key === 'A') {
      // covered by move
    }
    // Punch attack key
    if (e.key === 'j' || e.key === 'J' || e.key === 'z' || e.key === 'Z' || e.key === '1') {
      doAttack('p1', 'punch');
    }
    // Kick
    if (e.key === 'k' || e.key === 'K' || e.key === 'x' || e.key === 'X' || e.key === '2') {
      doAttack('p1', 'kick');
    }
    // Special
    if (e.key === 'l' || e.key === 'L' || e.key === 'c' || e.key === 'C' || e.key === '3' || e.key === ' ') {
      doAttack('p1', 'special');
    }
  });

  // Better key scheme for actual keyboard users
  $(document).on('keydown', function (e) {
    if (state.phase !== 'fighting') return;
    // WASD: move + block
    // J/Z/1: punch | K/X/2: kick | L/C/3/Space: special
    // Arrow keys: move alt + ArrowDown = block
  });

  $(document).on('keyup', function (e) {
    delete state.keys[e.key];
  });

  // REVISED key listener (no overlap)
  $(document).off('keydown').on('keydown', function (e) {
    state.keys[e.key] = true;

    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) {
      e.preventDefault();
    }

    if (state.phase !== 'fighting') return;

    // Jump
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      doJump('p1');
    }
    // Punch - A key or keyboard Z
    if (e.key === 'z' || e.key === 'Z') doAttack('p1', 'punch');
    // Kick - S key (different from move) or X
    if (e.key === 'x' || e.key === 'X') doAttack('p1', 'kick');
    // Special - C or Space
    if (e.key === 'c' || e.key === 'C' || e.key === ' ') doAttack('p1', 'special');
  });

  // Mobile controls
  $('#mob-left').on('touchstart mousedown', (e) => { e.preventDefault(); state.keys['ArrowLeft'] = true; });
  $('#mob-left').on('touchend mouseup', (e) => { e.preventDefault(); delete state.keys['ArrowLeft']; });
  $('#mob-right').on('touchstart mousedown', (e) => { e.preventDefault(); state.keys['ArrowRight'] = true; });
  $('#mob-right').on('touchend mouseup', (e) => { e.preventDefault(); delete state.keys['ArrowRight']; });
  $('#mob-block').on('touchstart mousedown', (e) => { e.preventDefault(); state.keys['ArrowDown'] = true; });
  $('#mob-block').on('touchend mouseup', (e) => { e.preventDefault(); delete state.keys['ArrowDown']; });
  $('#mob-punch').on('click touchstart', (e) => { e.preventDefault(); if (state.phase === 'fighting') doAttack('p1', 'punch'); });
  $('#mob-kick').on('click touchstart', (e) => { e.preventDefault(); if (state.phase === 'fighting') doAttack('p1', 'kick'); });
  $('#mob-special').on('click touchstart', (e) => { e.preventDefault(); if (state.phase === 'fighting') doAttack('p1', 'special'); });

  // ============================================================
  //  ATTACK LOGIC
  // ============================================================
  function getDistance() {
    return Math.abs(state.p2.x - state.p1.x);
  }

  function doAttack(who, type) {
    const attacker = who === 'p1' ? state.p1 : state.p2;
    const defender = who === 'p1' ? state.p2 : state.p1;
    const $attEl  = who === 'p1' ? $('#player1') : $('#player2');
    const $defEl  = who === 'p1' ? $('#player2') : $('#player1');

    if (attacker.attackCooldown || attacker.isKO) return;
    if (type === 'special' && attacker.specialCooldown) return;

    const range = type === 'punch' ? CONFIG.PUNCH_RANGE :
                  type === 'kick'  ? CONFIG.KICK_RANGE  : CONFIG.SPECIAL_RANGE;

    // Start animation immediately
    $attEl.removeClass('punching kicking special');
    void $attEl[0].offsetWidth; // reflow
    $attEl.addClass(type === 'punch' ? 'punching' : type === 'kick' ? 'kicking' : 'special');
    setTimeout(() => $attEl.removeClass('punching kicking special'), 400);

    // Cooldown
    attacker.attackCooldown = true;
    setTimeout(() => { attacker.attackCooldown = false; }, CONFIG.MOVE_COOLDOWN);

    if (type === 'special') {
      attacker.specialCooldown = true;
      setTimeout(() => { attacker.specialCooldown = false; }, CONFIG.SPECIAL_COOLDOWN);
      showSpecialFX(who);
    }

    // Check hit
    const dist = getDistance();
    if (dist <= range && !defender.isKO) {
      const isBlocked = (who === 'p1' ? state.p2Blocking : state.p1Blocking);
      const dmgCfg = type === 'punch'  ? CONFIG.PUNCH_DAMAGE   :
                     type === 'kick'   ? CONFIG.KICK_DAMAGE    : CONFIG.SPECIAL_DAMAGE;
      let dmg = Math.floor(Math.random() * (dmgCfg.max - dmgCfg.min + 1)) + dmgCfg.min;
      dmg = Math.round(dmg * (attacker.specialDmgMult || 1.0));
      if (isBlocked) dmg = Math.round(dmg * 0.2 * (defender.defMult || 1.0));
      else dmg = Math.round(dmg * (1 / (defender.defMult || 1.0)));

      dmg = Math.max(1, dmg);

      // Apply damage
      defender.hp -= dmg;
      defender.hp = Math.max(0, defender.hp);

      if (!isBlocked) {
        $defEl.addClass('hit');
        setTimeout(() => $defEl.removeClass('hit'), 300);
        flashScreen();
      }

      // Show effects
      const moveName = MOVE_NAMES[type][Math.floor(Math.random() * MOVE_NAMES[type].length)];
      showMoveDisplay(moveName);
      showHitFX(type, who === 'p1' ? state.p2.x : state.p1.x);

      updateHUD();

      if (defender.hp <= 0) {
        defender.isKO = true;
        endRound(who === 'p1' ? 'p2ko' : 'p1ko');
      }
    } else {
      // Show move name even if miss
      const moveName = MOVE_NAMES[type][Math.floor(Math.random() * MOVE_NAMES[type].length)];
      showMoveDisplay(moveName + ' (MISS)');
    }
  }

  function doJump(who) {
    const fighter = who === 'p1' ? state.p1 : state.p2;
    const $el = who === 'p1' ? $('#player1') : $('#player2');
    if (fighter.isJumping || fighter.isKO) return;
    fighter.isJumping = true;
    $el.addClass('jumping');
    setTimeout(() => {
      $el.removeClass('jumping');
      fighter.isJumping = false;
    }, 550);
  }

  // ============================================================
  //  BOT AI
  // ============================================================
  function startBotAI() {
    state.botInterval = setInterval(botThink, CONFIG.BOT_REACTION_TIME);
  }

  function botThink() {
    if (state.phase !== 'fighting' || state.p2.isKO || state.p1.isKO) return;

    const dist = getDistance();
    const moveSpd = CONFIG.MOVE_SPEED * (state.p2.speedMult || 1.0);

    // Block if player attacking nearby
    if (dist < CONFIG.PUNCH_RANGE + 5 && Math.random() < CONFIG.BOT_BLOCK_CHANCE) {
      state.p2Blocking = true;
      $('#player2').addClass('blocking');
      setTimeout(() => {
        state.p2Blocking = false;
        $('#player2').removeClass('blocking');
      }, CONFIG.BLOCK_COOLDOWN);
      return;
    }

    // Approach player
    if (dist > CONFIG.PUNCH_RANGE) {
      if (state.p2.x > state.p1.x) {
        state.p2.x -= moveSpd * 2;
        $('#player2').addClass('walking-left').removeClass('walking-right');
      } else {
        state.p2.x += moveSpd * 2;
        $('#player2').addClass('walking-right').removeClass('walking-left');
      }
      setTimeout(() => $('#player2').removeClass('walking-left walking-right'), 300);
    }

    // Attack
    if (dist <= CONFIG.KICK_RANGE && Math.random() < CONFIG.BOT_ATTACK_CHANCE) {
      state.p2Blocking = false;
      const atkType = Math.random() < 0.5 ? 'punch' :
                      Math.random() < 0.7 ? 'kick'  : 'special';
      doAttack('p2', atkType);
    }

    // Occasional jump
    if (Math.random() < 0.05) doJump('p2');

    // Strafe randomly
    if (Math.random() < 0.15) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      state.p2.x += dir * moveSpd * 3;
      state.p2.x = Math.max(0, Math.min(90, state.p2.x));
    }
  }

  // ============================================================
  //  VFX HELPERS
  // ============================================================
  function showHitFX(type, targetX) {
    const $arena = $('#arena');
    const arenaW = $arena.width();
    const xPx = (targetX / 100) * arenaW;

    const texts = HIT_FX_TEXTS[type];
    const txt = texts[Math.floor(Math.random() * texts.length)];
    const col = HIT_COLORS[type];

    const $fx = $('#hitFx');
    $fx.removeClass('active').text(txt).css({
      left: xPx + 'px',
      top: '30%',
      color: col,
      textShadow: `0 0 20px ${col}, 0 0 40px ${col}`,
    });
    void $fx[0].offsetWidth;
    $fx.addClass('active');
    setTimeout(() => $fx.removeClass('active'), 500);
  }

  function showSpecialFX(who) {
    const $fx = $('#specialFx');
    const col = who === 'p1' ? state.p1.charData.color : state.p2.charData.color;
    $fx.css('background', `radial-gradient(ellipse at 50% 50%, ${col}33 0%, transparent 70%)`);
    $fx.removeClass('active');
    void $fx[0].offsetWidth;
    $fx.addClass('active');
    setTimeout(() => $fx.removeClass('active'), 700);
  }

  function showMoveDisplay(txt) {
    const $md = $('#moveDisplay');
    $md.text(txt).addClass('show');
    setTimeout(() => $md.removeClass('show'), 1200);
  }

  function flashScreen() {
    let $flash = $('#screenFlash');
    if (!$flash.length) {
      $flash = $('<div id="screenFlash" class="screen-flash"></div>').appendTo('body');
    }
    $flash.removeClass('active');
    void $flash[0].offsetWidth;
    $flash.addClass('active');
    setTimeout(() => $flash.removeClass('active'), 300);
  }

  // ============================================================
  //  CLEANUP
  // ============================================================
  function clearAllIntervals() {
    clearInterval(state.timerInterval);
    clearInterval(state.botInterval);
    if (state.gameLoop) {
      cancelAnimationFrame(state.gameLoop);
      state.gameLoop = null;
    }
    state.keys = {};
    state.p1Blocking = false;
    state.p2Blocking = false;
    $('#player1, #player2').removeClass('blocking walking-left walking-right');
  }

  // ============================================================
  //  REMATCH / MENU
  // ============================================================
  $('#rematchBtn').on('click', function () {
    showScreen('gameScreen');
    state.round = 1;
    state.p1Rounds = 0;
    state.p2Rounds = 0;
    updateRoundDots();
    beginRound();
  });

  $('#menuBtn').on('click', function () {
    clearAllIntervals();
    state.keys = {};
    showScreen('introScreen');
    state.phase = 'intro';
  });

  // ============================================================
  //  ARENA RESIZE HANDLER
  // ============================================================
  $(window).on('resize', function () {
    positionFighters();
  });

  // ============================================================
  //  TIPS DISPLAY
  // ============================================================
  const TIPS = [
    'Arrow Keys or WASD to move | ↓ to block',
    'Z = Punch | X = Kick | C or Space = Special Move',
    'Block reduces incoming damage by 80%!',
    'Special moves deal massive damage — use wisely!',
    'Win 2 rounds to claim the championship!',
  ];
  let tipIdx = 0;
  function cycleTips() {
    const $hint = $('.select-hint');
    if ($hint.length) {
      $hint.fadeOut(300, function () {
        $(this).text(TIPS[tipIdx++ % TIPS.length]).fadeIn(300);
      });
    }
  }
  setInterval(cycleTips, 3000);

  // ============================================================
  //  AMBIENT ARENA EFFECTS
  // ============================================================
  function pulseArenaLights() {
    const hue = Math.random() * 60 + 240;
    $('.arena-floor').css('border-top-color', `hsl(${hue},100%,50%)`);
  }
  setInterval(pulseArenaLights, 2000);

  // ============================================================
  //  INIT
  // ============================================================
  showScreen('introScreen');
  console.log('%c🥊 IRON FIST LOADED! 🥊', 'color: #ffd700; font-size: 18px; font-weight: bold;');
  console.log('%cControls: Arrow Keys / WASD to move | Z=Punch | X=Kick | C/Space=Special', 'color: #00d4ff;');

}); // end document.ready
