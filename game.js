window.__BH_EXPO = { value: 1.0, auto: !/[?&]expo=manual/.test(location.search), t: 0 };
/*
 * BLACK HOLE COMBAT -- single-file build (Babylon.js 9.22.2 vendored as ./babylon.js, no CDN).
 * Source of design: "Black Hole Combat System -- Ultimate Master Plan", treated as a strong
 * SUGGESTION, not gospel. Where this file deviates, the module comment says why.
 */

// ---------------------------------------------------------------------------
// BABYLON.JS LIGHTWEIGHT WEBGL2/WEBGL1 COMPATIBILITY RUNTIME
// Activates automatically if external ./babylon.js is not present (e.g. in
// single-file sandbox preview or standalone deployment), and also serves as
// site/babylon.js for local HopWeb / headless-browser builds.
// Implements the exact BABYLON.* 9.x API surface used by Black Hole Combat:
// Left-handed coordinates (+X right, +Y up, +Z forward), Camera.fov in radians,
// RawTexture RGBA32F float textures, ShaderMaterial, StandardMaterial (multi-
// light Blinn-Phong + Fresnel rim + emissive), TransformNode/Mesh hierarchy,
// MeshBuilder primitives, LineSystem, and thin-instance buffers (world0..3 +
// instanceColor).
// ---------------------------------------------------------------------------
(function (global) {
  if (global.BABYLON && global.BABYLON.Engine && global.BABYLON.MeshBuilder) return;

  const Constants = {
    TEXTURE_NEAREST_SAMPLINGMODE: 1,
    TEXTURE_BILINEAR_SAMPLINGMODE: 2,
    TEXTURE_CLAMP_ADDRESSMODE: 0,
    TEXTURE_WRAP_ADDRESSMODE: 1,
    TEXTURETYPE_UNSIGNED_INT: 0,
    TEXTURETYPE_FLOAT: 1,
    ALPHA_DISABLE: 0,
    ALPHA_COMBINE: 2,
    ALPHA_ONEONE: 1,
    ALPHA_ADD: 1,
  };

  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = +x || 0; this.y = +y || 0; this.z = +z || 0; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    copyFrom(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    copyFromFloats(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    length() { return Math.hypot(this.x, this.y, this.z); }
    normalize() { const l = Math.hypot(this.x, this.y, this.z); if (l > 1e-12) { this.x /= l; this.y /= l; this.z /= l; } return this; }
    static Zero() { return new Vector3(0, 0, 0); }
    static Up() { return new Vector3(0, 1, 0); }
  }

  class Quaternion {
    constructor(x = 0, y = 0, z = 0, w = 1) { this.x = +x || 0; this.y = +y || 0; this.z = +z || 0; this.w = w === undefined ? 1 : +w; }
    set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
    copyFrom(q) { this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w; return this; }
    clone() { return new Quaternion(this.x, this.y, this.z, this.w); }
    static Identity() { return new Quaternion(0, 0, 0, 1); }
  }

  class Color3 {
    constructor(r = 1, g = 1, b = 1) { this.r = +r; this.g = +g; this.b = +b; }
    set(r, g, b) { this.r = r; this.g = g; this.b = b; return this; }
    copyFromFloats(r, g, b) { this.r = r; this.g = g; this.b = b; return this; }
    clone() { return new Color3(this.r, this.g, this.b); }
  }

  class Color4 {
    constructor(r = 1, g = 1, b = 1, a = 1) { this.r = +r; this.g = +g; this.b = +b; this.a = a === undefined ? 1 : +a; }
    set(r, g, b, a) { this.r = r; this.g = g; this.b = b; this.a = a; return this; }
    clone() { return new Color4(this.r, this.g, this.b, this.a); }
  }

  // Column-major 4x4 matrix for WebGL
  class Matrix {
    constructor() {
      this.m = new Float32Array(16);
      this.m[0] = 1; this.m[5] = 1; this.m[10] = 1; this.m[15] = 1;
    }
    static Identity() { return new Matrix(); }
    static ComposeToRef(scale, rotQ, euler, pos, out) {
      const m = out.m;
      let qx = 0, qy = 0, qz = 0, qw = 1;
      if (rotQ) {
        qx = rotQ.x; qy = rotQ.y; qz = rotQ.z; qw = rotQ.w;
      } else if (euler && (euler.x !== 0 || euler.y !== 0 || euler.z !== 0)) {
        const cx = Math.cos(euler.x * 0.5), sx = Math.sin(euler.x * 0.5);
        const cy = Math.cos(euler.y * 0.5), sy = Math.sin(euler.y * 0.5);
        const cz = Math.cos(euler.z * 0.5), sz = Math.sin(euler.z * 0.5);
        qw = cz * cx * cy + sz * sx * sy;
        qx = cz * sx * cy - sz * cx * sy;
        qy = cz * cx * sy + sz * sx * cy;
        qz = sz * cx * cy - cz * sx * sy;
      }
      const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
      const xx = qx * x2, xy = qx * y2, xz = qx * z2;
      const yy = qy * y2, yz = qy * z2, zz = qz * z2;
      const wx = qw * x2, wy = qw * y2, wz = qw * z2;
      const sx = scale.x, sy = scale.y, sz = scale.z;
      m[0] = (1 - (yy + zz)) * sx;
      m[1] = (xy + wz) * sx;
      m[2] = (xz - wy) * sx;
      m[3] = 0;
      m[4] = (xy - wz) * sy;
      m[5] = (1 - (xx + zz)) * sy;
      m[6] = (yz + wx) * sy;
      m[7] = 0;
      m[8] = (xz + wy) * sz;
      m[9] = (yz - wx) * sz;
      m[10] = (1 - (xx + yy)) * sz;
      m[11] = 0;
      m[12] = pos.x;
      m[13] = pos.y;
      m[14] = pos.z;
      m[15] = 1;
      return out;
    }
    static MultiplyToRef(a, b, out) {
      const am = a.m, bm = b.m, rm = new Float32Array(16);
      for (let col = 0; col < 4; col++) {
        const b0 = bm[col * 4], b1 = bm[col * 4 + 1], b2 = bm[col * 4 + 2], b3 = bm[col * 4 + 3];
        rm[col * 4]     = am[0] * b0 + am[4] * b1 + am[8]  * b2 + am[12] * b3;
        rm[col * 4 + 1] = am[1] * b0 + am[5] * b1 + am[9]  * b2 + am[13] * b3;
        rm[col * 4 + 2] = am[2] * b0 + am[6] * b1 + am[10] * b2 + am[14] * b3;
        rm[col * 4 + 3] = am[3] * b0 + am[7] * b1 + am[11] * b2 + am[15] * b3;
      }
      out.m.set(rm);
      return out;
    }
    static LookAtLHToRef(eye, target, up, out) {
      let zx = target.x - eye.x, zy = target.y - eye.y, zz = target.z - eye.z;
      let zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
      let xx = up.y * zz - up.z * zy, xy = up.z * zx - up.x * zz, xz = up.x * zy - up.y * zx;
      let xl = Math.hypot(xx, xy, xz);
      if (xl < 1e-6) { xx = 1; xy = 0; xz = 0; xl = 1; }
      xx /= xl; xy /= xl; xz /= xl;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      const m = out.m;
      m[0] = xx; m[4] = xy; m[8]  = xz; m[12] = -(xx * eye.x + xy * eye.y + xz * eye.z);
      m[1] = yx; m[5] = yy; m[9]  = yz; m[13] = -(yx * eye.x + yy * eye.y + yz * eye.z);
      m[2] = zx; m[6] = zy; m[10] = zz; m[14] = -(zx * eye.x + zy * eye.y + zz * eye.z);
      m[3] = 0;  m[7] = 0;  m[11] = 0;  m[15] = 1;
      return out;
    }
    static PerspectiveFovLHToRef(fov, aspect, znear, zfar, out) {
      const t = 1 / Math.tan(fov * 0.5);
      const m = out.m;
      m.fill(0);
      m[0] = t / aspect;
      m[5] = t;
      m[10] = (zfar + znear) / (zfar - znear);
      m[11] = 1;
      m[14] = (-2 * znear * zfar) / (zfar - znear);
      return out;
    }
  }

  const Effect = { ShadersStore: {} };
  const VertexBuffer = { PositionKind: 'position', NormalKind: 'normal', UVKind: 'uv', ColorKind: 'color' };

  class Engine {
    constructor(canvas, antialias = true, options = {}, adaptToDeviceRatio = false) {
      this.canvas = canvas;
      this._hwScale = 1;
      const glOpts = Object.assign({ antialias: !!antialias, alpha: false, depth: true, stencil: !!options.stencil, preserveDrawingBuffer: !!options.preserveDrawingBuffer }, options);
      this.gl = canvas.getContext('webgl2', glOpts);
      this.isWebGL2 = !!this.gl;
      if (!this.gl) {
        this.gl = canvas.getContext('webgl', glOpts) || canvas.getContext('experimental-webgl', glOpts);
      }
      if (this.gl && !this.isWebGL2) {
        this.extFloat = this.gl.getExtension('OES_texture_float');
        this.extDeriv = this.gl.getExtension('OES_standard_derivatives');
        this.extInst = this.gl.getExtension('ANGLE_instanced_arrays');
        this.extUint = this.gl.getExtension('OES_element_index_uint');
      } else if (this.gl && this.isWebGL2) {
        this.gl.getExtension('EXT_color_buffer_float');
        this.gl.getExtension('OES_texture_float_linear'); this.gl.getExtension('OES_standard_derivatives');
      }
      this._loopFn = null;
      this._rafId = 0;
      this.resize();
    }
    setHardwareScalingLevel(level) {
      this._hwScale = Math.max(0.25, +level || 1);
      this.resize();
    }
    getHardwareScalingLevel() { return this._hwScale; }
    resize() {
      if (!this.canvas) return;
      const cw = this.canvas.clientWidth || window.innerWidth || 915;
      const ch = this.canvas.clientHeight || window.innerHeight || 412;
      const w = Math.max(1, Math.round(cw / this._hwScale));
      const h = Math.max(1, Math.round(ch / this._hwScale));
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
      if (this.gl) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    getRenderWidth() { return this.canvas ? this.canvas.width : 915; }
    getRenderHeight() { return this.canvas ? this.canvas.height : 412; }
    getAspectRatio() {
      const w = this.getRenderWidth(), h = this.getRenderHeight();
      return h > 0 ? w / h : 16 / 9;
    }
    runRenderLoop(fn) {
      this._loopFn = fn;
      this._savedLoopFn = fn;
      if (this._rafId) cancelAnimationFrame(this._rafId);
      const tick = () => {
        if (!this._loopFn) return;
        this._loopFn();
        this._rafId = requestAnimationFrame(tick);
      };
      this._rafId = requestAnimationFrame(tick);
    }
    stepFrame() { if (this._savedLoopFn) this._savedLoopFn(); }
    stopRenderLoop() {
      this._loopFn = null;
      if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = 0; }
    }
  }
  Engine.Version = '9.22.2-bhcs';

  class Scene {
    constructor(engine) {
      this.engine = engine;
      this.clearColor = new Color4(0, 0, 0, 1);
      this.meshes = [];
      this.lights = [];
      this.activeCamera = null;
      this._viewMat = new Matrix();
      this._projMat = new Matrix();
      this._vpMat = new Matrix();
    }
    render() {
      const gl = this.engine.gl;
      if (!gl || !this.activeCamera) return;
      gl.viewport(0, 0, this.engine.getRenderWidth(), this.engine.getRenderHeight());
      gl.clearColor(this.clearColor.r, this.clearColor.g, this.clearColor.b, this.clearColor.a);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const cam = this.activeCamera;
      const aspect = this.engine.getAspectRatio(cam);
      Matrix.LookAtLHToRef(cam.position, cam._target, cam.upVector, this._viewMat);
      Matrix.PerspectiveFovLHToRef(cam.fov, aspect, cam.minZ, cam.maxZ, this._projMat);
      Matrix.MultiplyToRef(this._projMat, this._viewMat, this._vpMat);

      // Sort meshes by renderingGroupId then alpha mode
      const list = this.meshes;
      let prevGroup = 0;
      const sorted = this._sorted || (this._sorted = []);
      sorted.length = 0;
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (m && m.isVisible && m._enabled && !m._disposed) sorted.push(m);
      }
      sorted.sort(Scene._cmp);

      for (let i = 0; i < sorted.length; i++) {
        const m = sorted[i];
        const g = m.renderingGroupId || 0;
        if (g > prevGroup) {
          gl.depthMask(true);
          gl.clear(gl.DEPTH_BUFFER_BIT);
          prevGroup = g;
        }
        m._render(gl, this, this._viewMat, this._projMat, this._vpMat, cam);
      }
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
  }

  Scene._cmp = function (a, b) {
    const ga = a.renderingGroupId || 0, gb = b.renderingGroupId || 0;
    if (ga !== gb) return ga - gb;
    // order inside a group: opaque -> sky (only the pixels nothing else covers) -> blended
    const ka = a.isSky ? 1 : ((a.material && a.material.needAlphaBlending) ? 2 : 0);
    const kb = b.isSky ? 1 : ((b.material && b.material.needAlphaBlending) ? 2 : 0);
    return ka - kb;
  };

  class UniversalCamera {
    constructor(name, position, scene) {
      this.name = name;
      this.position = position ? position.clone() : new Vector3(0, 0, -10);
      this.upVector = new Vector3(0, 1, 0);
      this._target = new Vector3(0, 0, 0);
      this.fov = 0.8;
      this.minZ = 0.5;
      this.maxZ = 20000;
      if (scene && !scene.activeCamera) scene.activeCamera = this;
    }
    setTarget(t) { this._target.copyFrom(t); }
    attachControl() {}
  }

  class DirectionalLight {
    constructor(name, direction, scene) {
      this.name = name;
      this.type = 'dir';
      this.direction = direction ? direction.clone() : new Vector3(0, -1, 0);
      this.diffuse = new Color3(1, 1, 1);
      this.specular = new Color3(1, 1, 1);
      this.intensity = 1.0;
      if (scene) scene.lights.push(this);
    }
  }

  class HemisphericLight {
    constructor(name, direction, scene) {
      this.name = name;
      this.type = 'hemi';
      this.direction = direction ? direction.clone() : new Vector3(0, 1, 0);
      this.diffuse = new Color3(1, 1, 1);
      this.groundColor = new Color3(0.1, 0.1, 0.15);
      this.intensity = 0.5;
      if (scene) scene.lights.push(this);
    }
  }

  class PointLight {
    constructor(name, position, scene) {
      this.name = name;
      this.type = 'point';
      this.position = position ? position.clone() : new Vector3(0, 0, 0);
      this.diffuse = new Color3(1, 1, 1);
      this.specular = new Color3(1, 1, 1);
      this.intensity = 1.0;
      if (scene) scene.lights.push(this);
    }
  }

  class RawTexture {
    constructor(glTex) {
      this._glTex = glTex;
      this.wrapU = Constants.TEXTURE_CLAMP_ADDRESSMODE;
      this.wrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE;
    }
    updateData(scene, data, width, height) {
      const gl = scene.engine.gl;
      if (!gl || !this._glTex) return;
      gl.bindTexture(gl.TEXTURE_2D, this._glTex);
      if (scene.engine.isWebGL2) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, data);
      }
    }
    static CreateRGBATexture(data, width, height, scene, generateMipMaps, invertY, samplingMode, type) {
      const gl = scene.engine.gl;
      if (!gl) return new RawTexture(null);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, !!invertY);
      const isFloat = type === Constants.TEXTURETYPE_FLOAT || data instanceof Float32Array;
      const filter = samplingMode === Constants.TEXTURE_NEAREST_SAMPLINGMODE ? gl.NEAREST : gl.LINEAR;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (isFloat) {
        if (scene.engine.isWebGL2) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
        } else {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, data);
        }
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      }
      return new RawTexture(tex);
    }
  }

  function compileProgram(gl, isWebGL2, vsSrc, fsSrc) {
    let vSrc = vsSrc, fSrc = fsSrc;
    if (isWebGL2 && vSrc.indexOf('#version 300') < 0) {
      vSrc = '#version 300 es\n' + vSrc.replace(/\battribute\s+/g, 'in ').replace(/\bvarying\s+/g, 'out ');
      fSrc = '#version 300 es\nprecision highp float;\nout vec4 _bhFragColor;\n' +
        fSrc.replace(/\bvarying\s+/g, 'in ').replace(/\btexture2D\b/g, 'texture').replace(/\bgl_FragColor\b/g, '_bhFragColor');
    } else if (!isWebGL2 && fSrc.indexOf('fwidth') >= 0 && fSrc.indexOf('GL_OES_standard_derivatives') < 0) {
      fSrc = '#extension GL_OES_standard_derivatives : enable\n' + fSrc;
    }
    function makeShader(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(s), src.slice(0, 300));
      }
      return s;
    }
    const vs = makeShader(gl.VERTEX_SHADER, vSrc);
    const fs = makeShader(gl.FRAGMENT_SHADER, fSrc);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog));
    }
    return prog;
  }

  class ShaderMaterial {
    constructor(name, scene, shaderPath, options = {}) {
      this.name = name;
      this.scene = scene;
      this.shaderPath = shaderPath;
      this.options = options;
      this.backFaceCulling = true;
      this.disableDepthWrite = false;
      this.needAlphaBlending = !!options.needAlphaBlending;
      this.alphaMode = Constants.ALPHA_COMBINE;
      this._floats = {};
      this._vec3s = {};
      this._vec4s = {};
      this._textures = {};
      this._prog = null;
      this._vsKey = (typeof shaderPath === 'string' ? shaderPath : shaderPath.vertex) + 'VertexShader';
      this._fsKey = (typeof shaderPath === 'string' ? shaderPath : shaderPath.fragment) + 'FragmentShader';
      this._compiledFsSrc = null;
    }
    setFloat(k, v) { this._floats[k] = v; return this; }
    setVector3(k, v) { this._vec3s[k] = v; return this; }
    setColor3(k, c) { this._vec3s[k] = { x: c.r, y: c.g, z: c.b }; return this; }
    setColor4(k, c) { this._vec4s[k] = { x: c.r, y: c.g, z: c.b, w: c.a }; return this; }
    setTexture(k, t) { this._textures[k] = t; return this; }
    _getProgram(gl, isWebGL2) {
      const vsSrc = Effect.ShadersStore[this._vsKey];
      const fsSrc = Effect.ShadersStore[this._fsKey];
      if (!this._prog || this._compiledFsSrc !== fsSrc) {
        this._prog = compileProgram(gl, isWebGL2, vsSrc, fsSrc);
        this._compiledFsSrc = fsSrc;
        this._uLoc = {};
      }
      return this._prog;
    }
    _loc(gl, prog, name) {
      if (!(name in this._uLoc)) this._uLoc[name] = gl.getUniformLocation(prog, name);
      return this._uLoc[name];
    }
  }

  const STD_VS = [
    'precision highp float;',
    'attribute vec3 position;',
    'attribute vec3 normal;',
    'uniform mat4 world;',
    'uniform mat4 viewProjection;',
    'varying vec3 vWPos;',
    'varying vec3 vWNorm;',
    'void main(void) {',
    '  vec4 wp = world * vec4(position, 1.0);',
    '  vWPos = wp.xyz;',
    '  vWNorm = normalize(mat3(world[0].xyz, world[1].xyz, world[2].xyz) * normal);',
    '  gl_Position = viewProjection * wp;',
    '}'
  ].join('\n');

  const STD_FS = [
    'precision highp float;',
    'varying vec3 vWPos;',
    'varying vec3 vWNorm;',
    'uniform vec3 uDiffuse;',
    'uniform vec3 uEmissive;',
    'uniform vec3 uSpecular;',
    'uniform float uSpecPow;',
    'uniform float uAlpha;',
    'uniform float uUnlit;',
    'uniform vec3 uCamPos;',
    'uniform vec3 uSunDir;',
    'uniform vec3 uSunCol;',
    'uniform vec3 uHemiSky;',
    'uniform vec3 uHemiGnd;',
    'uniform float uExposure;',
    'vec3 bhFilm(vec3 x){vec3 c=(x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14);return pow(clamp(c,0.0,1.0),vec3(1.0/2.2));}',
    'void main(void) {',
    '  if (uUnlit > 0.5) {',
    '    gl_FragColor = vec4(uEmissive + uDiffuse * 0.25, uAlpha);',
    '    return;',
    '  }',
    '  vec3 N = normalize(vWNorm);',
    '  vec3 V = normalize(uCamPos - vWPos);',
    '  if (dot(N, V) < 0.0) N = -N;',
    '  vec3 L = normalize(-uSunDir);',
    '  float ndl = max(0.0, dot(N, L));',
    '  float hemi = 0.5 * N.y + 0.5;',
    '  vec3 amb = mix(uHemiGnd, uHemiSky, hemi);',
    '  vec3 H = normalize(L + V);',
    '  float spec = pow(max(0.0, dot(N, H)), max(1.0, uSpecPow)) * ndl;',
    '  float fres = pow(1.0 - max(0.0, dot(N, V)), 3.0);',
    '  vec3 col = uDiffuse * (amb + uSunCol * ndl) + uSpecular * uSunCol * spec + uEmissive + uSunCol * fres * 0.12;',
    '  col = bhFilm(pow(max(col, 0.0), vec3(2.2)) * uExposure);',
    '  gl_FragColor = vec4(col, uAlpha);',
    '}'
  ].join('\n');

  const LINE_VS = [
    'precision highp float;',
    'attribute vec3 position;',
    'attribute vec4 color;',
    'uniform mat4 world;',
    'uniform mat4 viewProjection;',
    'varying vec4 vCol;',
    'void main(void) {',
    '  vCol = color;',
    '  gl_Position = viewProjection * world * vec4(position, 1.0);',
    '}'
  ].join('\n');

  const LINE_FS = [
    'precision highp float;',
    'varying vec4 vCol;',
    'void main(void) {',
    '  gl_FragColor = vCol;',
    '}'
  ].join('\n');

  class StandardMaterial {
    constructor(name, scene) {
      this.name = name;
      this.scene = scene;
      this.diffuseColor = new Color3(0.8, 0.8, 0.8);
      this.emissiveColor = new Color3(0, 0, 0);
      this.specularColor = new Color3(0.25, 0.25, 0.25);
      this.specularPower = 32;
      this.alpha = 1.0;
      this.disableLighting = false;
      this.backFaceCulling = true;
      this.wireframe = false;
      this.alphaMode = Constants.ALPHA_COMBINE;
    }
    get needAlphaBlending() { return this.alpha < 0.999 || this.alphaMode === Constants.ALPHA_ONEONE; }
    dispose() {}
  }

  class TransformNode {
    constructor(name, scene) {
      this.name = name;
      this.scene = scene;
      this.position = new Vector3(0, 0, 0);
      this.rotation = new Vector3(0, 0, 0);
      this.rotationQuaternion = null;
      this.scaling = new Vector3(1, 1, 1);
      this.parent = null;
      this._children = [];
      this._localMat = new Matrix();
      this._worldMat = new Matrix();
      this._enabled = true;
      this._disposed = false;
    }
    set parent(p) {
      if (this._parent && this._parent._children) {
        const idx = this._parent._children.indexOf(this);
        if (idx >= 0) this._parent._children.splice(idx, 1);
      }
      this._parent = p;
      if (p && p._children) p._children.push(this);
    }
    get parent() { return this._parent; }
    setEnabled(b) { this._enabled = !!b; }
    isEnabled() {
      let cur = this;
      while (cur) { if (!cur._enabled || cur._disposed) return false; cur = cur._parent; }
      return true;
    }
    computeWorldMatrix() {
      Matrix.ComposeToRef(this.scaling, this.rotationQuaternion, this.rotation, this.position, this._localMat);
      if (this._parent) {
        this._parent.computeWorldMatrix();
        Matrix.MultiplyToRef(this._parent._worldMat, this._localMat, this._worldMat);
      } else {
        this._worldMat.m.set(this._localMat.m);
      }
      return this._worldMat;
    }
    dispose() {
      this._disposed = true;
      if (this._children) {
        for (const c of this._children.slice()) c.dispose();
      }
      if (this.scene && this.scene.meshes) {
        const i = this.scene.meshes.indexOf(this);
        if (i >= 0) this.scene.meshes.splice(i, 1);
      }
    }
  }

  class VertexData {
    constructor() {
      this.positions = null;
      this.normals = null;
      this.uvs = null;
      this.colors = null;
      this.indices = null;
    }
    applyToMesh(mesh) {
      mesh._setGeometry(this);
    }
  }

  class Mesh extends TransformNode {
    constructor(name, scene) {
      super(name, scene);
      this.isVisible = true;
      this.isPickable = true;
      this.alwaysSelectAsActiveMesh = false;
      this.renderingGroupId = 0;
      this.material = null;
      this._isLine = false;
      this._posBuf = null;
      this._norBuf = null;
      this._uvBuf = null;
      this._colBuf = null;
      this._idxBuf = null;
      this._idxCount = 0;
      this._idxType = 0;
      this._vertCount = 0;
      this.thinInstanceCount = 0;
      this._thinBuffers = {};
      this._thinGlBuffers = {};
      if (scene && scene.meshes) scene.meshes.push(this);
    }
    _setGeometry(vd) {
      const gl = this.scene && this.scene.engine && this.scene.engine.gl;
      this._vd = vd;
      if (!gl) return;
      if (vd.positions) {
        const arr = vd.positions instanceof Float32Array ? vd.positions : new Float32Array(vd.positions);
        this._vertCount = arr.length / 3;
        this._posBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
      }
      if (vd.normals) {
        const arr = vd.normals instanceof Float32Array ? vd.normals : new Float32Array(vd.normals);
        this._norBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._norBuf);
        gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      }
      if (vd.uvs) {
        const arr = vd.uvs instanceof Float32Array ? vd.uvs : new Float32Array(vd.uvs);
        this._uvBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._uvBuf);
        gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      }
      if (vd.colors) {
        const arr = vd.colors instanceof Float32Array ? vd.colors : new Float32Array(vd.colors);
        this._colBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._colBuf);
        gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      }
      if (vd.indices) {
        const use32 = this.scene.engine.isWebGL2 || this.scene.engine.extUint;
        const arr = use32
          ? (vd.indices instanceof Uint32Array ? vd.indices : new Uint32Array(vd.indices))
          : (vd.indices instanceof Uint16Array ? vd.indices : new Uint16Array(vd.indices));
        this._idxCount = arr.length;
        this._idxType = use32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
        this._idxBuf = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._idxBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      }
    }
    updateVerticesData(kind, data) {
      const gl = this.scene && this.scene.engine && this.scene.engine.gl;
      if (!gl) return;
      if (kind === VertexBuffer.PositionKind && this._posBuf) {
        const arr = data instanceof Float32Array ? data : new Float32Array(data);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._posBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, arr);
      }
    }
    thinInstanceSetBuffer(kind, buffer, stride) {
      this._thinBuffers[kind] = { buffer, stride: stride || 16 };
      const gl = this.scene && this.scene.engine && this.scene.engine.gl;
      if (gl && buffer) {
        if (!this._thinGlBuffers[kind]) this._thinGlBuffers[kind] = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._thinGlBuffers[kind]);
        gl.bufferData(gl.ARRAY_BUFFER, buffer, gl.DYNAMIC_DRAW);
      }
    }
    thinInstanceBufferUpdated(kind) {
      const gl = this.scene && this.scene.engine && this.scene.engine.gl;
      const tb = this._thinBuffers[kind];
      const gb = this._thinGlBuffers[kind];
      if (gl && tb && tb.buffer && gb) {
        gl.bindBuffer(gl.ARRAY_BUFFER, gb);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, tb.buffer);
      }
    }
    _render(gl, scene, viewMat, projMat, vpMat, cam) {
      if (!this.isEnabled() || !this._posBuf) return;
      const worldMat = this.computeWorldMatrix();
      if (this._isLine) {
        this._renderLines(gl, scene, worldMat, vpMat);
        return;
      }
      const mat = this.material;
      if (!mat) return;
      if (mat instanceof ShaderMaterial) {
        this._renderShaderMat(gl, scene, mat, worldMat, viewMat, projMat, vpMat);
      } else {
        this._renderStdMat(gl, scene, mat, worldMat, vpMat, cam);
      }
    }
    _renderLines(gl, scene, worldMat, vpMat) {
      if (!scene._lineProg) {
        scene._lineProg = compileProgram(gl, scene.engine.isWebGL2, LINE_VS, LINE_FS);
      }
      const prog = scene._lineProg;
      gl.useProgram(prog);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'world'), false, worldMat.m);
      gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'viewProjection'), false, vpMat.m);
      const pLoc = gl.getAttribLocation(prog, 'position');
      if (pLoc >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this._posBuf);
        gl.enableVertexAttribArray(pLoc);
        gl.vertexAttribPointer(pLoc, 3, gl.FLOAT, false, 0, 0);
      }
      const cLoc = gl.getAttribLocation(prog, 'color');
      if (cLoc >= 0 && this._colBuf) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this._colBuf);
        gl.enableVertexAttribArray(cLoc);
        gl.vertexAttribPointer(cLoc, 4, gl.FLOAT, false, 0, 0);
      }
      gl.drawArrays(gl.LINES, 0, this._vertCount);
      if (cLoc >= 0) gl.disableVertexAttribArray(cLoc);
    }
    _renderShaderMat(gl, scene, mat, worldMat, viewMat, projMat, vpMat) {
      if (this._thinBuffers.matrix && this.thinInstanceCount <= 0) return;
      const prog = mat._getProgram(gl, scene.engine.isWebGL2);
      gl.useProgram(prog);
      if (mat.backFaceCulling) { gl.enable(gl.CULL_FACE); } else { gl.disable(gl.CULL_FACE); }
      gl.depthMask(!mat.disableDepthWrite);
      if (mat.needAlphaBlending) {
        gl.enable(gl.BLEND);
        if (mat.alphaMode === Constants.ALPHA_ONEONE) gl.blendFunc(gl.ONE, gl.ONE);
        else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      } else {
        gl.disable(gl.BLEND);
      }

      const lWorld = mat._loc(gl, prog, 'world'); if (lWorld) gl.uniformMatrix4fv(lWorld, false, worldMat.m);
      const lView = mat._loc(gl, prog, 'view'); if (lView) gl.uniformMatrix4fv(lView, false, viewMat.m);
      const lProj = mat._loc(gl, prog, 'projection'); if (lProj) gl.uniformMatrix4fv(lProj, false, projMat.m);
      const lVP = mat._loc(gl, prog, 'viewProjection'); if (lVP) gl.uniformMatrix4fv(lVP, false, vpMat.m);
      const lWVP = mat._loc(gl, prog, 'worldViewProjection');
      if (lWVP) {
        const wvp = new Matrix(); Matrix.MultiplyToRef(vpMat, worldMat, wvp);
        gl.uniformMatrix4fv(lWVP, false, wvp.m);
      }

      for (const k in mat._floats) {
        const l = mat._loc(gl, prog, k); if (l) gl.uniform1f(l, mat._floats[k]);
      }
      for (const k in mat._vec3s) {
        const l = mat._loc(gl, prog, k), v = mat._vec3s[k]; if (l && v) gl.uniform3f(l, v.x, v.y, v.z);
      }
      for (const k in mat._vec4s) {
        const l = mat._loc(gl, prog, k), v = mat._vec4s[k]; if (l && v) gl.uniform4f(l, v.x, v.y, v.z, v.w);
      }
      let texUnit = 0;
      for (const k in mat._textures) {
        const t = mat._textures[k], l = mat._loc(gl, prog, k);
        if (t && t._glTex && l) {
          gl.activeTexture(gl.TEXTURE0 + texUnit);
          gl.bindTexture(gl.TEXTURE_2D, t._glTex);
          gl.uniform1i(l, texUnit);
          texUnit++;
        }
      }

      const pLoc = gl.getAttribLocation(prog, 'position');
      if (pLoc >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this._posBuf);
        gl.enableVertexAttribArray(pLoc);
        gl.vertexAttribPointer(pLoc, 3, gl.FLOAT, false, 0, 0);
      }
      const nLoc = gl.getAttribLocation(prog, 'normal');
      if (nLoc >= 0 && this._norBuf) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this._norBuf);
        gl.enableVertexAttribArray(nLoc);
        gl.vertexAttribPointer(nLoc, 3, gl.FLOAT, false, 0, 0);
      }
      const uLoc = gl.getAttribLocation(prog, 'uv');
      if (uLoc >= 0 && this._uvBuf) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this._uvBuf);
        gl.enableVertexAttribArray(uLoc);
        gl.vertexAttribPointer(uLoc, 2, gl.FLOAT, false, 0, 0);
      }

      // Thin instances
      if (this._thinBuffers.matrix && this.thinInstanceCount > 0) {
        const isW2 = scene.engine.isWebGL2;
        const ext = scene.engine.extInst;
        const setDiv = (loc, d) => { if (loc < 0) return; if (isW2) gl.vertexAttribDivisor(loc, d); else if (ext) ext.vertexAttribDivisorANGLE(loc, d); };
        const matBuf = this._thinGlBuffers.matrix;
        const colBuf = this._thinGlBuffers.instanceColor;
        const wLocs = [
          gl.getAttribLocation(prog, 'world0'),
          gl.getAttribLocation(prog, 'world1'),
          gl.getAttribLocation(prog, 'world2'),
          gl.getAttribLocation(prog, 'world3')
        ];
        const cLoc = gl.getAttribLocation(prog, 'instanceColor');
        if ((isW2 || ext) && matBuf && wLocs[0] >= 0) {
          gl.bindBuffer(gl.ARRAY_BUFFER, matBuf);
          for (let i = 0; i < 4; i++) {
            if (wLocs[i] >= 0) {
              gl.enableVertexAttribArray(wLocs[i]);
              gl.vertexAttribPointer(wLocs[i], 4, gl.FLOAT, false, 64, i * 16);
              setDiv(wLocs[i], 1);
            }
          }
          if (cLoc >= 0 && colBuf) {
            gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
            gl.enableVertexAttribArray(cLoc);
            gl.vertexAttribPointer(cLoc, 4, gl.FLOAT, false, 16, 0);
            setDiv(cLoc, 1);
          }
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._idxBuf);
          if (isW2) gl.drawElementsInstanced(gl.TRIANGLES, this._idxCount, this._idxType, 0, this.thinInstanceCount);
          else ext.drawElementsInstancedANGLE(gl.TRIANGLES, this._idxCount, this._idxType, 0, this.thinInstanceCount);
          for (let i = 0; i < 4; i++) if (wLocs[i] >= 0) { setDiv(wLocs[i], 0); gl.disableVertexAttribArray(wLocs[i]); }
          if (cLoc >= 0) { setDiv(cLoc, 0); gl.disableVertexAttribArray(cLoc); }
        } else {
          // Fallback non-instanced loop if instancing extension unavailable
          const mats = this._thinBuffers.matrix.buffer;
          const cols = this._thinBuffers.instanceColor ? this._thinBuffers.instanceColor.buffer : null;
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._idxBuf);
          for (let n = 0; n < this.thinInstanceCount; n++) {
            const b = n * 16;
            for (let i = 0; i < 4; i++) {
              if (wLocs[i] >= 0) gl.vertexAttrib4f(wLocs[i], mats[b + i * 4], mats[b + i * 4 + 1], mats[b + i * 4 + 2], mats[b + i * 4 + 3]);
            }
            if (cLoc >= 0 && cols) gl.vertexAttrib4f(cLoc, cols[n * 4], cols[n * 4 + 1], cols[n * 4 + 2], cols[n * 4 + 3]);
            gl.drawElements(gl.TRIANGLES, this._idxCount, this._idxType, 0);
          }
        }
      } else if (this._idxBuf) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._idxBuf);
        gl.drawElements(gl.TRIANGLES, this._idxCount, this._idxType, 0);
      }
      if (nLoc >= 0) gl.disableVertexAttribArray(nLoc);
      if (uLoc >= 0) gl.disableVertexAttribArray(uLoc);
    }
    _renderStdMat(gl, scene, mat, worldMat, vpMat, cam) {
      if (!scene._stdProg) {
        scene._stdProg = compileProgram(gl, scene.engine.isWebGL2, STD_VS, STD_FS);
      }
      const prog = scene._stdProg;
      gl.useProgram(prog);
      if (mat.backFaceCulling) gl.enable(gl.CULL_FACE); else gl.disable(gl.CULL_FACE);
      if (mat.needAlphaBlending) {
        gl.enable(gl.BLEND);
        if (mat.alphaMode === Constants.ALPHA_ONEONE) gl.blendFunc(gl.ONE, gl.ONE);
        else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
      } else {
        gl.disable(gl.BLEND);
        gl.depthMask(true);
      }

      gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'world'), false, worldMat.m);
      gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'viewProjection'), false, vpMat.m);
      gl.uniform3f(gl.getUniformLocation(prog, 'uDiffuse'), mat.diffuseColor.r, mat.diffuseColor.g, mat.diffuseColor.b);
      gl.uniform3f(gl.getUniformLocation(prog, 'uEmissive'), mat.emissiveColor.r, mat.emissiveColor.g, mat.emissiveColor.b);
      gl.uniform3f(gl.getUniformLocation(prog, 'uSpecular'), mat.specularColor.r, mat.specularColor.g, mat.specularColor.b);
      gl.uniform1f(gl.getUniformLocation(prog, 'uSpecPow'), mat.specularPower || 32);
      gl.uniform1f(gl.getUniformLocation(prog, 'uAlpha'), mat.alpha === undefined ? 1.0 : mat.alpha);
      gl.uniform1f(gl.getUniformLocation(prog, 'uUnlit'), mat.disableLighting ? 1.0 : 0.0);
      gl.uniform3f(gl.getUniformLocation(prog, 'uCamPos'), cam.position.x, cam.position.y, cam.position.z);

      let sunDir = { x: 0, y: -1, z: 0 }, sunCol = { r: 1, g: 0.85, b: 0.65 };
      let hemiSky = { r: 0.35, g: 0.45, b: 0.7 }, hemiGnd = { r: 0.08, g: 0.09, b: 0.14 };
      for (const l of scene.lights) {
        if (l.type === 'dir') {
          sunDir = l.direction;
          sunCol = { r: l.diffuse.r * l.intensity, g: l.diffuse.g * l.intensity, b: l.diffuse.b * l.intensity };
        } else if (l.type === 'hemi') {
          hemiSky = { r: l.diffuse.r * l.intensity, g: l.diffuse.g * l.intensity, b: l.diffuse.b * l.intensity };
          hemiGnd = { r: l.groundColor.r * l.intensity, g: l.groundColor.g * l.intensity, b: l.groundColor.b * l.intensity };
        }
      }
      gl.uniform3f(gl.getUniformLocation(prog, 'uSunDir'), sunDir.x, sunDir.y, sunDir.z);
      gl.uniform1f(gl.getUniformLocation(prog, 'uExposure'), window.__BH_EXPO.value);
      gl.uniform3f(gl.getUniformLocation(prog, 'uSunCol'), sunCol.r, sunCol.g, sunCol.b);
      gl.uniform3f(gl.getUniformLocation(prog, 'uHemiSky'), hemiSky.r, hemiSky.g, hemiSky.b);
      gl.uniform3f(gl.getUniformLocation(prog, 'uHemiGnd'), hemiGnd.r, hemiGnd.g, hemiGnd.b);

      const pLoc = gl.getAttribLocation(prog, 'position');
      if (pLoc >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this._posBuf);
        gl.enableVertexAttribArray(pLoc);
        gl.vertexAttribPointer(pLoc, 3, gl.FLOAT, false, 0, 0);
      }
      const nLoc = gl.getAttribLocation(prog, 'normal');
      if (nLoc >= 0 && this._norBuf) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this._norBuf);
        gl.enableVertexAttribArray(nLoc);
        gl.vertexAttribPointer(nLoc, 3, gl.FLOAT, false, 0, 0);
      }
      if (this._idxBuf) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._idxBuf);
        gl.drawElements(mat.wireframe ? gl.LINES : gl.TRIANGLES, this._idxCount, this._idxType, 0);
      }
      if (nLoc >= 0) gl.disableVertexAttribArray(nLoc);
    }
  }

  const MeshBuilder = {
    CreatePlane(name, opts = {}, scene) {
      const w = (opts.width || opts.size || 1) * 0.5;
      const h = (opts.height || opts.size || 1) * 0.5;
      const vd = new VertexData();
      vd.positions = [-w, -h, 0,  w, -h, 0,  w, h, 0,  -w, h, 0];
      vd.normals = [0, 0, -1,  0, 0, -1,  0, 0, -1,  0, 0, -1];
      vd.uvs = [0, 0,  1, 0,  1, 1,  0, 1];
      vd.indices = [0, 1, 2,  0, 2, 3];
      const m = new Mesh(name, scene);
      vd.applyToMesh(m);
      return m;
    },
    CreateDisc(name, opts = {}, scene) {
      const r = opts.radius || 1;
      const tess = opts.tessellation || 32;
      const pos = [0, 0, 0], nor = [0, 1, 0], uvs = [0.5, 0.5], idx = [];
      for (let i = 0; i <= tess; i++) {
        const a = (i / tess) * Math.PI * 2;
        const c = Math.cos(a), s = Math.sin(a);
        pos.push(c * r, 0, s * r);
        nor.push(0, 1, 0);
        uvs.push(0.5 + 0.5 * c, 0.5 + 0.5 * s);
        if (i < tess) idx.push(0, i + 1, i + 2);
      }
      const vd = new VertexData();
      vd.positions = pos; vd.normals = nor; vd.uvs = uvs; vd.indices = idx;
      const m = new Mesh(name, scene); vd.applyToMesh(m); return m;
    },
    CreateSphere(name, opts = {}, scene) {
      const rad = (opts.diameter || 1) * 0.5;
      const rx = opts.diameterX ? opts.diameterX * 0.5 : rad;
      const ry = opts.diameterY ? opts.diameterY * 0.5 : rad;
      const rz = opts.diameterZ ? opts.diameterZ * 0.5 : rad;
      const segs = Math.max(4, opts.segments || 16);
      const pos = [], nor = [], uvs = [], idx = [];
      for (let y = 0; y <= segs; y++) {
        const v = y / segs, phi = v * Math.PI;
        const sp = Math.sin(phi), cp = Math.cos(phi);
        for (let x = 0; x <= segs; x++) {
          const u = x / segs, th = u * Math.PI * 2;
          const nx = sp * Math.cos(th), ny = cp, nz = sp * Math.sin(th);
          pos.push(nx * rx, ny * ry, nz * rz);
          nor.push(nx, ny, nz);
          uvs.push(u, 1 - v);
        }
      }
      for (let y = 0; y < segs; y++) {
        for (let x = 0; x < segs; x++) {
          const i0 = y * (segs + 1) + x, i1 = i0 + 1, i2 = i0 + (segs + 1), i3 = i2 + 1;
          idx.push(i0, i2, i1, i1, i2, i3);
        }
      }
      const vd = new VertexData();
      vd.positions = pos; vd.normals = nor; vd.uvs = uvs; vd.indices = idx;
      const m = new Mesh(name, scene); vd.applyToMesh(m); return m;
    },
    CreateBox(name, opts = {}, scene) {
      const s = opts.size || 1;
      const wx = (opts.width || s) * 0.5, hy = (opts.height || s) * 0.5, dz = (opts.depth || s) * 0.5;
      const faces = [
        { n: [0, 0, 1],  v: [[-wx,-hy,dz],[wx,-hy,dz],[wx,hy,dz],[-wx,hy,dz]] },
        { n: [0, 0, -1], v: [[wx,-hy,-dz],[-wx,-hy,-dz],[-wx,hy,-dz],[wx,hy,-dz]] },
        { n: [0, 1, 0],  v: [[-wx,hy,dz],[wx,hy,dz],[wx,hy,-dz],[-wx,hy,-dz]] },
        { n: [0, -1, 0], v: [[-wx,-hy,-dz],[wx,-hy,-dz],[wx,-hy,dz],[-wx,-hy,dz]] },
        { n: [1, 0, 0],  v: [[wx,-hy,dz],[wx,-hy,-dz],[wx,hy,-dz],[wx,hy,dz]] },
        { n: [-1, 0, 0], v: [[-wx,-hy,-dz],[-wx,-hy,dz],[-wx,hy,dz],[-wx,hy,-dz]] }
      ];
      const pos = [], nor = [], uvs = [], idx = [];
      faces.forEach((f, fi) => {
        const b = fi * 4;
        for (let k = 0; k < 4; k++) {
          pos.push(f.v[k][0], f.v[k][1], f.v[k][2]);
          nor.push(f.n[0], f.n[1], f.n[2]);
        }
        uvs.push(0,0, 1,0, 1,1, 0,1);
        idx.push(b, b+1, b+2, b, b+2, b+3);
      });
      const vd = new VertexData();
      vd.positions = pos; vd.normals = nor; vd.uvs = uvs; vd.indices = idx;
      const m = new Mesh(name, scene); vd.applyToMesh(m); return m;
    },
    CreateCylinder(name, opts = {}, scene) {
      const h = (opts.height || 2) * 0.5;
      const rt = (opts.diameterTop !== undefined ? opts.diameterTop : (opts.diameter || 1)) * 0.5;
      const rb = (opts.diameterBottom !== undefined ? opts.diameterBottom : (opts.diameter || 1)) * 0.5;
      const tess = Math.max(4, opts.tessellation || 16);
      const pos = [], nor = [], uvs = [], idx = [];
      for (let i = 0; i <= tess; i++) {
        const u = i / tess, a = u * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        pos.push(c * rt, h, s * rt, c * rb, -h, s * rb);
        nor.push(c, 0, s, c, 0, s);
        uvs.push(u, 1, u, 0);
        if (i < tess) {
          const b = i * 2;
          idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        }
      }
      const vd = new VertexData();
      vd.positions = pos; vd.normals = nor; vd.uvs = uvs; vd.indices = idx;
      const m = new Mesh(name, scene); vd.applyToMesh(m); return m;
    },
    CreateTorus(name, opts = {}, scene) {
      const R = (opts.diameter || 1) * 0.5;
      const r = (opts.thickness || 0.2) * 0.5;
      const tess = Math.max(8, opts.tessellation || 24);
      const segs = 12;
      const pos = [], nor = [], uvs = [], idx = [];
      for (let i = 0; i <= tess; i++) {
        const u = i / tess, th = u * Math.PI * 2, ct = Math.cos(th), st = Math.sin(th);
        for (let j = 0; j <= segs; j++) {
          const v = j / segs, ph = v * Math.PI * 2, cp = Math.cos(ph), sp = Math.sin(ph);
          const nx = ct * cp, ny = sp, nz = st * cp;
          pos.push((R + r * cp) * ct, r * sp, (R + r * cp) * st);
          nor.push(nx, ny, nz);
          uvs.push(u, v);
        }
      }
      for (let i = 0; i < tess; i++) {
        for (let j = 0; j < segs; j++) {
          const i0 = i * (segs + 1) + j, i1 = i0 + 1, i2 = i0 + (segs + 1), i3 = i2 + 1;
          idx.push(i0, i2, i1, i1, i2, i3);
        }
      }
      const vd = new VertexData();
      vd.positions = pos; vd.normals = nor; vd.uvs = uvs; vd.indices = idx;
      const m = new Mesh(name, scene); vd.applyToMesh(m); return m;
    },
    CreateLineSystem(name, opts = {}, scene) {
      const lines = opts.lines || [];
      const colors = opts.colors || [];
      const pos = [], col = [];
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i], cl = colors[i];
        for (let j = 0; j < ln.length - 1; j++) {
          const p0 = ln[j], p1 = ln[j + 1];
          pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
          const c0 = (cl && cl[j]) || { r: 1, g: 1, b: 1, a: 1 };
          const c1 = (cl && cl[j + 1]) || c0;
          col.push(c0.r, c0.g, c0.b, c0.a === undefined ? 1 : c0.a, c1.r, c1.g, c1.b, c1.a === undefined ? 1 : c1.a);
        }
      }
      const vd = new VertexData();
      vd.positions = new Float32Array(pos);
      vd.colors = new Float32Array(col);
      const m = new Mesh(name, scene);
      m._isLine = true;
      vd.applyToMesh(m);
      return m;
    }
  };

  global.BABYLON = {
    Constants, Vector3, Quaternion, Color3, Color4, Matrix, Effect, VertexBuffer,
    Engine, Scene, UniversalCamera, DirectionalLight, HemisphericLight, PointLight,
    RawTexture, ShaderMaterial, StandardMaterial, TransformNode, VertexData, Mesh, MeshBuilder
  };
})(typeof window !== 'undefined' ? window : globalThis);

const Game = {};

// ---------------------------------------------------------------------------
// SECTION: UNITS & NAMING — doc §4. No compiler, so this is documentation +
// naming discipline instead of branded types.
// ---------------------------------------------------------------------------
/**
 * @typedef {number} Meters
 * @typedef {number} MetersPerSecond
 * @typedef {number} MetersPerSecondSquared
 * @typedef {number} Seconds
 * @typedef {number} AstronomicalUnits
 * @typedef {number} Kilograms
 * Naming rule (doc §4.3): suffix ambiguous physics quantities with their unit —
 * positionMeters, velocityMps, accelerationMps2, semiMajorAxisAU, physicalRadiusMeters.
 */

// ---------------------------------------------------------------------------
// SECTION: AUTHORITATIVE CONSTANTS — doc §5, transcribed verbatim (values only;
// TS type annotations dropped). Verified against the doc's own §5.1/§5.2 tables
// in Node before this file was written — see build notes.
// ---------------------------------------------------------------------------
Game.Constants = (function () {
  const G = 6.67430e-11;
  const C = 299792458;
  const SOLAR_MASS = 1.98847e30;
  const SOLAR_LUMINOSITY = 3.828e26;
  const AU = 1.495978707e11;
  const DAY = 86400;
  const JULIAN_YEAR = 365.25 * DAY;

  const BH_MASS_SOLAR = 10000;
  const BH_MASS = BH_MASS_SOLAR * SOLAR_MASS;
  const BH_MU = G * BH_MASS;
  const BH_RS = (2 * BH_MU) / (C * C);

  const BH_EVENT_HORIZON_RADIUS = BH_RS;
  const BH_PHOTON_SPHERE_RADIUS = 1.5 * BH_RS;
  const BH_SHADOW_RADIUS = Math.sqrt(27) * 0.5 * BH_RS;
  const BH_ISCO_RADIUS = 3 * BH_RS;
  const BH_CAPTURE_RADIUS = 1.02 * BH_RS;

  const PHYSICS_DT = 1 / 120;
  const MAX_PHYSICS_STEPS_PER_RENDER = 8;
  const MAX_ACCEPTED_FRAME_DT = 0.10;

  const ENCOUNTER_ACTIVATION_RADIUS_M = 12000 * 1000;
  const COMBAT_BUBBLE_RADIUS_M = 8000 * 1000; // 8,000 km
  const ENCOUNTER_DEACTIVATION_RADIUS_M = 16000 * 1000;
  const REANCHOR_THRESHOLD_M = 50000;

  const SHIP_ACCEL_FWD = 5000;
  const SHIP_ACCEL_REV = 3500;
  const SHIP_ACCEL_LAT = 2800;
  const SHIP_ACCEL_VERTICAL = 2800; // doc \u00a717.1: listed separately from lateral even though same magnitude
  const SHIP_CRUISE_MAX = 0.02 * C;
  const SHIP_INTERCEPT_MAX = 0.05 * C;
  const SHIP_MAX_PITCH_RATE_RAD = (75 * Math.PI) / 180; // doc \u00a717.5 suggested max rates
  const SHIP_MAX_YAW_RATE_RAD = (62 * Math.PI) / 180;
  const SHIP_MAX_ROLL_RATE_RAD = (105 * Math.PI) / 180;

  /** @param {Meters} rMeters @returns {MetersPerSecond} */
  function circularOrbitalVelocity(rMeters) {
    if (!(rMeters > 0)) throw new RangeError("radius must be > 0");
    return Math.sqrt(BH_MU / rMeters);
  }
  /** @param {Meters} rMeters @returns {Seconds} */
  function circularOrbitalPeriod(rMeters) {
    if (!(rMeters > 0)) throw new RangeError("radius must be > 0");
    return 2 * Math.PI * Math.sqrt(Math.pow(rMeters, 3) / BH_MU);
  }

  return {
    G, C, SOLAR_MASS, SOLAR_LUMINOSITY, AU, DAY, JULIAN_YEAR,
    BH_MASS_SOLAR, BH_MASS, BH_MU, BH_RS,
    BH_EVENT_HORIZON_RADIUS, BH_PHOTON_SPHERE_RADIUS, BH_SHADOW_RADIUS, BH_ISCO_RADIUS, BH_CAPTURE_RADIUS,
    PHYSICS_DT, MAX_PHYSICS_STEPS_PER_RENDER, MAX_ACCEPTED_FRAME_DT,
    ENCOUNTER_ACTIVATION_RADIUS_M, COMBAT_BUBBLE_RADIUS_M, ENCOUNTER_DEACTIVATION_RADIUS_M, REANCHOR_THRESHOLD_M,
    SHIP_ACCEL_FWD, SHIP_ACCEL_REV, SHIP_ACCEL_LAT, SHIP_ACCEL_VERTICAL, SHIP_CRUISE_MAX, SHIP_INTERCEPT_MAX,
    SHIP_MAX_PITCH_RATE_RAD, SHIP_MAX_YAW_RATE_RAD, SHIP_MAX_ROLL_RATE_RAD,
    circularOrbitalVelocity, circularOrbitalPeriod,
  };
})();

// ---------------------------------------------------------------------------
// SECTION: VEC3 — allocation-free vector core, doc §64.2 verbatim. Vec3d
// itself is a plain {x,y,z} object (doc §6.2), not a class — operations are
// pure functions that write into an `out` param to avoid per-frame garbage.
// ---------------------------------------------------------------------------
Game.Vec3 = (function () {
  function v3(x, y, z) { return { x: x || 0, y: y || 0, z: z || 0 }; }
  function set(out, x, y, z) { out.x = x; out.y = y; out.z = z; return out; }
  function copy(out, a) { out.x = a.x; out.y = a.y; out.z = a.z; return out; }
  function add(out, a, b) { out.x = a.x + b.x; out.y = a.y + b.y; out.z = a.z + b.z; return out; }
  function sub(out, a, b) { out.x = a.x - b.x; out.y = a.y - b.y; out.z = a.z - b.z; return out; }
  function addScaled(out, a, b, s) { out.x = a.x + b.x * s; out.y = a.y + b.y * s; out.z = a.z + b.z * s; return out; }
  function scale(out, a, s) { out.x = a.x * s; out.y = a.y * s; out.z = a.z * s; return out; }
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function lengthSq(a) { return dot(a, a); }
  function length(a) { return Math.sqrt(lengthSq(a)); }
  function cross(out, a, b) {
    const x = a.y * b.z - a.z * b.y;
    const y = a.z * b.x - a.x * b.z;
    const z = a.x * b.y - a.y * b.x;
    return set(out, x, y, z);
  }
  function normalize(out, a) {
    const l2 = lengthSq(a);
    if (!(l2 > 0)) return false;
    const inv = 1 / Math.sqrt(l2);
    set(out, a.x * inv, a.y * inv, a.z * inv);
    return true;
  }
  return { v3, set, copy, add, sub, addScaled, scale, dot, lengthSq, length, cross, normalize };
})();

// ---------------------------------------------------------------------------
// SECTION: QUAT — engine-independent quaternion math, Stage B item 9. Not
// given verbatim in the doc (only Vec3d was); standard textbook formulas,
// same allocation-free out-param style as Vec3. Converts to BABYLON.Quaternion
// only at the render boundary, mirroring §6.6's rule for positions.
// ---------------------------------------------------------------------------
Game.Quat = (function () {
  function qIdentity(out) { out.x = 0; out.y = 0; out.z = 0; out.w = 1; return out; }
  function qFromAxisAngle(out, axis, angleRadians) {
    const al = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
    const inv = al > 0 ? 1 / al : 0;
    const half = angleRadians * 0.5;
    const s = Math.sin(half);
    out.x = axis.x * inv * s; out.y = axis.y * inv * s; out.z = axis.z * inv * s;
    out.w = Math.cos(half);
    return out;
  }
  function qMultiply(out, a, b) {
    const x = a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y;
    const y = a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x;
    const z = a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w;
    const w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z;
    out.x = x; out.y = y; out.z = z; out.w = w;
    return out;
  }
  function qLengthSq(a) { return a.x * a.x + a.y * a.y + a.z * a.z + a.w * a.w; }
  function qNormalize(out, a) {
    const l2 = qLengthSq(a);
    if (!(l2 > 0)) return qIdentity(out);
    const inv = 1 / Math.sqrt(l2);
    out.x = a.x * inv; out.y = a.y * inv; out.z = a.z * inv; out.w = a.w * inv;
    return out;
  }
  function qConjugate(out, a) { out.x = -a.x; out.y = -a.y; out.z = -a.z; out.w = a.w; return out; }
  // v' = v + w*(2*qv x v) + (2*qv x (qv x v)) -- optimized rotation, no full quaternion multiply.
  function qRotateVector(out, q, v) {
    const tx = 2 * (q.y * v.z - q.z * v.y);
    const ty = 2 * (q.z * v.x - q.x * v.z);
    const tz = 2 * (q.x * v.y - q.y * v.x);
    out.x = v.x + q.w * tx + (q.y * tz - q.z * ty);
    out.y = v.y + q.w * ty + (q.z * tx - q.x * tz);
    out.z = v.z + q.w * tz + (q.x * ty - q.y * tx);
    return out;
  }
  function qSlerp(out, a, b, t) {
    let bx = b.x, by = b.y, bz = b.z, bw = b.w;
    let cosom = a.x * bx + a.y * by + a.z * bz + a.w * bw;
    if (cosom < 0) { cosom = -cosom; bx = -bx; by = -by; bz = -bz; bw = -bw; }
    let s0, s1;
    if (1 - cosom > 1e-8) {
      const omega = Math.acos(cosom), sinom = Math.sin(omega);
      s0 = Math.sin((1 - t) * omega) / sinom; s1 = Math.sin(t * omega) / sinom;
    } else {
      s0 = 1 - t; s1 = t; // nearly-coincident endpoints: linear interp avoids a 0/0 divide.
    }
    out.x = s0 * a.x + s1 * bx; out.y = s0 * a.y + s1 * by; out.z = s0 * a.z + s1 * bz; out.w = s0 * a.w + s1 * bw;
    return qNormalize(out, out);
  }
  // Rotation taking local axes to the given world basis (right, up, forward are orthonormal world vectors).
  function qFromBasis(out, r, u, f) {
    const m00 = r.x, m01 = u.x, m02 = f.x, m10 = r.y, m11 = u.y, m12 = f.y, m20 = r.z, m21 = u.z, m22 = f.z;
    const tr = m00 + m11 + m22;
    let x, y, z, w, s;
    if (tr > 0) { s = Math.sqrt(tr + 1) * 2; w = 0.25 * s; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s; }
    else if (m00 > m11 && m00 > m22) { s = Math.sqrt(1 + m00 - m11 - m22) * 2; w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s; }
    else if (m11 > m22) { s = Math.sqrt(1 + m11 - m00 - m22) * 2; w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s; }
    else { s = Math.sqrt(1 + m22 - m00 - m11) * 2; w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s; }
    out.x = x; out.y = y; out.z = z; out.w = w;
    return qNormalize(out, out);
  }
  return { qIdentity, qFromAxisAngle, qMultiply, qNormalize, qConjugate, qRotateVector, qSlerp, qLengthSq, qFromBasis };
})();

// ---------------------------------------------------------------------------
// SECTION: ORBITS — doc §9 (elements + update policy) using the §64.3 Kepler
// solver (Halley + bounded bisection), which supersedes §9.2's plain-Newton
// version per the §51.2 consensus matrix (see header note).
// ---------------------------------------------------------------------------
Game.Orbits = (function () {
  const TWO_PI = Math.PI * 2;
  function wrapPi(x) {
    let v = x % TWO_PI;
    if (v > Math.PI) v -= TWO_PI;
    if (v < -Math.PI) v += TWO_PI;
    return v;
  }
  function solveKepler(Mraw, e) {
    if (!(e >= 0 && e < 1)) throw new RangeError("e=" + e + " outside elliptic V1 range");
    const M = wrapPi(Mraw);
    if (e === 0) return M;
    let E = e < 0.8 ? M : Math.PI * Math.sign(M || 1);
    for (let i = 0; i < 12; i++) {
      const s = Math.sin(E), c = Math.cos(E);
      const f = E - e * s - M;
      const fp = 1 - e * c;
      const fpp = e * s;
      const denom = 2 * fp * fp - f * fpp;
      const dE = Math.abs(denom) > 1e-15 ? (2 * f * fp) / denom : f / fp;
      E -= dE;
      if (Math.abs(dE) < 1e-13) return E;
    }
    let lo = -Math.PI, hi = Math.PI; // monotonic bisection fallback
    for (let i = 0; i < 80; i++) {
      const mid = 0.5 * (lo + hi);
      const f = mid - e * Math.sin(mid) - M;
      if (f > 0) hi = mid; else lo = mid;
    }
    return 0.5 * (lo + hi);
  }
  function initializeOrbit(orbit) {
    const a = orbit.semiMajorAxisAU * Game.Constants.AU;
    orbit.semiMajorAxisMeters = a;
    orbit.meanMotion = Math.sqrt(Game.Constants.BH_MU / Math.pow(a, 3));
    orbit.periodSeconds = (2 * Math.PI) / orbit.meanMotion;
    return orbit;
  }
  // Standard Rz(Omega)*Rx(i)*Rz(omega) perifocal -> inertial rotation (Vallado-style
  // closed form), applied directly to components rather than building a matrix object.
  function rotatePerifocalStateToSystem(xP, yP, zP, vxP, vyP, vzP, Omega, inc, omega) {
    const cO = Math.cos(Omega), sO = Math.sin(Omega);
    const ci = Math.cos(inc), si = Math.sin(inc);
    const cw = Math.cos(omega), sw = Math.sin(omega);
    const r11 = cO * cw - sO * sw * ci, r12 = -cO * sw - sO * cw * ci;
    const r21 = sO * cw + cO * sw * ci, r22 = -sO * sw + cO * cw * ci;
    const r31 = sw * si, r32 = cw * si;
    return {
      position: { x: r11 * xP + r12 * yP, y: r21 * xP + r22 * yP, z: r31 * xP + r32 * yP },
      velocity: { x: r11 * vxP + r12 * vyP, y: r21 * vxP + r22 * vyP, z: r31 * vxP + r32 * vyP },
    };
  }
  function orbitalStateAtTime(orbit, tSeconds) {
    const a = orbit.semiMajorAxisMeters, e = orbit.eccentricity, n = orbit.meanMotion;
    const M = orbit.meanAnomalyAtEpochRadians + n * (tSeconds - orbit.epochSeconds);
    const E = solveKepler(M, e);
    const cosE = Math.cos(E), sinE = Math.sin(E);
    const root = Math.sqrt(1 - e * e), denominator = 1 - e * cosE;
    const xP = a * (cosE - e), yP = a * root * sinE;
    const vxP = (-a * n * sinE) / denominator, vyP = (a * n * root * cosE) / denominator;
    return rotatePerifocalStateToSystem(xP, yP, 0, vxP, vyP, 0,
      orbit.longitudeAscendingNodeRadians, orbit.inclinationRadians, orbit.argumentOfPeriapsisRadians);
  }
  return { solveKepler, initializeOrbit, orbitalStateAtTime, rotatePerifocalStateToSystem, wrapPi };
})();

// ---------------------------------------------------------------------------
// SECTION: GRAVITY — doc §11.2 WITH the §51.3 fix applied (see header note):
// no MIN_SAFE_RADIUS clamp. Only a true numerical floor near r=0 survives.
// Includes §12's ship-length tidal stress estimate and §64.4's differential
// gravity (linearized branch for the common case, exact branch as fallback).
// ---------------------------------------------------------------------------
Game.Gravity = (function () {
  const R2_NUMERICAL_FLOOR = 1; // 1 m^2 -- guards literal division blowup only, not a gameplay clamp.
  function gravityAt(position, out) {
    const V = Game.Vec3;
    const r2 = V.lengthSq(position);
    if (!(r2 > R2_NUMERICAL_FLOOR)) return V.set(out, 0, 0, 0);
    const r = Math.sqrt(r2);
    const factor = -Game.Constants.BH_MU / (r2 * r);
    return V.set(out, position.x * factor, position.y * factor, position.z * factor);
  }
  function tidalAccelerationDelta(rMeters, shipLengthMeters) {
    return (2 * Game.Constants.BH_MU * shipLengthMeters) / Math.pow(rMeters, 3);
  }
  const RATIO_LINEAR = 1e-5;
  function differentialGravityLinearized(anchor, anchorAcceleration, local, out, scratchAnchorGravity) {
    const V = Game.Vec3;
    const r = Math.sqrt(V.lengthSq(anchor));
    const invR = 1 / r;
    const nx = anchor.x * invR, ny = anchor.y * invR, nz = anchor.z * invR;
    const projection = nx * local.x + ny * local.y + nz * local.z;
    const k = Game.Constants.BH_MU / (r * r * r);
    const residualX = scratchAnchorGravity.x - anchorAcceleration.x;
    const residualY = scratchAnchorGravity.y - anchorAcceleration.y;
    const residualZ = scratchAnchorGravity.z - anchorAcceleration.z;
    return V.set(out,
      residualX + k * (3 * projection * nx - local.x),
      residualY + k * (3 * projection * ny - local.y),
      residualZ + k * (3 * projection * nz - local.z));
  }
  function differentialGravityExact(anchor, anchorAcceleration, local, out, scratchAbs, scratchAnchorGravity, scratchBodyGravity) {
    const V = Game.Vec3;
    V.add(scratchAbs, anchor, local);
    gravityAt(scratchAbs, scratchBodyGravity);
    gravityAt(anchor, scratchAnchorGravity); // refreshes the cache for subsequent calls this step
    return V.set(out,
      scratchBodyGravity.x - anchorAcceleration.x,
      scratchBodyGravity.y - anchorAcceleration.y,
      scratchBodyGravity.z - anchorAcceleration.z);
  }
  function differentialGravity(anchor, anchorAcceleration, local, out, scratchAbs, scratchAnchorGravity, scratchBodyGravity) {
    const V = Game.Vec3;
    const r2 = V.lengthSq(anchor);
    if (!(r2 > 0)) return V.set(out, 0, 0, 0);
    const d = V.length(local), r = Math.sqrt(r2);
    if (d / r < RATIO_LINEAR) return differentialGravityLinearized(anchor, anchorAcceleration, local, out, scratchAnchorGravity);
    return differentialGravityExact(anchor, anchorAcceleration, local, out, scratchAbs, scratchAnchorGravity, scratchBodyGravity);
  }
  return { gravityAt, tidalAccelerationDelta, differentialGravity, differentialGravityLinearized, differentialGravityExact, RATIO_LINEAR };
})();

// ---------------------------------------------------------------------------
// SECTION: CLOCK — deterministic fixed-step accumulator, doc §64.7 (converted
// from a TS class to a closure factory, consistent with the rest of this file).
// ---------------------------------------------------------------------------
Game.Clock = (function () {
  function createFixedStepClock(fixedDt, maxStepsPerFrame, maxFrameDt) {
    let accumulator = 0, simulationTimeSeconds = 0;
    function advance(realDt, step) {
      const dt = Math.min(Math.max(realDt, 0), maxFrameDt);
      accumulator += dt;
      let steps = 0;
      while (accumulator >= fixedDt && steps < maxStepsPerFrame) {
        step(fixedDt, simulationTimeSeconds);
        simulationTimeSeconds += fixedDt;
        accumulator -= fixedDt;
        steps++;
      }
      if (accumulator >= fixedDt) accumulator %= fixedDt;
      return accumulator / fixedDt;
    }
    return { advance, get timeSeconds() { return simulationTimeSeconds; } };
  }
  return { createFixedStepClock };
})();

// ---------------------------------------------------------------------------
// SECTION: NAV — map compression, doc §7.1. Display-only; must never feed
// physics, AI, collision, radar, or warp-route calculations (doc's own rule).
// ---------------------------------------------------------------------------
Game.Nav = (function () {
  function navCompressAxis(au) {
    const scale = 5, k = 0.1;
    return Math.sign(au) * scale * Math.log10(1 + Math.abs(au) / k);
  }
  function navDecompressAxis(mapUnits) { // inverse of navCompressAxis; not given in the doc, derived here.
    const scale = 5, k = 0.1;
    const sign = Math.sign(mapUnits);
    return sign * (k * (Math.pow(10, Math.abs(mapUnits) / scale) - 1));
  }
  return { navCompressAxis, navDecompressAxis };
})();

// ---------------------------------------------------------------------------
// SECTION: SYSTEM BODIES — example canonical configuration, doc §8.1. Data
// only, used so far just to exercise the Kepler solver with real numbers.
// ---------------------------------------------------------------------------
Game.SystemBodies = [
  { id: "cinder", aAU: 4, e: 0.10, type: "planet" },
  { id: "forge", aAU: 15, e: 0.04, type: "planet" },
  { id: "haven", aAU: 21.5, e: 0.02, type: "planet" },
  { id: "bastion", aAU: 50, e: 0.08, type: "planet" },
  { id: "veil", aAU: 100, e: 0.05, type: "planet" },
  { id: "leviathan", aAU: 300, e: 0.04, type: "gasGiant" },
  { id: "exile", aAU: 1000, e: 0.12, type: "iceGiant" },
  { id: "phantom", aAU: 3000, e: 0.25, type: "dwarf" },
  { id: "companion", aAU: 35, e: 0.10, type: "kDwarf" },
];

// ---------------------------------------------------------------------------
// SECTION: RENDER SNAPSHOT — doc §52.3, verbatim shape. Renderer interpolates
// with one frame-level alpha and must never feed the interpolated value back
// into simulation -- enforced here by `sample` only writing to caller-supplied
// out params, never touching the snapshot's own previous/current fields.
// ---------------------------------------------------------------------------
Game.RenderSnapshot = (function () {
  function create(entityId, positionMeters, orientation) {
    return {
      entityId,
      previousPositionMeters: Game.Vec3.v3(positionMeters.x, positionMeters.y, positionMeters.z),
      currentPositionMeters: Game.Vec3.v3(positionMeters.x, positionMeters.y, positionMeters.z),
      previousOrientation: { x: orientation.x, y: orientation.y, z: orientation.z, w: orientation.w },
      currentOrientation: { x: orientation.x, y: orientation.y, z: orientation.z, w: orientation.w },
      visible: true,
    };
  }
  function commit(snapshot, newPositionMeters, newOrientation) {
    Game.Vec3.copy(snapshot.previousPositionMeters, snapshot.currentPositionMeters);
    Game.Vec3.copy(snapshot.currentPositionMeters, newPositionMeters);
    const po = snapshot.previousOrientation, co = snapshot.currentOrientation;
    po.x = co.x; po.y = co.y; po.z = co.z; po.w = co.w;
    co.x = newOrientation.x; co.y = newOrientation.y; co.z = newOrientation.z; co.w = newOrientation.w;
  }
  function sample(snapshot, alpha, outPosition, outOrientation) {
    const p = snapshot.previousPositionMeters, c = snapshot.currentPositionMeters;
    outPosition.x = p.x + (c.x - p.x) * alpha;
    outPosition.y = p.y + (c.y - p.y) * alpha;
    outPosition.z = p.z + (c.z - p.z) * alpha;
    Game.Quat.qSlerp(outOrientation, snapshot.previousOrientation, snapshot.currentOrientation, alpha);
    return { position: outPosition, orientation: outOrientation };
  }
  // doc §52.6: "newPreviousPosition = oldPreviousPosition - offset", applied to both
  // stored positions so a rebase mid-interpolation never produces a visible jump.
  function rebaseShift(snapshot, offset) {
    snapshot.previousPositionMeters.x -= offset.x; snapshot.previousPositionMeters.y -= offset.y; snapshot.previousPositionMeters.z -= offset.z;
    snapshot.currentPositionMeters.x -= offset.x; snapshot.currentPositionMeters.y -= offset.y; snapshot.currentPositionMeters.z -= offset.z;
  }
  return { create, commit, sample, rebaseShift };
})();

// ---------------------------------------------------------------------------
// SECTION: ENCOUNTER MANAGER — activation/deactivation hysteresis, doc §52.4.
// Pure decision logic only; no spawning/despawning of real entities yet (no
// ship/AI entities exist to spawn -- that's Stage D).
// ---------------------------------------------------------------------------
Game.EncounterManager = (function () {
  function createTracker() { return { active: false }; }
  function update(tracker, distanceMeters) {
    const c = Game.Constants;
    if (!tracker.active && distanceMeters <= c.ENCOUNTER_ACTIVATION_RADIUS_M) { tracker.active = true; return "ACTIVATED"; }
    if (tracker.active && distanceMeters >= c.ENCOUNTER_DEACTIVATION_RADIUS_M) { tracker.active = false; return "DEACTIVATED"; }
    return "UNCHANGED";
  }
  return { createTracker, update };
})();

// ---------------------------------------------------------------------------
// SECTION: ENCOUNTER FRAME + REBASE — doc §6.3/6.5/52.6. Rebase now also
// shifts each body's RenderSnapshot history, satisfying invariant 3 ("new
// previous position = old previous position - offset") now that snapshots
// exist; the Stage B version only moved raw positions.
// ---------------------------------------------------------------------------
Game.Encounter = (function () {
  function createFrame(anchorPositionMeters, anchorVelocityMps, anchorAccelerationMps2) {
    return {
      anchorPositionMeters: Game.Vec3.v3(anchorPositionMeters.x, anchorPositionMeters.y, anchorPositionMeters.z),
      anchorVelocityMps: Game.Vec3.v3(anchorVelocityMps.x, anchorVelocityMps.y, anchorVelocityMps.z),
      anchorAccelerationMps2: Game.Vec3.v3(anchorAccelerationMps2.x, anchorAccelerationMps2.y, anchorAccelerationMps2.z),
    };
  }
  function rebaseEncounter(frame, bodies, player) {
    const dx = player.positionMeters.x, dy = player.positionMeters.y, dz = player.positionMeters.z;
    const offset = { x: dx, y: dy, z: dz };
    frame.anchorPositionMeters.x += dx; frame.anchorPositionMeters.y += dy; frame.anchorPositionMeters.z += dz;
    for (const body of bodies) {
      body.positionMeters.x -= dx; body.positionMeters.y -= dy; body.positionMeters.z -= dz;
      if (body.snapshot) Game.RenderSnapshot.rebaseShift(body.snapshot, offset);
      // velocity untouched: invariant 2 -- a pure origin translation changes no local velocity.
    }
  }
  return { createFrame, rebaseEncounter };
})();

// ---------------------------------------------------------------------------
// SECTION: PHYSICS WORLD — the actual per-tick stepping loop (PhysicsWorld.ts
// in the doc's module list). Integrator is semi-implicit (symplectic) Euler --
// not specified verbatim in the doc, but the standard stable default for
// fixed-step real-time game physics of this kind.
// ---------------------------------------------------------------------------
Game.PhysicsWorld = (function () {
  function createBody(id, positionMeters, velocityMps, orientation) {
    return {
      id,
      positionMeters: Game.Vec3.v3(positionMeters.x, positionMeters.y, positionMeters.z),
      velocityMps: Game.Vec3.v3(velocityMps.x, velocityMps.y, velocityMps.z),
      orientation: { x: orientation.x, y: orientation.y, z: orientation.z, w: orientation.w },
      snapshot: Game.RenderSnapshot.create(id, positionMeters, orientation),
      thrustAccelMps2: Game.Vec3.v3(0, 0, 0), // ships only; flight controller writes this before step()
    };
  }
  function createScratch() {
    return { accel: Game.Vec3.v3(), abs: Game.Vec3.v3(), anchorGravity: Game.Vec3.v3(), bodyGravity: Game.Vec3.v3() };
  }
  function step(frame, bodies, dtSeconds, scratch) {
    // Refresh the anchor-gravity cache once per tick so every body's fast linearized
    // path can use it without recomputing per body -- see differentialGravity's
    // calling contract in Game.Gravity.
    Game.Gravity.gravityAt(frame.anchorPositionMeters, scratch.anchorGravity);
    for (const body of bodies) {
      Game.Gravity.differentialGravity(
        frame.anchorPositionMeters, frame.anchorAccelerationMps2, body.positionMeters,
        scratch.accel, scratch.abs, scratch.anchorGravity, scratch.bodyGravity
      );
      if (body.tideScale !== undefined && body.tideScale !== 1) {   // inside a world's capture zone the hole's tide is switched off
        scratch.accel.x *= body.tideScale; scratch.accel.y *= body.tideScale; scratch.accel.z *= body.tideScale;
      }
      // doc §6.4: a_local = gravity term (above) + thrust + local forces. Bodies with no
      // thrust (asteroids, Stage C's test probes) get thrustAccelMps2 = (0,0,0) and this
      // is a no-op, so Stage C's own tests are unaffected by this extension.
      scratch.accel.x += body.thrustAccelMps2.x;
      scratch.accel.y += body.thrustAccelMps2.y;
      scratch.accel.z += body.thrustAccelMps2.z;
      Game.Vec3.addScaled(body.velocityMps, body.velocityMps, scratch.accel, dtSeconds);
      Game.Vec3.addScaled(body.positionMeters, body.positionMeters, body.velocityMps, dtSeconds);
      Game.RenderSnapshot.commit(body.snapshot, body.positionMeters, body.orientation);
    }
  }
  return { createBody, createScratch, step };
})();

// ---------------------------------------------------------------------------
// SECTION: STRATEGIC -> LOCAL CONVERSION — doc §65 item 19, activation side
// only (Kepler state -> local encounter-frame state). The deactivation side
// (local state vector -> new osculating Kepler elements, classical "rv2coe")
// is a distinct algorithm, deferred until something can actually leave a
// bubble -- needs Stage D ships to exist first.
// ---------------------------------------------------------------------------
Game.StrategicConversion = (function () {
  function strategicToLocalState(orbit, tSeconds, anchorPositionMeters, anchorVelocityMps) {
    const s = Game.Orbits.orbitalStateAtTime(orbit, tSeconds);
    return {
      positionMeters: Game.Vec3.v3(s.position.x - anchorPositionMeters.x, s.position.y - anchorPositionMeters.y, s.position.z - anchorPositionMeters.z),
      velocityMps: Game.Vec3.v3(s.velocity.x - anchorVelocityMps.x, s.velocity.y - anchorVelocityMps.y, s.velocity.z - anchorVelocityMps.z),
    };
  }
  return { strategicToLocalState };
})();

// ---------------------------------------------------------------------------
// SECTION: TOUCH INPUT — dual virtual stick overlay, plain DOM over the canvas
// (never enters the WebGL pipeline). Drafted externally (Fable 5 and Opus,
// two independent attempts at the same spec) and reviewed here: both were
// tested against 18 synthetic pointer-event scenarios in jsdom (idle state,
// dead-zone boundary, full deflection sign conventions on both axes, two
// pads held independently and simultaneously, a second finger landing on an
// already-owned pad correctly ignored, pointercancel, clean re-press,
// detach cleanup) -- both passed all 18 identically, so the core math and
// pointer-ownership logic in both were correct.
//
// Two real, confirmed differences decided the merge:
//   1. Window-blur / visibility-change safety net. Verified empirically: the
//      version WITHOUT it leaves thrust latched at full deflection after a
//      simulated 'blur' event with no pointerup/pointercancel -- exactly the
//      "ship accelerates forever in the background" failure mode. Kept.
//   2. Pad-size-aware max travel radius (computed from the actual rendered
//      element via getBoundingClientRect + knob offsetWidth) instead of a
//      constant tied to one specific hardcoded CSS size. Kept for the same
//      reason Stage B kept Vec3d engine-independent: a magic number that's
//      silently wrong the moment someone edits the CSS is a bug waiting to
//      happen, not a simplification.
// One deliberate simplification on top of both: no INVERT_PITCH toggle in
// the widget itself. The convention is fixed and documented below; a flight-
// assist setting that flips it belongs in the flight controller, per the
// plan's own §52.2 boundary ("input produces commands; the controller
// decides what a command means") -- not duplicated as a second, hidden knob
// inside the input widget.
//
// AXIS CONVENTION (screen-space Y inverted before output, both pads):
//   leftX  : +1 strafe right,  -1 strafe left
//   leftY  : +1 forward (thumb toward top of screen), -1 back/brake
//   rightX : +1 yaw right,     -1 yaw left
//   rightY : +1 pitch nose up (thumb toward top of screen), -1 nose down
//
// STILL NEEDS A REAL PHONE: multi-touch pointer capture across two
// simultaneous fingers can't be fully verified without an actual touchscreen
// (jsdom doesn't implement setPointerCapture at all -- calls are caught and
// no-op). The live readout at the bottom of the screen is exactly for that:
// hold both pads and confirm the four numbers respond correctly to each thumb
// independently before anything is built on top of this.
// ---------------------------------------------------------------------------
Game.TouchInput = (function () {
  "use strict";

  const DEAD_ZONE_FRAC = 0.16;
  const KNOB_STEP = 0.5; // px quantization; skips redundant style writes on sub-pixel jitter

  let mounted = false;
  let rootEl = null;
  let styleEl = null;

  const outState = { leftX: 0, leftY: 0, rightX: 0, rightY: 0, aimX: 0, aimY: 0 };

  function makePad(side) {
    return {
      side, el: null, knob: null, pointerId: -1,
      cx: 0, cy: 0, maxR: 1, deadR: 0,
      lastClientX: 0, lastClientY: 0, knobX: 0, knobY: 0,
      hDown: null, hMove: null, hUp: null, hCancel: null, hLost: null,
    };
  }
  const padLeft = makePad("left");
  const padRight = makePad("right");
  const pads = [padLeft, padRight];

  // ---- AIM + FIRE pad -------------------------------------------------------------------------------
  // The FIRE button is also a floating aim stick: press = start firing, drag = steer the nose with the
  // SAME travel radius, dead zone and sign convention as the nose pad (padRight), release = cease fire.
  // The drag origin is wherever the thumb first lands, so pressing off-centre never twitches the ship.
  const padFire = { el: null, knob: null, pointerId: -1, ox: 0, oy: 0, kx: 0, ky: 0, h: null };
  let fireStartCb = null, fireEndCb = null;
  function fireSolve(cx, cy) {
    let dx = cx - padFire.ox, dy = cy - padFire.oy;
    let dist = Math.sqrt(dx * dx + dy * dy);
    const maxR = padRight.maxR > 8 ? padRight.maxR : 32, deadR = maxR * DEAD_ZONE_FRAC;
    if (dist > maxR) { const sc = maxR / dist; dx *= sc; dy *= sc; dist = maxR; }
    const qx = Math.round(dx / KNOB_STEP) * KNOB_STEP, qy = Math.round(dy / KNOB_STEP) * KNOB_STEP;
    if (padFire.knob && (qx !== padFire.kx || qy !== padFire.ky)) {
      padFire.kx = qx; padFire.ky = qy;
      padFire.knob.style.transform = "translate3d(" + qx + "px," + qy + "px,0)";
    }
    if (dist > deadR) {
      const norm = (dist - deadR) / (maxR - deadR), inv = norm / dist;
      outState.aimX = dx * inv; outState.aimY = -dy * inv;
    } else { outState.aimX = 0; outState.aimY = 0; }
  }
  function fireRelease() {
    if (padFire.pointerId === -1) return;
    try { padFire.el.releasePointerCapture(padFire.pointerId); } catch (_e) { /* already released */ }
    padFire.pointerId = -1; outState.aimX = 0; outState.aimY = 0;
    padFire.el.classList.remove("firing", "aiming");
    if (padFire.knob) { padFire.knob.style.transform = "translate3d(0,0,0)"; padFire.kx = padFire.ky = 0; }
    if (fireEndCb) fireEndCb();
  }
  function mountFire() {
    const el = document.getElementById("fireBtn");
    if (!el || padFire.el) return;
    padFire.el = el;
    const knob = document.createElement("i"); knob.className = "fire-knob"; el.appendChild(knob); padFire.knob = knob;
    padFire.h = {
      down: (e) => {
        if (padFire.pointerId !== -1) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.preventDefault();
        padFire.pointerId = e.pointerId; padFire.ox = e.clientX; padFire.oy = e.clientY;
        try { el.setPointerCapture(e.pointerId); } catch (_e) { /* non-fatal */ }
        el.classList.add("firing"); fireSolve(e.clientX, e.clientY);
        if (fireStartCb) fireStartCb();
      },
      move: (e) => {
        if (e.pointerId !== padFire.pointerId) return;
        e.preventDefault(); fireSolve(e.clientX, e.clientY);
        el.classList.toggle("aiming", outState.aimX !== 0 || outState.aimY !== 0);
      },
      up: (e) => { if (e.pointerId === padFire.pointerId) { e.preventDefault(); fireRelease(); } },
      kill: (e) => { e.preventDefault(); },
    };
    el.addEventListener("pointerdown", padFire.h.down, { passive: false });
    el.addEventListener("pointermove", padFire.h.move, { passive: false });
    el.addEventListener("pointerup", padFire.h.up, { passive: false });
    el.addEventListener("pointercancel", padFire.h.up, { passive: false });
    el.addEventListener("lostpointercapture", padFire.h.up);
    el.addEventListener("contextmenu", padFire.h.kill, { passive: false });
  }
  function unmountFire() {
    if (!padFire.el) return;
    fireRelease();
    const el = padFire.el, h = padFire.h;
    el.removeEventListener("pointerdown", h.down); el.removeEventListener("pointermove", h.move);
    el.removeEventListener("pointerup", h.up); el.removeEventListener("pointercancel", h.up);
    el.removeEventListener("lostpointercapture", h.up); el.removeEventListener("contextmenu", h.kill);
    if (padFire.knob && padFire.knob.parentNode) padFire.knob.parentNode.removeChild(padFire.knob);
    padFire.el = null; padFire.knob = null; padFire.h = null;
  }

  const CSS_TEXT =
    '.ti-root{position:fixed;inset:0;z-index:20;pointer-events:none;touch-action:none;' +
    'overscroll-behavior:none;-webkit-user-select:none;user-select:none;' +
    '-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none}' +
    '.ti-pad{position:absolute;bottom:calc(22px + env(safe-area-inset-bottom,0px));' +
    'width:148px;height:148px;border-radius:50%;pointer-events:auto;touch-action:none;' +
    'contain:layout style;border:1px solid rgba(186,204,222,.16);' +
    'background:radial-gradient(circle at 50% 50%,rgba(140,172,200,.045) 0%,' +
    'rgba(140,172,200,.018) 62%,rgba(0,0,0,0) 73%);' +
    'box-shadow:inset 0 0 26px rgba(120,160,200,.045);opacity:.72;' +
    'transition:opacity 120ms linear,border-color 120ms linear;-webkit-user-drag:none}' +
    '.ti-pad--left{left:calc(26px + env(safe-area-inset-left,0px))}' +
    '.ti-pad--right{right:calc(26px + env(safe-area-inset-right,0px))}' +
    ".ti-pad::before{content:'';position:absolute;left:50%;top:50%;width:26px;height:26px;" +
    "margin:-13px 0 0 -13px;border-radius:50%;border:1px solid rgba(186,204,222,.09)}" +
    ".ti-pad::after{content:'';position:absolute;left:50%;top:50%;width:1px;height:1px;" +
    "box-shadow:0 -58px 0 0 rgba(186,204,222,.10),0 58px 0 0 rgba(186,204,222,.10)," +
    "-58px 0 0 0 rgba(186,204,222,.10),58px 0 0 0 rgba(186,204,222,.10)}" +
    ".ti-pad.ti-active{opacity:1;border-color:rgba(206,224,240,.30)}" +
    ".ti-knob{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;" +
    "border-radius:50%;border:1px solid rgba(206,224,240,.26);background:rgba(18,24,30,.42);" +
    "box-shadow:0 0 10px rgba(0,0,0,.55),inset 0 0 9px rgba(160,190,220,.055);" +
    "transform:translate3d(0,0,0);will-change:transform}" +
    ".ti-pad.ti-active .ti-knob{border-color:rgba(216,234,248,.42);background:rgba(26,34,42,.52)}" +
    "@media (max-height:420px){.ti-pad{width:124px;height:124px;" +
    "bottom:calc(14px + env(safe-area-inset-bottom,0px))}" +
    ".ti-knob{width:48px;height:48px;margin:-24px 0 0 -24px}}";

  function injectCss() {
    if (styleEl) return;
    styleEl = document.createElement("style");
    styleEl.id = "ti-style";
    styleEl.textContent = CSS_TEXT;
    document.head.appendChild(styleEl);
  }

  function measure(pad) {
    const r = pad.el.getBoundingClientRect();
    pad.cx = r.left + r.width * 0.5;
    pad.cy = r.top + r.height * 0.5;
    const knobR = pad.knob.offsetWidth * 0.5;
    pad.maxR = Math.max(8, r.width * 0.5 - knobR);
    pad.deadR = pad.maxR * DEAD_ZONE_FRAC;
  }
  function measureAll() {
    if (!mounted) return;
    for (const p of pads) {
      measure(p);
      if (p.pointerId !== -1) solve(p, p.lastClientX, p.lastClientY);
    }
  }

  // Fixed convention, both pads: screen-up is positive. No internal invert
  // toggle -- see header note.
  function writeOut(pad, x, y) {
    if (pad.side === "left") { outState.leftX = x; outState.leftY = -y; }
    else { outState.rightX = x; outState.rightY = -y; }
  }

  function drawKnob(pad, x, y) {
    const qx = Math.round(x / KNOB_STEP) * KNOB_STEP;
    const qy = Math.round(y / KNOB_STEP) * KNOB_STEP;
    if (qx === pad.knobX && qy === pad.knobY) return;
    pad.knobX = qx; pad.knobY = qy;
    pad.knob.style.transform = "translate3d(" + qx + "px," + qy + "px,0)";
  }

  function solve(pad, clientX, clientY) {
    pad.lastClientX = clientX; pad.lastClientY = clientY;
    let dx = clientX - pad.cx, dy = clientY - pad.cy;
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > pad.maxR) { const s = pad.maxR / dist; dx *= s; dy *= s; dist = pad.maxR; }
    drawKnob(pad, dx, dy);
    if (dist > pad.deadR) {
      const norm = (dist - pad.deadR) / (pad.maxR - pad.deadR);
      const inv = norm / dist;
      writeOut(pad, dx * inv, dy * inv);
    } else {
      writeOut(pad, 0, 0);
    }
  }

  function release(pad) {
    if (pad.pointerId === -1) return;
    try { pad.el.releasePointerCapture(pad.pointerId); } catch (_e) { /* already released */ }
    pad.pointerId = -1;
    pad.el.classList.remove("ti-active");
    drawKnob(pad, 0, 0);
    writeOut(pad, 0, 0);
  }
  function releaseAll() { for (const p of pads) release(p); fireRelease(); }

  function onDown(pad, e) {
    if (pad.pointerId !== -1) return; // pad already owned: ignore every other finger
    if (e.pointerType === "mouse" && e.button !== 0) return; // left-click only on desktop
    e.preventDefault();
    pad.pointerId = e.pointerId;
    measure(pad);
    try { pad.el.setPointerCapture(e.pointerId); } catch (_e) { /* non-fatal */ }
    pad.el.classList.add("ti-active");
    solve(pad, e.clientX, e.clientY);
  }
  function onMove(pad, e) { if (e.pointerId === pad.pointerId) { e.preventDefault(); solve(pad, e.clientX, e.clientY); } }
  function onUp(pad, e) { if (e.pointerId === pad.pointerId) { e.preventDefault(); release(pad); } }
  function onCancel(pad, e) { if (e.pointerId === pad.pointerId) release(pad); }
  function onLostCapture(pad, e) { if (e.pointerId === pad.pointerId) release(pad); }
  // A stuck stick means a ship thrusting forever -- an incoming call, an OS edge
  // gesture, or the app losing focus must all zero the output even if the
  // browser never gets around to firing pointercancel for the held pointer.
  function onWindowBlur() { releaseAll(); }
  function onVisibility() { if (document.hidden) releaseAll(); }
  function onResize() { measureAll(); }
  function killEvent(e) { e.preventDefault(); }

  function buildPad(pad) {
    const el = document.createElement("div");
    el.className = "ti-pad ti-pad--" + pad.side;
    el.setAttribute("aria-hidden", "true");
    const knob = document.createElement("div");
    knob.className = "ti-knob";
    el.appendChild(knob);
    pad.el = el; pad.knob = knob;
    pad.hDown = (e) => onDown(pad, e);
    pad.hMove = (e) => onMove(pad, e);
    pad.hUp = (e) => onUp(pad, e);
    pad.hCancel = (e) => onCancel(pad, e);
    pad.hLost = (e) => onLostCapture(pad, e);
    el.addEventListener("pointerdown", pad.hDown, { passive: false });
    el.addEventListener("pointermove", pad.hMove, { passive: false });
    el.addEventListener("pointerup", pad.hUp, { passive: false });
    el.addEventListener("pointercancel", pad.hCancel, { passive: false });
    el.addEventListener("lostpointercapture", pad.hLost);
    el.addEventListener("contextmenu", killEvent, { passive: false });
    el.addEventListener("dragstart", killEvent, { passive: false });
    return el;
  }
  function teardownPad(pad) {
    if (!pad.el) return;
    release(pad);
    pad.el.removeEventListener("pointerdown", pad.hDown);
    pad.el.removeEventListener("pointermove", pad.hMove);
    pad.el.removeEventListener("pointerup", pad.hUp);
    pad.el.removeEventListener("pointercancel", pad.hCancel);
    pad.el.removeEventListener("lostpointercapture", pad.hLost);
    pad.el.removeEventListener("contextmenu", killEvent);
    pad.el.removeEventListener("dragstart", killEvent);
    if (pad.el.parentNode) pad.el.parentNode.removeChild(pad.el);
    pad.el = null; pad.knob = null;
    pad.hDown = pad.hMove = pad.hUp = pad.hCancel = pad.hLost = null;
  }

  function attach(container) {
    if (mounted) return;
    const host = container || document.body;
    injectCss();
    rootEl = document.createElement("div");
    rootEl.className = "ti-root";
    rootEl.appendChild(buildPad(padLeft));
    rootEl.appendChild(buildPad(padRight));
    host.appendChild(rootEl);
    mountFire();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("visibilitychange", onVisibility);
    mounted = true;
    measureAll();
  }
  function getState() { return outState; }
  function detach() {
    if (!mounted) return;
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    window.removeEventListener("blur", onWindowBlur);
    document.removeEventListener("visibilitychange", onVisibility);
    teardownPad(padLeft); teardownPad(padRight); unmountFire();
    if (rootEl && rootEl.parentNode) rootEl.parentNode.removeChild(rootEl);
    rootEl = null;
    if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
    styleEl = null;
    outState.leftX = outState.leftY = outState.rightX = outState.rightY = outState.aimX = outState.aimY = 0;
    mounted = false;
  }

  function setFireHandlers(onStart, onEnd) { fireStartCb = onStart; fireEndCb = onEnd; }
  return { attach, getState, detach, setFireHandlers };
})();


// ---------------------------------------------------------------------------
// SECTION: SPRING — exact closed-form critically-damped harmonic oscillator.
// Doc §15.4 gives the camera's spring as "acceleration = stiffness x error -
// damping x velocity"; damping is fixed at the critical value (2*omega) here
// so it converges as fast as possible with no overshoot/oscillation,
// regardless of dt (verified: a single 5-second step doesn't blow up).
// ---------------------------------------------------------------------------
Game.Spring = (function () {
  function stepCriticallyDamped(e0, v0, omega, dt) {
    const ex = Math.exp(-omega * dt);
    const newE = (e0 + (v0 + omega * e0) * dt) * ex;
    const newV = (v0 - omega * (v0 + omega * e0) * dt) * ex;
    return { e: newE, v: newV };
  }
  return { stepCriticallyDamped };
})();

// ---------------------------------------------------------------------------
// SECTION: FLIGHT CONTROLLER (v2) -- doc §17 flight model + §59 orientation
// contract (quaternion + angular velocity; controller converts desired rate ->
// actual rate -> orientation; auto-bank etc. stay presentation-only).
//
// Local axes match Babylon's left-handed default: +Z forward, +Y up, +X right.
//
// SIGN CONVENTION (a bug in the previous build, found on re-review): the
// quaternion math here is standard right-handed math, so a POSITIVE rotation
// about local +X takes the nose DOWN (forward (0,0,1) -> (0,-sin,cos)) and a
// positive rotation about +Z lifts the RIGHT wing. The player-facing
// convention is thumb-up = nose up and roll-right = right wing down, so pitch
// and roll intents are negated below. Yaw already agreed (+Y rotation moves
// the nose toward +X = right). Direction (not just magnitude) is now tested.
//
// DELIBERATE DEVIATION FROM THE PLAN: doc §17 gives 5,000 m/s^2 and a 0.02c
// soft cruise limit -- strategic-travel numbers. At dogfight distances on a
// phone screen they make combat unplayable (1 s of thrust = 5 km/s, ships
// vanish). Flight profiles below are dogfight-scaled; the doc's soft-limiter
// SHAPE is kept (efficiency rolls off smoothly toward softMaxSpeed, braking is
// always full strength, no hard clamp).
//
// MY OWN CHOICES (not doc-given): first-order exponential approach to the
// desired angular rate instead of a literal second-order PD; dampener strength
// capped at that axis's own thrust ("Assisted" mode only).
// ---------------------------------------------------------------------------
Game.FlightController = (function () {
  const V = Game.Vec3, Q = Game.Quat, C = Game.Constants;

  const PLAYER_PROFILE = {
    accelFwd: 1400, accelRev: 900, accelLat: 800, accelVert: 800, softMaxSpeed: 650,
    maxPitchRate: C.SHIP_MAX_PITCH_RATE_RAD, maxYawRate: C.SHIP_MAX_YAW_RATE_RAD, maxRollRate: C.SHIP_MAX_ROLL_RATE_RAD, angularTau: 0.15,
  };
  const FIGHTER_PROFILE = {
    accelFwd: 1000, accelRev: 500, accelLat: 600, accelVert: 600, softMaxSpeed: 520,
    maxPitchRate: C.SHIP_MAX_PITCH_RATE_RAD * 0.78, maxYawRate: C.SHIP_MAX_YAW_RATE_RAD * 0.78, maxRollRate: C.SHIP_MAX_ROLL_RATE_RAD * 0.7, angularTau: 0.2,
  };
  const GUNSHIP_PROFILE = {
    accelFwd: 520, accelRev: 300, accelLat: 320, accelVert: 320, softMaxSpeed: 260,
    maxPitchRate: C.SHIP_MAX_PITCH_RATE_RAD * 0.45, maxYawRate: C.SHIP_MAX_YAW_RATE_RAD * 0.45, maxRollRate: C.SHIP_MAX_ROLL_RATE_RAD * 0.4, angularTau: 0.3,
  };

  function createShipControlState() { return { angularVelocityRadPerSecond: V.v3(0, 0, 0) }; }

  const _fwd = V.v3(), _right = V.v3(), _up = V.v3();
  const _desired = V.v3(), _axis = V.v3(), _omegaBody = V.v3();
  const _inc = { x: 0, y: 0, z: 0, w: 1 }, _qc = { x: 0, y: 0, z: 0, w: 1 };

  function localAxes(o) {
    Q.qRotateVector(_fwd, o, { x: 0, y: 0, z: 1 });
    Q.qRotateVector(_right, o, { x: 1, y: 0, z: 0 });
    Q.qRotateVector(_up, o, { x: 0, y: 1, z: 0 });
  }
  function forwardEfficiency(fSpeed, softMax) { return Math.max(0, 1 - Math.max(0, fSpeed) / softMax); }
  function dampAxis(component, dt, maxAccel) {
    const needed = -component / dt; // accel that would zero this axis in exactly one step
    return Math.sign(needed) * Math.min(Math.abs(needed), maxAccel);
  }

  /** intent: {thrust,strafe,vertical,yaw,pitch,roll} in [-1,1]. frameOmegaWorld (optional): angular velocity
   *  of the frame the ship should hold attitude against (orbit-relative hold); omit for inertial hold. */
  function update(ship, intent, dt, frameOmegaWorld) {
    const P = ship.profile || PLAYER_PROFILE;
    localAxes(ship.orientation);
    const vel = ship.velocityMps;
    const fSpeed = V.dot(vel, _fwd), rSpeed = V.dot(vel, _right), uSpeed = V.dot(vel, _up);
    const DEAD = 0.02;

    let fwdA;
    if (intent.thrust >= 0) fwdA = P.accelFwd * intent.thrust;
    else fwdA = P.accelRev * intent.thrust;
    if (Math.abs(intent.thrust) < DEAD) fwdA = dampAxis(fSpeed, dt, P.accelFwd);
    const rightA = Math.abs(intent.strafe) < DEAD ? dampAxis(rSpeed, dt, P.accelLat) : P.accelLat * intent.strafe;
    const upA = Math.abs(intent.vertical) < DEAD ? dampAxis(uSpeed, dt, P.accelVert) : P.accelVert * intent.vertical;

    const t = ship.thrustAccelMps2;
    t.x = _fwd.x * fwdA + _right.x * rightA + _up.x * upA;
    t.y = _fwd.y * fwdA + _right.y * rightA + _up.y * upA;
    t.z = _fwd.z * fwdA + _right.z * rightA + _up.z * upA;
    // TOTAL-speed soft limiter (root-cause fix found by simulating enemy AI: the forward-only limiter let
    // strafe/vertical/turning thrust pile speed far past the cap -- enemies reached 1,500 m/s against a
    // 520 m/s profile). The part of thrust that would INCREASE speed along the current velocity is scaled
    // by the same smooth efficiency; braking and direction-changing components are untouched.
    const spd = V.length(vel);
    if (spd > 1e-3) {
      const ap = (t.x * vel.x + t.y * vel.y + t.z * vel.z) / spd;
      if (ap > 0) {
        const cut = ap * (1 - forwardEfficiency(spd, P.softMaxSpeed)) / spd;
        t.x -= vel.x * cut; t.y -= vel.y * cut; t.z -= vel.z * cut;
      }
      // Restoring drag above the cap: semi-implicit integration of direction-changing thrust adds a small
      // amount of speed every step (~4 m/s per second at 800 m/s^2), so the cap needs a governor, not just
      // a trimmed push. Smooth (0.125 s time constant), never exceeds the axis's own thrust authority.
      if (spd > P.softMaxSpeed) {
        const drag = Math.min(8 * (spd - P.softMaxSpeed), P.accelFwd) / spd;
        t.x -= vel.x * drag; t.y -= vel.y * drag; t.z -= vel.z * drag;
      }
    }

    _desired.x = -intent.pitch * P.maxPitchRate;
    _desired.y = intent.yaw * P.maxYawRate;
    _desired.z = -intent.roll * P.maxRollRate;
    if (frameOmegaWorld) {
      Q.qConjugate(_qc, ship.orientation);
      Q.qRotateVector(_omegaBody, _qc, frameOmegaWorld);
      _desired.x += _omegaBody.x; _desired.y += _omegaBody.y; _desired.z += _omegaBody.z;
    }
    const av = ship.controlState.angularVelocityRadPerSecond;
    const k = 1 - Math.exp(-dt / P.angularTau);
    av.x += (_desired.x - av.x) * k; av.y += (_desired.y - av.y) * k; av.z += (_desired.z - av.z) * k;

    const angle = V.length(av) * dt;
    if (angle > 1e-12 && V.normalize(_axis, av)) {
      Q.qFromAxisAngle(_inc, _axis, angle);
      Q.qMultiply(ship.orientation, ship.orientation, _inc);
      Q.qNormalize(ship.orientation, ship.orientation);
    }
  }
  return { createShipControlState, update, forwardEfficiency, dampAxis, PLAYER_PROFILE, FIGHTER_PROFILE, GUNSHIP_PROFILE };
})();

// ---------------------------------------------------------------------------
// SECTION: CHASE CAMERA (v2) -- doc §15.4: behind/above offset, mild look-ahead,
// critically-damped spring. v2 also returns the ship's UP vector: the previous
// build used Babylon's fixed world-up, which flips the camera the moment the
// ship pitches past vertical and ignores roll entirely. A real 6DOF chase
// camera must inherit the ship's up.
// ---------------------------------------------------------------------------
Game.ChaseCamera = (function () {
  const V = Game.Vec3, Q = Game.Quat;
  const LOCAL_OFFSET = { x: 0, y: 6.5, z: -22 };
  const OMEGA = 7; // rad/s, my own choice (doc gives the form, not the gain)
  const LOOKAHEAD_SECONDS = 0.25, LOOKAHEAD_MAX_M = 70;

  function createState(p) { return { positionMeters: V.v3(p.x, p.y, p.z), velocityMps: V.v3(0, 0, 0) }; }
  const _wo = V.v3(), _des = V.v3(), _look = V.v3(), _fwd = V.v3(), _up = V.v3();

  function update(state, ship, dt) {
    Q.qRotateVector(_wo, ship.orientation, LOCAL_OFFSET);
    _des.x = ship.positionMeters.x + _wo.x; _des.y = ship.positionMeters.y + _wo.y; _des.z = ship.positionMeters.z + _wo.z;
    const S = Game.Spring.stepCriticallyDamped;
    const rx = S(state.positionMeters.x - _des.x, state.velocityMps.x, OMEGA, dt);
    const ry = S(state.positionMeters.y - _des.y, state.velocityMps.y, OMEGA, dt);
    const rz = S(state.positionMeters.z - _des.z, state.velocityMps.z, OMEGA, dt);
    state.positionMeters.x = _des.x + rx.e; state.velocityMps.x = rx.v;
    state.positionMeters.y = _des.y + ry.e; state.velocityMps.y = ry.v;
    state.positionMeters.z = _des.z + rz.e; state.velocityMps.z = rz.v;
    Q.qRotateVector(_fwd, ship.orientation, { x: 0, y: 0, z: 1 });
    Q.qRotateVector(_up, ship.orientation, { x: 0, y: 1, z: 0 });
    const d = Math.min(LOOKAHEAD_MAX_M, V.length(ship.velocityMps) * LOOKAHEAD_SECONDS);
    _look.x = ship.positionMeters.x + _fwd.x * d + _fwd.x * 40; // aim point ahead of the nose, not at the hull
    _look.y = ship.positionMeters.y + _fwd.y * d + _fwd.y * 40;
    _look.z = ship.positionMeters.z + _fwd.z * d + _fwd.z * 40;
    return { position: state.positionMeters, lookAt: _look, up: _up };
  }
  // doc §52.6-style rebase: ANY render-side state kept in local coordinates must shift with the origin.
  // (Bug found on re-review: the previous build rebased bodies but not the camera spring, so every
  // 50 km re-anchor made the camera fly 50 km back to the ship.)
  function shift(state, off) { state.positionMeters.x -= off.x; state.positionMeters.y -= off.y; state.positionMeters.z -= off.z; }
  return { createState, update, shift, LOCAL_OFFSET, OMEGA };
})();

// ---------------------------------------------------------------------------
// SECTION: KEYBOARD INPUT — desktop TESTING SUPPLEMENT only, not a designed
// desktop control scheme (that needs mouse-look + remappable bindings, a
// separate later feature). Exists so roll and vertical strafe -- unreachable
// from two 2D touch pads -- can be exercised at all right now. WASD+arrows+
// QE+Space, not final key bindings.
// ---------------------------------------------------------------------------
Game.KeyboardInput = (function () {
  const keys = Object.create(null);
  const state = { thrust: 0, strafe: 0, vertical: 0, yaw: 0, pitch: 0, roll: 0 };

  function axis(negCode, posCode) { return (keys[posCode] ? 1 : 0) - (keys[negCode] ? 1 : 0); }
  function recompute() {
    state.thrust = axis("KeyS", "KeyW");
    state.yaw = axis("KeyA", "KeyD");
    state.roll = axis("KeyQ", "KeyE");
    state.pitch = axis("ArrowDown", "ArrowUp");
    state.strafe = axis("ArrowLeft", "ArrowRight");
    state.vertical = axis("ShiftLeft", "Space") || axis("ShiftRight", "Space");
  }
  function onDown(e) { keys[e.code] = true; recompute(); }
  function onUp(e) { keys[e.code] = false; recompute(); }
  function onBlur() { for (const k in keys) keys[k] = false; recompute(); }

  let attached = false;
  function attach() {
    if (attached) return;
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    attached = true;
  }
  function getState() { return state; }
  return { attach, getState };
})();


// ---------------------------------------------------------------------------
// SECTION: LENS TABLES -- exact Schwarzschild null-geodesic lookup tables for
// a camera at a FIXED radius (rs = 1 units, u = 1/r).
//
// Why tables: tracing a geodesic per pixel is too heavy for phones, and the
// camera radius barely changes inside one arena (+-100 km against ~1e9 m),
// so ONE small table per arena gives per-pixel cost of a few texture fetches
// while staying exactly on the geodesic. (Approach in the spirit of Bruneton's
// "Real-time High-Quality Rendering of Non-Rotating Black Holes", which
// precomputes ray results; this version exploits the fixed-radius observer to
// avoid his 3-D tables.)
//
// Geometry: a ray traced BACKWARD from the camera lies in a plane through the
// black hole. Polar angle phi is measured in that plane from the camera's
// outward radial direction toward the ray's tangential direction. The orbit
// equation, with u = 1/r:
//        d2u/dphi2 = 1.5 u^2 - u,      (du/dphi)^2 = e^2 - u^2 (1 - u)
// where e = 1/b is the inverse impact parameter. For a static observer whose
// LOCAL angle between view direction and outward radial is psi:
//        du/dphi at start = -uc*sqrt(1-uc)*cot(psi)     (inbound => positive)
// Capture happens when u reaches 1 (the horizon).
//
// Table layout: rows = psi (three segments, dense near the critical angle
// where deflection diverges logarithmically), columns = phi in [0, phiMax].
// Texel = (u at phi, du/dphi at phi, S, 0); u = -1 once the ray has escaped or
// been captured. S = total polar sweep to infinity (the star-lookup direction
// is the radial axis rotated by S toward the tangent), or -1 if captured.
// ---------------------------------------------------------------------------
Game.__lensFactory = function () {
  const PI = Math.PI;
  const B_CRIT = 1.5 * Math.sqrt(3); // 2.598 rs: critical impact parameter

  function psiCritical(rc) {
    const uc = 1 / rc;
    const s = B_CRIT * uc * Math.sqrt(1 - uc);
    return PI - Math.asin(Math.min(1, s));
  }

  // Backward-traced ray. Fills uOut/vOut (length nCols) at phi_j = j*phiMax/(nCols-1);
  // returns S (sweep to infinity) or -1 if captured / never resolved.
  function traceRay(psi, rc, phiMax, nCols, sub, uOut, vOut) {
    const uc = 1 / rc;
    const sinP = Math.sin(psi), cosP = Math.cos(psi);
    let u = uc;
    let v = -uc * Math.sqrt(1 - uc) * (cosP / sinP);
    const hCol = phiMax / (nCols - 1);
    const h = hCol / sub;
    let phi = 0;
    let alive = true;
    let S = -1;

    function step() {
      const k1u = v, k1v = 1.5 * u * u - u;
      const u2 = u + 0.5 * h * k1u, v2 = v + 0.5 * h * k1v;
      const k2u = v2, k2v = 1.5 * u2 * u2 - u2;
      const u3 = u + 0.5 * h * k2u, v3 = v + 0.5 * h * k2v;
      const k3u = v3, k3v = 1.5 * u3 * u3 - u3;
      const u4 = u + h * k3u, v4 = v + h * k3v;
      const k4u = v4, k4v = 1.5 * u4 * u4 - u4;
      const un = u + (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u);
      const vn = v + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
      return { un, vn };
    }

    for (let j = 0; j < nCols; j++) {
      if (alive) { uOut[j] = u; vOut[j] = v; } else { uOut[j] = -1; vOut[j] = 0; }
      if (j === nCols - 1) break;
      for (let s = 0; s < sub && alive; s++) {
        const r = step();
        if (r.un >= 1) { alive = false; S = -1; break; }
        if (r.un <= 0) {
          // escaped to infinity: linear interpolation of the zero crossing inside this step
          S = phi + h * (u / (u - r.un));
          alive = false;
          break;
        }
        u = r.un; v = r.vn; phi += h;
      }
    }
    if (alive) {
      // not resolved inside the stored range: keep integrating (no storage) to find S
      const hExt = h;
      let guard = 0;
      while (guard++ < 200000 && phi < 10 * PI) {
        const r = step();
        if (r.un >= 1) { S = -1; alive = false; break; }
        if (r.un <= 0) { S = phi + hExt * (u / (u - r.un)); alive = false; break; }
        u = r.un; v = r.vn; phi += hExt;
      }
      if (alive) S = -1; // winding near the photon sphere: treat as dark
    }
    return S;
  }

  const DEFAULTS = { nPhi: 256, phiMax: 3 * PI, n0: 192, n1: 320, n2: 192, p1: 3, p2: 3, sub: 3, epsPsi: 2e-5 };

  function rowPsi(tab, row) {
    const { n0, n1, n2, p1, p2, psiC, epsPsi, yMax } = tab;
    if (row < n0) return Math.max(1e-4, (row / (n0 - 1)) * PI * 0.5);
    row -= n0;
    if (row < n1) {
      const y = (row / (n1 - 1)) * yMax;
      return psiC - (psiC - PI * 0.5) * Math.pow(1 - y, p1);
    }
    row -= n1;
    const z = row / (n2 - 1);
    return Math.min(PI - 1e-4, psiC + epsPsi + (PI - psiC - epsPsi) * Math.pow(z, p2));
  }

  function build(rc, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const psiC = psiCritical(rc);
    const yMax = 1 - Math.pow(o.epsPsi / (psiC - PI * 0.5), 1 / o.p1);
    const tab = Object.assign({ rc, psiC, yMax, nPsi: o.n0 + o.n1 + o.n2 }, o);
    const data = new Float32Array(tab.nPsi * o.nPhi * 4);
    const uRow = new Float64Array(o.nPhi), vRow = new Float64Array(o.nPhi);
    for (let r = 0; r < tab.nPsi; r++) {
      const psi = rowPsi(tab, r);
      const S = traceRay(psi, rc, o.phiMax, o.nPhi, o.sub, uRow, vRow);
      for (let j = 0; j < o.nPhi; j++) {
        const k = (r * o.nPhi + j) * 4;
        data[k] = uRow[j]; data[k + 1] = vRow[j]; data[k + 2] = S; data[k + 3] = 0;
      }
    }
    tab.data = data;
    return tab;
  }

  // ---- JS mirror of the shader's lookup math (used by tests; the GLSL port uses the same formulas) ----
  function segInfo(tab, psi) {
    const { n0, n1, n2, p1, p2, psiC, epsPsi, yMax } = tab;
    if (psi <= PI * 0.5) return { row: (psi / (PI * 0.5)) * (n0 - 1), lo: 0, hi: n0 - 1 };
    if (psi < psiC - epsPsi) {
      const y = 1 - Math.pow((psiC - psi) / (psiC - PI * 0.5), 1 / p1);
      return { row: n0 + (y / yMax) * (n1 - 1), lo: n0, hi: n0 + n1 - 1 };
    }
    const z = Math.pow(Math.max(0, (psi - psiC - epsPsi) / (PI - psiC - epsPsi)), 1 / p2);
    return { row: n0 + n1 + z * (n2 - 1), lo: n0 + n1, hi: n0 + n1 + n2 - 1 };
  }
  function texel(tab, row, col) {
    const k = (row * tab.nPhi + col) * 4;
    return [tab.data[k], tab.data[k + 1], tab.data[k + 2]];
  }
  function lookup(tab, psi, phi) {
    const s = segInfo(tab, psi);
    const row = Math.min(s.hi, Math.max(s.lo, s.row));
    const col = Math.min(tab.nPhi - 1, Math.max(0, (phi / tab.phiMax) * (tab.nPhi - 1)));
    const r0 = Math.floor(row), r1 = Math.min(r0 + 1, s.hi), fr = row - r0;
    const c0 = Math.floor(col), c1 = Math.min(c0 + 1, tab.nPhi - 1), fc = col - c0;
    const t00 = texel(tab, r0, c0), t01 = texel(tab, r0, c1), t10 = texel(tab, r1, c0), t11 = texel(tab, r1, c1);
    const valid = t00[0] >= 0 && t01[0] >= 0 && t10[0] >= 0 && t11[0] >= 0;
    const mix = (a, b, t) => a + (b - a) * t;
    const u = mix(mix(t00[0], t01[0], fc), mix(t10[0], t11[0], fc), fr);
    const v = mix(mix(t00[1], t01[1], fc), mix(t10[1], t11[1], fc), fr);
    const S = (t00[2] < 0 || t10[2] < 0) ? -1 : mix(t00[2], t10[2], fr);
    return { u: valid ? u : -1, v, S };
  }

  return { build, traceRay, psiCritical, lookup, rowPsi, segInfo, B_CRIT, DEFAULTS };
};
Game.LensTables = Game.__lensFactory();

// ---------------------------------------------------------------------------
// SECTION: SECTORS -- Full 8-Sector Keplerian Solar System around the
// 10,000 M_sun Schwarzschild Black Hole ("Gargantua").
// Dark, gritty hard-sci-fi atmosphere: true pitch-black vacuum, high-contrast
// accretion illumination, and dramatic crescent-lit planetary worlds.
// ---------------------------------------------------------------------------
Game.Sectors = (function () {
  const LIST = [
    {
      id: 'photon_reach',
      name: 'Photon Reach',
      subtitle: 'Inner Accretion Vista & Endurance Orbital Ring',
      radiusRs: 30,
      visualBhRs: 9.5,
      orbitInclinationDeg: 14,
      startAnomaly: Math.PI * 0.5,
      bhYawDeg: 20,
      bhPitchDeg: 4,
      gravityMul: 1.8,
      threat: 'MEDIUM',
      faction: 'Vanguard Patrol / Raider Scouts',
      description: 'Close-in orbital patrol corridor silhouetted against Gargantua’s accretion disk, with Haven’s crescent horizon in the distance.',
      planetType: 'belt_haven',
      color: '#ffb74d',
      waves: [
        { fighter: 3 },
        { fighter: 4 },
        { fighter: 3, gunship: 1 },
        { fighter: 5, gunship: 1 },
        { fighter: 4, gunship: 2 }
      ]
    },
    {
      id: 'cinder',
      name: 'Cinder',
      subtitle: 'Scorched Tidal Magma World (Extreme Gravity Well)',
      radiusRs: 14.0,
      visualBhRs: 7.5,
      orbitInclinationDeg: 6,
      startAnomaly: 0.45,
      bhYawDeg: 22,
      bhPitchDeg: 3,
      gravityMul: 3.6,
      threat: 'HIGH',
      faction: 'Crimson Heavy Harvesters',
      description: 'Tidally locked basalt-and-magma proto-planet skimming the inner accretion ring under intense gravitational shear.',
      planetType: 'lava',
      color: '#ff5522',
      waves: [
        { fighter: 4 },
        { fighter: 4, gunship: 1 },
        { fighter: 5, gunship: 2 },
        { fighter: 4, gunship: 2, corvette: 1 },
        { fighter: 6, gunship: 2, corvette: 1 }
      ]
    },
    {
      id: 'forge',
      name: 'The Forge',
      subtitle: 'Industrial Core-World Hephaestus & Citadel Aegis-IV',
      radiusRs: 22,
      visualBhRs: 8.6,
      orbitInclinationDeg: 11,
      startAnomaly: 2.1,
      bhYawDeg: 22,
      bhPitchDeg: 5,
      gravityMul: 2.4,
      threat: 'HIGH',
      faction: 'Iron Syndicate / Orbital Fortress',
      description: 'Dark metallic core-world encircled by a debris ring and the fortified orbital station Aegis-IV.',
      planetType: 'forge',
      color: '#ffaa00',
      waves: [
        { fighter: 3, gunship: 1 },
        { fighter: 4, gunship: 2 },
        { fighter: 4, gunship: 1, corvette: 1 },
        { fighter: 5, gunship: 2, corvette: 1 },
        { fighter: 5, gunship: 3, corvette: 1 }
      ]
    },
    {
      id: 'haven',
      name: 'Haven Meridian',
      subtitle: 'Atmospheric Terran Biosphere, Moon Selene & Vanguard Dock',
      radiusRs: 48,
      visualBhRs: 10.5,
      orbitInclinationDeg: 15,
      startAnomaly: 3.6,
      bhYawDeg: 21,
      bhPitchDeg: 4,
      gravityMul: 1.4,
      threat: 'LOW-MED',
      faction: 'Meridian Coalition (Allied Sanctuary Dock)',
      description: 'Temperate ocean-continent world with Rayleigh-scattered blue atmospheric limb and night-side city lights.',
      planetType: 'terran',
      color: '#38bdf8',
      waves: [
        { fighter: 3 },
        { fighter: 3, gunship: 1 },
        { fighter: 4, gunship: 1 },
        { fighter: 4, gunship: 2 },
        { fighter: 5, gunship: 2, corvette: 1 }
      ]
    },
    {
      id: 'bastion',
      name: 'Bastion',
      subtitle: 'Arid Canyon Fortress World & Defense Ring',
      radiusRs: 72,
      visualBhRs: 11.5,
      orbitInclinationDeg: 9,
      startAnomaly: 1.2,
      bhYawDeg: 21,
      bhPitchDeg: 5,
      gravityMul: 1.3,
      threat: 'HIGH',
      faction: 'Bastion Armored Garrison',
      description: 'Rust-oxide desert fortress world wrapped in thin amber dust-storm haze and orbital defense batteries.',
      planetType: 'desert',
      color: '#f97316',
      waves: [
        { fighter: 4, gunship: 1 },
        { fighter: 4, gunship: 2 },
        { fighter: 4, gunship: 2, corvette: 1 },
        { fighter: 5, gunship: 2, corvette: 1 },
        { fighter: 5, gunship: 2, corvette: 2 }
      ]
    },
    {
      id: 'leviathan',
      name: 'Leviathan',
      subtitle: 'Ringed Storm Gas Giant & Dreadnought Carrier Zone',
      radiusRs: 105,
      visualBhRs: 12.5,
      orbitInclinationDeg: 8,
      startAnomaly: 4.8,
      bhYawDeg: 20,
      bhPitchDeg: 5,
      gravityMul: 2.1,
      threat: 'EXTREME',
      faction: 'Dreadnought Carrier Valkyrie-IX',
      description: 'Colossal banded storm gas giant with expansive ice rings, staging ground for the enemy Dreadnought Carrier.',
      planetType: 'gasGiant',
      color: '#a855f7',
      waves: [
        { fighter: 4, gunship: 1 },
        { fighter: 4, gunship: 2 },
        { fighter: 3, gunship: 1, corvette: 1 },
        { fighter: 4, gunship: 2, corvette: 1 },
        { fighter: 4, gunship: 1, carrier: 1 }
      ]
    },
    {
      id: 'solis_veil',
      name: 'Solis-B & Veil',
      subtitle: 'Captured K-Dwarf Companion Star & Glaciated World Veil',
      radiusRs: 145,
      visualBhRs: 13.5,
      orbitInclinationDeg: 24,
      startAnomaly: 5.5,
      bhYawDeg: 20,
      bhPitchDeg: 6,
      gravityMul: 1.9,
      threat: 'EXTREME',
      faction: 'Outer Remnant Armada',
      description: 'Captured orange-gold K-dwarf star illuminating the deep-freeze world Veil and Listening Array.',
      planetType: 'starIce',
      color: '#facc15',
      waves: [
        { fighter: 4, corvette: 1 },
        { fighter: 5, gunship: 2 },
        { fighter: 4, gunship: 2, corvette: 1 },
        { fighter: 5, gunship: 2, corvette: 2 },
        { fighter: 5, gunship: 2, corvette: 1, carrier: 1 }
      ]
    },
    {
      id: 'exile',
      name: 'Exile & Phantom',
      subtitle: 'Outer Methanogenic Ice Giant & Nitrogen Glacier Moon',
      radiusRs: 195,
      visualBhRs: 14.5,
      orbitInclinationDeg: 19,
      startAnomaly: 2.8,
      bhYawDeg: 20,
      bhPitchDeg: 5,
      gravityMul: 1.5,
      threat: 'EXTREME',
      faction: 'Deep-Space Phantom Fleet',
      description: 'Outer-system worlds shrouded in dark methane clouds and crystalline rings at the edge of Gargantua’s gravity well.',
      planetType: 'iceGiant',
      color: '#38ef7d',
      waves: [
        { fighter: 5, gunship: 1 },
        { fighter: 5, gunship: 2, corvette: 1 },
        { fighter: 4, gunship: 2, corvette: 2 },
        { fighter: 5, gunship: 2, carrier: 1 },
        { fighter: 6, gunship: 2, corvette: 1, carrier: 1 }
      ]
    }
  ];

  function byId(id) {
    return LIST.find(s => s.id === id) || LIST[0];
  }
  return { LIST, byId };
})();

// ---------------------------------------------------------------------------
// SECTION: ARENA -- Keplerian free-fall reference frame for any orbital sector.
// ---------------------------------------------------------------------------
Game.Arena = (function () {
  const V = Game.Vec3, K = Game.Constants;

  function create(opts) {
    const rs = K.BH_RS;
    const radiusM = opts.radiusRs * rs;
    const orbit = Game.Orbits.initializeOrbit({
      semiMajorAxisAU: radiusM / K.AU, eccentricity: opts.eccentricity || 0,
      inclinationRadians: (opts.orbitInclinationDeg * Math.PI) / 180,
      longitudeAscendingNodeRadians: opts.lanRad || 0, argumentOfPeriapsisRadians: 0,
      meanAnomalyAtEpochRadians: opts.startAnomaly == null ? Math.PI / 2 : opts.startAnomaly, epochSeconds: 0,
    });
    const arena = {
      id: opts.id || 'photon_reach',
      name: opts.name, subtitle: opts.subtitle || '',
      radiusRs: opts.radiusRs,
      visualBhRs: opts.visualBhRs || opts.radiusRs,
      gravityMul: opts.gravityMul || 1.0,
      radiusM, orbit,
      orbitInclinationDeg: opts.orbitInclinationDeg,
      diskNormal: V.v3(0.31, 0.0, 0.9507), diskA1: V.v3(0.9507, 0.0, -0.31), diskA2: V.v3(0, 1, 0),
      diskInnerRs: opts.diskInnerRs || 2.6, diskOuterRs: opts.diskOuterRs || 11.8,
      periodSeconds: orbit.periodSeconds,
    };
    arena.refState = (t) => Game.Orbits.orbitalStateAtTime(orbit, t);
    arena.frameOmega = (out, p, v) => {
      const r2 = V.lengthSq(p);
      V.cross(out, p, v); V.scale(out, out, 1 / r2);
      return out;
    };
    arena.startOrientation = (out, bhYawDeg, bhPitchDeg, t) => {
      const p = arena.refState(t || 0).position;
      const dBH = V.v3(-p.x, -p.y, -p.z); V.normalize(dBH, dBH);
      const up0 = V.v3(); V.addScaled(up0, arena.diskNormal, dBH, -V.dot(arena.diskNormal, dBH)); V.normalize(up0, up0);
      const right0 = V.v3(); V.cross(right0, up0, dBH); V.normalize(right0, right0);
      const th = (bhYawDeg * Math.PI) / 180, ph = (bhPitchDeg * Math.PI) / 180;
      const f = V.v3(
        dBH.x * Math.cos(th) + right0.x * Math.sin(th) + up0.x * Math.sin(ph),
        dBH.y * Math.cos(th) + right0.y * Math.sin(th) + up0.y * Math.sin(ph),
        dBH.z * Math.cos(th) + right0.z * Math.sin(th) + up0.z * Math.sin(ph));
      V.normalize(f, f);
      const up = V.v3(); V.addScaled(up, arena.diskNormal, f, -V.dot(arena.diskNormal, f)); V.normalize(up, up);
      const right = V.v3(); V.cross(right, up, f); V.normalize(right, right);
      return Game.Quat.qFromBasis(out, right, up, f);
    };
    return arena;
  }
  return { create };
})();

// ---------------------------------------------------------------------------
// SECTION: SKY -- Dark, Gritty, High-Contrast Interstellar "Gargantua" Shader.
// True pitch-black cosmic vacuum, pinpoint high-dynamic-range stars, dark dust
// lanes carved between incandescent plasma filaments, razor-sharp photon ring,
// and optical visor filters.
// ---------------------------------------------------------------------------
Game.Sky = (function () {
  const VERT = [
    'precision highp float;',
    'attribute vec3 position;',
    'attribute vec2 uv;',
    'varying vec2 vUV;',
    'void main(void) {',
    '  vUV = uv;',
    '  gl_Position = vec4(position.x * 2.0, position.y * 2.0, 1.0, 1.0);',
    '}'].join('\n');

  const FRAG = `
precision highp float;
varying vec2 vUV;
uniform vec3 camRight;
uniform vec3 camUp;
uniform vec3 camForward;
uniform float tanHalfFov;
uniform float aspect;
uniform vec3 rHat;
uniform vec3 diskN;
uniform vec3 diskA1;
uniform vec3 diskA2;
uniform vec3 galaxyN;
uniform float time;
uniform float uPsiC;
uniform float uYMax;
uniform float uUc;
uniform float uWarp;
uniform float uFilterMode;
uniform float uExposure;
uniform float uGain;
uniform float uGrit;
uniform float uRScale;
uniform sampler2D lens;
uniform sampler2D diskTex;
const float PI = 3.14159265359;
const float HALF_PI = 1.57079632679;

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash31(i);
  float b = hash31(i + vec3(1.0, 0.0, 0.0));
  float c = hash31(i + vec3(0.0, 1.0, 0.0));
  float d = hash31(i + vec3(1.0, 1.0, 0.0));
  float e = hash31(i + vec3(0.0, 0.0, 1.0));
  float g = hash31(i + vec3(1.0, 0.0, 1.0));
  float h = hash31(i + vec3(0.0, 1.0, 1.0));
  float k = hash31(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z);
}
float fbm3(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 3; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s;
}

vec3 starLayer(vec3 dir, float scale, float sizeAng, float fp, float bright, float seed, float thr) {
  vec3 p = dir * scale + seed;
  vec3 cell = floor(p);
  float h0 = hash31(cell);
  if (h0 < thr) return vec3(0.0);
  vec3 off = vec3(hash31(cell + 1.7), hash31(cell + 5.3), hash31(cell + 9.1));
  vec3 sp = cell + 0.2 + 0.6 * off - seed;
  float ang = length(dir - normalize(sp));
  float rad = max(sizeAng, 0.65 * fp);
  float k = sizeAng / rad;
  k = k * k;
  float mag = pow(hash31(cell + 3.1), 10.0);
  float inten = smoothstep(rad, 0.0, ang) * k * bright * (0.06 + 4.5 * mag);
  vec3 tint = mix(vec3(1.0, 0.82, 0.62), vec3(0.70, 0.85, 1.0), hash31(cell + 8.8));
  return tint * inten;
}

// True pitch-black deep space with crisp pinpoint stars & faint dark-matter dust rifts
vec3 skyColor(vec3 dir, float fp) {
  vec3 c = vec3(0.0);
  c += starLayer(dir, 52.0, 0.0018, fp, 1.25, 0.0, 0.945);
  c += starLayer(dir, 110.0, 0.0013, fp, 0.90, 11.3, 0.965);
  c += starLayer(dir, 220.0, 0.0009, fp, 0.65, 27.9, 0.980);
  float b = dot(dir, galaxyN);
  float band = exp(-b * b / 0.035);
  if (band > 0.02) {
    float cloud = fbm3(dir * 3.8 + 4.0);
    float rift = smoothstep(0.42, 0.72, fbm3(dir * 7.5 - 2.1));
    c += vec3(0.08, 0.06, 0.11) * band * cloud * cloud * rift * 0.14;
  }
  return c;
}

vec4 fetchT(float row, float col) {
  return texture2D(lens, vec2((col + 0.5) / NPHI, (row + 0.5) / NPSI));
}
void psiToRow(float psi, float psiC, float yMax, out float row, out float lo, out float hi) {
  if (psi <= HALF_PI) {
    row = psi / HALF_PI * (N0 - 1.0);
    lo = 0.0;
    hi = N0 - 1.0;
  } else if (psi < psiC - EPS_PSI) {
    float y = 1.0 - pow(max(0.0, (psiC - psi) / (psiC - HALF_PI)), 1.0 / P1);
    row = N0 + (y / max(1e-4, yMax)) * (N1 - 1.0);
    lo = N0;
    hi = N0 + N1 - 1.0;
  } else {
    float z = pow(max(0.0, (psi - psiC - EPS_PSI) / max(1e-4, PI - psiC - EPS_PSI)), 1.0 / P2);
    row = N0 + N1 + z * (N2 - 1.0);
    lo = N0 + N1;
    hi = N0 + N1 + N2 - 1.0;
  }
}
vec4 lensBilinear(float row, float col, float lo, float hi) {
  row = clamp(row, lo, hi);
  col = clamp(col, 0.0, NPHI - 1.0);
  float r0 = floor(row);
  float r1 = min(r0 + 1.0, hi);
  float fr = row - r0;
  float c0 = floor(col);
  float c1 = min(c0 + 1.0, NPHI - 1.0);
  float fc = col - c0;
  vec4 t00 = fetchT(r0, c0);
  vec4 t01 = fetchT(r0, c1);
  vec4 t10 = fetchT(r1, c0);
  vec4 t11 = fetchT(r1, c1);
  if (t00.x < 0.0 || t01.x < 0.0 || t10.x < 0.0 || t11.x < 0.0) return vec4(-1.0);
  return mix(mix(t00, t01, fc), mix(t10, t11, fc), fr);
}

// High-contrast gritty Gargantua palette: soot-black -> smoldering rust-copper -> molten gold -> blinding white
vec3 gargantuaColor(float t, float dopplerG, float filterMode) {
  if (filterMode > 1.5 && filterMode < 2.5) {
    vec3 c = mix(vec3(0.85, 0.12, 0.32), vec3(1.0, 0.72, 0.22), smoothstep(0.65, 1.05, dopplerG));
    c = mix(c, vec3(0.20, 0.90, 1.0), smoothstep(1.05, 1.55, dopplerG));
    return c * (0.5 + 0.85 * t);
  }
  vec3 c = mix(vec3(0.05, 0.012, 0.004), vec3(0.58, 0.24, 0.07), smoothstep(0.12, 0.45, t));
  c = mix(c, vec3(0.95, 0.62, 0.30), smoothstep(0.40, 0.76, t));
  c = mix(c, vec3(1.0, 0.89, 0.72), smoothstep(0.58, 0.95, t));
  c = mix(c, vec3(1.0, 0.98, 0.94), smoothstep(0.80, 1.25, t));
  c = mix(c, vec3(0.90, 0.95, 1.0), smoothstep(1.15, 1.9, t));
  return c;
}

vec4 diskSample(float phi, vec4 L, vec3 rH, vec3 tH, float ucVal, int passIdx, float filterMode) {
  float ue = L.x / uRScale;
  float r = 1.0 / ue;
  vec3 h = cos(phi) * rH + sin(phi) * tH;
  float theta = atan(dot(h, diskA2), dot(h, diskA1));
  float lr = log(r);
  float omega = DISK_SPIN * 0.85 * pow(R_IN / r, 1.5);
  float ang = theta - omega * time + 4.6 * lr;

  // High-contrast sheared plasma filaments with dark dust gaps carved between streams
  float dU = fract(ang * 0.15915494);
  float dV = clamp((lr - LR_MIN) / (LR_MAX - LR_MIN), 0.0, 1.0);
  float rawWisp = texture2D(diskTex, vec2((dU * DISK_W + 0.5) / (DISK_W + 1.0), (dV * (DISK_H - 1.0) + 0.5) / DISK_H)).r;
  // Carve dark gritty dust lanes so the disk has real shadow veins like shared_image.jpg
  float dustGap = mix(0.80, smoothstep(0.22, 0.70, rawWisp), uGrit);
  float fibers = 0.55 + 0.75 * pow(dustGap, 1.3);

  float normR = clamp((r - R_IN) / (R_OUT - R_IN), 0.0, 1.0);
  float tRel = pow(R_IN / r, 0.76) * (1.0 - 0.42 * normR);
  float edgeIn = smoothstep(R_IN, R_IN * 1.04, r);
  float edgeOut = pow(1.0 - smoothstep(R_OUT * 0.22, R_OUT, r), 2.1);
  float sq = sqrt(max(1.0 - ue, 1e-4));
  float cotE = -(L.y / uRScale) / (ue * sq);
  float sinE = 1.0 / sqrt(1.0 + cotE * cotE);
  float cosE = cotE * sinE;
  vec3 tAt = -sin(phi) * rH + cos(phi) * tH;
  vec3 nPh = -(cosE * h + sinE * tAt);
  vec3 vHat = normalize(cross(diskN, h)) * DISK_SPIN;
  float beta = sqrt(1.0 / (2.0 * max(r - 1.0, 0.5)));
  float gam = 1.0 / sqrt(1.0 - beta * beta);
  float g = (sq / sqrt(max(0.05, 1.0 - ucVal))) / (gam * (1.0 - beta * dot(vHat, nPh)));
  g = clamp(g, 0.58, 2.10);
  if (!(filterMode > 1.5 && filterMode < 2.5)) g = 1.0 + (g - 1.0) * 0.5;
  float T = tRel * (0.45 + 0.55 * g) * (0.65 + 0.45 * dustGap);
  float inten = pow(tRel, 2.15) * pow(g, 2.05) * fibers * (passIdx == 0 ? 5.2 : 3.7) * edgeOut;
  if (filterMode > 2.5) {
    inten *= 0.14;
  } else if (filterMode < 0.5) {
    inten *= 2.3;
  } else if (filterMode < 1.5) {
    inten *= 1.7;
  }
  vec3 emit = gargantuaColor(T, g, filterMode) * inten;
  float a = clamp((0.5 + 0.5 * dustGap) * 0.95 * edgeIn * edgeOut, 0.0, 0.98);
  return vec4(emit, a);
}

vec3 tonemap(vec3 x) {
  vec3 c = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}

void main(void) {
  vec2 ndc = vUV * 2.0 - 1.0;
  float fovScale = tanHalfFov * (1.0 + uWarp * 0.55);
  vec3 d = normalize(camForward + ndc.x * aspect * fovScale * camRight + ndc.y * fovScale * camUp);
  float cosP = dot(d, rHat);
  vec3 tang = d - cosP * rHat;
  float sinP = length(tang);
  float psi = atan(sinP, cosP);
  vec3 tHat;
  if (sinP > 1e-5) {
    tHat = tang / sinP;
  } else {
    vec3 any = abs(rHat.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    tHat = normalize(cross(rHat, any));
  }

  float psiC = uPsiC > 0.1 ? uPsiC : PSI_C;
  float yMax = uYMax > 0.01 ? uYMax : Y_MAX;
  float ucVal = uUc > 1e-5 ? uUc : UC;

  float row;
  float lo;
  float hi;
  psiToRow(psi, psiC, yMax, row, lo, hi);
  float rr = clamp(row, lo, hi);
  float r0 = floor(rr);
  float r1 = min(r0 + 1.0, hi);
  float fr = rr - r0;
  float s0 = fetchT(r0, 0.0).z;
  float s1 = fetchT(r1, 0.0).z;
  float S = (s0 < 0.0 || s1 < 0.0) ? -1.0 : mix(s0, s1, fr);

  vec3 dEnd = S >= 0.0 ? (cos(S) * rHat + sin(S) * tHat) : d;
  float fp = length(fwidth(dEnd));
  vec3 bg = S >= 0.0 ? skyColor(dEnd, fp) : vec3(0.0);

  // Razor-sharp critical Photon Ring + secondary inner lensed rim against pitch-black shadow
  float shadowRad = PI - psiC;
  float dCrit = psi - psiC;
  bool inShadow = psi > psiC;
  float thinRing = exp(-abs(dCrit) / max(0.00035, shadowRad * 0.011)) * 3.4;
  float innerArc = exp(-abs(dCrit - shadowRad * 0.082) / max(0.0004, shadowRad * 0.013)) * 1.15;
  float outerGlow = inShadow ? 0.0 : exp(dCrit / max(0.0025, shadowRad * 0.15)) * 0.28;
  vec3 ringCol = vec3(1.0, 0.94, 0.80) * (thinRing + innerArc) + vec3(0.90, 0.42, 0.10) * outerGlow;

  vec3 accum = ringCol;
  float trans = 1.0;
  if (!inShadow && psi > HALF_PI * 0.60 && sinP > 1e-4) {
    vec3 nOrb = cross(rHat, tHat);
    vec3 ell = cross(nOrb, diskN);
    float ellLen = length(ell);
    if (ellLen > 1e-4) {
      ell = ell / ellLen;
      float alpha = atan(dot(ell, tHat), dot(ell, rHat));
      if (alpha < 0.0) alpha += PI;
      for (int m = 0; m < DISK_PASSES; m++) {
        float phi = alpha + float(m) * PI;
        vec4 L = lensBilinear(row, phi / PHI_MAX * (NPHI - 1.0), lo, hi);
        if (L.x > 0.0) {
          float r = uRScale / L.x;
          if (r > R_IN && r < R_OUT) {
            vec4 ds = diskSample(phi, L, rHat, tHat, ucVal, m, uFilterMode);
            accum += trans * ds.a * ds.rgb;
            trans *= (1.0 - ds.a);
          }
        }
      }
    }
  }

  // Foreground equatorial accretion sheet slicing across the front of Gargantua's shadow (shared_image.jpg)
  vec3 bhRight = normalize(cross(diskN, rHat));
  vec3 bhUp = cross(rHat, bhRight);
  float xDisk = dot(d, bhRight) / max(0.04, shadowRad);
  float yDisk = (dot(d, bhUp) + shadowRad * 0.10) / max(0.04, shadowRad);
  float bandEnv = exp(-yDisk * yDisk * 26.0) * smoothstep(1.9, 0.2, abs(xDisk));
  if (bandEnv > 0.004 && uFilterMode < 2.5) {
    float rBand = clamp(R_IN + abs(xDisk) * (R_OUT - R_IN) * 0.38, R_IN * 1.02, R_OUT * 0.98);
    float lrB = log(rBand);
    float angB = xDisk * 1.6 - DISK_SPIN * 0.85 * pow(R_IN / rBand, 1.5) * time + 4.2 * lrB;
    float fb1 = fbm3(vec3(angB * 1.6, yDisk * 5.0, lrB * 6.0));
    float fb2 = vnoise(vec3(angB * 3.8, yDisk * 10.0, lrB * 12.0));
    float wispB = smoothstep(0.2, 0.75, 0.78 * fb1 + 0.22 * fb2);
    float streakB = 0.5 + 1.0 * pow(wispB, 1.2);
    float dopplerFront = clamp(1.15 - 0.38 * clamp(xDisk * 0.65, -1.0, 1.0), 0.65, 1.75);
    float coreHot = exp(-yDisk * yDisk * 38.0) * exp(-abs(xDisk) * 0.65);
    vec3 frontCol = gargantuaColor(0.48 + 0.58 * coreHot * wispB, dopplerFront, uFilterMode);
    float frontInten = bandEnv * streakB * (2.4 + 3.4 * coreHot) * (uFilterMode < 0.5 ? 2.2 : (uFilterMode < 1.5 ? 1.5 : 1.0));
    float frontAlpha = clamp(bandEnv * streakB * 0.95, 0.0, 0.98);
    accum = accum * (1.0 - frontAlpha * 0.72) + frontCol * frontInten;
    trans *= (1.0 - frontAlpha);
  }

  // Tight equatorial glare (keeps surrounding space pitch-black!)
  float radialDist = PI - psi;
  float anamorphic = exp(-yDisk * yDisk * 24.0) * exp(-max(0.0, abs(xDisk) - 0.5) / 0.55);
  float glareStrength = uFilterMode < 0.5 ? 1.85 : (uFilterMode > 2.5 ? 0.05 : 0.28);
  accum += vec3(1.0, 0.72, 0.32) * anamorphic * glareStrength;
  if (uFilterMode >= 0.5 && uFilterMode < 2.5) {
    float halo = exp(-max(0.0, radialDist - shadowRad * 0.35) / (shadowRad * 0.9)) * (inShadow ? 0.0 : 1.0);
    accum += vec3(1.0, 0.84, 0.66) * halo * 0.55;
  }
  if (uFilterMode < 0.5) {
    float rawBloom = exp(-max(0.0, radialDist - shadowRad * 0.35) / (shadowRad * 1.15)) * (inShadow ? 0.25 : 1.0);
    accum += vec3(1.0, 0.85, 0.58) * rawBloom * 1.45;
  }

  vec3 col = accum + trans * bg * uExposure;
  if (uWarp > 0.01) {
    float rNdc = length(ndc);
    float streak = smoothstep(0.15, 1.25, rNdc) * uWarp;
    float angW = atan(ndc.y, ndc.x);
    float tunnel = 0.5 + 0.5 * sin(angW * 24.0 + time * 18.0 + rNdc * 12.0);
    col += vec3(0.18, 0.65, 1.0) * streak * (0.35 + 0.65 * tunnel) * 1.4;
  }
  gl_FragColor = vec4(tonemap(col * EXPOSURE * uGain), 1.0);
}
`;

  // Bakes the disk filament pattern (a pure function of angle and log-radius) once, instead of 7 noise calls per pixel per pass.
  const diskBakeCache = Object.create(null);
  function bakeDiskTex(W, H, lrMin, lrMax) {
    const fr = (x) => x - Math.floor(x);
    const h31 = (x, y, z) => {
      x = fr(x * 0.1031); y = fr(y * 0.1031); z = fr(z * 0.1031);
      const d = x * (z + 31.32) + y * (y + 31.32) + z * (x + 31.32);
      x += d; y += d; z += d;
      return fr((x + y) * z);
    };
    const vn = (px, py, pz) => {
      const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
      let fx = px - ix, fy = py - iy, fz = pz - iz;
      fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
      const a = h31(ix, iy, iz), b = h31(ix + 1, iy, iz), c = h31(ix, iy + 1, iz), d = h31(ix + 1, iy + 1, iz);
      const e = h31(ix, iy, iz + 1), g = h31(ix + 1, iy, iz + 1), h = h31(ix, iy + 1, iz + 1), k = h31(ix + 1, iy + 1, iz + 1);
      const x0 = a + (b - a) * fx, x1 = c + (d - c) * fx, x2 = e + (g - e) * fx, x3 = h + (k - h) * fx;
      const y0 = x0 + (x1 - x0) * fy, y1 = x2 + (x3 - x2) * fy;
      return y0 + (y1 - y0) * fz;
    };
    const fbm = (px, py, pz) => {
      let a = 0.5, sum = 0;
      for (let i = 0; i < 3; i++) { sum += a * vn(px, py, pz); px = px * 2.03 + 17.1; py = py * 2.03 + 17.1; pz = pz * 2.03 + 17.1; a *= 0.5; }
      return sum;
    };
    const data = new Uint8Array((W + 1) * H * 4);
    for (let j = 0; j < H; j++) {
      const lr = lrMin + (j / (H - 1)) * (lrMax - lrMin);
      for (let i = 0; i <= W; i++) {
        const ang = ((i % W) / W) * 6.283185307;
        const c1 = Math.cos(ang), s1 = Math.sin(ang);
        const f1 = fbm(c1 * 1.6, s1 * 1.6, lr * 8.5);
        const f2 = fbm(Math.cos(ang * 3 + 1.4) * 2.2, Math.sin(ang * 3 + 1.4) * 2.2, lr * 19 - f1 * 2.8);
        const f3 = vn(Math.cos(ang * 6) * 1.5, Math.sin(ang * 6) * 1.5, lr * 38 + f2 * 3.2);
        const raw = f1 * 0.62 + f2 * 0.24 + f3 * 0.10;
        const o = (j * (W + 1) + i) * 4;
        data[o] = Math.max(0, Math.min(255, Math.round(raw * 255)));
        data[o + 3] = 255;
      }
    }
    return data;
  }

  function create(scene, arena, opts) {
    opts = opts || {};
    const lutCache = Object.create(null);
    let rc = arena.radiusRs;
    function getTab(r) {
      const key = Math.round(r * 2) / 2;
      if (!lutCache[key]) lutCache[key] = Game.LensTables.build(key);
      return lutCache[key];
    }
    let tab = null;
    let visTab = getTab(arena.visualBhRs || 14.8);
    const tex = BABYLON.RawTexture.CreateRGBATexture(visTab.data, visTab.nPhi, visTab.nPsi, scene, false, false,
      BABYLON.Constants.TEXTURE_NEAREST_SAMPLINGMODE, BABYLON.Constants.TEXTURETYPE_FLOAT);
    tex.wrapU = BABYLON.Constants.TEXTURE_CLAMP_ADDRESSMODE; tex.wrapV = BABYLON.Constants.TEXTURE_CLAMP_ADDRESSMODE;

    const f = (n) => (Number.isInteger(n) ? n.toFixed(1) : String(n));
    const defs = [
      ['N0', visTab.n0], ['N1', visTab.n1], ['N2', visTab.n2], ['NPHI', visTab.nPhi], ['NPSI', visTab.nPsi],
      ['PSI_C', visTab.psiC], ['EPS_PSI', visTab.epsPsi], ['Y_MAX', visTab.yMax], ['P1', visTab.p1], ['P2', visTab.p2],
      ['PHI_MAX', visTab.phiMax], ['R_IN', arena.diskInnerRs || 2.6], ['R_OUT', arena.diskOuterRs || 11.8], ['UC', 1 / visTab.rc],
      ['LR_MIN', Math.log(arena.diskInnerRs || 2.6)], ['LR_MAX', Math.log(arena.diskOuterRs || 11.8)], ['DISK_W', 512], ['DISK_H', 256],
      ['DISK_SPIN', opts.diskSpin || 1], ['EXPOSURE', opts.exposure || 1.08],
    ].map(([k, v]) => '#define ' + k + ' ' + f(v)).join('\n') + '\n#define DISK_PASSES ' + (opts.lowQuality ? 2 : 3) + '\n';

    BABYLON.Effect.ShadersStore.bhSkyVertexShader = VERT;
    BABYLON.Effect.ShadersStore.bhSkyFragmentShader = defs + FRAG;
    const mat = new BABYLON.ShaderMaterial('bhSky', scene, { vertex: 'bhSky', fragment: 'bhSky' }, {
      attributes: ['position', 'uv'],
      uniforms: ['camRight', 'camUp', 'camForward', 'tanHalfFov', 'aspect', 'rHat', 'diskN', 'diskA1', 'diskA2', 'galaxyN', 'time', 'uPsiC', 'uYMax', 'uUc', 'uWarp', 'uExposure', 'uFilterMode', 'uGain', 'uRScale', 'uGrit'],
      samplers: ['lens', 'diskTex'],
    });
    mat.backFaceCulling = false;
    mat.disableDepthWrite = true;
    mat.setTexture('lens', tex);
    const diskKey = (arena.diskInnerRs || 2.6) + '/' + (arena.diskOuterRs || 11.8);
    const diskBytes = diskBakeCache[diskKey] || (diskBakeCache[diskKey] = bakeDiskTex(512, 256, Math.log(arena.diskInnerRs || 2.6), Math.log(arena.diskOuterRs || 11.8)));
    mat.setTexture('diskTex', BABYLON.RawTexture.CreateRGBATexture(diskBytes, 513, 256, scene, false, false,
      BABYLON.Constants.TEXTURE_BILINEAR_SAMPLINGMODE, BABYLON.Constants.TEXTURETYPE_UNSIGNED_INT));
    const V3 = BABYLON.Vector3;
    mat.setVector3('diskN', new V3(arena.diskNormal.x, arena.diskNormal.y, arena.diskNormal.z));
    mat.setVector3('diskA1', new V3(arena.diskA1.x, arena.diskA1.y, arena.diskA1.z));
    mat.setVector3('diskA2', new V3(arena.diskA2.x, arena.diskA2.y, arena.diskA2.z));
    const gn = new V3(0.25, 0.9, 0.35); gn.normalize(); mat.setVector3('galaxyN', gn);
    mat.setFloat('uPsiC', visTab.psiC);
    mat.setFloat('uYMax', visTab.yMax);
    mat.setFloat('uUc', 1 / visTab.rc);
    mat.setFloat('uWarp', 0);
    mat.setFloat('uFilterMode', 1.0);
    mat.setFloat('uExposure', 1.0);
    mat.setFloat('uGain', 1.0);
    mat.setFloat('uRScale', 1.0);
    mat.setFloat('uGrit', 0.5);

    const quad = BABYLON.MeshBuilder.CreatePlane('bhSkyQuad', { size: 1 }, scene);
    quad.material = mat; quad.alwaysSelectAsActiveMesh = true; quad.isPickable = false; quad.renderingGroupId = 1; quad.isSky = true;

    // ---- Live lens-table streaming ----------------------------------------------------------------
    // The observer radius now changes continuously while diving at the hole. Exact tables are rebuilt in a
    // Web Worker (zero main-thread cost) whenever the radius drifts ~6% from the table in use; between
    // swaps the shader rescales the table's disk-plane radii by uRScale = r_live / r_table (first-order
    // exact, residual error is second order, i.e. well under a pixel).
    let tabRs = visTab.rc, busy = false, worker = null, workerOK = true, lastSync = 0, lastV = 0, lastVt = 0;
    function initWorker() {
      if (worker || !workerOK) return;
      try {
        const src = 'const LT=(' + Game.__lensFactory.toString() + ')();onmessage=function(e){const t=LT.build(e.data.rc);' +
          'postMessage({rc:e.data.rc,nPhi:t.nPhi,nPsi:t.nPsi,data:t.data},[t.data.buffer]);};';
        worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
        worker.onmessage = (e) => { busy = false; applyTable(e.data); };
        worker.onerror = () => { workerOK = false; busy = false; worker = null; };
      } catch (_e) { workerOK = false; worker = null; }
    }
    function applyTable(t) {
      tabRs = t.rc;
      if (tex.updateData) tex.updateData(scene, t.data, t.nPhi, t.nPsi);
    }
    function ensureTable(vRs, rate) {
      if (busy || Math.abs(Math.log(vRs / tabRs)) < 0.06) return;
      const want = Math.max(2.3, Math.min(60, vRs + rate * 0.9));
      initWorker();
      if (worker) { busy = true; worker.postMessage({ rc: want }); return; }
      const now = performance.now();
      if (now - lastSync < 3000) return;
      lastSync = now;
      const t = Game.LensTables.build(want);
      applyTable({ rc: want, nPhi: t.nPhi, nPsi: t.nPsi, data: t.data });
    }

    function mapToVisualRs(physicalRs) {
      return Math.max(13.5, Math.min(22.0, 13.5 + Math.pow(Math.max(0, physicalRs - 12), 0.48) * 0.52));
    }

    function setRadiusRs(newRc, visualOverride) {
      rc = Math.max(3.5, newRc);
      const vRs = visualOverride || mapToVisualRs(rc);
      visTab = getTab(vRs); tabRs = visTab.rc;
      if (tex.updateData) tex.updateData(scene, visTab.data, visTab.nPhi, visTab.nPsi);
      mat.setFloat('uRScale', 1.0);
      mat.setFloat('uPsiC', visTab.psiC);
      mat.setFloat('uYMax', visTab.yMax);
      mat.setFloat('uUc', 1 / visTab.rc);
    }

    let filterMode = 1;
    function setFilterMode(m) {
      filterMode = m | 0;
      mat.setFloat('uFilterMode', filterMode);
    }
    function getFilterMode() { return filterMode; }

    const vR = new V3(), vU = new V3(), vF = new V3(), vH = new V3();
    function update(camera, engine, rHat, timeSeconds, camPos, lookAt, up, liveRc, warpFactor) {
      let fx = lookAt.x - camPos.x, fy = lookAt.y - camPos.y, fz = lookAt.z - camPos.z;
      let l = Math.hypot(fx, fy, fz) || 1; fx /= l; fy /= l; fz /= l;
      let rx = up.y * fz - up.z * fy, ry = up.z * fx - up.x * fz, rz = up.x * fy - up.y * fx;
      l = Math.hypot(rx, ry, rz) || 1; rx /= l; ry /= l; rz /= l;
      const ux = fy * rz - fz * ry, uy = fz * rx - fx * rz, uz = fx * ry - fy * rx;
      vF.copyFromFloats(fx, fy, fz); vR.copyFromFloats(rx, ry, rz); vU.copyFromFloats(ux, uy, uz);
      vH.copyFromFloats(rHat.x, rHat.y, rHat.z);
      mat.setVector3('camForward', vF); mat.setVector3('camRight', vR); mat.setVector3('camUp', vU);
      mat.setVector3('rHat', vH);
      mat.setFloat('tanHalfFov', Math.tan(camera.fov * 0.5));
      mat.setFloat('aspect', engine.getAspectRatio(camera));
      mat.setFloat('time', timeSeconds);
      if (liveRc && liveRc > 2.1) {
        const vRs = liveRc;
        const dtv = timeSeconds - lastVt;
        const rate = (dtv > 0.001 && dtv < 0.5 && lastV) ? (vRs - lastV) / dtv : 0;
        lastV = vRs; lastVt = timeSeconds;
        ensureTable(vRs, Math.max(-3, Math.min(3, rate)));
        const psiC = Game.LensTables.psiCritical(vRs);
        const yMax = 1 - Math.pow(visTab.epsPsi / Math.max(1e-4, psiC - Math.PI * 0.5), 1 / visTab.p1);
        mat.setFloat('uPsiC', psiC);
        mat.setFloat('uYMax', yMax);
        mat.setFloat('uUc', 1 / vRs);
        mat.setFloat('uRScale', vRs / tabRs);
        const gt = Math.min(1, Math.max(0, (11.0 - vRs) / 6.5)); mat.setFloat('uGrit', 0.28 + 0.72 * gt * gt * (3 - 2 * gt));
      }
      {
        const E = window.__BH_EXPO;
        const bhCos = -(fx * rHat.x + fy * rHat.y + fz * rHat.z);
        const vr = liveRc || 14;
        const cl = Math.min(1, Math.max(0, Math.log(18 / Math.max(2.3, vr)) / Math.log(18 / 2.3)));
        const look = Math.pow(Math.min(1, Math.max(0, (bhCos - 0.10) / 0.90)), 1.2);
        const glare = look * (0.55 + 0.45 * cl);
        const target = 1.3 - 0.68 * glare;                           // star/background exposure (as before)
        const gTarget = 1.0 - 0.58 * Math.pow(cl, 0.85) * look;      // whole-frame stop-down: keeps the disk at a "photographic" brightness up close
        const dtE = Math.min(0.25, Math.max(0, timeSeconds - (E.t || timeSeconds))); E.t = timeSeconds;
        const k = 1 - Math.exp(-dtE / (target < E.value ? 0.35 : 1.6));
        E.value = E.auto ? E.value + (target - E.value) * k : 1.0;
        if (E.gain === undefined) E.gain = 1.0;
        const kg = 1 - Math.exp(-dtE / (gTarget < E.gain ? 0.30 : 1.4));
        E.gain = E.auto ? E.gain + (gTarget - E.gain) * kg : 1.0;
        mat.setFloat('uExposure', E.value);
        mat.setFloat('uGain', E.gain);
      }
      mat.setFloat('uWarp', warpFactor || 0);
      mat.setFloat('uFilterMode', filterMode);
    }
    return { mesh: quad, material: mat, get table() { return tab || (tab = getTab(rc)); },
      get tableRs() { return tabRs; }, update, setRadiusRs, setFilterMode, getFilterMode, mapToVisualRs };
  }
  return { create };
})();

// ---------------------------------------------------------------------------
// SECTION: DUST -- Subtle micro-debris velocity streaks in dark space.
// ---------------------------------------------------------------------------
Game.Dust = (function () {
  function create(scene, count, boxM) {
    const rng = Game.Rng.createRng(424242);
    const pts = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pts[i] = (rng.next() - 0.5) * boxM;
    const bright = new Float32Array(count);
    for (let i = 0; i < count; i++) bright[i] = 0.15 + 0.55 * rng.next();
    const lines = [], colors = [];
    for (let i = 0; i < count; i++) {
      lines.push([new BABYLON.Vector3(0, 0, 0), new BABYLON.Vector3(0, 0, 1)]);
      colors.push([new BABYLON.Color4(0.85, 0.78, 0.68, 0.0), new BABYLON.Color4(0.95, 0.88, 0.78, bright[i] * 0.55)]);
    }
    const mesh = BABYLON.MeshBuilder.CreateLineSystem('dust', { lines, colors, updatable: true }, scene);
    mesh.alwaysSelectAsActiveMesh = true; mesh.isPickable = false; mesh.renderingGroupId = 1;
    const buf = new Float32Array(count * 6);
    function wrap(v, c, L) { let d = v - c; d -= L * Math.round(d / L); return c + d; }
    function update(cam, shipVel, warpBoost) {
      const sp = Math.hypot(shipVel.x, shipVel.y, shipVel.z) + (warpBoost || 0) * 2800;
      const len = Math.min(200, Math.max(0.4, sp * 0.05));
      let dx = 0, dy = 0, dz = 1;
      if (sp > 1e-3) {
        const vLen = Math.hypot(shipVel.x, shipVel.y, shipVel.z);
        if (vLen > 1) { dx = -shipVel.x / vLen; dy = -shipVel.y / vLen; dz = -shipVel.z / vLen; }
      }
      for (let i = 0; i < count; i++) {
        const x = wrap(pts[i * 3], cam.x, boxM), y = wrap(pts[i * 3 + 1], cam.y, boxM), z = wrap(pts[i * 3 + 2], cam.z, boxM);
        const k = i * 6;
        buf[k] = x; buf[k + 1] = y; buf[k + 2] = z;
        buf[k + 3] = x + dx * len; buf[k + 4] = y + dy * len; buf[k + 5] = z + dz * len;
      }
      mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, buf);
    }
    function shift(off) { for (let i = 0; i < count; i++) { pts[i * 3] -= off.x; pts[i * 3 + 1] -= off.y; pts[i * 3 + 2] -= off.z; } }
    return { mesh, update, shift };
  }
  return { create };
})();

// ---------------------------------------------------------------------------
// SECTION: CELESTIAL -- Realistic Crescent-Phase Planetary Worlds with
// Rayleigh + Mie Volumetric Limb Scattering, Cloud Shadows, and Endurance
// Ring Station. Clean, uncluttered composition (one primary world per sector).
// ---------------------------------------------------------------------------
Game.Celestial = (function () {
  const PLANET_VS = [
    'precision highp float;',
    'attribute vec3 position;',
    'attribute vec3 normal;',
    'attribute vec2 uv;',
    'uniform mat4 world;',
    'uniform mat4 viewProjection;',
    'varying vec3 vNorm;',
    'varying vec3 vLocal;',
    'varying vec3 vWPos;',
    'varying vec2 vUV;',
    'void main(void) {',
    '  vLocal = normalize(position);',
    '  vec4 wp = world * vec4(position, 1.0);',
    '  vWPos = wp.xyz;',
    '  vNorm = normalize(mat3(world[0].xyz, world[1].xyz, world[2].xyz) * normal);',
    '  vUV = uv;',
    '  gl_Position = viewProjection * wp;',
    '}'
  ].join('\n');

  const PLANET_FS = `
precision highp float;
varying vec3 vNorm;
varying vec3 vLocal;
varying vec3 vWPos;
varying vec2 vUV;
uniform vec3 uCamPos;
uniform vec3 uLightDir;
uniform float uTime;
uniform float uMode;
uniform float uExposure;
vec3 bhFilm(vec3 x){vec3 c=(x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14);return pow(clamp(c,0.0,1.0),vec3(1.0/2.2));}

float hash3(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}
float fbm5(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise3(p); p = p * 2.05 + 13.7; a *= 0.5; }
  return s;
}

vec3 atmosphereScattering(vec3 N, vec3 V, vec3 L, vec3 rayleighCol, vec3 mieCol, float density) {
  float ndv = max(0.0, dot(N, V));
  float ndl = dot(N, L);
  float limb = pow(1.0 - ndv, 3.8) * density;
  float outerRim = pow(1.0 - ndv, 7.2) * density;
  float sunWrap = smoothstep(-0.22, 0.72, ndl);
  float twilight = exp(-ndl * ndl * 14.0) * smoothstep(-0.32, 0.22, ndl) * pow(1.0 - ndv, 2.2);
  vec3 scatter = rayleighCol * limb * (0.12 + 0.88 * sunWrap) * 0.68
               + mieCol * twilight * 0.38
               + mix(rayleighCol, vec3(0.75, 0.92, 1.0), 0.45) * outerRim * (0.20 + 0.85 * sunWrap) * 1.25;
  return scatter;
}

void main(void) {
  vec3 N0 = normalize(vNorm);
  vec3 V = normalize(uCamPos - vWPos);
  // True dramatic space terminator: light comes from the Black Hole on the left (-uLightDir) with a 55% day / 45% pitch-black shadow crescent
  vec3 L = normalize(-uLightDir);
  vec3 P = vLocal;

  float e = 0.012;
  float h0 = fbm5(P * 6.5);
  float hx = 0.0;
  float hy = 0.0;
  if (dot(N0, L) > -0.32) {
    hx = fbm5((P + vec3(e, 0.0, 0.0)) * 6.5) - h0;
    hy = fbm5((P + vec3(0.0, e, 0.0)) * 6.5) - h0;
  }
  vec3 N = normalize(N0 + vec3(hx, hy, 0.0) * 2.1);

  float ndl = clamp((dot(N, L) + 0.14) / 1.14, 0.0, 1.0);
  float ndlSmooth = clamp((dot(N0, L) + 0.14) / 1.14, 0.0, 1.0);
  float ndv = max(0.0, dot(N0, V));
  vec3 col = vec3(0.0);

  if (uMode < 0.5) {
    // 0: Lava Tidal World (Cinder) -- dark charred basalt crust with glowing magma fissures
    float n1 = fbm5(P * 5.2 + vec3(0.0, uTime * 0.015, 0.0));
    float n2 = fbm5(P * 15.0);
    float ridge = abs(n1 - 0.5) * 2.0;
    float river = 1.0 - smoothstep(0.0, 0.11, ridge - n2 * 0.065);
    vec3 magma = mix(vec3(0.92, 0.16, 0.01), vec3(1.0, 0.82, 0.28), pow(river, 2.4));
    vec3 crust = mix(vec3(0.025, 0.02, 0.025), vec3(0.11, 0.08, 0.07), n2) * (0.04 + 0.96 * ndl);
    col = mix(crust, magma * 1.25, river);
    col += atmosphereScattering(N0, V, L, vec3(0.95, 0.28, 0.05), vec3(1.0, 0.58, 0.16), 1.05);
  } else if (uMode < 1.5) {
    // 1: Realistic Earth-Like Biosphere World (Haven -- 573204705.jpg high-contrast terminator)
    float warp = fbm5(P * 2.4 + 1.7);
    float cont = fbm5(P * 3.1 + warp * 0.55 + 2.4);
    float detail = fbm5(P * 14.0);
    float lat = abs(P.y);
    float land = smoothstep(0.46, 0.505, cont + 0.06 * detail);
    float coast = smoothstep(0.42, 0.51, cont + 0.06 * detail) * (1.0 - land);

    vec3 deepOcean = mix(vec3(0.008, 0.035, 0.12), vec3(0.018, 0.11, 0.28), detail);
    vec3 ocean = mix(deepOcean, vec3(0.03, 0.32, 0.50), coast * 0.80);

    float humid = fbm5(P * 5.5 + 8.2);
    vec3 forest = mix(vec3(0.04, 0.18, 0.06), vec3(0.14, 0.29, 0.11), detail);
    vec3 desert = mix(vec3(0.46, 0.37, 0.23), vec3(0.62, 0.50, 0.34), detail);
    vec3 mountain = mix(vec3(0.22, 0.20, 0.19), vec3(0.92, 0.95, 1.0), smoothstep(0.64, 0.84, h0));
    vec3 biome = mix(desert, forest, smoothstep(0.38, 0.64, humid));
    biome = mix(biome, mountain, smoothstep(0.56, 0.75, cont));
    biome = mix(biome, vec3(0.92, 0.96, 1.0), smoothstep(0.74, 0.88, lat + detail * 0.12));

    vec3 cPos = P * 3.8 + vec3(uTime * 0.008, 0.0, -uTime * 0.006);
    float cSwirl = fbm5(cPos + vec3(fbm5(cPos * 1.8) * 0.65));
    float cDetail = fbm5(P * 16.0 - vec3(uTime * 0.012, 0.0, 0.0));
    float clouds = smoothstep(0.44, 0.73, cSwirl * 0.78 + cDetail * 0.28);
    float fogHaze = smoothstep(0.34, 0.70, cSwirl) * 0.22;

    float cShadow = smoothstep(0.46, 0.70, fbm5((P + L * 0.022) * 3.8 + vec3(uTime * 0.008, 0.0, -uTime * 0.006)));
    vec3 surf = mix(ocean, biome, land);
    surf *= (1.0 - cShadow * 0.48 * (1.0 - clouds));

    vec3 H = normalize(L + V);
    float spec = pow(max(0.0, dot(N0, H)), 56.0) * (1.0 - land * 0.9) * (1.0 - clouds * 0.85) * ndlSmooth;

    // Deep pitch-black night side with delicate city-light filaments
    float night = smoothstep(0.06, -0.18, dot(N0, L));
    float cities = smoothstep(0.68, 0.79, detail) * land * (1.0 - clouds * 0.92) * night;

    vec3 litSurf = surf * (0.008 + 1.05 * ndl) + vec3(1.0, 0.92, 0.78) * spec * 0.70;
    vec3 cloudCol = vec3(0.95, 0.97, 1.0) * (0.01 + 1.04 * ndlSmooth);
    col = mix(litSurf, cloudCol, clouds * 0.86);
    col = mix(col, vec3(0.38, 0.62, 0.92) * (0.02 + 0.95 * ndlSmooth), fogHaze);
    col += vec3(1.0, 0.72, 0.28) * cities * 0.75;
    col += atmosphereScattering(N0, V, L, vec3(0.16, 0.56, 1.0), vec3(1.0, 0.58, 0.24), 1.48);
  } else if (uMode < 2.5) {
    // 2: Banded Storm Gas Giant (Leviathan)
    float turb = fbm5(P * 5.5 + vec3(uTime * 0.015, 0.0, 0.0));
    float bands = sin(P.y * 24.0 + turb * 4.8);
    float storm = exp(-length((P.xy - vec2(0.22, -0.16)) * vec2(3.2, 5.2)));
    vec3 c1 = vec3(0.68, 0.48, 0.32), c2 = vec3(0.22, 0.19, 0.36), c3 = vec3(0.88, 0.76, 0.58);
    vec3 surf = mix(c1, c2, 0.5 + 0.5 * bands);
    surf = mix(surf, c3, smoothstep(0.3, 0.78, turb));
    surf = mix(surf, vec3(0.86, 0.32, 0.16), storm * 0.75);
    col = surf * (0.015 + 0.98 * ndlSmooth) + atmosphereScattering(N0, V, L, vec3(0.42, 0.52, 0.90), vec3(0.90, 0.68, 0.40), 1.15);
  } else if (uMode < 3.5) {
    // 3: Industrial / Arid Canyon World (Bastion / Forge)
    float n = fbm5(P * 6.0);
    float haze = fbm5(P * 4.2 + vec3(uTime * 0.01, 0.0, 0.0));
    vec3 canyon = mix(vec3(0.24, 0.10, 0.05), vec3(0.58, 0.28, 0.12), n);
    canyon = mix(canyon, vec3(0.75, 0.52, 0.34), haze * 0.30);
    col = canyon * (0.015 + 0.98 * ndl) + atmosphereScattering(N0, V, L, vec3(0.90, 0.42, 0.16), vec3(1.0, 0.70, 0.35), 1.20);
  } else if (uMode < 4.5) {
    // 4: K-Dwarf Companion Star (Solis-B)
    float gran = fbm5(P * 10.0 + vec3(uTime * 0.06, -uTime * 0.05, 0.0));
    vec3 core = mix(vec3(0.95, 0.34, 0.05), vec3(1.0, 0.90, 0.52), pow(ndv, 0.42) * (0.65 + 0.5 * gran));
    col = core * 1.45 + vec3(1.0, 0.55, 0.15) * pow(1.0 - ndv, 2.6) * 1.35;
  } else {
    // 5: Methanogenic Azure Ice Giant (Veil / Exile)
    float f = fbm5(P * 5.0 + vec3(0.0, uTime * 0.01, 0.0));
    float mist = fbm5(P * 9.0);
    vec3 ice = mix(vec3(0.04, 0.20, 0.42), vec3(0.22, 0.64, 0.80), f * 0.7 + mist * 0.3);
    col = ice * (0.015 + 0.98 * ndlSmooth) + atmosphereScattering(N0, V, L, vec3(0.18, 0.78, 1.0), vec3(0.55, 0.90, 1.0), 1.30);
  }
  if (uMode < 3.5 || uMode > 4.5) col *= mix(vec3(0.80, 0.90, 1.08), vec3(1.12, 0.97, 0.80), smoothstep(0.0, 0.55, ndlSmooth));
  gl_FragColor = vec4(bhFilm(pow(max(col, 0.0), vec3(2.2)) * uExposure), 1.0);
}
`;

  const ATMO_FS = `
precision highp float;
varying vec3 vNorm;
varying vec3 vWPos;
uniform vec3 uCamPos;
uniform vec3 uLightDir;
uniform vec3 uAtmoCol;
void main(void) {
  vec3 N = normalize(vNorm);
  vec3 V = normalize(uCamPos - vWPos);
  vec3 L = normalize(-uLightDir);
  float ndv = max(0.0, dot(N, V));
  float ndl = smoothstep(-0.20, 0.72, dot(N, L));
  float rim = pow(1.0 - ndv, 5.2) * ndl;
  gl_FragColor = vec4(uAtmoCol * rim * 0.90, rim);
}
`;

  const PORTAL_FS = `
precision highp float;
varying vec3 vNorm;
varying vec3 vLocal;
varying vec3 vWPos;
varying vec2 vUV;
uniform vec3 uCamPos;
uniform float uTime;
uniform float uCharge;
void main(void) {
  vec3 N = normalize(vNorm);
  vec3 V = normalize(uCamPos - vWPos);
  float ndv = abs(dot(N, V));
  float rim = pow(1.0 - ndv, 2.2);
  float swirl = sin(vLocal.x * 14.0 + vLocal.y * 14.0 - uTime * 9.0) * 0.5 + 0.5;
  vec3 col = mix(vec3(0.02, 0.18, 0.42), vec3(0.25, 0.92, 1.0), rim * (0.65 + 0.35 * swirl));
  col += vec3(0.85, 0.96, 1.0) * pow(rim, 5.0) * 1.4;
  float alpha = clamp((0.28 + 0.72 * rim) * uCharge, 0.0, 0.95);
  gl_FragColor = vec4(col, alpha);
}
`;

  function create(scene) {
    BABYLON.Effect.ShadersStore.bhPlanetVertexShader = PLANET_VS;
    BABYLON.Effect.ShadersStore.bhPlanetFragmentShader = PLANET_FS;
    BABYLON.Effect.ShadersStore.bhAtmoVertexShader = PLANET_VS;
    BABYLON.Effect.ShadersStore.bhAtmoFragmentShader = ATMO_FS;
    BABYLON.Effect.ShadersStore.bhPortalVertexShader = PLANET_VS;
    BABYLON.Effect.ShadersStore.bhPortalFragmentShader = PORTAL_FS;

    const envRoot = new BABYLON.TransformNode('sectorEnvRoot', scene);
    let activeMeshes = [];
    let rotatingNodes = [];
    let dockStation = null;
    let gravityBodies = [];

    const planetMats = [];
    const atmoMats = [];

    function clearSector() {
      for (const m of activeMeshes) m.dispose();
      activeMeshes = [];
      rotatingNodes = [];
      planetMats.length = 0;
      atmoMats.length = 0;
      gravityBodies = [];
      dockStation = null;
    }

    function makePlanetMat(name, mode) {
      const m = new BABYLON.ShaderMaterial(name, scene, { vertex: 'bhPlanet', fragment: 'bhPlanet' }, {
        attributes: ['position', 'normal', 'uv'],
        uniforms: ['world', 'viewProjection', 'uCamPos', 'uLightDir', 'uTime', 'uMode', 'uExposure'],
      });
      m.setFloat('uMode', mode);
      m.setFloat('uExposure', 1.0);
      m.setFloat('uTime', 0);
      m.setVector3('uCamPos', new BABYLON.Vector3(0, 0, 0));
      m.setVector3('uLightDir', new BABYLON.Vector3(0, -1, 0));
      planetMats.push(m);
      return m;
    }

    function addAtmosphereShell(parentPlanet, diameter, r, g, b) {
      const m = new BABYLON.ShaderMaterial(parentPlanet.name + '_atmoMat', scene, { vertex: 'bhAtmo', fragment: 'bhAtmo' }, {
        attributes: ['position', 'normal', 'uv'],
        uniforms: ['world', 'viewProjection', 'uCamPos', 'uLightDir', 'uAtmoCol'],
        needAlphaBlending: true
      });
      m.alphaMode = BABYLON.Constants.ALPHA_ONEONE;
      m.disableDepthWrite = true;
      m.setVector3('uAtmoCol', new BABYLON.Vector3(r, g, b));
      m.setVector3('uCamPos', new BABYLON.Vector3(0, 0, 0));
      m.setVector3('uLightDir', new BABYLON.Vector3(0, -1, 0));
      atmoMats.push(m);
      const bigP = diameter > 6000;
      const shell = BABYLON.MeshBuilder.CreateSphere(parentPlanet.name + '_atmo', { diameter: diameter * (bigP ? 1.06 : 1.05), segments: bigP ? 96 : 28 }, scene);
      shell.parent = parentPlanet;
      shell.material = m;
      shell.renderingGroupId = 1;
      return shell;
    }

    function stdMat(name, dr, dg, db, er, eg, eb, alpha) {
      const m = new BABYLON.StandardMaterial(name, scene);
      m.diffuseColor = new BABYLON.Color3(dr, dg, db);
      m.emissiveColor = new BABYLON.Color3(er || 0, eg || 0, eb || 0);
      m.specularColor = new BABYLON.Color3(0.42, 0.42, 0.48);
      m.specularPower = 48;
      m.backFaceCulling = false;
      if (alpha !== undefined && alpha < 1) m.alpha = alpha;
      return m;
    }

    function buildAsteroids(count, spreadM, minR, maxR, tint) {
      const rng = Game.Rng.createRng(77123);
      const rockMat = stdMat('astMat', tint[0], tint[1], tint[2], tint[3] || 0.005, tint[4] || 0.005, tint[5] || 0.01);
      for (let i = 0; i < count; i++) {
        const a = rng.next() * Math.PI * 2;
        const d = minR + rng.next() * (maxR - minR);
        const h = (rng.next() - 0.5) * spreadM * 0.32;
        const sz = 9 + Math.pow(rng.next(), 2.2) * 38;
        const rock = BABYLON.MeshBuilder.CreateSphere('ast_' + i, {
          diameterX: sz * (0.7 + 0.6 * rng.next()),
          diameterY: sz * (0.6 + 0.6 * rng.next()),
          diameterZ: sz * (0.7 + 0.6 * rng.next()),
          segments: 5
        }, scene);
        rock.parent = envRoot;
        rock.position.set(Math.cos(a) * d, h, Math.sin(a) * d);
        rock.rotation.set(rng.next() * 6, rng.next() * 6, rng.next() * 6);
        rock.material = rockMat;
        rock.renderingGroupId = 1;
        activeMeshes.push(rock);
        rotatingNodes.push({ node: rock, rx: (rng.next() - 0.5) * 0.2, ry: (rng.next() - 0.5) * 0.2 });
      }
    }

    function buildStation(name, pos, isFriendly) {
      const root = new BABYLON.TransformNode(name, scene);
      root.parent = envRoot;
      root.position.set(pos.x, pos.y, pos.z);
      activeMeshes.push(root);

      const modMat = stdMat(name + '_mod', 0.52, 0.55, 0.60, 0.01, 0.015, 0.02);
      const darkMat = stdMat(name + '_dark', 0.14, 0.16, 0.19, 0.005, 0.005, 0.01);
      const glowColor = isFriendly ? [0.25, 0.78, 1.0] : [1.0, 0.42, 0.12];
      const glowMat = stdMat(name + '_glow', glowColor[0], glowColor[1], glowColor[2], glowColor[0], glowColor[1], glowColor[2]);
      glowMat.disableLighting = true;

      const hub = BABYLON.MeshBuilder.CreateCylinder(name + '_hub', { height: 18, diameter: 22, tessellation: 12 }, scene);
      hub.parent = root; hub.rotation.x = Math.PI * 0.5; hub.material = darkMat; hub.renderingGroupId = 1;

      const ring = BABYLON.MeshBuilder.CreateTorus(name + '_ring', { diameter: 140, thickness: 4.5, tessellation: 32 }, scene);
      ring.parent = root; ring.rotation.x = Math.PI * 0.5; ring.material = darkMat; ring.renderingGroupId = 1;

      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        const R = 70;
        const mod = BABYLON.MeshBuilder.CreateBox(name + '_m' + i, { width: 18, height: 12, depth: 14 }, scene);
        mod.parent = root;
        mod.position.set(Math.cos(ang) * R, Math.sin(ang) * R, 0);
        mod.rotation.z = ang;
        mod.material = modMat;
        mod.renderingGroupId = 1;
        if (i % 3 === 0) {
          const light = BABYLON.MeshBuilder.CreateSphere(name + '_l' + i, { diameter: 3.5, segments: 6 }, scene);
          light.parent = root;
          light.position.set(Math.cos(ang) * (R + 8), Math.sin(ang) * (R + 8), 3);
          light.material = glowMat;
          light.renderingGroupId = 1;
        }
      }

      for (let i = 0; i < 2; i++) {
        const sp = BABYLON.MeshBuilder.CreateBox(name + '_sp' + i, { width: 136, height: 3.2, depth: 3.2 }, scene);
        sp.parent = root; sp.rotation.z = (i * Math.PI) / 2; sp.material = darkMat; sp.renderingGroupId = 1;
      }

      rotatingNodes.push({ node: root, rx: 0, ry: 0.05, rz: isFriendly ? 0.18 : -0.15 });
      return { root, position: root.position, isFriendly, radius: 95 };
    }

    function spawnPlanet(name, mode, diameter, pos, atmoRGB, hasRing, ringCol, gravStrength) {
      const pMat = makePlanetMat(name + '_mat', mode);
      const planet = BABYLON.MeshBuilder.CreateSphere(name, { diameter, segments: diameter > 6000 ? 112 : 36 }, scene);
      planet.parent = envRoot;
      planet.position.set(pos.x, pos.y, pos.z);
      planet.material = pMat;
      planet.renderingGroupId = 1;
      activeMeshes.push(planet);
      rotatingNodes.push({ node: planet, rx: 0, ry: 0.018 });
      if (atmoRGB) addAtmosphereShell(planet, diameter, atmoRGB[0], atmoRGB[1], atmoRGB[2]);
      if (hasRing) {
        const rCol = ringCol || [0.62, 0.68, 0.80];
        const r1 = BABYLON.MeshBuilder.CreateTorus(name + '_r1', { diameter: diameter * 1.85, thickness: diameter * 0.10, tessellation: diameter > 6000 ? 160 : 48 }, scene);
        r1.parent = planet; r1.scaling.y = 0.02; r1.rotation.x = 0.28; r1.rotation.z = 0.16;
        r1.material = stdMat(name + '_rm1', rCol[0], rCol[1], rCol[2], rCol[0] * 0.12, rCol[1] * 0.12, rCol[2] * 0.12, 0.55);
        r1.renderingGroupId = 1;
      }
      // mu is tuned so a circular orbit at 1.3 R moves at ~330 m/s whatever the planet size (flyable, readable)
      gravityBodies.push({ name, pos: planet.position, radius: diameter * 0.5, strength: gravStrength || 18, mu: diameter > 6000 ? 330 * 330 * 1.3 * diameter * 0.5 : 0, mode });
      return planet;
    }

    function loadSector(sectorId, startOri) {
      clearSector();
      envRoot.position.set(0, 0, 0);
      const sec = Game.Sectors.byId(sectorId);
      const Q = Game.Quat, V = Game.Vec3;
      const ori = startOri || { x: 0, y: 0, z: 0, w: 1 };
      const fwd = V.v3(0, 0, 1), right = V.v3(1, 0, 0), up = V.v3(0, 1, 0);
      Q.qRotateVector(fwd, ori, { x: 0, y: 0, z: 1 });
      Q.qRotateVector(right, ori, { x: 1, y: 0, z: 0 });
      Q.qRotateVector(up, ori, { x: 0, y: 1, z: 0 });

      function relPos(fDist, rDist, uDist) {
        return {
          x: fwd.x * fDist + right.x * rDist + up.x * uDist,
          y: fwd.y * fDist + right.y * rDist + up.y * uDist,
          z: fwd.z * fDist + right.z * rDist + up.z * uDist
        };
      }

      // Worlds are now truly vast (R = 16-60 km against a 14 m ship). They sit low and to the left so Gargantua keeps
      // the upper-right sky, and you can fly down to them, orbit them, or hit them.
      function place(distKm, yawDeg, pitchDeg) {
        const d = distKm * 1000, y = yawDeg * Math.PI / 180, pt = pitchDeg * Math.PI / 180;
        return relPos(d * Math.cos(pt) * Math.cos(y), d * Math.cos(pt) * Math.sin(y), d * Math.sin(pt));
      }
      if (sec.id === 'photon_reach') {
        dockStation = buildStation('enduranceRelay', relPos(680, -290, 125), true);
        spawnPlanet('havenVista', 1, 44000, place(59, 34, -21), [0.18, 0.58, 1.0], false, null, 22);
        buildAsteroids(32, 1800, 320, 1650, [0.22, 0.24, 0.28, 0.005, 0.005, 0.01]);
      } else if (sec.id === 'cinder') {
        spawnPlanet('cinderPlanet', 0, 36000, place(49, 31, -19), [0.95, 0.30, 0.06], false, null, 38);
        buildAsteroids(36, 1500, 260, 1400, [0.28, 0.12, 0.06, 0.06, 0.015, 0.005]);
      } else if (sec.id === 'forge') {
        spawnPlanet('forgePlanet', 3, 42000, place(57, 33, -20), [0.90, 0.45, 0.16], true, [0.80, 0.42, 0.14], 28);
        dockStation = buildStation('citadelAegis', relPos(640, -260, 95), false);
        buildAsteroids(30, 1400, 260, 1300, [0.24, 0.20, 0.18, 0.01, 0.005, 0.002]);
      } else if (sec.id === 'haven') {
        spawnPlanet('havenPlanet', 1, 48000, place(65, 35, -21), [0.18, 0.58, 1.0], false, null, 32);
        const moon = BABYLON.MeshBuilder.CreateSphere('seleneMoon', { diameter: 3400, segments: 48 }, scene);
        const mp = relPos(9500, 3300, 2100);
        moon.parent = envRoot; moon.position.set(mp.x, mp.y, mp.z);
        moon.material = stdMat('moonMat', 0.48, 0.50, 0.55, 0.005, 0.005, 0.01);
        moon.renderingGroupId = 1;
        activeMeshes.push(moon);
        dockStation = buildStation('havenDock', relPos(620, -240, 110), true);
      } else if (sec.id === 'bastion') {
        spawnPlanet('bastionPlanet', 3, 46000, place(62, 34, -20), [0.90, 0.46, 0.18], true, [0.75, 0.48, 0.25], 30);
        dockStation = buildStation('bastionFort', relPos(650, -250, 90), false);
      } else if (sec.id === 'leviathan') {
        spawnPlanet('levPlanet', 2, 120000, place(158, 31, -17), [0.46, 0.54, 0.88], true, [0.65, 0.58, 0.82], 42);
        buildAsteroids(32, 1600, 300, 1450, [0.30, 0.34, 0.44, 0.01, 0.01, 0.02]);
      } else if (sec.id === 'solis_veil') {
        spawnPlanet('solisStar', 4, 80000, place(190, 36, 12), [1.0, 0.58, 0.16], false, null, 45);
        spawnPlanet('veilPlanet', 5, 32000, place(43, 36, -19), [0.18, 0.78, 1.0], false, null, 24);
        dockStation = buildStation('veilArray', relPos(640, -260, 100), true);
      } else {
        spawnPlanet('exilePlanet', 5, 76000, place(104, 33, -18), [0.18, 0.82, 1.0], true, [0.40, 0.80, 0.95], 34);
        dockStation = buildStation('exileOutpost', relPos(620, -240, 95), true);
      }
    }

    const portalMat = new BABYLON.ShaderMaterial('bhPortal', scene, { vertex: 'bhPortal', fragment: 'bhPortal' }, {
      attributes: ['position', 'normal', 'uv'],
      uniforms: ['world', 'viewProjection', 'uCamPos', 'uTime', 'uCharge'],
      needAlphaBlending: true
    });
    portalMat.backFaceCulling = false;
    portalMat.disableDepthWrite = true;
    const portalMesh = BABYLON.MeshBuilder.CreateSphere('warpPortal', { diameter: 36, segments: 24 }, scene);
    portalMesh.material = portalMat;
    portalMesh.renderingGroupId = 1;
    portalMesh.isVisible = false;

    function update(dt, timeS, camPos, sunDir, shipPos, shipFwd, warpState) {
      for (const item of rotatingNodes) {
        if (item.rx) item.node.rotation.x += item.rx * dt;
        if (item.ry) item.node.rotation.y += item.ry * dt;
        if (item.rz) item.node.rotation.z += item.rz * dt;
      }
      for (const m of planetMats) {
        m.setFloat('uTime', timeS);
        m.setFloat('uExposure', window.__BH_EXPO.value);
        m.setVector3('uCamPos', camPos);
        m.setVector3('uLightDir', sunDir);
      }
      for (const m of atmoMats) {
        m.setVector3('uCamPos', camPos);
        m.setVector3('uLightDir', sunDir);
      }
      if (warpState && warpState.portalVisible) {
        portalMesh.isVisible = true;
        const d = 62;
        portalMesh.position.set(shipPos.x + shipFwd.x * d, shipPos.y + shipFwd.y * d, shipPos.z + shipFwd.z * d);
        const sc = Math.max(0.05, warpState.portalScale || 1);
        portalMesh.scaling.set(sc, sc, sc);
        portalMat.setFloat('uTime', timeS);
        portalMat.setFloat('uCharge', warpState.portalAlpha || 0.8);
        portalMat.setVector3('uCamPos', camPos);
      } else {
        portalMesh.isVisible = false;
      }
    }

    // ---- Planetary physics -------------------------------------------------------------------------
    const _info = { b: null, name: '', d: 0, alt: 1e12, R: 0, mu: 0, nx: 0, ny: 1, nz: 0, cx: 0, cy: 0, cz: 0 };
    function nearestBody(p) {
      let best = null, bestAlt = Infinity, bd = 0, bx = 0, by = 0, bz = 0;
      const e = envRoot.position;
      for (const b of gravityBodies) {
        if (!b.mu) continue;
        const cx = b.pos.x + e.x, cy = b.pos.y + e.y, cz = b.pos.z + e.z;
        const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
        const d = Math.hypot(dx, dy, dz) || 1, alt = d - b.radius;
        if (alt < bestAlt) { best = b; bestAlt = alt; bd = d; bx = cx; by = cy; bz = cz; }
      }
      if (!best) return null;
      const i = _info;
      i.b = best; i.name = best.name; i.d = bd; i.alt = bestAlt; i.R = best.radius; i.mu = best.mu;
      i.cx = bx; i.cy = by; i.cz = bz;
      i.nx = (p.x - bx) / bd; i.ny = (p.y - by) / bd; i.nz = (p.z - bz) / bd;
      return i;
    }
    const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

    // total gameplay acceleration: black-hole pull (fades out near a world: the planet and ship free-fall together
    // through the hole's field, only the planet's own gravity remains) + planetary gravity.
    function computeDynamicGravity(shipPos, rHatBH, bhPullMag, outAccel) {
      const V = Game.Vec3;
      let infl = 0, ax = 0, ay = 0, az = 0;
      const e = envRoot.position;
      for (const b of gravityBodies) {
        if (!b.mu) continue;
        const dx = b.pos.x + e.x - shipPos.x, dy = b.pos.y + e.y - shipPos.y, dz = b.pos.z + e.z - shipPos.z;
        const d = Math.hypot(dx, dy, dz) || 1;
        const fall = 1 - sstep(5 * b.radius, 8 * b.radius, d);
        if (fall > 0) { const g = (b.mu / (d * d)) * fall; ax += dx / d * g; ay += dy / d * g; az += dz / d * g; }
        infl = Math.max(infl, 1 - sstep(1.5 * b.radius, 2.0 * b.radius, d));
      }
      const w = 1 - infl;
      ax -= rHatBH.x * bhPullMag * w; ay -= rHatBH.y * bhPullMag * w; az -= rHatBH.z * bhPullMag * w;
      return V.set(outAccel, ax, ay, az);
    }

    // 0 inside a world's capture zone (hole pull + tide off), 1 outside; smooth in between
    function planetWeight(p) {
      let infl = 0;
      const e = envRoot.position;
      for (const b of gravityBodies) {
        if (!b.mu) continue;
        const d = Math.hypot(b.pos.x + e.x - p.x, b.pos.y + e.y - p.y, b.pos.z + e.z - p.z) || 1;
        infl = Math.max(infl, 1 - sstep(1.5 * b.radius, 2.0 * b.radius, d));
      }
      return 1 - infl;
    }

    // surface impact + orbit assist. Returns nothing; reports through the callbacks.
    const orb = { on: false, idle: 0, Lx: 0, Ly: 1, Lz: 0, name: '' };
    function planetStep(ship, idle, dt, fwd, right, cb) {
      const info = nearestBody(ship.positionMeters);
      if (!info) { if (orb.on) { orb.on = false; cb.orbit(false, ''); } return; }
      const p = ship.positionMeters, v = ship.velocityMps;
      const skin = info.R + (ship.radius || 8) + 3;
      if (info.d < skin) {
        const vn = v.x * info.nx + v.y * info.ny + v.z * info.nz;
        p.x = info.cx + info.nx * skin; p.y = info.cy + info.ny * skin; p.z = info.cz + info.nz * skin;
        if (vn < 0) {
          const k = 1.25 * vn;
          v.x -= k * info.nx; v.y -= k * info.ny; v.z -= k * info.nz;
          v.x *= 0.9; v.y *= 0.9; v.z *= 0.9;
          cb.impact(-vn, info.name);
        }
        if (orb.on) { orb.on = false; cb.orbit(false, ''); }
        return;
      }
      const capture = info.alt < 0.5 * info.R && info.alt > 60;
      if (!capture || !idle) { orb.idle = 0; if (orb.on) { orb.on = false; cb.orbit(false, ''); } return; }
      const vc = Math.sqrt(info.mu / info.d);
      if (!orb.on) {
        orb.idle += dt;
        const sp = Math.hypot(v.x, v.y, v.z);
        if (orb.idle > 0.5 && sp < vc * 1.8) {
          const vr = v.x * info.nx + v.y * info.ny + v.z * info.nz;
          let tx = v.x - vr * info.nx, ty = v.y - vr * info.ny, tz = v.z - vr * info.nz;
          let tl = Math.hypot(tx, ty, tz);
          if (tl < 20) {
            const fr = fwd.x * info.nx + fwd.y * info.ny + fwd.z * info.nz;
            tx = fwd.x - fr * info.nx; ty = fwd.y - fr * info.ny; tz = fwd.z - fr * info.nz; tl = Math.hypot(tx, ty, tz);
            if (tl < 0.25) {
              const rr = right.x * info.nx + right.y * info.ny + right.z * info.nz;
              tx = right.x - rr * info.nx; ty = right.y - rr * info.ny; tz = right.z - rr * info.nz; tl = Math.hypot(tx, ty, tz) || 1;
            }
          }
          tx /= tl; ty /= tl; tz /= tl;
          // orbit-plane normal L = n x t
          orb.Lx = info.ny * tz - info.nz * ty; orb.Ly = info.nz * tx - info.nx * tz; orb.Lz = info.nx * ty - info.ny * tx;
          orb.on = true; orb.name = info.name; cb.orbit(true, info.name);
        }
        return;
      }
      // engaged: steer velocity onto the circular orbit in the locked plane (t = L x n)
      let tx = orb.Ly * info.nz - orb.Lz * info.ny, ty = orb.Lz * info.nx - orb.Lx * info.nz, tz = orb.Lx * info.ny - orb.Ly * info.nx;
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      const kk = 1 - Math.exp(-dt / 2.2);
      v.x += (tx * vc - v.x) * kk; v.y += (ty * vc - v.y) * kk; v.z += (tz * vc - v.z) * kk;
    }

    function shift(off) {
      const done = new Set();
      for (const m of activeMeshes) {
        if (m.parent === envRoot && !done.has(m)) { done.add(m); m.position.x -= off.x; m.position.y -= off.y; m.position.z -= off.z; }
      }
      if (dockStation && dockStation.root && !done.has(dockStation.root)) {
        dockStation.root.position.x -= off.x; dockStation.root.position.y -= off.y; dockStation.root.position.z -= off.z;
      }
    }

    return { loadSector, update, shift, computeDynamicGravity, planetWeight, planetStep, nearestBody, get orbitOn() { return orb.on; }, get dockStation() { return dockStation; }, get gravityBodies() { return gravityBodies; }, portalMesh };
  }
  return { create };
})();

// ---------------------------------------------------------------------------
// SECTION: SHIP MODELS -- Gritty Weathered Ceramic-Hex PBR Player Ship
// (matching file_00000000849c8210b4b1cbb2bf23a154_cacdca.png) + Enemy Hulls.
// ---------------------------------------------------------------------------
Game.ShipModels = (function () {
  const HULL_VS = [
    'precision highp float;',
    'attribute vec3 position;',
    'attribute vec3 normal;',
    'uniform mat4 world;',
    'uniform mat4 viewProjection;',
    'varying vec3 vWPos;',
    'varying vec3 vWNorm;',
    'varying vec3 vLocal;',
    'void main(void) {',
    '  vLocal = position;',
    '  vec4 wp = world * vec4(position, 1.0);',
    '  vWPos = wp.xyz;',
    '  vWNorm = normalize(mat3(world[0].xyz, world[1].xyz, world[2].xyz) * normal);',
    '  gl_Position = viewProjection * wp;',
    '}'
  ].join('\n');

  // Gritty, battle-worn Hexagonal Ceramic Armor Shader with deep space shadow contrast
  const HULL_FS = `
precision highp float;
varying vec3 vWPos;
varying vec3 vWNorm;
varying vec3 vLocal;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform float uExposure;
vec3 bhFilm(vec3 x){vec3 c=(x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14);return pow(clamp(c,0.0,1.0),vec3(1.0/2.2));}

float hexDist(vec2 p) {
  p = abs(p);
  return max(dot(p, normalize(vec2(1.0, 1.73205))), p.x);
}
vec4 hexGrid(vec2 uv) {
  vec2 r = vec2(1.0, 1.73205);
  vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h;
  vec2 b = mod(uv - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  float edge = 0.5 - hexDist(gv);
  vec2 id = uv - gv;
  return vec4(edge, id.x, id.y, 0.0);
}
float hash3(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

void main(void) {
  vec3 N = normalize(vWNorm);
  vec3 V = normalize(uCamPos - vWPos);
  if (dot(N, V) < 0.0) N = -N;
  vec3 L = normalize(-uSunDir);
  float ndl = max(0.0, dot(N, L));
  float hemi = 0.5 * N.y + 0.5;

  vec4 hx = hexGrid(vLocal.xz * 0.75);
  float seam = smoothstep(0.018, 0.065, hx.x);
  float tileVar = fract(sin(hx.y * 127.1 + hx.z * 311.7) * 43758.5453);
  float grit = hash3(floor(vLocal * 16.0)) * 0.08;

  // Weathered warm ceramic plating with dark panel seams & aft thermal soot
  float aftScorch = smoothstep(-2.5, -7.2, vLocal.z) * 0.35;
  vec3 cream = mix(vec3(0.76, 0.72, 0.66), vec3(0.88, 0.84, 0.78), tileVar) - grit;
  cream = mix(cream, vec3(0.22, 0.20, 0.19), aftScorch);
  cream = mix(vec3(0.18, 0.17, 0.16), cream, seam);

  // Gritty low-key space lighting: dark shadow floor + warm accretion rim & specular
  vec3 amb = mix(vec3(0.05, 0.06, 0.08), vec3(0.24, 0.26, 0.30), hemi);
  vec3 H = normalize(L + V);
  float spec = pow(max(0.0, dot(N, H)), 54.0) * ndl;
  float fres = pow(1.0 - max(0.0, dot(N, V)), 3.2);

  vec3 col = cream * (amb + vec3(1.0, 0.88, 0.72) * ndl * 0.95)
           + vec3(1.0, 0.90, 0.76) * spec * 0.42
           + vec3(1.0, 0.76, 0.45) * fres * 0.22;
  gl_FragColor = vec4(bhFilm(pow(max(col, 0.0), vec3(2.2)) * uExposure), 1.0);
}
`;

  function flatMesh(name, scene, tris, mat) {
    const pos = [], idx = [], nor = [];
    let cx = 0, cy = 0, cz = 0, n = 0;
    for (const t of tris) for (const p of t) { cx += p[0]; cy += p[1]; cz += p[2]; n++; }
    cx /= n; cy /= n; cz /= n;
    tris.forEach((t, i) => {
      const ux = t[1][0] - t[0][0], uy = t[1][1] - t[0][1], uz = t[1][2] - t[0][2];
      const vx = t[2][0] - t[0][0], vy = t[2][1] - t[0][1], vz = t[2][2] - t[0][2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const mx = (t[0][0] + t[1][0] + t[2][0]) / 3 - cx, my = (t[0][1] + t[1][1] + t[2][1]) / 3 - cy, mz = (t[0][2] + t[1][2] + t[2][2]) / 3 - cz;
      const flip = nx * mx + ny * my + nz * mz < 0;
      for (let k = 0; k < 3; k++) { pos.push(t[k][0], t[k][1], t[k][2]); nor.push(flip ? -nx : nx, flip ? -ny : ny, flip ? -nz : nz); }
      idx.push(i * 3, i * 3 + 1, i * 3 + 2);
    });
    const vd = new BABYLON.VertexData(); vd.positions = pos; vd.indices = idx; vd.normals = nor;
    const m = new BABYLON.Mesh(name, scene); vd.applyToMesh(m);
    m.material = mat; m.renderingGroupId = 1;
    return m;
  }
  function quad(a, b, c, d) { return [[a, b, c], [a, c, d]]; }
  function mirrorX(tris) { return tris.map(t => t.map(p => [-p[0], p[1], p[2]])); }

  function getPalette(scene) {
    if (scene._shipPalette) return scene._shipPalette;
    BABYLON.Effect.ShadersStore.bhHullVertexShader = HULL_VS;
    BABYLON.Effect.ShadersStore.bhHullFragmentShader = HULL_FS;
    const pCeramicHex = new BABYLON.ShaderMaterial('pCeramicHex', scene, { vertex: 'bhHull', fragment: 'bhHull' }, {
      attributes: ['position', 'normal'],
      uniforms: ['world', 'viewProjection', 'uCamPos', 'uSunDir', 'uExposure'],
    });
    pCeramicHex.backFaceCulling = false;
    pCeramicHex.setVector3('uCamPos', new BABYLON.Vector3(0, 0, -20));
    pCeramicHex.setVector3('uSunDir', new BABYLON.Vector3(0, -0.5, 1));
    pCeramicHex.setFloat('uExposure', 1.0);

    function mat(name, dr, dg, db, er, eg, eb, spec) {
      const m = new BABYLON.StandardMaterial(name, scene);
      m.diffuseColor = new BABYLON.Color3(dr, dg, db); m.emissiveColor = new BABYLON.Color3(er, eg, eb);
      const s = spec == null ? 0.40 : spec; m.specularColor = new BABYLON.Color3(s, s, s); m.specularPower = 52;
      m.backFaceCulling = false;
      return m;
    }
    function glow(name, r, g, b) {
      const m = new BABYLON.StandardMaterial(name, scene);
      m.disableLighting = true; m.emissiveColor = new BABYLON.Color3(r, g, b); m.backFaceCulling = false;
      return m;
    }
    scene._shipPalette = {
      pCeramicHex,
      pHull: mat('pHull', 0.84, 0.80, 0.74, 0.02, 0.02, 0.02, 0.45),
      pCharcoal: mat('pCharcoal', 0.12, 0.13, 0.15, 0.01, 0.01, 0.015, 0.45),
      pOrange: mat('pOrange', 0.85, 0.38, 0.12, 0.12, 0.04, 0.005, 0.40),
      pCopper: mat('pCopper', 0.68, 0.32, 0.12, 0.15, 0.06, 0.01, 0.70),
      pCanopy: mat('pCanopy', 0.08, 0.10, 0.13, 0.01, 0.02, 0.04, 0.95),
      pNozzleCore: glow('pNozzleCore', 1.0, 0.86, 0.42),
      pLedWhite: glow('pLedWhite', 0.90, 0.96, 1.0),
      fBody: mat('fBody', 0.12, 0.13, 0.16, 0.04, 0.01, 0.005, 0.55),
      fTrim: mat('fTrim', 0.42, 0.08, 0.04, 0.25, 0.04, 0.01, 0.40),
      fRed: glow('fRed', 1.0, 0.22, 0.06),
      gBody: mat('gBody', 0.14, 0.15, 0.18, 0.03, 0.01, 0.005, 0.50),
      gArmor: mat('gArmor', 0.24, 0.18, 0.14, 0.08, 0.02, 0.005, 0.50),
      gOrange: glow('gOrange', 1.0, 0.45, 0.08),
      cBody: mat('cBody', 0.16, 0.14, 0.22, 0.04, 0.01, 0.06, 0.55),
      cGlow: glow('cGlow', 0.78, 0.28, 1.0),
    };
    return scene._shipPalette;
  }

  function addGlow(scene, root, name, x, y, z, size, mat) {
    const s = BABYLON.MeshBuilder.CreateSphere(name, { diameter: size, segments: 8 }, scene);
    s.material = mat; s.parent = root; s.position.set(x, y, z); s.renderingGroupId = 1; return s;
  }

  function addHexNozzle(scene, root, name, x, y, z, outerR, len, P) {
    const shroud = BABYLON.MeshBuilder.CreateCylinder(name + '_shroud', {
      height: len, diameterTop: outerR * 2.15, diameterBottom: outerR * 1.75, tessellation: 6
    }, scene);
    shroud.parent = root; shroud.rotation.x = Math.PI * 0.5;
    shroud.position.set(x, y, z + len * 0.35);
    shroud.material = P.pCharcoal; shroud.renderingGroupId = 1;

    const lip = BABYLON.MeshBuilder.CreateCylinder(name + '_lip', {
      height: len * 0.45, diameterTop: outerR * 1.80, diameterBottom: outerR * 1.52, tessellation: 6
    }, scene);
    lip.parent = root; lip.rotation.x = Math.PI * 0.5;
    lip.position.set(x, y, z - len * 0.12);
    lip.material = P.pCopper; lip.renderingGroupId = 1;

    const core = BABYLON.MeshBuilder.CreateCylinder(name + '_core', {
      height: 0.4, diameterTop: outerR * 1.38, diameterBottom: outerR * 1.38, tessellation: 6
    }, scene);
    core.parent = root; core.rotation.x = Math.PI * 0.5;
    core.position.set(x, y, z - len * 0.22);
    core.material = P.pNozzleCore; core.renderingGroupId = 1;
    return core;
  }

  function buildPlayer(scene) {
    const P = getPalette(scene);
    const root = new BABYLON.TransformNode('playerShip', scene);
    const box = (name, w, h, d, x, y, z, m, rx, ry, rz) => {
      const b = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
      b.position.set(x, y, z);
      if (rx || ry || rz) b.rotation.set(rx || 0, ry || 0, rz || 0);
      b.parent = root; b.material = m; b.renderingGroupId = 1; return b;
    };

    const nose = [0, 0.0, 11.2];
    const R0 = [[0, 1.15, 7.8], [1.85, 0.1, 7.8], [0, -0.75, 7.8], [-1.85, 0.1, 7.8]];
    const R1 = [[0, 1.75, 2.2], [2.95, 0.2, 2.2], [0, -0.95, 2.2], [-2.95, 0.2, 2.2]];
    const R2 = [[0, 1.65, -6.4], [2.75, 0.15, -6.4], [0, -1.05, -6.4], [-2.75, 0.15, -6.4]];
    const fus = [];
    for (let i = 0; i < 4; i++) fus.push([nose, R0[i], R0[(i + 1) % 4]]);
    for (let i = 0; i < 4; i++) fus.push(...quad(R0[i], R1[i], R1[(i + 1) % 4], R0[(i + 1) % 4]));
    for (let i = 0; i < 4; i++) fus.push(...quad(R1[i], R2[i], R2[(i + 1) % 4], R1[(i + 1) % 4]));
    fus.push(...quad(R2[0], R2[1], R2[2], R2[3]));
    flatMesh('pFusCeramic', scene, fus, P.pCeramicHex).parent = root;

    box('pNoseCap', 2.2, 0.95, 2.6, 0, -0.05, 9.8, P.pCharcoal);
    box('pCenterSpine', 1.25, 0.42, 8.6, 0, 1.56, -2.0, P.pCharcoal);
    box('pRearCollar', 2.8, 0.85, 2.4, 0, 0.85, -6.3, P.pHull);

    box('pCanopyBase', 1.85, 0.72, 3.4, 0, 1.52, 4.2, P.pCanopy, 0.14, 0, 0);
    box('pCheekOrangeL', 0.25, 0.45, 2.0, -1.75, 0.85, 5.2, P.pOrange, 0, -0.22, -0.3);
    box('pCheekOrangeR', 0.25, 0.45, 2.0, 1.75, 0.85, 5.2, P.pOrange, 0, 0.22, 0.3);

    for (const side of [-1, 1]) {
      box('pIntakeHood_' + side, 1.45, 0.62, 3.0, side * 1.48, 1.32, -3.5, P.pHull);
      box('pIntakeSlot_' + side, 1.10, 0.34, 0.6, side * 1.48, 1.26, -4.85, P.pCharcoal);
      box('pSidePod_' + side, 2.35, 1.65, 5.2, side * 2.55, -0.05, -4.4, P.pCharcoal, 0, side * 0.06, 0);
    }

    const wingR = [
      [[2.4, 0.26, 2.2], [2.8, 0.22, -5.2], [8.8, 0.08, -4.2], [8.8, 0.08, -1.8]],
      [[2.4, -0.22, 2.2], [8.8, -0.14, -1.8], [8.8, -0.14, -4.2], [2.8, -0.22, -5.2]]
    ];
    const wTris = [
      ...quad(wingR[0][0], wingR[0][1], wingR[0][2], wingR[0][3]),
      ...quad(wingR[1][0], wingR[1][1], wingR[1][2], wingR[1][3]),
      ...quad(wingR[0][0], wingR[0][3], wingR[1][1], wingR[1][0]),
      ...quad(wingR[0][1], wingR[1][3], wingR[1][2], wingR[0][2])
    ];
    flatMesh('pWingsCeramic', scene, wTris.concat(mirrorX(wTris)), P.pCeramicHex).parent = root;

    for (const side of [-1, 1]) {
      box('pWingStripe_' + side, 0.52, 0.14, 3.4, side * 4.2, 0.22, -2.5, P.pOrange, 0, side * 0.35, 0);
      box('pWingVent_' + side, 1.35, 0.18, 0.85, side * 5.2, 0.18, -3.5, P.pCharcoal, 0, side * 0.2, 0);
      box('pWingRootDark_' + side, 0.65, 0.45, 5.8, side * 2.55, 0.42, -1.2, P.pCharcoal);
      box('pWingLed_' + side, 1.1, 0.14, 0.22, side * 6.4, 0.0, -4.35, P.pLedWhite, 0, side * 0.15, 0);
    }

    const finR = [
      [[8.75, -1.65, -4.8], [8.75, 2.65, -3.6], [8.75, 2.55, -1.6], [8.75, -1.15, -1.2]]
    ];
    const finTris = [...quad(finR[0][0], finR[0][1], finR[0][2], finR[0][3])];
    flatMesh('pEndplates', scene, finTris.concat(mirrorX(finTris)), P.pHull).parent = root;
    for (const side of [-1, 1]) {
      box('pFinLead_' + side, 0.34, 4.1, 0.55, side * 8.8, 0.55, -1.5, P.pCharcoal, -0.15, 0, 0);
      box('pFinRear_' + side, 0.36, 4.3, 0.62, side * 8.8, 0.45, -4.55, P.pCharcoal, 0.22, 0, 0);
      box('pFinOrange_' + side, 0.28, 1.75, 1.15, side * 8.78, 1.15, -3.45, P.pOrange, 0.2, 0, 0);
      box('pFinLed_' + side, 0.22, 1.1, 0.18, side * 8.85, -0.75, -4.65, P.pLedWhite);
    }

    const engCenter = addHexNozzle(scene, root, 'pNozCenter', 0, -0.05, -7.2, 1.32, 2.2, P);
    const engLeft   = addHexNozzle(scene, root, 'pNozLeft',  -2.55, -0.12, -6.8, 0.92, 1.8, P);
    const engRight  = addHexNozzle(scene, root, 'pNozRight',  2.55, -0.12, -6.8, 0.92, 1.8, P);

    return { root, engines: [engLeft, engCenter, engRight], hullMat: P.pCeramicHex, radius: 8.8 };
  }

  function buildFighter(scene) {
    const P = getPalette(scene);
    const root = new BABYLON.TransformNode('fighter', scene);
    const nose = [0, 0, 9.5], top = [0, 1.4, -3], bot = [0, -0.95, -2], rear = [0, 0.2, -6.8];
    const L = [-1.7, 0, -3], Rr = [1.7, 0, -3];
    const wl = [-7.8, -0.25, -5.8], wr = [7.8, -0.25, -5.8], wlb = [-7.8, -0.5, -5.8], wrb = [7.8, -0.5, -5.8];
    const tris = [
      [nose, top, Rr], [nose, Rr, bot], [nose, bot, L], [nose, L, top],
      [top, rear, Rr], [Rr, rear, bot], [bot, rear, L], [L, rear, top],
      [Rr, rear, wr], [Rr, wr, rear], [L, wl, rear], [L, rear, wl],
      [Rr, wr, wrb], [L, wlb, wl], [rear, wrb, wr], [rear, wl, wlb],
    ];
    flatMesh('fHull', scene, tris, P.fBody).parent = root;
    addGlow(scene, root, 'fSensor', 0, 0.25, 7.4, 0.95, P.fRed);
    const eng = addGlow(scene, root, 'fEng', 0, 0.2, -7.1, 1.85, P.fRed);
    return { root, engines: [eng], radius: 8 };
  }

  function buildGunship(scene) {
    const P = getPalette(scene);
    const root = new BABYLON.TransformNode('gunship', scene);
    const box = (name, w, h, d, x, y, z, m) => {
      const b = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
      b.position.set(x, y, z); b.parent = root; b.material = m; b.renderingGroupId = 1; return b;
    };
    box('gMain', 7.2, 3.8, 22, 0, 0, 0, P.gBody);
    box('gPodL', 3.2, 3.0, 15, -6.6, -0.4, 3.5, P.gArmor);
    box('gPodR', 3.2, 3.0, 15, 6.6, -0.4, 3.5, P.gArmor);
    box('gStrut', 14.0, 1.1, 4.5, 0, -0.2, 1.5, P.gBody);
    box('gBridge', 3.6, 2.5, 6.5, 0, 2.9, -2.5, P.gArmor);
    addGlow(scene, root, 'gSensor', 0, 0.4, 11.4, 1.7, P.gOrange);
    const engines = [
      addGlow(scene, root, 'gEng1', -2.4, 0, -11.5, 2.5, P.gOrange),
      addGlow(scene, root, 'gEng2', 2.4, 0, -11.5, 2.5, P.gOrange)
    ];
    return { root, engines, radius: 12 };
  }

  function buildCorvette(scene) {
    const P = getPalette(scene);
    const root = new BABYLON.TransformNode('corvette', scene);
    const box = (name, w, h, d, x, y, z, m) => {
      const b = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
      b.position.set(x, y, z); b.parent = root; b.material = m; b.renderingGroupId = 1; return b;
    };
    box('cCore', 9.0, 4.8, 30, 0, 0, 0, P.cBody);
    box('cProw', 5.5, 3.0, 12, 0, -0.3, 18, P.pCharcoal);
    box('cWingL', 8.0, 1.4, 16, -8.0, 0, -2, P.cBody);
    box('cWingR', 8.0, 1.4, 16, 8.0, 0, -2, P.cBody);
    box('cTower', 4.0, 3.8, 8, 0, 3.8, -5, P.pCharcoal);
    addGlow(scene, root, 'cVls1', 0, 2.6, 6, 1.8, P.cGlow);
    addGlow(scene, root, 'cVls2', 0, 2.6, 11, 1.8, P.cGlow);
    const engines = [
      addGlow(scene, root, 'cEngL', -3.2, 0, -15.5, 3.0, P.cGlow),
      addGlow(scene, root, 'cEngR', 3.2, 0, -15.5, 3.0, P.cGlow)
    ];
    return { root, engines, radius: 15 };
  }

  function buildCarrier(scene) {
    const P = getPalette(scene);
    const root = new BABYLON.TransformNode('carrier', scene);
    const box = (name, w, h, d, x, y, z, m) => {
      const b = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
      b.position.set(x, y, z); b.parent = root; b.material = m; b.renderingGroupId = 1; return b;
    };
    box('kHull', 28, 12, 86, 0, 0, 0, P.gBody);
    box('kDeckL', 10, 5, 68, -18, 1, 6, P.gArmor);
    box('kDeckR', 10, 5, 68, 18, 1, 6, P.gArmor);
    box('kBridge', 9, 10, 18, 0, 10, -16, P.cBody);
    addGlow(scene, root, 'kHangar', 0, 0.5, 36, 6.5, P.fRed);
    addGlow(scene, root, 'kShieldDome', 0, 15.5, -16, 5.2, P.cGlow);
    const engines = [
      addGlow(scene, root, 'kEng1', -9, 0, -44, 5.5, P.gOrange),
      addGlow(scene, root, 'kEng2', 9, 0, -44, 5.5, P.gOrange),
      addGlow(scene, root, 'kEng3', 0, 3, -44, 6.2, P.fRed)
    ];
    return { root, engines, radius: 38 };
  }

  function buildByKind(scene, kind) {
    if (kind === 'player') return buildPlayer(scene);
    if (kind === 'gunship') return buildGunship(scene);
    if (kind === 'corvette') return buildCorvette(scene);
    if (kind === 'carrier') return buildCarrier(scene);
    return buildFighter(scene);
  }

  return { buildPlayer, buildFighter, buildGunship, buildCorvette, buildCarrier, buildByKind };
})();

// ---------------------------------------------------------------------------
// SECTION: FX -- Thin-instanced additive glow quads + ribbon-billboard streaks
// (one draw call each), pooled particle explosions, shield sparks, missile exhaust,
// countermeasure flares, and lingering phase-laser beams.
// ---------------------------------------------------------------------------
Game.FX = (function () {
  const VERT = [
    'precision highp float;',
    'attribute vec3 position; attribute vec2 uv;',
    'attribute vec4 world0; attribute vec4 world1; attribute vec4 world2; attribute vec4 world3;',
    'attribute vec4 instanceColor;',
    'uniform mat4 viewProjection;',
    'varying vec2 vUV; varying vec4 vColor;',
    'void main(void) {',
    '  mat4 w = mat4(world0, world1, world2, world3);',
    '  vUV = uv; vColor = instanceColor;',
    '  gl_Position = viewProjection * w * vec4(position, 1.0);',
    '}'].join('\n');
  const FRAG_GLOW = [
    'precision highp float; varying vec2 vUV; varying vec4 vColor;',
    'void main(void) {',
    '  vec2 q = vUV * 2.0 - 1.0; float d2 = dot(q, q);',
    '  float a = exp(-d2 * 4.5) * (1.0 - smoothstep(0.7, 1.0, d2));',
    '  gl_FragColor = vec4(vColor.rgb * a * vColor.a, 1.0);',
    '}'].join('\n');
  const FRAG_STREAK = [
    'precision highp float; varying vec2 vUV; varying vec4 vColor;',
    'void main(void) {',
    '  vec2 q = vUV * 2.0 - 1.0;',
    '  float w = exp(-q.x * q.x * 5.0);',
    '  float l = pow(max(0.0, 1.0 - q.y * q.y), 1.4);',
    '  float core = exp(-q.x * q.x * 40.0) * l;',
    '  vec3 c = vColor.rgb * (w * l * 0.9) + vec3(1.0) * core * 0.8;',
    '  gl_FragColor = vec4(c * vColor.a, 1.0);',
    '}'].join('\n');

  function makeLayer(scene, name, frag, maxCount) {
    BABYLON.Effect.ShadersStore[name + 'VertexShader'] = VERT;
    BABYLON.Effect.ShadersStore[name + 'FragmentShader'] = frag;
    const mat = new BABYLON.ShaderMaterial(name, scene, { vertex: name, fragment: name }, {
      attributes: ['position', 'uv', 'world0', 'world1', 'world2', 'world3', 'instanceColor'],
      uniforms: ['viewProjection'], needAlphaBlending: true,
    });
    mat.backFaceCulling = false; mat.disableDepthWrite = true;
    mat.alphaMode = BABYLON.Constants.ALPHA_ONEONE;
    const mesh = BABYLON.MeshBuilder.CreatePlane(name + 'Quad', { size: 1 }, scene);
    mesh.material = mat; mesh.alwaysSelectAsActiveMesh = true; mesh.isPickable = false; mesh.renderingGroupId = 1;
    const mats = new Float32Array(maxCount * 16), cols = new Float32Array(maxCount * 4);
    mesh.thinInstanceSetBuffer('matrix', mats, 16, false);
    mesh.thinInstanceSetBuffer('instanceColor', cols, 4, false);
    mesh.thinInstanceCount = 0;
    return { mesh, mats, cols, n: 0, max: maxCount };
  }
  function pushInstance(L, rx, ry, rz, ux, uy, uz, fx, fy, fz, px, py, pz, r, g, b, a) {
    if (L.n >= L.max) return;
    const k = L.n * 16, c = L.n * 4;
    L.mats[k] = rx; L.mats[k + 1] = ry; L.mats[k + 2] = rz; L.mats[k + 3] = 0;
    L.mats[k + 4] = ux; L.mats[k + 5] = uy; L.mats[k + 6] = uz; L.mats[k + 7] = 0;
    L.mats[k + 8] = fx; L.mats[k + 9] = fy; L.mats[k + 10] = fz; L.mats[k + 11] = 0;
    L.mats[k + 12] = px; L.mats[k + 13] = py; L.mats[k + 14] = pz; L.mats[k + 15] = 1;
    L.cols[c] = r; L.cols[c + 1] = g; L.cols[c + 2] = b; L.cols[c + 3] = a;
    L.n++;
  }
  function flush(L) {
    L.mesh.thinInstanceCount = L.n;
    L.mesh.thinInstanceBufferUpdated('matrix');
    L.mesh.thinInstanceBufferUpdated('instanceColor');
  }

  function create(scene) {
    const glow = makeLayer(scene, 'fxGlow', FRAG_GLOW, 800);
    const streak = makeLayer(scene, 'fxStreak', FRAG_STREAK, 320);
    const MAXP = 600;
    const px = new Float32Array(MAXP), py = new Float32Array(MAXP), pz = new Float32Array(MAXP);
    const vx = new Float32Array(MAXP), vy = new Float32Array(MAXP), vz = new Float32Array(MAXP);
    const life = new Float32Array(MAXP), maxLife = new Float32Array(MAXP), s0 = new Float32Array(MAXP), s1 = new Float32Array(MAXP);
    const cr = new Float32Array(MAXP), cg = new Float32Array(MAXP), cb = new Float32Array(MAXP), ca = new Float32Array(MAXP);
    let cursor = 0;
    const rng = Game.Rng.createRng(99173);

    // Active laser beams (rendered as ribbon streaks while fading)
    const beams = [];

    function spawn(x, y, z, ax, ay, az, lifeS, size0, size1, r, g, b, a) {
      const i = cursor; cursor = (cursor + 1) % MAXP;
      px[i] = x; py[i] = y; pz[i] = z; vx[i] = ax; vy[i] = ay; vz[i] = az;
      life[i] = lifeS; maxLife[i] = lifeS; s0[i] = size0; s1[i] = size1; cr[i] = r; cg[i] = g; cb[i] = b; ca[i] = a;
    }
    function burst(pos, baseVel, count, speed, lifeS, size, r, g, b) {
      for (let n = 0; n < count; n++) {
        const u = rng.next() * 2 - 1, th = rng.next() * 6.2831853, s = Math.sqrt(1 - u * u);
        const sp = speed * (0.35 + 0.65 * rng.next());
        spawn(pos.x, pos.y, pos.z, baseVel.x + s * Math.cos(th) * sp, baseVel.y + u * sp, baseVel.z + s * Math.sin(th) * sp,
          lifeS * (0.55 + 0.45 * rng.next()), size * (0.6 + 0.8 * rng.next()), size * 0.15, r, g, b, 1);
      }
    }
    function explosion(pos, baseVel, scale) {
      spawn(pos.x, pos.y, pos.z, baseVel.x, baseVel.y, baseVel.z, 0.55, 12 * scale, 48 * scale, 1.0, 0.9, 0.6, 1.0);
      burst(pos, baseVel, 28, 75 * scale, 1.45, 7.5 * scale, 1.0, 0.48, 0.14);
      burst(pos, baseVel, 18, 125 * scale, 0.95, 3.8 * scale, 1.0, 0.88, 0.52);
      burst(pos, baseVel, 12, 32 * scale, 2.1, 13 * scale, 0.55, 0.18, 0.06);
    }
    function sparks(pos, baseVel, count, color) {
      burst(pos, baseVel, count, 95, 0.38, 2.4, color[0], color[1], color[2]);
    }
    function laserBeam(start, end) {
      beams.push({
        sx: start.x, sy: start.y, sz: start.z,
        ex: end.x, ey: end.y, ez: end.z,
        life: 0.32, maxLife: 0.32
      });
    }
    function flareBurst(pos, baseVel) {
      burst(pos, baseVel, 18, 65, 2.2, 5.5, 1.0, 0.85, 0.35);
    }

    function updateParticles(dt, camPos, camRight, camUp, camFwd) {
      glow.n = 0;
      for (let i = 0; i < MAXP; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        if (life[i] <= 0) continue;
        px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt;
        const t = 1 - life[i] / maxLife[i];
        const size = s0[i] + (s1[i] - s0[i]) * t;
        const a = ca[i] * (1 - t) * (1 - t * 0.3);
        pushInstance(glow, camRight.x * size, camRight.y * size, camRight.z * size, camUp.x * size, camUp.y * size, camUp.z * size,
          camFwd.x, camFwd.y, camFwd.z, px[i], py[i], pz[i], cr[i], cg[i], cb[i], a);
      }
    }
    function glowAt(x, y, z, size, r, g, b, a, camRight, camUp, camFwd) {
      pushInstance(glow, camRight.x * size, camRight.y * size, camRight.z * size, camUp.x * size, camUp.y * size, camUp.z * size,
        camFwd.x, camFwd.y, camFwd.z, x, y, z, r, g, b, a);
    }
    function beginStreaks() { streak.n = 0; }
    function streakAt(x, y, z, dx, dy, dz, length, width, camPos, r, g, b, a) {
      let tx = camPos.x - x, ty = camPos.y - y, tz = camPos.z - z;
      let l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
      let sx = dy * tz - dz * ty, sy = dz * tx - dx * tz, sz = dx * ty - dy * tx;
      l = Math.hypot(sx, sy, sz);
      if (l < 1e-4) { sx = 1; sy = 0; sz = 0; l = 1; }
      sx /= l; sy /= l; sz /= l;
      pushInstance(streak, sx * width, sy * width, sz * width, dx * length, dy * length, dz * length, tx, ty, tz, x, y, z, r, g, b, a);
    }
    function updateBeams(dt, camPos) {
      for (let i = beams.length - 1; i >= 0; i--) {
        const b = beams[i];
        b.life -= dt;
        if (b.life <= 0) { beams.splice(i, 1); continue; }
        const dx = b.ex - b.sx, dy = b.ey - b.sy, dz = b.ez - b.sz;
        const len = Math.hypot(dx, dy, dz) || 1;
        const mx = (b.sx + b.ex) * 0.5, my = (b.sy + b.ey) * 0.5, mz = (b.sz + b.ez) * 0.5;
        const alpha = b.life / b.maxLife;
        streakAt(mx, my, mz, dx / len, dy / len, dz / len, len, 3.6 * alpha, camPos, 0.25, 0.95, 1.0, alpha);
      }
    }
    function endFrame() { flush(glow); flush(streak); }
    function shift(off) {
      for (let i = 0; i < MAXP; i++) { px[i] -= off.x; py[i] -= off.y; pz[i] -= off.z; }
      for (const b of beams) {
        b.sx -= off.x; b.sy -= off.y; b.sz -= off.z;
        b.ex -= off.x; b.ey -= off.y; b.ez -= off.z;
      }
    }
    function clear() { life.fill(0); beams.length = 0; }
    return { updateParticles, updateBeams, glowAt, beginStreaks, streakAt, endFrame, spawn, burst, explosion, sparks, laserBeam, flareBurst, shift, clear };
  }
  return { create };
})();

// ---------------------------------------------------------------------------
// SECTION: COMBAT -- Primary twin plasma autocannons, high-energy phase laser,
// 3D proportional-navigation seeker missiles, countermeasures, enemy squad AI
// (fighter, gunship, corvette, dreadnought carrier) with banking & V-formation
// choreography, swept relative-motion CCD, Auto-Target Lock, and wave director.
// ---------------------------------------------------------------------------
Game.Combat = (function () {
  const V = Game.Vec3, Q = Game.Quat, FC = Game.FlightController;
  const DEG = Math.PI / 180;

  function segSphereTime(px, py, pz, wx, wy, wz, R, dt) {
    const c = px * px + py * py + pz * pz - R * R;
    if (c <= 0) return 0;
    const a = wx * wx + wy * wy + wz * wz;
    if (a < 1e-12) return -1;
    const b = px * wx + py * wy + pz * wz;
    const disc = b * b - a * c;
    if (disc < 0) return -1;
    const t = (-b - Math.sqrt(disc)) / a;
    return t >= 0 && t <= dt ? t : -1;
  }

  function interceptTime(rel, vrel, s) {
    const a = V.dot(vrel, vrel) - s * s, b = 2 * V.dot(rel, vrel), c = V.dot(rel, rel);
    if (Math.abs(a) < 1e-9) return b < 0 ? -c / b : -1;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return -1;
    const sq = Math.sqrt(disc), t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a);
    const lo = Math.min(t1, t2), hi = Math.max(t1, t2);
    return lo > 0 ? lo : hi > 0 ? hi : -1;
  }

  const CORVETTE_PROFILE = {
    accelFwd: 420, accelRev: 260, accelLat: 260, accelVert: 260, softMaxSpeed: 230,
    maxPitchRate: Game.Constants.SHIP_MAX_PITCH_RATE_RAD * 0.38,
    maxYawRate: Game.Constants.SHIP_MAX_YAW_RATE_RAD * 0.38,
    maxRollRate: Game.Constants.SHIP_MAX_ROLL_RATE_RAD * 0.32, angularTau: 0.34,
  };
  const CARRIER_PROFILE = {
    accelFwd: 160, accelRev: 100, accelLat: 90, accelVert: 90, softMaxSpeed: 110,
    maxPitchRate: Game.Constants.SHIP_MAX_PITCH_RATE_RAD * 0.18,
    maxYawRate: Game.Constants.SHIP_MAX_YAW_RATE_RAD * 0.18,
    maxRollRate: Game.Constants.SHIP_MAX_ROLL_RATE_RAD * 0.15, angularTau: 0.55,
  };

  const KINDS = {
    player: { radius: 6, hull: 120, shield: 150, team: 0 },
    fighter: { radius: 7.5, hull: 45, shield: 35, team: 1, profile: FC.FIGHTER_PROFILE, boltSpeed: 900, boltDmg: 8, interval: 0.45, spread: 2.2, range: 950, cone: 5.5, hold: 330, score: 100 },
    gunship: { radius: 11, hull: 160, shield: 120, team: 1, profile: FC.GUNSHIP_PROFILE, boltSpeed: 800, boltDmg: 14, interval: 0.9, spread: 1.6, range: 1200, cone: 4.5, hold: 560, score: 300 },
    corvette: { radius: 15, hull: 240, shield: 180, team: 1, profile: CORVETTE_PROFILE, boltSpeed: 860, boltDmg: 18, interval: 0.75, spread: 1.4, range: 1350, cone: 5.0, hold: 640, score: 500 },
    carrier: { radius: 36, hull: 680, shield: 520, team: 1, profile: CARRIER_PROFILE, boltSpeed: 820, boltDmg: 22, interval: 0.55, spread: 2.0, range: 1500, cone: 8.0, hold: 780, score: 1500 },
  };
  const WAVES = [
    { fighter: 3 }, { fighter: 4 }, { fighter: 3, gunship: 1 }, { fighter: 5, gunship: 1 }, { fighter: 4, gunship: 2 },
  ];
  const PLAYER_GUN = { boltSpeed: 1400, boltDmg: 14, interval: 1 / 7, life: 1.1, heatPer: 0.055, cool: 0.30, lockCool: 0.45, assistCone: 6 * DEG, assist: 0.65 };
  const PLAYER_LASER = { range: 1450, dmg: 44, cooldown: 2.2, cone: 18 * DEG };
  const PLAYER_MISSILE = { speed: 460, turnRate: 2.8, dmg: 72, life: 4.2, cooldown: 1.2, maxAmmo: 8 };

  function create(hooks, opts) {
    hooks = hooks || {};
    opts = opts || {};
    const rng = Game.Rng.createRng(opts.seed || 20260825);
    const MAXB = 240;
    const B = {
      x: new Float32Array(MAXB), y: new Float32Array(MAXB), z: new Float32Array(MAXB),
      vx: new Float32Array(MAXB), vy: new Float32Array(MAXB), vz: new Float32Array(MAXB),
      life: new Float32Array(MAXB), team: new Uint8Array(MAXB), dmg: new Float32Array(MAXB),
      active: new Uint8Array(MAXB), cursor: 0, MAX: MAXB
    };

    function fireBolt(origin, vel, team, dmg, life) {
      for (let k = 0; k < MAXB; k++) {
        const i = (B.cursor + k) % MAXB;
        if (!B.active[i]) {
          B.cursor = (i + 1) % MAXB;
          B.x[i] = origin.x; B.y[i] = origin.y; B.z[i] = origin.z;
          B.vx[i] = vel.x; B.vy[i] = vel.y; B.vz[i] = vel.z;
          B.life[i] = life; B.team[i] = team; B.dmg[i] = dmg; B.active[i] = 1;
          return i;
        }
      }
      return -1;
    }

    const MAXM = 24;
    const M = [];
    for (let i = 0; i < MAXM; i++) {
      M.push({ active: false, pos: V.v3(), vel: V.v3(), dir: V.v3(0, 0, 1), team: 0, target: null, life: 0, dmg: 72 });
    }

    let activeWaves = WAVES.slice();

    const S = {
      bodies: [], enemies: [], player: null, bolts: B, missiles: M, time: 0,
      mode: 'idle', wave: 0, maxWaves: activeWaves.length, timer: 0, score: 0, credits: 600, kills: 0,
      heat: 0, overheated: false, muzzle: 0, nextShot: 0, fireHeld: false, assist: true, target: null,
      laserReadyAt: 0, missileReadyAt: 0, missileAmmo: PLAYER_MISSILE.maxAmmo, flares: 6, flareActiveUntil: 0,
      shieldSectors: { fore: 100, aft: 100, port: 100, starboard: 100 },
      upgrades: {
        ndFilter: true,
        spectralFilter: false,
        coronagraphFilter: false,
        gimbalMk2: false,
        cryoCooler: false,
        heavyArmor: false
      },
      settings: {
        assist: opts.assist !== false,
        autoFire: !!opts.autoFire,
        autoLock: !!opts.autoLock
      },
    };
    const _fwd = V.v3(), _right = V.v3(), _up = V.v3(), _a = V.v3(), _rel = V.v3(), _vrel = V.v3(), _aLoc = V.v3(), _o = V.v3(), _v = V.v3();
    const _qc = { x: 0, y: 0, z: 0, w: 1 };

    function axes(e) {
      Q.qRotateVector(_fwd, e.orientation, { x: 0, y: 0, z: 1 });
      Q.qRotateVector(_right, e.orientation, { x: 1, y: 0, z: 0 });
      Q.qRotateVector(_up, e.orientation, { x: 0, y: 1, z: 0 });
    }

    function makeEntity(kind, pos, vel, q) {
      const K = KINDS[kind] || KINDS.fighter;
      const e = Game.PhysicsWorld.createBody(kind + '_' + (S.bodies.length + Math.floor(S.time * 1000)), pos, vel, q);
      e.kind = kind; e.team = K.team; e.radius = K.radius; e.hullMax = K.hull; e.hull = K.hull; e.shieldMax = K.shield; e.shield = K.shield;
      e.alive = true; e.lastHitT = -99; e.controlState = FC.createShipControlState(); e.profile = K.profile || FC.PLAYER_PROFILE;
      e.thrust = 0;
      if (K.team === 1) {
        e.ai = {
          state: 'engage', until: 0, phase: rng.next() * 6.28,
          nextFire: S.time + 0.8 + rng.next(), breakDir: V.v3(),
          nextBreak: S.time + 5 + rng.next() * 4, burst: 0, K,
          nextSpawn: S.time + 14
        };
      }
      return e;
    }

    function setPlayer(e) { S.player = e; S.bodies.length = 0; S.bodies.push(e); S.enemies.length = 0; }

    function applyDamage(e, dmg, t, hitPos) {
      if (!e.alive) return;
      e.lastHitT = t;
      let shieldHit = false;
      if (e.shield >= dmg) { e.shield -= dmg; shieldHit = true; }
      else { const rem = dmg - e.shield; e.shield = 0; e.hull -= rem; }
      if (e === S.player) {
        const pct = Math.max(0, Math.round((e.shield / Math.max(1, e.shieldMax)) * 100));
        S.shieldSectors.fore = pct;
        S.shieldSectors.aft = Math.min(100, pct + 4);
        S.shieldSectors.port = pct;
        S.shieldSectors.starboard = pct;
      }
      if (hooks.onHit) hooks.onHit(e, hitPos, shieldHit, dmg);
      if (e.hull <= 0) { e.alive = false; if (hooks.onKill) hooks.onKill(e); }
    }

    function bestTarget(maxAngle) {
      const p = S.player; if (!p) return null;
      axes(p);
      let best = null, bestAng = maxAngle;
      for (const e of S.enemies) {
        if (!e.alive) continue;
        V.sub(_rel, e.positionMeters, p.positionMeters);
        const d = V.length(_rel); if (d < 1) continue;
        const ang = Math.acos(Math.max(-1, Math.min(1, V.dot(_rel, _fwd) / d)));
        if (ang < bestAng) { bestAng = ang; best = e; }
      }
      return best ? { enemy: best, angle: bestAng } : null;
    }

    function leadDir(out, shooter, target, speed) {
      V.sub(_rel, target.positionMeters, shooter.positionMeters);
      V.sub(_vrel, target.velocityMps, shooter.velocityMps);
      const t = interceptTime(_rel, vrelOrZero(_vrel), speed);
      const tt = t > 0 ? Math.min(t, 3) : V.length(_rel) / speed;
      out.x = _rel.x + _vrel.x * tt; out.y = _rel.y + _vrel.y * tt; out.z = _rel.z + _vrel.z * tt;
      V.normalize(out, out);
      return out;
    }
    function vrelOrZero(v) { return v; }

    function playerFire() {
      const p = S.player, G = PLAYER_GUN;
      axes(p);
      const side = (S.muzzle++ & 1) ? 1 : -1;
      _o.x = p.positionMeters.x + _fwd.x * 8 + _right.x * 3.4 * side - _up.x * 0.3;
      _o.y = p.positionMeters.y + _fwd.y * 8 + _right.y * 3.4 * side - _up.y * 0.3;
      _o.z = p.positionMeters.z + _fwd.z * 8 + _right.z * 3.4 * side - _up.z * 0.3;
      _a.x = _fwd.x; _a.y = _fwd.y; _a.z = _fwd.z;
      if (S.settings.assist || S.settings.autoLock) {
        const cone = S.settings.autoLock ? ((S.upgrades.gimbalMk2 ? 28 : 19) * DEG) : G.assistCone;
        const blend = S.settings.autoLock ? 0.92 : G.assist;
        const tg = bestTarget(cone);
        if (tg) {
          const ld = V.v3(); leadDir(ld, p, tg.enemy, G.boltSpeed);
          _a.x = _fwd.x + (ld.x - _fwd.x) * blend;
          _a.y = _fwd.y + (ld.y - _fwd.y) * blend;
          _a.z = _fwd.z + (ld.z - _fwd.z) * blend;
          V.normalize(_a, _a);
        }
      }
      _v.x = p.velocityMps.x + _a.x * G.boltSpeed;
      _v.y = p.velocityMps.y + _a.y * G.boltSpeed;
      _v.z = p.velocityMps.z + _a.z * G.boltSpeed;
      fireBolt(_o, _v, 0, G.boltDmg, G.life);
      const heatMul = S.upgrades.cryoCooler ? 0.65 : 1.0;
      S.heat += G.heatPer * heatMul;
      if (S.heat >= 1) { S.heat = 1; S.overheated = true; if (hooks.onOverheat) hooks.onOverheat(); }
      if (hooks.onFire) hooks.onFire(p, true, _o);
    }

    function fireLaser() {
      const p = S.player;
      if (!p || !p.alive || S.time < S.laserReadyAt) return false;
      S.laserReadyAt = S.time + PLAYER_LASER.cooldown;
      axes(p);
      const start = V.v3(p.positionMeters.x + _fwd.x * 9, p.positionMeters.y + _fwd.y * 9, p.positionMeters.z + _fwd.z * 9);
      const tg = bestTarget(S.settings.autoLock ? 26 * DEG : PLAYER_LASER.cone);
      let end = V.v3(start.x + _fwd.x * PLAYER_LASER.range, start.y + _fwd.y * PLAYER_LASER.range, start.z + _fwd.z * PLAYER_LASER.range);
      let hitE = null;
      if (tg && V.length(V.sub(V.v3(), tg.enemy.positionMeters, p.positionMeters)) <= PLAYER_LASER.range) {
        hitE = tg.enemy;
        end = V.v3(hitE.positionMeters.x, hitE.positionMeters.y, hitE.positionMeters.z);
        applyDamage(hitE, PLAYER_LASER.dmg, S.time, end);
      }
      S.heat = Math.min(1, S.heat + (S.upgrades.cryoCooler ? 0.11 : 0.18));
      if (hooks.onLaser) hooks.onLaser(start, end, hitE);
      return true;
    }

    function fireMissile() {
      const p = S.player;
      if (!p || !p.alive || S.missileAmmo <= 0 || S.time < S.missileReadyAt) return false;
      let tgt = S.target && S.target.alive ? S.target : null;
      if (!tgt) {
        const bt = bestTarget(35 * DEG) || bestTarget(Math.PI);
        if (bt) tgt = bt.enemy;
      }
      for (let i = 0; i < MAXM; i++) {
        const m = M[i];
        if (!m.active) {
          axes(p);
          m.active = true;
          m.team = 0;
          m.target = tgt;
          m.life = PLAYER_MISSILE.life;
          m.dmg = PLAYER_MISSILE.dmg;
          V.set(m.pos, p.positionMeters.x + _fwd.x * 7 - _up.x * 1.2, p.positionMeters.y + _fwd.y * 7 - _up.y * 1.2, p.positionMeters.z + _fwd.z * 7 - _up.z * 1.2);
          V.copy(m.dir, _fwd);
          V.set(m.vel, p.velocityMps.x + _fwd.x * PLAYER_MISSILE.speed, p.velocityMps.y + _fwd.y * PLAYER_MISSILE.speed, p.velocityMps.z + _fwd.z * PLAYER_MISSILE.speed);
          S.missileAmmo--;
          S.missileReadyAt = S.time + PLAYER_MISSILE.cooldown;
          if (hooks.onMissile) hooks.onMissile(m);
          return true;
        }
      }
      return false;
    }

    function deployFlare() {
      const p = S.player;
      if (!p || !p.alive || S.flares <= 0) return false;
      S.flares--;
      S.flareActiveUntil = S.time + 3.2;
      if (hooks.onFlare) hooks.onFlare(p.positionMeters, p.velocityMps);
      return true;
    }

    const _intent = { thrust: 0, strafe: 0, vertical: 0, yaw: 0, pitch: 0, roll: 0 };
    function steer(e, dir, gain) {
      Q.qConjugate(_qc, e.orientation); Q.qRotateVector(_aLoc, _qc, dir);
      const yawErr = Math.atan2(_aLoc.x, _aLoc.z), pitchErr = Math.atan2(_aLoc.y, Math.hypot(_aLoc.x, _aLoc.z));
      _intent.yaw = Math.max(-1, Math.min(1, yawErr * gain));
      _intent.pitch = Math.max(-1, Math.min(1, pitchErr * gain));
      // Dynamic fighter banking roll into turns for realistic dogfight choreography
      _intent.roll = Math.max(-1, Math.min(1, -_intent.yaw * 0.72));
      return Math.abs(yawErr) + Math.abs(pitchErr);
    }

    function enemyThink(e, dt) {
      const p = S.player, ai = e.ai, K = ai.K, t = S.time;
      _intent.thrust = 0; _intent.strafe = 0; _intent.vertical = 0; _intent.yaw = 0; _intent.pitch = 0; _intent.roll = 0;
      V.sub(_rel, p.positionMeters, e.positionMeters);
      const dist = V.length(_rel);
      axes(e);
      const dir = V.v3(); leadDir(dir, e, p, K.boltSpeed);
      const cosA = V.dot(_fwd, dir);
      const ang = Math.acos(Math.max(-1, Math.min(1, cosA)));

      if (e.kind === 'carrier' && t >= ai.nextSpawn && S.enemies.length < 6) {
        ai.nextSpawn = t + 16;
        spawnEnemy('fighter');
      }

      if (ai.state === 'engage') {
        steer(e, dir, 3.2);
        const fSpd = V.dot(e.velocityMps, _fwd);
        const desSpd = dist > K.hold * 1.6 ? 420 : dist > K.hold * 0.85 ? 165 : -90;
        _intent.thrust = Math.max(-1, Math.min(1, (desSpd - fSpd) * 0.015));
        if (Math.abs(_intent.thrust) < 0.05) _intent.thrust = 0;
        const wv = Math.sin(t * 0.9 + ai.phase) > 0.3 ? (K === KINDS.fighter ? 0.18 : 0.08) * Math.sin(t * 1.5 + ai.phase) : 0;
        _intent.strafe = wv;
        _intent.vertical = 0;
        const underFire = t - e.lastHitT < 0.25;
        if (e.kind !== 'carrier' && (t > ai.nextBreak || (underFire && rng.next() < 0.02) || dist < 70)) {
          ai.state = 'break'; ai.until = t + 1.1 + rng.next() * 0.9; ai.nextBreak = t + 5 + rng.next() * 5;
          const th = rng.next() * 6.283, u = rng.next() * 2 - 1, s = Math.sqrt(1 - u * u);
          ai.breakDir.x = s * Math.cos(th); ai.breakDir.y = u * 0.6; ai.breakDir.z = s * Math.sin(th);
          ai.breakDir.x -= _rel.x / dist * 0.8; ai.breakDir.y -= _rel.y / dist * 0.8; ai.breakDir.z -= _rel.z / dist * 0.8;
          V.normalize(ai.breakDir, ai.breakDir);
        }
        if (ang < K.cone * DEG && dist < K.range && t >= ai.nextFire && t > S.flareActiveUntil) {
          ai.nextFire = t + K.interval * (0.85 + 0.3 * rng.next());
          enemyFire(e, K);
        }
      } else {
        steer(e, ai.breakDir, 3.0);
        _intent.thrust = 1;
        _intent.strafe = Math.sin(t * 3 + ai.phase) * 0.5;
        _intent.roll = Math.sin(t * 4.2 + ai.phase) * 0.85;
        if (t > ai.until) ai.state = 'engage';
      }
      FC.update(e, _intent, dt);
      e.thrust = _intent.thrust;
    }

    function enemyFire(e, K) {
      axes(e);
      const sp = K.spread * DEG;
      const ax = (rng.next() * 2 - 1) * sp, ay = (rng.next() * 2 - 1) * sp;
      _a.x = _fwd.x + _right.x * ax + _up.x * ay;
      _a.y = _fwd.y + _right.y * ax + _up.y * ay;
      _a.z = _fwd.z + _right.z * ax + _up.z * ay;
      V.normalize(_a, _a);
      const side = (e.kind === 'gunship' || e.kind === 'corvette' || e.kind === 'carrier') ? ((e.ai.burst++ & 1) ? 1 : -1) : 0;
      _o.x = e.positionMeters.x + _fwd.x * (e.radius + 3) + _right.x * 5 * side;
      _o.y = e.positionMeters.y + _fwd.y * (e.radius + 3) + _right.y * 5 * side;
      _o.z = e.positionMeters.z + _fwd.z * (e.radius + 3) + _right.z * 5 * side;
      _v.x = e.velocityMps.x + _a.x * K.boltSpeed;
      _v.y = e.velocityMps.y + _a.y * K.boltSpeed;
      _v.z = e.velocityMps.z + _a.z * K.boltSpeed;
      fireBolt(_o, _v, 1, K.boltDmg, 1.7);
      if (hooks.onFire) hooks.onFire(e, false, _o);
    }

    function spawnEnemy(kind, formationSlot) {
      const p = S.player; axes(p);
      let pos;
      if (formationSlot !== undefined) {
        // Cohesive V-echelon squadron formation ahead of the player
        const wingSide = (formationSlot % 2 === 0) ? 1 : -1;
        const rank = Math.ceil(formationSlot * 0.5);
        const fwdDist = (kind === 'carrier' ? 1180 : 920) + rank * 55;
        const latSpread = wingSide * rank * 68;
        const vertSpread = ((formationSlot % 3) - 1) * 28;
        pos = V.v3(
          p.positionMeters.x + _fwd.x * fwdDist + _right.x * latSpread + _up.x * vertSpread,
          p.positionMeters.y + _fwd.y * fwdDist + _right.y * latSpread + _up.y * vertSpread,
          p.positionMeters.z + _fwd.z * fwdDist + _right.z * latSpread + _up.z * vertSpread
        );
      } else {
        const th = rng.next() * 6.283, u = (rng.next() * 2 - 1), s = Math.sqrt(1 - u * u);
        let dx = s * Math.cos(th), dy = u * 0.7, dz = s * Math.sin(th);
        const bias = 0.6;
        const wx = dx + _fwd.x * bias * 1.4, wy = dy + _fwd.y * bias * 1.4, wz = dz + _fwd.z * bias * 1.4;
        const dist = kind === 'carrier' ? 1150 : (850 + rng.next() * 400);
        const d = V.v3(wx, wy, wz); V.normalize(d, d);
        pos = V.v3(p.positionMeters.x + d.x * dist, p.positionMeters.y + d.y * dist, p.positionMeters.z + d.z * dist);
      }
      const vel = V.v3(p.velocityMps.x, p.velocityMps.y, p.velocityMps.z);
      const f = V.v3(p.positionMeters.x - pos.x, p.positionMeters.y - pos.y, p.positionMeters.z - pos.z); V.normalize(f, f);
      const up0 = Math.abs(f.y) > 0.95 ? V.v3(1, 0, 0) : V.v3(0, 1, 0);
      const right = V.v3(); V.cross(right, up0, f); V.normalize(right, right);
      const up = V.v3(); V.cross(up, f, right);
      const q = { x: 0, y: 0, z: 0, w: 1 }; Q.qFromBasis(q, right, up, f);
      const e = makeEntity(kind, pos, vel, q);
      S.bodies.push(e); S.enemies.push(e);
      if (hooks.onSpawn) hooks.onSpawn(e);
      return e;
    }

    function setSectorWaves(waveList) {
      if (Array.isArray(waveList) && waveList.length > 0) {
        activeWaves = waveList.slice();
        S.maxWaves = activeWaves.length;
      }
    }

    function startWave(n) {
      S.wave = n; S.mode = 'fight';
      const spec = activeWaves[(n - 1) % activeWaves.length] || WAVES[0];
      let slot = 0;
      for (const kind in spec) {
        for (let i = 0; i < spec[kind]; i++) {
          spawnEnemy(kind, slot++);
        }
      }
      if (hooks.onWave) hooks.onWave(n, S.maxWaves);
      if (hooks.onState) hooks.onState(S.mode);
    }

    function reset(player, customWaves) {
      if (customWaves) setSectorWaves(customWaves);
      for (const e of S.enemies) if (hooks.onRemove) hooks.onRemove(e);
      S.enemies.length = 0; B.active.fill(0);
      for (const m of M) m.active = false;
      setPlayer(player);
      player.hull = player.hullMax; player.shield = player.shieldMax; player.alive = true;
      S.shieldSectors.fore = 100; S.shieldSectors.aft = 100; S.shieldSectors.port = 100; S.shieldSectors.starboard = 100;
      S.missileAmmo = PLAYER_MISSILE.maxAmmo; S.flares = 6;
      S.wave = 0; S.heat = 0; S.overheated = false; S.mode = 'intro'; S.timer = 2.2;
      if (hooks.onState) hooks.onState(S.mode);
    }

    function preStep(dt) {
      S.time += dt;
      const p = S.player; if (!p) return;
      if (p.alive && S.time - p.lastHitT > 3.5 && p.shield < p.shieldMax) {
        p.shield = Math.min(p.shieldMax, p.shield + 22 * dt);
        const pct = Math.round((p.shield / Math.max(1, p.shieldMax)) * 100);
        S.shieldSectors.fore = pct; S.shieldSectors.aft = pct; S.shieldSectors.port = pct; S.shieldSectors.starboard = pct;
      }
      for (const e of S.enemies) if (e.alive && S.time - e.lastHitT > 6 && e.shield < e.shieldMax) e.shield = Math.min(e.shieldMax, e.shield + 6 * dt);

      const bt = bestTarget(Math.PI);
      S.target = bt ? bt.enemy : null;

      S.heat = Math.max(0, S.heat - PLAYER_GUN.cool * dt);
      if (S.overheated && S.heat < PLAYER_GUN.lockCool) S.overheated = false;

      let wantFire = S.fireHeld;
      const autoCone = S.settings.autoLock ? ((S.upgrades.gimbalMk2 ? 24 : 16) * DEG) : (7.5 * DEG);
      if (!wantFire && S.settings.autoFire && bt && bt.angle < autoCone) {
        const dist = V.length(V.sub(_rel, bt.enemy.positionMeters, p.positionMeters));
        if (dist < 1100) wantFire = true;
      }
      if (p.alive && wantFire && !S.overheated && S.time >= S.nextShot && (S.mode === 'fight' || S.mode === 'intro' || S.mode === 'between')) {
        S.nextShot = S.time + PLAYER_GUN.interval;
        playerFire();
      }

      if (S.mode === 'fight' || S.mode === 'between') {
        for (const e of S.enemies) if (e.alive) enemyThink(e, dt);
      }

      for (let i = 0; i < MAXM; i++) {
        const m = M[i];
        if (!m.active) continue;
        m.life -= dt;
        if (m.life <= 0) { m.active = false; continue; }
        if (m.target && m.target.alive) {
          const toT = V.v3();
          V.sub(toT, m.target.positionMeters, m.pos);
          const d = V.length(toT);
          if (d < m.target.radius + 10) {
            m.active = false;
            applyDamage(m.target, m.dmg, S.time, m.pos);
            continue;
          }
          V.normalize(toT, toT);
          const rate = PLAYER_MISSILE.turnRate * dt;
          m.dir.x += (toT.x - m.dir.x) * Math.min(1, rate * 3.5);
          m.dir.y += (toT.y - m.dir.y) * Math.min(1, rate * 3.5);
          m.dir.z += (toT.z - m.dir.z) * Math.min(1, rate * 3.5);
          V.normalize(m.dir, m.dir);
          V.set(m.vel, m.dir.x * PLAYER_MISSILE.speed, m.dir.y * PLAYER_MISSILE.speed, m.dir.z * PLAYER_MISSILE.speed);
        }
        m.pos.x += m.vel.x * dt; m.pos.y += m.vel.y * dt; m.pos.z += m.vel.z * dt;
      }

      for (let i = 0; i < MAXB; i++) {
        if (!B.active[i]) continue;
        let hitT = -1, hitE = null;
        for (let k = 0; k < S.bodies.length; k++) {
          const e = S.bodies[k];
          if (!e.alive || e.team === B.team[i]) continue;
          const t = segSphereTime(
            B.x[i] - e.positionMeters.x, B.y[i] - e.positionMeters.y, B.z[i] - e.positionMeters.z,
            B.vx[i] - e.velocityMps.x, B.vy[i] - e.velocityMps.y, B.vz[i] - e.velocityMps.z,
            e.radius + 1.2, dt
          );
          if (t >= 0 && (hitT < 0 || t < hitT)) { hitT = t; hitE = e; }
        }
        if (hitE) {
          const hp = V.v3(B.x[i] + B.vx[i] * hitT, B.y[i] + B.vy[i] * hitT, B.z[i] + B.vz[i] * hitT);
          B.active[i] = 0;
          applyDamage(hitE, B.dmg[i], S.time, hp);
        } else {
          B.x[i] += B.vx[i] * dt; B.y[i] += B.vy[i] * dt; B.z[i] += B.vz[i] * dt;
          B.life[i] -= dt; if (B.life[i] <= 0) B.active[i] = 0;
        }
      }
    }

    function postStep(dt) {
      const p = S.player; if (!p) return;
      const bs = S.bodies;
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i], b = bs[j]; if (!a.alive || !b.alive) continue;
        const dx = b.positionMeters.x - a.positionMeters.x, dy = b.positionMeters.y - a.positionMeters.y, dz = b.positionMeters.z - a.positionMeters.z;
        const R = a.radius + b.radius, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= R * R || d2 < 1e-9) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d, pen = R - d;
        a.positionMeters.x -= nx * pen * 0.5; a.positionMeters.y -= ny * pen * 0.5; a.positionMeters.z -= nz * pen * 0.5;
        b.positionMeters.x += nx * pen * 0.5; b.positionMeters.y += ny * pen * 0.5; b.positionMeters.z += nz * pen * 0.5;
        const vn = (b.velocityMps.x - a.velocityMps.x) * nx + (b.velocityMps.y - a.velocityMps.y) * ny + (b.velocityMps.z - a.velocityMps.z) * nz;
        if (vn < 0) {
          const j2 = -(1.3) * vn * 0.5;
          a.velocityMps.x -= nx * j2; a.velocityMps.y -= ny * j2; a.velocityMps.z -= nz * j2;
          b.velocityMps.x += nx * j2; b.velocityMps.y += ny * j2; b.velocityMps.z += nz * j2;
          const dmg = Math.min(45, -vn * 0.08);
          if (dmg > 1) {
            const mp = V.v3((a.positionMeters.x + b.positionMeters.x) / 2, (a.positionMeters.y + b.positionMeters.y) / 2, (a.positionMeters.z + b.positionMeters.z) / 2);
            applyDamage(a, dmg, S.time, mp); applyDamage(b, dmg, S.time, mp);
          }
        }
      }
      for (let k = S.enemies.length - 1; k >= 0; k--) {
        const e = S.enemies[k];
        if (!e.alive) {
          S.enemies.splice(k, 1); const bi = S.bodies.indexOf(e); if (bi >= 0) S.bodies.splice(bi, 1);
          const reward = KINDS[e.kind] ? KINDS[e.kind].score : 100;
          S.score += reward; S.credits += reward; S.kills++;
          if (hooks.onRemove) hooks.onRemove(e);
        }
      }
      if (!p.alive && S.mode !== 'gameover') { S.mode = 'gameover'; if (hooks.onState) hooks.onState(S.mode); return; }
      if (S.mode === 'intro') { S.timer -= dt; if (S.timer <= 0) startWave(1); }
      else if (S.mode === 'fight' && S.enemies.length === 0) {
        const bonus = 250 * S.wave;
        S.score += bonus; S.credits += bonus;
        if (S.wave >= S.maxWaves) { S.mode = 'victory'; if (hooks.onState) hooks.onState(S.mode); }
        else {
          S.mode = 'between'; S.timer = 4;
          p.shield = Math.min(p.shieldMax, p.shield + p.shieldMax * 0.5);
          S.missileAmmo = Math.min(PLAYER_MISSILE.maxAmmo, S.missileAmmo + 2);
          if (hooks.onState) hooks.onState(S.mode);
        }
      } else if (S.mode === 'between') { S.timer -= dt; if (S.timer <= 0) startWave(S.wave + 1); }
    }

    function shift(off) {
      for (let i = 0; i < MAXB; i++) if (B.active[i]) { B.x[i] -= off.x; B.y[i] -= off.y; B.z[i] -= off.z; }
      for (let i = 0; i < MAXM; i++) if (M[i].active) { M[i].pos.x -= off.x; M[i].pos.y -= off.y; M[i].pos.z -= off.z; }
    }

    return {
      S, B, M, preStep, postStep, reset, setPlayer, makeEntity, spawnEnemy,
      applyDamage, bestTarget, leadDir, shift, startWave, setSectorWaves,
      fireLaser, fireMissile, deployFlare
    };
  }
  return { create, segSphereTime, interceptTime, KINDS, WAVES, PLAYER_GUN, PLAYER_LASER, PLAYER_MISSILE };
})();

// ---------------------------------------------------------------------------
// SECTION: AUDIO -- Procedural WebAudio cockpit & sensor sonification (§32).
// Unlocks automatically on the first pointer/touch/key gesture.
// Synthesizes: relativistic singularity bass drone, dynamic engine thruster
// hum, twin plasma autocannons, phase laser beam, seeker missile launch,
// shield harmonic impact, hull hit crunch, multi-layered explosion, overheat
// warning, and Alcubierre warp spool/boom.
// ---------------------------------------------------------------------------
Game.Audio = (function () {
  let ctx = null;
  let muted = false;
  let master = null;
  let engOsc = null, engGain = null;
  let bhOsc = null, bhGain = null;
  let noiseBuf = null;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.38;
      master.connect(ctx.destination);

      // White noise buffer for explosions & thrusters
      const sr = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, sr * 1.5, sr);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      // Continuous engine hum
      engOsc = ctx.createOscillator();
      engOsc.type = 'sawtooth';
      engOsc.frequency.value = 58;
      const engFilter = ctx.createBiquadFilter();
      engFilter.type = 'lowpass';
      engFilter.frequency.value = 180;
      engGain = ctx.createGain();
      engGain.gain.value = 0.04;
      engOsc.connect(engFilter);
      engFilter.connect(engGain);
      engGain.connect(master);
      engOsc.start();

      // Relativistic black hole singularity sub-drone
      bhOsc = ctx.createOscillator();
      bhOsc.type = 'sine';
      bhOsc.frequency.value = 38;
      bhGain = ctx.createGain();
      bhGain.gain.value = 0.08;
      bhOsc.connect(bhGain);
      bhGain.connect(master);
      bhOsc.start();
    } catch (e) {}
  }

  function setMuted(m) {
    muted = !!m;
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.38, ctx.currentTime, 0.04);
  }
  function isMuted() { return muted; }

  function updateEngine(thrustMag, speedMps, rcRs) {
    if (!ctx || !engOsc || muted) return;
    const t = ctx.currentTime;
    const f = 54 + Math.abs(thrustMag) * 65 + Math.min(1, speedMps / 700) * 48;
    engOsc.frequency.setTargetAtTime(f, t, 0.08);
    engGain.gain.setTargetAtTime(0.03 + Math.abs(thrustMag) * 0.09, t, 0.08);
    if (bhOsc && rcRs) {
      const proximity = Math.min(1, 45 / Math.max(10, rcRs));
      bhOsc.frequency.setTargetAtTime(34 + proximity * 18, t, 0.15);
      bhGain.gain.setTargetAtTime(0.05 + proximity * 0.11, t, 0.15);
    }
  }

  function playLaser(isPlayer) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = isPlayer ? 'sawtooth' : 'square';
    o.frequency.setValueAtTime(isPlayer ? 760 : 480, t);
    o.frequency.exponentialRampToValueAtTime(isPlayer ? 160 : 120, t + 0.09);
    g.gain.setValueAtTime(isPlayer ? 0.16 : 0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.1);
  }

  function playBeam() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(1320, t);
    o.frequency.exponentialRampToValueAtTime(280, t + 0.32);
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.35);
  }

  function playMissile() {
    if (!ctx || !noiseBuf || muted) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const flt = ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(900, t);
    flt.frequency.exponentialRampToValueAtTime(320, t + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.24, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.46);
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t); src.stop(t + 0.48);
  }

  function playHit(isShield, isPlayer) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = isShield ? 'triangle' : 'sawtooth';
    o.frequency.setValueAtTime(isShield ? 540 : 190, t);
    o.frequency.exponentialRampToValueAtTime(isShield ? 210 : 55, t + 0.12);
    g.gain.setValueAtTime(isPlayer ? 0.25 : 0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.14);
  }

  function playExplosion(scale = 1) {
    if (!ctx || !noiseBuf || muted) return;
    const t = ctx.currentTime;
    const dur = Math.min(1.4, 0.55 * scale);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(520, t);
    flt.frequency.exponentialRampToValueAtTime(65, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.45, 0.28 * scale), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  function playWarpCharge() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 1.5);
    g.gain.setValueAtTime(0.02, t);
    g.gain.linearRampToValueAtTime(0.25, t + 1.2);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 1.65);
  }

  function playOverheat() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(880, t + i * 0.12);
      g.gain.setValueAtTime(0.14, t + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.09);
      o.connect(g); g.connect(master);
      o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.1);
    }
  }

  return {
    unlock, setMuted, isMuted, updateEngine,
    playLaser, playBeam, playMissile, playHit, playExplosion, playWarpCharge, playOverheat
  };
})();

// ---------------------------------------------------------------------------
// SECTION: HUD, RADIAL CONTROLLER OVERLAY & TABBED HAMBURGER COMMAND DRAWER --
// Zero-bloat in-flight vector HUD: curved Shield/Hull bezel arcs integrated
// into the top-center 3D radar disc, clean military vector target brackets,
// predictive diamond lead pip, and a 7-tab Hamburger Command Drawer housing
// all secondary controls, toggles, telemetry, system map, and visor shop.
// ---------------------------------------------------------------------------
Game.HUD = (function () {
  const V = Game.Vec3, Q = Game.Quat, K = Game.Constants;
  const FILTER_NAMES = ['RAW GLARE', 'ND-8 FILM', 'SPECTRAL', 'CORONAGRAPH'];

  function create(ctxApi) {
    const overlay = document.getElementById('overlayCanvas');
    const octx = overlay ? overlay.getContext('2d') : null;
    const radar = document.getElementById('radarCanvas');
    const rctx = radar ? radar.getContext('2d') : null;

    const elShieldFill = document.getElementById('shieldFill');
    const elHullFill = document.getElementById('hullFill');
    const elHeatFill = document.getElementById('heatFill');
    const elShieldTxt = document.getElementById('shieldTxt');
    const elHullTxt = document.getElementById('hullTxt');
    const elHeatTxt = document.getElementById('heatTxt');
    const elWaveBanner = document.getElementById('waveBanner');
    const elSectorText = document.getElementById('sectorText');
    const elSectorDot = document.getElementById('sectorDot');
    const elNavTarget = document.getElementById('navTargetLabel');
    const elRadarRange = document.getElementById('radarRangeTag');
    const elAlert = document.getElementById('alertBanner');
    const elVignette = document.getElementById('damageVignette');
    const elMslCnt = document.getElementById('mslCnt');
    const elFlareCnt = document.getElementById('flareCnt');
    const elLaserState = document.getElementById('laserState');
    const elHoldBtn = document.getElementById('holdBtn');
    const elLockBtn = document.getElementById('lockBtn');
    const elFilterBtn = document.getElementById('filterBtn');
    const elMuteBtn = document.getElementById('muteBtn');
    const elModalContent = document.getElementById('modalContent');

    // Side drawer elements (housed inside Hamburger Menu)
    const elSideCredits = document.getElementById('sideCredits');
    const elSideLockBtn = document.getElementById('sideLockBtn');
    const elSideAutoFireBtn = document.getElementById('autoFireBtn');
    const elSideFilterBtn = document.getElementById('sideFilterBtn');
    const elSideGravBtn = document.getElementById('sideGravBtn');
    const elSideHoldBtn = document.getElementById('sideHoldBtn');

    const radarRanges = [1500, 4500, 18000];
    let radarIdx = 0;
    let currentTab = 'shop';
    let alertTimer = 0;

    function showAlert(msg, isWarn, duration = 2.2) {
      if (!elAlert) return;
      elAlert.textContent = msg;
      elAlert.className = isWarn ? 'show warn' : 'show';
      alertTimer = duration;
    }

    function resizeOverlay() {
      if (!overlay) return;
      const w = window.innerWidth || 915, h = window.innerHeight || 412;
      if (overlay.width !== w || overlay.height !== h) {
        overlay.width = w;
        overlay.height = h;
      }
    }
    window.addEventListener('resize', resizeOverlay);
    resizeOverlay();

    function projectPoint(pt, cam, fov, aspect, w, h) {
      const dx = pt.x - cam.position.x, dy = pt.y - cam.position.y, dz = pt.z - cam.position.z;
      let fx = cam.lookAt.x - cam.position.x, fy = cam.lookAt.y - cam.position.y, fz = cam.lookAt.z - cam.position.z;
      let fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
      let rx = cam.up.y * fz - cam.up.z * fy, ry = cam.up.z * fx - cam.up.x * fz, rz = cam.up.x * fy - cam.up.y * fx;
      let rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
      const ux = fy * rz - fz * ry, uy = fz * rx - fx * rz, uz = fx * ry - fy * rx;

      const cz = dx * fx + dy * fy + dz * fz;
      const cx = dx * rx + dy * ry + dz * rz;
      const cy = dx * ux + dy * uy + dz * uz;
      const tanH = Math.tan(fov * 0.5);
      if (cz <= 0.2) {
        return { x: w * 0.5 + (cx / Math.max(1, Math.abs(cz))) * w, y: h * 0.5 - (cy / Math.max(1, Math.abs(cz))) * h, behind: true, cz, cx, cy };
      }
      const ndcX = cx / (cz * tanH * aspect);
      const ndcY = cy / (cz * tanH);
      return {
        x: (ndcX * 0.5 + 0.5) * w,
        y: (0.5 - ndcY * 0.5) * h,
        behind: false,
        cz, cx, cy
      };
    }

    function drawRadar(ship, combat, celestial) {
      if (!rctx || !radar) return;
      const w = radar.width, h = radar.height, cx = w * 0.5, cy = h * 0.5, R = w * 0.39;
      rctx.clearRect(0, 0, w, h);

      // Outer Bezel Curved Shield (left arc) & Hull (right arc) Gauges
      const shFrac = Math.max(0, Math.min(1, ship.shield / Math.max(1, ship.shieldMax)));
      const hlFrac = Math.max(0, Math.min(1, ship.hull / Math.max(1, ship.hullMax)));
      const Rbezel = w * 0.46;

      // Track background arcs
      rctx.lineWidth = 3.5;
      rctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      rctx.beginPath(); rctx.arc(cx, cy, Rbezel, Math.PI * 0.62, Math.PI * 1.38); rctx.stroke();
      rctx.beginPath(); rctx.arc(cx, cy, Rbezel, -Math.PI * 0.38, Math.PI * 0.38); rctx.stroke();

      // Active Shield Arc (Cyan, left side)
      if (shFrac > 0.01) {
        rctx.strokeStyle = '#00f0ff';
        rctx.beginPath();
        rctx.arc(cx, cy, Rbezel, Math.PI * 1.38 - (Math.PI * 0.76) * shFrac, Math.PI * 1.38);
        rctx.stroke();
      }
      // Active Hull Arc (Green/Amber/Red, right side)
      if (hlFrac > 0.01) {
        rctx.strokeStyle = hlFrac > 0.5 ? '#38ef7d' : hlFrac > 0.25 ? '#ffb700' : '#ff3b5c';
        rctx.beginPath();
        rctx.arc(cx, cy, Rbezel, -Math.PI * 0.38, -Math.PI * 0.38 + (Math.PI * 0.76) * hlFrac);
        rctx.stroke();
      }

      // Inner Radar Grid
      rctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
      rctx.lineWidth = 1;
      for (const frac of [0.45, 1.0]) {
        rctx.beginPath();
        rctx.arc(cx, cy, R * frac, 0, Math.PI * 2);
        rctx.stroke();
      }
      rctx.beginPath();
      rctx.moveTo(cx - R, cy); rctx.lineTo(cx + R, cy);
      rctx.moveTo(cx, cy - R); rctx.lineTo(cx, cy + R);
      rctx.stroke();

      // Forward FOV cone
      rctx.strokeStyle = 'rgba(0, 240, 255, 0.32)';
      rctx.beginPath();
      rctx.moveTo(cx - R * 0.45, cy - R * 0.85);
      rctx.lineTo(cx, cy);
      rctx.lineTo(cx + R * 0.45, cy - R * 0.85);
      rctx.stroke();

      const maxRange = radarRanges[radarIdx];
      const qc = { x: 0, y: 0, z: 0, w: 1 };
      Q.qConjugate(qc, ship.orientation);
      const rel = V.v3(), loc = V.v3();

      function plotBlip(worldPos, color, size, isTarget) {
        V.sub(rel, worldPos, ship.positionMeters);
        Q.qRotateVector(loc, qc, rel);
        const nx = Math.max(-1, Math.min(1, loc.x / maxRange));
        const nz = Math.max(-1, Math.min(1, loc.z / maxRange));
        const ny = Math.max(-1, Math.min(1, loc.y / (maxRange * 0.5)));
        const rLen = Math.hypot(nx, nz);
        const scale = rLen > 1 ? 1 / rLen : 1;
        const bx = cx + nx * scale * R;
        const by = cy - nz * scale * R;
        const stemY = by - ny * 10;

        rctx.strokeStyle = color;
        rctx.lineWidth = 1;
        rctx.beginPath();
        rctx.moveTo(bx, by);
        rctx.lineTo(bx, stemY);
        rctx.stroke();

        rctx.fillStyle = color;
        rctx.beginPath();
        rctx.arc(bx, stemY, size, 0, Math.PI * 2);
        rctx.fill();
        if (isTarget) {
          rctx.strokeStyle = '#ffffff';
          rctx.strokeRect(bx - size - 1.5, stemY - size - 1.5, (size + 1.5) * 2, (size + 1.5) * 2);
        }
      }

      if (celestial && celestial.dockStation) {
        plotBlip(celestial.dockStation.root.position, '#00f0ff', 3.0, false);
      }
      if (celestial && celestial.gravityBodies) {
        for (const gb of celestial.gravityBodies) {
          plotBlip(gb.pos, '#38ef7d', 3.5, false);
        }
      }

      for (const e of combat.S.enemies) {
        if (!e.alive) continue;
        const col = e.kind === 'carrier' ? '#b56bff' : e.kind === 'corvette' ? '#ff9900' : e.kind === 'gunship' ? '#ff7733' : '#ff3b5c';
        const sz = e.kind === 'carrier' ? 4.2 : e.kind === 'gunship' || e.kind === 'corvette' ? 3.2 : 2.4;
        plotBlip(e.positionMeters, col, sz, e === combat.S.target);
      }

      for (const m of combat.M) {
        if (m.active) plotBlip(m.pos, '#ffb700', 1.8, false);
      }
    }

    function drawOverlay(ship, cam, fov, aspect, combat, celestial, warpState) {
      if (!octx || !overlay) return;
      resizeOverlay();
      const w = overlay.width, h = overlay.height, cx = w * 0.5, cy = h * 0.5;
      octx.clearRect(0, 0, w, h);

      // 1. Minimal Precision Center Reticle & Subtle Gimbal Ring
      const fwd = V.v3();
      Q.qRotateVector(fwd, ship.orientation, { x: 0, y: 0, z: 1 });
      const aimPt = {
        x: ship.positionMeters.x + fwd.x * 400,
        y: ship.positionMeters.y + fwd.y * 400,
        z: ship.positionMeters.z + fwd.z * 400
      };
      const aimScr = projectPoint(aimPt, cam, fov, aspect, w, h);
      const rx = aimScr.behind ? cx : aimScr.x;
      const ry = aimScr.behind ? cy : aimScr.y;

      if (combat.S.settings.autoLock) {
        const gimbalPx = combat.S.upgrades.gimbalMk2 ? 72 : 52;
        octx.strokeStyle = 'rgba(0, 240, 255, 0.14)';
        octx.lineWidth = 1;
        octx.setLineDash([3, 6]);
        octx.beginPath();
        octx.arc(rx, ry, gimbalPx, 0, Math.PI * 2);
        octx.stroke();
        octx.setLineDash([]);
      }

      // Crisp 4-tick military gun crosshair
      octx.strokeStyle = combat.S.overheated ? 'rgba(255, 59, 92, 0.85)' : 'rgba(0, 240, 255, 0.68)';
      octx.lineWidth = 1.3;
      octx.beginPath();
      octx.arc(rx, ry, 11, 0, Math.PI * 2);
      octx.moveTo(rx - 16, ry); octx.lineTo(rx - 11, ry);
      octx.moveTo(rx + 11, ry); octx.lineTo(rx + 16, ry);
      octx.moveTo(rx, ry - 16); octx.lineTo(rx, ry - 11);
      octx.moveTo(rx, ry + 11); octx.lineTo(rx, ry + 16);
      octx.stroke();

      if (combat.S.heat > 0.02) {
        octx.strokeStyle = combat.S.overheated ? '#ff3b5c' : '#ffb700';
        octx.lineWidth = 2.0;
        octx.beginPath();
        octx.arc(rx, ry, 15, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * combat.S.heat);
        octx.stroke();
      }

      // 2. Prograde Velocity Vector Pip (minimal circle + 3 fins, no text)
      const spd = V.length(ship.velocityMps);
      if (spd > 12) {
        const vPt = {
          x: ship.positionMeters.x + (ship.velocityMps.x / spd) * 400,
          y: ship.positionMeters.y + (ship.velocityMps.y / spd) * 400,
          z: ship.positionMeters.z + (ship.velocityMps.z / spd) * 400
        };
        const vScr = projectPoint(vPt, cam, fov, aspect, w, h);
        if (!vScr.behind && vScr.x > 20 && vScr.x < w - 20 && vScr.y > 20 && vScr.y < h - 20) {
          octx.strokeStyle = 'rgba(56, 239, 125, 0.55)';
          octx.lineWidth = 1.2;
          octx.beginPath();
          octx.arc(vScr.x, vScr.y, 4.5, 0, Math.PI * 2);
          octx.moveTo(vScr.x - 8, vScr.y); octx.lineTo(vScr.x - 4.5, vScr.y);
          octx.moveTo(vScr.x + 4.5, vScr.y); octx.lineTo(vScr.x + 8, vScr.y);
          octx.moveTo(vScr.x, vScr.y - 8); octx.lineTo(vScr.x, vScr.y - 4.5);
          octx.stroke();
        }
      }

      // 3. Station Diamond Marker (minimal icon, text only when docking within 300m)
      if (celestial && celestial.dockStation) {
        const st = celestial.dockStation;
        const sp = st.root.position;
        const dist = Math.hypot(sp.x - ship.positionMeters.x, sp.y - ship.positionMeters.y, sp.z - ship.positionMeters.z);
        const scr = projectPoint(sp, cam, fov, aspect, w, h);
        if (!scr.behind && scr.x > 0 && scr.x < w && scr.y > 0 && scr.y < h) {
          octx.strokeStyle = st.isFriendly ? 'rgba(0, 240, 255, 0.55)' : 'rgba(255, 170, 0, 0.65)';
          octx.lineWidth = 1.2;
          octx.beginPath();
          octx.moveTo(scr.x, scr.y - 8);
          octx.lineTo(scr.x + 8, scr.y);
          octx.lineTo(scr.x, scr.y + 8);
          octx.lineTo(scr.x - 8, scr.y);
          octx.closePath();
          octx.stroke();
          if (st.isFriendly && dist < 240) {
            octx.fillStyle = '#38ef7d';
            octx.font = '600 8.5px ui-monospace, monospace';
            octx.textAlign = 'center';
            octx.fillText('DOCK REPAIR ACTIVE', scr.x, scr.y + 18);
          }
        }
      }

      // 4. Clean Military Vector Enemy Brackets & Primary Diamond Lead Pip (No text bloat!)
      const leadVec = V.v3();
      for (const e of combat.S.enemies) {
        if (!e.alive) continue;
        const dist = V.length(V.sub(V.v3(), e.positionMeters, ship.positionMeters));
        const scr = projectPoint(e.positionMeters, cam, fov, aspect, w, h);
        const isPrimary = (e === combat.S.target);
        const margin = 36;
        const onScreen = !scr.behind && scr.x >= margin && scr.x <= w - margin && scr.y >= margin && scr.y <= h - margin;

        if (onScreen) {
          const bSize = e.kind === 'carrier' ? 24 : isPrimary ? 16 : 11;
          const col = e.kind === 'carrier' ? '#b56bff' : isPrimary ? '#ff3b5c' : 'rgba(255, 95, 115, 0.62)';
          octx.strokeStyle = col;
          octx.lineWidth = isPrimary ? 1.8 : 1.2;

          const x0 = scr.x - bSize, y0 = scr.y - bSize, x1 = scr.x + bSize, y1 = scr.y + bSize, c = 4.5;
          octx.beginPath();
          octx.moveTo(x0, y0 + c); octx.lineTo(x0, y0); octx.lineTo(x0 + c, y0);
          octx.moveTo(x1 - c, y0); octx.lineTo(x1, y0); octx.lineTo(x1, y0 + c);
          octx.moveTo(x0, y1 - c); octx.lineTo(x0, y1); octx.lineTo(x0 + c, y1);
          octx.moveTo(x1 - c, y1); octx.lineTo(x1, y1); octx.lineTo(x1, y1 - c);
          octx.stroke();

          // Ultra-thin 2px micro-bars above bracket
          const bw = bSize * 2;
          const shFrac = Math.max(0, e.shield / Math.max(1, e.shieldMax));
          const hlFrac = Math.max(0, e.hull / Math.max(1, e.hullMax));
          octx.fillStyle = 'rgba(0,0,0,0.6)';
          octx.fillRect(x0, y0 - 6, bw, 4);
          octx.fillStyle = '#00f0ff';
          octx.fillRect(x0, y0 - 6, bw * shFrac, 1.8);
          octx.fillStyle = '#ff3b5c';
          octx.fillRect(x0, y0 - 4, bw * hlFrac, 1.8);

          if (isPrimary) {
            // Compact distance tag only on primary target
            octx.fillStyle = 'rgba(255, 210, 220, 0.88)';
            octx.font = '600 8.5px ui-monospace, monospace';
            octx.textAlign = 'center';
            octx.fillText((dist / 1000).toFixed(2) + 'km', scr.x, y1 + 10);

            combat.leadDir(leadVec, ship, e, Game.Combat.PLAYER_GUN.boltSpeed);
            const leadWorld = {
              x: ship.positionMeters.x + leadVec.x * dist,
              y: ship.positionMeters.y + leadVec.y * dist,
              z: ship.positionMeters.z + leadVec.z * dist
            };
            const lScr = projectPoint(leadWorld, cam, fov, aspect, w, h);
            if (!lScr.behind) {
              const alignDist = Math.hypot(lScr.x - rx, lScr.y - ry);
              const lockRadius = combat.S.settings.autoLock ? (combat.S.upgrades.gimbalMk2 ? 78 : 56) : 36;
              const inCone = alignDist < lockRadius && dist < 1150;
              octx.strokeStyle = inCone ? '#38ef7d' : '#ffb700';
              octx.lineWidth = 1.4;
              octx.setLineDash([2, 3]);
              octx.beginPath();
              octx.moveTo(scr.x, scr.y);
              octx.lineTo(lScr.x, lScr.y);
              octx.stroke();
              octx.setLineDash([]);

              // Crisp Diamond Lead Pip
              const dSz = 6;
              octx.beginPath();
              octx.moveTo(lScr.x, lScr.y - dSz);
              octx.lineTo(lScr.x + dSz, lScr.y);
              octx.lineTo(lScr.x, lScr.y + dSz);
              octx.lineTo(lScr.x - dSz, lScr.y);
              octx.closePath();
              octx.stroke();
              if (inCone) {
                octx.fillStyle = '#38ef7d';
                octx.beginPath();
                octx.arc(lScr.x, lScr.y, 2.2, 0, Math.PI * 2);
                octx.fill();
              }
            }
          }
        } else {
          const ang = Math.atan2(-scr.cy, scr.cx);
          const ringR = Math.min(w, h) * 0.34;
          const ax = cx + Math.cos(ang) * ringR;
          const ay = cy + Math.sin(ang) * ringR;
          octx.save();
          octx.translate(ax, ay);
          octx.rotate(ang);
          octx.fillStyle = isPrimary ? '#ff3b5c' : 'rgba(255, 95, 115, 0.55)';
          octx.beginPath();
          octx.moveTo(7, 0);
          octx.lineTo(-5, -4.5);
          octx.lineTo(-2.5, 0);
          octx.lineTo(-5, 4.5);
          octx.closePath();
          octx.fill();
          octx.restore();
        }
      }

      if (warpState && warpState.active) {
        octx.fillStyle = 'rgba(0, 240, 255, 0.92)';
        octx.font = '700 11px ui-monospace, monospace';
        octx.textAlign = 'center';
        const phaseTxt = warpState.phase === 'charge'
          ? '⚡ WARP SPOOLING'
          : '🌌 FTL → ' + warpState.targetSector.name.toUpperCase() + ' (' + warpState.liveRs.toFixed(1) + ' Rs)';
        octx.fillText(phaseTxt, cx, cy - 72);
      }
    }

    function renderModalContent() {
      if (!elModalContent || !document.body.classList.contains('menuOpen')) return;
      const api = ctxApi();
      if (!api) return;
      const { ship, arena, combat, state, sky, D } = api;
      const sec = Game.Sectors.byId(arena.id);
      const absPos = {
        x: api.frame.anchorPositionMeters.x + ship.positionMeters.x,
        y: api.frame.anchorPositionMeters.y + ship.positionMeters.y,
        z: api.frame.anchorPositionMeters.z + ship.positionMeters.z
      };
      const rMeters = V.length(absPos);
      const rRs = rMeters / K.BH_RS;
      const tidal = Game.Gravity.tidalAccelerationDelta(rMeters, 42);
      const orbVel = K.circularOrbitalVelocity(rMeters) / 1000;
      const fMode = sky.getFilterMode();

      if (currentTab === 'shop') {
        const U = combat.S.upgrades;
        elModalContent.innerHTML = `
          <div class="card">
            <h3>🕶️ Accretion Optical Visor Filters · Balance: <span style="color:var(--amber);">${combat.S.credits} CR</span></h3>
            <div class="kv-row">
              <span>01 · ND-8 Gargantua Polarizer (Crisp Dust Lanes)</span>
              <button class="btn-action" data-f="1" style="margin:2px 0;">${fMode === 1 ? '✓ EQUIPPED' : 'EQUIP'}</button>
            </div>
            <div class="kv-row">
              <span>02 · Raw Unfiltered Glare (Blinding Starlight)</span>
              <button class="btn-action" data-f="0" style="margin:2px 0;">${fMode === 0 ? '✓ EQUIPPED' : 'EQUIP'}</button>
            </div>
            <div class="kv-row">
              <span>03 · Spectral Doppler X-Ray Filter ${U.spectralFilter ? '' : '(250 CR)'}</span>
              <button class="btn-action" data-f="2" style="margin:2px 0;">${fMode === 2 ? '✓ EQUIPPED' : (U.spectralFilter ? 'EQUIP' : 'BUY 250 CR')}</button>
            </div>
            <div class="kv-row">
              <span>04 · Eclipse Coronagraph Ring Isolator ${U.coronagraphFilter ? '' : '(400 CR)'}</span>
              <button class="btn-action" data-f="3" style="margin:2px 0;">${fMode === 3 ? '✓ EQUIPPED' : (U.coronagraphFilter ? 'EQUIP' : 'BUY 400 CR')}</button>
            </div>
          </div>
          <div class="card">
            <h3>⚡ Vanguard Ship Upgrades &amp; Target Lock Bay</h3>
            <div class="kv-row">
              <span>Smart Gimbal Auto-Lock (${U.gimbalMk2 ? '28° Mk.II' : '19° Mk.I'})</span>
              <button class="btn-action" id="shopToggleLock" style="margin:2px 0;">${combat.S.settings.autoLock ? 'LOCK: ON' : 'LOCK: OFF'}</button>
            </div>
            <div class="kv-row">
              <span>Upgrade: Gimbal Lock Mk.II (28° Wide Cone)</span>
              <button class="btn-action" id="buyGimbal" style="margin:2px 0;">${U.gimbalMk2 ? '✓ INSTALLED' : 'BUY 300 CR'}</button>
            </div>
            <div class="kv-row">
              <span>Upgrade: Cryo-Plasma Cooling (-35% Heat)</span>
              <button class="btn-action" id="buyCooler" style="margin:2px 0;">${U.cryoCooler ? '✓ INSTALLED' : 'BUY 350 CR'}</button>
            </div>
            <div class="kv-row">
              <span>Upgrade: Ceramic-Hex Heavy Armor (200 Hull / 220 Shld)</span>
              <button class="btn-action" id="buyArmor" style="margin:2px 0;">${U.heavyArmor ? '✓ INSTALLED' : 'BUY 400 CR'}</button>
            </div>
            <div style="margin-top:6px;">
              <button class="btn-action" id="btnRearm">🔧 FULL REPAIR &amp; REARM</button>
            </div>
          </div>
        `;
        elModalContent.querySelectorAll('[data-f]').forEach(btn => {
          btn.onclick = () => {
            const idx = +btn.getAttribute('data-f');
            if (idx === 2 && !U.spectralFilter) {
              if (combat.S.credits < 250) { showAlert('NEED 250 CR FOR SPECTRAL FILTER', true, 2.0); return; }
              combat.S.credits -= 250; U.spectralFilter = true;
            }
            if (idx === 3 && !U.coronagraphFilter) {
              if (combat.S.credits < 400) { showAlert('NEED 400 CR FOR CORONAGRAPH FILTER', true, 2.0); return; }
              combat.S.credits -= 400; U.coronagraphFilter = true;
            }
            sky.setFilterMode(idx);
            showAlert('VISOR FILTER: ' + FILTER_NAMES[idx], false, 2.0);
            renderModalContent();
          };
        });
        document.getElementById('shopToggleLock').onclick = () => { api.toggleAutoLock(); renderModalContent(); };
        document.getElementById('buyGimbal').onclick = () => {
          if (U.gimbalMk2) return;
          if (combat.S.credits < 300) { showAlert('NEED 300 CR FOR GIMBAL MK.II', true, 2.0); return; }
          combat.S.credits -= 300; U.gimbalMk2 = true;
          showAlert('INSTALLED SMART GIMBAL MK.II (28° CONE)', false, 2.2);
          renderModalContent();
        };
        document.getElementById('buyCooler').onclick = () => {
          if (U.cryoCooler) return;
          if (combat.S.credits < 350) { showAlert('NEED 350 CR FOR CRYO COOLER', true, 2.0); return; }
          combat.S.credits -= 350; U.cryoCooler = true;
          showAlert('INSTALLED CRYO-PLASMA COOLING LOOP', false, 2.2);
          renderModalContent();
        };
        document.getElementById('buyArmor').onclick = () => {
          if (U.heavyArmor) return;
          if (combat.S.credits < 400) { showAlert('NEED 400 CR FOR HEAVY ARMOR', true, 2.0); return; }
          combat.S.credits -= 400; U.heavyArmor = true;
          ship.hullMax = 200; ship.hull = 200; ship.shieldMax = 220; ship.shield = 220;
          showAlert('INSTALLED CERAMIC-HEX HEAVY ARMOR', false, 2.2);
          renderModalContent();
        };
        document.getElementById('btnRearm').onclick = () => {
          ship.hull = ship.hullMax; ship.shield = ship.shieldMax;
          combat.S.missileAmmo = Game.Combat.PLAYER_MISSILE.maxAmmo;
          combat.S.flares = 6; combat.S.heat = 0; combat.S.overheated = false;
          renderModalContent();
          showAlert('SHIP SYSTEMS REPAIRED & REARMED', false, 2.0);
        };
      } else if (currentTab === 'weapons') {
        elModalContent.innerHTML = `
          <div class="card">
            <h3>⚔️ Strike Armament &amp; Ordnance</h3>
            <div class="kv-row"><span>Primary Twin Plasma Cannons</span><span>1,400 m/s · 420 RPM · 14 DMG</span></div>
            <div class="kv-row"><span>High-Energy Phase Laser</span><span>1,450 m Instant Beam · 44 MJ</span></div>
            <div class="kv-row"><span>APN Homing Seeker Missiles</span><span>${combat.S.missileAmmo} / ${Game.Combat.PLAYER_MISSILE.maxAmmo} Loaded (72 DMG)</span></div>
            <div class="kv-row"><span>IR/EM Countermeasure Flares</span><span>${combat.S.flares} / 6 Ready</span></div>
            <div style="margin-top:6px;">
              <button class="btn-action" id="btnRearmWep">🔧 RELOAD ORDNANCE &amp; COOL WEAPONS</button>
            </div>
          </div>
        `;
        document.getElementById('btnRearmWep').onclick = () => {
          ship.hull = ship.hullMax; ship.shield = ship.shieldMax;
          combat.S.missileAmmo = Game.Combat.PLAYER_MISSILE.maxAmmo;
          combat.S.flares = 6; combat.S.heat = 0; combat.S.overheated = false;
          renderModalContent();
          showAlert('ORDNANCE RELOADED', false, 1.8);
        };
      } else if (currentTab === 'telemetry') {
        const shPct = Math.round((ship.shield / Math.max(1, ship.shieldMax)) * 100);
        const hlPct = Math.round((ship.hull / Math.max(1, ship.hullMax)) * 100);
        elModalContent.innerHTML = `
          <div class="card">
            <h3>Defensive Shields &amp; Ceramic-Hex Armor</h3>
            <div class="kv-row"><span>Fore / Aft Shield Sectors</span><span>${combat.S.shieldSectors.fore}% / ${combat.S.shieldSectors.aft}%</span></div>
            <div class="kv-row"><span>Port / Starboard Sectors</span><span>${shPct}%</span></div>
            <div class="kv-row"><span>Weathered Ceramic Armor</span><span>${hlPct}% (${ship.hull.toFixed(0)}/${ship.hullMax})</span></div>
            <div class="kv-row"><span>Active Visor Filter</span><span style="color:var(--amber);">${FILTER_NAMES[fMode]}</span></div>
          </div>
          <div class="card">
            <h3>Astrodynamics &amp; Relativistic Telemetry</h3>
            <div class="kv-row"><span>Current Sector</span><span style="color:${sec.color};">${sec.name}</span></div>
            <div class="kv-row"><span>Singularity Distance</span><span>${rRs.toFixed(2)} Rs (${(rMeters / 1e9).toFixed(2)}M km)</span></div>
            <div class="kv-row"><span>Keplerian Frame Velocity</span><span>${orbVel.toFixed(1)} km/s (${(orbVel / 299792.458).toFixed(4)} c)</span></div>
            <div class="kv-row"><span>Tidal Gravity Shear (42m)</span><span>${tidal.toExponential(2)} m/s²</span></div>
            <div class="kv-row"><span>Floating-Origin Shift</span><span>${(V.length(D) / 1000).toFixed(1)} km</span></div>
          </div>
        `;
      } else if (currentTab === 'map') {
        const LIST = Game.Sectors.LIST;
        const mnR = Math.min.apply(null, LIST.map(s => s.radiusRs)), mxR = Math.max.apply(null, LIST.map(s => s.radiusRs));
        const rr = (s) => 24 + 116 * Math.log(s.radiusRs / mnR) / Math.log(mxR / mnR);
        const selSec = LIST[state.selectedSectorIdx];
        const selIsHere = selSec.id === arena.id;
        let rings = '', dots = '';
        LIST.forEach((s, i) => {
          const r = rr(s), ang = i * 2.399963, x = (150 + r * Math.cos(ang)).toFixed(1), y = (150 + r * Math.sin(ang)).toFixed(1);
          const isSel = i === state.selectedSectorIdx, isCur = s.id === arena.id;
          rings += '<circle cx="150" cy="150" r="' + r.toFixed(1) + '" fill="none" stroke="' + (isSel ? '#E8A857' : '#2A3342') + '"/>';
          dots += '<g data-sec-idx="' + i + '" style="cursor:pointer"><circle cx="' + x + '" cy="' + y + '" r="18" fill="transparent"/>' +
            '<circle cx="' + x + '" cy="' + y + '" r="' + (isSel ? 7 : 5) + '" fill="' + (isCur ? '#9FB3C8' : (isSel ? '#E8A857' : '#F4DDB0')) + '"/>' +
            ((isSel || isCur) ? '<circle cx="' + x + '" cy="' + y + '" r="11" fill="none" stroke="' + (isCur ? '#9FB3C8' : '#E8A857') + '" stroke-width="1.5"/>' : '') +
            '<text x="' + (+x + 10) + '" y="' + (+y - 8) + '" font-size="10" fill="' + (isSel ? '#F4DDB0' : '#9FB3C8') + '">' + s.name + '</text></g>';
        });
        elModalContent.innerHTML =
          '<div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">' +
          '<svg viewBox="0 0 300 300" width="250" height="250" style="overflow:visible;flex:none">' + rings +
          '<circle cx="150" cy="150" r="9" fill="#000" stroke="#F4DDB0" stroke-width="2"/>' + dots + '</svg>' +
          '<div class="card" style="flex:1;min-width:210px">' +
          '<h3 style="color:' + selSec.color + ';font-size:20px;margin:0 0 4px">' + selSec.name + '</h3>' +
          '<div style="font-size:12px;color:#b8d4f0;margin-bottom:10px">' + selSec.subtitle + '</div>' +
          '<div class="mono" style="font-size:12px;line-height:1.9">Distance: ' + selSec.radiusRs + ' Rs<br>Threat: ' + selSec.threat + '<br>You are at: ' + (LIST.find(s => s.id === arena.id) || selSec).name + '</div>' +
          '<button class="btn-action" id="modalWarpBtn" style="width:100%;height:48px;font-size:14px;margin:12px 0 0"' + (selIsHere ? ' disabled' : '') + '>' + (selIsHere ? 'You are here' : 'Warp to ' + selSec.name) + '</button>' +
          '</div></div>';
        elModalContent.querySelectorAll('[data-sec-idx]').forEach(el => {
          el.addEventListener('click', () => {
            state.selectedSectorIdx = +el.getAttribute('data-sec-idx');
            updateNavLabel(state);
            renderModalContent();
          });
        });
        const mw = document.getElementById('modalWarpBtn');
        if (mw && !selIsHere) mw.addEventListener('click', () => {
          closeModal();
          api.triggerWarp(Game.Sectors.LIST[state.selectedSectorIdx].id);
        });
      } else if (currentTab === 'missions') {
        elModalContent.innerHTML = `
          <div class="card">
            <h3>Tactical Directives · ${sec.name}</h3>
            <p style="font-size:10px; color:#c8e2ff; line-height:1.4; margin:0 0 6px 0;">${sec.description}</p>
            <div class="kv-row"><span>Sector Faction</span><span>${sec.faction}</span></div>
            <div class="kv-row"><span>Wave Progress</span><span>Wave ${combat.S.wave} / ${combat.S.maxWaves} (${combat.S.mode.toUpperCase()})</span></div>
            <div class="kv-row"><span>Active Hostiles</span><span>${combat.S.enemies.length} Contacts</span></div>
            <div style="margin-top:6px;">
              <button class="btn-action" id="btnNextWave">► DEPLOY NEXT WAVE</button>
              <button class="btn-action" id="btnSpawnCarrier">👾 SPAWN DREADNOUGHT</button>
              <button class="btn-action" id="btnClearEnemies">🕊️ FREE-ROAM</button>
            </div>
          </div>
          <div class="card">
            <h3>Direct Sector Jump</h3>
            <div>
              ${Game.Sectors.LIST.map(s => `<button class="btn-action sec-jump-btn" data-sec="${s.id}">⚡ ${s.name}</button>`).join('')}
            </div>
          </div>
        `;
        const bNext = document.getElementById('btnNextWave');
        if (bNext) bNext.addEventListener('click', () => { closeModal(); combat.startWave(Math.min(combat.S.maxWaves, combat.S.wave + 1)); });
        const bCar = document.getElementById('btnSpawnCarrier');
        if (bCar) bCar.addEventListener('click', () => { closeModal(); combat.spawnEnemy('carrier'); showAlert('⚠ DREADNOUGHT CARRIER INBOUND', true, 3.0); });
        const bClr = document.getElementById('btnClearEnemies');
        if (bClr) bClr.addEventListener('click', () => {
          for (const e of combat.S.enemies.slice()) combat.applyDamage(e, 99999, combat.S.time, e.positionMeters);
          combat.S.mode = 'idle';
          closeModal();
          showAlert('FREE-ROAM EXPLORATION ACTIVE', false, 2.2);
        });
        elModalContent.querySelectorAll('.sec-jump-btn').forEach(b => {
          b.addEventListener('click', () => {
            closeModal();
            api.triggerWarp(b.getAttribute('data-sec'));
          });
        });
      } else if (currentTab === 'controls') {
        elModalContent.innerHTML = `
          <div class="card">
            <h3>Radial Game Controller (Touch &amp; Mouse)</h3>
            <div class="kv-row"><span>Left Gimbal Stick</span><span>Forward / Reverse Thrust &amp; Lateral Strafe</span></div>
            <div class="kv-row"><span>Right Gimbal Stick</span><span>Yaw &amp; Pitch Attitude</span></div>
            <div class="kv-row"><span>🔥 BOOST (Top-Left) / ⊕ FIRE (Top-Right)</span><span>Afterburner / Twin Plasma Cannons</span></div>
            <div class="kv-row"><span>🚀 / ⚡ / 🔥 / ✦ (Radial Arc)</span><span>Seeker Missile / Phase Laser / Boost / Flares</span></div>
            <div class="kv-row"><span>Top-Center Radar Disc</span><span>Tap to cycle range · Outer arcs = Shield &amp; Hull</span></div>
          </div>
          <div class="card">
            <h3>Desktop Keyboard Bindings</h3>
            <div class="kv-row"><span>W / S &amp; Arrows ←/→</span><span>Thrust &amp; Strafe</span></div>
            <div class="kv-row"><span>A / D &amp; Arrows ↑/↓ &amp; Q/E</span><span>Yaw, Pitch &amp; Roll</span></div>
            <div class="kv-row"><span>Space / F / L / M / B / C</span><span>Fire / Laser / Missile / Boost / Flare</span></div>
            <div class="kv-row"><span>G / V / H / R / Esc</span><span>Auto-Lock / Visor Filter / Hold / Warp / Menu</span></div>
          </div>
        `;
      } else if (currentTab === 'settings') {
        elModalContent.innerHTML = `
          <div class="card">
            <h3>Flight Assist, Gravity &amp; Visor Settings</h3>
            <div class="kv-row"><span>Smart Auto-Target Lock</span><span>${combat.S.settings.autoLock ? 'ENABLED' : 'DISABLED'}</span></div>
            <div class="kv-row"><span>Assisted Auto-Fire</span><span>${combat.S.settings.autoFire ? 'ENABLED' : 'DISABLED'}</span></div>
            <div class="kv-row"><span>Dynamic Multi-Body Gravity</span><span>${state.dynamicGravity ? 'REAL WELL' : 'COMPENSATED'}</span></div>
            <div class="kv-row"><span>Attitude Hold Frame</span><span>${state.holdMode.toUpperCase()}</span></div>
            <div style="margin-top:6px;">
              <button class="btn-action" id="togLockBtn">Toggle Auto-Lock</button>
              <button class="btn-action" id="togAssistBtn">Toggle Aim Assist</button>
              <button class="btn-action" id="togAutoBtn">Toggle Auto-Fire</button>
              <button class="btn-action" id="togGravBtn">Toggle Gravity</button>
              <button class="btn-action" id="togHoldBtn">Toggle Hold Mode</button>
            </div>
          </div>
          <div class="card">
            <h3>Graphics &amp; Simulation</h3>
            <div class="kv-row"><span>Active Visor Filter</span><span>${FILTER_NAMES[fMode]}</span></div>
            <div style="margin-top:6px;">
              <button class="btn-action" data-q="1.0">Quality: Ultra (1.0x)</button>
              <button class="btn-action" data-q="0.75">Quality: Balanced (0.75x)</button>
              <button class="btn-action" id="btnResetMission">↻ Restart Sector</button>
            </div>
          </div>
        `;
        document.getElementById('togLockBtn').onclick = () => { api.toggleAutoLock(); renderModalContent(); };
        document.getElementById('togAssistBtn').onclick = () => { combat.S.settings.assist = !combat.S.settings.assist; renderModalContent(); };
        document.getElementById('togAutoBtn').onclick = () => { api.toggleAutoFire(); renderModalContent(); };
        document.getElementById('togGravBtn').onclick = () => { api.toggleDynamicGravity(); renderModalContent(); };
        document.getElementById('togHoldBtn').onclick = () => { api.toggleHoldMode(); renderModalContent(); };
        document.getElementById('btnResetMission').onclick = () => { closeModal(); combat.reset(ship, sec.waves); };
        elModalContent.querySelectorAll('[data-q]').forEach(b => {
          b.onclick = () => { api.setPixelRatio(+b.getAttribute('data-q')); };
        });
      }
    }

    function drawOrrery(api) {
      const c = document.getElementById('orreryCanvas');
      if (!c) return;
      const ctx = c.getContext('2d');
      const w = c.width, h = c.height, cx = w * 0.45, cy = h * 0.52;
      ctx.clearRect(0, 0, w, h);

      const grad = ctx.createRadialGradient(cx, cy, 3, cx, cy, 26);
      grad.addColorStop(0, '#000000');
      grad.addColorStop(0.26, '#fff2cc');
      grad.addColorStop(0.55, '#ff9933');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#000';
      ctx.strokeStyle = '#ffe599';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(cx, cy, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      function rToPx(rs) {
        return 18 + (Math.log(rs / 10) / Math.log(210 / 10)) * (Math.min(w, h) * 0.39);
      }

      Game.Sectors.LIST.forEach((s, idx) => {
        const R = rToPx(s.radiusRs);
        const isCur = s.id === api.arena.id;
        const isSel = idx === api.state.selectedSectorIdx;
        ctx.strokeStyle = isCur ? 'rgba(255, 183, 0, 0.65)' : 'rgba(140, 180, 230, 0.18)';
        ctx.lineWidth = isCur ? 1.4 : 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, R * 1.55, R * 0.76, 0, 0, Math.PI * 2);
        ctx.stroke();

        const ang = s.startAnomaly + api.simTime * 0.015 * (40 / s.radiusRs);
        const px = cx + Math.cos(ang) * R * 1.55;
        const py = cy + Math.sin(ang) * R * 0.76;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(px, py, isCur || isSel ? 5.0 : 3.4, 0, Math.PI * 2);
        ctx.fill();
        if (isCur || isSel) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(px - 6.5, py - 6.5, 13, 13);
        }
        ctx.fillStyle = '#d8ecff';
        ctx.font = '600 8.5px ui-monospace, monospace';
        ctx.fillText(s.name, px + 7, py + 3);
      });
    }

    function openModal(tab) {
      if (tab) {
        currentTab = tab;
        document.querySelectorAll('#modalTabs .tab-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-tab') === currentTab);
        });
      }
      document.body.classList.add('menuOpen');
      renderModalContent();
    }

    function closeModal() {
      document.body.classList.remove('menuOpen');
      document.body.classList.remove('diagOpen');
    }

    function updateNavLabel(state) {
      const s = Game.Sectors.LIST[state.selectedSectorIdx];
      if (elNavTarget && s) {
        elNavTarget.textContent = 'DEST: ' + s.name.toUpperCase() + ' (' + s.radiusRs + ' Rs)';
      }
    }

    const menuBtn = document.getElementById('menuBtn');
    if (menuBtn) menuBtn.addEventListener('click', () => {
      if (document.body.classList.contains('menuOpen')) closeModal();
      else openModal('shop');
    });
    const sideMenuBtn = document.getElementById('sideMenuBtn');
    if (sideMenuBtn) sideMenuBtn.addEventListener('click', () => {
      document.body.classList.toggle('sideOpen');
    });
    const openShopBtn = document.getElementById('openShopBtn');
    if (openShopBtn) openShopBtn.addEventListener('click', () => {
      document.body.classList.remove('sideOpen');
      openModal('shop');
    });
    const sectorPill = document.getElementById('sectorPill');
    if (sectorPill) sectorPill.addEventListener('click', () => openModal('map'));
    const resumeBtn = document.getElementById('resumeBtn');
    if (resumeBtn) resumeBtn.addEventListener('click', closeModal);

    document.querySelectorAll('#modalTabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentTab = btn.getAttribute('data-tab');
        document.querySelectorAll('#modalTabs .tab-btn').forEach(b => b.classList.toggle('active', b === btn));
        renderModalContent();
      });
    });

    const radarWrap = document.getElementById('radarWrap');
    if (radarWrap) radarWrap.addEventListener('click', () => {
      radarIdx = (radarIdx + 1) % radarRanges.length;
      if (elRadarRange) elRadarRange.textContent = (radarRanges[radarIdx] / 1000).toFixed(1) + 'KM';
    });

    function update(dt, ship, cam, camera, engine, arena, combat, celestial, state, warpState, liveRs, sky) {
      if (alertTimer > 0) {
        alertTimer -= dt;
        if (alertTimer <= 0 && elAlert) elAlert.className = '';
      }

      const shPct = Math.max(0, Math.min(100, (ship.shield / Math.max(1, ship.shieldMax)) * 100));
      const hlPct = Math.max(0, Math.min(100, (ship.hull / Math.max(1, ship.hullMax)) * 100));
      const htPct = Math.max(0, Math.min(100, combat.S.heat * 100));
      if (elShieldFill) elShieldFill.style.width = shPct.toFixed(1) + '%';
      if (elHullFill) elHullFill.style.width = hlPct.toFixed(1) + '%';
      if (elHeatFill) elHeatFill.style.width = htPct.toFixed(1) + '%';
      if (elShieldTxt) elShieldTxt.textContent = Math.ceil(ship.shield);
      if (elHullTxt) elHullTxt.textContent = Math.ceil(Math.max(0, ship.hull));
      if (elHeatTxt) elHeatTxt.textContent = combat.S.overheated ? 'OVHT' : Math.round(htPct) + '%';

      if (elMslCnt) elMslCnt.textContent = combat.S.missileAmmo;
      if (elFlareCnt) elFlareCnt.textContent = combat.S.flares;
      if (elLaserState) {
        const rem = Math.max(0, combat.S.laserReadyAt - combat.S.time);
        elLaserState.textContent = rem > 0.05 ? rem.toFixed(1) + 's' : 'RDY';
      }

      const sec = Game.Sectors.byId(arena.id);
      if (elSectorText) {
        elSectorText.textContent = sec.name.toUpperCase() + ' · ' + (liveRs || arena.radiusRs).toFixed(1) + ' Rs';
      }
      if (elSectorDot) elSectorDot.style.background = sec.color;
      if (elWaveBanner) {
        if (combat.S.mode === 'victory') {
          elWaveBanner.textContent = sec.name.toUpperCase() + ' CLEARED';
        } else if (combat.S.mode === 'gameover') {
          elWaveBanner.textContent = 'HULL BREACH';
        } else {
          elWaveBanner.textContent = 'W' + Math.max(1, combat.S.wave) + '/' + combat.S.maxWaves + ' · ' + combat.S.credits + ' CR';
        }
      }

      if (elVignette) {
        const sinceHit = combat.S.time - ship.lastHitT;
        if (sinceHit >= 0 && sinceHit < 0.45) {
          const a = (1 - sinceHit / 0.45) * 0.65;
          elVignette.style.boxShadow = `inset 0 0 95px rgba(255, 35, 65, ${a.toFixed(2)})`;
        } else if (sky && sky.getFilterMode() === 0 && liveRs < 35) {
          elVignette.style.boxShadow = 'inset 0 0 80px rgba(255, 210, 120, 0.28)';
        } else {
          elVignette.style.boxShadow = 'none';
        }
      }

      const fName = sky ? FILTER_NAMES[sky.getFilterMode()] : 'ND-8 FILM';
      if (elLockBtn) {
        elLockBtn.textContent = '🎯 LOCK: ' + (combat.S.settings.autoLock ? 'ON' : 'OFF');
        elLockBtn.classList.toggle('active', !!combat.S.settings.autoLock);
      }
      if (elFilterBtn) {
        elFilterBtn.textContent = '🕶️ ' + fName;
      }
      if (elHoldBtn) {
        elHoldBtn.textContent = 'HOLD: ' + state.holdMode.toUpperCase();
        elHoldBtn.classList.toggle('active', state.holdMode === 'orbit');
      }
      if (elMuteBtn) {
        elMuteBtn.textContent = Game.Audio.isMuted() ? '🔇' : '🔊';
      }

      if (elSideCredits) elSideCredits.textContent = combat.S.credits + ' CR';
      if (elSideLockBtn) {
        const coneDeg = combat.S.upgrades.gimbalMk2 ? 28 : 19;
        elSideLockBtn.textContent = combat.S.settings.autoLock ? 'ON (' + coneDeg + '°)' : 'OFF';
        elSideLockBtn.classList.toggle('on', !!combat.S.settings.autoLock);
      }
      if (elSideAutoFireBtn) {
        elSideAutoFireBtn.textContent = combat.S.settings.autoFire ? 'AUTO: ON' : 'AUTO: OFF';
        elSideAutoFireBtn.classList.toggle('on', !!combat.S.settings.autoFire);
      }
      if (elSideFilterBtn) elSideFilterBtn.textContent = fName;
      if (elSideGravBtn) {
        elSideGravBtn.textContent = state.dynamicGravity ? 'REAL WELL' : 'DAMPED';
        elSideGravBtn.classList.toggle('on', !!state.dynamicGravity);
      }
      if (elSideHoldBtn) {
        elSideHoldBtn.textContent = state.holdMode === 'orbit' ? 'ORBIT HOLD' : 'INERTIAL';
        elSideHoldBtn.classList.toggle('on', state.holdMode === 'orbit');
      }

      drawRadar(ship, combat, celestial);
      drawOverlay(ship, cam, camera.fov, engine.getAspectRatio(camera), combat, celestial, warpState);
    }

    return { update, showAlert, openModal, closeModal, updateNavLabel, renderModalContent };
  }
  return { create, FILTER_NAMES };
})();

// ---------------------------------------------------------------------------
// SECTION: DETERMINISTIC RNG + SEED STATE — Stage A item 5.
// mulberry32, restructured so internal state is inspectable/restorable
// (needed later for save/checkpoint integration, Stage I).
// ---------------------------------------------------------------------------
Game.Rng = (function () {
  function createRng(seed) {
    let state = seed >>> 0;
    function next() {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next,
      getState: () => state >>> 0,
      setState: (s) => { state = s >>> 0; },
    };
  }
  return { createRng };
})();

// ---------------------------------------------------------------------------
// SECTION: STABLE ENTITY IDS — Stage A item 3.
// ---------------------------------------------------------------------------
Game.Ids = (function () {
  const counters = Object.create(null);
  function createId(prefix) {
    const p = prefix || "id";
    counters[p] = (counters[p] || 0) + 1;
    return p + "_" + String(counters[p]).padStart(6, "0");
  }
  return { createId };
})();

// ---------------------------------------------------------------------------
// SECTION: COMMAND / EVENT CONTRACTS — Stage A item 4.
// ---------------------------------------------------------------------------
Game.Messages = (function () {
  /** @typedef {{type: string, payload: any, id: string, tMs: number}} Command */
  /** @typedef {{type: string, payload: any, id: string, tMs: number}} GameEvent */
  /** @returns {Command} */
  function createCommand(type, payload) {
    return { type, payload: payload === undefined ? null : payload, id: Game.Ids.createId("cmd"), tMs: performance.now() };
  }
  /** @returns {GameEvent} */
  function createEvent(type, payload) {
    return { type, payload: payload === undefined ? null : payload, id: Game.Ids.createId("evt"), tMs: performance.now() };
  }
  function createQueue() {
    const items = [];
    return {
      push: (item) => items.push(item),
      drain: () => items.splice(0, items.length),
      get length() { return items.length; },
    };
  }
  return { createCommand, createEvent, createQueue };
})();

// ---------------------------------------------------------------------------
// SECTION: FOUNDATION SELF-TEST — Stage B item 7, "independent boot validation."
// Recomputes the doc's §5.1/§5.2 reference values from the formulas above and
// asserts tolerance, so a bad constant or unit slip fails loudly instead of
// silently. Orbital table abbreviated to 3 representative rows (near/mid/far)
// to fit a phone screen; all 8 rows were checked in Node before shipping this file.
// ---------------------------------------------------------------------------
Game.SelfTest = (function () {
  function pctErr(actual, expected) { return Math.abs(actual - expected) / expected * 100; }

  function run() {
    const c = Game.Constants;
    const results = [];
    function check(label, actual, expected, tolPct) {
      const err = pctErr(actual, expected);
      results.push({ label, actual, expected, err, pass: err <= tolPct });
    }

    check("Schwarzschild radius (km)", c.BH_RS / 1000, 29533, 0.1);
    check("Horizon diameter (km)", (2 * c.BH_EVENT_HORIZON_RADIUS) / 1000, 59067, 0.1);
    check("Photon sphere (km)", c.BH_PHOTON_SPHERE_RADIUS / 1000, 44300, 0.1);
    check("Shadow radius (km)", c.BH_SHADOW_RADIUS / 1000, 76700, 0.1);
    check("ISCO (km)", c.BH_ISCO_RADIUS / 1000, 88600, 0.1);

    const table = [
      [21.5, 642.4, 1],
      [1000, 94.2, 316],
      [3000, 54.4, 1643],
    ];
    for (const [rAU, vKmS, tYears] of table) {
      const rM = rAU * c.AU;
      check("v @ " + rAU + " AU (km/s)", c.circularOrbitalVelocity(rM) / 1000, vKmS, 0.5);
      check("T @ " + rAU + " AU (yr)", c.circularOrbitalPeriod(rM) / c.JULIAN_YEAR, tYears, 1.0);
    }

    const r1 = Game.Rng.createRng(12345);
    const r2 = Game.Rng.createRng(12345);
    const seqA = [r1.next(), r1.next(), r1.next()];
    const seqB = [r2.next(), r2.next(), r2.next()];
    const rngOk = seqA.every((v, i) => v === seqB[i]) && seqA.every((v) => v >= 0 && v < 1);
    results.push({ label: "Deterministic RNG (same seed -> same sequence)", actual: rngOk ? 1 : 0, expected: 1, err: rngOk ? 0 : 100, pass: rngOk });

    // --- Stage B math spine (full 79-assertion sweep run in Node before this
    // file was touched; this is a representative subset for on-device proof) ---
    const V = Game.Vec3, Q = Game.Quat, O = Game.Orbits, Gr = Game.Gravity;

    const crossOut = V.v3(0, 0, 0);
    V.cross(crossOut, V.v3(1, 0, 0), V.v3(0, 1, 0));
    results.push({ label: "Vec3 cross((1,0,0),(0,1,0)) = (0,0,1)", actual: crossOut.z, expected: 1, err: Math.abs(crossOut.z - 1) * 100, pass: Math.abs(crossOut.x) < 1e-12 && Math.abs(crossOut.y) < 1e-12 && Math.abs(crossOut.z - 1) < 1e-12 });

    const qz = { x: 0, y: 0, z: 0, w: 1 };
    Q.qFromAxisAngle(qz, { x: 0, y: 0, z: 1 }, Math.PI / 2);
    const rotOut = { x: 0, y: 0, z: 0 };
    Q.qRotateVector(rotOut, qz, { x: 1, y: 0, z: 0 });
    check("Quat: rotate (1,0,0) 90deg about Z -> (0,1,0)", rotOut.y, 1, 0.01);

    let maxKeplerResidual = 0;
    for (const e of [0.02, 0.1, 0.3, 0.5, 0.7, 0.9, 0.99]) {
      for (const M of [0.01, 0.5, 1.0, 2.0, 3.0, -1.5]) {
        const E = O.solveKepler(M, e);
        maxKeplerResidual = Math.max(maxKeplerResidual, Math.abs(E - e * Math.sin(E) - O.wrapPi(M)));
      }
    }
    results.push({ label: "Kepler solver residual, max over 42 (e,M) pairs", actual: maxKeplerResidual, expected: 0, err: maxKeplerResidual * 1e11, pass: maxKeplerResidual < 1e-9 });

    const haven = Game.SystemBodies.find((b) => b.id === "haven");
    const havenOrbit = O.initializeOrbit({ semiMajorAxisAU: haven.aAU, eccentricity: haven.e, inclinationRadians: 0, longitudeAscendingNodeRadians: 0, argumentOfPeriapsisRadians: 0, meanAnomalyAtEpochRadians: 0, epochSeconds: 0 });
    const havenPeri = O.orbitalStateAtTime(havenOrbit, 0);
    const havenPeriAU = V.length(havenPeri.position) / c.AU;
    check("haven periapsis distance (AU), via full Kepler pipeline", havenPeriAU, haven.aAU * (1 - haven.e), 0.01);
    const havenVisViva = Math.sqrt(c.BH_MU * (2 / V.length(havenPeri.position) - 1 / havenOrbit.semiMajorAxisMeters)) / 1000;
    check("haven periapsis speed (km/s) matches vis-viva", V.length(havenPeri.velocity) / 1000, havenVisViva, 0.01);

    const gTest = V.v3(0, 0, 0);
    Gr.gravityAt({ x: c.AU, y: 0, z: 0 }, gTest);
    check("gravity magnitude at 1 AU matches GM/r^2 (m/s^2 x1e6)", V.length(gTest) * 1e6, (c.BH_MU / (c.AU * c.AU)) * 1e6, 0.01);
    const gHorizon = V.v3(0, 0, 0), gTenHorizon = V.v3(0, 0, 0);
    Gr.gravityAt({ x: c.BH_RS * 1.5, y: 0, z: 0 }, gHorizon);
    Gr.gravityAt({ x: c.BH_RS * 15, y: 0, z: 0 }, gTenHorizon);
    check("gravity keeps climbing near horizon, no clamp (ratio should be 100)", V.length(gHorizon) / V.length(gTenHorizon), 100, 0.5);

    const dgAnchor = { x: 21.5 * c.AU, y: 0, z: 0 };
    const dgAnchorGravity = V.v3(0, 0, 0);
    Gr.gravityAt(dgAnchor, dgAnchorGravity);
    const dgLocal = { x: c.COMBAT_BUBBLE_RADIUS_M * 0.6, y: c.COMBAT_BUBBLE_RADIUS_M * 0.3, z: -c.COMBAT_BUBBLE_RADIUS_M * 0.2 };
    const dgLin = V.v3(0, 0, 0);
    Gr.differentialGravityLinearized(dgAnchor, dgAnchorGravity, dgLocal, dgLin, dgAnchorGravity);
    const dgExact = V.v3(0, 0, 0), dgScratchAbs = V.v3(0, 0, 0), dgScratchAnchor = V.v3(dgAnchorGravity.x, dgAnchorGravity.y, dgAnchorGravity.z), dgScratchBody = V.v3(0, 0, 0);
    Gr.differentialGravityExact(dgAnchor, dgAnchorGravity, dgLocal, dgExact, dgScratchAbs, dgScratchAnchor, dgScratchBody);
    const dgDiff = { x: 0, y: 0, z: 0 };
    V.sub(dgDiff, dgLin, dgExact);
    const dgRelPct = (V.length(dgDiff) / V.length(dgExact)) * 100;
    results.push({ label: "Differential gravity: linearized vs exact @ 8,000km bubble, 21.5 AU", actual: dgRelPct, expected: 0, err: dgRelPct, pass: dgRelPct < 0.01 });

    const clockSteps = [];
    const testClock = Game.Clock.createFixedStepClock(1 / 120, 8, 0.10);
    testClock.advance((1 / 120) * 3.4, (dt, t) => clockSteps.push(t));
    results.push({ label: "Fixed-step clock: 3.4 ticks of real time -> 3 physics steps", actual: clockSteps.length, expected: 3, err: Math.abs(clockSteps.length - 3) * 100, pass: clockSteps.length === 3 });

    const navBack = Game.Nav.navDecompressAxis(Game.Nav.navCompressAxis(1000));
    check("Map compression round-trip @ 1000 AU", navBack, 1000, 0.001);

    // --- Stage C: encounter spine (26 assertions run in Node before shipping;
    // representative subset below) ---
    const tracker = Game.EncounterManager.createTracker();
    const hystSeq = [[20e6, "UNCHANGED"], [10e6, "ACTIVATED"], [14e6, "UNCHANGED"], [17e6, "DEACTIVATED"], [13e6, "UNCHANGED"]];
    let hystOk = true;
    for (const [dist, expected] of hystSeq) { if (Game.EncounterManager.update(tracker, dist) !== expected) hystOk = false; }
    results.push({ label: "Hysteresis: no flapping inside the 12k-16km band", actual: hystOk ? 1 : 0, expected: 1, err: hystOk ? 0 : 100, pass: hystOk });

    const havenOrbit2 = O.initializeOrbit({ semiMajorAxisAU: haven.aAU, eccentricity: haven.e, inclinationRadians: 0, longitudeAscendingNodeRadians: 0, argumentOfPeriapsisRadians: 0, meanAnomalyAtEpochRadians: 0.7, epochSeconds: 0 });
    const anchorState = O.orbitalStateAtTime(havenOrbit2, 0);
    const anchorG = V.v3(0, 0, 0);
    Gr.gravityAt(anchorState.position, anchorG);
    const testFrame = Game.Encounter.createFrame(anchorState.position, anchorState.velocity, anchorG);
    const localOffset = { x: c.COMBAT_BUBBLE_RADIUS_M * 0.5, y: 0, z: 0 };
    const probe = Game.PhysicsWorld.createBody("probe", localOffset, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 });
    const pwScratch = Game.PhysicsWorld.createScratch();
    for (let i = 0; i < 1200; i++) Game.PhysicsWorld.step(testFrame, [probe], c.PHYSICS_DT, pwScratch);
    const speedAfter = V.length(probe.velocityMps);
    results.push({ label: "PhysicsWorld: co-moving body does not inherit ~642,000 m/s bulk speed", actual: speedAfter, expected: 0, err: speedAfter, pass: speedAfter < 1 });

    const rebaseFrame = Game.Encounter.createFrame({ x: 1e6, y: 5e5, z: 0 }, { x: 100, y: 0, z: 0 }, { x: 0.01, y: 0, z: 0 });
    const rbA = Game.PhysicsWorld.createBody("a", { x: 3000, y: 1000, z: 0 }, { x: 5, y: -2, z: 0 }, { x: 0, y: 0, z: 0, w: 1 });
    const rbB = Game.PhysicsWorld.createBody("b", { x: -2000, y: 500, z: 0 }, { x: -1, y: 3, z: 0 }, { x: 0, y: 0, z: 0, w: 1 });
    const oldSep = V.length(V.sub(V.v3(), rbA.positionMeters, rbB.positionMeters));
    const oldAbsA = { x: rebaseFrame.anchorPositionMeters.x + rbA.positionMeters.x, y: rebaseFrame.anchorPositionMeters.y + rbA.positionMeters.y };
    Game.Encounter.rebaseEncounter(rebaseFrame, [rbA, rbB], rbA);
    const newSep = V.length(V.sub(V.v3(), rbA.positionMeters, rbB.positionMeters));
    const newAbsA = { x: rebaseFrame.anchorPositionMeters.x + rbA.positionMeters.x, y: rebaseFrame.anchorPositionMeters.y + rbA.positionMeters.y };
    const rebaseOk = Math.abs(newSep - oldSep) < 1e-6 && Math.abs(newAbsA.x - oldAbsA.x) < 1e-6 && Math.abs(newAbsA.y - oldAbsA.y) < 1e-6 && rbA.positionMeters.x === 0;
    results.push({ label: "Rebase: doc \u00a752.6 invariants (separation + absolute position preserved)", actual: rebaseOk ? 1 : 0, expected: 1, err: rebaseOk ? 0 : 100, pass: rebaseOk });

    return results;
  }

  function renderTo(el, results) {
    const failCount = results.filter((r) => !r.pass).length;
    const lines = [];
    lines.push('<span class="hdr">BLACK HOLE COMBAT — FOUNDATION BUILD</span>');
    lines.push('<span class="dim">Stage A+B complete, Stage C encounter spine — Babylon ' + (window.BABYLON && BABYLON.Engine && BABYLON.Engine.Version ? BABYLON.Engine.Version : "?") + '</span>');
    lines.push("");
    for (const r of results) {
      const cls = r.pass ? "pass" : "fail";
      const tag = r.pass ? "PASS" : "FAIL";
      lines.push(`<span class="${cls}">${tag}</span>  ${r.label}  <span class="dim">(got ${r.actual.toFixed(3)}, err ${r.err.toFixed(3)}%)</span>`);
    }
    lines.push("");
    lines.push(failCount === 0
      ? '<span class="pass">ALL ' + results.length + ' FOUNDATION CHECKS PASSED</span>'
      : '<span class="fail">' + failCount + " OF " + results.length + ' CHECKS FAILED — do not build on top of this until fixed</span>');
    el.innerHTML = lines.join("\n");
    return failCount;
  }

  return { run, renderTo };
})();

// ---------------------------------------------------------------------------
// SECTION: ENGINE BOOT (FINAL) -- Integrates 8-Sector Open-World Solar System,
// Interstellar Gargantua Sky Shader + Optical Visor Filters, Rayleigh/Mie
// Atmospheric Planets, 3-Nozzle Reference Ship Model, Auto-Target Lock Steering
// & Gimbal, Real Dynamic Multi-Body Gravity, FX, WebAudio, and Alcubierre Warp.
// ---------------------------------------------------------------------------
Game.Boot = (function () {
  const V = Game.Vec3, Q = Game.Quat, K = Game.Constants, FC = Game.FlightController;

  function start() {
    const params = new URLSearchParams(location.search);
    const canvas = document.getElementById('renderCanvas');
    const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: params.get('pdb') === '1', stencil: false, powerPreference: 'high-performance' }, false);
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);

    // ---- adaptive internal resolution ----
    const dpr = window.devicePixelRatio || 1;
    const cssPixels = Math.max(1, window.innerWidth * window.innerHeight);
    let pixelRatio = Math.min(dpr, Math.sqrt(1.3e6 / cssPixels));
    pixelRatio = Math.max(0.6, pixelRatio);
    const ratioMax = pixelRatio;
    const adaptive = params.get('q') !== 'fixed';
    function applyRatio() { engine.setHardwareScalingLevel(1 / pixelRatio); }
    applyRatio();
    let emaMs = 16, frameCount = 0;

    const camera = new BABYLON.UniversalCamera('chaseCam', new BABYLON.Vector3(0, 6.5, -22), scene);
    camera.minZ = 0.5; camera.maxZ = 700000;
    const baseFov = (68 * Math.PI) / 180;
    camera.fov = baseFov;

    // ---- initial world sector ----
    const initSec = Game.Sectors.byId(params.get('sector') || 'photon_reach');
    let arena = Game.Arena.create(initSec);
    const sky = Game.Sky.create(scene, arena, { lowQuality: params.get('q') === 'low', exposure: 1.15 });

    // High-contrast, dark gritty space illumination (strong directional accretion light + deep shadow floor)
    const sun = new BABYLON.DirectionalLight('bhLight', new BABYLON.Vector3(0, -1, 0), scene);
    sun.diffuse = new BABYLON.Color3(1.0, 0.86, 0.68);
    sun.specular = new BABYLON.Color3(1.0, 0.90, 0.75);
    sun.intensity = 2.05;
    const fill = new BABYLON.HemisphericLight('fill', new BABYLON.Vector3(0.2, 1, 0.1), scene);
    fill.diffuse = new BABYLON.Color3(0.28, 0.38, 0.58);
    fill.groundColor = new BABYLON.Color3(0.02, 0.02, 0.04);
    fill.intensity = 0.24;

    const dust = Game.Dust.create(scene, 380, 950);
    const fx = Game.FX.create(scene);
    const celestial = Game.Celestial.create(scene);

    // ---- simulation & player state ----
    let ref0 = arena.refState(0);
    const g0 = V.v3(); Game.Gravity.gravityAt(ref0.position, g0);
    const frame = Game.Encounter.createFrame(ref0.position, ref0.velocity, g0);
    const D = V.v3(0, 0, 0);
    let simTime = 0;
    const q0 = { x: 0, y: 0, z: 0, w: 1 };
    arena.startOrientation(q0, initSec.bhYawDeg || 22, initSec.bhPitchDeg || 5);
    celestial.loadSector(initSec.id, q0);

    const ship = Game.PhysicsWorld.createBody('player', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, q0);
    ship.kind = 'player'; ship.team = 0; ship.radius = 6;
    ship.hullMax = 120; ship.hull = 120; ship.shieldMax = 150; ship.shield = 150;
    ship.alive = true; ship.lastHitT = -99;
    ship.controlState = FC.createShipControlState();
    ship.profile = Object.assign({}, FC.PLAYER_PROFILE);
    ship.thrust = 0;

    const omegaW = V.v3(); arena.frameOmega(omegaW, ref0.position, ref0.velocity);
    {
      const qc = { x: 0, y: 0, z: 0, w: 1 }, ob = V.v3();
      Q.qConjugate(qc, ship.orientation); Q.qRotateVector(ob, qc, omegaW);
      V.set(ship.controlState.angularVelocityRadPerSecond, 0, 0, 0);
    }

    const scratch = Game.PhysicsWorld.createScratch();
    const clock = Game.Clock.createFixedStepClock(K.PHYSICS_DT, K.MAX_PHYSICS_STEPS_PER_RENDER, K.MAX_ACCEPTED_FRAME_DT);
    const state = {
      holdMode: params.get('hold') === 'inertial' ? 'inertial' : 'orbit',
      dynamicGravity: true,
      lastGravMps2: 18.0,
      selectedSectorIdx: 1,
      boostHeld: false,
      shakeMag: 0,
      bhAxis: V.v3(), visBaseRs: initSec.visualBhRs || 12, visRs: initSec.visualBhRs || 12, gw1: false, gw2: false, lastImpactT: -9
    };

    const player = Game.ShipModels.buildPlayer(scene);
    player.root.rotationQuaternion = new BABYLON.Quaternion(0, 0, 0, 1);

    const camState = Game.ChaseCamera.createState((() => {
      const o = V.v3(); Q.qRotateVector(o, q0, Game.ChaseCamera.LOCAL_OFFSET); return o;
    })());
    // Tightly-bounded local-frame chase camera state so the ship NEVER shrinks far away
    const camFollowOri = { x: q0.x, y: q0.y, z: q0.z, w: q0.w };
    let camPullbackM = 0;
    let camLatLagM = 0;
    let camPitchLagM = 0;

    // ---- combat integration with mesh & FX hooks ----
    let hud = null;
    let gameoverRespawnTimer = 0;

    const combat = Game.Combat.create({
      onSpawn(e) {
        const m = Game.ShipModels.buildByKind(scene, e.kind);
        m.root.rotationQuaternion = new BABYLON.Quaternion(e.orientation.x, e.orientation.y, e.orientation.z, e.orientation.w);
        m.root.position.set(e.positionMeters.x, e.positionMeters.y, e.positionMeters.z);
        e.mesh = m;
      },
      onRemove(e) {
        if (e.mesh && e.mesh.root) { e.mesh.root.dispose(); e.mesh = null; }
      },
      onFire(e, isPlayer, origin) {
        Game.Audio.playLaser(isPlayer);
        fx.sparks(origin, e.velocityMps, 2, isPlayer ? [0.3, 0.9, 1.0] : [1.0, 0.3, 0.1]);
      },
      onHit(e, hitPos, shieldHit) {
        const isP = (e === ship);
        Game.Audio.playHit(shieldHit, isP);
        fx.sparks(hitPos, e.velocityMps, shieldHit ? 10 : 15, shieldHit ? [0.2, 0.85, 1.0] : [1.0, 0.65, 0.2]);
        if (isP) state.shakeMag = Math.min(2.2, state.shakeMag + (shieldHit ? 0.45 : 0.95));
      },
      onKill(e) {
        const sc = e.kind === 'carrier' ? 2.8 : (e.kind === 'gunship' || e.kind === 'corvette') ? 1.5 : 1.0;
        fx.explosion(e.positionMeters, e.velocityMps, sc);
        Game.Audio.playExplosion(sc);
        if (e.kind === 'carrier' && hud) hud.showAlert('★ DREADNOUGHT DESTROYED +1500 CR', false, 3.2);
      },
      onLaser(start, end) {
        fx.laserBeam(start, end);
        Game.Audio.playBeam();
      },
      onMissile() {
        Game.Audio.playMissile();
      },
      onFlare(pos, vel) {
        fx.flareBurst(pos, vel);
      },
      onWave(w, maxW) {
        if (hud) hud.showAlert(arena.name.toUpperCase() + ' · WAVE ' + w + '/' + maxW, false, 2.0);
      },
      onState(mode) {
        if (mode === 'victory' && hud) {
          hud.showAlert('★ SECTOR SECURED · OPEN [≡] MENU TO WARP', false, 4.0);
        } else if (mode === 'gameover') {
          gameoverRespawnTimer = 3.2;
          if (hud) hud.showAlert('⚠ HULL BREACH · RECONSTRUCTING', true, 3.0);
        }
      },
      onOverheat() {
        Game.Audio.playOverheat();
        if (hud) hud.showAlert('⚠ THERMAL OVERLOAD', true, 1.6);
      }
    }, { assist: true, autoFire: true, autoLock: true });

    combat.reset(ship, initSec.waves);

    // ---- Alcubierre FTL Warp State (§29-30) ----
    const warpState = {
      active: false,
      phase: 'idle',
      timer: 0,
      startRs: arena.radiusRs,
      targetSector: Game.Sectors.LIST[1],
      liveRs: arena.radiusRs,
      warpFactor: 0,
      portalVisible: false,
      portalScale: 0.1,
      portalAlpha: 0
    };

    function triggerWarp(sectorId) {
      if (warpState.active) return;
      const target = Game.Sectors.byId(sectorId || Game.Sectors.LIST[state.selectedSectorIdx].id);
      Game.Audio.playWarpCharge();
      warpState.active = true;
      warpState.phase = 'charge';
      warpState.timer = 0;
      warpState.startRs = arena.radiusRs; warpState.visFrom = state.visRs || state.visBaseRs;
      warpState.targetSector = target;
      warpState.liveRs = arena.radiusRs;
      warpState.warpFactor = 0;
      warpState.portalVisible = true;
      warpState.portalScale = 0.1;
      warpState.portalAlpha = 0.2;
      combat.S.fireHeld = false;
      if (hud) hud.showAlert('⚡ WARP SPOOLING → ' + target.name.toUpperCase(), false, 2.2);
    }

    function completeWarpArrival(sec) {
      arena = Game.Arena.create(sec);
      state.visBaseRs = sec.visualBhRs; state.visRs = sec.visualBhRs; state.gw1 = false; state.gw2 = false;
      sky.setRadiusRs(sec.radiusRs, sec.visualBhRs);
      arena.startOrientation(ship.orientation, sec.bhYawDeg || 22, sec.bhPitchDeg || 5, 0);
      celestial.loadSector(sec.id, ship.orientation);
      simTime = 0;
      ref0 = arena.refState(0);
      V.set(D, 0, 0, 0);
      V.copy(frame.anchorPositionMeters, ref0.position);
      V.normalize(state.bhAxis, ref0.position);
      V.copy(frame.anchorVelocityMps, ref0.velocity);
      Game.Gravity.gravityAt(ref0.position, frame.anchorAccelerationMps2);

      const om = V.v3(); arena.frameOmega(om, ref0.position, ref0.velocity);
      const qc = { x: 0, y: 0, z: 0, w: 1 }, ob = V.v3();
      Q.qConjugate(qc, ship.orientation); Q.qRotateVector(ob, qc, om);
      V.set(ship.controlState.angularVelocityRadPerSecond, 0, 0, 0);
      V.set(ship.positionMeters, 0, 0, 0);
      V.set(ship.velocityMps, 0, 0, 0);
      Game.RenderSnapshot.commit(ship.snapshot, ship.positionMeters, ship.orientation);
      Game.RenderSnapshot.commit(ship.snapshot, ship.positionMeters, ship.orientation);

      camFollowOri.x = ship.orientation.x; camFollowOri.y = ship.orientation.y;
      camFollowOri.z = ship.orientation.z; camFollowOri.w = ship.orientation.w;
      camPullbackM = 0; camLatLagM = 0; camPitchLagM = 0;

      const o = V.v3(); Q.qRotateVector(o, ship.orientation, Game.ChaseCamera.LOCAL_OFFSET);
      V.copy(camState.positionMeters, o); V.set(camState.velocityMps, 0, 0, 0);
      fx.clear();
      combat.reset(ship, sec.waves);

      const curIdx = Game.Sectors.LIST.findIndex(s => s.id === sec.id);
      state.selectedSectorIdx = (curIdx + 1) % Game.Sectors.LIST.length;
      if (hud) {
        hud.updateNavLabel(state);
        hud.showAlert(sec.name.toUpperCase() + ' (' + sec.radiusRs + ' Rs)', false, 2.8);
      }
    }

    Game.TouchInput.attach(document.body);
    Game.KeyboardInput.attach();

    const speedHudEl = document.getElementById('speedHud');
    const touchDebugEl = document.getElementById('touchDebug');
    const renderPos = V.v3(), renderOri = { x: 0, y: 0, z: 0, w: 1 };
    const ePos = V.v3(), eOri = { x: 0, y: 0, z: 0, w: 1 };
    const omega = V.v3(), rHat = V.v3(), camAbs = V.v3(), dynGrav = V.v3();
    // ---- the hole as a real place -----------------------------------------------------------------
    // A fixed point mass DIVE_M_PER_RS * visBaseRs metres from the arena origin, along the sector's hole bearing.
    // Fly toward it and it genuinely grows (lens tables follow); fly sideways and the parallax shifts.
    V.normalize(state.bhAxis, frame.anchorPositionMeters);
    const DIVE_M_PER_RS = 2200;
    const rAnch = V.v3(), bhRel = V.v3(), bhDirS = V.v3(), _fwdS = V.v3(), _rightS = V.v3();
    const _cal = { a: new Float32Array(90), n: 0, vsync: 16.67, sum: 0, cnt: 0, good: 0, failRatio: 9, failT: -1e9 };
    const _Z1s = { x: 0, y: 0, z: 1 }, _X1s = { x: 1, y: 0, z: 0 };
    const _intent = { thrust: 0, strafe: 0, vertical: 0, yaw: 0, pitch: 0, roll: 0 };
    function bhVirtual(pos, outDir) {
      V.copy(rAnch, state.bhAxis);
      const D0 = state.visBaseRs * DIVE_M_PER_RS;
      const x = rAnch.x * D0 + D.x + pos.x, y = rAnch.y * D0 + D.y + pos.y, z = rAnch.z * D0 + D.z + pos.z;
      const len = Math.max(1, Math.sqrt(x * x + y * y + z * z));
      outDir.x = x / len; outDir.y = y / len; outDir.z = z / len;
      return len / DIVE_M_PER_RS;
    }
    const planetCb = {
      impact(spd, name) {
        const t = combat.S.time;
        if (t - state.lastImpactT < 0.35) return;
        state.lastImpactT = t;
        state.shakeMag = Math.min(2.2, state.shakeMag + Math.min(1.6, spd / 120));
        if (spd > 240) combat.applyDamage(ship, 1e6, t, ship.positionMeters);
        else if (spd > 25) combat.applyDamage(ship, (spd - 25) * 1.15, t, ship.positionMeters);
        if (hud) hud.showAlert(spd > 240 ? '☠ CATASTROPHIC IMPACT · ' + name.toUpperCase() : '⚠ SURFACE IMPACT · ' + Math.round(spd) + ' m/s', true, 1.8);
      },
      orbit(on, name) { if (hud) hud.showAlert(on ? '◎ ORBIT LOCK · ' + name.toUpperCase() : '◎ ORBIT RELEASED', false, 1.8); },
    };
    const camRight = V.v3(), camUp = V.v3(), camFwd = V.v3();
    const _Z1 = { x: 0, y: 0, z: 1 };
    const _camTarget = new BABYLON.Vector3(0, 0, 0), _ef = V.v3();
    const _nozzles = [{ x: 0, y: -0.05, z: -7.9, sz: 3.1 }, { x: -2.55, y: -0.12, z: -7.3, sz: 2.1 }, { x: 2.55, y: -0.12, z: -7.3, sz: 2.1 }];
    const shipFwd = V.v3(), shipRight = V.v3(), shipUp = V.v3();
    const _lockDir = V.v3(), _lockLoc = V.v3(), _qcLock = { x: 0, y: 0, z: 0, w: 1 };
    let ref = ref0;
    const clamp11 = (v) => Math.max(-1, Math.min(1, v));

    function rebase() {
      const off = V.v3(ship.positionMeters.x, ship.positionMeters.y, ship.positionMeters.z);
      Game.Encounter.rebaseEncounter(frame, combat.S.bodies, ship);
      V.add(D, D, off);
      Game.ChaseCamera.shift(camState, off);
      dust.shift(off);
      combat.shift(off);
      fx.shift(off);
      celestial.shift(off);
      if (Game.Boot.onRebase) Game.Boot.onRebase(off);
    }

    function fixedStep(dt) {
      if (document.body.classList.contains('menuOpen')) return;
      simTime += dt;
      ref = arena.refState(simTime);
      frame.anchorPositionMeters.x = ref.position.x + D.x;
      frame.anchorPositionMeters.y = ref.position.y + D.y;
      frame.anchorPositionMeters.z = ref.position.z + D.z;
      V.copy(frame.anchorVelocityMps, ref.velocity);
      Game.Gravity.gravityAt(ref.position, frame.anchorAccelerationMps2);

      if (combat.S.mode === 'gameover') {
        gameoverRespawnTimer -= dt;
        if (gameoverRespawnTimer <= 0) {
          const sec = Game.Sectors.byId(arena.id);
          completeWarpArrival(sec);
        }
      }

      if (warpState.active) {
        warpState.timer += dt;
        if (warpState.phase === 'charge') {
          const p = Math.min(1, warpState.timer / 1.1);
          warpState.portalScale = 0.15 + p * 1.35;
          warpState.portalAlpha = 0.25 + p * 0.70;
          warpState.warpFactor = p * 0.35;
          if (warpState.timer >= 1.1) {
            warpState.phase = 'cruise';
            warpState.timer = 0;
          }
        } else if (warpState.phase === 'cruise') {
          const p = Math.min(1, warpState.timer / 2.2);
          const smooth = p * p * (3 - 2 * p);
          warpState.liveRs = warpState.startRs + (warpState.targetSector.radiusRs - warpState.startRs) * smooth;
          warpState.warpFactor = 0.35 + Math.sin(p * Math.PI) * 0.65;
          warpState.portalScale = 1.5 + Math.sin(p * Math.PI) * 0.8;
          warpState.portalAlpha = 1 - p * 0.7;
          if (warpState.timer >= 2.2) {
            warpState.active = false;
            warpState.phase = 'idle';
            warpState.warpFactor = 0;
            warpState.portalVisible = false;
            completeWarpArrival(warpState.targetSector);
            return;
          }
        }
      }

      if (celestial.dockStation && celestial.dockStation.isFriendly && ship.alive) {
        const sp = celestial.dockStation.root.position;
        const distDock = Math.hypot(sp.x - ship.positionMeters.x, sp.y - ship.positionMeters.y, sp.z - ship.positionMeters.z);
        if (distDock < 240) {
          ship.hull = Math.min(ship.hullMax, ship.hull + 18 * dt);
          ship.shield = Math.min(ship.shieldMax, ship.shield + 35 * dt);
          if (Math.floor((simTime - dt) * 0.5) < Math.floor(simTime * 0.5)) {
            combat.S.missileAmmo = Math.min(Game.Combat.PLAYER_MISSILE.maxAmmo, combat.S.missileAmmo + 1);
          }
        }
      }

      const t = Game.TouchInput.getState(), kb = Game.KeyboardInput.getState();
      const boostMul = state.boostHeld ? 1.85 : 1.0;
      ship.profile.accelFwd = FC.PLAYER_PROFILE.accelFwd * boostMul;
      ship.profile.softMaxSpeed = FC.PLAYER_PROFILE.softMaxSpeed * (state.boostHeld ? 1.9 : 1.0);

      let yawIn = clamp11(t.rightX + t.aimX + kb.yaw);
      let pitchIn = clamp11(t.rightY + t.aimY + kb.pitch);

      // Soft Magnetic Auto-Target Lock Steering Assist when firing
      const manualAimMag = Math.hypot(yawIn, pitchIn);
      if (combat.S.settings.autoLock && combat.S.target && combat.S.target.alive && !warpState.active && manualAimMag < 0.15) {
        combat.leadDir(_lockDir, ship, combat.S.target, Game.Combat.PLAYER_GUN.boltSpeed);
        Q.qConjugate(_qcLock, ship.orientation);
        Q.qRotateVector(_lockLoc, _qcLock, _lockDir);
        const yErr = Math.atan2(_lockLoc.x, _lockLoc.z);
        const pErr = Math.atan2(_lockLoc.y, Math.hypot(_lockLoc.x, _lockLoc.z));
        const totAng = Math.hypot(yErr, pErr);
        if (combat.S.fireHeld && totAng < 0.65) {
          yawIn = clamp11(yawIn + yErr * 2.2);
          pitchIn = clamp11(pitchIn + pErr * 2.2);
        }
      }

      const intent = _intent;
      intent.thrust = clamp11((state.boostHeld ? 1 : 0) + t.leftY + kb.thrust);
      intent.strafe = clamp11(t.leftX + kb.strafe);
      intent.vertical = clamp11(kb.vertical);
      intent.yaw = yawIn;
      intent.pitch = pitchIn;
      intent.roll = clamp11(kb.roll + (Math.abs(kb.roll) < 0.05 ? -yawIn * 0.35 : 0));
      ship.thrust = intent.thrust;

      arena.frameOmega(omega, ref.position, ref.velocity);
      V.set(omega, 0, 0, 0);   // static world: hole, worlds and stars no longer sweep around the ship at 2.5 deg/s
      if (!warpState.active) combat.preStep(dt);
      FC.update(ship, intent, dt, state.holdMode === 'orbit' ? omega : null);

      if (!warpState.active) {
        const vRsS = bhVirtual(ship.positionMeters, bhDirS);       // outward unit vector in bhDirS
        ship.tideScale = celestial.planetWeight(ship.positionMeters);
        state.visRs = vRsS;
        const idle = Math.abs(intent.thrust) < 0.02 && Math.abs(intent.strafe) < 0.02 && Math.abs(intent.vertical) < 0.02 && !state.boostHeld;
        if (celestial.orbitOn) { const ta = ship.thrustAccelMps2; ta.x = 0; ta.y = 0; ta.z = 0; }   // orbit lock: dampers off, free fall
        if (state.dynamicGravity) {
          const gm = arena.gravityMul || 1;
          const bhPull = 15500 * (0.75 + 0.125 * gm) / (vRsS * vRsS);   // m/s^2 ~ 1/r^2: negligible far out, overwhelming below ~3.5 Rs
          celestial.computeDynamicGravity(ship.positionMeters, bhDirS, bhPull, dynGrav);
          state.lastGravMps2 = V.length(dynGrav);
          const ta = ship.thrustAccelMps2;
          ta.x += dynGrav.x; ta.y += dynGrav.y; ta.z += dynGrav.z;
          // the well bites: warnings, shake, then tidal stress, then the horizon
          if (vRsS < 6.0 && !state.gw1) { state.gw1 = true; if (hud) hud.showAlert('⚠ GRAVITY WELL · ' + vRsS.toFixed(1) + ' Rs', true, 2.2); }
          if (vRsS < 3.9 && !state.gw2) { state.gw2 = true; if (hud) hud.showAlert('☢ CRITICAL PULL · BOOST AWAY', true, 2.6); }
          if (vRsS > 7.0) { state.gw1 = false; state.gw2 = false; }
          if (vRsS < 6.0) state.shakeMag = Math.max(state.shakeMag, 1.25 * Math.min(1, (bhPull - 400) / 1800));
          if (vRsS < 3.3 && ship.alive) {
            const sev = Math.min(1, (3.3 - vRsS) / 1.1);
            let dmg = (5 + 70 * sev * sev) * dt;
            if (ship.shield > 0) { const q = Math.min(ship.shield, dmg); ship.shield -= q; dmg -= q; }
            if (dmg > 0) ship.hull -= dmg;
            if (ship.hull <= 0 || vRsS < 2.2) { if (hud) hud.showAlert(vRsS < 2.2 ? '☠ EVENT HORIZON' : '☠ TIDAL FAILURE', true, 2.4); combat.applyDamage(ship, 1e6, combat.S.time, ship.positionMeters); }
          }
        } else { state.lastGravMps2 = 0; V.set(dynGrav, 0, 0, 0); }
        Q.qRotateVector(_fwdS, ship.orientation, _Z1s); Q.qRotateVector(_rightS, ship.orientation, _X1s);
        celestial.planetStep(ship, idle, dt, _fwdS, _rightS, planetCb);
      }

      Game.PhysicsWorld.step(frame, combat.S.bodies, dt, scratch);
      if (!warpState.active) combat.postStep(dt);
      if (V.length(ship.positionMeters) > K.REANCHOR_THRESHOLD_M) rebase();
    }

    function toggleHoldMode() {
      state.holdMode = state.holdMode === 'orbit' ? 'inertial' : 'orbit';
      if (hud) hud.showAlert('HOLD: ' + state.holdMode.toUpperCase(), false, 1.6);
    }

    function toggleAutoFire() {
      combat.S.settings.autoFire = !combat.S.settings.autoFire;
      if (hud) hud.showAlert('AUTO-FIRE: ' + (combat.S.settings.autoFire ? 'ON' : 'OFF'), false, 1.6);
    }

    function toggleAutoLock() {
      combat.S.settings.autoLock = !combat.S.settings.autoLock;
      if (hud) hud.showAlert('AUTO-LOCK: ' + (combat.S.settings.autoLock ? 'ON' : 'OFF'), false, 1.6);
    }

    function toggleDynamicGravity() {
      state.dynamicGravity = !state.dynamicGravity;
      if (hud) hud.showAlert('GRAVITY: ' + (state.dynamicGravity ? 'REAL WELL' : 'COMPENSATED'), false, 1.6);
    }

    function cycleVisorFilter() {
      const next = (sky.getFilterMode() + 1) % 4;
      sky.setFilterMode(next);
      if (hud) hud.showAlert('VISOR: ' + Game.HUD.FILTER_NAMES[next], false, 1.8);
    }

    let api = null;
    hud = Game.HUD.create(() => api);
    hud.updateNavLabel(state);

    // ---- Wire Controller & Hamburger Menu Buttons ----
    // FIRE is an Aim+Fire pad (see TouchInput): press = fire, drag = steer nose, release = cease fire.
    Game.TouchInput.setFireHandlers(() => { Game.Audio.unlock(); combat.S.fireHeld = true; }, () => { combat.S.fireHeld = false; });
    const laserBtn = document.getElementById('laserBtn');
    if (laserBtn) laserBtn.addEventListener('click', () => { Game.Audio.unlock(); combat.fireLaser(); });
    const missileBtn = document.getElementById('missileBtn');
    if (missileBtn) missileBtn.addEventListener('click', () => { Game.Audio.unlock(); combat.fireMissile(); });
    const flareBtn = document.getElementById('flareBtn');
    if (flareBtn) flareBtn.addEventListener('click', () => { Game.Audio.unlock(); combat.deployFlare(); });
    const boostBtn = document.getElementById('boostBtn');
    if (boostBtn) {
      const startBoost = (e) => { e.preventDefault(); Game.Audio.unlock(); state.boostHeld = true; boostBtn.classList.add('boosting'); };
      const stopBoost = () => { state.boostHeld = false; boostBtn.classList.remove('boosting'); };
      boostBtn.addEventListener('pointerdown', startBoost);
      boostBtn.addEventListener('pointerup', stopBoost);
      boostBtn.addEventListener('pointercancel', stopBoost);
      boostBtn.addEventListener('pointerleave', stopBoost);
      boostBtn.addEventListener('click', () => { state.boostHeld = true; boostBtn.classList.add('boosting'); setTimeout(stopBoost, 650); });
    }
    const prevSecBtn = document.getElementById('prevSecBtn');
    if (prevSecBtn) prevSecBtn.addEventListener('click', () => {
      state.selectedSectorIdx = (state.selectedSectorIdx - 1 + Game.Sectors.LIST.length) % Game.Sectors.LIST.length;
      hud.updateNavLabel(state);
    });
    const nextSecBtn = document.getElementById('nextSecBtn');
    if (nextSecBtn) nextSecBtn.addEventListener('click', () => {
      state.selectedSectorIdx = (state.selectedSectorIdx + 1) % Game.Sectors.LIST.length;
      hud.updateNavLabel(state);
    });
    const warpBtn = document.getElementById('warpBtn');
    if (warpBtn) warpBtn.addEventListener('click', () => {
      hud.closeModal();
      triggerWarp(Game.Sectors.LIST[state.selectedSectorIdx].id);
    });
    const holdBtn = document.getElementById('holdBtn');
    if (holdBtn) holdBtn.addEventListener('click', toggleHoldMode);
    const lockBtn = document.getElementById('lockBtn');
    if (lockBtn) lockBtn.addEventListener('click', toggleAutoLock);
    const filterBtn = document.getElementById('filterBtn');
    if (filterBtn) filterBtn.addEventListener('click', cycleVisorFilter);
    const muteBtn = document.getElementById('muteBtn');
    if (muteBtn) muteBtn.addEventListener('click', () => {
      Game.Audio.unlock();
      Game.Audio.setMuted(!Game.Audio.isMuted());
    });

    const sideLockBtn = document.getElementById('sideLockBtn');
    if (sideLockBtn) sideLockBtn.addEventListener('click', toggleAutoLock);
    const sideAutoFireBtn = document.getElementById('autoFireBtn');
    if (sideAutoFireBtn) sideAutoFireBtn.addEventListener('click', toggleAutoFire);
    const sideFilterBtn = document.getElementById('sideFilterBtn');
    if (sideFilterBtn) sideFilterBtn.addEventListener('click', cycleVisorFilter);
    const sideGravBtn = document.getElementById('sideGravBtn');
    if (sideGravBtn) sideGravBtn.addEventListener('click', toggleDynamicGravity);
    const sideHoldBtn = document.getElementById('sideHoldBtn');
    if (sideHoldBtn) sideHoldBtn.addEventListener('click', toggleHoldMode);

    window.addEventListener('pointerdown', () => Game.Audio.unlock(), { passive: true });
    window.addEventListener('keydown', (e) => {
      Game.Audio.unlock();
      if (e.code === 'KeyH') toggleHoldMode();
      else if (e.code === 'KeyG') toggleAutoLock();
      else if (e.code === 'KeyV') cycleVisorFilter();
      else if (e.code === 'KeyF' || e.code === 'Space') combat.S.fireHeld = true;
      else if (e.code === 'KeyL') combat.fireLaser();
      else if (e.code === 'KeyM') combat.fireMissile();
      else if (e.code === 'KeyC') combat.deployFlare();
      else if (e.code === 'KeyB') state.boostHeld = true;
      else if (e.code === 'KeyT') {
        state.selectedSectorIdx = (state.selectedSectorIdx + 1) % Game.Sectors.LIST.length;
        hud.updateNavLabel(state);
      } else if (e.code === 'KeyR') {
        triggerWarp(Game.Sectors.LIST[state.selectedSectorIdx].id);
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        if (document.body.classList.contains('menuOpen')) hud.closeModal();
        else hud.openModal('shop');
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyF' || e.code === 'Space') combat.S.fireHeld = false;
      else if (e.code === 'KeyB') state.boostHeld = false;
    });

    // ---- Main Render Loop ----
    const _camLocOff = V.v3(), _camWorldOff = V.v3(), _camLook = V.v3(), _camUpV = V.v3();
    let lastMs = performance.now();
    engine.runRenderLoop(() => {
      const nowMs = performance.now();
      const realDt = Math.min(0.1, (nowMs - lastMs) / 1000);
      lastMs = nowMs;
      const alpha = clock.advance(realDt, fixedStep);

      Game.RenderSnapshot.sample(ship.snapshot, alpha, renderPos, renderOri);
      player.root.position.set(renderPos.x, renderPos.y, renderPos.z);
      player.root.rotationQuaternion.set(renderOri.x, renderOri.y, renderOri.z, renderOri.w);

      for (const e of combat.S.enemies) {
        if (e.mesh && e.mesh.root) {
          Game.RenderSnapshot.sample(e.snapshot, alpha, ePos, eOri);
          e.mesh.root.position.set(ePos.x, ePos.y, ePos.z);
          e.mesh.root.rotationQuaternion.set(eOri.x, eOri.y, eOri.z, eOri.w);
        }
      }

      // Ship basis vectors from interpolated orientation
      Q.qRotateVector(shipFwd, renderOri, { x: 0, y: 0, z: 1 });
      Q.qRotateVector(shipRight, renderOri, { x: 1, y: 0, z: 0 });
      Q.qRotateVector(shipUp, renderOri, { x: 0, y: 1, z: 0 });

      // Tightly-Bounded Local Chase Camera:
      // The ship only shifts forward by a small, clamped amount (max ~2.8m on normal thrust,
      // max ~4.0m on BOOST) instead of lagging 120m+ away at high speed!
      const dtCam = Math.min(realDt, K.MAX_ACCEPTED_FRAME_DT);
      Q.qSlerp(camFollowOri, camFollowOri, renderOri, 1 - Math.exp(-dtCam * 12));
      const fwdSpd = V.dot(ship.velocityMps, shipFwd);
      const latSpd = V.dot(ship.velocityMps, shipRight);
      const targetPullback = Math.max(-0.8, Math.min(2.8, (fwdSpd / 650) * 2.6)) + (state.boostHeld ? 1.2 : 0);
      const targetLatLag = Math.max(-1.6, Math.min(1.6, -(latSpd / 650) * 1.4));
      const targetPitchLag = Math.max(-1.2, Math.min(1.2, ship.controlState.angularVelocityRadPerSecond.x * 0.65));
      const kPull = 1 - Math.exp(-dtCam * 8.5);
      camPullbackM += (targetPullback - camPullbackM) * kPull;
      camLatLagM += (targetLatLag - camLatLagM) * kPull;
      camPitchLagM += (targetPitchLag - camPitchLagM) * kPull;

      V.set(_camLocOff, camLatLagM, 6.2 + camPitchLagM, -(21.5 + camPullbackM));
      Q.qRotateVector(_camWorldOff, camFollowOri, _camLocOff);
      Q.qRotateVector(_camUpV, camFollowOri, { x: 0, y: 1, z: 0 });

      const cam = {
        position: {
          x: renderPos.x + _camWorldOff.x,
          y: renderPos.y + _camWorldOff.y,
          z: renderPos.z + _camWorldOff.z
        },
        lookAt: {
          x: renderPos.x + shipFwd.x * 42,
          y: renderPos.y + shipFwd.y * 42,
          z: renderPos.z + shipFwd.z * 42
        },
        up: _camUpV
      };
      V.copy(camState.positionMeters, cam.position);

      if (state.shakeMag > 0.01) {
        state.shakeMag *= Math.exp(-realDt * 8);
        cam.position.x += (Math.random() - 0.5) * state.shakeMag;
        cam.position.y += (Math.random() - 0.5) * state.shakeMag;
      }
      camera.fov = baseFov * (1 + (state.boostHeld ? 0.032 : 0) + warpState.warpFactor * 0.22);
      camera.position.set(cam.position.x, cam.position.y, cam.position.z);
      camera.upVector.copyFromFloats(cam.up.x, cam.up.y, cam.up.z);
      _camTarget.copyFromFloats(cam.lookAt.x, cam.lookAt.y, cam.lookAt.z); camera.setTarget(_camTarget);

      let fxDir = cam.lookAt.x - cam.position.x, fyDir = cam.lookAt.y - cam.position.y, fzDir = cam.lookAt.z - cam.position.z;
      let fl = Math.hypot(fxDir, fyDir, fzDir) || 1; fxDir /= fl; fyDir /= fl; fzDir /= fl;
      let rxDir = cam.up.y * fzDir - cam.up.z * fyDir, ryDir = cam.up.z * fxDir - cam.up.x * fzDir, rzDir = cam.up.x * fyDir - cam.up.y * fxDir;
      let rl = Math.hypot(rxDir, ryDir, rzDir) || 1; rxDir /= rl; ryDir /= rl; rzDir /= rl;
      const uxDir = fyDir * rzDir - fzDir * ryDir, uyDir = fzDir * rxDir - fxDir * rzDir, uzDir = fxDir * ryDir - fyDir * rxDir;
      V.set(camFwd, fxDir, fyDir, fzDir);
      V.set(camRight, rxDir, ryDir, rzDir);
      V.set(camUp, uxDir, uyDir, uzDir);

      fx.updateParticles(realDt, cam.position, camRight, camUp, camFwd);
      fx.beginStreaks();

      // Triple Hexagonal Golden-Amber Engine Plume Glows + Thruster Streaks
      const pThrust = Math.max(0.25, Math.abs(ship.thrust || 0) + (state.boostHeld ? 0.85 : 0) + warpState.warpFactor * 1.5);
      for (const nz of _nozzles) {
        const ex = renderPos.x + shipFwd.x * nz.z + shipRight.x * nz.x + shipUp.x * nz.y;
        const ey = renderPos.y + shipFwd.y * nz.z + shipRight.y * nz.x + shipUp.y * nz.y;
        const ez = renderPos.z + shipFwd.z * nz.z + shipRight.z * nz.x + shipUp.z * nz.y;
        fx.glowAt(ex, ey, ez, nz.sz * (0.75 + pThrust * 0.75), 1.0, 0.78, 0.28, 0.92, camRight, camUp, camFwd);
        if (pThrust > 0.45) {
          const sLen = nz.sz * pThrust * 2.2;
          fx.streakAt(ex - shipFwd.x * sLen * 0.45, ey - shipFwd.y * sLen * 0.45, ez - shipFwd.z * sLen * 0.45,
            -shipFwd.x, -shipFwd.y, -shipFwd.z, sLen, nz.sz * 0.52, cam.position, 1.0, 0.72, 0.22, 0.82);
        }
      }

      // Enemy engine glows & damaged-hull spark choreography
      for (const e of combat.S.enemies) {
        if (!e.alive || !e.mesh) continue;
        const ef = _ef; Q.qRotateVector(ef, e.orientation, _Z1);
        const ep = e.mesh.root.position;
        const back = e.radius + 1.5;
        fx.glowAt(ep.x - ef.x * back, ep.y - ef.y * back, ep.z - ef.z * back, e.radius * 0.45, 1.0, 0.25, 0.08, 0.8, camRight, camUp, camFwd);
        if (e.hull < e.hullMax * 0.5 && (frameCount % 6 === 0)) {
          fx.sparks(ep, e.velocityMps, 1, [1.0, 0.45, 0.12]);
        }
      }

      // Active weapon bolts
      const B = combat.B;
      for (let i = 0; i < B.MAX; i++) {
        if (!B.active[i]) continue;
        const vx = B.vx[i] - ship.velocityMps.x, vy = B.vy[i] - ship.velocityMps.y, vz = B.vz[i] - ship.velocityMps.z;
        const sp = Math.hypot(vx, vy, vz) || 1;
        const isP = B.team[i] === 0;
        fx.streakAt(
          B.x[i], B.y[i], B.z[i], vx / sp, vy / sp, vz / sp,
          isP ? 22 : 18, isP ? 1.5 : 1.7, cam.position,
          isP ? 0.25 : 1.0, isP ? 0.92 : 0.25, isP ? 1.0 : 0.08, 1.0
        );
      }

      // Active guided missiles
      for (const m of combat.M) {
        if (!m.active) continue;
        fx.glowAt(m.pos.x, m.pos.y, m.pos.z, 3.8, 1.0, 0.72, 0.2, 0.95, camRight, camUp, camFwd);
        fx.streakAt(m.pos.x, m.pos.y, m.pos.z, m.dir.x, m.dir.y, m.dir.z, 14, 1.8, cam.position, 1.0, 0.65, 0.15, 0.9);
      }

      fx.updateBeams(realDt, cam.position);
      fx.endFrame();

      // Black hole direction & live radial distance for geodesic sky + accretion illumination
      camAbs.x = ref.position.x + D.x + cam.position.x;
      camAbs.y = ref.position.y + D.y + cam.position.y;
      camAbs.z = ref.position.z + D.z + cam.position.z;
      let liveRs;
      if (warpState.active) {
        const dr = warpState.targetSector.radiusRs - warpState.startRs;
        const f = Math.abs(dr) > 1e-6 ? Math.min(1, Math.max(0, (warpState.liveRs - warpState.startRs) / dr)) : 1;
        liveRs = warpState.visFrom + (warpState.targetSector.visualBhRs - warpState.visFrom) * f;
        V.normalize(rHat, camAbs);
      } else {
        liveRs = bhVirtual(cam.position, rHat);
        state.visRs = liveRs;
      }
      sun.direction.copyFromFloats(rHat.x, rHat.y, rHat.z);

      if (player.hullMat) {
        player.hullMat.setVector3('uCamPos', camera.position);
        player.hullMat.setVector3('uSunDir', sun.direction);
        player.hullMat.setFloat('uExposure', window.__BH_EXPO.value);
      }

      sky.update(camera, engine, rHat, nowMs / 1000, cam.position, cam.lookAt, cam.up, liveRs, warpState.warpFactor);
      dust.update(cam.position, ship.velocityMps, warpState.warpFactor);
      celestial.update(realDt, nowMs / 1000, cam.position, rHat, renderPos, shipFwd, warpState);

      const spdMps = V.length(ship.velocityMps);
      Game.Audio.updateEngine(ship.thrust || 0, spdMps, liveRs);

      if (Game.Boot.onFrame) Game.Boot.onFrame(realDt, alpha, cam);

      scene.render();

      emaMs += (realDt * 1000 - emaMs) * 0.05; frameCount++;
      {
        const ms = realDt * 1000;
        if (ms > 0 && ms < 250) {
          if (_cal.n < 90) {
            _cal.a[_cal.n++] = ms;
            if (_cal.n === 90) {                       // learn the display period (60 / 90 / 120 Hz ...) from the quartile
              const q = _cal.a.slice().sort((x, y) => x - y)[22];
              _cal.vsync = q < 9.6 ? 8.33 : q < 13.9 ? 11.11 : q < 20 ? 16.67 : q < 40 ? 33.3 : 16.67;
            }
          } else if (ms < _cal.vsync * 4) { _cal.sum += ms; _cal.cnt++; }   // single hitches (GC, uploads) never count
        }
        if (adaptive && _cal.n >= 90 && _cal.cnt >= 60) {
          const m = _cal.sum / _cal.cnt; _cal.sum = 0; _cal.cnt = 0;
          if (m > _cal.vsync * 1.28 && pixelRatio > 0.55) {
            _cal.failRatio = pixelRatio; _cal.failT = nowMs; _cal.good = 0;
            pixelRatio = Math.max(0.55, pixelRatio * 0.92); applyRatio();
          } else if (m < _cal.vsync * 1.10) {
            if (++_cal.good >= 3 && pixelRatio < ratioMax) {
              const cap = (nowMs - _cal.failT > 25000) ? ratioMax : Math.min(ratioMax, _cal.failRatio * 0.97);
              if (pixelRatio < cap) { pixelRatio = Math.min(cap, pixelRatio * 1.05); applyRatio(); }
              _cal.good = 0;
            }
          } else _cal.good = 0;
        }
      }

      const tt = Game.TouchInput.getState();
      if (touchDebugEl) {
        touchDebugEl.textContent = 'L(' + tt.leftX.toFixed(2) + ',' + tt.leftY.toFixed(2) + ')  R(' + tt.rightX.toFixed(2) + ',' + tt.rightY.toFixed(2) + ')  ' + Math.round(1000 / Math.max(1, emaMs)) + 'fps x' + pixelRatio.toFixed(2);
      }
      if (speedHudEl) {
        if (warpState.active && warpState.phase === 'cruise') {
          speedHudEl.textContent = 'WARP FTL';
        } else if (spdMps >= 1000) {
          speedHudEl.textContent = (spdMps / 1000).toFixed(2) + ' km/s';
        } else {
          speedHudEl.textContent = spdMps.toFixed(0) + ' m/s';
        }
      }
      hud.update(realDt, ship, cam, camera, engine, arena, combat, celestial, state, warpState, liveRs, sky);
    });

    window.addEventListener('resize', () => engine.resize());

    api = {
      engine, scene, camera, ship,
      get arena() { return arena; },
      sky, frame, D,
      get bodies() { return combat.S.bodies; },
      state, camState, dust, player, combat, fx, celestial, hud, warpState, V, Q,
      get simTime() { return simTime; },
      setPixelRatio(r) { pixelRatio = r; applyRatio(); },
      rebase, fixedStep, triggerWarp, completeWarpArrival,
      toggleHoldMode, toggleAutoFire, toggleAutoLock, toggleDynamicGravity, cycleVisorFilter,
      diveTo(vRs) {
        V.copy(rAnch, state.bhAxis);
        const L = state.visBaseRs * DIVE_M_PER_RS - vRs * DIVE_M_PER_RS;
        V.set(ship.positionMeters, -rAnch.x * L - D.x, -rAnch.y * L - D.y, -rAnch.z * L - D.z);
        V.set(ship.velocityMps, 0, 0, 0);
        rebase();
      },
      jumpTo(t, yawDeg, pitchDeg) {
        simTime = t; ref = arena.refState(t);
        arena.startOrientation(ship.orientation, yawDeg, pitchDeg, t);
        arena.frameOmega(omega, ref.position, ref.velocity);
        const qc = { x: 0, y: 0, z: 0, w: 1 }, ob = V.v3();
        Q.qConjugate(qc, ship.orientation); Q.qRotateVector(ob, qc, omega);
        V.copy(ship.controlState.angularVelocityRadPerSecond, ob);
        V.set(ship.positionMeters, 0, 0, 0); V.set(ship.velocityMps, 0, 0, 0);
        ship.snapshot.previousPositionMeters.x = ship.snapshot.currentPositionMeters.x = 0;
        ship.snapshot.previousPositionMeters.y = ship.snapshot.currentPositionMeters.y = 0;
        ship.snapshot.previousPositionMeters.z = ship.snapshot.currentPositionMeters.z = 0;
        camFollowOri.x = ship.orientation.x; camFollowOri.y = ship.orientation.y;
        camFollowOri.z = ship.orientation.z; camFollowOri.w = ship.orientation.w;
        camPullbackM = 0; camLatLagM = 0; camPitchLagM = 0;
        const o = V.v3(); Q.qRotateVector(o, ship.orientation, Game.ChaseCamera.LOCAL_OFFSET);
        V.copy(camState.positionMeters, o); V.set(camState.velocityMps, 0, 0, 0);
      }
    };
    window.__bh = api;
    return api;
  }
  return { start, onFrame: null, onRebase: null };
})();

window.addEventListener("DOMContentLoaded", () => {
  const results = Game.SelfTest.run();
  const diagEl = document.getElementById("diag");
  const failCount = Game.SelfTest.renderTo(diagEl, results);
  const btn = document.getElementById("diagBtn");
  btn.textContent = failCount === 0 ? "\u2713 " + results.length + " checks" : "\u2717 " + failCount + " FAILED";
  btn.className = failCount === 0 ? "ok" : "bad";
  btn.addEventListener("click", () => { document.body.classList.toggle("diagOpen"); });
  if (failCount > 0) console.error("[FOUNDATION] failed:", results.filter((r) => !r.pass));
  else console.log("[FOUNDATION] all checks passed.");
  Game.Boot.start();
});
window.Game = Game;

// Mini orbit map (top-center). Tap to open the full map in the menu.
(function () {
  const btn = document.getElementById('miniMapBtn');
  if (!btn) return;
  const cv = btn.querySelector('canvas'), g = cv.getContext('2d');
  function draw() {
    const bh = window.__bh;
    if (!bh || !bh.arena || !bh.state || !Game.Sectors) return;
    const L = Game.Sectors.LIST, c = 38;
    let mn = Infinity, mx = 0;
    L.forEach(s => { mn = Math.min(mn, s.radiusRs); mx = Math.max(mx, s.radiusRs); });
    const rad = (s) => 5 + 31 * Math.log(s.radiusRs / mn) / Math.log(mx / mn);
    g.clearRect(0, 0, 76, 76);
    g.lineWidth = 1; g.strokeStyle = 'rgba(120,140,170,.4)';
    L.forEach(s => { g.beginPath(); g.arc(c, c, rad(s), 0, 6.2832); g.stroke(); });
    g.fillStyle = '#000'; g.strokeStyle = '#F4DDB0'; g.beginPath(); g.arc(c, c, 3.5, 0, 6.2832); g.fill(); g.stroke();
    const sel = bh.state.selectedSectorIdx;
    L.forEach((s, i) => {
      const a = i * 2.399963, r = rad(s);
      g.fillStyle = s.id === bh.arena.id ? '#9FB3C8' : (i === sel ? '#E8A857' : '#F4DDB0');
      g.beginPath(); g.arc(c + r * Math.cos(a), c + r * Math.sin(a), i === sel ? 3.5 : 2.5, 0, 6.2832); g.fill();
    });
  }
  setInterval(draw, 600); draw();
  btn.addEventListener('click', () => {
    document.getElementById('menuBtn').click();
    const t = document.querySelector('.tab-btn[data-tab="map"]');
    if (t) t.click();
  });
})();
