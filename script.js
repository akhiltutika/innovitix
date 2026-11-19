const modeConfig = {
  lights: { icon: '◉', title: 'Ambient lights', range: { label: 'Brightness', min: 0, max: 100, value: 72, unit: '%' }, onText: 'Warm white', offText: 'Lights off', isOn: true },
  climate: { icon: '◌', title: 'Climate control', range: { label: 'Target temperature', min: 18, max: 30, value: 24, unit: '°C' }, onText: 'Comfort', offText: 'Climate paused', isOn: true },
  shades: { icon: '▤', title: 'Window shades', range: { label: 'Shade position', min: 0, max: 100, value: 68, unit: '%' }, onText: 'Open', offText: 'Shade paused', isOn: true },
  entry: { icon: '⌑', title: 'Smart entry', range: null, onText: 'Front door · Locked', offText: 'Front door · Unlocked', isOn: true },
};
const $ = (selector) => document.querySelector(selector);
const modes = JSON.parse(JSON.stringify(modeConfig));
let activeMode = 'lights';
let activeScene = 'Evening';
let roomIsOn = true;

function blendHex(first, second, amount) {
  const a = first.match(/[\da-f]{2}/gi).map((part) => parseInt(part, 16));
  const b = second.match(/[\da-f]{2}/gi).map((part) => parseInt(part, 16));
  return `#${a.map((value, index) => Math.round(value + (b[index] - value) * amount).toString(16).padStart(2, '0')).join('')}`;
}

function setTemperatureTheme(temperature) {
  const dark = document.body.classList.contains('dark-theme');
  const accent = temperature < 24
    ? blendHex('#d47e48', '#6198cf', Math.min((24 - temperature) / 6, 1))
    : blendHex('#d47e48', '#e65a3e', Math.min((temperature - 24) / 6, 1));
  const paper = dark ? '#211f1b' : '#f2eee8';
  const panel = dark ? '#302c26' : '#e9e3da';
  const destinationPaper = dark ? (temperature < 24 ? '#252c33' : '#342923') : (temperature < 24 ? '#e7eef4' : '#f4e7dd');
  const destinationPanel = dark ? (temperature < 24 ? '#303b45' : '#44332a') : (temperature < 24 ? '#dde8f0' : '#eedbd0');
  const amount = Math.min(Math.abs(temperature - 24) / 6, 1);
  const root = document.documentElement;
  root.style.setProperty('--temperature-accent', accent);
  root.style.setProperty('--temperature-accent-dark', blendHex(temperature < 24 ? '#925b37' : '#925b37', temperature < 24 ? '#3e6790' : '#9f3e2c', amount));
  root.style.setProperty('--temperature-paper', blendHex(paper, destinationPaper, amount));
  root.style.setProperty('--temperature-panel', blendHex(panel, destinationPanel, amount));
  root.style.setProperty('--temperature-wash', temperature < 24 ? 'rgba(94, 151, 205, 0.18)' : 'rgba(231, 95, 61, 0.18)');
  root.style.setProperty('--temperature-wash-opacity', String(amount * 0.7));

  $('#room-temperature').textContent = temperature;
  const mood = temperature <= 19 ? 'Cool room · crisp blue palette'
    : temperature <= 22 ? 'Fresh room · soft cool palette'
      : temperature <= 25 ? 'Balanced · warm neutral palette'
        : temperature <= 28 ? 'Warm room · amber palette'
          : 'Hot room · vivid coral palette';
  $('#temperature-feedback').textContent = mood;
  window.dispatchEvent(new CustomEvent('innovotix:temperature', { detail: { temperature } }));
}

function countActiveDevices() {
  if (!roomIsOn) return 'Room paused';
  const count = Object.values(modes).filter((mode) => mode.isOn).length;
  return count === 1 ? '1 device on' : `${count} devices on`;
}

function setCustomScene() {
  activeScene = 'Custom';
  document.querySelectorAll('.scene').forEach((scene) => {
    const selected = scene.dataset.scene === activeScene;
    scene.classList.toggle('active', selected);
    scene.setAttribute('aria-pressed', String(selected));
  });
  $('#room-status').textContent = 'Custom scene';
}

