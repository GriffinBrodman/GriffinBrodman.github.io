/*!
 * Koi Pond — a hand-written WebGL pond.
 * Procedural koi (spine chain + travelling wave) swimming at living depths,
 * caustics, refraction ripples, lily pads. No libraries.
 * (c) 2026 Griffin Brodman
 */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;
  var TO_LIGHT = [-0.6, -0.8];           // screen-space direction toward the sun (y down)
  var SHADOW_DIR = [0.6, 0.8];

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function wrapAngle(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
  function rngFrom(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------------ */
  /* Shaders                                                             */
  /* ------------------------------------------------------------------ */

  var HEAD = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    '#define TAU 6.28318530718',
    'float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }',
    'vec2 hash2(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }',
    'float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f);',
    '  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y); }',
    'float fbm(vec2 p){ float s = 0.0; float a = 0.5; for (int i = 0; i < 4; i++){ s += a*vnoise(p); p = p*2.03 + vec2(17.1, 9.3); a *= 0.5; } return s; }',
    ''
  ].join('\n');

  var VS_QUAD = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main(){ vUv = vec2(aPos.x*0.5+0.5, 0.5-aPos.y*0.5); gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var VS_MESH = [
    'attribute vec2 aPos; attribute vec4 aA; attribute vec2 aB;',
    'uniform vec2 uView; uniform vec2 uOffset;',
    'varying vec4 vA; varying vec2 vB;',
    'void main(){ vec2 p = aPos + uOffset; vA = aA; vB = aB;',
    '  gl_Position = vec4(p.x/uView.x*2.0-1.0, 1.0-p.y/uView.y*2.0, 0.0, 1.0); }'
  ].join('\n');

  /* Static pond bed (baked once per resize): stones, silt, algae; depth in alpha. */
  var FS_BED = HEAD + [
    'uniform vec2 uView;',
    'varying vec2 vUv;',
    'const vec2 TO_L = vec2(-0.6, -0.8);',
    // irregular, domain-warped pebbles. returns (mask, shade, colour id, distance)
    'vec4 pebbles(vec2 p, float cell, float density, float seed){',
    '  vec2 g = p/cell; vec2 ip = floor(g); vec2 fp = fract(g);',
    '  vec4 best = vec4(0.0, 1.0, 0.0, 9.0);',
    '  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){',
    '    vec2 o = vec2(float(x), float(y)); vec2 id = ip + o + seed;',
    '    if (hash(id + 7.3) > density) continue;',
    '    vec2 h = hash2(id);',
    '    vec2 r = fp - (o + 0.2 + h*0.6);',
    '    float hr = hash(id + 3.1); float rad = 0.38*(0.5 + hr);',
    '    float an = h.x*6.2831; vec2 rr = mat2(cos(an), -sin(an), sin(an), cos(an)) * r; rr.x *= 0.68 + 0.55*h.y;',
    '    rr += 0.25*rad*(vec2(vnoise(rr*3.0/rad + id), vnoise(rr*3.0/rad + id + 4.7)) - 0.5);',
    '    float d = length(rr)/rad;',
    '    float m = 1.0 - smoothstep(0.84, 1.0, d);',
    '    if (d < best.w){',
    '      float lit = dot(normalize(r + 1e-4), TO_L) * smoothstep(0.3, 1.0, d);',
    '      float grain = 0.95 + 0.10*vnoise(rr*9.0/rad + id*3.0);',
    '      best = vec4(m*(0.6 + 0.4*hash(id + 9.2)), (0.97 + 0.04*lit) * grain * mix(0.88, 1.0, 1.0 - d*d*0.5), hash(id + 1.7), d);',
    '    }',
    '  }',
    '  return best;',
    '}',
    'vec3 pebbleCol(float h){',
    '  vec3 a = vec3(0.44, 0.41, 0.34); vec3 b = vec3(0.31, 0.31, 0.28); vec3 c = vec3(0.52, 0.45, 0.34); vec3 d = vec3(0.58, 0.56, 0.50);',
    '  return (h < 0.35 ? a : h < 0.65 ? b : h < 0.85 ? c : d) * (0.91 + 0.18*fract(h*7.13));',
    '}',
    'void main(){',
    '  vec2 p = vUv*uView;',
    '  float depth = clamp(0.25 + 0.9*(fbm(p/820.0 + vec2(3.1, 7.7)) - 0.25), 0.0, 1.0);',
    '  vec3 bed = mix(vec3(0.21, 0.22, 0.16), vec3(0.29, 0.29, 0.21), fbm(p/110.0 + 5.0));',
    '  bed *= 0.90 + 0.18*vnoise(p/5.0);',
    '  float gravel = smoothstep(0.30, 0.62, fbm(p/380.0 + vec2(9.0, 1.0)));',
    '  float stoneFade = 1.0 - smoothstep(0.45, 0.8, depth);',
    '  vec4 bo = pebbles(p, 190.0, 0.22, 80.0);',
    '  float skirt = smoothstep(2.0, 1.05, bo.w) * (1.0 - bo.x);',
    '  float cluster = smoothstep(0.45, 0.7, fbm(p/260.0 + 3.0));',
    '  vec4 sp = pebbles(p, 15.0, (0.31*gravel + 0.02 + 0.45*max(cluster*gravel, skirt))*stoneFade, 0.0);',
    '  float crev = smoothstep(1.5, 1.0, sp.w) * (1.0 - sp.x) * gravel;',
    '  bed *= 1.0 - 0.32*crev;',
    '  bed = mix(bed, pebbleCol(sp.z) * sp.y * 0.90, sp.x);',
    '  vec4 rk = pebbles(p, 72.0, 0.26*stoneFade + 0.04, 40.0);',
    '  bed *= 1.0 - 0.40*smoothstep(1.35, 1.0, rk.w) * (1.0 - rk.x);',
    '  bed = mix(bed, pebbleCol(rk.z) * rk.y * (0.92 + 0.12*vnoise(p/7.0)), rk.x);',
    '  bed *= 1.0 - 0.45*smoothstep(1.45, 1.0, bo.w) * (1.0 - bo.x);',
    '  vec3 boc = pebbleCol(bo.z) * bo.y * (0.88 + 0.16*fbm(p/18.0 + bo.z*9.0)) * mix(0.72, 1.0, smoothstep(1.0, 0.55, bo.w));',
    '  bed = mix(bed, boc, bo.x);',
    '  float alg = fbm(p/150.0 + 11.0);',
    '  bed = mix(bed, vec3(0.19, 0.29, 0.12), smoothstep(0.48, 0.78, alg)*(0.6 + 0.3*(1.0 - stoneFade)));',
    // sparse dark algae streaks, combed by a slow current
    '  vec2 sq = mat2(0.86, -0.5, 0.5, 0.86) * p;',
    '  float st = fbm(vec2(sq.x/26.0, sq.y/150.0) + 31.0) * smoothstep(0.45, 0.7, fbm(p/300.0 + 17.0));',
    '  bed = mix(bed, vec3(0.08, 0.13, 0.07), smoothstep(0.52, 0.66, st)*0.55);',
    '  gl_FragColor = vec4(bed, depth);',
    '}'
  ].join('\n');

  /* Living floor: dappled canopy light, drifting caustic patches, soft shadows. */
  var FS_FLOOR = HEAD + [
    'uniform vec2 uView; uniform float uTime;',
    'uniform sampler2D uShadow; uniform vec2 uShadowTexel; uniform sampler2D uBed; uniform float uLite;',
    'varying vec2 vUv;',
    'float vorEdge(vec2 p, float t){',
    '  vec2 ip = floor(p); vec2 fp = fract(p); float d1 = 8.0; float d2 = 8.0;',
    '  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){',
    '    vec2 o = vec2(float(x), float(y)); vec2 h = hash2(ip + o);',
    '    h = 0.5 + 0.42*sin(t*(0.6 + 0.4*h.yx) + TAU*h);',
    '    vec2 r = o + h - fp; float d = dot(r, r);',
    '    if (d < d1){ d2 = d1; d1 = d; } else if (d < d2){ d2 = d; }',
    '  }',
    '  return sqrt(d2) - sqrt(d1);',
    '}',
    'float caustic(vec2 p, float t){',
    '  vec2 w = p + 1.3*vec2(vnoise(p*0.42 + t*0.16), vnoise(p*0.42 - t*0.13 + 5.2)) - 0.65;',
    '  w += 0.35*vec2(vnoise(p*1.3 - t*0.2 + 2.0), vnoise(p*1.3 + t*0.18 + 9.0)) - 0.175;',
    '  float e = vorEdge(w, t);',
    '  float width = 40.0 + 40.0*vnoise(p*0.6 - t*0.05);',
    '  return exp(-e*e*width) * (0.45 + 0.55*vnoise(p*0.8 + t*0.1));',
    '}',
    'void main(){',
    '  vec2 p = vUv*uView;',
    '  vec2 tc = vec2(vUv.x, 1.0 - vUv.y);',
    '  vec4 bd = texture2D(uBed, tc); vec3 bed = bd.rgb; float depth = bd.a;',
    '  float sh = 0.0;',
    '  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) sh += texture2D(uShadow, tc + vec2(float(x), float(y))*uShadowTexel*1.3).a;',
    '  sh = min(1.0, sh / 9.0 * 1.1);',
    '  float canopy = mix(0.78, 1.0, smoothstep(0.32, 0.58, fbm(p/320.0 + vec2(uTime*0.012, -uTime*0.008))));',
    '  float light = canopy * (1.0 - 0.80*sh);',
    '  float patchy = smoothstep(0.3, 0.7, fbm(p/600.0 + uTime*0.01));',
    '  float cs = 1.0 + 0.2*uLite;',
    '  float c = caustic(p/(120.0*cs), uTime*0.5);',
    '  float c2 = caustic(mat2(0.8, -0.6, 0.6, 0.8) * p/(170.0*cs) + 7.0, uTime*0.38 + 3.0);',
    '  c = (c*0.75 + c2*0.5 + c*c2*0.9) * (0.35 + 0.65*patchy);',
    '  vec3 water = mix(vec3(0.13, 0.36, 0.30), vec3(0.025, 0.145, 0.16), depth);',
    '  vec3 col = mix(bed, water, 0.46 + 0.32*depth) * (0.50 + 0.65*light);',
    '  col += vec3(0.70, 0.97, 0.80) * c * light * (0.20 - 0.10*depth) * 1.5 * (1.0 - 0.2*uLite);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* Koi: body, tail, fins, barbels, eyes. Premultiplied output.
     uDepth: 0 = just under the surface, 0.85 = near the floor. */
  var FS_FISH = HEAD + [
    'uniform float uPart; uniform float uType; uniform float uSeed; uniform float uDepth; uniform float uTime;',
    'uniform float uLen; uniform float uSheen; uniform float uShadowMode; uniform float uShadowAlpha; uniform vec3 uWater;',
    'uniform float uSoft; uniform float uGulp;',
    'varying vec4 vA; varying vec2 vB;',
    'vec3 finTint(){',
    '  if (uType < 2.5) return vec3(0.97, 0.96, 0.93);',
    '  if (uType < 3.5) return vec3(1.0, 0.82, 0.36);',
    '  if (uType < 4.5) return vec3(0.95, 0.96, 0.94);',
    '  if (uType < 5.5) return vec3(1.0, 0.64, 0.28);',
    '  if (uType < 6.5) return vec3(0.95, 0.52, 0.28);',
    '  if (uType < 7.5) return vec3(0.98, 0.97, 0.94);',
    '  return vec3(0.74, 0.54, 0.34);',
    '}',
    // depth lowers contrast and saturation, and darkens
    'vec3 underwater(vec3 col){',
    '  float l = dot(col, vec3(0.3, 0.55, 0.15));',
    '  float k = (uType > 2.5 && uType < 5.5) ? 0.5 : 1.0;',
    '  col = mix(col, vec3(l), uDepth*0.2*k);',
    '  col = mix(col, uWater, (0.06 + 0.55*uDepth)*k);',
    '  return col * (1.0 - 0.32*uDepth);',
    '}',
    'vec4 outCol(vec3 col, float a){ a *= 1.0 - 0.28*uDepth; return vec4(underwater(col)*a, a); }',
    'float edgeA(float dpx){ return clamp(dpx/uSoft + 0.5, 0.0, 1.0); }',
    'float redField(float u, float v, float av, vec2 sd){',
    '  float n = fbm(vec2(u*4.4, v*1.25) + sd);',
    '  float headR = (1.0 - smoothstep(0.10, 0.26, u)) * 0.13;',
    '  float noseW = 1.0 - smoothstep(0.03, 0.08, u);',
    '  float tailW = smoothstep(0.74, 0.92, u);',
    '  return n + headR - 0.30*smoothstep(0.55, 0.85, av) - tailW*0.45 - noseW*0.5;',
    '}',
    'void body(){',
    '  float u = vA.x; float w = vA.z; float v = vA.y / w; float lit = vA.w;',
    '  float av = abs(v);',
    '  float a = edgeA((1.0 - av)*w);',
    '  if (uShadowMode > 0.5){ gl_FragColor = vec4(0.0, 0.0, 0.0, a*uShadowAlpha); return; }',
    '  float vv = min(av, 1.0); float nz = sqrt(max(0.0, 1.0 - vv*vv));',
    '  vec2 sd = vec2(uSeed*17.13, uSeed*7.71);',
    '  float n = fbm(vec2(u*4.4, v*1.25) + sd);',
    '  float m = redField(u, v, av, sd);',
    // kiwa (crisp rear edge) / sashi (soft front edge where white scales overlap the red)
    '  float mT = redField(u + 0.03, v, av, sd);',
    '  float soft = mix(0.006, 0.05, smoothstep(-0.015, 0.015, mT - m)) + uDepth*0.02;',
    '  float red = smoothstep(0.5 - soft, 0.5 + soft*0.4, m);',
    '  float tailW = smoothstep(0.74, 0.92, u);',
    '  float noseW = 1.0 - smoothstep(0.03, 0.08, u);',
    '  vec3 WHITE = vec3(0.975, 0.962, 0.93);',
    '  vec3 HI = mix(vec3(0.84, 0.17, 0.09), vec3(0.68, 0.08, 0.06), smoothstep(0.45, 0.8, n));',
    '  vec3 SUMI = vec3(0.05, 0.055, 0.065);',
    '  WHITE *= 0.965 + 0.05*fbm(vec2(u*9.0, v*3.0) + sd*3.0);\n  WHITE = mix(WHITE, vec3(0.98, 0.90, 0.86), (1.0 - smoothstep(0.02, 0.16, u))*0.35);\n  vec3 col = WHITE; float metal = 0.0; float net = 0.0;',
    '  float sz = uLen*0.043;',
    '  vec2 sg = vec2(u*uLen, v*w)/sz; sg.y += 0.5*mod(floor(sg.x), 2.0);',
    '  vec2 sf = fract(sg) - 0.5;',
    '  float sEdge = smoothstep(0.30, 0.5, length(sf*vec2(1.0, 0.9) + vec2(0.1, 0.0))) * smoothstep(0.18, 0.28, u);',
    '  if (uType < 0.5){ col = mix(WHITE, HI, red); }',
    '  else if (uType < 1.5){ col = mix(WHITE, HI, red);',
    '    float s = fbm(vec2(u*6.0, v*1.8) + sd*1.7 + 40.0) + 0.10*smoothstep(0.4, 0.9, av);',
    '    float sumi = smoothstep(0.60, 0.625, s + red*0.04) * smoothstep(0.22, 0.30, u) * (1.0 - tailW);',
    '    col = mix(col, SUMI, sumi); }',
    '  else if (uType < 2.5){',
    '    float b = fbm(vec2(u*3.2, v*1.4) + sd*2.3 + 70.0) - 0.12*smoothstep(0.45, 0.9, av);',
    '    float white = smoothstep(0.54, 0.565, b + noseW*0.3 + tailW*0.1) * (1.0 - red);',
    '    col = mix(SUMI, HI, red); col = mix(col, WHITE, white); }',
    '  else if (uType < 3.5){ col = mix(vec3(1.0, 0.84, 0.36), vec3(0.90, 0.60, 0.14), clamp(n*0.8 + av*0.4 - 0.25, 0.0, 1.0)); metal = 1.0; }',
    '  else if (uType < 4.5){ col = mix(vec3(0.96, 0.96, 0.93), vec3(0.74, 0.77, 0.77), av*0.85); metal = 1.0; }',
    '  else if (uType < 5.5){ col = mix(vec3(1.0, 0.60, 0.19), vec3(0.88, 0.36, 0.08), clamp(av*0.7 + n*0.4 - 0.2, 0.0, 1.0)); metal = 0.9; }',
    '  else if (uType < 6.5){',
    '    vec3 blue = mix(vec3(0.54, 0.63, 0.70), vec3(0.34, 0.44, 0.54), n);',
    '    col = mix(blue, vec3(0.78, 0.84, 0.87), sEdge*0.35);',
    '    float side = smoothstep(0.66, 0.88, av + (n - 0.5)*0.3);',
    '    col = mix(col, vec3(0.86, 0.38, 0.16), side);',
    '    col = mix(col, vec3(0.88, 0.90, 0.87), 1.0 - smoothstep(0.14, 0.2, u));',
    '    net = 1.0; }',
    '  else if (uType < 7.5){',
    '    float d = length(vec2((u - 0.11)*uLen, v*w*1.25)); float r = uLen*0.052;',
    '    col = mix(WHITE, vec3(0.74, 0.07, 0.06), clamp((r - d)/(1.0 + uDepth*3.0) + 0.5, 0.0, 1.0)); }',
    '  else { col = mix(vec3(0.70, 0.49, 0.29), vec3(0.47, 0.31, 0.17), n); col = mix(col, col*0.82, sEdge); metal = 0.35; net = 1.0; }',
    // subtle reticulation, no bright dots
    '  if (net < 0.5) col *= 1.0 - mix(0.05, 0.025, metal)*sEdge;',
    // gill plate
    '  float gill = 1.0 - smoothstep(0.0, 1.2, abs((u - 0.185 + 0.045*av*av)*uLen));',
    '  col *= 1.0 - 0.13*gill*smoothstep(0.15, 0.6, av);',
    // nostrils
    '  vec2 np = vec2((u - 0.05)*uLen, (av - 0.42)*w);',
    '  col *= 1.0 - 0.35*clamp(uLen*0.007 - length(np) + 0.5, 0.0, 1.0);',
    // mouth opening when gulping
    '  vec2 mp = vec2((u - 0.012)*uLen/0.7, v*w);',
    '  col = mix(col, vec3(0.05, 0.02, 0.02), uGulp*clamp(uLen*0.045 - length(mp) + 0.5, 0.0, 1.0));',
    // dorsal fin ridge
    '  float dd = abs(v - vB.x);',
    '  float dor = (1.0 - smoothstep(0.035, 0.085, dd)) * smoothstep(0.30, 0.36, u) * (1.0 - smoothstep(0.60, 0.71, u));',
    '  vec3 dcol = finTint(); if (uType > 1.5 && uType < 2.5) dcol = SUMI;',
    '  col = mix(col, col*0.62 + dcol*0.22, dor*0.5);',
    // lighting: rounded back, darker flanks, and one soft sheen band that slides as the body turns
    '  float dif = 0.70 + 0.30*nz + 0.11*v*lit;',
    '  col *= dif * mix(0.58, 1.0, nz);',
    '  float band = exp(-pow((u - 0.45 - 0.2*sin(uSheen))/0.12, 2.0)) * nz * nz * exp(-pow((v - 0.25*lit)/0.6, 2.0));',
    '  col += vec3(1.0, 0.98, 0.94) * band * mix(0.15, 0.45, metal);',
    '  float spec = exp(-pow((v - 0.3*lit)/0.3, 2.0));',
    '  col += vec3(1.0, 0.98, 0.94) * spec * (0.03 + 0.10*metal);',
    '  gl_FragColor = outCol(col, a);',
    '}',
    'void tail(){',
    '  float t = vA.x; float w = vA.z; float v = vA.y / w; float av = abs(v);',
    '  float a = edgeA((1.0 - av)*w);',
    '  float tEnd = 0.70 + 0.30*pow(min(av, 1.0), 0.8);',
    '  a *= edgeA((tEnd - t)*vB.y);',
    '  float rays = 0.5 + 0.5*cos(v*(5.0 + t*4.0)*3.14159);',
    '  float alpha = a * mix(0.88, 0.32, smoothstep(0.0, 0.95, t)) * (0.86 + 0.14*rays);',
    '  if (uShadowMode > 0.5){ gl_FragColor = vec4(0.0, 0.0, 0.0, alpha*uShadowAlpha*0.6); return; }',
    '  vec3 fc = finTint();',
    '  if (uType > 1.5 && uType < 2.5) fc = mix(fc, vec3(0.07), (1.0 - smoothstep(0.0, 0.45, t))*0.85);',
    '  vec3 col = fc * (0.82 + 0.18*rays);',
    '  col += vec3(0.12) * smoothstep(0.62, 0.95, av);',
    '  gl_FragColor = outCol(col, alpha);',
    '}',
    // fan-shaped fin: straight bony leading edge, convex trailing edge, rays from the root
    'void fin(){',
    '  float L = vA.z; float W = vB.x;',
    '  vec2 pp = vec2(vA.x*L, vA.y*vB.y*W);',
    '  float rho = length(pp); float th = atan(pp.y, max(pp.x, 0.001));',
    '  float TL = 0.50; float TT = -0.72;',
    '  float s = clamp((TL - th)/(TL - TT), 0.0, 1.0);',
    '  float R = L*(1.0 - 0.10*s - 0.12*s*s);',
    '  float dLead = (TL - th)*rho; float dTrail = (th - TT)*rho; float dOut = R - rho;',
    '  float a = edgeA(min(min(dLead, dTrail), dOut));',
    '  float rr = rho/L;',
    '  float rays = 0.5 + 0.5*cos((th - TT)*22.0);',
    '  float alpha = a * mix(0.78, 0.38, smoothstep(0.05, 1.0, rr)) * (0.9 + 0.1*rays);',
    '  float lead = clamp(1.8 - dLead, 0.0, 1.0) * smoothstep(0.08, 0.25, rr) * smoothstep(1.0, 0.8, rr);',
    '  float rim = clamp(1.0 - abs(dOut - 0.5), 0.0, 1.0);',
    '  alpha = max(alpha, a*lead*0.9); alpha = min(1.0, alpha + rim*a*0.18);',
    '  if (uShadowMode > 0.5){ gl_FragColor = vec4(0.0, 0.0, 0.0, alpha*uShadowAlpha*0.5); return; }',
    '  vec3 fc = finTint();',
    '  if (uType > 1.5 && uType < 2.5){ float root = 1.0 - smoothstep(0.2, 0.6, rr); fc = mix(fc, vec3(0.05), root*0.95); alpha = mix(alpha, a*0.92, root*0.7); }',
    '  vec3 col = fc*(0.9 + 0.1*rays);',
    '  col = mix(col, vec3(0.99, 0.96, 0.87), lead*0.8) + vec3(0.12)*rim;',
    '  gl_FragColor = outCol(col, alpha);',
    '}',
    // barbel: a short, tapered fleshy stroke
    'void barbel(){',
    '  float x = vA.x; float W = vB.x;',
    '  float hw = 0.7*(1.0 - 0.75*x);',
    '  float a = clamp(hw - abs(vA.y)*W + 0.5, 0.0, 1.0) * clamp((1.0 - x)*vA.z + 0.5, 0.0, 1.0) * clamp(x*vA.z + 0.5, 0.0, 1.0);',
    '  if (uShadowMode > 0.5){ gl_FragColor = vec4(0.0); return; }',
    '  gl_FragColor = outCol(vec3(0.93, 0.80, 0.70), a*0.7);',
    '}',
    // eye: dark dome bulging just beyond the outline, gold rim, a tiny highlight
    'void eye(){',
    '  vec2 q = vA.xy; float r = length(q); float px = vA.z;',
    '  float a = clamp((1.0 - r)*px + 0.5, 0.0, 1.0);',
    '  if (uShadowMode > 0.5){ gl_FragColor = vec4(0.0); return; }',
    '  vec3 col = mix(vec3(0.03, 0.03, 0.035), vec3(0.55, 0.42, 0.22), smoothstep(0.55, 0.95, r));',
    '  col += vec3(0.9) * clamp((0.22 - length(q - vec2(-0.3, -0.35)))*px + 0.5, 0.0, 1.0) * 0.7;',
    '  gl_FragColor = outCol(col, a);',
    '}',
    'void main(){',
    '  float part = uPart > 1.5 ? vA.w : uPart;',
    '  if (part < 0.5) body(); else if (part < 1.5) tail(); else if (part < 2.5) fin(); else if (part < 3.5) barbel(); else eye();',
    '}'
  ].join('\n');

  /* Surface objects: lily pads, water lilies, petals, food pellets, droplets. Premultiplied. */
  var FS_PAD = HEAD + [
    'uniform float uKind; uniform float uSeed; uniform float uPx; uniform float uShadowMode; uniform float uShadowAlpha; uniform vec3 uTint;',
    'varying vec4 vA; varying vec2 vB;',
    'float petalD(float r, float ang, float k, float R, float off, float pw, out float rib){',
    '  float sector = TAU / k;',
    '  float s = mod(ang + off + sector*0.5, sector) - sector*0.5;',
    '  vec2 lp = vec2(cos(s), sin(s)) * r;',
    '  float cx = R*0.52; float ax = R*0.48;',
    '  float tx = (lp.x - cx)/ax;',
    '  float hw = pw * R * pow(max(0.0, 1.0 - tx*tx), 0.62);',
    '  rib = 1.0 - abs(lp.y)/max(hw, 1e-3);',
    '  return min(hw - abs(lp.y), (1.0 - abs(tx))*ax*0.6);',
    '}',
    'void main(){',
    '  vec2 q = vA.xy; float r = length(q); float ang = atan(q.y, q.x);',
    '  if (uKind < 0.5){',
    '    float edgeR = 0.95 + 0.020*sin(ang*5.0 + uSeed*10.0) + 0.011*sin(ang*11.0 + uSeed*4.0);',
    '    float notch = abs(ang) - 0.17*(0.3 + 0.7*smoothstep(0.0, 0.6, r));',
    '    float d = min((edgeR - r)*uPx, notch*r*uPx);',
    '    float a = clamp(d + 0.5, 0.0, 1.0);',
    '    if (uShadowMode > 0.5){ gl_FragColor = vec4(0.0, 0.0, 0.0, a*uShadowAlpha); return; }',
    '    float halo = (1.0 - a) * exp(-max(0.0, -d)/(uPx*0.045)) * 0.30;',
    '    float nn = fbm(q*2.4 + uSeed*9.0);',
    '    vec3 col = mix(vec3(0.15, 0.33, 0.12), vec3(0.32, 0.51, 0.18), nn);',
    '    float vein = pow(abs(cos((ang + 0.035*sin(r*9.0 + uSeed))*9.0)), 50.0) * smoothstep(0.06, 0.3, r) * (1.0 - smoothstep(0.82, 0.94, r));',
    '    col = mix(col, vec3(0.46, 0.63, 0.28), vein*0.32);',
    '    col *= 0.80 + 0.20*smoothstep(0.0, 0.55, r);',
    '    float rim = smoothstep(edgeR - 0.13, edgeR - 0.015, r);',
    '    col = mix(col, mix(vec3(0.52, 0.64, 0.30), vec3(0.58, 0.25, 0.20), uTint.x), rim*0.6);',
    '    float spot = smoothstep(0.64, 0.70, fbm(q*3.6 + uSeed*3.0 + 9.0)) * uTint.y;',
    '    col = mix(col, vec3(0.58, 0.50, 0.24), spot*0.65);',
    '    vec2 hl = q - vec2(-0.30, -0.36);',
    '    col += vec3(0.92, 1.0, 0.90) * exp(-dot(hl, hl)*4.5) * 0.11;',
    '    float drop = 0.0;',
    '    for (int i = 0; i < 3; i++){ vec2 dp = (hash2(vec2(uSeed*13.0 + float(i), 2.0)) - 0.5)*1.1; float dr = length(q - dp)*uPx; float rs = 1.6 + 1.2*hash(dp);',
    '      drop += clamp(rs - dr + 0.5, 0.0, 1.0) * (0.6 + 0.4*smoothstep(rs, 0.0, length(q - dp - vec2(-0.25, -0.3)*rs/uPx)*uPx)); }',
    '    col = mix(col, vec3(0.86, 0.96, 0.88), clamp(drop, 0.0, 1.0)*0.55*step(0.4, uTint.z));',
    '    gl_FragColor = vec4(col*a, a + halo*(1.0 - a));',
    '  } else if (uKind < 1.5){',
    '    float rib; float a; vec3 col = vec3(0.0); float alpha = 0.0;',
    '    vec3 pinkTip = mix(vec3(0.97, 0.90, 0.92), vec3(0.93, 0.48, 0.64), uTint.z);',
    '    vec3 pinkBase = mix(vec3(1.0, 0.99, 0.97), vec3(0.99, 0.86, 0.90), uTint.z);',
    '    float halo = exp(-max(0.0, r - 0.86)/0.06) * 0.25 * smoothstep(1.15, 0.9, r);',
    '    float d = petalD(r, ang, 8.0, 1.0, 0.0, 0.22, rib); a = clamp(d*uPx + 0.5, 0.0, 1.0);',
    '    if (uShadowMode > 0.5){ gl_FragColor = vec4(0.0, 0.0, 0.0, a*uShadowAlpha); return; }',
    '    vec3 pc = mix(pinkBase, pinkTip, smoothstep(0.25, 1.0, r))*(0.80 + 0.20*rib);',
    '    col = pc*a; alpha = a;',
    '    float d2 = petalD(r, ang, 8.0, 0.80, TAU/16.0, 0.25, rib); float a2 = clamp(d2*uPx + 0.5, 0.0, 1.0);',
    '    col *= 1.0 - 0.32*smoothstep(-0.10, 0.0, d2)*(1.0 - a2);',
    '    pc = mix(pinkBase, pinkTip, smoothstep(0.3, 0.95, r/0.8)*0.85)*(0.84 + 0.18*rib);',
    '    col = mix(col, pc, a2); alpha = max(alpha, a2);',
    '    float d3 = petalD(r, ang, 6.0, 0.58, 0.3, 0.30, rib); float a3 = clamp(d3*uPx + 0.5, 0.0, 1.0);',
    '    col *= 1.0 - 0.30*smoothstep(-0.08, 0.0, d3)*(1.0 - a3);',
    '    pc = mix(vec3(1.0, 0.99, 0.95), pinkTip, smoothstep(0.3, 1.0, r/0.58)*0.6)*(0.88 + 0.14*rib);',
    '    col = mix(col, pc, a3); alpha = max(alpha, a3);',
    '    float cd = clamp((0.20 - r)*uPx + 0.5, 0.0, 1.0);',
    '    vec3 cc = mix(vec3(1.0, 0.80, 0.28), vec3(0.95, 0.56, 0.12), smoothstep(0.0, 0.2, r)) * (0.85 + 0.25*vnoise(q*60.0));',
    '    col = mix(col, cc, cd); alpha = max(alpha, cd);',
    '    gl_FragColor = vec4(col, alpha + halo*(1.0 - alpha));',
    '  } else if (uKind < 2.5){',
    '    float e = length(vec2(q.x/0.95, q.y/0.62));',
    '    float d = (1.0 - e)*0.6;',
    '    float nd = (abs(q.y)*0.9 - (q.x - 0.66))*0.7;',
    '    d = min(d, max(nd, 0.66 - q.x));',
    '    float a = clamp(d*uPx + 0.5, 0.0, 1.0);',
    '    if (uShadowMode > 0.5){ gl_FragColor = vec4(0.0, 0.0, 0.0, a*uShadowAlpha); return; }',
    '    vec3 col = mix(vec3(0.97, 0.72, 0.80), vec3(1.0, 0.93, 0.95), smoothstep(-0.9, 0.4, q.x));',
    '    col *= 0.94 + 0.06*cos(q.y*14.0);',
    '    a *= 0.80;',
    '    gl_FragColor = vec4(col*a, a);',
    '  } else if (uKind < 3.5){',
    // glossy food pellet with a thin meniscus ring
    '    float a = clamp((1.0 - r)*uPx + 0.5, 0.0, 1.0);',
    '    if (uShadowMode > 0.5){ gl_FragColor = vec4(0.0, 0.0, 0.0, a*uShadowAlpha); return; }',
    '    float ring = clamp(1.0 - abs(r - 1.2)*uPx*0.6, 0.0, 1.0) * 0.18;',
    '    vec3 col = mix(vec3(0.60, 0.38, 0.17), vec3(0.30, 0.17, 0.07), smoothstep(0.1, 1.0, r));',
    '    vec2 hq = q - vec2(-0.35, -0.38);',
    '    col += vec3(1.0, 0.95, 0.85) * clamp((0.28 - length(hq))*uPx + 0.5, 0.0, 1.0) * 0.8;',
    '    gl_FragColor = vec4(col*a, a + ring*(1.0 - a));',
    '  } else {',
    // droplet glint
    '    float a = min(1.0, exp(-r*r*4.0) * uTint.x * 2.0);',
    '    if (uShadowMode > 0.5){ gl_FragColor = vec4(0.0); return; }',
    '    gl_FragColor = vec4(vec3(1.0, 0.99, 0.95)*a, a);',
    '  }',
    '}'
  ].join('\n');

  /* Water surface: ripple refraction, wind waves, sky reflection, sun glints, vignette. */
  var MAX_RIP = 24;
  var FS_COMP = HEAD + [
    'uniform sampler2D uFloor; uniform sampler2D uFish; uniform vec2 uView; uniform float uTime;',
    'uniform vec4 uRip[' + MAX_RIP + ']; uniform float uRipN; uniform float uLite;',
    'varying vec2 vUv;',
    'void main(){',
    '  vec2 p = vUv*uView;',
    '  vec2 g = vec2(0.0); float crest = 0.0;',
    '  for (int i = 0; i < ' + MAX_RIP + '; i++){',
    '    if (float(i) >= uRipN) break;',
    '    vec4 R = uRip[i];',
    '    vec2 d = p - R.xy; float r = length(d) + 0.001;',
    '    float age = R.z;',
    '    float front = age*105.0 + 4.0;',
    '    float width = 12.0 + age*24.0;',
    '    float x = r - front;',
    '    float env = R.w * exp(-age*0.95) * exp(-(x*x)/(width*width)) / (1.0 + r*0.010);',
    '    env *= smoothstep(0.0, 0.12, age);',
    '    float k = 0.30 / (1.0 + age*0.30);',
    '    float ph = x*k;',
    '    g += (d / r) * env * cos(ph) * k * 6.0;',
    '    crest += env * sin(ph);',
    '  }',
    '  float t = uTime;',
    '  vec2 ga = vec2(sin(p.y*0.019 + t*0.80 + sin(p.x*0.012 + t*0.35)*1.6), sin(p.x*0.016 - t*0.65 + sin(p.y*0.010 - t*0.45)*1.6)) * 0.030;',
    '  ga += vec2(sin((p.x + p.y)*0.047 + t*1.5), sin((p.x - p.y)*0.052 - t*1.25)) * 0.012;',
    '  vec2 G = g + ga;',
    '  vec2 off = G * 22.0;',
    '  vec2 tcF = (p + off) / uView; tcF.y = 1.0 - tcF.y;',
    '  vec2 tcK = (p + off*0.6) / uView; tcK.y = 1.0 - tcK.y;',
    '  vec3 col = texture2D(uFloor, tcF).rgb;',
    '  vec4 fish = texture2D(uFish, tcK);',
    '  col = col*(1.0 - fish.a) + fish.rgb;',
    '  col *= 1.0 + crest*0.30 + dot(g, vec2(-0.6, -0.8))*0.35;',
    // slow sky / foliage reflection, distorted by the surface normal
    '  if (uLite < 0.5){',
    '    float refl = fbm(p/500.0 + G*8.0 + t*0.01);',
    '    col = mix(col, vec3(0.80, 0.88, 0.84), 0.08*smoothstep(0.55, 0.85, refl));',
    '  }',
    // one soft sun-glint zone near the top right, with sparkles following the wind normals
    '  vec2 zc = (p - vec2(uView.x*0.80, uView.y*0.14)) / max(uView.x, uView.y);',
    '  float zone = exp(-dot(zc, zc)*9.0);',
    '  vec2 mid = vec2(sin(p.x*0.07 + t*1.7 + sin(p.y*0.05)), sin(p.y*0.075 - t*1.5 + sin(p.x*0.06))) * 0.02;',
    '  vec2 Gs = g*1.4 + ga*0.6 + mid;',
    '  vec2 cellp = floor(p/5.0);',
    '  float pt = smoothstep(1.4, 0.4, length(p - (cellp + 0.2 + 0.6*hash2(cellp*1.7))*5.0));',
    '  float twinkle = step(0.72, hash(cellp + floor(t*6.0)));',
    '  float spark = pow(max(0.0, 1.0 - length(Gs - vec2(0.03, 0.04))*20.0), 14.0) * pt * twinkle * 3.0;',
    '  col += vec3(1.0, 0.98, 0.90) * (zone*0.09 + spark*(0.9*zone + 0.45*min(1.0, length(g)*8.0)));',
    '  vec2 vc = vUv - 0.5; float vig = 1.0 - dot(vc*vec2(1.1, 1.0), vc*vec2(1.1, 1.0))*0.40;',
    '  col *= vig;',
    '  col += (hash(p + fract(t)*91.0) - 0.5)/255.0;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ------------------------------------------------------------------ */
  /* Koi model                                                           */
  /* ------------------------------------------------------------------ */

  var NB = 12;               // body joints
  var NT = 5;                // tail joints
  var NJ = NB + NT;          // total joints
  var BODY_SAMPLES = 36;
  var TAIL_SAMPLES = 12;
  var VERT_FLOATS = 8;
  var DETAIL_QUADS = 10;     // 2 pelvic + 2 pectoral fins, 4 barbels, 2 eyes
  var FISH_VERTS = BODY_SAMPLES * 2 + TAIL_SAMPLES * 2 + DETAIL_QUADS * 6;
  var MAX_FISH = 14;
  var TYPE_ORDER = [0, 3, 2, 1, 4, 7, 6, 0, 5, 1, 8, 0, 2, 3];
  var BUTTERFLY = { 4: true, 9: true };   // long-finned individuals by index

  // half-width profile along the body (u: 0 nose .. 1 caudal peduncle), 1 = widest
  function bodyHalfWidth(u) {
    if (u < 0.06) { var q = (0.06 - u) / 0.06; return 0.70 * Math.pow(Math.max(0, 1 - Math.pow(q, 1.8)), 1 / 1.8); }  // rounded nose
    if (u < 0.32) { var h = (u - 0.06) / 0.26; return 0.70 + 0.30 * (1 - (1 - h) * (1 - h)); }                          // head taper
    var s = (u - 0.32) / 0.68;
    return 0.30 + 0.70 * Math.pow(0.5 + 0.5 * Math.cos(Math.PI * s), 0.8);
  }

  function Koi(rng, index, L, W, H) {
    this.id = index;
    this.butterfly = !!BUTTERFLY[index];
    this.L = L * (0.82 + rng() * 0.36);
    this.Lt = this.L * (this.butterfly ? 0.55 : 0.36);
    this.hw = 0.165 * (0.93 + rng() * 0.14);
    this.type = TYPE_ORDER[index % TYPE_ORDER.length];
    this.seed = rng() * 10;
    this.depth = 0.05 + rng() * 0.75;
    this.depthT = this.depth;
    this.depthTimer = 4 + rng() * 14;
    this.x = W * (0.12 + rng() * 0.76);
    this.y = H * (0.12 + rng() * 0.76);
    this.a = rng() * TAU;
    this.cruise = this.L * (0.36 + rng() * 0.2);
    this.v = this.cruise;
    this.target = this.cruise;
    this.turn = 0;
    this.phase = rng() * TAU;
    this.amp = this.L * 0.05;
    this.thrust = 0.6;
    this.mode = 'swim';
    this.stateT = 1 + rng() * 8;
    this.wf = 0.7 + rng() * 0.6;
    this.fear = 0; this.fx = 0; this.fy = 0;
    this.sheen = rng() * TAU;
    this.finPhase = rng() * TAU;
    this.finOpen = 0.4;
    this.react = 0.15 + rng() * 0.6;
    this.sated = 0; this.gulp = 0; this.feeding = null;
    this.J = new Float32Array(NJ * 2);
    this.P = new Float32Array(NJ * 2);
    this.tailAng = new Float32Array(NJ);
    this.segB = this.L / (NB - 1);
    this.segT = this.Lt / NT;
  }

  /* ------------------------------------------------------------------ */
  /* GL helpers                                                          */
  /* ------------------------------------------------------------------ */

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader compile failed: ' + gl.getShaderInfoLog(s));
    return s;
  }
  function program(gl, vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.bindAttribLocation(p, 1, 'aA');
    gl.bindAttribLocation(p, 2, 'aB');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link failed: ' + gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var info = gl.getActiveUniform(p, i);
      u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
    }
    return { p: p, u: u };
  }
  function target(gl, w, h) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex: tex, fb: fb, w: w, h: h };
  }

  /* ------------------------------------------------------------------ */
  /* Pond                                                                */
  /* ------------------------------------------------------------------ */

  function mount(canvas, opts) {
    opts = opts || {};
    var gl = null;
    try {
      gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' }) ||
           canvas.getContext('experimental-webgl');
    } catch (e) { gl = null; }
    if (!gl) { if (opts.onFail) opts.onFail('no-webgl'); return null; }

    var progs, quadBuf, meshBuf, padBuf, meshCap = 0, padCap = 0;
    function initGL() {
      progs = {
        bed: program(gl, VS_QUAD, FS_BED),
        floor: program(gl, VS_QUAD, FS_FLOOR),
        fish: program(gl, VS_MESH, FS_FISH),
        pad: program(gl, VS_MESH, FS_PAD),
        comp: program(gl, VS_QUAD, FS_COMP)
      };
      quadBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      meshBuf = gl.createBuffer(); padBuf = gl.createBuffer();
      meshCap = 0; padCap = 0;
      tShadow = tFloor = tFish = tBed = null;
    }

    var seed = opts.seed || 20140212;
    var rng = rngFrom(seed);            // world layout
    var srand = rngFrom(seed ^ 0x5bd1e995); // simulation: deterministic for step()
    var W = 0, H = 0, pr = 1, quality = 1, goodWindows = 0;
    var tShadow = null, tFloor = null, tFish = null, tBed = null, bedDirty = true;
    var fish = [], pads = [], petals = [], pellets = [], ripples = [], drops = [];
    var meshData = new Float32Array(MAX_FISH * FISH_VERTS * VERT_FLOATS), padData = new Float32Array(256 * VERT_FLOATS);
    var time = 0, running = false, raf = 0, lastNow = 0;
    var visible = !document.hidden, inView = true, lost = false;
    var reduced = !!opts.reducedMotion;
    var kissTimer = 3 + rng() * 4;
    var frameTimes = [], adaptive = opts.adaptive !== false;
    var ripUniform = new Float32Array(MAX_RIP * 4);
    var waterTint = [0.06, 0.27, 0.27];
    var prefer = null;

    try { initGL(); } catch (err) {
      if (global.console) console.warn('[koi pond]', err.message);
      if (opts.onFail) opts.onFail('shader');
      return null;
    }

    /* ----- world ----- */
    function populate() {
      var area = W * H;
      var n = clamp(Math.round(area / 125000), 5, 11);
      if (opts.maxKoi) n = Math.min(n, opts.maxKoi);
      var L = clamp(Math.min(W, H) * 0.19, 92, 172);
      if (W < 560) L = clamp(W * 0.27, 88, 120);
      fish = [];
      for (var i = 0; i < n; i++) fish.push(new Koi(rng, i, L, W, H));
      if (prefer) fish.forEach(function (f, k) {
        if (k % 3 !== 2) { f.x = prefer.x0 + (prefer.x1 - prefer.x0) * (0.1 + rng() * 0.8); f.y = prefer.y0 + (prefer.y1 - prefer.y0) * (0.1 + rng() * 0.8); }
      });
      for (var k = 0; k < 40; k++) separateStart();

      pads = [];
      var padN = W < 560 ? 2 : W < 1000 ? 4 : 6;
      var tries = 0;
      while (pads.length < padN && tries++ < 400) {
        var r = (W < 560 ? 34 : 46) + rng() * (W < 560 ? 26 : 44);
        var p = { x: rng() * W, y: rng() * H, r: r, rot: rng() * TAU, vr: (rng() - 0.5) * 0.04,
                  vx: (rng() - 0.5) * 5, vy: (rng() - 0.5) * 4, seed: rng() * 10,
                  tint: [rng() < 0.4 ? 0.7 : 0.1, rng() < 0.5 ? 1 : 0, rng()], flower: null };
        var ok = true;
        for (var j = 0; j < pads.length; j++) {
          var dx = pads[j].x - p.x, dy = pads[j].y - p.y;
          if (Math.sqrt(dx * dx + dy * dy) < (pads[j].r + p.r) * 1.25) { ok = false; break; }
        }
        if (ok) pads.push(p);
      }
      var base = pads.length;
      for (var c = 0; c < Math.min(W < 560 ? 1 : 2, base); c++) {
        var host = pads[c];
        var ang = rng() * TAU, rr = host.r * (0.5 + rng() * 0.2);
        var ch = { x: host.x + Math.cos(ang) * (host.r + rr) * 1.02, y: host.y + Math.sin(ang) * (host.r + rr) * 1.02,
                   r: rr, rot: rng() * TAU, vr: host.vr, vx: host.vx, vy: host.vy, seed: rng() * 10,
                   tint: [rng() < 0.5 ? 0.7 : 0.1, 0, rng()], flower: null, follow: host };
        ch.ox = ch.x - host.x; ch.oy = ch.y - host.y;
        pads.push(ch);
      }
      for (var f = 0; f < pads.length && f < (W < 560 ? 1 : 2); f++) {
        pads[f].flower = { r: pads[f].r * 0.46, pink: f === 0 ? 0.85 : 0.25, ox: -pads[f].r * 0.18, oy: -pads[f].r * 0.1, rot: rng() * TAU };
      }
      petals = [];
      var petalN = W < 560 ? 2 : 4;
      for (var q = 0; q < petalN; q++) {
        petals.push({ x: rng() * W, y: rng() * H, s: 9 + rng() * 3, rot: rng() * TAU, vr: (rng() - 0.5) * 0.3,
                      vx: 4 + rng() * 5, vy: 1 + (rng() - 0.3) * 4, seed: rng() * 10 });
      }
      pellets = []; drops = [];
    }

    function separateStart() {
      for (var i = 0; i < fish.length; i++) for (var j = i + 1; j < fish.length; j++) {
        var a = fish[i], b = fish[j];
        var dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, m = (a.L + b.L) * 0.8;
        if (d < m) { var k = (m - d) * 0.5 / d; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; }
      }
      for (var n = 0; n < fish.length; n++) {
        var f = fish[n], mg = f.L * 0.8;
        f.x = clamp(f.x, mg, W - mg); f.y = clamp(f.y, mg, H - mg);
        resetChain(f);
      }
    }
    function resetChain(f) {
      var ca = Math.cos(f.a), sa = Math.sin(f.a), d = 0;
      for (var i = 0; i < NJ; i++) {
        f.J[i * 2] = f.x - ca * d; f.J[i * 2 + 1] = f.y - sa * d; f.tailAng[i] = f.a + Math.PI;
        d += i < NB - 1 ? f.segB : f.segT;
      }
    }

    /* ----- simulation ----- */
    function canHover(f) {
      for (var i = 0; i < pads.length; i++) {
        var p = pads[i], dx = f.x - p.x, dy = f.y - p.y;
        if (dx * dx + dy * dy < (p.r + f.L * 0.6) * (p.r + f.L * 0.6)) return false;
      }
      if (prefer && (f.x < prefer.x0 + 60 + f.L * 0.5 || f.y > prefer.y1 - 60)) return false;
      return true;
    }
    function nextState(f) {
      var r = srand();
      if (f.mode !== 'hover' && r < 0.15 && canHover(f)) {
        f.mode = 'hover'; f.stateT = 2 + srand() * 3; f.target = f.cruise * 0.08;
      } else if (f.mode === 'swim' && r < 0.75) {
        f.mode = 'glide'; f.stateT = 1.4 + srand() * 2.6; f.target = f.cruise * 0.4;
      } else {
        f.mode = 'swim'; f.stateT = 2.5 + srand() * 7; f.target = f.cruise * (0.7 + srand() * 0.6);
      }
    }

    function updateFish(f, dt) {
      var ca = Math.cos(f.a), sa = Math.sin(f.a);
      var maxTurn = (f.mode === 'hover' ? 0.5 : 1.05) + f.fear * 2.4;
      var wander = Math.sin(time * 0.23 * f.wf + f.seed * 10) * 0.75 + Math.sin(time * 0.071 * f.wf + f.seed * 31) * 0.55;
      var desiredTurn = wander * (f.mode === 'hover' ? 0.12 : 0.30);
      var fx = 0, fy = 0;

      // edges: look ahead and steer back well before the edge
      var look = f.L * 1.9, m = f.L * 0.85;
      var lx = f.x + ca * look, ly = f.y + sa * look;
      var bw = 0;
      if (lx < m) { fx += (m - lx) / m; bw++; }
      if (lx > W - m) { fx -= (lx - (W - m)) / m; bw++; }
      if (ly < m) { fy += (m - ly) / m; bw++; }
      if (ly > H - m) { fy -= (ly - (H - m)) / m; bw++; }
      fx *= 2.6; fy *= 2.6;

      // neighbours: separation (weaker across depth layers), very loose alignment and cohesion
      var ax = 0, ay = 0, cx = 0, cy = 0, nc = 0, chimera = 0;
      for (var i = 0; i < fish.length; i++) {
        var o = fish[i]; if (o === f) continue;
        var dx = f.x - o.x, dy = f.y - o.y, d2 = dx * dx + dy * dy;
        var both = f.feeding && o.feeding;
        var R = (f.L + o.L) * (both ? 0.55 : f.feeding ? 0.45 : 0.6);
        if (d2 < R * R && d2 > 0.01) {
          var d = Math.sqrt(d2), w = (1 - d / R); w *= w;
          var layer = both ? 1 : Math.abs(f.depth - o.depth) > 0.25 ? 0.55 : 1;
          fx += dx / d * w * 1.7 * layer; fy += dy / d * w * 1.7 * layer;
        }
        // body capsule: never push a head through another koi's body at the same depth
        if (both || Math.abs(f.depth - o.depth) < 0.25) {
          var cap = o.L * 0.35;
          for (var jj = 2; jj <= 8; jj++) {
            var jx = f.x - o.J[jj * 2], jy = f.y - o.J[jj * 2 + 1];
            if (jx * jx + jy * jy < cap * cap) {
              var sx = o.J[(jj - 1) * 2] - o.J[(jj + 1) * 2], sy = o.J[(jj - 1) * 2 + 1] - o.J[(jj + 1) * 2 + 1];
              var sl = Math.sqrt(sx * sx + sy * sy) || 1; sx /= sl; sy /= sl;
              var along = jx * sx + jy * sy, px1 = jx - sx * along, py1 = jy - sy * along;
              var pl = Math.sqrt(px1 * px1 + py1 * py1) || 1;
              fx += px1 / pl * 2.0; fy += py1 / pl * 2.0;
              break;
            }
          }
        }
        // a deep koi aligned under a shallow one reads as one fish with two heads: the shallower veers off
        if (f.depth < o.depth && d2 < f.L * f.L * 0.36 && Math.abs(wrapAngle(f.a - o.a)) < 0.5) {
          var cr = Math.cos(f.a) * dy - Math.sin(f.a) * dx;
          chimera = cr >= 0 ? 0.6 : -0.6;
        }
        var NR = f.L * 3.2;
        if (d2 < NR * NR) { ax += Math.cos(o.a); ay += Math.sin(o.a); cx += o.x; cy += o.y; nc++; }
      }
      if (nc) {
        fx += ax / nc * 0.05; fy += ay / nc * 0.05;
        var tx = cx / nc - f.x, ty = cy / nc - f.y, tl = Math.sqrt(tx * tx + ty * ty) || 1;
        fx += tx / tl * 0.04; fy += ty / tl * 0.04;
      }

      // soft preference for water that is visible (not under the content)
      if (prefer) {
        var ox = f.x < prefer.x0 ? prefer.x0 - f.x : f.x > prefer.x1 ? prefer.x1 - f.x : 0;
        var oy = f.y < prefer.y0 ? prefer.y0 - f.y : f.y > prefer.y1 ? prefer.y1 - f.y : 0;
        fx += clamp(ox / (W * 0.35), -0.3, 0.3); fy += clamp(oy / (H * 0.35), -0.3, 0.3);
      }

      // food (assigned in updateWorld; at most four koi converge)
      var food = f.feeding, fd = 0;
      if (food) {
        var hx = food.x - f.x, hy = food.y - f.y; fd = Math.sqrt(hx * hx + hy * hy) || 1;
        if (fd > f.L * 0.6) {   // aim beside the pellet so feeders arrive from different angles
          var sideK = (f.id % 2 ? 1 : -1) * f.L * 0.4 * Math.min(1, (fd - f.L * 0.6) / f.L);
          var px0 = -hy / fd, py0 = hx / fd;
          hx += px0 * sideK; hy += py0 * sideK;
        }
        var hl = Math.sqrt(hx * hx + hy * hy) || 1;
        fx += hx / hl * 2.2; fy += hy / hl * 2.2;
        f.depthT = [0.0, 0.08, 0.16, 0.24][f.feedRank || 0];
        if (fd < f.L * 0.24) {
          food.gone = true;
          f.gulp = 0.3; f.sated = 1.4 + srand() * 1.2; f.feeding = null;
          addRipple(food.x, food.y, 0.5);
          addRipple(food.x, food.y, 0.9); ripples[ripples.length - 1].t0 = time - 0.05;  // brief bright bulge
          for (var dI = 0; dI < 3; dI++) {
            var da0 = srand() * TAU;
            drops.push({ x: food.x, y: food.y, vx: Math.cos(da0) * (14 + srand() * 18), vy: Math.sin(da0) * (14 + srand() * 18), life: 0.55 });
          }
          f.v *= 0.5; f.turn += (srand() < 0.5 ? -1 : 1) * 0.8;
        }
      }
      if (f.sated > 0) f.sated -= dt;
      if (f.gulp > 0) f.gulp = Math.max(0, f.gulp - dt);

      // fear
      if (f.fear > 0.01) {
        var ex = f.x - f.fx, ey = f.y - f.fy, el = Math.sqrt(ex * ex + ey * ey) || 1;
        fx += ex / el * 3.5 * f.fear; fy += ey / el * 3.5 * f.fear;
        f.fear = Math.max(0, f.fear - dt * 0.55);
        f.depthT = Math.min(0.85, f.depthT + dt * 0.5);   // startled koi dive
      }

      desiredTurn += chimera;
      if (food) maxTurn = Math.max(maxTurn, fd < f.L * 1.2 ? 3.0 : 2.2);
      var fm = Math.sqrt(fx * fx + fy * fy);
      if (fm > 0.015) {
        var dA = wrapAngle(Math.atan2(fy, fx) - f.a);
        desiredTurn += clamp(dA * 1.7, -1, 1) * Math.min(1, fm) * maxTurn * (bw ? 1.35 : 1);
      }
      var tl2 = maxTurn * (bw ? 1.3 : 1);
      desiredTurn = clamp(desiredTurn, -tl2, tl2);
      f.turn += (desiredTurn - f.turn) * Math.min(1, dt * (f.fear > 0.2 ? 6 : 2.2));
      f.a = wrapAngle(f.a + f.turn * dt);

      // swim / glide / hover rhythm, independently timed per fish
      f.stateT -= dt;
      if (f.stateT <= 0) nextState(f);
      if (f.mode === 'hover' && (bw || !canHover(f))) { f.mode = 'swim'; f.target = f.cruise; f.stateT = 2 + srand() * 4; }
      var tgt = f.target * (1 - 0.3 * Math.min(1, Math.abs(f.turn) / 1.05));
      if (food) {
        var off = Math.abs(wrapAngle(Math.atan2(food.y - f.y, food.x - f.x) - f.a));
        tgt = f.cruise * (fd < f.L * 0.6 ? 0.55 : fd < f.L * 1.5 ? 0.9 : 1.25) * Math.max(0.2, Math.cos(Math.min(off, 1.5)));
      }
      if (f.fear > 0.05) tgt = Math.max(tgt, f.cruise * (1 + 2.6 * f.fear));
      var accel = tgt > f.v ? 1.2 : 0.45;
      f.v += (tgt - f.v) * Math.min(1, dt * accel);
      var hovering = f.mode === 'hover' && !food && f.fear < 0.05;
      var base = hovering ? 0.0 : (f.mode === 'glide' && !food && f.fear < 0.05 ? 0.06 : 0.62);
      var thrustT = clamp((tgt - f.v) / f.cruise * 2.2 + base + f.fear * 0.6, 0, 1.6);
      f.thrust += (thrustT - f.thrust) * Math.min(1, dt * 2.0);
      var ampT = f.L * (hovering ? 0.008 : f.mode === 'swim' ? 0.03 + 0.055 * f.thrust : 0.022 + 0.05 * f.thrust);
      f.amp += (ampT - f.amp) * Math.min(1, dt * 2.5);
      f.phase += dt * TAU * (hovering ? 0.25 : (0.45 + 0.75 * f.v / f.L) * (0.6 + 0.6 * f.thrust));
      f.finPhase += dt * TAU * (hovering ? 0.9 : 0.5);
      var openT = hovering ? 1 : (f.mode === 'glide' || (food && fd < f.L * 1.5)) ? 0.85 : clamp(0.6 - f.thrust * 0.6, 0, 1);
      f.finOpen += (openT - f.finOpen) * Math.min(1, dt * 2.5);
      f.sheen += f.turn * dt * 1.6 + dt * 0.15;

      // living depth
      f.depthTimer -= dt;
      if (f.depthTimer <= 0 && !food) { f.depthT = 0.05 + srand() * 0.8; f.depthTimer = 8 + srand() * 12; }
      f.depth += (f.depthT - f.depth) * Math.min(1, dt * (food ? 1.0 : 0.3));

      f.x += Math.cos(f.a) * f.v * dt;
      f.y += Math.sin(f.a) * f.v * dt;
      var hm = f.L * 0.35;
      if (f.x < hm) f.x = hm; if (f.x > W - hm) f.x = W - hm;
      if (f.y < hm) f.y = hm; if (f.y > H - hm) f.y = H - hm;

      // spine: follow-the-leader with bend limits and a lazy tail
      var J = f.J, TA = f.tailAng;
      J[0] = f.x; J[1] = f.y;
      var fwd = f.a;
      for (var j = 1; j < NJ; j++) {
        var px = J[(j - 1) * 2], py = J[(j - 1) * 2 + 1];
        var ang = Math.atan2(J[j * 2 + 1] - py, J[j * 2] - px);
        var back = fwd + Math.PI;
        var lim = j < NB ? 0.19 : 0.30;
        var diff = wrapAngle(ang - back);
        if (diff > lim) ang = back + lim; else if (diff < -lim) ang = back - lim;
        if (j >= NB) {
          TA[j] = TA[j] + wrapAngle(ang - TA[j]) * Math.min(1, dt * (f.butterfly ? 4.5 : 7));
          ang = TA[j];
          var d3 = wrapAngle(ang - back);
          if (d3 > lim * 1.6) ang = back + lim * 1.6; else if (d3 < -lim * 1.6) ang = back - lim * 1.6;
          TA[j] = ang;
        } else TA[j] = ang;
        var seg = j < NB ? f.segB : f.segT;
        J[j * 2] = px + Math.cos(ang) * seg;
        J[j * 2 + 1] = py + Math.sin(ang) * seg;
        fwd = ang + Math.PI;
      }
    }

    function assignFood() {
      for (var i = 0; i < fish.length; i++) {
        var f = fish[i];
        if (f.feeding && f.feeding.gone) f.feeding = null;
      }
      if (!pellets.length) { for (var z = 0; z < fish.length; z++) fish[z].feeding = null; return; }
      // rank hungry koi by distance to their nearest pellet; the closest four converge
      var cands = [];
      for (var k = 0; k < fish.length; k++) {
        var g = fish[k]; if (g.sated > 0 || g.fear > 0.2) { g.feeding = null; continue; }
        var best = null, bd = g.L * 6;
        for (var p = 0; p < pellets.length; p++) {
          var pl = pellets[p]; if (pl.gone || pl.age < g.react) continue;
          var dx = pl.x - g.x, dy = pl.y - g.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d < bd) { bd = d; best = pl; }
        }
        if (best) cands.push([bd, g, best]); else g.feeding = null;
      }
      cands.sort(function (a, b) { return a[0] - b[0]; });
      for (var c = 0; c < cands.length; c++) {
        var fishC = cands[c][1];
        if (c < 4) { fishC.feeding = cands[c][2]; fishC.feedRank = c; }
        else { fishC.feeding = null; if (fishC.mode !== 'hover' && canHover(fishC)) { fishC.mode = 'hover'; fishC.stateT = 1.5 + srand() * 2; fishC.target = fishC.cruise * 0.1; } }
      }
    }

    function updateWorld(dt) {
      assignFood();
      for (var i = 0; i < fish.length; i++) updateFish(fish[i], dt);
      // keep deep koi drawn beneath shallow ones
      fish.sort(function (a, b) { return b.depth - a.depth; });
      // ambient: a koi near the surface occasionally kisses it
      kissTimer -= dt;
      if (kissTimer <= 0 && fish.length) {
        var k = fish[fish.length - 1];
        if (k.depth < 0.2) addRipple(k.x + Math.cos(k.a) * k.L * 0.03, k.y + Math.sin(k.a) * k.L * 0.03, 0.3);
        kissTimer = 5 + srand() * 8;
      }
      for (var p = 0; p < pads.length; p++) {
        var pd = pads[p];
        if (pd.follow) {
          var h = pd.follow, rot = h.rot - (h.rot0 === undefined ? h.rot : h.rot0);
          var c = Math.cos(rot), s = Math.sin(rot);
          pd.x = h.x + pd.ox * c - pd.oy * s; pd.y = h.y + pd.ox * s + pd.oy * c;
          pd.rot += h.vr * dt;
          continue;
        }
        if (pd.rot0 === undefined) pd.rot0 = pd.rot;
        var wob = Math.sin(time * 0.05 + pd.seed) * 2;
        pd.x += (pd.vx + 2.2 + wob) * dt; pd.y += (pd.vy + 1.0) * dt; pd.rot += pd.vr * dt;
        var mgn = pd.r * 2.4;
        if (pd.x > W + mgn) pd.x = -mgn; if (pd.x < -mgn) pd.x = W + mgn;
        if (pd.y > H + mgn) pd.y = -mgn; if (pd.y < -mgn) pd.y = H + mgn;
      }
      for (var q = 0; q < petals.length; q++) {
        var pt = petals[q];
        pt.x += (pt.vx + Math.sin(time * 0.4 + pt.seed) * 3) * dt; pt.y += pt.vy * dt; pt.rot += pt.vr * dt;
        if (pt.x > W + 20) { pt.x = -20; pt.y = srand() * H; }
        if (pt.y > H + 20) pt.y = -20; if (pt.y < -20) pt.y = H + 20;
      }
      for (var e = pellets.length - 1; e >= 0; e--) {
        var pe = pellets[e]; pe.age += dt;
        pe.x += Math.sin(time * 0.7 + pe.seed) * 2 * dt; pe.y += 1.5 * dt;
        if (pe.gone || pe.age > 40) pellets.splice(e, 1);
      }
      for (var dI = drops.length - 1; dI >= 0; dI--) {
        var dr = drops[dI]; dr.life -= dt; dr.x += dr.vx * dt; dr.y += dr.vy * dt;
        if (dr.life <= 0) drops.splice(dI, 1);
      }
      for (var r = ripples.length - 1; r >= 0; r--) {
        if (time - ripples[r].t0 > 6) ripples.splice(r, 1);
      }
    }

    function addRipple(x, y, amp) {
      if (ripples.length >= MAX_RIP) ripples.shift();
      ripples.push({ x: x, y: y, t0: time, amp: amp });
    }

    /* ----- geometry ----- */
    var tmp = { x: 0, y: 0, tx: 0, ty: 0 };
    function catmull(P, x, out) {
      var i = Math.floor(x); if (i > NJ - 2) i = NJ - 2; if (i < 0) i = 0;
      var t = x - i, i0 = Math.max(i - 1, 0), i3 = Math.min(i + 2, NJ - 1);
      var t2 = t * t, t3 = t2 * t;
      for (var c = 0; c < 2; c++) {
        var p0 = P[i0 * 2 + c], p1 = P[i * 2 + c], p2 = P[(i + 1) * 2 + c], p3 = P[i3 * 2 + c];
        var v = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
        var dv = 0.5 * ((-p0 + p2) + 2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t + 3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t2);
        if (c === 0) { out.x = v; out.tx = dv; } else { out.y = v; out.ty = dv; }
      }
      var l = Math.sqrt(out.tx * out.tx + out.ty * out.ty) || 1;
      out.tx /= l; out.ty /= l;   // tangent points tail-ward
    }

    // a quad in local coordinates (x along dir, y across), with per-vertex extras
    function lquad(buf, o, rx, ry, dx, dy, len, half, x0, x1, y0, y1, az, b0, b1, part) {
      var qx = -dy, qy = dx;
      var xs = [x0, x0, x1, x0, x1, x1], ys = [y0, y1, y0, y1, y1, y0];
      for (var c = 0; c < 6; c++) {
        buf[o++] = rx + dx * len * xs[c] + qx * half * ys[c];
        buf[o++] = ry + dy * len * xs[c] + qy * half * ys[c];
        buf[o++] = xs[c]; buf[o++] = ys[c]; buf[o++] = az; buf[o++] = part; buf[o++] = b0; buf[o++] = b1;
      }
      return o;
    }

    function buildFish(f, buf, o) {
      var J = f.J, P = f.P, total = f.L + f.Lt, K = 1.3 * Math.PI;
      var sc = 1 - 0.12 * f.depth;              // deeper koi look smaller
      var mx = J[(NB >> 1) * 2], my = J[(NB >> 1) * 2 + 1];
      for (var i = 0; i < NJ; i++) {
        var i0 = Math.max(i - 1, 0), i1 = Math.min(i + 1, NJ - 1);
        var tx = J[i1 * 2] - J[i0 * 2], ty = J[i1 * 2 + 1] - J[i0 * 2 + 1], tl = Math.sqrt(tx * tx + ty * ty) || 1;
        var nx = -ty / tl, ny = tx / tl;
        var s = (i < NB ? i * f.segB : f.L + (i - NB + 1) * f.segT) / total;
        var env = 0.16 + 0.84 * Math.pow(s, 1.7);
        var lat = f.amp * env * Math.sin(f.phase - s * K);
        if (i >= NB) lat += f.amp * (f.butterfly ? 0.4 : 0.22) * (s - 0.6) * 3 * Math.sin(f.phase - s * K * 1.7 - 0.9);
        P[i * 2] = mx + (J[i * 2] + nx * lat - mx) * sc;
        P[i * 2 + 1] = my + (J[i * 2 + 1] + ny * lat - my) * sc;
      }
      var Ls = f.L * sc;
      var aa = 1.0 + 3.0 * f.depth + 0.5, k, u, w, nxp, nyp, lit;
      var start = o;
      var hwAt = function (uu) { return Ls * f.hw * bodyHalfWidth(uu); };

      // --- fins (under the body): pelvic pair, pectoral pair
      var pecL = Ls * (f.butterfly ? 0.29 : 0.235);
      var fins = [
        // u, folded lead angle, spread lead angle, length, root offset (x half-width)
        [0.56, 0.75, 1.15, Ls * (f.butterfly ? 0.14 : 0.115), 0.45, 0.4],
        [0.235, 1.0, 1.65, pecL, 0.55, 1.0]
      ];
      for (var fi = 0; fi < 2; fi++) {
        var spec = fins[fi];
        catmull(P, spec[0] * (NB - 1), tmp);
        var bx = -tmp.tx, by = -tmp.ty;          // forward
        var nX = -by, nY = bx;                   // left normal
        var hwb = hwAt(spec[0]);
        for (var side = -1; side <= 1; side += 2) {
          var paddle = spec[5] * (0.10 + 0.22 * f.finOpen) * (f.mode === 'hover' ? 2 : 1) * Math.sin(f.finPhase + (side > 0 ? 0 : 1.3));
          var turnBias = clamp(-f.turn * side * 0.3, -0.3, 0.3);
          var lead = spec[1] + (spec[2] - spec[1]) * f.finOpen + paddle + turnBias;
          var th = lead - 0.5;                   // fan axis sits 0.5 rad behind the leading edge
          var dx = -bx * Math.cos(th) + nX * side * Math.sin(th);
          var dy = -by * Math.cos(th) + nY * side * Math.sin(th);
          var rx = tmp.x + nX * side * hwb * spec[4], ry = tmp.y + nY * side * hwb * spec[4];
          // which local-y side faces forward (the leading edge)
          var flag = ((-dy) * bx + dx * by) >= 0 ? 1 : -1;
          var Wf = spec[3] * 0.9;
          o = lquad(buf, o, rx, ry, dx, dy, spec[3], Wf, -0.06, 1.04, -1.1, 1.1, spec[3], Wf, flag, 2);
        }
      }
      // --- barbels at the mouth corners (two short pairs)
      catmull(P, 0.025 * (NB - 1), tmp);
      var fX = -tmp.tx, fY = -tmp.ty, lX = -fY, lY = fX;
      var hw0 = hwAt(0.03);
      for (var bI = 0; bI < 2; bI++) {
        var bl = Ls * (bI ? 0.024 : 0.036), bang = bI ? 1.05 : 0.6;
        for (var sd0 = -1; sd0 <= 1; sd0 += 2) {
          var ddx = fX * Math.cos(bang) + lX * sd0 * Math.sin(bang), ddy = fY * Math.cos(bang) + lY * sd0 * Math.sin(bang);
          var brx = tmp.x + lX * sd0 * hw0 * (bI ? 0.75 : 0.55) - fX * Ls * 0.006 * bI;
          var bry = tmp.y + lY * sd0 * hw0 * (bI ? 0.75 : 0.55) - fY * Ls * 0.006 * bI;
          o = lquad(buf, o, brx, bry, ddx, ddy, bl, 2.0, 0, 1, -1, 1, bl, 2.0, 0, 3);
        }
      }
      // --- tail
      var tailMax = f.butterfly ? 0.19 : 0.155;
      for (k = 0; k < TAIL_SAMPLES; k++) {
        var tt = k / (TAIL_SAMPLES - 1);
        catmull(P, (NB - 1) + tt * NT, tmp);
        w = Ls * (f.hw * 0.30 + (tailMax - f.hw * 0.30) * Math.pow(tt, 0.85));
        nxp = -tmp.ty; nyp = tmp.tx;
        lit = nxp * TO_LIGHT[0] + nyp * TO_LIGHT[1];
        for (var sd = -1; sd <= 1; sd += 2) {
          buf[o++] = tmp.x + nxp * (w + aa) * sd; buf[o++] = tmp.y + nyp * (w + aa) * sd;
          buf[o++] = tt; buf[o++] = sd * (w + aa); buf[o++] = w; buf[o++] = lit * sd; buf[o++] = 0; buf[o++] = f.Lt * sc;
        }
      }
      // --- body
      for (k = 0; k < BODY_SAMPLES; k++) {
        u = Math.pow(k / (BODY_SAMPLES - 1), 1.45);  // denser near the rounded nose
        catmull(P, u * (NB - 1), tmp);
        w = Math.max(0.6, hwAt(u));
        nxp = -tmp.ty; nyp = tmp.tx;
        lit = nxp * TO_LIGHT[0] + nyp * TO_LIGHT[1];
        var dor = 0.11 * Math.sin(f.phase - u * 4.1 - 1.2) * (0.4 + f.thrust * 0.6) - f.turn * 0.08;
        for (var s2 = -1; s2 <= 1; s2 += 2) {
          buf[o++] = tmp.x + nxp * (w + aa) * s2; buf[o++] = tmp.y + nyp * (w + aa) * s2;
          buf[o++] = u; buf[o++] = s2 * (w + aa); buf[o++] = w; buf[o++] = lit; buf[o++] = dor; buf[o++] = 0;
        }
      }
      // --- eyes, bulging just past the outline
      catmull(P, 0.09 * (NB - 1), tmp);
      var er = Ls * 0.019, ew = hwAt(0.09);
      for (var es = -1; es <= 1; es += 2) {
        var ex = tmp.x - tmp.ty * es * (ew * 0.9), ey = tmp.y + tmp.tx * es * (ew * 0.9);
        o = lquad(buf, o, ex, ey, 1, 0, er * 1.2, er * 1.2, -1, 1, -1, 1, er, 0, 0, 4);
      }
      f.vstart = start / VERT_FLOATS;
      return o;
    }

    function quad(buf, o, x, y, rot, half, ux, uy) {
      var c = Math.cos(rot), s = Math.sin(rot);
      var cs = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (var i = 0; i < 4; i++) {
        var lx = cs[i][0] * half * ux, ly = cs[i][1] * half * uy;
        buf[o++] = x + lx * c - ly * s; buf[o++] = y + lx * s + ly * c;
        buf[o++] = cs[i][0] * ux; buf[o++] = cs[i][1] * uy; buf[o++] = 0; buf[o++] = 0; buf[o++] = 0; buf[o++] = 0;
      }
      return o;
    }

    var surfaceDraws = [];
    function sdraw(first, kind, seed, px, tint, sh, off) {
      surfaceDraws.push({ first: first, kind: kind, seed: seed, px: px, tint: tint, sh: sh, off: off });
    }
    function buildSurface() {
      var need = (pads.length * 2 + petals.length + pellets.length + drops.length + 4) * 4 * VERT_FLOATS;
      if (padData.length < need) padData = new Float32Array(need * 2);
      var o = 0; surfaceDraws.length = 0;
      for (var i = 0; i < petals.length; i++) {
        var pt = petals[i];
        sdraw(o / VERT_FLOATS, 2, pt.seed, pt.s, [0, 0, 0], 0.22, 12);
        o = quad(padData, o, pt.x, pt.y, pt.rot, pt.s * 1.15, 1.15, 1.15);
      }
      for (var p = 0; p < pellets.length; p++) {
        var pe = pellets[p];
        var pr0 = 4 * (1 + 0.07 * Math.sin(time * 3 + pe.seed * 5));
        sdraw(o / VERT_FLOATS, 3, pe.seed, pr0, [0, 0, 0], 0.35, 9);
        o = quad(padData, o, pe.x, pe.y, 0, pr0 * 1.5, 1.5, 1.5);
      }
      for (var d = 0; d < drops.length; d++) {
        var dr = drops[d];
        sdraw(o / VERT_FLOATS, 4, 0, 3, [clamp(dr.life / 0.55, 0, 1), 0, 0], 0, 0);
        o = quad(padData, o, dr.x, dr.y, 0, 3, 1, 1);
      }
      for (var j = 0; j < pads.length; j++) {
        var pd = pads[j];
        sdraw(o / VERT_FLOATS, 0, pd.seed, pd.r, pd.tint, 0.8, 38);
        o = quad(padData, o, pd.x, pd.y, pd.rot, pd.r * 1.16, 1.16, 1.16);
      }
      for (var k = 0; k < pads.length; k++) {
        var fl = pads[k].flower; if (!fl) continue;
        var pdk = pads[k];
        var c = Math.cos(pdk.rot), s = Math.sin(pdk.rot);
        var fx = pdk.x + fl.ox * c - fl.oy * s, fy = pdk.y + fl.ox * s + fl.oy * c;
        sdraw(o / VERT_FLOATS, 1, pdk.seed, fl.r, [0, 0, fl.pink], 0.35, 34);
        o = quad(padData, o, fx, fy, fl.rot + pdk.rot * 0.5, fl.r * 1.15, 1.15, 1.15);
      }
      return o;
    }

    /* ----- GL state ----- */
    function upload(buf, data, n, capKey) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      var cap = capKey === 'mesh' ? meshCap : padCap;
      if (data.length * 4 > cap) {
        gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
        if (capKey === 'mesh') meshCap = data.byteLength; else padCap = data.byteLength;
      }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, n));
    }
    function bindMesh(buf) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 32, 0);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 8);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
    }
    function bindQuad() {
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.enableVertexAttribArray(0); gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    }

    function drawFish(shadow) {
      var P = progs.fish, u = P.u;
      gl.useProgram(P.p);
      gl.uniform2f(u.uView, W, H);
      gl.uniform1f(u.uTime, time);
      gl.uniform1f(u.uShadowMode, shadow ? 1 : 0);
      gl.uniform3fv(u.uWater, waterTint);
      for (var i = 0; i < fish.length; i++) {
        var f = fish[i];
        var dz = clamp(f.depth / 0.85, 0, 1);
        var dist = shadow ? 12 + 46 * (1 - dz) : 0;
        gl.uniform2f(u.uOffset, SHADOW_DIR[0] * dist, SHADOW_DIR[1] * dist);
        gl.uniform1f(u.uShadowAlpha, 0.62 - 0.36 * dz);
        gl.uniform1f(u.uType, f.type);
        gl.uniform1f(u.uSeed, f.seed);
        gl.uniform1f(u.uDepth, f.depth);
        gl.uniform1f(u.uSoft, shadow ? 1.0 : 1.0 + 3.0 * f.depth);
        gl.uniform1f(u.uGulp, f.gulp > 0 ? Math.sin(Math.PI * f.gulp / 0.3) : 0);
        gl.uniform1f(u.uLen, f.L * (1 - 0.12 * f.depth));
        gl.uniform1f(u.uSheen, f.sheen);
        var v = f.vstart;
        gl.uniform1f(u.uPart, 2);                       // fins + barbels in one batch
        gl.drawArrays(gl.TRIANGLES, v, 48);
        v += 48;
        gl.uniform1f(u.uPart, 1);
        gl.drawArrays(gl.TRIANGLE_STRIP, v, TAIL_SAMPLES * 2);
        v += TAIL_SAMPLES * 2;
        gl.uniform1f(u.uPart, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, v, BODY_SAMPLES * 2);
        v += BODY_SAMPLES * 2;
        if (!shadow) {
          gl.uniform1f(u.uPart, 2);                     // both eyes
          gl.drawArrays(gl.TRIANGLES, v, 12);
        }
      }
    }
    function drawSurface(shadow) {
      var P = progs.pad, u = P.u;
      gl.useProgram(P.p);
      gl.uniform2f(u.uView, W, H);
      gl.uniform1f(u.uShadowMode, shadow ? 1 : 0);
      for (var i = 0; i < surfaceDraws.length; i++) {
        var d = surfaceDraws[i];
        if (shadow && d.sh <= 0) continue;
        gl.uniform2f(u.uOffset, shadow ? SHADOW_DIR[0] * d.off : 0, shadow ? SHADOW_DIR[1] * d.off : 0);
        gl.uniform1f(u.uShadowAlpha, d.sh);
        gl.uniform1f(u.uKind, d.kind);
        gl.uniform1f(u.uSeed, d.seed);
        gl.uniform1f(u.uPx, d.px);
        gl.uniform3fv(u.uTint, d.tint);
        gl.drawArrays(gl.TRIANGLE_STRIP, d.first, 4);
      }
    }

    function render() {
      if (!tFish || lost) return;
      var o = 0;
      for (var i = 0; i < fish.length; i++) o = buildFish(fish[i], meshData, o);
      upload(meshBuf, meshData, o, 'mesh');
      var po = buildSurface();
      upload(padBuf, padData, po, 'pad');

      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      // 1. shadows (quarter res)
      gl.bindFramebuffer(gl.FRAMEBUFFER, tShadow.fb);
      gl.viewport(0, 0, tShadow.w, tShadow.h);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      bindMesh(meshBuf); drawFish(true);
      bindMesh(padBuf); drawSurface(true);

      // 2. floor (half res). The static bed is baked once per resize.
      gl.disable(gl.BLEND);
      if (bedDirty) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, tBed.fb);
        gl.viewport(0, 0, tBed.w, tBed.h);
        bindQuad();
        gl.useProgram(progs.bed.p);
        gl.uniform2f(progs.bed.u.uView, W, H);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        bedDirty = false;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, tFloor.fb);
      gl.viewport(0, 0, tFloor.w, tFloor.h);
      bindQuad();
      gl.useProgram(progs.floor.p);
      var fu = progs.floor.u;
      gl.uniform2f(fu.uView, W, H);
      gl.uniform1f(fu.uTime, time);
      gl.uniform2f(fu.uShadowTexel, 1 / tShadow.w, 1 / tShadow.h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tShadow.tex); gl.uniform1i(fu.uShadow, 0); gl.uniform1f(fu.uLite, W < 560 ? 1 : 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tBed.tex); gl.uniform1i(fu.uBed, 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // 3. koi (full res, premultiplied, deep first)
      gl.enable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, tFish.fb);
      gl.viewport(0, 0, tFish.w, tFish.h);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      bindMesh(meshBuf); drawFish(false);

      // 4. water surface composite to screen
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      bindQuad();
      var cu = progs.comp.u;
      gl.useProgram(progs.comp.p);
      gl.uniform2f(cu.uView, W, H);
      gl.uniform1f(cu.uTime, time);
      var n = 0;
      for (var r = 0; r < ripples.length && n < MAX_RIP; r++) {
        var rp = ripples[r];
        ripUniform[n * 4] = rp.x; ripUniform[n * 4 + 1] = rp.y; ripUniform[n * 4 + 2] = time - rp.t0; ripUniform[n * 4 + 3] = rp.amp;
        n++;
      }
      gl.uniform4fv(cu.uRip, ripUniform);
      gl.uniform1f(cu.uRipN, n);
      gl.uniform1f(cu.uLite, W < 560 ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tFloor.tex); gl.uniform1i(cu.uFloor, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tFish.tex); gl.uniform1i(cu.uFish, 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.activeTexture(gl.TEXTURE0);

      // 5. surface objects over the water
      gl.enable(gl.BLEND);
      bindMesh(padBuf); drawSurface(false);
    }

    /* ----- sizing ----- */
    function freeTargets() {
      [tShadow, tFloor, tFish, tBed].forEach(function (t) { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); } });
    }
    function resize(force) {
      var cw = canvas.clientWidth || window.innerWidth, ch = canvas.clientHeight || window.innerHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var ratio = Math.min(dpr, Math.sqrt(3.0e6 / Math.max(1, cw * ch)));
      if (cw < 560) ratio *= 0.75;               // phones: lighter composite
      ratio = Math.max(ratio * quality, 0.5);
      var bw = Math.max(1, Math.round(cw * ratio)), bh = Math.max(1, Math.round(ch * ratio));
      if (!force && bw === canvas.width && bh === canvas.height && cw === W && ch === H) return;
      var oldW = W, oldH = H;
      W = cw; H = ch; pr = ratio;
      prefer = opts.prefer ? opts.prefer(W, H) : null;
      canvas.width = bw; canvas.height = bh;
      freeTargets();
      tShadow = target(gl, Math.max(1, Math.round(bw / 4)), Math.max(1, Math.round(bh / 4)));
      tFloor = target(gl, Math.max(1, Math.round(bw / 2)), Math.max(1, Math.round(bh / 2)));
      tFish = target(gl, bw, bh);
      tBed = target(gl, tFloor.w, tFloor.h);
      bedDirty = true;
      if (!fish.length) {
        populate();
        warmup(4);
      } else if (oldW && oldH && (oldW !== W || oldH !== H)) {
        var sx = W / oldW, sy = H / oldH;
        var big = Math.abs(sx - 1) > 0.25 || Math.abs(sy - 1) > 0.35;
        if (big) { populate(); warmup(3); }
        else {
          fish.forEach(function (f) { f.x *= sx; f.y *= sy; resetChain(f); });
          pads.forEach(function (p) { p.x *= sx; p.y *= sy; });
          petals.forEach(function (p) { p.x *= sx; p.y *= sy; });
          warmup(0.6);
        }
      }
      if (!running) render();
    }

    function warmup(seconds) {
      var steps = Math.round(seconds * 30);
      for (var i = 0; i < steps; i++) { time += 1 / 30; updateWorld(1 / 30); }
    }

    /* ----- loop ----- */
    function frame(now) {
      raf = 0;
      if (!running) return;
      var dt = lastNow ? (now - lastNow) / 1000 : 1 / 60;
      lastNow = now;
      if (adaptive) monitor(dt);
      dt = Math.min(dt, 1 / 30);
      time += dt;
      updateWorld(dt);
      render();
      raf = requestAnimationFrame(frame);
    }
    // adaptive resolution: step down when slow, step back up after sustained headroom
    function monitor(dt) {
      frameTimes.push(dt);
      if (frameTimes.length < 90) return;
      var sorted = frameTimes.slice().sort(function (a, b) { return a - b; });
      var med = sorted[sorted.length >> 1];
      frameTimes.length = 0;
      if (med > 0.024 && quality > 0.55) { quality *= 0.8; goodWindows = 0; resize(true); }
      else if (med < 0.0135 && quality < 1) {
        if (++goodWindows >= 3) { quality = Math.min(1, quality / 0.8); goodWindows = 0; resize(true); }
      } else goodWindows = 0;
    }
    function start() {
      if (running || reduced || lost || !visible || !inView) return;
      running = true; lastNow = 0;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    /* ----- interaction ----- */
    var last = null;
    function isUi(el) { return opts.isUi ? opts.isUi(el) : false; }
    function onMove(e) {
      if (reduced || !running) return;
      if (e.pointerType === 'touch') return;
      var now = performance.now();
      var x = e.clientX, y = e.clientY;
      if (!last) { last = { x: x, y: y, t: now, sx: x, sy: y }; return; }
      var dtm = Math.max(1, now - last.t);
      var dx = x - last.x, dy = y - last.y;
      var speed = Math.sqrt(dx * dx + dy * dy) / dtm * 1000;
      last.x = x; last.y = y; last.t = now;
      if (isUi(e.target)) return;
      var tx = x - last.sx, ty = y - last.sy;
      if (tx * tx + ty * ty > 34 * 34 && speed > 90) {
        last.sx = x; last.sy = y;
        addRipple(x, y, clamp(speed / 2600, 0.10, 0.42));
      }
      if (speed > 1500) {
        for (var i = 0; i < fish.length; i++) {
          var f = fish[i], fx = f.x - x, fy = f.y - y;
          if (fx * fx + fy * fy < f.L * f.L * 2.6) { f.fear = Math.min(1, f.fear + 0.8); f.fx = x; f.fy = y; }
        }
      }
    }
    // A tap (or click) on open water drops food. Pointer events rather than click,
    // so it also fires on iOS where non-interactive elements swallow clicks.
    var down = null;
    function onDown(e) {
      if (reduced || e.button > 0 || isUi(e.target)) { down = null; return; }
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    }
    function onUp(e) {
      if (!down || e.pointerId !== down.id) return;
      var dx = e.clientX - down.x, dy = e.clientY - down.y;
      var ok = dx * dx + dy * dy < 144 && performance.now() - down.t < 600;
      down = null;
      if (ok && !reduced) api.feed(e.clientX, e.clientY);
    }
    var api = {
      ripple: function (x, y, amp) { addRipple(x, y, amp || 1); },
      feed: function (x, y) {
        addRipple(x, y, 0.85);
        var n = 3 + ((srand() * 3) | 0);
        for (var i = 0; i < n; i++) {
          var a = srand() * TAU, r = 6 + srand() * 24;
          pellets.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, age: 0, seed: srand() * 10, gone: false });
        }
        if (pellets.length > 18) pellets.splice(0, pellets.length - 18);
        if (opts.onFeed) opts.onFeed();
        if (!running) render();
      },
      setReducedMotion: function (v) {
        reduced = !!v;
        if (reduced) { stop(); render(); } else start();
      },
      step: function (seconds) { warmup(seconds); render(); },
      debugFish: function () {
        return fish.slice().sort(function (a, b) { return a.id - b.id; }).map(function (f) {
          return { x: Math.round(f.x), y: Math.round(f.y), tx: Math.round(f.J[(NJ - 1) * 2]), ty: Math.round(f.J[(NJ - 1) * 2 + 1]),
                   depth: Math.round(f.depth * 100) / 100, mode: f.mode, type: f.type, feed: f.feeding ? Math.round(Math.hypot(f.feeding.x - f.x, f.feeding.y - f.y)) : -1, L: Math.round(f.L), sated: Math.round(f.sated * 10) / 10 };
        });
      },
      get running() { return running; },
      get stats() { return { koi: fish.length, pellets: pellets.length, ripples: ripples.length, w: W, h: H, ratio: pr, quality: quality }; },
      destroy: function () { stop(); }
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', function () { down = null; }, { passive: true });
    document.addEventListener('visibilitychange', function () {
      visible = !document.hidden;
      if (visible) start(); else stop();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        if (inView) start(); else stop();
      }).observe(canvas);
    }
    var resizeQueued = false;
    function queueResize() {
      if (resizeQueued) return; resizeQueued = true;
      requestAnimationFrame(function () { resizeQueued = false; resize(false); });
    }
    if ('ResizeObserver' in window) new ResizeObserver(queueResize).observe(canvas);
    else window.addEventListener('resize', queueResize);

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault(); stop(); lost = true;
      if (opts.onLost) opts.onLost();
    }, false);
    canvas.addEventListener('webglcontextrestored', function () {
      try { initGL(); } catch (err) { if (opts.onFail) opts.onFail('restore'); return; }
      lost = false;
      resize(true); render();
      if (opts.onRestore) opts.onRestore();
      start();
    }, false);

    resize(true);
    render();
    if (opts.onReady) opts.onReady(api);
    start();
    return api;
  }

  global.KoiPond = { mount: mount };
})(window);
