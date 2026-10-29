    // =========================================================================
    // 7. UI EVENT BINDINGS & ASSET EXPORT HANDLERS
    // =========================================================================
    const btnModeStage = document.getElementById('btn-mode-stage');
    const btnModeStudio = document.getElementById('btn-mode-studio');
    const leftPanel = document.getElementById('left-panel');
    const subtitleBanner = document.getElementById('subtitle-banner');

    btnModeStage.addEventListener('click', () => {
      workspaceMode = 'stage';
      stageRoot.visible = true;
      studioRoot.visible = false;
      leftPanel.classList.add('hidden');
      subtitleBanner.classList.remove('hidden');
      btnModeStage.className = 'px-3 py-1.5 rounded-xl text-xs transition-all active-tab flex items-center gap-1';
      btnModeStudio.className = 'px-3 py-1.5 rounded-xl text-xs text-amber-100/80 hover:text-amber-100 hover:bg-white/5 transition-all flex items-center gap-1';
      setCameraPreset('panorama');
    });

    btnModeStudio.addEventListener('click', () => {
      workspaceMode = 'studio';
      stageRoot.visible = false;
      studioRoot.visible = true;
      leftPanel.classList.remove('hidden');
      subtitleBanner.classList.add('hidden');
      btnModeStudio.className = 'px-3 py-1.5 rounded-xl text-xs transition-all active-tab flex items-center gap-1';
      btnModeStage.className = 'px-3 py-1.5 rounded-xl text-xs text-amber-100/80 hover:text-amber-100 hover:bg-white/5 transition-all flex items-center gap-1';
      camState.desiredTarget.set(0, 0.1, 0);
      camState.target.set(0, 0.1, 0);
      camState.desiredSpherical = { radius: 8.5, phi: 1.35, theta: 0.35 };
      camState.spherical = { radius: 8.5, phi: 1.35, theta: 0.35 };
    });

    document.getElementById('btn-cam-toggle').addEventListener('click', () => {
      const nextMode = (camState.mode === 'panorama' || camState.mode === 'keyframe') ? 'director' : 'panorama';
      setCameraPreset(nextMode);
      showToast(nextMode === 'panorama' ? '已切换至：🖼️ 全景立体书视角' : '已切换至：🎥 近景跟随运镜');
    });

    document.querySelectorAll('.cam-btn').forEach(btn => {
      btn.addEventListener('click', () => setCameraPreset(btn.dataset.cam));
    });

    document.getElementById('btn-reset-view').addEventListener('click', () => {
      if (workspaceMode === 'stage') setCameraPreset('panorama');
      else {
        camState.desiredTarget.set(0, 0.1, 0);
        camState.desiredSpherical = { radius: 8.5, phi: 1.35, theta: 0.35 };
      }
      showToast('已复位至全景立体书视角');
    });

    document.getElementById('slider-fold').addEventListener('input', (e) => {
      manualFoldOverride = parseFloat(e.target.value);
      evaluateStoryChoreography(storyTime);
    });

    document.querySelectorAll('.eye-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        manualEyeOverride = btn.dataset.eye;
        evaluateStoryChoreography(storyTime);
      });
    });

    document.getElementById('chk-creases').addEventListener('change', (e) => {
      const show = e.target.checked;
      scene.traverse(obj => { if (obj.name === 'paperCreaseLine') obj.visible = show; });
    });

    document.getElementById('btn-ignite-all').addEventListener('click', () => {
      igniteAllOverride = !igniteAllOverride;
      evaluateStoryChoreography(storyTime);
    });

    document.querySelectorAll('.beat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        storyTime = parseFloat(btn.dataset.time);
        manualFoldOverride = null;
        manualEyeOverride = null;
        document.getElementById('slider-timeline').value = storyTime;
        if (workspaceMode !== 'stage') btnModeStage.click();
        evaluateStoryChoreography(storyTime);
      });
    });

    const btnPlayPause = document.getElementById('btn-play-pause');
    const playIcon = document.getElementById('play-icon');
    const sliderTimeline = document.getElementById('slider-timeline');

    btnPlayPause.addEventListener('click', () => {
      isPlaying = !isPlaying;
      if (isPlaying && storyTime >= 29.95) storyTime = 0.0;
      playIcon.textContent = isPlaying ? '⏸' : '▶';
    });

    sliderTimeline.addEventListener('input', (e) => {
      storyTime = parseFloat(e.target.value);
      manualFoldOverride = null;
      manualEyeOverride = null;
      evaluateStoryChoreography(storyTime);
    });

    document.getElementById('select-speed').addEventListener('change', (e) => {
      playbackSpeed = parseFloat(e.target.value);
    });

    document.getElementById('btn-snap-keyframe').addEventListener('click', () => {
      storyTime = 11.4;
      sliderTimeline.value = 11.4;
      if (workspaceMode !== 'stage') btnModeStage.click();
      setCameraPreset('panorama');
      evaluateStoryChoreography(11.4);
      showToast('已跳转至有意识跳上千纸鹤关键帧 (t = 11.4s)');
    });

    document.getElementById('btn-audio-toggle').addEventListener('click', () => {
      const on = SoundEngine.toggle();
      document.getElementById('audio-icon').textContent = on ? '🔊' : '🔇';
      document.getElementById('audio-label').textContent = on ? '音效开启' : '开启音效';
      showToast(on ? '已开启八音盒、折纸立起与古筝音效' : '音效已静音');
    });

    document.querySelectorAll('.asset-card').forEach(card => {
      card.addEventListener('click', () => {
        activeStudioAssetKey = card.dataset.asset;
        Object.entries(studioAssets).forEach(([k, obj]) => { obj.visible = (k === activeStudioAssetKey); });
        document.querySelectorAll('.asset-card').forEach(c => c.classList.remove('asset-card-active'));
        card.classList.add('asset-card-active');
        SoundEngine.playPaperPopSnap(380);
      });
    });

    document.getElementById('slider-explode').addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      document.getElementById('val-explode').textContent = val.toFixed(2) + 'x';
      studioAssets.slime.userData.setPose(0.96, 0.02, 'pill', [0.36, -0.20], val);
      studioAssets.sun.userData.setExplode(val);
    });

    document.getElementById('chk-wireframe').addEventListener('change', (e) => {
      const wf = e.target.checked;
      studioRoot.traverse(obj => { if (obj.isMesh && obj.material) obj.material.wireframe = wf; });
    });

    function exportObjectToOBJ(rootObj, filename) {
      let objText = `# World 04 Paper-Cut Pop-up Book 3D Asset (${filename})\n`;
      let vertexOffset = 1;
      rootObj.updateMatrixWorld(true);
      rootObj.traverse(child => {
        if (!child.isMesh || !child.visible) return;
        const geo = child.geometry.clone();
        geo.applyMatrix4(child.matrixWorld);
        const pos = geo.attributes.position;
        if (!pos) return;
        objText += `o ${child.name || 'PaperPart'}\n`;
        for (let i = 0; i < pos.count; i++) {
          objText += `v ${pos.getX(i).toFixed(4)} ${pos.getY(i).toFixed(4)} ${pos.getZ(i).toFixed(4)}\n`;
        }
        const index = geo.index;
        if (index) {
          for (let i = 0; i < index.count; i += 3) {
            objText += `f ${index.getX(i) + vertexOffset} ${index.getX(i + 1) + vertexOffset} ${index.getX(i + 2) + vertexOffset}\n`;
          }
        } else {
          for (let i = 0; i < pos.count; i += 3) {
            objText += `f ${i + vertexOffset} ${i + 1 + vertexOffset} ${i + 2 + vertexOffset}\n`;
          }
        }
        vertexOffset += pos.count;
      });
      const blob = new Blob([objText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      showToast(`已导出 3D 网格模型：${filename}`);
    }

    document.getElementById('btn-export-obj').addEventListener('click', () => {
      const target = workspaceMode === 'studio' ? studioAssets[activeStudioAssetKey] : stageRoot;
      exportObjectToOBJ(target, `world_04_${workspaceMode === 'studio' ? activeStudioAssetKey : 'stage'}.obj`);
    });

    document.getElementById('btn-export-json').addEventListener('click', () => {
      const target = workspaceMode === 'studio' ? studioAssets[activeStudioAssetKey] : stageRoot;
      const blob = new Blob([JSON.stringify(target.toJSON())], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `world_04_${activeStudioAssetKey}.json`; a.click();
      URL.revokeObjectURL(url);
      showToast('已导出 Three.js 标准 JSON 资产文件');
    });

    document.getElementById('btn-snapshot-png').addEventListener('click', () => {
      renderer.render(scene, camera);
      const a = document.createElement('a');
      a.href = renderer.domElement.toDataURL('image/png');
      a.download = `world_04_paper_${storyTime.toFixed(1)}s.png`;
      a.click();
      showToast('已下载当前视角高清 PNG 快照');
    });

    const codeModal = document.getElementById('code-modal');
    const codeSnippetBox = document.getElementById('code-snippet-box');
    function getStandaloneModuleSource() {
      return `/**
 * World 04 · 纸雕立体书山谷 (world_04_paper) — Standalone Three.js External Assets Module
 */
const PaperTextures = (${PaperTextures.toString()})();
const World04PaperAssets = (${World04PaperAssets.toString()})();
window.World04PaperAssets = World04PaperAssets;
export default World04PaperAssets;`;
    }

    document.getElementById('btn-open-code-modal').addEventListener('click', () => {
      codeSnippetBox.textContent = getStandaloneModuleSource();
      codeModal.classList.remove('hidden');
      codeModal.classList.add('flex');
    });
    document.getElementById('btn-close-code-modal').addEventListener('click', () => {
      codeModal.classList.add('hidden');
      codeModal.classList.remove('flex');
    });
    document.getElementById('btn-copy-code').addEventListener('click', () => {
      const code = getStandaloneModuleSource();
      try {
        navigator.clipboard.writeText(code).then(() => showToast('已复制 World04PaperAssets 独立模块代码！'));
      } catch (err) {
        const ta = document.createElement('textarea'); ta.value = code; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        showToast('已复制 World04PaperAssets 独立模块代码！');
      }
    });
    document.getElementById('btn-download-js').addEventListener('click', () => {
      const blob = new Blob([getStandaloneModuleSource()], { type: 'application/javascript;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'world_04_paper_assets.js'; a.click();
      URL.revokeObjectURL(url);
      showToast('已下载 world_04_paper_assets.js 外部资产脚本');
    });

