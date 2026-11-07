/* Mud Masters is intentionally dependency-free: the canvas is the toy box. */
const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const phaseLabel = document.querySelector("#phaseLabel");
const toast = document.querySelector("#toast");
const splatOverlay = document.querySelector("#splatOverlay");
const helpBubble = document.querySelector("#helpBubble");
const rows = { build: document.querySelector("#buildControls"), decorate: document.querySelector("#decorateControls"), smash: document.querySelector("#smashControls"), clean: document.querySelector("#cleanControls") };

const TAU = Math.PI * 2;
const molds = {
  tower: { name: "Mud Tower", color: "#9b6749", draw: drawTower },
  turtle: { name: "Mud Turtle", color: "#789650", draw: drawTurtle },
  volcano: { name: "Mud Volcano", color: "#9b6047", draw: drawVolcano },
  monster: { name: "Mud Monster", color: "#815f9c", draw: drawMonster },
};

class SoundController {
  constructor() { this.audio = null; }
  init() { if (!this.audio) this.audio = new (window.AudioContext || window.webkitAudioContext)(); }
  blip(type) {
    this.init();
    const now = this.audio.currentTime, osc = this.audio.createOscillator(), gain = this.audio.createGain();
    const settings = { squish: [170, .11], splash: [420, .18], pop: [650, .08], thud: [80, .24], cheer: [520, .32] }[type] || [300, .1];
    osc.type = type === "thud" ? "sine" : "triangle"; osc.frequency.setValueAtTime(settings[0], now);
    osc.frequency.exponentialRampToValueAtTime(settings[0] * (type === "thud" ? .55 : 1.6), now + settings[1]);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.12, now + .01); gain.gain.exponentialRampToValueAtTime(.0001, now + settings[1]);
    osc.connect(gain).connect(this.audio.destination); osc.start(now); osc.stop(now + settings[1] + .02);
  }
}

