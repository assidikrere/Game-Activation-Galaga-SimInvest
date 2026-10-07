import * as THREE from './vendor/three.module.js';

const $ = id => document.getElementById(id);
const canvas = $('space');
const clamp = THREE.MathUtils.clamp;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ROUND_SECONDS = 60;
const MAX_ATTEMPTS = 2;
let session = { attempts: 0, best: 0 };
const persist = () => {};
let authorizedSession=false, authorizedStart=false, track='kyc', roundId=null, transitionTime=0,resumeState='playing';
let state = 'intro';
let elapsed = 0, score = 0, shields = 3, kills = 0, rings = 0, invulnerable = 0;
let phase = 0, lastShot = 0, nextAsteroid = 0, nextDrone = 0, nextRing = 0;
let rngState = 601307, boss = null, bossWon = false, bossShotAt = 0;
let renderer, scene, camera, ship, exhaust, moon, earth, starPositions, stars;
let targetX = 0, targetY = -1.7, maxX = 7, playerY = -1.7;
let lastTime = performance.now(), ambientTime = 0, pointer = null, toastUntil = 0, damageUntil = 0;
let soundEnabled = false, audio = null;
const keys = new Set();
const entities = [], projectiles = [], particles = [];
const materials = {}, geometries = {};
const random = () => { rngState = (Math.imul(1664525, rngState) + 1013904223) >>> 0; return rngState / 4294967296; };
const range = (a, b) => a + (b - a) * random();

function syncAttempts() {
  const remaining = MAX_ATTEMPTS - session.attempts;
  $('attemptNote').textContent = `${remaining} dari 2 kesempatan tersisa untuk jalur ${track.toUpperCase()}.`;
  $('start').disabled = !renderer || !authorizedSession || remaining === 0;
  $('start').innerHTML = remaining ? `START RETURN FLIGHT <span>↗</span>` : '2 KESEMPATAN SUDAH DIPAKAI';
  $('retry').hidden = remaining === 0;
  $('retry').innerHTML = `MAIN SEKALI LAGI <span>↗</span>`;
  $('reset').hidden = true;
  $('resetIntro').hidden = true;
}

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
}

function buildShip() {
  const group = new THREE.Group();
  const profile=[new THREE.Vector2(0,-1.55),new THREE.Vector2(.4,-1.52),new THREE.Vector2(.63,-1.1),new THREE.Vector2(.76,-.35),new THREE.Vector2(.69,.65),new THREE.Vector2(.48,1.15),new THREE.Vector2(0,1.18)];
  group.add(mesh(new THREE.LatheGeometry(profile,32),materials.white));
  const noseProfile=[new THREE.Vector2(0,1.1),new THREE.Vector2(.5,1.1),new THREE.Vector2(.46,1.4),new THREE.Vector2(.33,1.78),new THREE.Vector2(.13,2.12),new THREE.Vector2(0,2.3)];
  group.add(mesh(new THREE.LatheGeometry(noseProfile,32),materials.orange));
  const collar=mesh(new THREE.TorusGeometry(.5,.035,8,32),materials.orange,0,1.14,0);collar.rotation.x=Math.PI/2;group.add(collar);
  const windowRim=mesh(new THREE.TorusGeometry(.32,.085,10,32),materials.orange,0,.45,.7);group.add(windowRim);
  const glass=mesh(new THREE.SphereGeometry(.28,24,16),materials.glass,0,.45,.75);glass.scale.z=.35;group.add(glass);
  for(const side of [-1,1]){
    const shape=new THREE.Shape();shape.moveTo(.53,-.62);shape.bezierCurveTo(1.2,-.76,1.6,-1.38,1.45,-2.03);shape.bezierCurveTo(1.12,-1.45,.86,-1.36,.45,-1.55);shape.closePath();
    const fin=mesh(new THREE.ExtrudeGeometry(shape,{depth:.14,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.035,bevelThickness:.035}),materials.orange);
    fin.scale.x=side;fin.position.z=-.07;group.add(fin);
  }
  const middleFin=mesh(new THREE.CapsuleGeometry(.095,1.1,4,12),materials.orange,0,-1.05,.72);group.add(middleFin);
  const nozzle=mesh(new THREE.CylinderGeometry(.35,.28,.3,20),materials.orange,0,-1.62,0);group.add(nozzle);
  exhaust=mesh(new THREE.ConeGeometry(.27,1.25,14),materials.flame,0,-2.33,0);exhaust.rotation.z=Math.PI;group.add(exhaust);
  const glow=new THREE.PointLight(0xa855f7,3,7);glow.position.set(0,-1.8,0);group.add(glow);
  group.scale.setScalar(.52);return group;
}

