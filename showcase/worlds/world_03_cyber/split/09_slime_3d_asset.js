// ============================================================================
// Module: 09_slime_3d_asset.js
// 「星芒史莱姆 · STAR-SPARK SLIME」Three.js (r128) 高精度 3D 角色资产模块
//
// 严格遵循 character_design_sheet_v2.png 与 WORLD_DEV_GUIDE.md 全部 5 条铁律：
// 1. 饱满偏圆 Q 弹果冻球体 + 底部柔和微压接触面 + 严格体积守恒形变 (sx = sz = 1 / sqrt(sy))
// 2. 严格无嘴 (MOUTHLESS)、无鼻、无腮红
// 3. 3D 球面法线贴合纯白眼（仅绑定于正前方 +Z 半球面，背后 180° 观看绝对无眼；支持：
//    - 'curious' : -30.2° 经典右上仰望圆角胶囊眼，远端眼严格 81% 透视收窄
//    - 'blade'   : 坚毅果决纯白刀锋眼（与 2D 横切特写完全呼应）
//    - 'asym'    : 四处张望一高一低灵动胶囊眼
//    - 'flat'    : 蓄力压扁 = = 专注横线眼
//    - 'rocket'  : 冲天拉伸正上方聚焦胶囊眼
//    - 'happy'   : 落地回弹 ^ ^ 开心弯月弧线眼
//    - 'spark'   : 惊叹闪烁 ✦ ✦ 四角星芒眼）
// 4. 3D 立体四角内凹伴星 ✦ (Gemini 经典蓝 -> 星云紫 -> 珊瑚粉流体渐变 + 磁悬浮弹簧跟随)
// 5. 材质支持 v16 场景的 'neon' (UnrealBloom 辉光果冻态)、'cyberwire' (全息线框态)、'clay' (白模态)
// ============================================================================