class ParticleSystem {
  constructor() { this.items = []; }
  burst(x, y, color, count = 18, speed = 5) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU, s = Math.random() * speed + 1;
      this.items.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: 1, size: Math.random() * 7 + 3, color });
    }
  }
  update(dt) { this.items = this.items.filter(p => (p.life -= dt * 1.7) > 0); this.items.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .16; }); }
  draw() { this.items.forEach(p => { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1; }
}

class UIManager {
  setPhase(phase) {
    const labels = { build: "1 · MIX & BUILD", decorate: "2 · DECORATE", smash: "3 · SMASH TIME", clean: "4 · CLEAN UP" };
    phaseLabel.textContent = labels[phase];
    Object.values(rows).forEach(row => row.classList.add("hidden")); rows[phase].classList.remove("hidden");
    helpBubble.textContent = { build: "Drag the hose, then stamp some mud!", decorate: "Pick a decoration and tap your mud!", smash: "Choose your chaos and tap the structure!", clean: "Drag the sponge over every splat!" }[phase];
  }
  say(message) { toast.textContent = message; toast.classList.add("show"); clearTimeout(this.timer); this.timer = setTimeout(() => toast.classList.remove("show"), 1800); }
}

class GameEngine {
  constructor() {
    this.phase = "build"; this.mold = "tower"; this.tool = "cannon"; this.water = 0; this.structure = null; this.decorations = [];
    this.particles = new ParticleSystem(); this.sound = new SoundController(); this.ui = new UIManager();
    this.pointer = { x: 0, y: 0, down: false }; this.shake = 0; this.last = performance.now(); this.resize();
    addEventListener("resize", () => this.resize()); this.bind(); requestAnimationFrame(t => this.loop(t));
  }
  resize() { const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = r.width * dpr; canvas.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.w = r.width; this.h = r.height; }
  bind() {
    canvas.addEventListener("pointerdown", e => { this.sound.init(); try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* Synthetic test events have no active pointer. */ } this.pointer.down = true; this.move(e); this.interact(); });
    canvas.addEventListener("pointermove", e => { this.move(e); if (this.pointer.down && this.phase === "build" && this.pointer.x < 180) this.waterIt(); if (this.pointer.down && this.phase === "clean") this.cleanAt(); });
    canvas.addEventListener("pointerup", () => { this.pointer.down = false; });
    document.querySelectorAll("[data-mold]").forEach(b => b.onclick = () => { this.mold = b.dataset.mold; document.querySelectorAll("[data-mold]").forEach(x => x.classList.remove("selected")); b.classList.add("selected"); this.sound.blip("pop"); });
    document.querySelector("[data-action=water]").onclick = () => { this.waterIt(); this.ui.say(this.water > 72 ? "Whoa, puddle party!" : "Squelch! Keep mixing!"); };
    document.querySelector("[data-action=decorate]").onclick = () => this.setPhase("decorate");
    document.querySelectorAll("[data-decor]").forEach(b => b.onclick = () => { this.decor = b.dataset.decor; this.ui.say("Tap the mud to plop it on!"); this.sound.blip("pop"); });
    document.querySelector("[data-action=smash]").onclick = () => this.setPhase("smash");
    document.querySelectorAll("[data-tool]").forEach(b => b.onclick = () => { this.tool = b.dataset.tool; document.querySelectorAll("[data-tool]").forEach(x => x.classList.remove("selected")); b.classList.add("selected"); this.ui.say("Tap the mud to unleash it!"); });
    document.querySelector("[data-action=clean]").onclick = () => this.setPhase("clean");
    document.querySelector("[data-action=reset]").onclick = () => this.reset();
  }
  move(e) { const r = canvas.getBoundingClientRect(); this.pointer.x = e.clientX - r.left; this.pointer.y = e.clientY - r.top; }
  setPhase(phase) { this.phase = phase; this.ui.setPhase(phase); this.sound.blip(phase === "smash" ? "cheer" : "pop"); if (phase === "smash") this.ui.say("SMASH TIME! Pick your favorite chaos!"); }
  waterIt() { this.water = Math.min(100, this.water + 5); this.particles.burst(110, 125, "#4eb9e8", 5, 2); this.sound.blip("splash"); }
  interact() {
    if (this.phase === "build" && this.pointer.x > 180) { if (this.water < 18) return this.ui.say("A little more water first!"); this.structure = { x: this.w / 2, y: this.h * .57, scale: 1, wet: this.water }; this.particles.burst(this.structure.x, this.structure.y, molds[this.mold].color, 24); this.sound.blip("squish"); this.ui.say(this.water > 78 ? "It's a super-squishy puddle!" : "Mold stamped! Looking muddy!"); }
    if (this.phase === "decorate" && this.structure && this.decor) { this.decorations.push({ type: this.decor, x: this.pointer.x, y: this.pointer.y, pop: 1 }); this.particles.burst(this.pointer.x, this.pointer.y, "#f7c95a", 9, 2); this.sound.blip("squish"); }
    if (this.phase === "smash" && this.structure) this.smash();
  }
  smash() {
    const s = this.structure, power = { cannon: .18, stomp: .7, launcher: .28, balloon: .4 }[this.tool];
    this.particles.burst(s.x, s.y, this.tool === "balloon" ? "#ff6d9d" : "#79503d", this.tool === "stomp" ? 65 : 28, this.tool === "stomp" ? 10 : 6);
    s.scale = Math.max(.05, s.scale - power); this.shake = this.tool === "stomp" ? 18 : 6; this.sound.blip(this.tool === "stomp" ? "thud" : "splash");
    if (Math.random() < .5) this.addSplat(); this.ui.say(s.scale < .2 ? "SPLAT! That mud got flattened!" : "More! More! More!");
    if (s.scale < .2) setTimeout(() => this.setPhase("clean"), 600);
  }
  addSplat() { const el = document.createElement("div"); el.className = "splat"; el.style.left = `${Math.random() * 85 + 5}%`; el.style.top = `${Math.random() * 65 + 5}%`; el.style.transform = `rotate(${Math.random() * 80 - 40}deg) scale(${Math.random() * .7 + .6})`; splatOverlay.appendChild(el); }
  cleanAt() { [...splatOverlay.children].forEach(el => { const r = el.getBoundingClientRect(), x = this.pointer.x + canvas.getBoundingClientRect().left, y = this.pointer.y + canvas.getBoundingClientRect().top; if (x > r.left - 35 && x < r.right + 35 && y > r.top - 35 && y < r.bottom + 35) { el.remove(); this.particles.burst(this.pointer.x, this.pointer.y, "#9edfff", 8, 2); this.sound.blip("splash"); } }); if (!splatOverlay.children.length) this.ui.say("Badge earned: Master Splasher! 🏅"); }
  reset() { this.phase = "build"; this.water = 0; this.structure = null; this.decorations = []; this.decor = null; splatOverlay.replaceChildren(); this.ui.setPhase("build"); this.ui.say("Fresh sandbox! Let's build!"); }
  loop(now) { const dt = Math.min((now - this.last) / 1000, .04); this.last = now; this.update(dt); this.draw(); requestAnimationFrame(t => this.loop(t)); }
  update(dt) { this.particles.update(dt); this.shake *= .86; }
  draw() {
    const ox = (Math.random() - .5) * this.shake, oy = (Math.random() - .5) * this.shake; ctx.save(); ctx.translate(ox, oy);
    const g = ctx.createLinearGradient(0, 0, 0, this.h); g.addColorStop(0, "#a9e5ff"); g.addColorStop(.58, "#d8f6ff"); g.addColorStop(.59, "#b8e889"); g.addColorStop(1, "#7bc85e"); ctx.fillStyle = g; ctx.fillRect(-20, -20, this.w + 40, this.h + 40);
    ctx.fillStyle = "rgba(255,255,255,.8)"; [[this.w*.18,70,30],[this.w*.7,50,23],[this.w*.86,135,35]].forEach(([x,y,r]) => { ctx.beginPath(); ctx.arc(x,y,r,0,TAU); ctx.arc(x+r*.8,y+5,r*.75,0,TAU); ctx.fill(); });
    ctx.fillStyle = "#9c6d45"; ctx.beginPath(); ctx.ellipse(this.w / 2, this.h * .72, Math.min(this.w * .38, 300), this.h * .16, 0, 0, TAU); ctx.fill();
    if (this.water > 0) { ctx.fillStyle = `rgba(62,166,218,${this.water / 500})`; ctx.beginPath(); ctx.ellipse(110, 130, 55 + this.water, 22 + this.water / 3, 0, 0, TAU); ctx.fill(); }
    if (this.structure && this.structure.scale > .03) { const s = this.structure; ctx.save(); ctx.translate(s.x, s.y); ctx.scale(s.scale, s.scale); molds[this.mold].draw(); ctx.restore(); this.decorations.forEach(d => drawDecoration(d)); }
    this.particles.draw(); ctx.restore();
  }
}

