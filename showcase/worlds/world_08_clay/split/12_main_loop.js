    // =========================================================================
    // 14. MAIN ANIMATION LOOP & RESIZE HANDLER
    // =========================================================================
    function handleResize() {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      transCanvas.width = w;
      transCanvas.height = h;
    }

    window.addEventListener('resize', handleResize);
    handleResize();

    let lastFrameTime = performance.now();

    function animate(now) {
      requestAnimationFrame(animate);
      const dt = Math.min(0.04, Math.max(0.001, (now - lastFrameTime) / 1000));
      lastFrameTime = now;

      if (kaleidoscopeWheel) {
        kaleidoscopeWheel.rotation.x += dt * 1.4;
      }

      if (appMode === 'story' || appMode === 'keyframe') {
        if (isPlaying && appMode === 'story') {
          currentTime += dt * playbackSpeed;
          if (currentTime > 15.0) {
            currentTime = 0.0;
            audioSynth.triggeredBeats.clear();
          }
          timelineSlider.value = currentTime.toFixed(2);
        }

        const telemetry = evaluateStoryAtTime(currentTime, dt);

        const activeBeat = STORY_BEATS.find(b => currentTime >= b.t0 && currentTime <= b.t1) || STORY_BEATS[STORY_BEATS.length - 1];
        beatTimeBadge.textContent = `${currentTime.toFixed(1)}s / 15.0s`;
        screenIndicator.textContent = activeBeat.screen;
        beatNarrativeText.textContent = activeBeat.narrative;
        beatSfxText.textContent = activeBeat.sfx;

        const eyeLabels = {
          pill: 'I I (pill)',
          happy: '^ ^ (happy)',
          dizzy: '> < (dizzy)',
          charge: '= = (charge)',
          star: '✦ ✦ (star)'
        };
        hudEyeMode.textContent = eyeLabels[telemetry.eyeMode] || telemetry.eyeMode;
        hudSquash.textContent = telemetry.squash.toFixed(2);
      } else {
        updateSandboxPhysics(dt, now / 1000);
        hudSquash.textContent = slimeDynamics.squashY.toFixed(2);
      }

      updateStarDust(dt);
      renderer.render(scene, camera);
      renderTransitionsOverlay(currentTime);
    }

    window.onload = () => {
      handleResize();
      requestAnimationFrame(animate);
    };
