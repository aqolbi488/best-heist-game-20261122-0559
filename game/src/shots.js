// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules
// forward from a fresh world, steered by a simple autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
// The autopilot scores eight moves each step: it wants the current goal (the tiara,
// then the exit) but pays a steep price for stepping into a cone or near a guard.

import { FIELD, STEP } from './config.js';
import { EVENT_CAUGHT, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { guardSees, inShadow } from './guards.js';
import { cameraSees } from './cameras.js';
import { ROOM } from './config.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 8;
const END_LIMIT_SECONDS = 600;
const SAMPLE_DIRECTIONS = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.707, 0.707], [0.707, -0.707], [-0.707, 0.707], [-0.707, -0.707],
];

/** How dangerous a point is: 0 when unseen, steep when a cone or a guard is close.
 *  Cones are read wider than they are, so the pilot keeps a margin from a sweeping cone. */
function dangerAt(world, x, y) {
  const state = world.state;
  const probe = { x, y };
  let danger = 0;
  for (const guard of state.guards) {
    if (guardSees(guard, probe, 0.3)) danger += 100;
    const distance = Math.hypot(guard.x - x, guard.y - y);
    if (distance < 110) danger += (110 - distance) / 2;
  }
  for (const camera of state.cameras) {
    if (cameraSees(camera, probe, state.time, 0.25)) danger += 80;
  }
  if (inShadow(x, y)) danger *= 0.6;
  return danger;
}

/** One autopilot step: pick the move that gets closer to the goal without walking into sight. */
export function autopilotMove(world, goal) {
  const state = world.state;
  const thief = state.thief;
  let best = SAMPLE_DIRECTIONS[0];
  let bestScore = Infinity;
  for (const direction of SAMPLE_DIRECTIONS) {
    const x = thief.x + direction[0] * 14;
    const y = thief.y + direction[1] * 14;
    if (x < 40 || x > FIELD.width - 40 || y < 60 || y > FIELD.height - 40) continue;
    const distance = Math.hypot(goal.x - x, goal.y - y);
    const score = distance + dangerAt(world, x, y) * 3.0;
    if (score < bestScore) {
      bestScore = score;
      best = direction;
    }
  }
  return { x: best[0], y: best[1] };
}

/** The goal: the tiara until it is taken, then the exit doorway. */
function currentGoal(world) {
  const state = world.state;
  if (!state.tiaraTaken) return { x: ROOM.tiaraCase.x + ROOM.tiaraCase.w / 2, y: ROOM.tiaraCase.y + 60 };
  return { x: ROOM.exit.x + ROOM.exit.w / 2, y: ROOM.exit.y - 10 };
}

/** A flee move: of the eight ways to run, the one that gets farthest from the chasing
 *  guard without running into another cone. Standing still is never an option — a
 *  chasing guard walks straight to where the thief stands. */
export function fleeMove(world, chaser) {
  const thief = world.state.thief;
  let best = SAMPLE_DIRECTIONS[1];
  let bestScore = -Infinity;
  for (let index = 1; index < SAMPLE_DIRECTIONS.length; index += 1) {
    const direction = SAMPLE_DIRECTIONS[index];
    const x = thief.x + direction[0] * 14;
    const y = thief.y + direction[1] * 14;
    if (x < 40 || x > FIELD.width - 40 || y < 60 || y > FIELD.height - 40) continue;
    const gap = Math.hypot(chaser.x - x, chaser.y - y);
    const score = gap - dangerAt(world, x, y) * 1.5;
    if (score > bestScore) {
      bestScore = score;
      best = direction;
    }
  }
  return { x: best[0], y: best[1] };
}

/** The centre of the shadow zone nearest the thief: where a hot thief cools off. */
function nearestShadow(thief) {
  let best = null;
  let bestDistance = Infinity;
  for (const zone of ROOM.shadows) {
    const centre = { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 };
    const distance = Math.hypot(centre.x - thief.x, centre.y - thief.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = centre;
    }
  }
  return best;
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return
 * the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, { x: 0, y: 0 }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const cautious = name === 'play';
  // A thief pushing straight into a display case never slides sideways on its own, so
  // watch for it: if the thief barely moved over 30 steps, sidestep around the case.
  let anchorX = world.state.thief.x;
  let anchorY = world.state.thief.y;
  let sidestep = null;
  // When the alarm runs hot the cautious pilot stops pushing and cools off in the
  // nearest shadow zone until it drops again — that is how a real heist survives.
  let cooling = false;
  // The pilot spends one EMP the first time a camera catches it, the way a real
  // thief would before lifting the tiara under the camera's nose.
  let empUsed = false;
  for (let index = 0; index < limit / STEP; index += 1) {
    if (cautious) {
      if (world.state.alarm > 55) cooling = true;
      else if (world.state.alarm < 25) cooling = false;
    }
    if (index % 30 === 0) {
      const moved = Math.hypot(world.state.thief.x - anchorX, world.state.thief.y - anchorY);
      if (moved < 15 && !sidestep) {
        const goal = currentGoal(world);
        const dx = goal.x - world.state.thief.x;
        const dy = goal.y - world.state.thief.y;
        const length = Math.hypot(dx, dy) || 1;
        const side = FIELD.width / 2 - world.state.thief.x >= 0 ? 1 : -1;
        sidestep = { dir: { x: (-dy / length) * side, y: (dx / length) * side }, until: index + 55 };
      }
      anchorX = world.state.thief.x;
      anchorY = world.state.thief.y;
    }
    let move;
    if (sidestep && index < sidestep.until) {
      move = sidestep.dir;
    } else {
      sidestep = null;
      // A chased thief runs away from the guard, not toward the loot.
      const chaser = cautious ? world.state.guards.find((guard) => guard.mode === 'chase') : null;
      // The end scene's pilot is reckless: it walks straight at the tiara and gets caught.
      move = cautious
        ? chaser ? fleeMove(world, chaser) : autopilotMove(world, cooling ? nearestShadow(world.state.thief) : currentGoal(world))
        : (() => {
            const goal = currentGoal(world);
            const dx = goal.x - world.state.thief.x;
            const dy = goal.y - world.state.thief.y;
            const length = Math.hypot(dx, dy) || 1;
            return { x: dx / length, y: dy / length };
          })();
    }
    const events = world.step(STEP, move, false);
    if (cautious && !empUsed && world.state.seenByCamera && world.state.empLeft > 0) {
      world.useEmp();
      empUsed = true;
    }
    if (events & (EVENT_CAUGHT | EVENT_WIN)) break;
  }
  const state = world.state;
  if (state.caught) return { screen: SCREEN_OVER, best: state.loot };
  if (state.won) return { screen: SCREEN_WIN, best: state.loot };
  return { screen: SCREEN_PLAY, best: state.loot };
}