function blob(color, points = 10, radius = 70) { ctx.fillStyle = color; ctx.beginPath(); for (let i = 0; i <= points; i++) { const a = i / points * TAU, r = radius * (.86 + Math.sin(i * 4.7) * .1); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }
function drawTower() { ctx.fillStyle = molds.tower.color; ctx.fillRect(-48,-65,96,125); ctx.fillRect(-72,-95,42,45); ctx.fillRect(30,-95,42,45); ctx.fillStyle="#d7834e"; ctx.fillRect(-14,-18,28,78); ctx.fillStyle="#f3c55c"; ctx.fillRect(-55,-78,9,13); ctx.fillRect(47,-78,9,13); }
function drawTurtle() { blob(molds.turtle.color, 14, 78); ctx.fillStyle="#9fbd68"; ctx.beginPath(); ctx.arc(72,-30,30,0,TAU); ctx.fill(); [[-55,-53],[-55,54],[30,68]].forEach(([x,y])=>{ctx.beginPath();ctx.arc(x,y,18,0,TAU);ctx.fill();}); ctx.fillStyle="#243248"; ctx.beginPath();ctx.arc(78,-37,4,0,TAU);ctx.fill(); }
function drawVolcano() { ctx.fillStyle=molds.volcano.color; ctx.beginPath();ctx.moveTo(-100,65);ctx.lineTo(-45,-65);ctx.quadraticCurveTo(0,-95,45,-65);ctx.lineTo(100,65);ctx.closePath();ctx.fill();ctx.fillStyle="#ef744f";ctx.beginPath();ctx.ellipse(0,-65,30,12,0,0,TAU);ctx.fill(); }
function drawMonster() { blob(molds.monster.color, 12, 82); ctx.fillStyle="#8fd17b"; [[-45,-100],[45,-100]].forEach(([x,y])=>{ctx.beginPath();ctx.moveTo(x,y+30);ctx.lineTo(x-15,y-20);ctx.lineTo(x+15,y-20);ctx.closePath();ctx.fill();}); ctx.fillStyle="#fff";[-28,28].forEach(x=>{ctx.beginPath();ctx.arc(x,-18,17,0,TAU);ctx.fill();ctx.fillStyle="#243248";ctx.beginPath();ctx.arc(x,-18,6,0,TAU);ctx.fill();ctx.fillStyle="#fff";}); }
function drawDecoration(d) { ctx.save(); ctx.translate(d.x, d.y); ctx.rotate((d.x * .01) % .4); ctx.scale(d.pop || 1, d.pop || 1); if (d.type === "eyes") { ctx.fillStyle="#fff"; [-13,13].forEach(x=>{ctx.beginPath();ctx.arc(x,0,13,0,TAU);ctx.fill();ctx.fillStyle="#243248";ctx.beginPath();ctx.arc(x,0,5,0,TAU);ctx.fill();ctx.fillStyle="#fff";}); } else { ctx.font="32px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText({shell:"🐚",pebble:"🪨",twig:"🌿",leaf:"🍃"}[d.type],0,0); } ctx.restore(); }

window.game = new GameEngine();