function makeAsteroidGeometry(seed) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const positions = geo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const bump = 1 + .16 * Math.sin(x * 8 + seed) * Math.cos(y * 7 + z * 9 + seed);
    positions.setXYZ(i, x * bump, y * bump, z * bump);
  }
  geo.computeVertexNormals();
  return geo;
}

function initialize() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x080e1d);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x080e1d, 70, 210);
  camera = new THREE.PerspectiveCamera(55, 1, .1, 350);
  camera.position.set(0, 1.2, -16);
  camera.lookAt(0, -.6, 0);
  scene.add(new THREE.HemisphereLight(0xb8dfff, 0x191526, 2.4));
  const sun = new THREE.DirectionalLight(0xffe0c4, 3.4);
  sun.position.set(-10, 16, 12); scene.add(sun);
  const rim = new THREE.DirectionalLight(0x48bdd9, 2);
  rim.position.set(10, -3, -20); scene.add(rim);
  materials.white = new THREE.MeshStandardMaterial({ color: 0xe7dfff, metalness: .2, roughness: .34 });
  materials.orange = new THREE.MeshStandardMaterial({ color: 0x8d44c8, emissive: 0x32104b, emissiveIntensity: .25, metalness: .28, roughness: .32 });
  materials.glass = new THREE.MeshStandardMaterial({ color: 0x52dbe9, emissive: 0x125c7f, emissiveIntensity: 1, metalness: .8, roughness: .15 });
  materials.flame = new THREE.MeshBasicMaterial({ color: 0xffbc6b, transparent: true, opacity: .9 });
  materials.asteroid = new THREE.MeshStandardMaterial({ color: 0x627987, roughness: 1, flatShading: true });
  materials.drone = new THREE.MeshStandardMaterial({ color: 0x7e4d83, emissive: 0x381629, metalness: .5, roughness: .6 });
  materials.ring = new THREE.MeshBasicMaterial({ color: 0x81f2e1 });
  materials.shot = new THREE.MeshBasicMaterial({ color: 0xa7ffec });
  materials.hostile = new THREE.MeshBasicMaterial({ color: 0xff744d });
  materials.fragment = new THREE.MeshBasicMaterial({ color: 0xffb267, transparent: true });
  geometries.asteroids = [1, 2, 3].map(makeAsteroidGeometry);
  geometries.drone = new THREE.OctahedronGeometry(1, 0);
  geometries.pod = new THREE.SphereGeometry(.28, 6, 4);
  geometries.ring = new THREE.TorusGeometry(1.25, .07, 5, 24);
  geometries.shot = new THREE.CylinderGeometry(.055, .055, 1.6, 5);
  geometries.hostile = new THREE.SphereGeometry(.25, 6, 4);
  geometries.fragment = new THREE.TetrahedronGeometry(.16);
  ship = buildShip();
  ship.position.set(0, -1, 0);ship.rotation.y=Math.PI;
  scene.add(ship);

  // Procedural scenery and all game models are built locally, with no external image assets.
  const moonGeo = new THREE.IcosahedronGeometry(15, 4);
  const pos = moonGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const size = 1 + .011 * Math.sin(x * 2.7) * Math.cos(y * 2.2 + z);
    pos.setXYZ(i, x * size, y * size, z * size);
  }
  moonGeo.computeVertexNormals();
  moon = mesh(moonGeo, new THREE.MeshStandardMaterial({ color: 0x839aaa, roughness: 1, flatShading: true }), 0, 8, 72);
  scene.add(moon);
  const orbit = mesh(new THREE.TorusGeometry(24, .04, 4, 100), new THREE.MeshBasicMaterial({ color: 0x244657, transparent: true, opacity: .5 }), 0, 8, 72);
  orbit.rotation.x = .7; orbit.rotation.y = .3; scene.add(orbit);
  const map=document.createElement('canvas');map.width=1024;map.height=512;const paint=map.getContext('2d');
  paint.fillStyle='#136591';paint.fillRect(0,0,1024,512);
  const land=[[[60,100],[110,65],[180,70],[230,125],[200,166],[159,179],[135,205],[92,172]],[[188,223],[250,243],[263,285],[240,342],[207,403],[187,321]],[[398,95],[455,87],[473,116],[443,151],[404,145]],[[436,164],[506,159],[553,200],[531,282],[478,321],[448,261]],[[470,92],[540,70],[662,82],[755,120],[782,184],[708,212],[657,171],[617,199],[567,149]],[[698,295],[762,291],[800,329],[755,350],[710,330]],[[305,70],[335,40],[352,73],[326,105]],[[621,242],[665,235],[699,254],[674,269]]];
  for(const poly of land){paint.beginPath();poly.forEach(([x,y],i)=>i?paint.lineTo(x,y):paint.moveTo(x,y));paint.closePath();paint.fillStyle='#60b98d';paint.fill();}
  paint.fillStyle='#d9eff4';paint.fillRect(0,0,1024,24);paint.fillRect(0,476,1024,36);
  const earthTexture=new THREE.CanvasTexture(map);earthTexture.colorSpace=THREE.SRGBColorSpace;
  earth=mesh(new THREE.SphereGeometry(20,40,24),new THREE.MeshStandardMaterial({map:earthTexture,roughness:.88,emissive:0x063448,emissiveIntensity:.25}),0,9,-145);
  earth.rotation.y=.65;scene.add(earth);
  const atmosphere=mesh(new THREE.SphereGeometry(20.5,32,20),new THREE.MeshBasicMaterial({color:0x65dfff,transparent:true,opacity:.13,side:THREE.BackSide}),0,9,-145);earth.add(atmosphere);atmosphere.position.set(0,0,0);
  starPositions = new Float32Array(950 * 3);
  for (let i = 0; i < starPositions.length; i += 3) {
    starPositions[i] = range(-120, 120); starPositions[i + 1] = range(-75, 75); starPositions[i + 2] = range(-220, 10);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xa5cbd7, size: .18, transparent: true, opacity: .8, sizeAttenuation: true }));
  scene.add(stars);
  for (let i = 0; i < 14; i++) spawnAsteroid(true);
  resize();
  syncAttempts();
  $('flightStatus').textContent = 'MOON → EARTH · CREW VERIFIED';
  if(parent!==window) parent.postMessage({type:'return-ready'},location.origin);
  requestAnimationFrame(frame);
}

