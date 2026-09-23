import type { MeshPhysicalMaterial } from 'three';
type Shader = Parameters<MeshPhysicalMaterial['onBeforeCompile']>[0];

export function installNocturneShader(shader: Shader) {
  Object.assign(shader.uniforms, {
    uTime: { value: 0 }, uBass: { value: 0 }, uSub: { value: 0 }, uMids: { value: 0 },
    uTreble: { value: 0 }, uKick: { value: 0 }, uHigh: { value: 0 },
    uSnareImpact: { value: 0 }, uSnareAge: { value: 100 }, uSnareDirection: { value: 1 }, uShell: { value: 0 },
  });
  shader.vertexShader = shader.vertexShader.replace('#include <common>', `
    #include <common>
    uniform float uTime, uBass, uSub, uMids, uTreble, uKick, uHigh;
    uniform float uSnareImpact, uSnareAge, uSnareDirection, uShell;

    vec3 nocturneSurface(vec3 p) {
      float shoulder = exp(-dot(p - vec3(0.42, 0.5, -0.22), p - vec3(0.42, 0.5, -0.22)) * 4.4);
      float lobe = exp(-dot(p - vec3(-0.52, -0.1, 0.36), p - vec3(-0.52, -0.1, 0.36)) * 5.2);
      float waist = exp(-dot(p - vec3(-0.1, 0.38, 0.72), p - vec3(-0.1, 0.38, 0.72)) * 7.0);
      float drift = sin(p.x * 2.4 + p.y * 1.15) * cos(p.y * 2.55 - p.z * 1.6) * 0.15;
      float organicRadius = 1.0 + shoulder * 0.22 + lobe * 0.17 - waist * 0.16 + drift;
      float longitude = atan(p.z, p.x);
      float latitude = asin(clamp(p.y, -1.0, 1.0));
      float shellRibs = sin(longitude * 11.0 + sin(latitude * 4.0) * 0.72 + uTime * 0.15) * sqrt(max(0.0, 1.0 - p.y * p.y));
      float shellRadius = 1.0 + shoulder * 0.14 + lobe * 0.10 - waist * 0.11 + shellRibs * 0.052 + sin(latitude * 12.0 - uTime * 0.21) * 0.025;
      float radius = mix(organicRadius, shellRadius, uShell);
      float breath = sin(p.y * 3.2 + uTime * 0.38) * cos(p.x * 2.6 - uTime * 0.25);
      float folds = sin(p.y * 4.2 - p.x * 2.1 + uTime * 0.72) * cos(p.z * 2.7 + uTime * 0.31);
      // The reference visualizer keeps its center fixed and uses audio to
      // amplify coherent vertex noise. These two moving octaves create the
      // same all-over contour ruffle without translating the sculpture.
      float strikePhase = uSnareAge * 19.0 * uSnareDirection;
      float broadRipple = sin(p.x * 6.2 + strikePhase) * cos(p.y * 7.1 - strikePhase * 0.73) * sin(p.z * 5.4 + strikePhase * 0.42);
      float fineRipple = sin((p.x + p.y) * 12.0 - strikePhase * 1.35) * cos((p.y - p.z) * 10.0 + strikePhase);
      float strikeGain = min(uSnareImpact, 3.2);
      float detail = sin(p.y * 13.0 + p.z * 9.0 + uTime * 3.2) * cos(p.x * 9.0 - uTime * 2.1);
      // The body keeps moving between notes. Bright frequencies remain fine detail.
      radius += breath * (0.018 + uSub * 0.034) + folds * uBass * 0.038;
      radius += detail * (uTreble * 0.004 + uHigh * 0.007);
      radius += (broadRipple * 0.072 + fineRipple * 0.038) * strikeGain;
      // Bound the ruffled contour so the centered artwork never enters the UI.
      radius = clamp(radius, 0.58, 1.64);
      vec3 body = p * radius * vec3(1.02, 1.06, 0.92);
      // Midrange bends the posture; kick compression conserves the impression of mass.
      float twist = body.y * uMids * 0.105 + sin(uTime * 0.2) * 0.015;
      body.xz = mat2(cos(twist), -sin(twist), sin(twist), cos(twist)) * body.xz;
      body.x += sin(body.y * 2.3 + uTime * 0.5) * uMids * 0.026;
      body *= vec3(1.0 + uKick * 0.022, 1.0 - uKick * 0.03, 1.0 + uKick * 0.022);
      return body;
    }
  `);
  // Evaluate the SAME deformed surface for positions and normals. Highlights follow every fold.
  shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
    #include <beginnormal_vertex>
    vec3 direction = normalize(position);
    vec3 tangent = normalize(cross(abs(direction.y) < 0.96 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), direction));
    vec3 bitangent = cross(direction, tangent);
    vec3 surface = nocturneSurface(direction);
    vec3 alongTangent = nocturneSurface(normalize(direction + tangent * 0.006)) - surface;
    vec3 alongBitangent = nocturneSurface(normalize(direction + bitangent * 0.006)) - surface;
    objectNormal = normalize(cross(alongTangent, alongBitangent));
  `);
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = nocturneSurface(normalize(position));');
}
