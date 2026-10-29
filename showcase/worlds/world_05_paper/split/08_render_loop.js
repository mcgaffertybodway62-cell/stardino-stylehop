    // =========================================================================
    // 8. BUTTER-SMOOTH 60 FPS RENDER LOOP
    // =========================================================================
    setCameraPreset('panorama');
    evaluateStoryChoreography(storyTime);

    let lastFrameTime = performance.now();
    let frameCount = 0;
    let fpsTimer = performance.now();

    function animate(now) {
      requestAnimationFrame(animate);
      const dt = Math.min((now - lastFrameTime) / 1000, 0.08);
      lastFrameTime = now;

      frameCount++;
      if (now - fpsTimer > 500) {
        const fps = Math.min(60, Math.round((frameCount * 1000) / (now - fpsTimer)));
        document.getElementById('hud-fps').textContent = `${fps} FPS`;
        frameCount = 0;
        fpsTimer = now;
      }

      if (workspaceMode === 'stage') {
        if (isPlaying) {
          storyTime += dt * playbackSpeed;
          if (storyTime > 30.0) storyTime = 0.0;
          sliderTimeline.value = storyTime;
        }
        evaluateStoryChoreography(storyTime);
      } else {
        const tSec = now * 0.001;
        if (document.getElementById('chk-turntable').checked && !camState.isDragging) {
          turntable.rotation.y += dt * 0.65;
        }
        if (activeStudioAssetKey === 'crane_lead') {
          studioAssets.crane_lead.userData.cranes.forEach((c, idx) => {
            c.userData.setWingFlap(Math.sin(tSec * 2.5 + idx * 0.8) * 0.35);
          });
        } else if (activeStudioAssetKey === 'lantern') {
          studioAssets.lantern.userData.setLitState(1.0, Math.sin(tSec * 2.2) * 0.08);
        } else if (activeStudioAssetKey === 'zoetrope') {
          studioAssets.zoetrope.userData.update(tSec, 0.0);
        }
      }

      const damp = clamp(dt * 4.5, 0.04, 0.30);
      camState.target.lerp(camState.desiredTarget, damp);
      camState.spherical.radius = lerp(camState.spherical.radius, camState.desiredSpherical.radius, damp);
      camState.spherical.phi = lerp(camState.spherical.phi, camState.desiredSpherical.phi, damp);
      camState.spherical.theta = lerp(camState.spherical.theta, camState.desiredSpherical.theta, damp);

      const r = camState.spherical.radius;
      const phi = camState.spherical.phi;
      const theta = camState.spherical.theta;
      camera.position.x = camState.target.x + r * Math.sin(phi) * Math.sin(theta);
      camera.position.y = camState.target.y + r * Math.cos(phi);
      camera.position.z = camState.target.z + r * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(camState.target);

      renderer.render(scene, camera);
    }

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.onload = () => {
      requestAnimationFrame(animate);
    };