(function (global) {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. 顶点着色器：负责果冻球体基础微压接触面、体积守恒拉伸压扁与果冻Q弹波动
  // --------------------------------------------------------------------------
  const SLIME_BODY_VS = `
    uniform float uSquashY;      // 垂直缩放 sy (体积守恒 sx = sz = 1 / sqrt(sy))
    uniform float uBottomFlat;   // 底部接触微压程度 (0..1, 常态 0.35, 悬空 0.0, 落地 0.65)
    uniform float uJellyWave;    // Q弹次级正弦波动幅度
    uniform float uTime;         // 动画时间
    uniform float uOutlinePush;  // 描边壳外扩厚度 (>0 时用于 BackSide 描边壳)

    varying vec3 vLocalPos;      // 原始单位球体局部坐标 (绑定眼睛与局部纹理，绝不随屏幕漂移)
    varying vec3 vDeformedLocal; // 形变后的局部坐标
    varying vec3 vWorldNormal;   // 世界空间法线
    varying vec3 vViewDir;       // 指向相机的视线向量 (世界空间)
    varying vec3 vWorldPos;      // 世界坐标

    vec3 deformSlimePos(vec3 p) {
      // 1) 基础饱满偏圆比例 (水平略宽 1.06, 垂直略扁 0.94，契合设定图「饱满偏圆流体球体」)
      vec3 q = vec3(p.x * 1.06, p.y * 0.94, p.z * 1.06);

      // 2) 底部柔和微压接触面 + 下脸颊微鼓 (果冻坐落感)
      if (uBottomFlat > 0.001) {
        float flatZone = smoothstep(-0.45, -0.94, q.y);
        q.y = mix(q.y, -0.82, flatZone * uBottomFlat * 0.65);
        float cheekBulge = exp(-pow((q.y + 0.30) * 2.5, 2.0)) * uBottomFlat * 0.06;
        q.xz *= (1.0 + cheekBulge);
      }

      // 3) 严格体积守恒形变：sx = sz = 1.0 / sqrt(sy)
      float sy = clamp(uSquashY, 0.52, 1.55);
      float sxz = 1.0 / sqrt(sy);
      q.x *= sxz;
      q.y *= sy;
      q.z *= sxz;

      // 4) Q弹果冻高频次级余振波
      if (abs(uJellyWave) > 0.0005) {
        float wave = sin(p.y * 5.5 + uTime * 14.0) * uJellyWave;
        q.xz *= (1.0 + wave);
        q.y  *= (1.0 - wave * 0.5);
      }

      return q;
    }

    void main() {
      vLocalPos = normalize(position);

      vec3 p0 = deformSlimePos(vLocalPos);
      float eps = 0.015;
      vec3 tangent = normalize(abs(vLocalPos.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : cross(vec3(0.0, 1.0, 0.0), vLocalPos));
      vec3 bitangent = normalize(cross(vLocalPos, tangent));
      vec3 p1 = deformSlimePos(normalize(vLocalPos + tangent * eps));
      vec3 p2 = deformSlimePos(normalize(vLocalPos + bitangent * eps));
      vec3 localNormal = normalize(cross(p1 - p0, p2 - p0));

      vec3 finalLocal = p0 + localNormal * uOutlinePush;
      vDeformedLocal = finalLocal;

      vec4 worldPos4 = modelMatrix * vec4(finalLocal, 1.0);
      vWorldPos = worldPos4.xyz;
      vWorldNormal = normalize(mat3(modelMatrix) * localNormal);
      vViewDir = normalize(cameraPosition - vWorldPos);

      gl_Position = projectionMatrix * viewMatrix * worldPos4;
    }
  `;

  // --------------------------------------------------------------------------
  // 2. 片元着色器：Gemini 三色流体果冻材质 + 内部双子星核 + 3D 球面纯白眼 SDF
  // --------------------------------------------------------------------------
  const SLIME_BODY_FS = `
    uniform int   uEyeMode;       // 0:curious(-30°胶囊), 1:blade(刀锋坚毅), 2:asym(四处张望), 3:flat(==蓄力), 4:rocket(冲天), 5:happy(^^笑眼), 6:spark(✦星瞳)
    uniform vec2  uEyeLook;       // 视线在球面上的偏移 (默认向右上凝视 (+X, +Y))
    uniform float uEyeCantDeg;    // 双眼整体倾角 (默认 -30.2°)
    uniform float uFarEyeScale;   // 远端眼透视收窄比例 (默认 0.81 = 81%)
    uniform float uBlink;         // 眨眼闭合度 (0:睁开 .. 1:闭眼)
    uniform int   uRenderStyle;   // 0:neon (默认果冻辉光态), 1:cyberwire, 2:clay (白模态)
    uniform float uTwinCoreGlow;  // 内部双子星核亮度 (0..1)
    uniform float uHalftoneStr;   // 局部坐标漫画半调网点强度 (0..1)
    uniform float uIsOutline;     // 1.0 表示当前渲染的是外层描边壳
    uniform vec3  uOutlineColor;  // 描边壳颜色
    uniform float uOpacity;       // 整体透明度 (1.0 为主角实体，<1.0 为全息消融残影)

    varying vec3 vLocalPos;
    varying vec3 vDeformedLocal;
    varying vec3 vWorldNormal;
    varying vec3 vViewDir;
    varying vec3 vWorldPos;

    vec2 rot2D(vec2 p, float rad) {
      float c = cos(rad);
      float s = sin(rad);
      return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    }

    // 圆角胶囊 SDF
    float sdCapsule2D(vec2 p, float halfW, float halfH) {
      float lineH = max(halfH - halfW, 0.001);
      vec2 q = abs(p) - vec2(0.0, lineH);
      return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - halfW;
    }

    // 四角内凹星芒 ✦ 2D SDF（超椭圆内凹曲线，内部 < 0，外部 > 0）
    float sdConcaveStar2D(vec2 p, float rOuter, float rInner) {
      vec2 q = abs(p);
      if (q.y > q.x) q = q.yx;
      vec2 a = vec2(rOuter, 0.0);
      vec2 b = vec2(rInner, rInner);
      vec2 ba = b - a;
      vec2 pa = q - a;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      float d = length(pa - ba * h);
      float crossVal = ba.x * pa.y - ba.y * pa.x;
      return (crossVal > 0.0) ? -d : d;
    }

    // 刀锋眼 (Blade Eye) 2D SDF —— 大尺寸凌厉纯白刀锋眼，与第 3 步 2D 漫画特写同源
    // sideSign: -1.0 为左眼，+1.0 为右眼
    float sdBladeEye2D(vec2 p, float sideSign, float scaleW) {
      // 镜像到「内眼角在 +X，外刀尖在 -X」的局部空间
      vec2 q = vec2(-p.x * sideSign / max(scaleW, 0.5), p.y);
      // 上眼睑刀锋压线：从外侧高位刀尖 (-0.215, +0.095) 刚毅下压至内眼角 (+0.135, -0.036)
      float tX = clamp((q.x + 0.215) / 0.35, 0.0, 1.0);
      float topY = mix(0.095, -0.036, tX);
      // 下眼睑饱满刀肚弧线：最低点 -0.118，向两侧锐利上挑收口
      float normX = (q.x + 0.032) / 0.178;
      float botY = -0.118 + 0.178 * pow(abs(normX), 1.68);
      float dx = max(-0.215 - q.x, q.x - 0.135);
      float dy = max(q.y - topY, botY - q.y);
      return max(dx, dy);
    }

    // 开心弯月笑眼 ^ ^ 2D SDF
    float sdHappyArc2D(vec2 p, float radius, float thickness) {
      vec2 q = p - vec2(0.0, -radius * 0.35);
      float dRing = abs(length(q) - radius) - thickness;
      return max(dRing, -q.y - thickness * 0.25);
    }

    void main() {
      if (uIsOutline > 0.5) {
        gl_FragColor = vec4(uOutlineColor, uOpacity);
        return;
      }

      vec3 N = normalize(vWorldNormal);
      vec3 V = normalize(vViewDir);
      vec3 lp = normalize(vLocalPos);

      // 全息线框残影态 (uRenderStyle == 1): 菲涅尔边缘霓虹流光 + 横向全息扫描纹，中心完全通透不挡视线
      if (uRenderStyle == 1) {
        float ndvGhost = max(dot(N, V), 0.0);
        float rimGhost = pow(1.0 - ndvGhost, 2.2);
        float scanLine = 0.55 + 0.45 * sin(lp.y * 42.0);
        vec3 holoCol = mix(vec3(0.0, 0.95, 1.0), vec3(0.75, 0.25, 1.0), clamp(lp.y * 0.5 + 0.5, 0.0, 1.0));
        float alphaGhost = clamp((rimGhost * 0.85 + 0.15) * scanLine * uOpacity, 0.0, 0.85);
        gl_FragColor = vec4(holoCol * (1.25 + rimGhost * 0.8), alphaGhost);
        return;
      }

      // ----------------------------------------------------------------------
      // A. 基础果冻流体三色渐变（绑定在局部坐标 lp 上，随球体旋转）
      //    左上: 天际蓝 #4285F4 / #4FADFF
      //    中间: 双子鸢尾紫 #7559E8 / #9B72CB
      //    右下: 晨曦珊瑚粉 #D96570
      // ----------------------------------------------------------------------
      vec3 colClassicBlue = vec3(0.259, 0.522, 0.957); // #4285F4
      vec3 colSkyCyan     = vec3(0.310, 0.678, 1.000); // #4FADFF
      vec3 colIrisPurple  = vec3(0.459, 0.349, 0.910); // #7559E8
      vec3 colOrchidPurp  = vec3(0.608, 0.447, 0.796); // #9B72CB
      vec3 colDawnCoral   = vec3(0.851, 0.396, 0.439); // #D96570

      vec3 gradAxis = normalize(vec3(0.55, -0.70, -0.20));
      float tGrad = clamp(dot(lp, gradAxis) * 0.56 + 0.50, 0.0, 1.0);
      tGrad += 0.04 * sin(lp.x * 4.0 + lp.z * 3.5);
      tGrad = clamp(tGrad, 0.0, 1.0);

      vec3 baseColor;
      if (tGrad < 0.42) {
        float k = smoothstep(0.0, 0.42, tGrad);
        vec3 topBlue = mix(colSkyCyan, colClassicBlue, 0.42);
        baseColor = mix(topBlue, colIrisPurple, k);
      } else if (tGrad < 0.76) {
        float k = smoothstep(0.42, 0.76, tGrad);
        baseColor = mix(colIrisPurple, colOrchidPurp, k);
      } else {
        float k = smoothstep(0.76, 1.0, tGrad);
        baseColor = mix(colOrchidPurp, colDawnCoral, k);
      }

      if (uRenderStyle == 2) {
        baseColor = mix(vec3(0.92, 0.95, 0.99), vec3(0.72, 0.79, 0.88), tGrad);
      }

      // ----------------------------------------------------------------------
      // B. 3D 球体积光影、次表面果冻透射 (SSS)、双子星核与清漆高光
      // ----------------------------------------------------------------------
      vec3 lightDir = normalize(vec3(-0.48, 0.74, 0.46));
      float ndl = dot(N, lightDir);
      float ndv = max(dot(N, V), 0.0);

      float shadowBand = smoothstep(-0.38, -0.05, ndl);
      float midBand    = smoothstep(-0.02, 0.35, ndl);
      float shadeMul   = mix(0.68, mix(0.94, 1.10, midBand), shadowBand);
      vec3 color = baseColor * shadeMul;

      float bottomAO = smoothstep(-0.92, -0.45, lp.y);
      color *= mix(0.76, 1.0, bottomAO);
      float groundBounce = smoothstep(-0.40, -0.90, lp.y);
      color += vec3(0.10, 0.28, 0.52) * groundBounce * 0.22;

      // 内部双子星核 (Twin Star Core, 见设定图 08 · 双子星旋)
      if (uTwinCoreGlow > 0.01 && uRenderStyle != 2) {
        vec2 coreUV = lp.xy - vec2(-0.10, -0.22);
        float dBlueCore = length(coreUV - vec2(-0.09, 0.04));
        float dGoldCore = length(coreUV - vec2( 0.09, -0.03));
        float centerMask = smoothstep(0.25, 0.85, lp.z) * pow(ndv, 1.1);
        vec3 innerGlow = vec3(0.18, 0.62, 0.95) * exp(-dBlueCore * 14.0) * 0.42
                       + vec3(0.95, 0.68, 0.18) * exp(-dGoldCore * 15.0) * 0.38;
        color += innerGlow * centerMask * min(uTwinCoreGlow, 0.85);
      }

      // 防止正面受光时身体亮度超过 UnrealBloom 阈值而吞没纯白眼睛
      color = min(color, vec3(0.76, 0.74, 0.86));

      // 左上角标志性果冻月牙清漆高光 (Crescent Jelly Specular)
      vec3 H = normalize(lightDir + V);
      float spec3D = pow(max(dot(N, H), 0.0), 48.0);
      float specCrescent = smoothstep(0.78, 0.86, dot(lp, normalize(vec3(-0.52, 0.64, 0.56))))
                         * (1.0 - smoothstep(0.89, 0.96, dot(lp, normalize(vec3(-0.44, 0.56, 0.70)))));
      float specDot = smoothstep(0.965, 0.985, dot(lp, normalize(vec3(-0.32, 0.74, 0.58))));
      color = mix(color, vec3(0.82, 0.90, 0.98), clamp(specCrescent * 0.38 + spec3D * 0.22, 0.0, 0.48));
      color = mix(color, vec3(0.96, 0.98, 1.0), specDot * 0.65);

      // 3D 菲涅尔边缘光
      float fresnel = pow(1.0 - ndv, 3.0);
      vec3 rimCol = mix(vec3(0.31, 0.68, 1.0), vec3(0.68, 0.42, 1.0), clamp(lp.x * 0.5 + 0.5, 0.0, 1.0));
      color += rimCol * fresnel * (uRenderStyle == 2 ? 0.18 : 0.42);

      // 局部坐标漫画半调网点
      if (uHalftoneStr > 0.01) {
        float bandMask = smoothstep(-0.42, -0.05, ndl) * (1.0 - smoothstep(0.15, 0.48, ndl));
        vec2 htGrid = fract(lp.xy * 11.5);
        float htDist = length(htGrid - vec2(0.5));
        float htDot = 1.0 - smoothstep(0.24, 0.31, htDist);
        color = mix(color, color * 0.76 + vec3(0.06, 0.12, 0.28), htDot * bandMask * uHalftoneStr * 0.42);
      }

      // ----------------------------------------------------------------------
      // C. 3D 球面纯白眼睛系统（严格绑定于正前方 +Z 半球面 lp.z > 0.18！）
      //    注意 OpenGL Y 轴朝上：当 uEyeCantDeg = -30.2° 时，用 +cantRad 旋转可将胶囊上端向左倾 (\)，
      //    使双眼连线朝右上方 (+X, +Y) 仰望，与 character_design_sheet_v2.png 100% 一致！
      // ----------------------------------------------------------------------
      if (lp.z > 0.18) {
        float lx = clamp(uEyeLook.x, -1.0, 1.0);
        float ly = clamp(uEyeLook.y, -1.0, 1.0);

        // 动态 3D 球面透视眼眸规律（消除固定大小眼限制）
        float wL = clamp(1.0 + 0.24 * lx - 0.06 * lx * lx, 0.74, 1.08);
        float wR = clamp(1.0 - 0.24 * lx - 0.06 * lx * lx, 0.74, 1.08);
        float pitchCos = clamp(cos(ly * 0.48), 0.80, 1.0);
        float hL = clamp(1.0 + 0.10 * lx, 0.88, 1.04) * pitchCos;
        float hR = clamp(1.0 - 0.10 * lx, 0.88, 1.04) * pitchCos;
        float cant = lx * (-0.28 - 0.38 * ly);

        // 视线在球面上的位移 (基准高度 y0 = 0.10，水平左右位移，垂直俯仰位移)
        vec2 eyeCenter = vec2(lx * 0.16, 0.10 + ly * 0.18);
        vec2 pEye = lp.xy - eyeCenter;

        vec2 qRot = rot2D(pEye, cant);

        float dLeft = 10.0;
        float dRight = 10.0;

        if (uEyeMode == 0 || uEyeMode == 2) {
          // Mode 0: 经典胶囊眼; Mode 2: asym 张望
          float baseW = 0.054;
          float baseH = 0.128 * (1.0 - uBlink * 0.85);
          float nearW = baseW * wL;
          float farW  = baseW * wR;
          float nearH = baseH * hL;
          float farH  = (uEyeMode == 2 ? 0.088 : baseH) * hR;
          float farYOffset = (uEyeMode == 2) ? -0.028 : 0.0;

          vec2 pL = qRot - vec2(-0.098, 0.0);
          vec2 pR = qRot - vec2( 0.095, farYOffset);
          dLeft  = sdCapsule2D(pL, nearW, nearH);
          dRight = sdCapsule2D(pR, farW,  farH);

        } else if (uEyeMode == 1) {
          // Mode 1: 刀锋坚毅眼 (Pure-White Blade Eyes)
          vec2 pL = qRot - vec2(-0.155, 0.0);
          vec2 pR = qRot - vec2( 0.155, 0.0);
          dLeft  = sdBladeEye2D(pL, -1.0, wL);
          dRight = sdBladeEye2D(pR,  1.0, wR);

        } else if (uEyeMode == 3) {
          // Mode 3: 03 · 眨眼/蓄力压扁 (— — 清晰水平闭眼弧线)
          vec2 pL = qRot - vec2(-0.120, 0.0);
          vec2 pR = qRot - vec2( 0.120, 0.0);
          dLeft  = sdCapsule2D(pL.yx, 0.022 * pitchCos, 0.092 * wL);
          dRight = sdCapsule2D(pR.yx, 0.022 * pitchCos, 0.092 * wR);

        } else if (uEyeMode == 4) {
          // Mode 4: 04 · 冲天拉伸 (正上方聚焦双胶囊眼)
          vec2 pL = qRot - vec2(-0.088, 0.0);
          vec2 pR = qRot - vec2( 0.088, 0.0);
          dLeft  = sdCapsule2D(pL, 0.048 * wL, 0.118 * hL);
          dRight = sdCapsule2D(pR, 0.048 * wR, 0.118 * hR);

        } else if (uEyeMode == 5) {
          // Mode 5: 05 · 落地回弹 (^ ^ 开心弯月笑眼)
          vec2 pL = qRot - vec2(-0.110, 0.0);
          vec2 pR = qRot - vec2( 0.110, 0.0);
          dLeft  = sdHappyArc2D(pL, 0.075 * wL, 0.024);
          dRight = sdHappyArc2D(pR, 0.075 * wR, 0.024);

        } else if (uEyeMode == 6) {
          // Mode 6: 06 · 惊叹闪烁 (✦ ✦ 四角凹弧星芒瞳，尺寸加粗放大，璀璨醒目)
          vec2 pL = rot2D(qRot - vec2(-0.135, 0.02), radians(10.0));
          vec2 pR = rot2D(qRot - vec2( 0.135, 0.04), radians(-10.0));
          dLeft  = sdConcaveStar2D(pL, 0.19 * wL * pitchCos, 0.060 * wL);
          dRight = sdConcaveStar2D(pR, 0.19 * wR * pitchCos, 0.060 * wR);
        }

        float dEye = min(dLeft, dRight);
        float frontFade = smoothstep(0.18, 0.30, lp.z);

        // 1) 眼周深蓝紫高反差描边包边（确保在任何辉光环境下纯白双眼都100%锐利清晰！）
        float socketMask = (1.0 - smoothstep(0.0, 0.024, dEye)) * frontFade;
        color = mix(color, vec3(0.05, 0.07, 0.22), socketMask * 0.85);

        // 2) 100% 纯白眼眸填充 (#FFFFFF)
        float aa = 0.0045;
        float eyeMask = (1.0 - smoothstep(-aa, aa, dEye)) * frontFade;
        vec3 pureWhiteEye = (uRenderStyle == 2) ? vec3(1.0, 1.0, 1.0) : vec3(1.02, 1.04, 1.08);
        color = mix(color, pureWhiteEye, eyeMask);
      }

      gl_FragColor = vec4(color, uOpacity);
    }
  `;

  // --------------------------------------------------------------------------
  // 3. 构建真正的 3D 立体四角内凹伴星 ✦ (极坐标深凹弧四角星体)
  // --------------------------------------------------------------------------
  function create3DConcaveStarGeometry(rOuter, rInner, halfThickness, verticalStretch) {
    const oR = rOuter || 0.38;
    const cR = (rInner !== undefined ? rInner : oR * 0.05) * 0.35; // 贝塞尔控制点深贴中心，确保尖端如针锋、四腰深内凹
    const hZ = halfThickness || 0.075;
    const vStretch = verticalStretch || 1.24;
    const segsPerQuad = 14;
    const totalPts = 4 * segsPerQuad;
    const ringPts = [];

    // 逆时针排列四个尖端 (+X -> +Y -> -X -> -Y)，确保正面法线朝 +Z
    const tips = [
      { x:  oR, y: 0 },
      { x: 0,   y:  oR * vStretch },
      { x: -oR, y: 0 },
      { x: 0,   y: -oR * vStretch }
    ];
    const waists = [
      { x:  cR, y:  cR * vStretch },
      { x: -cR, y:  cR * vStretch },
      { x: -cR, y: -cR * vStretch },
      { x:  cR, y: -cR * vStretch }
    ];

    for (let q = 0; q < 4; q++) {
      const p0 = tips[q];
      const pc = waists[q];
      const p1 = tips[(q + 1) % 4];
      for (let s = 0; s < segsPerQuad; s++) {
        const t = s / segsPerQuad;
        const omt = 1.0 - t;
        const x = omt * omt * p0.x + 2.0 * omt * t * pc.x + t * t * p1.x;
        const y = omt * omt * p0.y + 2.0 * omt * t * pc.y + t * t * p1.y;
        ringPts.push({ x, y });
      }
    }

    const positions = [];
    const normals = [];
    const uvs = [];

    function pushTri(ax, ay, az, bx, by, bz, cx, cy, cz) {
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1.0;
      nx /= len; ny /= len; nz /= len;

      positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
      uvs.push(
        ax / oR * 0.5 + 0.5, ay / (oR * vStretch) * 0.5 + 0.5,
        bx / oR * 0.5 + 0.5, by / (oR * vStretch) * 0.5 + 0.5,
        cx / oR * 0.5 + 0.5, cy / (oR * vStretch) * 0.5 + 0.5
      );
    }

    for (let i = 0; i < totalPts; i++) {
      const cur = ringPts[i];
      const nxt = ringPts[(i + 1) % totalPts];
      pushTri(0, 0, hZ, cur.x, cur.y, 0, nxt.x, nxt.y, 0);
      pushTri(0, 0, -hZ, nxt.x, nxt.y, 0, cur.x, cur.y, 0);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    return geo;
  }

  const STAR_VS = `
    varying vec3 vLocal;
    varying vec3 vNormal;
    void main() {
      vLocal = position;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const STAR_FS = `
    uniform float uGlowBoost;
    varying vec3 vLocal;
    varying vec3 vNormal;
    void main() {
      vec3 colBlue  = vec3(0.310, 0.678, 1.000); // #4FADFF
      vec3 colPurp  = vec3(0.608, 0.447, 0.796); // #9B72CB
      vec3 colCoral = vec3(0.920, 0.420, 0.480); // #EB6B7A
      float t = clamp((vLocal.x - vLocal.y * 0.75) * 1.6 + 0.5, 0.0, 1.0);
      vec3 grad = (t < 0.5) ? mix(colBlue, colPurp, t * 2.0) : mix(colPurp, colCoral, (t - 0.5) * 2.0);
      float centerHot = exp(-length(vLocal.xy) * 7.5);
      vec3 finalCol = mix(grad, vec3(1.0, 1.0, 1.0), centerHot * 0.72) * (1.18 + uGlowBoost * 0.35);
      gl_FragColor = vec4(finalCol, 1.0);
    }
  `;

  // --------------------------------------------------------------------------
  // 4. 创建完整的 3D 史莱姆角色绑定资产 (Slime3DRig)
  // --------------------------------------------------------------------------
  function createSlime3DRig(options) {
    const opts = Object.assign({
      radius: 1.0,
      outlineThickness: 0.032,
      withCompanionStar: true,
      withGroundRipples: true
    }, options || {});

    const root = new THREE.Group();
    root.name = 'Slime3DRig';

    const bodyPivot = new THREE.Group();
    bodyPivot.position.set(0, opts.radius * 0.88, 0);
    root.add(bodyPivot);

    const bodyUniforms = {
      uSquashY:     { value: 1.0 },
      uBottomFlat:  { value: 0.35 },
      uJellyWave:   { value: 0.0 },
      uTime:        { value: 0.0 },
      uOutlinePush: { value: 0.0 },
      uEyeMode:     { value: 0 },
      uEyeLook:     { value: new THREE.Vector2(0.12, 0.12) }, // 默认向右上 3/4 仰望
      uEyeCantDeg:  { value: -30.2 },
      uFarEyeScale: { value: 0.81 },
      uBlink:       { value: 0.0 },
      uRenderStyle: { value: 0 },
      uTwinCoreGlow:{ value: 0.35 },
      uHalftoneStr: { value: 0.45 },
      uIsOutline:   { value: 0.0 },
      uOutlineColor:{ value: new THREE.Color(0x0b0b14) },
      uOpacity:     { value: 1.0 }
    };

    const outlineUniforms = THREE.UniformsUtils.clone(bodyUniforms);
    outlineUniforms.uIsOutline.value = 1.0;
    outlineUniforms.uOutlinePush.value = opts.outlineThickness;

    const sphereGeo = new THREE.SphereGeometry(opts.radius, 72, 56);

    const bodyMat = new THREE.ShaderMaterial({
      vertexShader: SLIME_BODY_VS,
      fragmentShader: SLIME_BODY_FS,
      uniforms: bodyUniforms
    });

    const outlineMat = new THREE.ShaderMaterial({
      vertexShader: SLIME_BODY_VS,
      fragmentShader: SLIME_BODY_FS,
      uniforms: outlineUniforms,
      side: THREE.BackSide
    });

    const bodyMesh = new THREE.Mesh(sphereGeo, bodyMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    bodyPivot.add(bodyMesh);

    const outlineMesh = new THREE.Mesh(sphereGeo, outlineMat);
    bodyPivot.add(outlineMesh);

    const wireGeo = new THREE.SphereGeometry(opts.radius * 1.015, 24, 18);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x4fadff,
      wireframe: true,
      transparent: true,
      opacity: 0.0
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    bodyPivot.add(wireMesh);

    // ------------------------------------------------------------------------
    // 伴星 ✦ (3D Star Satellite) + 白色描边壳
    // ------------------------------------------------------------------------
    const starGroup = new THREE.Group();
    starGroup.position.set(-opts.radius * 0.12, opts.radius * 2.15, opts.radius * 0.10);
    if (opts.withCompanionStar) {
      root.add(starGroup);
    }

    const starGeo = create3DConcaveStarGeometry(opts.radius * 0.36, opts.radius * 0.068, opts.radius * 0.075, 1.24);
    const starUniforms = { uGlowBoost: { value: 0.25 } };
    const starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VS,
      fragmentShader: STAR_FS,
      uniforms: starUniforms
    });
    const starMesh = new THREE.Mesh(starGeo, starMat);
    starGroup.add(starMesh);

    const starOutlineGeo = create3DConcaveStarGeometry(opts.radius * 0.395, opts.radius * 0.078, opts.radius * 0.09, 1.24);
    const starOutlineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.92
    });
    const starOutlineMesh = new THREE.Mesh(starOutlineGeo, starOutlineMat);
    starGroup.add(starOutlineMesh);

    // 双子星旋时的第二颗暖金小伴星 + 星环轨道
    const twinGoldStarGeo = create3DConcaveStarGeometry(opts.radius * 0.25, opts.radius * 0.048, opts.radius * 0.06, 1.20);
    const twinGoldStarMat = new THREE.MeshBasicMaterial({ color: 0xffb74d });
    const twinGoldStarMesh = new THREE.Mesh(twinGoldStarGeo, twinGoldStarMat);
    twinGoldStarMesh.position.set(opts.radius * 0.32, opts.radius * 2.22, opts.radius * 0.08);
    twinGoldStarMesh.visible = false;
    root.add(twinGoldStarMesh);

    const orbitRingGeo = new THREE.RingGeometry(opts.radius * 1.40, opts.radius * 1.45, 64);
    const orbitRingMat = new THREE.MeshBasicMaterial({
      color: 0x4fadff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.62
    });
    const orbitRingMesh = new THREE.Mesh(orbitRingGeo, orbitRingMat);
    orbitRingMesh.rotation.x = Math.PI * 0.40;
    orbitRingMesh.rotation.y = -0.26;
    orbitRingMesh.visible = false;
    bodyPivot.add(orbitRingMesh);

    // ------------------------------------------------------------------------
    // 赛博战术全息目镜 (3D Holo-Visor) + 刀锋眼角高压电弧 (3D Electric Arcs)
    // ------------------------------------------------------------------------
    const visorGroup = new THREE.Group();
    visorGroup.visible = false;
    bodyPivot.add(visorGroup);

    const visorCyanMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthWrite: false
    });
    const visorYellowMat = new THREE.MeshBasicMaterial({
      color: 0xffe600,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      depthWrite: false
    });
    const visorGlassMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.18,
      depthWrite: false
    });

    // 弧形半透明全息战术镜片 (紧贴 +Z 前半球面，不遮挡纯白眼眸)
    // 弧形半透明全息战术镜片 (覆盖正前方 ±46° 球面，纯白眼眸清晰透出)
    const visorLensGeo = new THREE.CylinderGeometry(
      opts.radius * 1.125,
      opts.radius * 1.125,
      opts.radius * 0.36,
      40,
      1,
      true,
      -0.80,
      1.60
    );
    const visorLensMesh = new THREE.Mesh(visorLensGeo, visorGlassMat);
    visorLensMesh.position.set(0, opts.radius * 0.13, 0);
    visorGroup.add(visorLensMesh);

    // 360° 环绕式赛博霓虹战术头带与前额导轨 (确保后方追拍与正面特写均清晰可见!)
    const topRimGeo = new THREE.CylinderGeometry(
      opts.radius * 1.14,
      opts.radius * 1.14,
      opts.radius * 0.036,
      48,
      1,
      true,
      -Math.PI,
      Math.PI * 2.0
    );
    const topRimMesh = new THREE.Mesh(topRimGeo, visorCyanMat);
    topRimMesh.position.set(0, opts.radius * 0.29, 0);
    visorGroup.add(topRimMesh);

    const botRimGeo = new THREE.CylinderGeometry(
      opts.radius * 1.14,
      opts.radius * 1.14,
      opts.radius * 0.028,
      40,
      1,
      true,
      -0.82,
      1.64
    );
    const botRimMesh = new THREE.Mesh(botRimGeo, visorYellowMat);
    botRimMesh.position.set(0, -opts.radius * 0.04, 0);
    visorGroup.add(botRimMesh);

    // 左右两侧战术耳翼天线模块 + 镜片六角准星环
    for (let side of [-1, 1]) {
      const templeWing = new THREE.Mesh(
        new THREE.BoxGeometry(opts.radius * 0.08, opts.radius * 0.24, opts.radius * 0.48),
        visorYellowMat
      );
      templeWing.position.set(side * opts.radius * 1.06, opts.radius * 0.18, opts.radius * 0.32);
      templeWing.rotation.y = side * 0.28;
      templeWing.rotation.x = -0.18;
      visorGroup.add(templeWing);

      const antennaFin = new THREE.Mesh(
        new THREE.BoxGeometry(opts.radius * 0.05, opts.radius * 0.38, opts.radius * 0.14),
        visorCyanMat
      );
      antennaFin.position.set(side * opts.radius * 1.10, opts.radius * 0.38, opts.radius * 0.12);
      antennaFin.rotation.x = -0.35;
      visorGroup.add(antennaFin);

      const hudReticle = new THREE.Mesh(
        new THREE.RingGeometry(opts.radius * 0.13, opts.radius * 0.16, 6),
        visorCyanMat
      );
      hudReticle.position.set(side * opts.radius * 0.24, opts.radius * 0.13, opts.radius * 1.13);
      hudReticle.rotation.y = side * 0.22;
      visorGroup.add(hudReticle);
    }

    // 镜片动态上下扫描线
    const visorScanBar = new THREE.Mesh(
      new THREE.CylinderGeometry(
        opts.radius * 1.14,
        opts.radius * 1.14,
        opts.radius * 0.018,
        32,
        1,
        true,
        -0.55,
        1.10
      ),
      visorYellowMat
    );
    visorScanBar.position.set(0, opts.radius * 0.13, 0);
    visorGroup.add(visorScanBar);

    // 刀锋眼觉醒与跑酷时的 3D 眼角高压锯齿电弧组
    const arcGroup = new THREE.Group();
    arcGroup.visible = false;
    bodyPivot.add(arcGroup);
    const slimeArcLines = [];
    for (let a = 0; a < 6; a++) {
      const side = a % 2 === 0 ? -1 : 1;
      const segs = 7;
      const pts = new Float32Array((segs + 1) * 3);
      const aGeo = new THREE.BufferGeometry();
      aGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      const aMat = new THREE.LineBasicMaterial({
        color: a % 3 === 0 ? 0xffe600 : 0x00f5ff,
        transparent: true,
        opacity: 0.95
      });
      const aLine = new THREE.Line(aGeo, aMat);
      arcGroup.add(aLine);
      slimeArcLines.push({ line: aLine, side, segs, idx: a, mat: aMat });
    }

    const cyberVisorState = {
      visorAlpha: 0.0,
      arcIntensity: 0.0
    };

    function setCyberVisor(visorAlpha, arcIntensity) {
      cyberVisorState.visorAlpha = THREE.MathUtils.clamp(visorAlpha || 0.0, 0.0, 1.0);
      cyberVisorState.arcIntensity = THREE.MathUtils.clamp(arcIntensity || 0.0, 0.0, 1.0);
      visorGroup.visible = cyberVisorState.visorAlpha > 0.01;
      arcGroup.visible = cyberVisorState.arcIntensity > 0.01;
      if (visorGroup.visible) {
        visorCyanMat.opacity = 0.88 * cyberVisorState.visorAlpha;
        visorYellowMat.opacity = 0.92 * cyberVisorState.visorAlpha;
        visorGlassMat.opacity = 0.18 * cyberVisorState.visorAlpha;
      }
    }

    // ------------------------------------------------------------------------
    // 底部接触Q弹水波环 (Ground Contact Ripple Rings)
    // ------------------------------------------------------------------------
    const rippleGroup = new THREE.Group();
    rippleGroup.position.set(0, 0.02, 0);
    if (opts.withGroundRipples) {
      root.add(rippleGroup);
    }
    const rippleMeshes = [];
    for (let r = 0; r < 2; r++) {
      const rInner = opts.radius * (0.92 + r * 0.30);
      const rOuter = rInner + opts.radius * (0.045 - r * 0.012);
      const rGeo = new THREE.RingGeometry(rInner, rOuter, 64);
      rGeo.rotateX(-Math.PI / 2);
      const rMat = new THREE.MeshBasicMaterial({
        color: r === 0 ? 0x4fadff : 0x8a3cff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: r === 0 ? 0.52 : 0.28
      });
      const rMesh = new THREE.Mesh(rGeo, rMat);
      rippleGroup.add(rMesh);
      rippleMeshes.push({ mesh: rMesh, mat: rMat, baseScale: 1.0 });
    }

    const starSpring = {
      pos: new THREE.Vector3(-opts.radius * 0.12, opts.radius * 2.34, opts.radius * 0.10),
      vel: new THREE.Vector3(0, 0, 0),
      targetOffset: new THREE.Vector3(-opts.radius * 0.12, opts.radius * 2.34, opts.radius * 0.10)
    };

    // ------------------------------------------------------------------------
    // 3D 头部/视线二阶弹簧阻尼耦合动力学系统 (Look Spring-Damper Coupling)
    // ------------------------------------------------------------------------
    const lookState = {
      targetYaw: 0.0,
      targetPitch: 0.0,
      targetTilt: 0.0,
      currentYaw: 0.0,
      currentPitch: 0.0,
      currentTilt: 0.0,
      yawVel: 0.0,
      pitchVel: 0.0,
      tiltVel: 0.0,
      baseTilt: 0.0
    };

    function setLook(yaw, pitch, tilt, immediate) {
      lookState.targetYaw = yaw || 0.0;
      lookState.targetPitch = pitch || 0.0;
      lookState.targetTilt = tilt || 0.0;
      if (immediate) {
        lookState.currentYaw = lookState.targetYaw;
        lookState.currentPitch = lookState.targetPitch;
        lookState.currentTilt = lookState.targetTilt;
        lookState.yawVel = 0.0;
        lookState.pitchVel = 0.0;
        lookState.tiltVel = 0.0;
      }
    }

    function syncOutlineUniforms() {
      outlineUniforms.uSquashY.value = bodyUniforms.uSquashY.value;
      outlineUniforms.uBottomFlat.value = bodyUniforms.uBottomFlat.value;
      outlineUniforms.uJellyWave.value = bodyUniforms.uJellyWave.value;
      outlineUniforms.uTime.value = bodyUniforms.uTime.value;
      outlineUniforms.uOpacity.value = bodyUniforms.uOpacity.value * 0.45;
    }

    const EYE_MODE_MAP = {
      curious: 0,
      blade:   1,
      asym:    2,
      flat:    3,
      rocket:  4,
      happy:   5,
      spark:   6
    };

    function setPosePreset(presetName) {
      bodyPivot.rotation.set(0, 0, 0);
      bodyUniforms.uSquashY.value = 1.0;
      bodyUniforms.uBottomFlat.value = 0.35;
      bodyUniforms.uJellyWave.value = 0.0;
      bodyUniforms.uEyeLook.value.set(0.72, 0.55);
      bodyUniforms.uTwinCoreGlow.value = 0.30;
      twinGoldStarMesh.visible = false;
      orbitRingMesh.visible = false;
      rippleGroup.visible = opts.withGroundRipples;
      starSpring.targetOffset.set(-opts.radius * 0.12, opts.radius * 2.34, opts.radius * 0.10);

      if (presetName === '01_curious' || presetName === 'curious') {
        bodyUniforms.uEyeMode.value = EYE_MODE_MAP.curious;
        setLook(0.72, 0.55, 0.0, true);

      } else if (presetName === '02_blade' || presetName === 'blade') {
        bodyUniforms.uEyeMode.value = EYE_MODE_MAP.blade;
        bodyUniforms.uSquashY.value = 0.90;
        bodyUniforms.uBottomFlat.value = 0.45;
        bodyPivot.rotation.x = 0.06;
        setLook(0.0, 0.20, 0.0, true);
        starSpring.targetOffset.set(0.0, opts.radius * 2.22, opts.radius * 0.18);

      } else if (presetName === '03_look_around' || presetName === 'asym') {
        bodyUniforms.uEyeMode.value = EYE_MODE_MAP.asym;
        bodyUniforms.uSquashY.value = 1.08;
        bodyPivot.rotation.z = 0.10;
        setLook(0.65, 0.45, 0.10, true);

      } else if (presetName === '04_squash_charge' || presetName === 'flat') {
        bodyUniforms.uEyeMode.value = EYE_MODE_MAP.flat;
        bodyUniforms.uSquashY.value = 0.68;
        bodyUniforms.uBottomFlat.value = 0.65;
        setLook(0.20, 0.0, 0.0, true);
        starSpring.targetOffset.set(0.0, opts.radius * 1.82, 0.0);

      } else if (presetName === '05_rocket_stretch' || presetName === 'rocket') {
        bodyUniforms.uEyeMode.value = EYE_MODE_MAP.rocket;
        bodyUniforms.uSquashY.value = 1.34;
        bodyUniforms.uBottomFlat.value = 0.0;
        rippleGroup.visible = false;
        setLook(0.0, 0.85, 0.0, true);
        starSpring.targetOffset.set(0.0, opts.radius * 2.76, 0.0);

      } else if (presetName === '06_happy_landing' || presetName === 'happy') {
        bodyUniforms.uEyeMode.value = EYE_MODE_MAP.happy;
        bodyUniforms.uSquashY.value = 0.84;
        bodyUniforms.uBottomFlat.value = 0.58;
        setLook(0.20, 0.30, 0.0, true);
        starSpring.targetOffset.set(-opts.radius * 0.10, opts.radius * 2.12, 0.0);

      } else if (presetName === '07_starry_awe' || presetName === 'spark') {
        bodyUniforms.uEyeMode.value = EYE_MODE_MAP.spark;
        bodyUniforms.uSquashY.value = 1.03;
        bodyUniforms.uTwinCoreGlow.value = 0.60;
        setLook(0.40, 0.45, 0.0, true);
        starSpring.targetOffset.set(-opts.radius * 0.12, opts.radius * 2.38, 0.0);

      } else if (presetName === '08_head_tilt' || presetName === 'tilt') {
        bodyUniforms.uEyeMode.value = EYE_MODE_MAP.curious;
        bodyPivot.rotation.z = -THREE.MathUtils.degToRad(22.0);
        setLook(0.20, 0.40, -THREE.MathUtils.degToRad(22.0), true);
        starSpring.targetOffset.set(opts.radius * 0.45, opts.radius * 2.22, 0.0);

      } else if (presetName === '09_twin_resonance' || presetName === 'twin') {
        bodyUniforms.uEyeMode.value = EYE_MODE_MAP.curious;
        bodyUniforms.uTwinCoreGlow.value = 1.25;
        twinGoldStarMesh.visible = true;
        orbitRingMesh.visible = true;
        setLook(0.40, 0.45, 0.0, true);
        starSpring.targetOffset.set(-opts.radius * 0.24, opts.radius * 2.36, 0.0);
      }

      const sy = bodyUniforms.uSquashY.value;
      bodyPivot.position.y = opts.radius * 0.86 * sy;
      starGroup.position.copy(starSpring.targetOffset);
      starSpring.pos.copy(starSpring.targetOffset);
      syncOutlineUniforms();
    }

    function setRenderStyle(styleName) {
      if (styleName === 'clay') {
        bodyUniforms.uRenderStyle.value = 2;
        outlineUniforms.uOutlineColor.value.setHex(0x334155);
        wireMat.opacity = 0.0;
      } else if (styleName === 'cyberwire') {
        bodyUniforms.uRenderStyle.value = 1;
        outlineUniforms.uOutlineColor.value.setHex(0x00e5ff);
        wireMat.opacity = 0.22;
      } else {
        bodyUniforms.uRenderStyle.value = 0;
        outlineUniforms.uOutlineColor.value.setHex(0x0b0b14);
        wireMat.opacity = 0.0;
      }
    }

    function update(elapsed, dt) {
      const safeDt = Math.min(dt || 0.016, 0.05);
      bodyUniforms.uTime.value = elapsed;
      syncOutlineUniforms();

      // 二阶弹簧阻尼视线/头部转动动力学计算
      const kStiff = 28.0;
      const kDamp = 7.0;

      const dYaw = lookState.targetYaw - lookState.currentYaw;
      lookState.yawVel += (dYaw * kStiff - lookState.yawVel * kDamp) * safeDt;
      lookState.currentYaw += lookState.yawVel * safeDt;

      const dPitch = lookState.targetPitch - lookState.currentPitch;
      lookState.pitchVel += (dPitch * kStiff - lookState.pitchVel * kDamp) * safeDt;
      lookState.currentPitch += lookState.pitchVel * safeDt;

      const dTilt = lookState.targetTilt - lookState.currentTilt;
      lookState.tiltVel += (dTilt * kStiff - lookState.tiltVel * kDamp) * safeDt;
      lookState.currentTilt += lookState.tiltVel * safeDt;

      // 身体 3D 姿态二阶阻尼耦合：
      // - bodyPivot.rotation.y: 随视线水平转向（转头感）
      // - bodyPivot.rotation.x: 低头时身体前探俯冲(-pitch -> +rot.x)；抬头时身体后仰挺拔(+pitch -> -rot.x)
      // - bodyPivot.rotation.z: 身体侧倾 + 随水平转头自然微侧倾
      bodyPivot.rotation.y = lookState.currentYaw * 0.65;
      bodyPivot.rotation.x = -lookState.currentPitch * 0.45;
      bodyPivot.rotation.z = lookState.baseTilt + lookState.currentTilt - lookState.currentYaw * 0.14;

      // 球面纯白眼视线动态映射：
      const mode = bodyUniforms.uEyeMode.value;
      let baseEyeX = 0.0;
      let baseEyeY = 0.0;
      if (mode === 4) { // rocket
        baseEyeY = 0.65;
      }
      const eyeLookX = THREE.MathUtils.clamp(baseEyeX + lookState.currentYaw, -1.0, 1.0);
      const eyeLookY = THREE.MathUtils.clamp(baseEyeY + lookState.currentPitch, -1.0, 1.0);
      bodyUniforms.uEyeLook.value.set(eyeLookX, eyeLookY);

      // 体积守恒与底部接触面自适应高度
      const sy = bodyUniforms.uSquashY.value;
      bodyPivot.position.y = opts.radius * 0.88 * sy;
      const sxz = 1.0 / Math.sqrt(Math.max(0.52, Math.min(1.55, sy)));
      visorGroup.scale.set(sxz, sy, sxz);
      arcGroup.scale.set(sxz, sy, sxz);

      if (visorGroup.visible) {
        visorScanBar.position.y = opts.radius * (0.13 + 0.14 * Math.sin(elapsed * 14.0));
      }
      if (arcGroup.visible) {
        const amp = cyberVisorState.arcIntensity;
        slimeArcLines.forEach((arcObj) => {
          arcObj.mat.opacity = Math.min(1.0, amp * (0.65 + 0.35 * Math.sin(elapsed * 55.0 + arcObj.idx * 2.1)));
          const arr = arcObj.line.geometry.attributes.position.array;
          const baseX = arcObj.side * opts.radius * 0.28;
          const baseY = opts.radius * (0.14 + (arcObj.idx % 3 - 1) * 0.08);
          const baseZ = opts.radius * 0.98;
          for (let k = 0; k <= arcObj.segs; k++) {
            const u = k / arcObj.segs;
            const jx = (k === 0) ? 0.0 : Math.sin(elapsed * 68.0 + k * 4.7 + arcObj.idx * 1.9) * 0.09 * amp;
            const jy = (k === 0) ? 0.0 : Math.cos(elapsed * 74.0 + k * 3.9 + arcObj.idx * 2.3) * 0.11 * amp;
            const jz = (k === 0) ? 0.0 : Math.sin(elapsed * 62.0 + k * 5.1 + arcObj.idx) * 0.07 * amp;
            arr[k * 3 + 0] = baseX + arcObj.side * u * opts.radius * (0.55 + 0.25 * amp) + jx;
            arr[k * 3 + 1] = baseY + u * opts.radius * (0.26 + (arcObj.idx % 2) * 0.16) + jy;
            arr[k * 3 + 2] = baseZ - u * opts.radius * 0.38 + jz;
          }
          arcObj.line.geometry.attributes.position.needsUpdate = true;
        });
      }

      // 伴星 ✦ 动态悬浮跟随
      starSpring.targetOffset.x = -opts.radius * 0.12 + lookState.currentYaw * 0.45 + lookState.currentTilt * 0.35;
      starSpring.targetOffset.z = opts.radius * 0.10 + lookState.currentPitch * 0.35;
      starSpring.targetOffset.y = opts.radius * (2.25 * sy) - Math.abs(lookState.currentPitch) * 0.12;

      const desired = new THREE.Vector3(
        starSpring.targetOffset.x + Math.sin(elapsed * 2.4) * (opts.radius * 0.04),
        starSpring.targetOffset.y + Math.sin(elapsed * 3.8) * (opts.radius * 0.06),
        starSpring.targetOffset.z
      );
      const stiffness = 28.0;
      const damping = 6.5;
      const force = desired.sub(starSpring.pos).multiplyScalar(stiffness);
      starSpring.vel.add(force.multiplyScalar(safeDt));
      starSpring.vel.multiplyScalar(Math.exp(-damping * safeDt));
      starSpring.pos.add(starSpring.vel.clone().multiplyScalar(safeDt));
      starGroup.position.copy(starSpring.pos);
      starGroup.rotation.y = Math.sin(elapsed * 1.4) * 0.22;
      starGroup.rotation.z = Math.cos(elapsed * 2.0) * 0.08;

      if (twinGoldStarMesh.visible) {
        twinGoldStarMesh.rotation.y = Math.cos(elapsed * 1.5) * 0.22;
        orbitRingMesh.rotation.z = elapsed * 0.85;
      }

      rippleMeshes.forEach((rm, idx) => {
        const pulse = 1.0 + 0.05 * Math.sin(elapsed * 3.2 - idx * 1.2);
        rm.mesh.scale.set(pulse, pulse, pulse);
      });
    }

    setPosePreset('01_curious');

    return {
      root,
      bodyPivot,
      bodyMesh,
      outlineMesh,
      starGroup,
      starMesh,
      rippleGroup,
      uniforms: bodyUniforms,
      outlineUniforms,
      lookState,
      setLook,
      setPosePreset,
      setRenderStyle,
      syncOutlineUniforms,
      visorGroup,
      arcGroup,
      setCyberVisor,
      update
    };
  }

  global.Slime3DAsset = {
    createSlime3DRig,
    create3DConcaveStarGeometry
  };
  global.CyberSlime3D = global.Slime3DAsset;
})(window);