function resize() {
  if (!renderer) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Pull camera back on portrait displays so the ship and playable width remain visible.
  if(state==='playing') camera.position.z=camera.aspect<.8?25:20;
  camera.updateProjectionMatrix();
  maxX = clamp(Math.tan(55 * Math.PI / 360) * ((camera.aspect<.8?25:20) - 4) * camera.aspect * .75, 2.3, 8.8);
  targetX = clamp(targetX, -maxX, maxX);
}
window.addEventListener('resize', resize);

function spawnAsteroid(ambient = false) {
  const radius = range(.55, 1.35);
  const obj = mesh(geometries.asteroids[Math.floor(random() * 3)], materials.asteroid);
  obj.scale.setScalar(radius);
  obj.position.set(range(-maxX * 1.35, maxX * 1.35), range(-3.7, 4.8), ambient ? range(-95, -6) : -85);
  scene.add(obj);
  entities.push({ type: 'asteroid', obj, radius, hp: 3, speed: range(19, 27), spin: range(-.7, .7), ambient });
}

function spawnDrone() {
  const obj = new THREE.Group();
  obj.add(mesh(geometries.drone, materials.drone));
  obj.add(mesh(geometries.pod, materials.orange, -1, 0, 0));
  obj.add(mesh(geometries.pod, materials.orange, 1, 0, 0));
  obj.add(mesh(new THREE.BoxGeometry(.65, .12, .2), materials.hostile, 0, .15, .7));
  obj.position.set(range(-maxX, maxX), range(-2.8, 2.6), -72);
  scene.add(obj);
  entities.push({ type: 'drone', obj, radius: .8, hp: 2, speed: range(19, 24), baseX: obj.position.x, wave: range(0, 6), shotAt: elapsed + 1.7 });
}

function spawnRing() {
  const obj = mesh(geometries.ring, materials.ring, range(-maxX * .8, maxX * .8), range(-2.7, 2.7), -76);
  scene.add(obj);
  entities.push({ type: 'ring', obj, radius: 1.3, speed: 23, used: false });
}

function spawnBoss() {
  const obj = new THREE.Group();
  const shell = mesh(new THREE.IcosahedronGeometry(2.45, 1), materials.drone);
  shell.scale.set(1.6, .7, .5); obj.add(shell);
  const core = mesh(new THREE.IcosahedronGeometry(.9, 1), materials.orange, 0, 0, 1.1);
  obj.add(core);
  const hoop = mesh(new THREE.TorusGeometry(3.6, .18, 6, 32), materials.orange);
  hoop.scale.y = .55; obj.add(hoop);
  for (const side of [-1, 1]) {
    const pod = mesh(new THREE.OctahedronGeometry(.9), materials.white, side * 4, -.2, .2);
    obj.add(pod);
  }
  obj.position.set(0, 1, -48); scene.add(obj);
  boss = { obj, core, hp: 40, maxHp: 40 };
  $('bossHud').hidden = false;
  bossShotAt = elapsed + 2;
}