function renderMode() {
  const mode = modes[activeMode];
  const tab = $(`#tab-${activeMode}`);
  $('.widget-tabs .active')?.classList.remove('active');
  $('.widget-tabs [aria-selected="true"]')?.setAttribute('aria-selected', 'false');
  $('.widget-tabs [tabindex="0"]')?.setAttribute('tabindex', '-1');
  tab.classList.add('active');
  tab.setAttribute('aria-selected', 'true');
  tab.setAttribute('tabindex', '0');
  $('#control-panel').setAttribute('aria-labelledby', tab.id);
  $('.widget-power').setAttribute('aria-pressed', String(roomIsOn));
  $('.widget-power').setAttribute('aria-label', roomIsOn ? 'Pause room controls' : 'Turn room controls on');
  $('#control-icon').textContent = mode.icon;
  $('#control-title').textContent = mode.title;
  const on = roomIsOn && mode.isOn;
  $('.mini-switch').classList.toggle('on', on);
  $('.mini-switch').setAttribute('aria-pressed', String(on));
  $('.mini-switch').setAttribute('aria-label', activeMode === 'entry' ? (on ? 'Unlock front door' : 'Lock front door') : `Toggle ${mode.title.toLowerCase()}`);
  $('#devices-count').textContent = countActiveDevices();

  const rangeWrap = $('#range-control');
  const range = mode.range;
  rangeWrap.hidden = !range;
  if (range) {
    $('#range-label').textContent = range.label;
    $('#range-value').textContent = `${range.value}${range.unit}`;
    $('#control-range').min = range.min;
    $('#control-range').max = range.max;
    $('#control-range').value = range.value;
    $('#control-range').disabled = !roomIsOn || !mode.isOn;
    $('#control-range').setAttribute('aria-label', range.label);
    $('#control-range').style.setProperty('--range-progress', `${((range.value - range.min) / (range.max - range.min)) * 100}%`);
    $('#control-subtitle').textContent = `${on ? mode.onText : mode.offText} · ${range.value}${range.unit}`;
  } else {
    $('#control-subtitle').textContent = on ? mode.onText : mode.offText;
  }
}

document.querySelectorAll('.widget-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    activeMode = tab.dataset.mode;
    renderMode();
  });
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...document.querySelectorAll('.widget-tab')];
    const index = tabs.indexOf(tab);
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
    tabs[nextIndex].focus();
    activeMode = tabs[nextIndex].dataset.mode;
    renderMode();
  });
});

$('#control-range').addEventListener('input', (event) => {
  const mode = modes[activeMode];
  mode.range.value = Number(event.currentTarget.value);
  if (activeMode === 'climate') setTemperatureTheme(mode.range.value);
  setCustomScene();
  renderMode();
});

$('.mini-switch').addEventListener('click', () => {
  if (!roomIsOn) {
    roomIsOn = true;
    modes[activeMode].isOn = true;
    $('.widget-power').setAttribute('aria-pressed', 'true');
  } else {
    modes[activeMode].isOn = !modes[activeMode].isOn;
  }
  setCustomScene();
  renderMode();
});

$('.widget-power').addEventListener('click', (event) => {
  roomIsOn = !roomIsOn;
  event.currentTarget.setAttribute('aria-pressed', String(roomIsOn));
  event.currentTarget.setAttribute('aria-label', roomIsOn ? 'Pause room controls' : 'Turn room controls on');
  event.currentTarget.style.color = roomIsOn ? '' : '#c66b36';
  if (!roomIsOn) setCustomScene();
  $('#room-status').textContent = roomIsOn ? `${activeScene} scene` : 'Room paused';
  renderMode();
});

