/* ============================================================
 * RIPCURRENT — sunset point-break surfing.
 * One endless evening wave in side view: carve the open face,
 * launch off the lip, thread the barrel while sets roll in and
 * the sun drops. All art is drawn with canvas paths each frame;
 * all audio is synthesized. No image or sound assets.
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------- tuning ---------------- */
  const SURF_X = 0.38;              // surfer's fixed screen x (width fraction)
  const WAVE_DUR = 22;              // seconds of riding per wave
  const CALM_DUR = 3;               // channel between waves
  const WIPE_DUR = 1.5;             // wipeout tumble length
  const MINS = 0.30;                // speed floor — below it the wave eats you
  const MAXS = 1.3;                 // speed ceiling
  const TUBE_BAND = [0.33, 0.78];   // safe face band while the lip pitches
  const TRICKS = [
    { name: 'FLOATY AIR', pts: 50, spin: 0 },
    { name: 'AIR 180', pts: 100, spin: 2.6 },
    { name: 'BIG SPIN', pts: 150, spin: 5.2 }
  ];
  const OCEAN = { wave: 'sawtooth', freq: 44, maxFreq: 110, cutoff: 210, gain: 0.001 };

  /* ---------------- world state ---------------- */
  let state = 'attract';            // attract | ride | air | wipe | calm | done
  let runActive = false;            // a real session (score + hearts live)
  let u = 0.42, speed = 0.8, lean = 0;   // face position (0 trough, 1 lip), speed, carve lean
  let airY = 0, airVy = 0, spin = 0, spinV = 0, trick = TRICKS[0];
  let score = 0, hearts = 3, streak = 0, bestTrick = 0, tubeTime = 0, wavesSurfed = 0;
  let waveNum = 1, waveT = 0, grade = 2, calmT = 0, calmK = 0, briefingOpen = false;
  let wipeT = 0, wipeRot = 0, wipeSpin = 0;
  let graceT = 0, whooshT = 0, scroll = 0, attractT = 0, airTimer = 6;
  let tubeAt = 6, tubeDur = 3, tubeEnd = 0, curlPhase = 'wait', curlAmt = 0, tubeOn = false, tubeCur = 0;
  let particles = Kit.particles();

  let G = null;                     // assigned at boot
  const W = { w: 0, h: 0 };
  let skyGrad = null, seaGrad = null, bodyGrad = null, foreGrad = null, vignette = null;
  let stars = [], glints = [], humps = [], shimmer = [], streaks = [];

  /* ---------------- scenery ---------------- */
  function buildScene() {
    stars = []; glints = []; humps = []; shimmer = []; streaks = [];
    for (let i = 0; i < 46; i++) stars.push({ x: Math.random(), y: Math.random() * 0.26, r: Math.random() * 1.2 + 0.4, p: Math.random() * 6.28 });
    for (let i = 0; i < 9; i++) glints.push({ y: 0.015 + Math.random() * 0.07, dx: (Math.random() - 0.5) * 0.05, len: 0.02 + Math.random() * 0.05, p: Math.random() * 6.28 });
    let x = -0.2;
    while (x < 2.5) {
      const hw = 0.16 + Math.random() * 0.34, hh = 0.014 + Math.random() * 0.05 * (x > 1.4 ? 1.7 : 1);
      humps.push({ x, w: hw, h: hh });
      x += hw * (0.55 + Math.random() * 0.5);
    }
    for (let i = 0; i < 14; i++) shimmer.push({ x: Math.random(), d: 0.05 + Math.random() * 0.3, len: 0.02 + Math.random() * 0.05, p: Math.random() * 6.28 });
    for (let i = 0; i < 7; i++) streaks.push({ x: Math.random(), d: 0.06 + Math.random() * 0.34, len: 0.06 + Math.random() * 0.12 });
  }

  /* ---------------- wave geometry ----------------
     The face holds its shape on screen (the surfer matches wave
     speed); the water itself streams past. The lip curls from the
     apex down-left at rest, and pitches out over the face during
     a tube. curlAmt: 0 spilled crest, 1 full pitching barrel. */
  function geom() {
    const { w, h } = W;
    const gm = { w, h };
    gm.hor = h * 0.40; gm.yW = h * 0.76; gm.yF = h * 0.845;
    gm.xA = w * 0.20; gm.yA = h * 0.26; gm.xEnd = w * 0.985;
    const steep = Math.max(1.08, 1.30 - grade * 0.035);
    const raw = x => gm.yA + (gm.yW - gm.yA) * Math.pow(Kit.clamp((x - gm.xA) / (gm.xEnd - gm.xA), 0, 1), steep);
    gm.flat = calmK;                // the set dies down into the channel
    gm.edgeY = x => Kit.lerp(raw(x), gm.yW - h * 0.05, gm.flat);
    gm.tipX = gm.xA - w * 0.11 + curlAmt * w * 0.31;
    gm.tipY = gm.yA + h * (0.10 + curlAmt * 0.26);
    gm.wwEnd = w * (0.16 - 0.02 * curlAmt);
    gm.faceTop = gm.edgeY(w * SURF_X) + h * 0.035;
    gm.faceBot = h * 0.785;
    return gm;
  }
  const surfY = gm => gm.faceBot - (gm.faceBot - gm.faceTop) * u;

  /* ---------------- run control ---------------- */
  function startRun() {
    runActive = true;
    score = 0; hearts = 3; streak = 0; bestTrick = 0; tubeTime = 0; wavesSurfed = 0;
    waveNum = 1; grade = 1; waveT = 0; calmK = 0;
    u = 0.42; speed = 0.8; lean = 0; airY = 0; spin = 0;
    state = 'ride'; graceT = 1.2;
    tubeAt = Kit.rand(7, 12); tubeDur = 2.9; curlPhase = 'wait'; curlAmt = 0; tubeOn = false; tubeCur = 0;
    particles.clear();
    buildHUD();
    Audio.playSong('surf');
    Audio.loop('ocean', OCEAN);
    G.resume();
    Mascot.react('start');
  }

  function toAttract() {
    runActive = false;
    state = 'attract'; attractT = 0; airTimer = 6;
    grade = 2; waveT = 0; waveNum = 1; calmK = 0;
    u = 0.4; speed = 0.85; lean = 0; airY = 0; spin = 0;
    tubeAt = Kit.rand(5, 11); tubeDur = 2.8; curlPhase = 'wait'; curlAmt = 0; tubeOn = false;
    hearts = 3; score = 0;
    particles.clear();
    Audio.stopLoop('ocean');
    Audio.playSong('menu');
  }

  function startCalm() {
    state = 'calm'; calmT = CALM_DUR; tubeOn = false; airY = 0;
    if (runActive) Kit.toast('NEXT SET INCOMING', 2000);
  }

  function nextWave() {
    waveNum++;
    grade = Math.min(6, waveNum);
    waveT = 0; state = 'ride'; graceT = 1;
    tubeAt = Kit.rand(6, 13); tubeDur = 2.6 + grade * 0.28; curlPhase = 'wait';
    u = Math.max(u, 0.3); speed = Math.max(speed, 0.7);
    Audio.sfx('checkpoint');
    Mascot.react('set');
  }

  function finishRun() {
    state = 'done';
    Audio.stopLoop('ocean');
    Audio.stopSong({ fade: 0.6 });
    G.pause();
    const prev = Kit.store.get('surf.best', 0);
    const pb = Math.floor(score) > prev;
    Kit.showResults({
      medal: score >= 2500 ? '🏆' : score >= 800 ? '🥈' : '🌊',
      kicker: 'Session complete',
      title: pb ? 'Sunset send' : 'The tide waits for no one',
      stats: [
        { label: 'Score', value: Kit.fmt(Math.floor(score)) },
        { label: 'Best trick', value: bestTrick ? Kit.fmt(bestTrick) + ' pts' : '—' },
        { label: 'Tube time', value: tubeTime.toFixed(1) + 's' },
        { label: 'Waves surfed', value: String(wavesSurfed) }
      ],
      best: { value: Math.floor(score) },
      mascotLine: pb ? 'Session of the month. Sunset got its show.' : 'Out of hearts... the tide waits for no one.'
    });
    Mascot.react(pb ? 'win' : 'fail');
  }

  /* ---------------- tricks ---------------- */
  function launch(gm) {
    state = 'air'; airY = 1; spin = 0;
    airVy = gm.h * (0.24 + 0.34 * Kit.clamp(speed, 0, 1));
    spinV = 3.1 + 4.8 * Kit.clamp(speed, 0, 1);
    const est = spinV * (2 * airVy / (gm.h * 1.05));
    trick = TRICKS[0];
    for (const t of TRICKS) if (est >= t.spin) trick = t;
    if (runActive) {
      popTrick(trick.name, trick.pts + ' pts', false);
      Audio.sfx('jump'); Kit.buzz(30);
      particles.spawn(W.w * SURF_X, surfY(gm), { count: 10, color: '#EAF7F4', vx: -Kit.rand(80, 200), vy: Kit.rand(40, 160), spread: 120, grav: 300, decay: 1.7, size: 2.4 });
    }
  }

  function land(gm) {
    if (!runActive) { state = 'attract'; airY = 0; return; }
    const flat = Math.abs(Math.sin(spin)) < 0.48;
    if (flat && u > 0.14) {
      streak = Math.min(5, streak + 1);
      const gain = trick.pts * streak * (tubeOn ? 2 : 1);
      score += gain;
      bestTrick = Math.max(bestTrick, gain);
      speed = Math.min(MAXS, speed + 0.10);
      graceT = Math.max(graceT, 0.5);
      popTrick('CLEAN +' + Kit.fmt(gain), streak > 1 ? 'streak x' + streak : '', false);
      Audio.sfx('coin'); Kit.buzz(20);
      particles.spawn(W.w * SURF_X, surfY(gm), { count: 14, color: '#FFC46B', spread: 220, vy: -60, grav: 220, decay: 1.8, size: 2.6, glow: true });
      particles.spawn(W.w * SURF_X, surfY(gm), { count: 8, color: '#EAF7F4', spread: 160, vy: -40, grav: 300, decay: 1.6, size: 2.2 });
      Mascot.react('trick');
      state = 'ride';
    } else {
      wipeout(u <= 0.14 ? 'nosedive' : 'crash');
    }
  }

  function wipeout(kind) {
    state = 'wipe'; wipeT = 0; wipeRot = lean * 0.3;
    wipeSpin = Kit.rand(8, 12) * (Math.random() < 0.5 ? -1 : 1);
    hearts = Math.max(0, hearts - 1);
    streak = 0; tubeOn = false; curlPhase = 'done';
    Audio.sfx('splash'); Audio.sfx('fail'); Kit.buzz(90); G.shake(9);
    particles.spawn(W.w * SURF_X, W.h * 0.79, { count: 22, color: '#EAF7F4', vx: Kit.rand(-80, 80), vy: -Kit.rand(120, 320), spread: 200, grav: 380, decay: 1.4, size: 3 });
    popTrick(kind === 'nosedive' ? 'NOSE-DIVE' : 'WIPEOUT', '', true);
    Mascot.react('wipeout');
  }

  /* ---------------- tube ---------------- */
  function tubeStep(dt) {
    if (curlPhase === 'wait') {
      curlAmt += (0 - curlAmt) * Math.min(1, dt * 1.5);
      if (waveT >= tubeAt - 1.3) curlPhase = 'form';
    } else if (curlPhase === 'form') {
      curlAmt += (1 - curlAmt) * Math.min(1, dt * 2.2);
      if (waveT >= tubeAt) { curlPhase = 'in'; tubeEnd = tubeAt + tubeDur; }
    } else if (curlPhase === 'in') {
      curlAmt += (1 - curlAmt) * Math.min(1, dt * 3);
      const inBand = u > TUBE_BAND[0] && u < TUBE_BAND[1];
      if (inBand && !tubeOn) {
        tubeOn = true; tubeCur = 0;
        if (runActive) { Audio.sfx('chime'); Mascot.react('tube'); Kit.buzz(30); }
      }
      if (tubeOn) {
        if (inBand) {
          tubeCur += dt;
          if (runActive) { tubeTime += dt; score += 10 * dt; }
        } else tubeOn = false;          // bailed out — missed, no penalty
      }
      if (waveT >= tubeEnd) { curlPhase = 'done'; tubeOn = false; }
    } else {
      curlAmt += (0 - curlAmt) * Math.min(1, dt * 1.2);
    }
  }

  /* ---------------- particles ---------------- */
  function crestFoam(gm) {
    const x = gm.xA + Math.random() * (gm.xEnd - gm.xA) * 0.92;
    particles.spawn(x, gm.edgeY(x) + Kit.rand(0, 0.012) * W.h, { count: 1, color: '#F4FCFA', vx: -Kit.rand(30, 110), vy: -Kit.rand(10, 60), spread: 30, grav: 150, decay: 1.5, size: 1.8 });
  }

  function sprayFx(gm, dt) {
    if (Kit.reducedMotion()) {
      if (Math.random() < 0.3) crestFoam(gm);
      return;
    }
    crestFoam(gm);
    if (curlAmt > 0.25 && Math.random() < 0.85) {
      particles.spawn(gm.tipX + Kit.rand(-0.03, 0.03) * W.w, gm.tipY + Kit.rand(-0.02, 0.01) * W.h,
        { count: 2, color: '#F4FCFA', vx: -Kit.rand(90, 200) - 140 * curlAmt, vy: -Kit.rand(30, 130), spread: 50, grav: 300, decay: 1.5, size: 2 });
    }
    if (state === 'ride' && Math.abs(lean) > 0.45 && speed > 0.45 && Math.random() < 0.8) {
      particles.spawn(W.w * SURF_X - Math.sign(lean) * 10, surfY(gm), { count: 2, color: '#EAF7F4', vx: -Kit.rand(60, 160), vy: -Kit.rand(80, 200), spread: 90, grav: 340, decay: 1.8, size: 2.2 });
    }
    if (state !== 'air' && speed > 0.5 && Math.random() < 0.6) {
      particles.spawn(W.w * SURF_X - 16, surfY(gm) + 4, { count: 1, color: '#EAF7F4', vx: -Kit.rand(80, 200) * speed, vy: Kit.rand(-30, 30), spread: 20, grav: 40, decay: 2.4, size: 1.8 });
    }
  }

  /* ---------------- update ---------------- */
  function update(dt) {
    const input = Kit.input;
    const ay = input.axis().y;
    graceT = Math.max(0, graceT - dt);
    whooshT = Math.max(0, whooshT - dt);
    scroll += (430 + 95 * grade) * (0.45 + 0.55 * Kit.clamp(speed, 0, 1)) * dt;
    calmK += ((state === 'calm' ? 1 : 0) - calmK) * Math.min(1, dt * (state === 'calm' ? 1.1 : 2.4));

    if (state === 'ride') {
      waveT += dt;
      lean += ((ay < -0.35 ? -1 : ay > 0.35 ? 1 : 0) - lean) * Math.min(1, dt * 7);
      /* carve up costs speed, dropping down banks it */
      if (ay < -0.35) { u += (0.50 + 0.28 * speed) * dt; speed -= 0.30 * dt; if (u > 0.98) speed -= 0.12 * dt; }
      else if (ay > 0.35) { u -= 0.68 * dt; speed += 0.34 * dt; }
      u -= 0.30 * dt;                                   // gravity pulls down the face
      speed += (0.05 + 0.22 * (1 - u) - 0.055) * dt;    // wave push vs drag
      u = Kit.clamp(u, 0, 1);
      speed = Kit.clamp(speed, 0, MAXS);
      if (curlAmt > 0.6 && u > 0.86) u += (0.80 - u) * dt * 2.5;   // the roof nudges you back under
      const gm = geom();
      if ((input.pressed('action') || input.pressed('up')) && u > 0.5 && speed > 0.55) launch(gm);
      tubeStep(dt);
      if (state === 'ride' && graceT <= 0 && speed < MINS) wipeout('stall');
      if (state === 'ride' && waveT >= WAVE_DUR) { wavesSurfed++; startCalm(); }
      if (state === 'ride') score += dt * (4 + 9 * u) * (tubeOn ? 2 : 1);
      sprayFx(gm, dt);
      if (state === 'ride' && Math.abs(lean) > 0.4 && speed > 0.4 && whooshT <= 0) {
        Audio.sfx('whoosh');
        whooshT = Kit.rand(0.35, 0.7) / (0.4 + speed);
      }
    } else if (state === 'air') {
      waveT += dt;
      const gm = geom();
      lean += ((ay < -0.35 ? -0.7 : ay > 0.35 ? 0.7 : 0) - lean) * Math.min(1, dt * 6);
      const gacc = gm.h * 1.05 * (input.down('up') ? 0.5 : input.down('down') ? 1.65 : 1);
      airVy -= gacc * dt; airY += airVy * dt; spin += spinV * dt;
      tubeStep(dt);
      if (!Kit.reducedMotion() && Math.random() < 0.3) {
        particles.spawn(W.w * SURF_X, surfY(gm) - airY, { count: 1, color: '#EAF7F4', vx: -60, vy: 40, spread: 60, grav: 120, decay: 2.4, size: 2 });
      }
      if (!runActive) {
        if (waveT >= WAVE_DUR) { waveT = 0; tubeAt = Kit.rand(5, 11); }
        if (airY <= 0 && airVy < 0) land(gm);
      } else if (waveT >= WAVE_DUR) {
        wavesSurfed++; startCalm();
      } else if (airY <= 0 && airVy < 0) {
        land(gm);
      }
    } else if (state === 'wipe') {
      wipeT += dt;
      wipeRot += wipeSpin * dt;
      if (!Kit.reducedMotion() && Math.random() < 0.5) {
        particles.spawn(W.w * SURF_X, W.h * 0.80, { count: 3, color: '#EAF7F4', vx: (Math.random() - 0.5) * 160, vy: -Kit.rand(60, 220), spread: 60, grav: 320, decay: 1.6, size: 2.6 });
      }
      if (wipeT >= WIPE_DUR) { if (hearts <= 0) finishRun(); else startCalm(); }
    } else if (state === 'calm') {
      /* board briefing: one Git-survival concept while you rest in the channel */
      if (runActive && window.Learn && window.LEARN_DATA && !briefingOpen && waveNum >= 1) {
        const card = Learn.nextCard();
        if (card) {
          briefingOpen = true;
          G.pause();
          Learn.show(card, { timer: 0, onClose: () => {
            briefingOpen = false;
            G.resume();
            calmT = 1.4;
          } }).then(ok => { if (ok) { score += 250; Kit.toast('+250 — board briefing aced'); } });
        }
        return;
      }
      calmT -= dt;
      u += (0.22 - u) * Math.min(1, dt * 2);
      speed += (0.62 - speed) * Math.min(1, dt * 2);
      lean += (0 - lean) * Math.min(1, dt * 4);
      curlAmt += (0 - curlAmt) * Math.min(1, dt * 1.6);
      tubeOn = false;
      if (calmT <= 0) nextWave();
    } else if (state === 'attract') {
      /* auto-rider keeps the menu alive */
      attractT += dt; waveT += dt;
      if (waveT >= WAVE_DUR) { waveT = 0; tubeAt = Kit.rand(5, 11); }
      const gm = geom();
      const tgt = curlPhase === 'in' ? 0.56 : 0.46 + 0.32 * Math.sin(attractT * 0.55);
      u += (tgt - u) * Math.min(1, dt * 1.7);
      speed += (0.85 - speed) * Math.min(1, dt);
      lean += (Math.cos(attractT * 0.55) * 0.5 - lean) * Math.min(1, dt * 3);
      airTimer -= dt;
      if (airTimer <= 0 && u > 0.55 && speed > 0.6 && state === 'attract') {
        launch(gm);
        airTimer = Kit.rand(6, 10);
      }
      if (state === 'attract') tubeStep(dt);
      sprayFx(gm, dt);
    }

    /* audio follows the session */
    const sr = Kit.clamp(speed / MAXS, 0, 1);
    Audio.setIntensity(runActive && (tubeOn || state === 'air') ? 1 : state === 'attract' ? 0.12 : 0.25 + 0.3 * sr);
    if (runActive) Audio.setLoop('ocean', 'gain', 0.03 + 0.05 * sr + 0.08 * curlAmt * (tubeOn ? 1 : 0.4));

    particles.update(dt);
  }

  /* ---------------- render ---------------- */
  function drawSky(ctx, gm, t) {
    const { w, h } = W;
    if (!skyGrad) {
      skyGrad = ctx.createLinearGradient(0, 0, 0, gm.hor * 1.02);
      skyGrad.addColorStop(0, '#0C2430');
      skyGrad.addColorStop(0.42, '#4E3A46');
      skyGrad.addColorStop(0.72, '#A65A4A');
      skyGrad.addColorStop(0.9, '#E8895A');
      skyGrad.addColorStop(1, '#FFC46B');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, gm.hor + 2);

    /* early stars */
    ctx.fillStyle = '#F7EDD8';
    const starDim = Kit.reducedMotion() ? 0.5 : 1;
    for (const s of stars) {
      if (s.y * h > gm.hor * 0.75) continue;
      ctx.globalAlpha = (0.25 + 0.5 * Math.abs(Math.sin(t * 1.1 + s.p))) * starDim;
      ctx.fillRect(s.x * w, s.y * h, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    /* the big low sun */
    const sunX = w * 0.62, sunY = gm.hor - h * 0.055, sunR = Math.min(w, h) * 0.16;
    const halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.4, sunX, sunY, sunR * 2.4);
    halo.addColorStop(0, 'rgba(255,196,107,0.34)');
    halo.addColorStop(1, 'rgba(255,196,107,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sunX - sunR * 2.4, sunY - sunR * 2.4, sunR * 4.8, sunR * 4.8);
    const sg = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sg.addColorStop(0, '#FFF6CE'); sg.addColorStop(0.55, '#FFC46B'); sg.addColorStop(1, '#FF8A5C');
    ctx.save();
    ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = sg;
    ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
    ctx.fillStyle = 'rgba(12,36,48,0.30)';
    for (let i = 0; i < 4; i++) ctx.fillRect(sunX - sunR, sunY + sunR * (0.1 + i * 0.24), sunR * 2, 2 + i * 1.8);
    ctx.restore();
  }

  function drawHeadland(ctx, gm) {
    const { w, h } = W;
    const span = 2.6;
    for (const hp of humps) {
      const x = ((((hp.x - scroll * 0.05 / w) % span) + span) % span) * w - w * 0.3;
      const hw = hp.w * w, hh = hp.h * h;
      if (x + hw < -20 || x > w + 20) continue;
      ctx.fillStyle = '#0C2A34';
      ctx.beginPath();
      ctx.moveTo(x, gm.hor + 1);
      ctx.quadraticCurveTo(x + hw * 0.5, gm.hor - hh * 2, x + hw, gm.hor + 1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,196,107,0.14)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + hw * 0.1, gm.hor - hh * 0.55);
      ctx.quadraticCurveTo(x + hw * 0.5, gm.hor - hh * 2, x + hw * 0.9, gm.hor - hh * 0.55);
      ctx.stroke();
    }
  }

  function drawSea(ctx, gm, t) {
    const { w, h } = W;
    if (!seaGrad) {
      seaGrad = ctx.createLinearGradient(0, gm.hor, 0, h);
      seaGrad.addColorStop(0, '#11444E');
      seaGrad.addColorStop(1, '#0A323C');
    }
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, gm.hor, w, h - gm.hor);
    /* sun glint on the distant water */
    const sunX = w * 0.62;
    ctx.strokeStyle = '#FFC46B';
    ctx.lineWidth = Math.max(1, h * 0.0035);
    for (const g2 of glints) {
      const y = gm.hor + g2.y * h;
      if (y > gm.edgeY(sunX) - h * 0.01) continue;
      ctx.globalAlpha = 0.16 + 0.2 * Math.abs(Math.sin(t * 2.6 + g2.p));
      ctx.beginPath();
      ctx.moveTo(sunX + g2.dx * w - g2.len * w / 2, y);
      ctx.lineTo(sunX + g2.dx * w + g2.len * w / 2, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function band(ctx, gm, pts, o1, o2, color) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) { const p = pts[i]; i ? ctx.lineTo(p.x, p.y + o1) : ctx.moveTo(p.x, p.y + o1); }
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].y + o2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawWave(ctx, gm, t) {
    const { w, h } = W;
    const N = 22, pts = [];
    for (let i = 0; i <= N; i++) { const x = gm.xA + (gm.xEnd - gm.xA) * i / N; pts.push({ x, y: gm.edgeY(x) }); }
    const tipX = gm.tipX, tipY = gm.tipY;
    const c1x = gm.xA - w * (0.07 - 0.04 * curlAmt), c1y = gm.yA - h * (0.018 + 0.012 * curlAmt);
    const c2x = tipX + w * (0.02 + 0.10 * curlAmt), c2y = tipY - h * (0.06 + 0.08 * curlAmt);
    const fX = gm.xA + w * (0.04 + 0.10 * curlAmt), fY = gm.edgeY(fX) - h * 0.008;
    const ic1x = tipX + w * 0.01, ic1y = tipY + h * 0.004;
    const ic2x = fX - w * 0.012, ic2y = fY + h * (0.02 + 0.10 * (1 - curlAmt));
    const yWW = x => tipY + h * 0.045 + Math.sin(x * 0.02 - t * 2.6 - scroll * 0.008) * h * 0.016 + Math.sin(x * 0.043 + t * 1.7) * h * 0.007;
    const e1x = Math.min(tipX + w * 0.11, gm.xEnd), e1y = gm.edgeY(e1x);

    /* body silhouette: whitewater -> crest -> lip -> face -> trough */
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, yWW(0));
    for (let i = 1; i <= 5; i++) { const x = gm.wwEnd * i / 5; ctx.lineTo(x, yWW(x)); }
    ctx.quadraticCurveTo((gm.wwEnd + gm.xA) / 2, yWW(gm.wwEnd) - h * 0.055, gm.xA, gm.yA);
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, tipX, tipY);
    ctx.quadraticCurveTo(tipX + w * 0.10, tipY + h * 0.035, e1x, e1y);
    for (const p of pts) if (p.x > e1x) ctx.lineTo(p.x, p.y);
    ctx.lineTo(gm.xEnd, h);
    ctx.closePath();
    if (!bodyGrad) {
      bodyGrad = ctx.createLinearGradient(0, gm.yA, 0, h);
      bodyGrad.addColorStop(0, '#0E5A64');
      bodyGrad.addColorStop(0.45, '#0B4550');
      bodyGrad.addColorStop(1, '#052029');
    }
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    /* layered water bands down the face */
    band(ctx, gm, pts, h * 0.04, h * 0.15, 'rgba(64,230,205,0.55)');
    band(ctx, gm, pts, h * 0.15, h * 0.33, 'rgba(20,140,148,0.42)');

    /* the lip: a thick curling crest */
    ctx.beginPath();
    ctx.moveTo(gm.xA, gm.yA);
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, tipX, tipY);
    ctx.bezierCurveTo(ic1x, ic1y, ic2x, ic2y, fX, fY);
    ctx.quadraticCurveTo((fX + gm.xA) / 2, (fY + gm.yA) / 2 - h * 0.012, gm.xA, gm.yA);
    ctx.closePath();
    const lg = ctx.createLinearGradient(0, gm.yA - h * 0.02, 0, tipY + h * 0.05);
    lg.addColorStop(0, '#F4FCFA'); lg.addColorStop(0.5, '#9FEBDC'); lg.addColorStop(1, '#2FD4BD');
    ctx.fillStyle = lg;
    ctx.fill();

    /* foam line along the unbroken face */
    ctx.strokeStyle = 'rgba(244,252,250,0.42)';
    ctx.lineWidth = Math.max(3, h * 0.026);
    ctx.beginPath();
    for (let i = 0; i <= N; i++) { const p = pts[i]; i ? ctx.lineTo(p.x, p.y + h * 0.02) : ctx.moveTo(p.x, p.y + h * 0.02); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(244,252,250,0.95)';
    ctx.lineWidth = Math.max(2, h * 0.013);
    ctx.beginPath();
    for (let i = 0; i <= N; i++) { const p = pts[i]; i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
    ctx.stroke();
    /* foam riding the outer lip */
    ctx.strokeStyle = 'rgba(248,253,251,0.9)';
    ctx.lineWidth = Math.max(2, h * 0.012);
    ctx.beginPath();
    ctx.moveTo(gm.xA, gm.yA);
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, tipX, tipY);
    ctx.stroke();

    /* barrel shadow under the curl */
    {
      const gx = Math.min(fX + w * 0.14, gm.xEnd), gy = gm.edgeY(gx);
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.bezierCurveTo(ic1x, ic1y, ic2x, ic2y, fX, fY);
      ctx.lineTo(gx, gy);
      ctx.quadraticCurveTo((tipX + gx) / 2, (tipY + gy) / 2 + h * 0.06, tipX, tipY);
      ctx.closePath();
      ctx.fillStyle = `rgba(3,20,26,${0.12 + 0.30 * curlAmt})`;
      ctx.fill();
    }

    /* broken whitewater washing in behind the curl */
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, yWW(0));
    for (let i = 1; i <= 8; i++) { const x = gm.wwEnd * i / 8; ctx.lineTo(x, yWW(x)); }
    ctx.lineTo(gm.wwEnd + w * 0.01, h);
    ctx.closePath();
    const wg = ctx.createLinearGradient(0, tipY, 0, tipY + h * 0.32);
    wg.addColorStop(0, 'rgba(242,251,248,0.98)');
    wg.addColorStop(0.35, 'rgba(214,242,236,0.78)');
    wg.addColorStop(1, 'rgba(170,220,212,0)');
    ctx.fillStyle = wg;
    ctx.fill();

    /* shimmer: subtle moving highlights on the face */
    ctx.lineWidth = Math.max(1, h * 0.003);
    for (const s of shimmer) {
      const pos = ((s.x + scroll * 0.00018) % 1 + 1) % 1;
      const x = gm.xA + w * 0.03 + pos * (gm.xEnd - gm.xA) * 0.88;
      const y = gm.edgeY(x) + s.d * h;
      if (y > gm.yF) continue;
      ctx.strokeStyle = `rgba(191,243,232,${0.05 + 0.09 * (0.5 + 0.5 * Math.sin(t * 2.2 + s.p))})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + s.len * w, y + h * 0.012);
      ctx.stroke();
    }

    /* water streaming up the face */
    ctx.save();
    ctx.setLineDash([w * 0.045, w * 0.10]);
    ctx.lineDashOffset = scroll * 0.35 + t * 20;
    ctx.strokeStyle = 'rgba(170,235,222,0.14)';
    ctx.lineWidth = Math.max(1.5, h * 0.006);
    for (const s of streaks) {
      const x0 = gm.xA + s.x * (gm.xEnd - gm.xA) * 0.55, y0 = gm.edgeY(x0) + s.d * h;
      if (y0 > gm.yF) continue;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + s.len * w * 0.5, y0 + h * 0.05, x0 + s.len * w, y0 + h * 0.11);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFore(ctx, gm, t) {
    const { w, h } = W;
    if (!foreGrad) {
      foreGrad = ctx.createLinearGradient(0, gm.yF, 0, h);
      foreGrad.addColorStop(0, '#072B33');
      foreGrad.addColorStop(1, '#03161E');
    }
    const row = i => gm.yF + Math.sin(w * i / 12 * 0.012 - t * 3.2) * h * 0.006 + Math.sin(w * i / 12 * 0.031 + t * 1.7) * h * 0.004;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i <= 12; i++) ctx.lineTo(w * i / 12, row(i));
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = foreGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(126,216,204,0.25)';
    ctx.lineWidth = Math.max(1, h * 0.003);
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) { const y = row(i); i ? ctx.lineTo(w * i / 12, y) : ctx.moveTo(w * i / 12, y); }
    ctx.stroke();
    /* fast highlights sell the scroll speed */
    ctx.save();
    ctx.setLineDash([w * 0.06, w * 0.11]);
    ctx.lineDashOffset = scroll * 1.4;
    ctx.strokeStyle = 'rgba(190,240,230,0.13)';
    ctx.lineWidth = Math.max(1.5, h * 0.005);
    for (const dy of [0.035, 0.075]) {
      ctx.beginPath();
      ctx.moveTo(0, gm.yF + dy * h);
      ctx.lineTo(w, gm.yF + dy * h);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSurfer(ctx, gm, gg) {
    const { w, h } = W;
    const sx = w * SURF_X;
    let sy, rot, airPose = 0;
    if (state === 'air') {
      sy = surfY(gm) - airY;
      rot = -0.10 + spin;
      airPose = 1;
    } else if (state === 'wipe') {
      sy = h * 0.79 + (wipeT / WIPE_DUR) * h * 0.09;
      rot = wipeRot;
    } else {
      sy = surfY(gm) + Math.sin(gg.t * 3) * h * 0.004;
      rot = -0.12 + (1 - u) * 0.14 + lean * 0.42;
    }
    const L = Kit.clamp(Math.min(w, h) * 0.16, 44, 110);

    /* speed glow under the board */
    const gl = ctx.createRadialGradient(sx, sy + L * 0.1, 2, sx, sy + L * 0.1, L * 0.9);
    gl.addColorStop(0, `rgba(255,196,107,${0.10 + 0.22 * Kit.clamp(speed, 0, 1)})`);
    gl.addColorStop(1, 'rgba(255,196,107,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(sx - L, sy - L * 0.4, L * 2, L * 1.2);

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rot);

    /* board */
    ctx.fillStyle = '#0B2F36';
    ctx.beginPath();
    ctx.moveTo(-L * 0.5, 0);
    ctx.quadraticCurveTo(0, -L * 0.115, L * 0.5, -L * 0.045);
    ctx.quadraticCurveTo(L * 0.52, -L * 0.005, L * 0.46, L * 0.01);
    ctx.quadraticCurveTo(0, -L * 0.015, -L * 0.44, L * 0.035);
    ctx.quadraticCurveTo(-L * 0.53, L * 0.03, -L * 0.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,196,107,0.85)';
    ctx.lineWidth = Math.max(1, L * 0.02);
    ctx.beginPath();
    ctx.moveTo(-L * 0.42, -L * 0.004);
    ctx.quadraticCurveTo(0, -L * 0.098, L * 0.44, -L * 0.036);
    ctx.stroke();

    /* rider silhouette with pose states */
    const crouch = state === 'air' ? 0.45 : tubeOn ? 0.8 : lean < -0.3 ? 0.2 : lean > 0.3 ? 0.7 : 0.35;
    const ink = '#07222A';
    const fx1 = -L * 0.17, fx2 = L * 0.19, fy = -L * 0.03;
    const hipX = -L * 0.01 + lean * L * 0.04, hipY = -L * (0.17 - 0.08 * crouch);
    const shX = hipX + L * 0.045 - lean * L * 0.05, shY = hipY - L * (0.15 - 0.04 * crouch);
    ctx.strokeStyle = ink;
    ctx.lineCap = 'round';
    ctx.lineWidth = L * 0.055;
    ctx.beginPath();
    ctx.moveTo(fx1, fy);
    ctx.quadraticCurveTo((fx1 + hipX) / 2 - L * 0.02, (fy + hipY) / 2 + L * 0.02, hipX, hipY);
    ctx.moveTo(fx2, fy);
    ctx.quadraticCurveTo((fx2 + hipX) / 2 + L * 0.02, (fy + hipY) / 2 + L * 0.02, hipX + L * 0.01, hipY);
    ctx.stroke();
    ctx.lineWidth = L * 0.078;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(shX, shY);
    ctx.stroke();
    ctx.lineWidth = L * 0.05;
    const armF = airPose ? [shX + L * 0.26, shY - L * 0.16] : crouch > 0.6 ? [shX + L * 0.12, shY + L * 0.10] : [shX + L * 0.22, shY + L * 0.08];
    const armB = airPose ? [shX - L * 0.26, shY - L * 0.20] : lean < -0.3 ? [shX - L * 0.20, shY - L * 0.24] : [shX - L * 0.22, shY + L * 0.06];
    ctx.beginPath();
    ctx.moveTo(shX, shY);
    ctx.lineTo(armF[0], armF[1]);
    ctx.moveTo(shX, shY);
    ctx.lineTo(armB[0], armB[1]);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(shX + L * 0.02, shY - L * 0.095, L * 0.075, 0, Math.PI * 2);
    ctx.fill();
    /* sunset rim light on the sunward side */
    ctx.strokeStyle = 'rgba(255,196,107,0.55)';
    ctx.lineWidth = Math.max(1, L * 0.016);
    ctx.beginPath();
    ctx.arc(shX + L * 0.02, shY - L * 0.095, L * 0.075, -0.9, 0.7);
    ctx.stroke();
    ctx.restore();
  }

  function render(ctx, gg) {
    const { w, h } = W;
    const gm = geom();
    const t = gg.t;

    drawSky(ctx, gm, t);
    drawHeadland(ctx, gm);
    drawSea(ctx, gm, t);
    drawWave(ctx, gm, t);
    drawSurfer(ctx, gm, gg);
    drawFore(ctx, gm, t);
    particles.render(ctx);

    /* barrel tint while the lip is over you */
    if (curlAmt > 0.03) {
      const a = curlAmt * (tubeOn ? 1 : 0.5);
      ctx.fillStyle = `rgba(8,44,50,${0.15 * a})`;
      ctx.fillRect(0, 0, w, h);
      const rg = ctx.createRadialGradient(w * SURF_X, h * 0.5, Math.min(w, h) * 0.22, w * SURF_X, h * 0.5, Math.max(w, h) * 0.72);
      rg.addColorStop(0, 'rgba(2,14,18,0)');
      rg.addColorStop(1, `rgba(2,14,18,${0.42 * a})`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }

    if (!vignette || vignette.w !== w) {
      vignette = { w, g: ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.76) };
      vignette.g.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.g.addColorStop(1, 'rgba(3,10,14,0.42)');
    }
    ctx.fillStyle = vignette.g;
    ctx.fillRect(0, 0, w, h);

    updateHUD();
  }

  /* ---------------- HUD ---------------- */
  let hudEls = null, lastHearts = -1, popEl = null;
  function buildHUD() {
    const hud = document.getElementById('hud');
    hud.innerHTML = `
      <div class="hud-top">
        <div class="chip score-chip"><small>Score</small><b id="hw-score">0</b></div>
        <div class="chip hearts-chip"><small>Hearts</small><span class="hearts" id="hw-hearts"></span></div>
        <div class="chip speed-chip"><small>Speed</small><div class="meter"><i id="hw-speed"></i></div></div>
      </div>
      <div class="hud-bottom">
        <div class="chip tube-chip" id="hw-tube-chip" hidden><small>Tube</small><b id="hw-tube">0.0s</b></div>
      </div>`;
    hudEls = {
      score: document.getElementById('hw-score'),
      hearts: document.getElementById('hw-hearts'),
      speed: document.getElementById('hw-speed'),
      tubeChip: document.getElementById('hw-tube-chip'),
      tube: document.getElementById('hw-tube')
    };
    lastHearts = -1;
  }

  function updateHUD() {
    if (!hudEls || state === 'attract') return;
    hudEls.score.textContent = Kit.fmt(Math.floor(score));
    if (hearts !== lastHearts) {
      lastHearts = hearts;
      hudEls.hearts.innerHTML = '<i>♥</i>'.repeat(hearts) + '<i class="off">♥</i>'.repeat(Math.max(0, 3 - hearts));
    }
    const r = Kit.clamp(speed / MAXS, 0, 1);
    hudEls.speed.style.width = (6 + 94 * r) + '%';
    hudEls.speed.style.background = speed < MINS + 0.05 ? '#FF6B5C' : r > 0.82 ? '#FFC46B' : '';
    hudEls.tubeChip.hidden = !tubeOn;
    if (tubeOn) hudEls.tube.textContent = tubeCur.toFixed(1) + 's';
  }

  function popTrick(txt, sub, bad) {
    if (!popEl) {
      popEl = document.createElement('div');
      popEl.className = 'trick-pop';
      popEl.innerHTML = '<b></b><span></span>';
      document.querySelector('.game-root').appendChild(popEl);
    }
    popEl.firstChild.textContent = txt;
    popEl.lastChild.textContent = sub || '';
    popEl.classList.toggle('bad', !!bad);
    popEl.classList.remove('on');
    void popEl.offsetWidth;
    popEl.classList.add('on');
  }

  /* ---------------- songs ---------------- */
  Audio.defineSong('menu', {
    bpm: 84,
    layers: [
      { type: 'pad', wave: 'sawtooth', steps: 'F2 - - - - - - - - - - - - - - - C3 - - - - - - - - - - - - - - -', gain: 0.13, cutoff: 720, attack: 0.6, release: 2.2 },
      { type: 'pad', wave: 'triangle', steps: 'A2 - - - - - - - - - - - - - - - G2 - - - - - - - - - - - - - - -', gain: 0.10, cutoff: 900, attack: 0.8, release: 2.4 },
      { type: 'bass', wave: 'triangle', steps: 'F1 . . . . . . . C2 . . . . . . . A1 . . . . . . . C2 . . . . . . .', gain: 0.26 },
      { type: 'arp', wave: 'triangle', steps: 'A3 . C4 . E4 . C4 . F3 . A3 . C4 . E4 . G3 . B3 . D4 . B3 . C4 . E4 . G4 . E4 .', gain: 0.085, cutoff: 1600 },
      { type: 'hat', steps: '. . . a . . . . . . a . . . . . . . . a . . . . . . a . . . a .', gain: 0.06 }
    ]
  });
  Audio.defineSong('surf', {
    bpm: 96,
    layers: [
      { type: 'kick', steps: 'a . . . . . . . a . . . . . . . a . . . . . . . a . . . . . a .', gain: 0.5 },
      { type: 'hat', steps: '. . a . . a . . . . a . . a . . . . a . . a . . . . a . a . a a', gain: 0.09 },
      { type: 'bass', wave: 'triangle', steps: 'F1 . . . . . A1 . C2 . . . A1 . G1 . F1 . . . . . A1 . C2 . . . D2 . C2 .', gain: 0.24, cutoff: 560 },
      { type: 'arp', wave: 'triangle', steps: 'F3 . A3 . C4 . A3 . F3 . A3 . C4 . E4 . D3 . F3 . A3 . F3 . C4 . . . A3 . G3 .', gain: 0.11, cutoff: 2000 },
      { type: 'lead', wave: 'sawtooth', steps: '. . . . . . . . . . . . . . . . G4 . . A4 . . C5 . . A4 . G4 . . . .', gain: 0.12, cutoff: 3000, intensity: true },
      { type: 'pad', wave: 'sawtooth', steps: 'F2 - - - - - - - - - - - - - - - D2 - - - - - - - - - - - - - - -', gain: 0.08, cutoff: 640, attack: 0.5, release: 1.8 }
    ]
  });

  /* ---------------- shell wiring ---------------- */
  window.GAME = {
    id: 'ripcurrent-surf',
    brand: 'RIPCURRENT',
    kicker: 'Sunset Point Break',
    title: 'RIP<em>CURRENT</em>',
    tagline: 'Carve the evening glass at a lonely point break — climb the face, launch off the lip and thread the barrel before the sun drops.',
    best: { key: 'surf.best', display: Kit.fmt },
    controls: [
      { key: '▲ / ▼', text: '<b>Carve up / drop down the face.</b> Climbing bleeds speed, dropping banks it. Stall under the red line and the wave eats you.' },
      { key: 'Space / tap ↑', text: '<b>Launch off the lip.</b> Pop out while high and fast — the board spins and you stick it by landing flat.' },
      { key: 'Tricks', text: '<b>FLOATY AIR 50 · AIR 180 100 · BIG SPIN 150.</b> Clean landings stack a streak multiplier; a steep landing or a nose-dive into the trough is a wipeout.' },
      { key: 'Tube', text: '<b>When the lip pitches, stay in the middle band.</b> Tube time scores +10/s and everything counts double while the barrel holds.' },
      { key: 'Hearts', text: '<b>Three hearts.</b> A wipeout costs one and you paddle back out on the next wave. Lose them all and the session is over.' },
      { key: 'Sets', text: '<b>Waves roll in sets</b> — each one scrolls faster and stands up steeper. A 3s channel between waves to catch your breath.' }
    ],
    touch: {
      joy: true,
      buttons: [{ name: 'action', label: 'JUMP', primary: true }]
    },
    mascot: {
      name: 'Kai — beach buddy',
      accent: '#4ED8C8',
      lines: {
        welcome: ['Kai here. Evening glass is firing — best session window of the day.', 'Yo! The point is working. Paddle out before the light goes.'],
        return: ['Wind dropped off. Waves are waiting.', 'Board is waxed. Sun is dropping. Let us go.'],
        start: ['Paddle, pop up, and stay loose.', 'First set is rolling in. Eyes on the lip.'],
        trick: ['Clean spin! Judges would have clapped.', 'Looked light as foam. Again!'],
        tube: ['YOU ARE IN THE TUBE — stay low, stay in!', 'Barreled! This is the shot for the wall.'],
        wipeout: ['Big one! Shake it off, plenty of waves left.', 'The ocean always wins one. Two hearts left.'],
        set: ['New set on the horizon — bigger grade.', 'Set wave incoming. Pick your line early.'],
        win: ['Session of the month. Sunset got its show.', 'Waves surfed, sun saluted. Legend behavior.'],
        fail: ['Out of hearts... the tide waits for no one.', 'Rough session. The point will forgive you.']
      },
      cooldowns: { trick: 6000, tube: 10000, wipeout: 6000, set: 12000 }
    },
    learn: {
      intro: window.LEARN_DATA.intro,
      banks: window.LEARN_DATA.banks
    },
    menuSong: 'menu',
    gameSong: 'surf',
    onStart() { startRun(); Kit.showScreen('hud'); },
    onRestart() { startRun(); },
    onPause() { G.pause(); Audio.stopLoop('ocean'); Audio.stopSong({ fade: 0.5 }); },
    onResume() {
      if (state !== 'attract' && state !== 'done') {
        G.resume();
        Audio.playSong('surf');
        Audio.loop('ocean', OCEAN);
      }
    },
    onQuit() { G.stop(); Audio.stopSong({ fade: 0.3 }); toAttract(); G.start(); }
  };

  /* ---------------- boot ---------------- */
  const canvas = document.getElementById('stage');
  G = Kit.game({
    canvas,
    onResize(dim) {
      W.w = dim.w; W.h = dim.h;
      skyGrad = null; seaGrad = null; bodyGrad = null; foreGrad = null; vignette = null;
    },
    update,
    render
  });

  buildScene();
  toAttract();
  G.start();

})();