function fire() {
  for (const side of [-1, 1]) {
    const obj = mesh(geometries.shot, materials.shot, ship.position.x + side * .56, ship.position.y, ship.position.z - 1.3);
    obj.rotation.x = Math.PI / 2;
    scene.add(obj);
    projectiles.push({ type: 'player', obj, speed: 85, life: 1.9 });
  }
  beep(580, .022, .025, 'triangle');
}

function hostileFire(origin, aimed = true) {
  const obj = mesh(geometries.hostile, materials.hostile, origin.x, origin.y, origin.z + 1);
  const direction = aimed ? new THREE.Vector3().subVectors(ship.position, origin).normalize() : new THREE.Vector3(0, 0, 1);
  scene.add(obj);
  projectiles.push({ type: 'enemy', obj, direction, speed: 24, life: 4 });
}

function burst(position, color = 0xffb267, count = 9) {
  for (let i = 0; i < count; i++) {
    const obj = mesh(geometries.fragment, materials.fragment, position.x, position.y, position.z);
    // Shared material keeps particle creation cheap; use scale and velocity for variation.
    obj.scale.setScalar(range(.6, 2)); scene.add(obj);
    particles.push({ obj, velocity: new THREE.Vector3(range(-5, 5), range(-4, 4), range(-3, 6)), life: range(.35, .8) });
  }
  beep(color === 0x81f2e1 ? 900 : 120, .08, .09, 'sawtooth');
}

function removeAt(list, index) {
  scene.remove(list[index].obj);
  if (list[index].type === 'drone') {
    // This is the only per-drone geometry; every other geometry is shared.
    list[index].obj.children[3].geometry.dispose();
  }
  list.splice(index, 1);
}

function clearWorld() {
  while (entities.length) removeAt(entities, entities.length - 1);
  while (projectiles.length) removeAt(projectiles, projectiles.length - 1);
  while (particles.length) removeAt(particles, particles.length - 1);
  if (boss) { boss.obj.traverse(child => { if (child.isMesh) child.geometry.dispose(); }); scene.remove(boss.obj); boss = null; }
}

function message(text, seconds = 2.3) {
  $('toast').textContent = text;
  $('toast').classList.add('show');
  toastUntil = ambientTime + seconds;
}

function hit() {
  if (state !== 'playing' || invulnerable > 0) return;
  shields--; invulnerable = 1.8;
  damageUntil = ambientTime + .18;
  $('app').classList.add('damage');
  burst(ship.position);
  updateHud();
  if (shields <= 0) finish(false, 'Shield habis. Misinya bisa dicoba lagi kalau masih ada kesempatan.');
  else message(`SHIELD HIT · ${shields} TERSISA`, 1.2);
}

function updateHud() {
  $('score').textContent = String(Math.floor(score)).padStart(5, '0');
  $('timer').innerHTML = `${Math.max(0, Math.ceil(ROUND_SECONDS - elapsed))}<span>s</span>`;
  $('shield').textContent = Array.from({ length: 3 }, (_, i) => i < shields ? '●' : '○').join(' ');
  $('shield').setAttribute('aria-label', `${shields} shield tersisa`);
  $('progressFill').style.width = `${elapsed / ROUND_SECONDS * 100}%`;
}

function start() {
  if (!renderer || !authorizedStart || state!=='intro') return;
  authorizedStart=false;
  clearWorld(); rngState = 601307; // Both attempts start with the same obstacle sequence.
  elapsed = score = kills = rings = phase = lastShot = 0;
  shields = 3; invulnerable = 1.4; bossWon = false;
  nextAsteroid = .7; nextDrone = 20.6; nextRing = 2;
  targetX = 0; targetY = playerY = -1.7;
  ship.position.set(0,-1,0);ship.scale.setScalar(.26);ship.rotation.set(0,Math.PI,0);ship.visible=true;
  state = 'transition'; transitionTime=0; keys.clear(); pointer=null; $('bridgeRocket').hidden=false; $('transitionCaption').hidden=false;
  $('intro').hidden = $('result').hidden = $('pauseScreen').hidden = true;
  $('hud').hidden=true;$('bossHud').hidden=true;
  $('phaseLabel').textContent = '01 / ASTEROID BELT';
  [1, 2, 3].forEach(n => $('stage' + n).classList.toggle('active', n === 1));
  $('app').classList.add('running');
  $('flightStatus').textContent = 'GESER JARI · TEMBAKAN OTOMATIS';
  updateHud(); syncAttempts();
  canvas.focus({ preventScroll: true });
  if (soundEnabled) ensureAudio();
  message('LEAVING THE MOON · BRING IT HOME',3);
}