const scenes = {
  Evening: { lights: [72, true], climate: [24, true], shades: [68, true], entry: [null, true], note: 'Comfort mode · 8:42 PM' },
  Focus: { lights: [88, true], climate: [23, true], shades: [100, true], entry: [null, true], note: 'Focus mode · 23°C' },
  Away: { lights: [0, false], climate: [26, true], shades: [0, true], entry: [null, true], note: 'Away mode · Entry locked' },
};
document.querySelectorAll('.scene').forEach((scene) => {
  scene.setAttribute('aria-pressed', String(scene.classList.contains('active')));
  scene.addEventListener('click', () => {
    activeScene = scene.dataset.scene;
    roomIsOn = true;
    Object.entries(scenes[activeScene]).forEach(([key, value]) => {
      if (key === 'note') return;
      if (modes[key].range) modes[key].range.value = value[0];
      modes[key].isOn = value[1];
    });
    $('#room-status').textContent = scenes[activeScene].note;
    setTemperatureTheme(modes.climate.range.value);
    document.querySelectorAll('.scene').forEach((item) => {
      const selected = item === scene;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    $('.widget-power').setAttribute('aria-pressed', 'true');
    renderMode();
  });
});

const themeButton = $('.theme-toggle');
function setTheme(dark) {
  document.body.classList.toggle('dark-theme', dark);
  setTemperatureTheme(modes.climate.range.value);
  themeButton.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  themeButton.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
  themeButton.textContent = dark ? '\u263e' : '\u263c';
}
try { setTheme(localStorage.getItem('innovotix-theme') === 'dark'); } catch { setTheme(false); }
themeButton.addEventListener('click', () => {
  const dark = !document.body.classList.contains('dark-theme');
  setTheme(dark);
  try { localStorage.setItem('innovotix-theme', dark ? 'dark' : 'light'); } catch { /* Theme still works for this visit. */ }
});

const menuToggle = $('.menu-toggle');
function closeMenu() {
  $('.main-nav').classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Open menu');
}
menuToggle.addEventListener('click', () => {
  const open = $('.main-nav').classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});
document.querySelectorAll('.main-nav a').forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });
window.addEventListener('resize', () => { if (window.innerWidth > 740) closeMenu(); });

const progressFill = $('#scroll-progress-fill');
const navSections = ['solutions', 'robotics', 'process', 'about']
  .map((id) => ({ id, section: document.getElementById(id), link: $(`.main-nav a[href="#${id}"]`) }))
  .filter((item) => item.section && item.link);
let chromeFrame = 0;
function updateScrollChrome() {
  if (chromeFrame) return;
  chromeFrame = requestAnimationFrame(() => {
    chromeFrame = 0;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? Math.max(0, Math.min(window.scrollY / maxScroll, 1)) : 0;
    progressFill.style.transform = `scaleX(${progress})`;
    $('.site-header').classList.toggle('is-scrolled', window.scrollY > 28);
    let current = null;
    navSections.forEach((item) => {
      if (item.section.getBoundingClientRect().top <= window.innerHeight * 0.36) current = item;
    });
    navSections.forEach((item) => {
      if (item === current) item.link.setAttribute('aria-current', 'location');
      else item.link.removeAttribute('aria-current');
    });
  });
}
window.addEventListener('scroll', updateScrollChrome, { passive: true });
window.addEventListener('resize', updateScrollChrome, { passive: true });
updateScrollChrome();

