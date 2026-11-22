// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, clean getaway and caught.
//
// ?seed=N fixes the patrol and decoy randomness. ?shot=start|play|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_CAUGHT,
  EVENT_DECOY,
  EVENT_EMP,
  EVENT_GRABBED,
  EVENT_PICKUP,
  EVENT_SPOTTED,
  EVENT_TIARA,
  EVENT_WIN,
} from './world.js';
import { ACTION_CONFIRM, ACTION_DECOY, ACTION_EMP, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';
import { SOUNDS } from './sound.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
let screen = SCREEN_TITLE;
// A handle the play-test script reads: the world and the current screen.
window.__vault = { world, screen: () => screen };

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best haul then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let lastSpottedSound = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each event.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Steal the Sunburst Tiara and reach the exit.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.loot > best) {
      best = world.state.loot;
      saveBest(best);
    }
    if (won) SOUNDS.win();
    else SOUNDS.lose();
    announce(won ? `Clean getaway. Loot $${world.state.loot}.` : `Caught. Loot $${world.state.loot}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_EMP && world.useEmp()) SOUNDS.emp();
      if (actions & ACTION_DECOY && world.useDecoy()) SOUNDS.decoy();
    }
  }

  /** The mouse target, turned into a direction toward it; keyboard input wins when held. */
  function moveDirection() {
    const keys = input.direction();
    if (keys.x !== 0 || keys.y !== 0) return keys;
    const target = input.mouseTarget();
    if (!target) return { x: 0, y: 0 };
    const dx = target.x - world.state.thief.x;
    const dy = target.y - world.state.thief.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 8) return { x: 0, y: 0 };
    return { x: dx / distance, y: dy / distance };
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, true);
      return;
    }
    const events = world.step(STEP, moveDirection(), false);
    if (events & EVENT_PICKUP) SOUNDS.pickup();
    if (events & EVENT_TIARA) SOUNDS.tiara();
    if (events & EVENT_GRABBED) {
      SOUNDS.grabbed();
      announce(`Grabbed by a guard. Alarm ${Math.round(world.state.alarm)}%.`);
    }
    if (events & EVENT_SPOTTED && world.state.time - lastSpottedSound > 1.5) {
      lastSpottedSound = world.state.time;
      SOUNDS.spotted();
      announce('Spotted! Break line of sight to cool the alarm.');
    }
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_CAUGHT) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the alarm climb unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('The Gilded Vault. Press Space or click to start the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