function finish(success, explanation) {
  if (!['playing','paused'].includes(state)) return;
  $('bridgeRocket').hidden=true;$('transitionCaption').hidden=true;
  state = 'result'; pointer = null; keys.clear(); ship.visible = true;
  if (success) score += 2000 + shields * 500;
  const final = Math.floor(score);
  session.best = Math.max(session.best, final); persist();
  $('hud').hidden = $('bossHud').hidden = $('pauseScreen').hidden = true;
  $('result').hidden = false;
  $('app').classList.remove('running', 'damage');
  $('toast').classList.remove('show');
  $('toast').textContent = '';
  $('resultEyebrow').textContent = success ? 'MISSION COMPLETE' : 'FLIGHT ENDED';
  $('resultTitle').textContent = success ? 'Welcome home.' : 'Return interrupted.';
  $('resultMessage').textContent = explanation;
  $('finalScore').textContent = final.toLocaleString('id-ID');
  $('dronesStat').textContent = kills;
  $('ringsStat').textContent = rings;
  $('bossStat').textContent = bossWon ? 'CLEAR' : '—';
  $('bestScore').textContent = `${track.toUpperCase()} · ${MAX_ATTEMPTS-session.attempts}/2 kesempatan tersisa`;
  $('flightStatus').textContent='RETURN FLIGHT COMPLETE · YOUR JOURNEY CONTINUES';
  parent.postMessage({type:'return-finished',roundId,score:final,success},location.origin);
  syncAttempts();
  (session.attempts < MAX_ATTEMPTS ? $('retry') : $('backResult')).focus({preventScroll:true});
  beep(success ? 660 : 180, .25, .12, 'sine');
}

function pause() {
  if(!['playing','transition'].includes(state))return;
  resumeState=state;state='paused'; keys.clear(); pointer = null;
  $('pauseScreen').hidden = false; $('toast').classList.remove('show');
  $('resume').focus({ preventScroll: true });
}
function resume() {
  if (state !== 'paused') return;
  state=resumeState;lastTime=performance.now();
  $('pauseScreen').hidden = true; canvas.focus({ preventScroll: true });
}