if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((element, index) => {
    element.style.transitionDelay = `${Math.min(index % 4, 3) * 75}ms`;
    revealObserver.observe(element);
  });
} else {
  document.querySelectorAll('.reveal').forEach((element) => element.classList.add('visible'));
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasHoverPointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const motionSteps = {
  sense: { number: '01', label: 'INPUT / SENSORS', title: 'Sense the world', description: 'Sensors turn light, distance and touch into useful signals.', progress: 88 },
  think: { number: '02', label: 'LOGIC / CONTROL', title: 'Make a decision', description: 'A controller reads the signal and chooses what should happen next.', progress: 50 },
  act: { number: '03', label: 'OUTPUT / MOTION', title: 'Turn code into motion', description: 'Motors and outputs put the robot’s response into action.', progress: 0 },
};
const controlMap = $('#control-map');
let activeMotionStep = null;
function selectMotionStep(key) {
  const step = motionSteps[key];
  if (!step || activeMotionStep === key) return;
  activeMotionStep = key;
  document.querySelectorAll('.map-node').forEach((node) => {
    const selected = node.dataset.step === key;
    node.classList.toggle('active', selected);
    node.setAttribute('aria-pressed', String(selected));
  });
  $('#motion-step-number').textContent = step.number;
  $('#motion-step-label').textContent = step.label;
  $('#motion-step-title').textContent = step.title;
  $('#motion-step-description').textContent = step.description;
  controlMap.style.setProperty('--trace-offset', String(step.progress));
}
document.querySelectorAll('.map-node').forEach((node) => {
  node.setAttribute('aria-pressed', String(node.classList.contains('active')));
  node.addEventListener('click', () => selectMotionStep(node.dataset.step));
});
selectMotionStep('sense');
if (!hasHoverPointer) {
  $('#motion-instruction').textContent = 'Tap a point on the control map to explore how a robot senses, decides and acts.';
  $('#canvas-interaction-hint').textContent = 'TOUCH INPUT READY';
  $('#canvas-bottom-hint').innerHTML = 'TAP A NODE <b>↗</b>';
}

const heroCanvas = $('.hero-particle-field');
const heroContext = heroCanvas?.getContext('2d', { alpha: true });
const particlePoints = Array.from({ length: 560 }, (_, index, all) => {
  const y = 1 - 2 * (index + 0.5) / all.length;
  const radius = Math.sqrt(1 - y * y);
  const angle = index * Math.PI * (3 - Math.sqrt(5));
  return { x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius };
});
let orbWidth = 0;
let orbHeight = 0;
let orbScale = 1;
let orbPointer = { x: 0.5, y: 0.44 };
let orbTarget = { ...orbPointer };
let orbFrame = 0;
function readAccentRgb() {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--temperature-accent').trim();
  const hex = value.match(/^#([\da-f]{6})$/i)?.[1] || 'd47e48';
  return [0, 2, 4].map((position) => parseInt(hex.slice(position, position + 2), 16));
}
function drawHeroOrb() {
  if (!heroContext || !orbWidth || !orbHeight) return;
  heroContext.setTransform(orbScale, 0, 0, orbScale, 0, 0);
  heroContext.clearRect(0, 0, orbWidth, orbHeight);
  const centerX = orbWidth * 0.53;
  const centerY = orbHeight * 0.43;
  const sphereRadius = Math.min(orbWidth * 0.37, orbHeight * 0.34);
  const yaw = (orbPointer.x - 0.5) * 1.15;
  const pitch = (orbPointer.y - 0.5) * 0.68;
  const [red, green, blue] = readAccentRgb();
  const glow = heroContext.createRadialGradient(centerX, centerY, sphereRadius * 0.04, centerX, centerY, sphereRadius * 1.22);
  glow.addColorStop(0, `rgba(${red},${green},${blue},0.10)`);
  glow.addColorStop(0.65, `rgba(${red},${green},${blue},0.035)`);
  glow.addColorStop(1, `rgba(${red},${green},${blue},0)`);
  heroContext.fillStyle = glow;
  heroContext.beginPath();
  heroContext.arc(centerX, centerY, sphereRadius * 1.22, 0, Math.PI * 2);
  heroContext.fill();
  for (const point of particlePoints) {
    const x1 = point.x * Math.cos(yaw) + point.z * Math.sin(yaw);
    const z1 = -point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
    const y2 = point.y * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = point.y * Math.sin(pitch) + z1 * Math.cos(pitch);
    const perspective = 1 / (1.42 - z2 * 0.27);
    const x = centerX + x1 * sphereRadius * perspective;
    const y = centerY + y2 * sphereRadius * perspective;
    const depth = (z2 + 1) / 2;
    const alpha = 0.12 + depth * 0.62;
    const dot = 0.45 + depth * 1.15;
    heroContext.fillStyle = `rgba(${red},${green},${blue},${alpha})`;
    heroContext.beginPath();
    heroContext.arc(x, y, dot, 0, Math.PI * 2);
    heroContext.fill();
  }
}
function resizeHeroOrb() {
  if (!heroCanvas || !heroContext) return;
  const rect = heroCanvas.getBoundingClientRect();
  orbScale = Math.min(window.devicePixelRatio || 1, 1.7);
  orbWidth = rect.width;
  orbHeight = rect.height;
  heroCanvas.width = Math.round(orbWidth * orbScale);
  heroCanvas.height = Math.round(orbHeight * orbScale);
  drawHeroOrb();
}
function queueHeroOrb() {
  if (orbFrame) return;
  const easeToPointer = () => {
    orbFrame = 0;
    orbPointer.x += (orbTarget.x - orbPointer.x) * 0.16;
    orbPointer.y += (orbTarget.y - orbPointer.y) * 0.16;
    drawHeroOrb();
    if (Math.abs(orbTarget.x - orbPointer.x) + Math.abs(orbTarget.y - orbPointer.y) > 0.001) orbFrame = requestAnimationFrame(easeToPointer);
  };
  orbFrame = requestAnimationFrame(easeToPointer);
}
resizeHeroOrb();
window.addEventListener('resize', resizeHeroOrb, { passive: true });
window.addEventListener('innovotix:temperature', drawHeroOrb);

if (controlMap && hasHoverPointer && !reducedMotion) {
  controlMap.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const bounds = controlMap.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    controlMap.style.setProperty('--cursor-x', `${(x * 100).toFixed(1)}%`);
    controlMap.style.setProperty('--cursor-y', `${(y * 100).toFixed(1)}%`);
    controlMap.closest('.motion-canvas').style.setProperty('--cursor-x', `${(x * 100).toFixed(1)}%`);
    controlMap.closest('.motion-canvas').style.setProperty('--cursor-y', `${(y * 100).toFixed(1)}%`);
    $('#pointer-x').textContent = x.toFixed(2);
    $('#pointer-y').textContent = y.toFixed(2);
    const nearest = [...document.querySelectorAll('.map-node')].reduce((best, node) => {
      const rect = node.getBoundingClientRect();
      const dx = (rect.left + rect.width / 2 - event.clientX) / bounds.width;
      const dy = (rect.top + rect.height / 2 - event.clientY) / bounds.height;
      const distance = Math.hypot(dx, dy);
      return distance < best.distance ? { node, distance } : best;
    }, { node: null, distance: Infinity });
    if (nearest.node) selectMotionStep(nearest.node.dataset.step);
  });
  controlMap.addEventListener('pointerleave', () => {
    controlMap.style.setProperty('--cursor-x', '50%');
    controlMap.style.setProperty('--cursor-y', '50%');
    controlMap.closest('.motion-canvas').style.setProperty('--cursor-x', '50%');
    controlMap.closest('.motion-canvas').style.setProperty('--cursor-y', '50%');
    $('#pointer-x').textContent = '0.00';
    $('#pointer-y').textContent = '0.00';
  });
}

