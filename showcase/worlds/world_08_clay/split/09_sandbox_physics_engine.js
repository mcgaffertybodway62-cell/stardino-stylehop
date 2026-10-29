    // =========================================================================
    // 10. SUB-STEPPED SANDBOX PHYSICS ENGINE (Zero Clipping + Autonomous Star)
    // =========================================================================
    function triggerSandboxDominoChain(startIndex = 0) {
      const d = dominoObjects[startIndex];
      if (d && d.angleDeg < 5) {
        d.active = true;
        d.angularVel = 190;
        audioSynth.playWoodblock(520 + startIndex * 50);
      }
    }

    function resetSandboxMechanisms() {
      dominoObjects.forEach(d => {
        d.angleDeg = 0;
        d.angularVel = 0;
        d.active = false;
        d.pivotGroup.rotation.z = 0;
        if (d.rippleRing) d.rippleRing.material.opacity = 0;
      });
      macaronObjects.forEach(m => {
        m.squash = 1.0;
        m.squashVel = 0.0;
        m.dentLevel = 0.0;
        m.dentRing.visible = false;
        m.group.scale.set(1, 1, 1);
      });
    }

    function updateSandboxPhysics(dt, nowSec) {
      const subSteps = 4;
      const subDt = dt / subSteps;

      if (sandboxState.jumpBuffer > 0) sandboxState.jumpBuffer -= dt;
      if (sandboxState.coyoteTime > 0) sandboxState.coyoteTime -= dt;

      for (let step = 0; step < subSteps; step++) {
        const targetVx = sandboxState.keys.left ? -7.2 : (sandboxState.keys.right ? 7.2 : 0.0);
        const accel = sandboxState.onGround ? 28.0 : 14.0;
        sandboxState.vx = lerp(sandboxState.vx, targetVx, clamp(accel * subDt, 0.0, 1.0));

        let nextX = clamp(sandboxState.x + sandboxState.vx * subDt, -21.5, 32.2);

        const dom0 = dominoObjects[0];
        if (dom0 && dom0.angleDeg < 25) {
          const domLeftWall = dom0.spec.x - DOMINO_W - SLIME_R;
          const domRightWall = dom0.spec.x + SLIME_R;
          if (sandboxState.x <= domLeftWall + 0.15 && nextX > domLeftWall && sandboxState.footY < DOMINO_H) {
            nextX = domLeftWall;
            triggerSandboxDominoChain(0);
            sandboxState.vx = -2.2;
            slimeDynamics.injectImpulse(-2.5);
            slimeActor.setEyeMode('happy');
          } else if (sandboxState.x >= domRightWall - 0.15 && nextX < domRightWall && sandboxState.footY < DOMINO_H) {
            nextX = domRightWall;
            sandboxState.vx = 1.5;
          }
        }

        if (nextX > 30.1 && sandboxState.footY > 2.95) {
          nextX = 30.1;
          sandboxState.vx = -1.5;
        }

        const dx = nextX - sandboxState.x;
        sandboxState.x = nextX;
        sandboxState.rollAngle -= dx / SLIME_R;

        dominoObjects.forEach((d, idx) => {
          if (d.active && d.angleDeg < d.restDeg) {
            const rad = THREE.MathUtils.degToRad(Math.max(8, d.angleDeg));
            d.angularVel += 520 * Math.sin(rad) * subDt;
            d.angleDeg = Math.min(d.restDeg, d.angleDeg + d.angularVel * subDt);
            if (d.angleDeg >= 24 && idx + 1 < dominoObjects.length) {
              const nextD = dominoObjects[idx + 1];
              if (!nextD.active) {
                nextD.active = true;
                nextD.angularVel = d.angularVel * 0.88;
                audioSynth.playWoodblock(540 + (idx + 1) * 55);
              }
            }
            if (d.angleDeg >= d.restDeg && d.rippleRing) {
              d.rippleRing.material.opacity = 0.72;
            }
          }
          d.pivotGroup.rotation.z = -THREE.MathUtils.degToRad(d.angleDeg);
        });

        const terrain = sampleStaticOrBridgeSurface(sandboxState.x);
        let supportY = terrain.groundY;
        let supportSlope = terrain.slopeAngle;
        let activeMacaron = null;

        macaronObjects.forEach((m) => {
          if (!m.spec.isTrampoline) return;
          const dist = Math.abs(sandboxState.x - m.spec.x);
          if (dist < m.spec.r * 0.98) {
            const mTop = m.getTopYAt(sandboxState.x);
            if (mTop >= supportY) {
              supportY = mTop;
              supportSlope = 0.0;
              activeMacaron = m;
            }
          }
        });

        sandboxState.vy -= 25.0 * subDt;
        sandboxState.footY += sandboxState.vy * subDt;

        if (sandboxState.footY <= supportY) {
          const impactVy = sandboxState.vy;
          sandboxState.footY = supportY;

          if (activeMacaron && impactVy < -1.5) {
            const launchVy = clamp(Math.abs(impactVy) * activeMacaron.spec.e, 8.8, 14.2);
            sandboxState.vy = launchVy;
            sandboxState.onGround = false;
            activeMacaron.squashVel = -7.5;
            activeMacaron.dentLevel = 1.0;
            activeMacaron.dentRing.visible = true;
            slimeDynamics.injectImpulse(-4.8);
            slimeActor.setEyeMode('happy');
            audioSynth.playMacaronBoing(1.0 + activeMacaron.index * 0.15);
          } else {
            if (impactVy < -3.5) {
              slimeDynamics.injectImpulse(-clamp(Math.abs(impactVy) * 0.45, 1.2, 4.5));
              audioSynth.playWoodblock(420);
            }
            sandboxState.vy = 0.0;
            sandboxState.onGround = true;
            sandboxState.coyoteTime = 0.12;
          }
        } else {
          sandboxState.onGround = false;
        }

        if (sandboxState.jumpBuffer > 0 && sandboxState.coyoteTime > 0) {
          sandboxState.vy = 9.6;
          sandboxState.onGround = false;
          sandboxState.jumpBuffer = 0.0;
          sandboxState.coyoteTime = 0.0;
          slimeDynamics.injectImpulse(3.8);
          audioSynth.playMacaronBoing(1.05);
        }

        sandboxState.tiltAngle = lerp(
          sandboxState.tiltAngle,
          -supportSlope + sandboxState.vx * 0.022,
          clamp(16.0 * subDt, 0.0, 1.0)
        );
      }

      macaronObjects.forEach((m) => {
        const force = 190.0 * (1.0 - m.squash) - 14.0 * m.squashVel;
        m.squashVel += force * dt;
        m.squash = clamp(m.squash + m.squashVel * dt, 0.52, 1.18);
        const mInv = 1.0 / Math.sqrt(Math.max(0.45, m.squash));
        m.group.scale.set(mInv, m.squash, mInv);
      });

      const targetSquash = sandboxState.onGround
        ? 1.0
        : clamp(1.0 + Math.abs(sandboxState.vy) * 0.022, 0.85, 1.24);
      const finalSquash = slimeDynamics.stepSpring(targetSquash, dt);

      const sy = footYToCenterY(sandboxState.footY, finalSquash);
      const invS = 1.0 / Math.sqrt(Math.max(0.45, finalSquash));

      slimeActor.root.position.set(sandboxState.x, sy, LANE_Z);
      slimeActor.bodyGroup.scale.set(invS, finalSquash, invS);
      slimeActor.bodyGroup.rotation.z = -sandboxState.tiltAngle;
      slimeActor.rollingCore.rotation.z = sandboxState.rollAngle;

      // Autonomous smooth flying companion Star in Sandbox mode
      thumbprintTokenStar.visible = false;
      starDynamics.updateFromSandbox(sandboxState.x, sandboxState.footY, nowSec, dt);

      const targetCamX = sandboxState.x + 1.4;
      const targetCamY = 6.4 + sandboxState.footY * 0.45;
      slimeDynamics.camX = lerp(slimeDynamics.camX, targetCamX, 1.0 - Math.exp(-8.0 * dt));
      slimeDynamics.camY = lerp(slimeDynamics.camY, targetCamY, 1.0 - Math.exp(-8.0 * dt));
      applyCameraPreset(slimeDynamics.camX, slimeDynamics.camY, 20.5, sandboxState.x, sy);
    }

