// The world: one room, one thief, three guards, two cameras, the tiara and the exit.
// A step moves the thief, advances every guard and camera, raises or cools the alarm,
// and reports what happened so the loop can play sounds and change screens.

import { ALARM, CAMERA, FIELD, GUARD, LOOT, ROOM, THIEF, TOOLS } from './config.js';
import { createCamera, cameraSees, disableCameras, stepCamera, CAMERA_SPOTS } from './cameras.js';
import { createGuard, guardSees, inShadow, lureGuards, stepGuard, PATROLS } from './guards.js';
import { pointInRect } from './sight.js';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1;
export const EVENT_TIARA = 2;
export const EVENT_SPOTTED = 4;
export const EVENT_GRABBED = 8;
export const EVENT_EMP = 16;
export const EVENT_DECOY = 32;
export const EVENT_WIN = 64;
export const EVENT_CAUGHT = 128;

/** Every solid rectangle the thief collides with: walls, cases and pillars. */
export const SOLID = [...ROOM.walls, ...ROOM.cases, ...ROOM.pillars, ROOM.tiaraCase];

export function createWorld(random) {
  const world = {
    random,
    state: null,
    reset() {
      const state = {
        time: 0,
        thief: { x: 630, y: 640, radius: THIEF.radius },
        loot: 0,
        alarm: 0,
        tiaraTaken: false,
        gemsTaken: ROOM.gems.map(() => false),
        empLeft: TOOLS.emp.charges,
        decoyLeft: TOOLS.noise.charges,
        grabGrace: 0,
        seenByGuard: false,
        seenByCamera: false,
        guards: PATROLS.map((patrol, index) => createGuard(patrol, patrol[0].x, patrol[0].y)),
        cameras: CAMERA_SPOTS.map(createCamera),
        decoyMark: null,
        won: false,
        caught: false,
      };
      // Start each guard a little way along its patrol so the room is already alive.
      state.guards[0].waypoint = 1;
      state.guards[1].waypoint = 1;
      state.guards[2].waypoint = 2;
      world.state = state;
    },
    /**
     * Advance the world one fixed step. `move` is the normalised direction from input
     * (or a mouse target, resolved by the caller into a direction); `attract` runs the
     * room behind the title screen with no thief and no alarm. Returns an event mask.
     */
    step(dt, move, attract) {
      const state = world.state;
      state.time += dt;
      let events = EVENT_NONE;

      for (const camera of state.cameras) stepCamera(camera, dt, state.time);

      if (!attract) {
        moveThief(state, move, dt);
        events |= takeLoot(state);
        if (state.grabGrace > 0) state.grabGrace -= dt;
        if (state.decoyMark && state.time - state.decoyMark.at > 2.5) state.decoyMark = null;
      }

      let seenGuard = false;
      let seenCamera = false;
      for (const guard of state.guards) {
        if (stepGuard(guard, state.thief, dt)) seenGuard = true;
      }
      for (const camera of state.cameras) {
        if (cameraSees(camera, state.thief, state.time)) seenCamera = true;
      }
      const wasSeen = state.seenByGuard || state.seenByCamera;
      state.seenByGuard = seenGuard;
      state.seenByCamera = seenCamera;

      if (!attract) {
        if ((seenGuard || seenCamera) && !wasSeen) events |= EVENT_SPOTTED;
        const shadowed = inShadow(state.thief.x, state.thief.y);
        const factor = shadowed ? ALARM.shadowFactor : 1;
        if (seenGuard) state.alarm += ALARM.guardRate * factor * dt;
        if (seenCamera) state.alarm += ALARM.cameraRate * factor * dt;
        if (!seenGuard && !seenCamera) state.alarm -= ALARM.coolRate * dt;
        state.alarm = Math.min(ALARM.max, Math.max(0, state.alarm));

        // A guard that reaches the thief grabs them: a big alarm jump and a shove away.
        for (const guard of state.guards) {
          const distance = Math.hypot(guard.x - state.thief.x, guard.y - state.thief.y);
          if (distance < GUARD.radius + state.thief.radius + 2 && state.grabGrace <= 0) {
            state.alarm = Math.min(ALARM.max, state.alarm + ALARM.grabPenalty);
            state.grabGrace = THIEF.grabGrace;
            const push = Math.max(1, distance);
            state.thief.x += ((state.thief.x - guard.x) / push) * 46;
            state.thief.y += ((state.thief.y - guard.y) / push) * 46;
            clampThief(state);
            events |= EVENT_GRABBED;
          }
        }

        // Win: the tiara is in the bag and the thief reaches the exit doorway.
        if (state.tiaraTaken && pointInRect(state.thief.x, state.thief.y, ROOM.exit)) {
          state.won = true;
          events |= EVENT_WIN;
        }
        if (state.alarm >= ALARM.max) {
          state.caught = true;
          events |= EVENT_CAUGHT;
        }
      }
      return events;
    },
    /** Fire the EMP: freeze every camera for a few seconds, at the cost of loot. */
    useEmp() {
      const state = world.state;
      if (state.empLeft <= 0 || state.won || state.caught) return EVENT_NONE;
      state.empLeft -= 1;
      state.loot = Math.max(0, state.loot - TOOLS.emp.cost);
      disableCameras(state.cameras, state.time + TOOLS.emp.disableSeconds);
      return EVENT_EMP;
    },
    /** Throw a decoy: the nearest guard walks off to investigate it, at the cost of loot. */
    useDecoy() {
      const state = world.state;
      if (state.decoyLeft <= 0 || state.won || state.caught) return EVENT_NONE;
      state.decoyLeft -= 1;
      state.loot = Math.max(0, state.loot - TOOLS.noise.cost);
      const x = state.thief.x + (world.random.next() - 0.5) * 320;
      const y = state.thief.y - 180 - world.random.next() * 80;
      const mark = { x: Math.min(1200, Math.max(80, x)), y: Math.min(640, Math.max(80, y)), at: state.time };
      state.decoyMark = mark;
      lureGuards(state.guards, mark.x, mark.y);
      return EVENT_DECOY;
    },
  };
  world.reset();
  return world;
}