function step(dt) {
  elapsed += dt; invulnerable = Math.max(0, invulnerable - dt);
  score += dt * 55;
  const dx = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
  const dy = Number(keys.has('arrowup') || keys.has('w')) - Number(keys.has('arrowdown') || keys.has('s'));
  targetX = clamp(targetX + dx * dt * 7.5, -maxX, maxX);
  targetY = clamp(targetY + dy * dt * 6, -3.1, 3.2);
  const lateral = targetX - ship.position.x;
  ship.position.x += lateral * (1 - Math.exp(-dt * 10));
  ship.position.y += (targetY - ship.position.y) * (1 - Math.exp(-dt * 10));
  ship.rotation.z = clamp(-lateral * .25, -.42, .42);
  ship.rotation.x=-Math.PI/2+clamp((targetY-ship.position.y)*.12,-.15,.15);
  ship.visible = invulnerable <= 0 || Math.floor(elapsed * 12) % 2 === 0;
  if(elapsed>=lastShot){fire();lastShot=elapsed+(track==='transact'?.15:.18);}
  if (elapsed >= 20 && phase === 0) {
    phase = 1; $('phaseLabel').textContent = '02 / ORBIT DEFENCE';
    $('stage1').classList.remove('active'); $('stage2').classList.add('active');
    message('ORBIT DEFENCE · AIM & FIRE');
  }
  if (elapsed >= 40 && phase === 1) {
    phase = 2; $('phaseLabel').textContent = '03 / ORBITAL GUARDIAN';
    $('stage2').classList.remove('active'); $('stage3').classList.add('active');
    shields = Math.min(3, shields + 1); invulnerable = 1.7;
    spawnBoss(); message('ORBITAL GUARDIAN · +1 SHIELD', 3);
  }
  if (elapsed >= nextAsteroid && phase < 2) {
    spawnAsteroid(); nextAsteroid = elapsed + (phase === 0 ? .67 : 1.35);
  }
  if (elapsed >= nextDrone && phase === 1) { spawnDrone(); nextDrone = elapsed + 1.4; }
  if (elapsed >= nextRing && phase < 2) { spawnRing(); nextRing = elapsed + 3.2; }

  for (let i = entities.length - 1; i >= 0; i--) {
    const e = entities[i]; e.obj.position.z += e.speed * dt;
    if (e.type === 'asteroid') { e.obj.rotation.x += dt * e.spin; e.obj.rotation.y += dt * .3; }
    if (e.type === 'drone') {
      e.obj.position.x = clamp(e.baseX + Math.sin(elapsed * 1.2 + e.wave) * 1.35, -maxX, maxX);
      e.obj.rotation.z = Math.sin(elapsed * 2 + e.wave) * .2;
      if (elapsed >= e.shotAt && e.obj.position.z < -8) {
        hostileFire(e.obj.position, false); e.shotAt = Infinity;
      }
    }
    const distance = e.obj.position.distanceTo(ship.position);
    if (e.type === 'ring' && distance < 1.6 && !e.used) {
      e.used = true; score += 350; rings++; burst(e.obj.position, 0x81f2e1, 5); removeAt(entities, i); continue;
    }
    if (e.type !== 'ring' && distance < e.radius + .55) {
      hit(); removeAt(entities, i); if (state !== 'playing') return; continue;
    }
    if (e.obj.position.z > 24) removeAt(entities, i);
  }
  if (boss && !bossWon) {
    boss.obj.position.z += (-24 - boss.obj.position.z) * dt * 1.1;
    boss.obj.position.x = Math.sin((elapsed - 40) * .6) * maxX * .6;
    boss.obj.position.y = Math.sin((elapsed - 40) * .8) * 1.2;
    boss.core.rotation.y += dt;
    if (elapsed >= bossShotAt && elapsed < 56) {
      hostileFire(boss.obj.position); bossShotAt = elapsed + 1.2;
    }
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i]; p.life -= dt;
    if (p.type === 'player') {
      const oldZ = p.obj.position.z;
      p.obj.position.z -= p.speed * dt;
      let removed = false;
      for (let j = entities.length - 1; j >= 0; j--) {
        const e = entities[j];
        if (e.type === 'ring') continue;
        // Swept z collision avoids tunneling when a laser crosses an object between frames.
        const dz = e.obj.position.z;
        const xy = Math.hypot(e.obj.position.x - p.obj.position.x, e.obj.position.y - p.obj.position.y);
        if (dz <= oldZ + e.radius && dz >= p.obj.position.z - e.radius && xy < e.radius + .1) {
          e.hp--; removeAt(projectiles, i); removed = true;
          if (e.hp <= 0) { score += e.type === 'drone' ? 250 : 100; kills++; burst(e.obj.position); removeAt(entities, j); }
          break;
        }
      }
      if (removed) continue;
      if (boss && !bossWon && boss.obj.position.z <= oldZ + 1 && boss.obj.position.z >= p.obj.position.z - 1 && Math.abs(p.obj.position.x - boss.obj.position.x) < 3.4 && Math.abs(p.obj.position.y - boss.obj.position.y) < 1.4) {
        boss.hp--; removeAt(projectiles, i);
        $('bossHealth').style.width = `${boss.hp / boss.maxHp * 100}%`;
        if (boss.hp <= 0) {
          bossWon = true; score += 3000; burst(boss.obj.position, 0xffb267, 22); boss.obj.visible = false;
          $('bossHud').hidden = true; message('GUARDIAN DOWN · EARTH IS IN SIGHT', 3);
        }
        continue;
      }
    } else {
      if(elapsed>=56){removeAt(projectiles,i);continue;}
      p.obj.position.addScaledVector(p.direction, p.speed * dt);
      if (p.obj.position.distanceTo(ship.position) < .85) {
        hit(); removeAt(projectiles, i); if (state !== 'playing') return; continue;
      }
    }
    if (p.life <= 0 || p.obj.position.z > 26 || p.obj.position.z < -150) removeAt(projectiles, i);
  }
  moon.position.z=72+elapsed*.8;earth.position.z=-145+130*Math.pow(elapsed/ROUND_SECONDS,2);earth.rotation.y+=dt*.015;
  if(elapsed>=56){if(boss)boss.obj.visible=false;$('bossHud').hidden=true;$('transitionCaption').hidden=false;$('transitionCaption').textContent='EARTH APPROACH · WELCOME HOME';}
  if (!reducedMotion) {
    camera.position.x += (ship.position.x * .13 - camera.position.x) * dt * 3;
    camera.position.y += (3.8 + ship.position.y * .12 - camera.position.y) * dt * 3;
  }
  camera.lookAt(camera.position.x * .35, .4, -35);
  if (elapsed >= ROUND_SECONDS) finish(true, bossWon ? 'Guardian dilewati. Roketmu kembali ke Bumi.' : 'Roketmu berhasil pulang ke Bumi. Guardian belum tumbang di ronde ini.');
}

