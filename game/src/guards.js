// Guards: they walk a patrol loop, sweep their gaze as they walk, and chase the thief
// when they spot one. A guard sees the thief only inside its vision cone AND with a
// clear line of sight (walls, cases and pillars block sight).

import { FIELD, GUARD, ROOM } from './config.js';
import { lineBlockedByRects, pointInRect } from './sight.js';

/** Every rectangle that blocks a guard's sight: walls, cases and pillars. */
export const SIGHT_BLOCKERS = [...ROOM.walls, ...ROOM.cases, ...ROOM.pillars];

/** The three patrol loops, one per guard: waypoints the guard walks in order. */
export const PATROLS = [
  [
    { x: 90, y: 100 }, { x: 540, y: 100 }, { x: 540, y: 620 }, { x: 90, y: 620 },
  ],
  [
    { x: 1190, y: 100 }, { x: 740, y: 100 }, { x: 740, y: 620 }, { x: 1190, y: 620 },
  ],
  [
    { x: 640, y: 240 }, { x: 940, y: 240 }, { x: 940, y: 620 }, { x: 340, y: 620 }, { x: 340, y: 240 },
  ],
];

/**
 * A guard: position, facing angle, current patrol waypoint, and chase state.
 * mode is 'patrol' | 'chase' | 'lured' (walking to a decoy noise).
 */
export function createGuard(patrol, x, y) {
  return {
    x, y,
    angle: 0,
    patrol,
    waypoint: 0,
    mode: 'patrol',
    memory: 0,
    lure: null,
    pause: 0,
  };
}

/** True when the thief is inside the guard's cone with nothing solid between them.
 *  `margin` widens the cone (the autopilot reads danger with a safety margin). */
export function guardSees(guard, thief, margin = 0) {
  const dx = thief.x - guard.x;
  const dy = thief.y - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance > GUARD.sightRange) return false;
  let diff = Math.atan2(dy, dx) - guard.angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > GUARD.sightHalfAngle + margin) return false;
  return !lineBlockedByRects(guard.x, guard.y, thief.x, thief.y, SIGHT_BLOCKERS);
}

/** True when the thief is standing in a shadow zone (dark floor, harder to spot). */
export function inShadow(x, y) {
  return ROOM.shadows.some((zone) => pointInRect(x, y, zone));
}

function moveToward(guard, targetX, targetY, speed, dt) {
  const dx = targetX - guard.x;
  const dy = targetY - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return true;
  const step = Math.min(distance, speed * dt);
  guard.x += (dx / distance) * step;
  guard.y += (dy / distance) * step;
  guard.angle = Math.atan2(dy, dx);
  return distance <= step;
}

/** Advance one guard by dt. Returns 'spotted' when this guard can see the thief now. */
export function stepGuard(guard, thief, dt) {
  const seen = guardSees(guard, thief);
  if (seen) {
    guard.mode = 'chase';
    guard.memory = GUARD.chaseMemory;
    guard.lure = null;
  } else if (guard.mode === 'chase') {
    guard.memory -= dt;
    if (guard.memory <= 0) guard.mode = 'patrol';
  }

  if (guard.mode === 'chase') {
    moveToward(guard, thief.x, thief.y, GUARD.chaseSpeed, dt);
  } else if (guard.mode === 'lured' && guard.lure) {
    if (moveToward(guard, guard.lure.x, guard.lure.y, GUARD.patrolSpeed * 1.4, dt)) {
      guard.mode = 'patrol';
      guard.lure = null;
      guard.pause = 1.2;
    }
  } else {
    if (guard.pause > 0) {
      guard.pause -= dt;
      return seen;
    }
    const point = guard.patrol[guard.waypoint];
    if (moveToward(guard, point.x, point.y, GUARD.patrolSpeed, dt)) {
      guard.waypoint = (guard.waypoint + 1) % guard.patrol.length;
      guard.pause = 0.8;
    }
  }
  guard.x = Math.min(FIELD.width - 24 - GUARD.radius, Math.max(24 + GUARD.radius, guard.x));
  guard.y = Math.min(FIELD.height - 24 - GUARD.radius, Math.max(24 + GUARD.radius, guard.y));
  return seen;
}

/** Send the nearest guard to investigate a noise at (x, y). */
export function lureGuards(guards, x, y) {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const guard of guards) {
    const distance = Math.hypot(guard.x - x, guard.y - y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = guard;
    }
  }
  if (nearest && nearest.mode !== 'chase') {
    nearest.mode = 'lured';
    nearest.lure = { x, y };
  }
}
