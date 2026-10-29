    // =========================================================================
    // 12. UI CONTROLS, RAYCASTING & EXTERNAL ASSET EXPORT
    // =========================================================================
    const modeStoryBtn = document.getElementById('mode-story-btn');
    const modeSandboxBtn = document.getElementById('mode-sandbox-btn');
    const modeKeyframeBtn = document.getElementById('mode-keyframe-btn');
    const sandboxCard = document.getElementById('sandbox-controls-card');
    const timelineSlider = document.getElementById('timeline-slider');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const beatTimeBadge = document.getElementById('beat-time-badge');
    const beatNarrativeText = document.getElementById('beat-narrative-text');
    const beatSfxText = document.getElementById('beat-sfx-text');
    const screenIndicator = document.getElementById('screen-indicator');
    const hudEyeMode = document.getElementById('hud-eye-mode');
    const hudSquash = document.getElementById('hud-squash');

    function setAppMode(newMode) {
      appMode = newMode;
      inspectTargetX = null;

      const activeClass = 'clay-pill-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-400 text-stone-900 shadow';
      const idleClass = 'clay-pill-btn px-3 py-1.5 rounded-xl text-xs font-bold text-amber-100/80 hover:bg-white/10';

      modeStoryBtn.className = newMode === 'story' ? activeClass : idleClass;
      modeSandboxBtn.className = newMode === 'sandbox' ? activeClass : idleClass;
      modeKeyframeBtn.className = newMode === 'keyframe' ? activeClass : idleClass;

      if (newMode === 'sandbox') {
        sandboxCard.classList.remove('hidden');
        isPlaying = false;
        playPauseBtn.textContent = '▶';
        sandboxState.x = slimeActor.root.position.x;
        const surf = sampleStaticOrBridgeSurface(sandboxState.x);
        sandboxState.footY = Math.max(surf.groundY, slimeActor.root.position.y - SLIME_FOOT_OFFSET);
        sandboxState.vx = 0.0;
        sandboxState.vy = 0.0;
      } else if (newMode === 'keyframe') {
        sandboxCard.classList.add('hidden');
        isPlaying = false;
        currentTime = 6.0;
        timelineSlider.value = '6.0';
        playPauseBtn.textContent = '▶';
      } else {
        sandboxCard.classList.add('hidden');
        isPlaying = true;
        playPauseBtn.textContent = '⏸';
      }
    }

    modeStoryBtn.addEventListener('click', () => setAppMode('story'));
    modeSandboxBtn.addEventListener('click', () => setAppMode('sandbox'));
    modeKeyframeBtn.addEventListener('click', () => setAppMode('keyframe'));

    const camPresets = [
      { id: 'side', label: '🎥 视角: 横版移轴' },
      { id: 'chase', label: '🎥 视角: 史莱姆跟拍' },
      { id: 'overview', label: '🎥 视角: 4屏全景' }
    ];
    let camPresetIdx = 0;
    document.getElementById('cam-view-btn').addEventListener('click', (e) => {
      inspectTargetX = null;
      camPresetIdx = (camPresetIdx + 1) % camPresets.length;
      camPreset = camPresets[camPresetIdx].id;
      e.currentTarget.textContent = camPresets[camPresetIdx].label;
    });

    playPauseBtn.addEventListener('click', () => {
      audioSynth.init();
      if (appMode !== 'story') setAppMode('story');
      else {
        isPlaying = !isPlaying;
        playPauseBtn.textContent = isPlaying ? '⏸' : '▶';
      }
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
      audioSynth.init();
      audioSynth.triggeredBeats.clear();
      currentTime = 0.0;
      timelineSlider.value = '0';
      setAppMode('story');
    });

    timelineSlider.addEventListener('input', (e) => {
      inspectTargetX = null;
      currentTime = parseFloat(e.target.value);
      if (appMode === 'sandbox') setAppMode('story');
      isPlaying = false;
      playPauseBtn.textContent = '▶';
    });

    const speeds = [1.0, 1.5, 0.5];
    let speedIdx = 0;
    document.getElementById('speed-btn').addEventListener('click', (e) => {
      speedIdx = (speedIdx + 1) % speeds.length;
      playbackSpeed = speeds[speedIdx];
      e.currentTarget.textContent = playbackSpeed.toFixed(1) + 'x';
    });

    const chapters = [
      { id: 'chap-1-btn', t: 0.9 },
      { id: 'chap-2-btn', t: 5.3 },
      { id: 'chap-3-btn', t: 8.1 },
      { id: 'chap-4-btn', t: 11.4 }
    ];
    chapters.forEach(ch => {
      document.getElementById(ch.id).addEventListener('click', () => {
        audioSynth.init();
        audioSynth.triggeredBeats.clear();
        inspectTargetX = null;
        currentTime = ch.t;
        timelineSlider.value = String(ch.t);
        setAppMode('story');
      });
    });

    document.getElementById('toggle-dof-btn').addEventListener('click', (e) => {
      dofEnabled = !dofEnabled;
      document.getElementById('tilt-top').style.opacity = dofEnabled ? '1' : '0';
      document.getElementById('tilt-bottom').style.opacity = dofEnabled ? '1' : '0';
      e.currentTarget.textContent = dofEnabled ? '移轴: 开' : '移轴: 关';
    });

    document.getElementById('toggle-audio-btn').addEventListener('click', (e) => {
      audioSynth.init();
      audioSynth.muted = !audioSynth.muted;
      e.currentTarget.textContent = audioSynth.muted ? '🔇 静音' : '🔊 音效';
    });

    document.getElementById('snap-png-btn').addEventListener('click', () => {
      renderer.render(scene, camera);
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `style_10_clay_threejs_${currentTime.toFixed(1)}s.png`;
      a.click();
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') sandboxState.keys.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') sandboxState.keys.right = true;
      if ((e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') && appMode === 'sandbox') {
        sandboxState.jumpBuffer = 0.15;
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') sandboxState.keys.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') sandboxState.keys.right = false;
    });

    const actLeftBtn = document.getElementById('act-left-btn');
    const actRightBtn = document.getElementById('act-right-btn');
    actLeftBtn.addEventListener('pointerdown', () => { sandboxState.keys.left = true; });
    actLeftBtn.addEventListener('pointerup', () => { sandboxState.keys.left = false; });
    actLeftBtn.addEventListener('pointerleave', () => { sandboxState.keys.left = false; });
    actRightBtn.addEventListener('pointerdown', () => { sandboxState.keys.right = true; });
    actRightBtn.addEventListener('pointerup', () => { sandboxState.keys.right = false; });
    actRightBtn.addEventListener('pointerleave', () => { sandboxState.keys.right = false; });

    document.getElementById('act-jump-btn').addEventListener('click', () => {
      audioSynth.init();
      sandboxState.vy = 9.8;
      sandboxState.onGround = false;
      slimeDynamics.injectImpulse(3.8);
      audioSynth.playMacaronBoing(1.1);
    });
    document.getElementById('act-domino-btn').addEventListener('click', () => {
      audioSynth.init();
      triggerSandboxDominoChain(0);
    });
    document.getElementById('act-eye-btn').addEventListener('click', () => {
      sandboxState.eyeIndex = (sandboxState.eyeIndex + 1) % sandboxState.eyeModes.length;
      const m = sandboxState.eyeModes[sandboxState.eyeIndex];
      slimeActor.setEyeMode(m);
      hudEyeMode.textContent = m;
    });
    document.getElementById('sandbox-reset-btn').addEventListener('click', () => {
      resetSandboxMechanisms();
    });

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    canvas.addEventListener('pointerdown', (e) => {
      audioSynth.init();
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, true);
      if (hits.length > 0) {
        const data = hits[0].object.userData;
        if (data.type === 'domino') {
          if (appMode !== 'sandbox') setAppMode('sandbox');
          triggerSandboxDominoChain(data.index);
        } else if (data.type === 'macaron') {
          const m = macaronObjects[data.index];
          if (m) {
            m.squashVel = -7.0;
            m.dentLevel = 1.0;
            m.dentRing.visible = true;
            audioSynth.playMacaronBoing(1.0 + data.index * 0.15);
          }
        }
      }
    });

    // =========================================================================
    // 13. 3D EXTERNAL ASSET INSPECTOR MODAL & OBJ / SCENE JSON EXPORTER
    // =========================================================================
    const assetsModal = document.getElementById('assets-modal');
    const assetCardsContainer = document.getElementById('asset-cards-container');
    const assetExportStatus = document.getElementById('asset-export-status');

    function meshGroupToOBJ(group, name) {
      let obj = `# StyleHop v5 World 10 Claymation 3D Asset: ${name}\n`;
      let vertexOffset = 1;
      group.updateMatrixWorld(true);
      group.traverse((child) => {
        if (child.isMesh && child.geometry) {
          const geo = child.geometry.clone();
          geo.applyMatrix4(child.matrixWorld);
          const pos = geo.attributes.position;
          if (!pos) return;
          obj += `o ${child.name || 'clay_part'}\n`;
          for (let i = 0; i < pos.count; i++) {
            obj += `v ${pos.getX(i).toFixed(4)} ${pos.getY(i).toFixed(4)} ${pos.getZ(i).toFixed(4)}\n`;
          }
          const idx = geo.index;
          if (idx) {
            for (let i = 0; i < idx.count; i += 3) {
              const a = idx.getX(i) + vertexOffset;
              const b = idx.getX(i + 1) + vertexOffset;
              const c = idx.getX(i + 2) + vertexOffset;
              obj += `f ${a} ${b} ${c}\n`;
            }
          }
          vertexOffset += pos.count;
        }
      });
      return obj;
    }

    function renderAssetCards() {
      assetCardsContainer.innerHTML = '';
      assetRegistry.forEach((asset) => {
        const card = document.createElement('div');
        card.className = 'rounded-2xl bg-white/5 border border-white/10 p-3.5 flex flex-col justify-between gap-2.5 hover:border-amber-300/40 transition';
        card.innerHTML = `
          <div>
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 text-[10px] font-bold">${asset.category}</span>
              <span class="font-mono text-[10px] text-white/50">id: ${asset.id}</span>
            </div>
            <h3 class="text-sm font-bold text-white">${asset.name}</h3>
            <p class="text-[11px] text-amber-100/75 mt-1 leading-relaxed">${asset.desc}</p>
          </div>
          <div class="flex items-center gap-1.5 pt-1">
            <button data-focus-x="${asset.screenX}" class="focus-asset-btn clay-pill-btn flex-1 py-1.5 rounded-lg bg-sky-500/25 hover:bg-sky-500/40 text-sky-200 font-semibold text-[11px]">
              🔍 镜头聚焦
            </button>
            <button data-export-id="${asset.id}" class="export-obj-btn clay-pill-btn flex-1 py-1.5 rounded-lg bg-amber-400/25 hover:bg-amber-400/40 text-amber-200 font-semibold text-[11px]">
              ⬇️ 导出 .OBJ
            </button>
          </div>
        `;
        assetCardsContainer.appendChild(card);
      });

      assetCardsContainer.querySelectorAll('.focus-asset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const xVal = parseFloat(e.currentTarget.getAttribute('data-focus-x'));
          inspectTargetX = xVal;
          isPlaying = false;
          playPauseBtn.textContent = '▶';
          assetsModal.classList.add('hidden');
          assetsModal.classList.remove('flex');
        });
      });

      assetCardsContainer.querySelectorAll('.export-obj-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-export-id');
          const found = assetRegistry.find(a => a.id === id);
          if (found) {
            const objText = meshGroupToOBJ(found.meshGroup, found.name);
            const blob = new Blob([objText], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `world10_${found.id}.obj`;
            a.click();
            URL.revokeObjectURL(url);
            assetExportStatus.textContent = `✅ 已成功导出 3D 网格资产：world10_${found.id}.obj`;
          }
        });
      });
    }

    renderAssetCards();

    document.getElementById('open-assets-btn').addEventListener('click', () => {
      assetsModal.classList.remove('hidden');
      assetsModal.classList.add('flex');
    });
    document.getElementById('close-assets-btn').addEventListener('click', () => {
      assetsModal.classList.add('hidden');
      assetsModal.classList.remove('flex');
    });
    document.getElementById('export-all-json-btn').addEventListener('click', () => {
      const json = JSON.stringify(worldGroup.toJSON());
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'world_10_clay_scene.json';
      a.click();
      URL.revokeObjectURL(url);
      assetExportStatus.textContent = '✅ 已导出完整 Three.js 场景 JSON (world_10_clay_scene.json)';
    });