function updateTransition(dt){
  transitionTime+=dt;const t=clamp(transitionTime/4,0,1);const smooth=t*t*(3-2*t);
  const radius=(camera.aspect<.8?24:16)+(camera.aspect<.8?1:4)*smooth;const angle=Math.PI*(1-smooth);
  camera.position.set(Math.sin(angle)*radius,1.2+smooth*2.6,Math.cos(angle)*radius);
  camera.lookAt(0,-.6,-smooth*30);
  const initialY=camera.aspect<.8?-5.8:-1;ship.position.set(0,initialY+(-1.7-initialY)*smooth,smooth*4);ship.rotation.set(-Math.PI/2*smooth,Math.PI*(1-smooth),0);ship.scale.setScalar(.26+smooth*.34);
  const morph=clamp((t-.18)/.35,0,1);
  ship.traverse(child=>{if(child.isMesh){child.material.transparent=true;child.material.opacity=morph;}});
  const projected=ship.position.clone().project(camera);
  const sprite=$('bridgeRocket');sprite.style.left=(projected.x*.5+.5)*100+'%';sprite.style.top=(-projected.y*.5+.5)*100+'%';sprite.style.opacity=String(1-morph);sprite.style.height=(64+smooth*35)+'px';sprite.style.transform=`translate(-50%,-50%) rotate(${smooth*12}deg)`;
  $('transitionCaption').textContent=t<.35?'ROKETMU. BAB BERIKUTNYA.':t<.75?'LEAVING THE MOON':'NEXT DESTINATION: EARTH';
  if(t>=1){
    sprite.hidden=true;$('transitionCaption').hidden=true;ship.traverse(child=>{if(child.isMesh){child.material.transparent=false;child.material.opacity=1;}});
    state='playing';elapsed=0;invulnerable=0;lastTime=performance.now();$('hud').hidden=false;ship.rotation.set(-Math.PI/2,0,0);message('RETURN TO EARTH · ASTEROID BELT');
  }
}

function frame(now) {
  const dt = Math.min(Math.max(0, (now - lastTime) / 1000), 1);
  lastTime = now; ambientTime += dt;
  // Simulate in small steps without discarding time on slower devices.
  if(state==='transition') updateTransition(dt);
  if (state === 'playing') {
    let remaining = dt;
    while (remaining > 0 && state === 'playing') {
      const slice = Math.min(remaining, 1 / 30);
      step(slice); remaining -= slice;
    }
    if (state === 'playing') updateHud();
  }
  if (state !== 'paused') {
    const speed = state === 'playing' ? 23 : (reducedMotion ? 0 : 3);
    for (let i = 2; i < starPositions.length; i += 3) {
      starPositions[i] += dt * speed;
      if (starPositions[i] > 20) starPositions[i] = -220;
    }
    stars.geometry.attributes.position.needsUpdate = true;
    exhaust.scale.y = 1 + Math.sin(ambientTime * 35) * .14;
    if(state==='intro'){
      ship.position.set(0,camera.aspect<.8?-5.8:-1,0);ship.scale.setScalar(.4);ship.rotation.set(0,Math.PI,0);ship.visible=false;
      camera.position.set(0,1.2,-(camera.aspect<.8?24:16));camera.lookAt(0,-.6,0);
      const projected=ship.position.clone().project(camera);$('bridgeRocket').hidden=false;$('bridgeRocket').style.opacity='1';$('bridgeRocket').style.left=(projected.x*.5+.5)*100+'%';$('bridgeRocket').style.top=(-projected.y*.5+.5)*100+'%';$('bridgeRocket').style.height='64px';$('bridgeRocket').style.transform='translate(-50%,-50%)';
      for(const e of entities){e.obj.rotation.y+=dt*.04;}
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= dt; p.obj.position.addScaledVector(p.velocity, dt); p.obj.scale.multiplyScalar(Math.exp(-dt * 2));
      if (p.life <= 0) removeAt(particles, i);
    }
  }
  if (ambientTime > toastUntil) $('toast').classList.remove('show');
  if (ambientTime > damageUntil) $('app').classList.remove('damage');
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

canvas.addEventListener('pointerdown', event => {
  if(state!=='playing'||pointer)return;
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (state !== 'playing' || !pointer || pointer.id !== event.pointerId) return;
  targetX = clamp(targetX + (event.clientX - pointer.x) / canvas.clientWidth * maxX * 2.3, -maxX, maxX);
  targetY = clamp(targetY - (event.clientY - pointer.y) / canvas.clientHeight * 8.5, -3.1, 3.2);
  pointer.x = event.clientX; pointer.y = event.clientY;
});
const release = event => { if (pointer?.id === event.pointerId) pointer = null; };
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('lostpointercapture', release);
document.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(key) && state === 'playing') {
    event.preventDefault(); keys.add(key);
  }
  if (key === 'escape') { if(['playing','transition'].includes(state))pause();else if(state==='paused')resume(); }
});
document.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('blur', () => { keys.clear(); pointer = null; if(['playing','transition'].includes(state))pause(); });
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault(); pause();
  $('errorScreen').hidden = false;
  $('errorMessage').textContent = 'Arena 3D terhenti. Muat ulang untuk mencoba lagi; ronde yang sudah dimulai tetap memakai kesempatan.';
});

