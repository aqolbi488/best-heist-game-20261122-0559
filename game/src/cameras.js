// Security cameras: wall-mounted, sweeping their cone back and forth on a fixed arc.
// A camera never moves, but its sweeping cone is the room's metronome — time your crossing
// to the sweep. An EMP freezes every camera for a few seconds.

import { CAMERA } from './config.js';
import { lineBlockedByRects } from './sight.js';
import { SIGHT_BLOCKERS } from './guards.js';

/** The two cameras: where they hang, which way they face at rest, and their sweep arc. */
export const CAMERA_SPOTS = [
  { x: 640, y: 30, baseAngle: Math.PI / 2, phase: 0 },
  { x: 1240, y: 360, baseAngle: Math.PI, phase: Math.PI },
];

export function createCamera(spot) {
  return {
    x: spot.x,
    y: spot.y,
    baseAngle: spot.baseAngle,
    phase: spot.phase,
    angle: spot.baseAngle,
    disabledUntil: 0,
  };
}

/** Advance one camera's sweep by dt. `now` is the world's clock, in seconds. */
export function stepCamera(camera, dt, now) {
  if (now < camera.disabledUntil) return;
  camera.angle = camera.baseAngle + Math.sin(camera.phase + now * ((CAMERA.sweepSpeed * Math.PI) / 180)) * CAMERA.sweepHalfAngle;
}

/** True when the camera is live and its cone holds the thief with a clear line of sight.
 *  `margin` widens the cone (the autopilot reads danger with a safety margin). */
export function cameraSees(camera, thief, now, margin = 0) {
  if (now < camera.disabledUntil) return false;
  const dx = thief.x - camera.x;
  const dy = thief.y - camera.y;
  const distance = Math.hypot(dx, dy);
  if (distance > CAMERA.sightRange) return false;
  let diff = Math.atan2(dy, dx) - camera.angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > CAMERA.sightHalfAngle + margin) return false;
  return !lineBlockedByRects(camera.x, camera.y, thief.x, thief.y, SIGHT_BLOCKERS);
}

/** Freeze every camera until `until` on the world's clock. */
export function disableCameras(cameras, until) {
  for (const camera of cameras) camera.disabledUntil = until;
}
