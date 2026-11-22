// The renderer: one canvas, one logical 1280x720 room, scaled to the window.
// It paints the room, every vision cone, the thief, the loot and the HUD — and the
// title, pause, win and caught screens over the top of it.

import { ALARM, CAMERA, FIELD, FONT, GUARD, PALETTE, ROOM, TOOLS } from './config.js';
import { inShadow } from './guards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    canvas.width = Math.round(FIELD.width * scale);
    canvas.height = Math.round(FIELD.height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function drawCone(x, y, angle, range, halfAngle, fill) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function drawRect(rect, fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }

  function drawRoom(state) {
    // Floor: checkerboard marble.
    drawRect({ x: 0, y: 0, w: FIELD.width, h: FIELD.height }, PALETTE.floor);
    ctx.fillStyle = PALETTE.floorTile;
    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 16; col += 1) {
        if ((row + col) % 2 === 0) ctx.fillRect(col * 80, row * 80, 80, 80);
      }
    }
    // Shadow zones: velvet-dark alcoves where the alarm climbs half as fast.
    for (const zone of ROOM.shadows) {
      drawRect(zone, PALETTE.shadow);
      ctx.strokeStyle = 'rgba(154, 144, 173, 0.35)';
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(zone.x + 1, zone.y + 1, zone.w - 2, zone.h - 2);
      ctx.setLineDash([]);
    }
    // The exit doorway, bottom centre-left, glowing green.
    const exit = ROOM.exit;
    ctx.fillStyle = PALETTE.exit;
    ctx.fillRect(exit.x, exit.y - 8, exit.w, 40);
    ctx.fillStyle = PALETTE.exitGlow;
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', exit.x + exit.w / 2, exit.y + 8);
    // Walls.
    for (const wall of ROOM.walls) {
      drawRect(wall, PALETTE.wall);
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(wall.x, wall.y, wall.w, 4);
    }
    // Display cases: gold frames over dark glass.
    for (const box of ROOM.cases) {
      drawRect(box, PALETTE.caseBase);
      ctx.strokeStyle = PALETTE.caseGold;
      ctx.lineWidth = 3;
      ctx.strokeRect(box.x + 2, box.y + 2, box.w - 4, box.h - 4);
      ctx.fillStyle = PALETTE.caseGlass;
      ctx.fillRect(box.x + 8, box.y + 8, box.w - 16, box.h - 16);
    }
    // Pillars.
    for (const pillar of ROOM.pillars) {
      drawRect(pillar, PALETTE.pillar);
      ctx.strokeStyle = PALETTE.wallTop;
      ctx.lineWidth = 2;
      ctx.strokeRect(pillar.x + 2, pillar.y + 2, pillar.w - 4, pillar.h - 4);
    }
    // The tiara's case, top centre, with a gold crown inside until it is taken.
    const tc = ROOM.tiaraCase;
    drawRect(tc, PALETTE.caseBase);
    ctx.strokeStyle = PALETTE.tiara;
    ctx.lineWidth = 3;
    ctx.strokeRect(tc.x + 2, tc.y + 2, tc.w - 4, tc.h - 4);
    ctx.fillStyle = PALETTE.caseGlass;
    ctx.fillRect(tc.x + 8, tc.y + 8, tc.w - 16, tc.h - 16);
    if (!state.tiaraTaken) {
      const cx = tc.x + tc.w / 2;
      const cy = tc.y + tc.h / 2;
      const pulse = 1 + 0.12 * Math.sin(state.time * 3);
      ctx.fillStyle = PALETTE.tiara;
      ctx.beginPath();
      ctx.moveTo(cx - 22 * pulse, cy + 10);
      ctx.lineTo(cx - 16 * pulse, cy - 12);
      ctx.lineTo(cx - 7 * pulse, cy + 2);
      ctx.lineTo(cx, cy - 16);
      ctx.lineTo(cx + 7 * pulse, cy + 2);
      ctx.lineTo(cx + 16 * pulse, cy - 12);
      ctx.lineTo(cx + 22 * pulse, cy + 10);
      ctx.closePath();
      ctx.fill();
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.tiara;
      ctx.fillText('SUNBURST TIARA', cx, tc.y + tc.h + 16);
    }
    // Gem pedestals.
    ROOM.gems.forEach((gem, index) => {
      if (state.gemsTaken[index]) return;
      ctx.fillStyle = PALETTE.caseGold;
      ctx.beginPath();
      ctx.arc(gem.x, gem.y + 8, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.gem;
      ctx.beginPath();
      ctx.moveTo(gem.x, gem.y - 12);
      ctx.lineTo(gem.x + 9, gem.y + 2);
      ctx.lineTo(gem.x, gem.y + 12);
      ctx.lineTo(gem.x - 9, gem.y + 2);
      ctx.closePath();
      ctx.fill();
    });
  }

  function drawCones(state) {
    for (const camera of state.cameras) {
      const disabled = state.time < camera.disabledUntil;
      drawCone(
        camera.x, camera.y, camera.angle, CAMERA.sightRange, CAMERA.sightHalfAngle,
        disabled ? 'rgba(120, 120, 120, 0.08)' : state.seenByCamera ? PALETTE.coneCameraSeen : PALETTE.coneCamera,
      );
    }
    for (const guard of state.guards) {
      const seen = guard.mode === 'chase';
      drawCone(
        guard.x, guard.y, guard.angle, GUARD.sightRange, GUARD.sightHalfAngle,
        seen ? PALETTE.coneGuardSeen : PALETTE.coneGuard,
      );
    }
  }

  function drawCamera(camera, now) {
    const disabled = now < camera.disabledUntil;
    ctx.fillStyle = disabled ? '#555' : '#8a2f2f';
    ctx.beginPath();
    ctx.arc(camera.x, camera.y, CAMERA.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d8d2c4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(camera.x, camera.y);
    ctx.lineTo(camera.x + Math.cos(camera.angle) * 18, camera.y + Math.sin(camera.angle) * 18);
    ctx.stroke();
    if (disabled) {
      ctx.fillStyle = '#9a90ad';
      ctx.font = `bold 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('EMP', camera.x, camera.y - 16);
    }
  }

  function drawGuard(guard) {
    // Body: dark suit with a red sash, facing along its angle.
    ctx.save();
    ctx.translate(guard.x, guard.y);
    ctx.rotate(guard.angle);
    ctx.fillStyle = PALETTE.guardSuit;
    ctx.beginPath();
    ctx.arc(0, 0, GUARD.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.guard;
    ctx.fillRect(-2, -GUARD.radius, 5, GUARD.radius * 2);
    ctx.fillStyle = '#f2ecdf';
    ctx.beginPath();
    ctx.arc(GUARD.radius + 3, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Alert mark while chasing.
    if (guard.mode === 'chase') {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = `bold 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('!', guard.x, guard.y - GUARD.radius - 8);
    } else if (guard.mode === 'lured') {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `bold 16px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('?', guard.x, guard.y - GUARD.radius - 8);
    }
  }

  function drawThief(state) {
    const thief = state.thief;
    const hidden = inShadow(thief.x, thief.y);
    ctx.fillStyle = hidden ? 'rgba(91, 127, 232, 0.45)' : PALETTE.thief;
    ctx.beginPath();
    ctx.arc(thief.x, thief.y, thief.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.thiefHood;
    ctx.beginPath();
    ctx.arc(thief.x, thief.y - 2, thief.radius - 5, 0, Math.PI * 2);
    ctx.fill();
    // The mask: two pale eyes.
    ctx.fillStyle = '#f2ecdf';
    ctx.beginPath();
    ctx.arc(thief.x - 4, thief.y - 3, 2.2, 0, Math.PI * 2);
    ctx.arc(thief.x + 4, thief.y - 3, 2.2, 0, Math.PI * 2);
    ctx.fill();
    if (state.grabGrace > 0 && Math.floor(state.time * 10) % 2 === 0) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(thief.x, thief.y, thief.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    // The decoy mark, where the thrown noisemaker landed.
    if (state.decoyMark) {
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(state.decoyMark.x, state.decoyMark.y, 10 + 4 * Math.sin(state.time * 6), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawHud(state, best) {
    const barWidth = 260;
    const barX = FIELD.width / 2 - barWidth / 2;
    ctx.fillStyle = PALETTE.hud;
    ctx.fillRect(0, 0, FIELD.width, 46);
    ctx.strokeStyle = PALETTE.hudLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 46.5);
    ctx.lineTo(FIELD.width, 46.5);
    ctx.stroke();
    ctx.textBaseline = 'middle';
    // Loot on the left.
    ctx.textAlign = 'left';
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(`LOOT $${state.loot.toLocaleString('en-US')}`, 16, 24);
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`best $${best.toLocaleString('en-US')}`, 170, 24);
    // The alarm meter, centre: it fills red as the heist heats up.
    ctx.textAlign = 'center';
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillStyle = state.alarm > 66 ? PALETTE.danger : PALETTE.text;
    ctx.fillText('ALARM', barX - 34, 24);
    ctx.fillStyle = '#241d33';
    ctx.fillRect(barX, 14, barWidth, 18);
    const alarmFill = (state.alarm / ALARM.max) * barWidth;
    ctx.fillStyle = state.alarm > 66 ? PALETTE.danger : state.alarm > 33 ? '#e8a33d' : PALETTE.exit;
    ctx.fillRect(barX, 14, alarmFill, 18);
    ctx.strokeStyle = PALETTE.hudLine;
    ctx.strokeRect(barX + 0.5, 14.5, barWidth, 18);
    if (state.seenByGuard || state.seenByCamera) {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = `bold 15px ${FONT}`;
      ctx.fillText(state.seenByGuard ? 'SPOTTED!' : 'ON CAMERA!', barX + barWidth / 2, 44 + 8);
    }
    // Tools on the right.
    ctx.textAlign = 'right';
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillStyle = state.empLeft > 0 ? PALETTE.text : PALETTE.muted;
    ctx.fillText(`[E] EMP x${state.empLeft} (-$${TOOLS.emp.cost})`, FIELD.width - 16, 16);
    ctx.fillStyle = state.decoyLeft > 0 ? PALETTE.text : PALETTE.muted;
    ctx.fillText(`[Q] Decoy x${state.decoyLeft} (-$${TOOLS.noise.cost})`, FIELD.width - 16, 36);
  }

  function drawOverlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(10, 8, 16, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent;
    ctx.font = `bold 54px ${FONT}`;
    ctx.fillText(title, FIELD.width / 2, 250);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `20px ${FONT}`;
    lines.forEach((line, index) => {
      ctx.fillText(line, FIELD.width / 2, 320 + index * 34);
    });
  }

  return {
    draw(state, screen, best) {
      fit();
      ctx.clearRect(0, 0, FIELD.width, FIELD.height);
      drawRoom(state);
      drawCones(state);
      for (const camera of state.cameras) drawCamera(camera, state.time);
      for (const guard of state.guards) drawGuard(guard);
      drawThief(state);
      drawHud(state, best);
      if (screen === SCREEN_TITLE) {
        drawOverlay('THE GILDED VAULT', [
          'Steal the Sunburst Tiara and slip out the exit.',
          'Guards patrol with sweeping cones — cameras too. Shadows slow the alarm.',
          'WASD / arrows or click to move · E: EMP (-$500) · Q: Decoy (-$250)',
          'Grab the tiara, then reach the green EXIT. Press Space or click to begin.',
        ], PALETTE.gold);
      } else if (screen === SCREEN_PAUSED) {
        drawOverlay('PAUSED', ['Press P or Space to keep stealing.'], PALETTE.text);
      } else if (screen === SCREEN_WIN) {
        drawOverlay('CLEAN GETAWAY!', [
          `You slipped out with $${state.loot.toLocaleString('en-US')} of loot.`,
          `Alarm peaked at ${Math.round(state.alarm)}%. The vault never knew you were there.`,
          'Press Space or click to run it again.',
        ], PALETTE.exitGlow);
      } else if (screen === SCREEN_OVER) {
        const lines = [
          'The alarm hit 100% and the vault doors slammed shut.',
          state.tiaraTaken
            ? `The guards drag you out and the tiara goes back in its case — but you kept $${state.loot.toLocaleString('en-US')} of loot.`
            : `You kept $${state.loot.toLocaleString('en-US')} of loot — but the tiara stays behind.`,
          'Press Space or click to try the heist again.',
        ];
        drawOverlay('CAUGHT!', lines, PALETTE.danger);
      }
    },
  };
}