function ensureAudio() {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { soundEnabled = false; }
}
function beep(freq, duration, gain = .05, wave = 'sine') {
  if (!soundEnabled || !audio || state === 'paused') return;
  const osc = audio.createOscillator(), vol = audio.createGain();
  osc.type = wave; osc.frequency.value = freq;
  vol.gain.setValueAtTime(gain, audio.currentTime);
  vol.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
  osc.connect(vol); vol.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
}
$('sound').addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  if (soundEnabled) ensureAudio();
  $('sound').textContent = soundEnabled ? 'SOUND ON' : 'SOUND OFF';
  $('sound').setAttribute('aria-pressed', String(soundEnabled));
  $('sound').setAttribute('aria-label', soundEnabled ? 'Matikan suara' : 'Aktifkan suara');
});
function requestStart(){if(state==='intro'&&authorizedSession&&session.attempts<2)parent.postMessage({type:'request-start'},location.origin);}
function back(){parent.postMessage({type:'back-to-journey'},location.origin);}
$('start').addEventListener('click',requestStart);
$('retry').addEventListener('click',()=>parent.postMessage({type:'request-retry'},location.origin));
$('pause').addEventListener('click',pause);$('resume').addEventListener('click',resume);
$('quit').addEventListener('click',()=>finish(false,'Jejak penerbangan tersimpan di sesi ini. Hak hadiah mengikuti verifikasi crew.'));
$('backIntro').addEventListener('click',back);$('backResult').addEventListener('click',back);$('backError').addEventListener('click',back);
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent||!event.data||typeof event.data!=='object')return;
  const m=event.data;
  if(m.type==='prepare'&&['kyc','transact'].includes(m.track)&&Number.isInteger(m.remaining)&&m.remaining>=0&&m.remaining<=2){
    clearWorld();for(let i=0;i<8;i++)spawnAsteroid(true);
    track=m.track;authorizedSession=true;session.attempts=2-m.remaining;state='intro';ship.visible=false;moon.position.z=72;earth.position.z=-145;
    $('intro').hidden=false;$('result').hidden=$('hud').hidden=$('bossHud').hidden=true;
    $('trackLabel').textContent=track==='kyc'?'KYC VERIFIED · RETURN MISSION':'TRANSACT VERIFIED · PREMIUM RETURN';
    $('rewardReminder').textContent=track==='kyc'?'KYC sudah dicek crew. Parfum 10ml + Sticker Pack. Jika parfum habis: Danamas Pasti Rp50.000.':'Transaksi sudah dicek crew. Parfum 50ml + merchandise tersedia. Jika parfum habis: Danamas Pasti Rp100.000.';
    $('preview').hidden=!m.preview;syncAttempts();
  }else if(m.type==='approved-start'&&state==='intro'&&authorizedSession&&typeof m.roundId==='string'&&Number.isInteger(m.remaining)){
    roundId=m.roundId;session.attempts=2-clamp(m.remaining,0,2);authorizedStart=true;start();
  }
});
$('reload').addEventListener('click', () => location.reload());
window.addEventListener('error', () => {
  $('errorScreen').hidden = false;
  $('errorMessage').textContent = 'Ada gangguan saat memuat game. Jalankan lewat server lokal atau hosting web, lalu muat ulang.';
});
window.addEventListener('unhandledrejection', () => {
  $('errorScreen').hidden = false;
  $('errorMessage').textContent = 'Game belum berhasil dimuat. Coba muat ulang melalui server lokal atau hosting web.';
});
try { initialize(); }
catch (error) {
  console.error('Return flight initialization failed',error);if(parent!==window)parent.postMessage({type:'return-error'},location.origin);
  $('errorScreen').hidden = false;
  $('errorMessage').textContent='Perangkat ini belum bisa memuat 3D. Kembali ke Journey Ended; verifikasi hadiahmu tetap berlaku.';
}
