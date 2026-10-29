    // =========================================================================
    // 10. UI Controls, Orbit Interaction & Python Pipeline Hooks
    // =========================================================================
    const timelineSlider = document.getElementById('timelineSlider');
    const timeReadout = document.getElementById('timeReadout');
    const hudTimeBadge = document.getElementById('hudTimeBadge');
    const hudModeBadge = document.getElementById('hudModeBadge');
    const beatTitleBadge = document.getElementById('beatTitleBadge');
    const sliderExtrude = document.getElementById('sliderExtrude');
    const valExtrude = document.getElementById('valExtrude');
    const sliderSplit = document.getElementById('sliderSplit');
    const valSplit = document.getElementById('valSplit');
    const sliderSquash = document.getElementById('sliderSquash');
    const valSquash = document.getElementById('valSquash');
    const valSx = document.getElementById('valSx');

    function showToast(msg) {
      const box = document.getElementById('toastBox');
      box.textContent = msg;
      box.classList.remove('hidden');
      clearTimeout(box._timer);
      box._timer = setTimeout(() => box.classList.add('hidden'), 2600);
    }

    function syncUIReadouts() {
      timelineSlider.value = state.t.toFixed(2);
      timeReadout.textContent = state.t.toFixed(2);
      hudTimeBadge.textContent = `T = ${state.t.toFixed(2).padStart(5, '0')}s / 34.0s`;
      hudModeBadge.textContent = `MODE: ${state.viewMode.toUpperCase()}`;
      beatTitleBadge.textContent = getStoryBeatDescription(state.t);

      sliderExtrude.value = state.extrude;
      valExtrude.textContent = Number(state.extrude).toFixed(2);
      sliderSplit.value = Math.round(state.splitRatio * 100);
      valSplit.textContent = `${Math.round(state.splitRatio * 100)}%`;
      sliderSquash.value = state.squashY;
      valSquash.textContent = Number(state.squashY).toFixed(2);
      const sx = 1.0 / Math.sqrt(state.squashY);
      valSx.textContent = `s_x=${sx.toFixed(3)}`;
    }

    function updatePlayButtonUI() {
      document.getElementById('playIcon').textContent = state.playing ? '⏸' : '▶';
    }

    document.querySelectorAll('.mode-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('tab-active'));
        btn.classList.add('tab-active');
        state.viewMode = btn.dataset.mode;
        if (state.viewMode === 'split') {
          state.playing = false;
          state.splitRatio = 0.53;
          state.extrude = 1.00;
          state.activeAsset = 'all';
        } else if (state.viewMode === 'story') {
          state.playing = true;
          if (state.t >= TOTAL_DURATION - 0.1) state.t = 0.0;
          sfx.playMarimbaPop(2);
        } else if (state.viewMode === 'sandbox') {
          state.playing = false;
          state.splitRatio = 0.42;
          state.extrude = 1.00;
          sfx.playMarimbaPop(4);
          showToast('沙盒模式：点击画布或按空格键触发跳跃与 2D→3D 弹簧拔起！');
        } else if (state.viewMode === 'inspector') {
          state.playing = false;
          if (state.activeAsset === 'all') state.activeAsset = 'island_hero';
        }
        updatePlayButtonUI();
        syncUIReadouts();
      });
    });

    document.querySelectorAll('.asset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.asset-btn').forEach(b => b.classList.remove('tab-active'));
        btn.classList.add('tab-active');
        state.activeAsset = btn.dataset.asset;
        if (state.activeAsset !== 'all') {
          state.viewMode = 'inspector';
          document.querySelectorAll('.mode-tab').forEach(b => {
            b.classList.toggle('tab-active', b.dataset.mode === 'inspector');
          });
          state.playing = false;
          updatePlayButtonUI();
        }
        document.getElementById('activeAssetTag').textContent = state.activeAsset.toUpperCase();
        state.camYaw = 0.0;
        sfx.playMarimbaPop(1);
        syncUIReadouts();
      });
    });

    document.querySelectorAll('.eye-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.eye-btn').forEach(b => b.classList.remove('tab-active'));
        btn.classList.add('tab-active');
        state.eyeMode = btn.dataset.eye;
        sfx.playMarimbaPop(3);
      });
    });

    document.querySelectorAll('.beat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.t = parseFloat(btn.dataset.seek);
        state.viewMode = 'story';
        document.querySelectorAll('.mode-tab').forEach(b => {
          b.classList.toggle('tab-active', b.dataset.mode === 'story');
        });
        updateSceneForTimeAndState(performance.now() * 0.001);
        sfx.playMarimbaPop(0);
        syncUIReadouts();
      });
    });

    const speeds = [1.0, 0.6, 1.5];
    let speedIdx = 0;
    document.getElementById('btnSpeedToggle').addEventListener('click', e => {
      speedIdx = (speedIdx + 1) % speeds.length;
      state.playbackRate = speeds[speedIdx];
      const lbl = state.playbackRate === 1.0 ? '1.0x 正常慢速' : (state.playbackRate < 1.0 ? '0.6x 超慢细看' : '1.5x 快速预览');
      e.currentTarget.textContent = lbl;
    });

    timelineSlider.addEventListener('input', e => {
      state.t = parseFloat(e.target.value);
      state.viewMode = 'story';
      updateSceneForTimeAndState(performance.now() * 0.001);
      syncUIReadouts();
    });
    sliderExtrude.addEventListener('input', e => {
      state.extrude = parseFloat(e.target.value);
      if (state.viewMode === 'story') state.viewMode = 'split';
      syncUIReadouts();
    });
    sliderSplit.addEventListener('input', e => {
      state.splitRatio = parseFloat(e.target.value) / 100.0;
      if (state.viewMode === 'story') state.viewMode = 'split';
      syncUIReadouts();
    });
    sliderSquash.addEventListener('input', e => {
      state.squashY = parseFloat(e.target.value);
      syncUIReadouts();
    });

    document.getElementById('chkTransparentBg').addEventListener('change', e => {
      state.transparentBg = e.target.checked;
    });
    document.getElementById('chkWireframeOverlay').addEventListener('change', e => {
      state.wireframeOverlay = e.target.checked;
    });
    document.getElementById('chkShowBlueprintHUD').addEventListener('change', e => {
      state.showBlueprintHUD = e.target.checked;
    });
    document.getElementById('chkAutoRotate').addEventListener('change', e => {
      state.autoRotate = e.target.checked;
    });

    document.getElementById('btnPlayPause').addEventListener('click', () => {
      state.playing = !state.playing;
      if (state.playing) {
        state.viewMode = 'story';
        document.querySelectorAll('.mode-tab').forEach(b => {
          b.classList.toggle('tab-active', b.dataset.mode === 'story');
        });
        if (state.t >= TOTAL_DURATION - 0.1) state.t = 0.0;
        sfx.playMarimbaPop(0);
      }
      updatePlayButtonUI();
      syncUIReadouts();
    });

    function triggerSlimeJumpAndSpring() {
      const nowSec = performance.now() * 0.001;
      state.jumpAnimStart = nowSec;
      state.springAnimStart = nowSec;
      sfx.playMarimbaPop(Math.floor(Math.random() * 6));
    }

    document.getElementById('btnTriggerJump').addEventListener('click', triggerSlimeJumpAndSpring);
    document.getElementById('btnSpringPop').addEventListener('click', triggerSlimeJumpAndSpring);

    document.getElementById('btnResetCamera').addEventListener('click', () => {
      state.camYaw = 0.0;
      state.camPitch = 0.34;
      state.camDist = 27.5;
      showToast('已重置三维等距相机视角');
    });

    document.getElementById('btnToggleAudio').addEventListener('click', () => {
      sfx.enabled = !sfx.enabled;
      document.getElementById('audioIcon').textContent = sfx.enabled ? '🔊' : '🔇';
      document.getElementById('audioLabel').textContent = sfx.enabled ? '音效 ON' : '音效 OFF';
      if (sfx.enabled) sfx.playMarimbaPop(2);
    });

    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let movedDist = 0;

    fgCanvas.addEventListener('pointerdown', e => {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      movedDist = 0;
    });
    window.addEventListener('pointermove', e => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      movedDist += Math.abs(dx) + Math.abs(dy);
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      state.camYaw -= dx * 0.006;
      state.camPitch = clamp(state.camPitch + dy * 0.005, -0.20, 1.10);
    });
    window.addEventListener('pointerup', () => {
      if (isDragging && movedDist < 6) {
        triggerSlimeJumpAndSpring();
      }
      isDragging = false;
    });
    fgCanvas.addEventListener('wheel', e => {
      e.preventDefault();
      state.camDist = clamp(state.camDist + e.deltaY * 0.015, 5.0, 48.0);
    }, { passive: false });

    window.addEventListener('keydown', e => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        triggerSlimeJumpAndSpring();
      }
    });

    // =========================================================================
    // 11. Export Composite PNG / Transparent 3D Layer & JSON Spec
    // =========================================================================
    window.exportCompositeDataURL = function(onlyThreeLayer = false) {
      updateSceneForTimeAndState(performance.now() * 0.001);
      if (onlyThreeLayer) {
        return threeCanvas.toDataURL('image/png');
      }
      return fgCanvas.toDataURL('image/png');
    };

    function downloadDataURL(dataUrl, filename) {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    document.getElementById('btnExportPng').addEventListener('click', () => {
      const url = window.exportCompositeDataURL(false);
      downloadDataURL(url, `world_05_blueprint_t${state.t.toFixed(1)}s.png`);
      showToast('已导出 1920×1080 合成画面 PNG');
    });

    document.getElementById('btnExportTransparentAsset').addEventListener('click', () => {
      const url = window.exportCompositeDataURL(true);
      downloadDataURL(url, `world_05_3d_asset_${state.activeAsset}_rgba.png`);
      showToast(`已导出纯 3D 透明图层 (${state.activeAsset}) PNG`);
    });

    document.getElementById('btnExportJsonSpec').addEventListener('click', () => {
      const spec = {
        world: 'world_05_blueprint',
        story_version: 'v4_34s_spherical_head_turn_star_throw_and_island_acting',
        duration_sec: TOTAL_DURATION,
        resolution: [W, H],
        t: Number(state.t.toFixed(3)),
        activeAsset: state.activeAsset,
        extrude: state.extrude,
        splitRatio: state.splitRatio,
        slime: {
          squash_y: state.squashY,
          s_x: Number((1.0 / Math.sqrt(state.squashY)).toFixed(4)),
          eye_tilt_deg: -30.0,
          far_eye_ratio: 0.81,
          eye_mode: state.eyeMode,
          palette: ['#4FB2FF', '#4285F4', '#945CE2', '#E85E76']
        }
      };
      const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      downloadDataURL(url, 'world_05_blueprint_spec.json');
      URL.revokeObjectURL(url);
      showToast('已导出 World 05 34.0s 资产配置 JSON');
    });

    const storyModal = document.getElementById('storyModal');
    document.getElementById('btnStoryDoc').addEventListener('click', () => {
      storyModal.classList.remove('hidden');
      storyModal.classList.add('flex');
    });
    function closeStoryModal() {
      storyModal.classList.add('hidden');
      storyModal.classList.remove('flex');
    }
    document.getElementById('btnCloseStoryModal').addEventListener('click', closeStoryModal);
    document.getElementById('btnCloseStoryModalBottom').addEventListener('click', closeStoryModal);
    document.getElementById('btnCopyStory').addEventListener('click', () => {
      const text = document.getElementById('storyMarkdownContent').textContent;
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('已复制 34.0s 精修版 STORY.md');
    });

    const apiModal = document.getElementById('apiModal');
    document.getElementById('btnApiHelp').addEventListener('click', () => {
      apiModal.classList.remove('hidden');
      apiModal.classList.add('flex');
    });
    function closeApiModal() {
      apiModal.classList.add('hidden');
      apiModal.classList.remove('flex');
    }
    document.getElementById('btnCloseModal').addEventListener('click', closeApiModal);
    document.getElementById('btnCloseModalBottom').addEventListener('click', closeApiModal);
    document.getElementById('btnCopyApi').addEventListener('click', () => {
      const text = document.getElementById('apiCodeSnippet').textContent;
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('已复制 Python / Playwright 调用代码');
    });

    window.render_frame_at_t = function(tSec, opts = {}) {
      state.playing = false;
      state.t = clamp(Number(tSec) || 0.0, 0.0, TOTAL_DURATION);
      if (opts.mode) state.viewMode = opts.mode;
      if (opts.asset) state.activeAsset = opts.asset;
      if (typeof opts.extrude === 'number') state.extrude = opts.extrude;
      if (typeof opts.squash_y === 'number') state.squashY = opts.squash_y;
      if (opts.eye_mode) state.eyeMode = opts.eye_mode;
      if (typeof opts.transparent === 'boolean') state.transparentBg = opts.transparent;
      updatePlayButtonUI();
      updateSceneForTimeAndState(state.t);
      syncUIReadouts();
      return true;
    };

    // =========================================================================
    // 12. Main Animation Loop
    // =========================================================================
    let lastFrameTime = performance.now();
    function animate(now) {
      const dt = Math.min(0.1, (now - lastFrameTime) * 0.001);
      lastFrameTime = now;

      if (state.playing) {
        state.t += dt * state.playbackRate;
        if (state.t > TOTAL_DURATION) {
          state.t = 0.0;
        }
        syncUIReadouts();
      }

      updateSceneForTimeAndState(now * 0.001);
      requestAnimationFrame(animate);
    }

    window.onload = function() {
      updatePlayButtonUI();
      updateSceneForTimeAndState(0);
      syncUIReadouts();
      requestAnimationFrame(animate);
    };
