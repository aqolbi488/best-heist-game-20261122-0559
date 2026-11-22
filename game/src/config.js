// Every tuning number, colour and the room layout for "The Gilded Vault" in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the window,
// so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The thief: a hooded figure in dark blue. */
export const THIEF = {
  radius: 13,
  speed: 205,
  /** Seconds of grace after being grabbed by a guard before another grab can land. */
  grabGrace: 1.5,
};

/** Alarm 0..100. At 100 the heist is blown and the run ends. */
export const ALARM = {
  max: 100,
  /** Points per second while a guard's cone holds the thief. */
  guardRate: 28,
  /** Points per second while a camera's cone holds the thief. */
  cameraRate: 20,
  /** Points per second the alarm cools while nobody can see the thief. */
  coolRate: 9,
  /** Alarm added when a guard physically grabs the thief. */
  grabPenalty: 45,
  /** Standing in a shadow zone halves every rate that would raise the alarm. */
  shadowFactor: 0.5,
};

/** Tools, each with a price taken off the loot the moment it is used. */
export const TOOLS = {
  emp: { key: 'KeyE', label: 'EMP', cost: 500, charges: 2, disableSeconds: 6 },
  noise: { key: 'KeyQ', label: 'Decoy', cost: 250, charges: 3 },
};

export const LOOT = {
  tiara: 2500,
  gem: 400,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 72,
  chaseSpeed: 132,
  /** Vision cone: how far a guard can see, and its half-angle in radians. */
  sightRange: 235,
  sightHalfAngle: 0.62,
  /** How long a guard chases after losing sight before giving up and resuming patrol. */
  chaseMemory: 2.2,
};

export const CAMERA = {
  radius: 10,
  sightRange: 250,
  sightHalfAngle: 0.55,
  /** Degrees per second the camera head sweeps, back and forth. */
  sweepSpeed: 34,
  sweepHalfAngle: 0.85,
};

export const PALETTE = {
  floor: '#1d1a24',
  floorTile: '#221e2c',
  wall: '#3a2f4d',
  wallTop: '#4d3f66',
  shadow: '#14101c',
  caseGlass: '#2c3e55',
  caseGold: '#d9a441',
  caseBase: '#241d33',
  pillar: '#3d3352',
  exit: '#2fae6e',
  exitGlow: '#57d68f',
  tiara: '#ffd94d',
  gem: '#7fe3ff',
  thief: '#5b7fe8',
  thiefHood: '#2c3a6e',
  guard: '#c9403d',
  guardSuit: '#5a2e2e',
  coneGuard: 'rgba(255, 196, 66, 0.20)',
  coneGuardSeen: 'rgba(255, 70, 50, 0.34)',
  coneCamera: 'rgba(255, 120, 120, 0.16)',
  coneCameraSeen: 'rgba(255, 60, 60, 0.30)',
  hud: '#0f0d16',
  hudLine: '#3a2f4d',
  text: '#f2ecdf',
  muted: '#9a90ad',
  danger: '#ff5148',
  gold: '#e8b64c',
};

/** The room: walls, display cases, pillars and shadow zones the thief can hide in.
 *  All rectangles are {x, y, w, h} in logical pixels. Walls block movement and sight;
 *  cases block movement and sight; pillars block movement and sight; shadow zones
 *  only slow the alarm (they are dark floor, not walls). */
export const ROOM = {
  // Outer walls (a 24px frame around the room; the exit gap is cut from the bottom one).
  walls: [
    { x: 0, y: 0, w: 1280, h: 24 },
    { x: 0, y: 696, w: 560, h: 24 },
    { x: 700, y: 696, w: 580, h: 24 },
    { x: 0, y: 0, w: 24, h: 720 },
    { x: 1256, y: 0, w: 24, h: 720 },
  ],
  // The exit doorway, bottom centre-left, between the two bottom wall segments.
  // It sits high enough that the thief (clamped to the inner wall edge) can stand in it.
  exit: { x: 560, y: 664, w: 140, h: 32 },
  // Display cases: three routes around the hall (left gallery, centre aisle, right gallery).
  cases: [
    { x: 150, y: 150, w: 150, h: 60 },
    { x: 150, y: 420, w: 150, h: 60 },
    { x: 980, y: 150, w: 150, h: 60 },
    { x: 980, y: 420, w: 150, h: 60 },
    { x: 565, y: 300, w: 150, h: 70 },
    { x: 420, y: 130, w: 90, h: 90 },
    { x: 770, y: 130, w: 90, h: 90 },
    { x: 420, y: 500, w: 90, h: 90 },
    { x: 770, y: 500, w: 90, h: 90 },
  ],
  // Pillars in the middle of the hall.
  pillars: [
    { x: 330, y: 300, w: 44, h: 44 },
    { x: 906, y: 300, w: 44, h: 44 },
  ],
  // Shadow zones: velvet-draped alcoves where the alarm climbs half as fast.
  shadows: [
    { x: 60, y: 250, w: 110, h: 130 },
    { x: 1110, y: 250, w: 110, h: 130 },
    { x: 590, y: 560, w: 100, h: 90 },
  ],
  // The tiara's case, top centre, behind the centre aisle.
  tiaraCase: { x: 590, y: 56, w: 100, h: 56 },
  // Side loot: gem pedestals in the left and right galleries.
  gems: [
    { x: 225, y: 180 },
    { x: 225, y: 450 },
    { x: 1055, y: 180 },
    { x: 1055, y: 450 },
  ],
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best haul is kept between visits (this browser only). */
export const BEST_KEY = 'gilded-vault.best';