if (hasHoverPointer && !reducedMotion) {
  const bindTilt = (element, amount = 3) => {
    element.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      const rect = element.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      element.classList.add('cursor-active');
      element.style.setProperty('--tilt-x', `${((0.5 - y) * amount * 2).toFixed(2)}deg`);
      element.style.setProperty('--tilt-y', `${((x - 0.5) * amount * 2).toFixed(2)}deg`);
      element.style.setProperty('--object-x', `${((x - 0.5) * 10).toFixed(1)}px`);
      element.style.setProperty('--object-y', `${((y - 0.5) * 8).toFixed(1)}px`);
      element.style.setProperty('--spot-x', `${(x * 100).toFixed(1)}%`);
      element.style.setProperty('--spot-y', `${(y * 100).toFixed(1)}%`);
    });
    element.addEventListener('pointerleave', () => {
      element.classList.remove('cursor-active');
      element.style.setProperty('--tilt-x', '0deg');
      element.style.setProperty('--tilt-y', '0deg');
      element.style.setProperty('--object-x', '0px');
      element.style.setProperty('--object-y', '0px');
      element.style.setProperty('--spot-x', '50%');
      element.style.setProperty('--spot-y', '50%');
    });
  };
  document.querySelectorAll('.kit-card').forEach((card) => bindTilt(card, 3));
  document.querySelectorAll('.solution-card').forEach((card) => bindTilt(card, 1.5));
  const roomWidget = $('.room-widget');
  roomWidget.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const rect = roomWidget.getBoundingClientRect();
    roomWidget.style.setProperty('--spot-x', `${((event.clientX - rect.left) / rect.width * 100).toFixed(1)}%`);
    roomWidget.style.setProperty('--spot-y', `${((event.clientY - rect.top) / rect.height * 100).toFixed(1)}%`);
  });
  roomWidget.addEventListener('pointerleave', () => {
    roomWidget.style.setProperty('--spot-x', '50%');
    roomWidget.style.setProperty('--spot-y', '50%');
  });
  document.querySelectorAll('.header-actions .button,.hero-actions .button,.robotics-copy>.button,.contact-form>.button').forEach((button) => {
    button.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      const rect = button.getBoundingClientRect();
      button.style.setProperty('--mag-x', `${((event.clientX - rect.left) / rect.width - 0.5) * 6}px`);
      button.style.setProperty('--mag-y', `${((event.clientY - rect.top) / rect.height - 0.5) * 5}px`);
    });
    button.addEventListener('pointerleave', () => {
      button.style.setProperty('--mag-x', '0px');
      button.style.setProperty('--mag-y', '0px');
    });
  });
  const hero = $('.hero');
  const heroImage = $('.hero-image');
  hero.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const rect = hero.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    hero.classList.add('pointer-active');
    hero.style.setProperty('--pointer-x', `${(x * 100).toFixed(1)}%`);
    hero.style.setProperty('--pointer-y', `${(y * 100).toFixed(1)}%`);
    heroImage.style.setProperty('--hero-x', `${((0.5 - x) * 8).toFixed(1)}px`);
    heroImage.style.setProperty('--hero-y', `${((0.5 - y) * 6).toFixed(1)}px`);
    orbTarget = { x, y };
    queueHeroOrb();
  });
  hero.addEventListener('pointerleave', () => {
    hero.classList.remove('pointer-active');
    heroImage.style.setProperty('--hero-x', '0px');
    heroImage.style.setProperty('--hero-y', '0px');
  });
  const roboticsImage = $('.robotics-visual');
  roboticsImage.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const rect = roboticsImage.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    roboticsImage.classList.add('cursor-active');
    roboticsImage.style.setProperty('--parallax-x', `${((0.5 - x) * 12).toFixed(1)}px`);
    roboticsImage.style.setProperty('--parallax-y', `${((0.5 - y) * 10).toFixed(1)}px`);
  });
  roboticsImage.addEventListener('pointerleave', () => {
    roboticsImage.classList.remove('cursor-active');
    roboticsImage.style.setProperty('--parallax-x', '0px');
    roboticsImage.style.setProperty('--parallax-y', '0px');
  });
  const audience = $('.audience-section');
  audience.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const rect = audience.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    audience.style.setProperty('--audience-x', `${((0.5 - x) * 10).toFixed(1)}px`);
    audience.style.setProperty('--audience-y', `${((0.5 - y) * 8).toFixed(1)}px`);
  });
  audience.addEventListener('pointerleave', () => {
    audience.style.setProperty('--audience-x', '0px');
    audience.style.setProperty('--audience-y', '0px');
  });
}

$('#contact-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const subject = encodeURIComponent(`Innovotix enquiry: ${values.get('interest')}`);
  const body = encodeURIComponent(`Name: ${values.get('name')}\nContact: ${values.get('contact')}\nInterested in: ${values.get('interest')}\n\n${values.get('message') || ''}`);
  $('#form-note').textContent = 'Your email app will open with your enquiry ready. Send it there to reach Innovotix.';
  window.location.href = `mailto:innovotix016@gmail.com?subject=${subject}&body=${body}`;
});

renderMode();
setTemperatureTheme(modes.climate.range.value);
