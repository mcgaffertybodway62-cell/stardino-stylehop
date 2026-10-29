    // =========================================================================
    // 6. UNIFIED ANALYTICAL SURFACE HEIGHTFIELD (Guarantees Zero Floor/Prop Clipping!)
    // =========================================================================
    function sampleStaticOrBridgeSurface(x) {
      if (x >= 30.75) {
        return { groundY: 2.54, slopeAngle: 0.0 };
      }
      if (x >= RAMP_X1) {
        return { groundY: RAMP_Y1, slopeAngle: 0.0 };
      }
      if (x >= RAMP_X0 && x < RAMP_X1) {
        const u = (x - RAMP_X0) / (RAMP_X1 - RAMP_X0);
        return {
          groundY: lerp(RAMP_Y0, RAMP_Y1, u),
          slopeAngle: RAMP_SLOPE_ANGLE
        };
      }
      if (x >= -1.35 && x <= 4.55) {
        if (dominoObjects[4] && dominoObjects[4].angleDeg > 65) {
          return { groundY: 0.34, slopeAngle: 0.0 };
        }
        return { groundY: 0.14, slopeAngle: 0.0 };
      }
      return { groundY: 0.0, slopeAngle: 0.0 };
    }

    function footYToCenterY(footY, squashY) {
      return footY + SLIME_FOOT_OFFSET * squashY;
    }

    // =========================================================================
    // 7. INDEPENDENT AERIAL FLIGHT ENGINE FOR THE GUIDE STAR (✦)
    //    - Completely decoupled from Slime's hops!
    //    - Uses a smooth C2-continuous 3D flight spline with clearance envelope
    //    - Never clips through dice, dominoes, macarons, ruler, or kaleidoscope walls
    //    - Smoothly glides deep into the hollow Kaleidoscope tunnel at 12.2–13.4s
    //      while spawning the separate Thumbprint Clay Star Token!
    // =========================================================================
    const starFlightWaypoints = [
      { t: 0.0,  x: -14.8, y: 1.75, z: 0.15 }, // Hovering above & behind the cream clay die
      { t: 1.6,  x: -14.4, y: 1.95, z: 0.55 }, // Peeking out to greet Slime
      { t: 2.3,  x: -9.5,  y: 2.55, z: LANE_Z }, // Graceful high arc over Screen 1
      { t: 3.1,  x: -3.2,  y: 2.85, z: LANE_Z }, // Soaring high across the upright Dominoes
      { t: 3.9,  x: 3.8,   y: 2.15, z: LANE_Z }, // Arriving on the far bank of the Caramel River
      { t: 5.2,  x: 4.1,   y: 2.25, z: LANE_Z }, // Hovering & watching Domino Bridge form
      { t: 6.5,  x: 4.5,   y: 2.18, z: LANE_Z }, // Waiting for Slime to hop onto bridge
      { t: 7.5,  x: 7.8,   y: 2.65, z: LANE_Z }, // Gliding smoothly ahead into Screen 3 (Macaron Zone)
      { t: 9.2,  x: 15.2,  y: 3.10, z: LANE_Z }, // High serene aerial cruise above all macarons
      { t: 11.0, x: 23.5,  y: 2.95, z: LANE_Z }, // Leading over the base of the Wooden Ruler Ramp
      { t: 11.9, x: 30.2,  y: 3.55, z: LANE_Z }, // Arriving at the Hollow Kaleidoscope Eyepiece rim (mouth at x=30.8, y=3.55)
      { t: 12.35, x: 30.35, y: 3.55, z: LANE_Z }, // Wiggles twice at the eyepiece rim & drops Thumbprint Token
      { t: 13.35, x: 32.55, y: 3.55, z: LANE_Z }, // Glides smoothly INSIDE the hollow Kaleidoscope tunnel to the mandala wheel!
      { t: 15.0, x: 32.65, y: 3.55, z: LANE_Z }
    ];

    function sampleIndependentStarFlight(t) {
      // Find segment in starFlightWaypoints
      let i = 0;
      while (i < starFlightWaypoints.length - 2 && t > starFlightWaypoints[i + 1].t) {
        i++;
      }
      const p0 = starFlightWaypoints[Math.max(0, i - 1)];
      const p1 = starFlightWaypoints[i];
      const p2 = starFlightWaypoints[i + 1];
      const p3 = starFlightWaypoints[Math.min(starFlightWaypoints.length - 1, i + 2)];

      const segDur = Math.max(0.001, p2.t - p1.t);
      const u = clamp((t - p1.t) / segDur, 0.0, 1.0);
      // Catmull-Rom spline interpolation for C1/C2 continuous velocity!
      const u2 = u * u;
      const u3 = u2 * u;

      function catmull(v0, v1, v2, v3) {
        return 0.5 * (
          (2.0 * v1) +
          (-v0 + v2) * u +
          (2.0 * v0 - 5.0 * v1 + 4.0 * v2 - v3) * u2 +
          (-v0 + 3.0 * v1 - 3.0 * v2 + v3) * u3
        );
      }

      let x = catmull(p0.x, p1.x, p2.x, p3.x);
      let y = catmull(p0.y, p1.y, p2.y, p3.y);
      let z = catmull(p0.z, p1.z, p2.z, p3.z);

      // Add gentle, independent aerodynamic figure-8 hover bobbing (attenuated when inside Kaleidoscope tunnel t > 12.4)
      const hoverAmp = t < 12.35 ? 1.0 : Math.max(0.0, 1.0 - (t - 12.35) / 0.5);
      y += Math.sin(t * 3.2) * 0.16 * hoverAmp;
      z += Math.cos(t * 2.4) * 0.12 * hoverAmp;

      // Minimum clearance guard so the flying Star NEVER clips any prop or terrain!
      const surf = sampleStaticOrBridgeSurface(x);
      let minClearanceY = surf.groundY + 1.05;
      // Extra clearance over upright dominoes (-6.8 .. -2.0) when t < 5.5
      if (x > -7.2 && x < -1.8 && t < 5.5) {
        minClearanceY = Math.max(minClearanceY, DOMINO_H + 0.65);
      }
      // Extra clearance over macarons
      macaronObjects.forEach(m => {
        if (Math.abs(x - m.spec.x) < m.spec.r * 1.25) {
          minClearanceY = Math.max(minClearanceY, m.baseTopHeight + 0.95);
        }
      });
      if (t < 12.35) {
        y = Math.max(y, minClearanceY);
      } else {
        // Inside the hollow Kaleidoscope tube (x > 30.5): lock strictly to the hollow tube centerline y = 3.55!
        y = lerp(y, 3.55, smoothstep(12.3, 12.6, t));
        z = lerp(z, LANE_Z, smoothstep(12.3, 12.6, t));
      }

      // Smooth scale fade ONLY after the Star reaches the glowing mandala wheel deep inside the Kaleidoscope (t: 12.8 -> 13.6s)
      let scale = 1.0;
      if (t > 12.6) {
        scale = Math.max(0.001, 1.0 - smoothstep(12.6, 13.55, t));
      }

      // Expressive double wiggle at t in [11.9, 12.4] right before gliding into the eyepiece
      let rollWiggle = 0.0;
      if (t >= 11.85 && t <= 12.45) {
        const wu = (t - 11.85) / 0.60;
        rollWiggle = Math.sin(wu * Math.PI * 4.0) * 0.55;
      }

      return { x, y, z, scale, rollWiggle };
    }

    const starDynamics = {
      x: 3.2,
      y: 2.15,
      z: LANE_Z,
      vx: 0,
      vy: 0,
      vz: 0,
      rotZ: 0,
      rotY: 0,
      scale: 1.0,
      updateFromStory(t, dt) {
        const target = sampleIndependentStarFlight(t);
        const dtSafe = Math.max(0.001, dt);
        this.vx = (target.x - this.x) / dtSafe;
        this.vy = (target.y - this.y) / dtSafe;
        this.x = target.x;
        this.y = target.y;
        this.z = target.z;
        this.scale = target.scale;

        // Smooth aerodynamic banking into horizontal velocity + continuous spin
        const bankPitch = clamp(-this.vx * 0.045, -0.45, 0.45);
        this.rotZ += (1.6 + Math.abs(this.vx) * 0.18) * dt + target.rollWiggle * 0.15;
        this.rotY = lerp(this.rotY, clamp(this.vx * 0.06, -0.5, 0.5), 1.0 - Math.exp(-10 * dt));

        guideStar.visible = this.scale > 0.01;
        guideStar.position.set(this.x, this.y, this.z);
        guideStar.scale.setScalar(this.scale);
        guideStar.rotation.set(bankPitch * 0.3, this.rotY, this.rotZ);

        // Emit star-dust particles along flight path
        dustSpawnTimer += dt;
        if (dustSpawnTimer > 0.045 && this.scale > 0.25) {
          dustSpawnTimer = 0;
          spawnStarDust(guideStar.position, 1.0);
        }
      },
      updateFromSandbox(slimeX, slimeFootY, timeSec, dt) {
        // In Sandbox Mode, the Star is an autonomous aerial companion cruising smoothly ahead of the Slime
        const targetX = clamp(slimeX + 2.6 + Math.sin(timeSec * 1.5) * 0.9, -20.0, 30.2);
        const surf = sampleStaticOrBridgeSurface(targetX);
        let minH = surf.groundY + 1.65;
        macaronObjects.forEach(m => {
          if (Math.abs(targetX - m.spec.x) < m.spec.r * 1.4) {
            minH = Math.max(minH, m.baseTopHeight + 1.25);
          }
        });
        const targetY = Math.max(minH, slimeFootY + 1.85) + Math.sin(timeSec * 2.8) * 0.28;
        const targetZ = LANE_Z + Math.cos(timeSec * 2.1) * 0.25;

        const follow = 1.0 - Math.exp(-4.5 * dt);
        const nextX = lerp(this.x, targetX, follow);
        const nextY = lerp(this.y, targetY, follow);
        const nextZ = lerp(this.z, targetZ, follow);

        this.vx = (nextX - this.x) / Math.max(0.001, dt);
        this.x = nextX;
        this.y = nextY;
        this.z = nextZ;
        this.rotZ += (1.8 + Math.abs(this.vx) * 0.15) * dt;
        this.rotY = lerp(this.rotY, clamp(this.vx * 0.05, -0.45, 0.45), follow);

        guideStar.visible = true;
        guideStar.scale.setScalar(1.0);
        guideStar.position.set(this.x, this.y, this.z);
        guideStar.rotation.set(0.1 * Math.sin(timeSec * 3.0), this.rotY, this.rotZ);

        dustSpawnTimer += dt;
        if (dustSpawnTimer > 0.055) {
          dustSpawnTimer = 0;
          spawnStarDust(guideStar.position, 0.8);
        }
      }
    };

    // =========================================================================
    // 8. SECOND-ORDER SPRING-DAMPER SOFT-BODY OSCILLATOR & ROLLING TRACKER
    // =========================================================================
    const slimeDynamics = {
      prevX: -3.8,
      prevY: 0.6,
      prevTime: 6.0,
      rollAngle: 0.0,
      squashY: 0.90,
      squashVel: 0.0,
      camX: 0.0,
      camY: 6.6,
      camZ: 21.5,
      stepSpring(targetSquash, dt) {
        const k = 210.0;
        const c = 19.5;
        const force = k * (targetSquash - this.squashY) - c * this.squashVel;
        this.squashVel += force * dt;
        this.squashY = clamp(this.squashY + this.squashVel * dt, 0.58, 1.36);
        return this.squashY;
      },
      injectImpulse(velDelta) {
        this.squashVel += velDelta;
      }
    };