function circleHitsRect(x, y, radius, rect) {
  const closestX = Math.min(rect.x + rect.w, Math.max(rect.x, x));
  const closestY = Math.min(rect.y + rect.h, Math.max(rect.y, y));
  return (x - closestX) ** 2 + (y - closestY) ** 2 < radius * radius;
}

function clampThief(state) {
  state.thief.x = Math.min(FIELD.width - 24 - state.thief.radius, Math.max(24 + state.thief.radius, state.thief.x));
  state.thief.y = Math.min(FIELD.height - 24 - state.thief.radius, Math.max(24 + state.thief.radius, state.thief.y));
}

function moveThief(state, move, dt) {
  const thief = state.thief;
  const stepX = move.x * THIEF.speed * dt;
  const stepY = move.y * THIEF.speed * dt;
  const tryX = thief.x + stepX;
  if (!SOLID.some((rect) => circleHitsRect(tryX, thief.y, thief.radius, rect))) thief.x = tryX;
  const tryY = thief.y + stepY;
  if (!SOLID.some((rect) => circleHitsRect(thief.x, tryY, thief.radius, rect))) thief.y = tryY;
  clampThief(state);
}

function takeLoot(state) {
  let events = EVENT_NONE;
  const thief = state.thief;
  if (!state.tiaraTaken) {
    const caseRect = ROOM.tiaraCase;
    const centreX = caseRect.x + caseRect.w / 2;
    const centreY = caseRect.y + caseRect.h / 2;
    if (Math.hypot(thief.x - centreX, thief.y - centreY) < 78) {
      state.tiaraTaken = true;
      state.loot += LOOT.tiara;
      events |= EVENT_TIARA;
    }
  }
  ROOM.gems.forEach((gem, index) => {
    if (!state.gemsTaken[index] && Math.hypot(thief.x - gem.x, thief.y - gem.y) < 34) {
      state.gemsTaken[index] = true;
      state.loot += LOOT.gem;
      events |= EVENT_PICKUP;
    }
  });
  return events;
}
