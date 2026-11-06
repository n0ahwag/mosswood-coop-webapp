// Das Bergmassiv: Gelände mit Fels und Wiesen, Dorfplatz, Hängebrücken, Felstreppen,
// Bergsee und Wasserfälle.

import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { QUALITY, worldTime } from './clock';
import { distToPath } from './decor';
import {
  bridgeSag, connectionPoint, CONNECTIONS, fbm2, groundAt, heightAt, LAKE, PEAKS, PLAZA_RADIUS, PLOTS, VILLAGE,
  type Connection, type Vec2, type Vec3,
} from './layout';
import { box, cyl, mats, sphere } from './materials';
import { softDotTexture, tex } from './textures';

const col = (hex: string) => new THREE.Color(hex);

// ---------- Gelände ----------

const TERRAIN_SIZE = 66;

const PALETTE = {
  grassA: col('#7bbe38'),
  grassB: col('#84c43e'),
  grassDry: col('#93cc47'),
  moss: col('#74b636'),
  dirt: col('#8fb64e'),
  path: col('#e6d6ae'),
  pathDark: col('#dccb9e'),
  rockA: col('#9fabb9'),
  rockB: col('#8794a5'),
  rockWarm: col('#adb8c4'),
  low: col('#93b0cc'),
};

function buildTerrainGeometry(seg: number) {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const n = pos.count;
  const flat = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const g = groundAt(pos.getX(i), pos.getZ(i));
    pos.setY(i, g.h);
    flat[i] = g.flat;
  }
  geo.computeVertexNormals();
  const normals = geo.attributes.normal as THREE.BufferAttribute;

  const row = seg + 1;
  const k = Math.max(2, Math.round(seg / 60));
  const hAt = (r: number, c: number) => pos.getY(Math.min(seg, Math.max(0, r)) * row + Math.min(seg, Math.max(0, c)));
  const colors = new Float32Array(n * 3);
  const c = new THREE.Color();
  const tmp = new THREE.Color();

  for (let r = 0; r <= seg; r++) {
    for (let q = 0; q <= seg; q++) {
      const i = r * row + q;
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = pos.getY(i);
      const ny = normals.getY(i);

      // Wiese: Farbflecken, an Kanten trockener
      const patch = fbm2(x * 0.12, z * 0.12, 3);
      c.copy(PALETTE.grassA).lerp(PALETTE.grassB, Math.min(1, patch * 0.8));
      const rimDry = Math.max(0, 1 - flat[i]) * 0.5;
      c.lerp(PALETTE.grassDry, rimDry * 0.7);

      // Fels mit Schichtbändern
      const strata = 0.5 + 0.5 * Math.sin(y * 2.3 + fbm2(x * 0.2, z * 0.2, 3) * 5);
      tmp.copy(PALETTE.rockA).lerp(PALETTE.rockB, strata * 0.35).lerp(PALETTE.rockWarm, Math.max(0, fbm2(x * 0.08 + 5, z * 0.08, 2) - 0.45) * 0.6);
      // Moos und Gras halten sich auch auf steileren Hängen, Fels nur an echten Wänden
      const mossy = (fbm2(x * 0.25 + 9, z * 0.25, 3) - 0.35) * 0.25;
      const grassy = THREE.MathUtils.smoothstep(ny + mossy, 0.5, 0.7) * (0.85 + flat[i] * 0.15);
      // Übergang: ein Streifen Erde und Moos
      const edge = 1 - Math.abs(grassy - 0.5) * 2;
      c.lerp(tmp, 1 - grassy);
      c.lerp(PALETTE.dirt, edge * 0.15);
      if (grassy > 0.3 && flat[i] < 0.5) c.lerp(PALETTE.moss, 0.25 * (1 - flat[i]));

      // Trampelpfade auf den Plateaus
      if (flat[i] > 0.3) {
        const d = distToPath([x, z]);
        const p = (1 - THREE.MathUtils.smoothstep(d, 0.3, 0.62)) * flat[i];
        if (p > 0) {
          tmp.copy(PALETTE.path).lerp(PALETTE.pathDark, fbm2(x * 0.6, z * 0.6, 2));
          c.lerp(tmp, p * 0.92);
        }
      }

      // tiefe Lagen wirken kühler (Luftperspektive)
      c.lerp(PALETTE.low, (1 - THREE.MathUtils.smoothstep(y, 0.5, 4)) * 0.25);

      // Umgebungsverdeckung aus der Krümmung: Mulden dunkler, Kanten heller
      const avg = (hAt(r - k, q) + hAt(r + k, q) + hAt(r, q - k) + hAt(r, q + k)) / 4;
      const cav = avg - y;
      const ao = 1 - Math.min(0.28, Math.max(0, cav) * 0.22) + Math.min(0.06, Math.max(0, -cav) * 0.05);
      c.multiplyScalar(ao);

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** Gelände-Material: Vertex-Farben + projizierte Gras- und Felstextur mit Relief, Wolkennebel unten. */
export function makeTerrainMaterial(cloudFade = true) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const grass = tex('grassDetail');
  const rock = tex('rockDetail');
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uGrass = { value: grass.map };
    shader.uniforms.uGrassN = { value: grass.normal };
    shader.uniforms.uRock = { value: rock.map };
    shader.uniforms.uRockN = { value: rock.normal };
    shader.uniforms.uCloud = { value: new THREE.Color('#f2f8ff') };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * objectNormal);',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWPos;
varying vec3 vWNrm;
uniform sampler2D uGrass; uniform sampler2D uGrassN; uniform sampler2D uRock; uniform sampler2D uRockN;
uniform vec3 uCloud;
vec3 triW() { vec3 b = pow(abs(normalize(vWNrm)), vec3(6.0)); return b / (b.x + b.y + b.z); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec3 bw = triW();
  float grassy = smoothstep(0.5, 0.72, normalize(vWNrm).y);
  vec3 g = texture2D(uGrass, vWPos.xz / 3.0).rgb;
  vec3 rx = texture2D(uRock, vWPos.zy / 4.0).rgb;
  vec3 ry = texture2D(uRock, vWPos.xz / 4.0).rgb;
  vec3 rz = texture2D(uRock, vWPos.xy / 4.0).rgb;
  vec3 rk = rx * bw.x + ry * bw.y + rz * bw.z;
  // Flacher Look: Gras- und Felstextur sind aus (Faktor 0), nur die Vertex-Farben zählen
  diffuseColor.rgb *= mix(vec3(1.0), mix(rk, g, grassy), 0.0);
}`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
{
  vec3 bw = triW();
  float grassy = smoothstep(0.5, 0.72, normalize(vWNrm).y);
  vec3 tx =texture2D(uRockN, vWPos.zy / 4.0).xyz * 2.0 - 1.0;
  vec3 ty = mix(texture2D(uRockN, vWPos.xz / 4.0).xyz, texture2D(uGrassN, vWPos.xz / 3.0).xyz, grassy) * 2.0 - 1.0;
  vec3 tz = texture2D(uRockN, vWPos.xy / 4.0).xyz * 2.0 - 1.0;
  vec3 nW = normalize(vWNrm);
  vec3 pert = vec3(0.0, tx.y, tx.x) * bw.x + vec3(ty.x, 0.0, ty.y) * bw.y + vec3(tz.x, tz.y, 0.0) * bw.z;
  nW = normalize(nW + pert * 0.0);
  normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
}`,
      )
      .replace(
        '#include <tonemapping_fragment>',
        cloudFade
          ? `{
  float cloudF = 1.0 - smoothstep(-0.4, 2.4, vWPos.y);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uCloud, cloudF * 0.9);
}
#include <tonemapping_fragment>`
          : '#include <tonemapping_fragment>',
      );
  };
  m.customProgramCacheKey = () => `mosswood-terrain-${cloudFade}`;
  return m;
}

export function Terrain() {
  const geo = useMemo(() => buildTerrainGeometry(QUALITY === 'high' ? 320 : 230), []);
  const mat = useMemo(() => makeTerrainMaterial(), []);
  return <mesh geometry={geo} material={mat} receiveShadow castShadow />;
}

// ---------- Dorfplatz mit Brunnen und Laternen ----------

function Well() {
  const m = mats();
  return (
    <group>
      <mesh geometry={cyl(0.78, 0.86, 0.66, 28)} material={m.stone} position={[0, 0.33, 0]} castShadow receiveShadow />
      <mesh geometry={cyl(0.84, 0.84, 0.1, 28)} material={m.stoneDark} position={[0, 0.69, 0]} castShadow />
      <mesh position={[0, 0.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.66, 28]} />
        <meshStandardMaterial color="#3d8fe3" roughness={0.15} metalness={0.05} />
      </mesh>
      {[-0.68, 0.68].map((x) => (
        <mesh key={x} geometry={box(0.12, 1.3, 0.12, 0.03)} material={m.timber} position={[x, 1.25, 0]} castShadow />
      ))}
      <mesh geometry={cyl(0.06, 0.06, 1.3, 12)} material={m.beam} position={[0, 1.6, 0]} rotation={[0, 0, Math.PI / 2]} />
      <mesh geometry={cyl(0.035, 0.035, 0.5, 8)} material={m.rope} position={[0.15, 1.33, 0]} />
      <mesh geometry={cyl(0.13, 0.11, 0.2, 16)} material={m.woodLight} position={[0.15, 1.02, 0]} castShadow />
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          geometry={box(0.85, 0.06, 1.15, 0.01)}
          material={m.roofRed}
          position={[s * 0.36, 2.02, 0]}
          rotation={[0, 0, -s * 0.62]}
          castShadow
        />
      ))}
      <mesh geometry={cyl(0.05, 0.05, 1.2, 10)} material={m.timber} position={[0, 2.27, 0]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

export function Lantern({ position }: { position: Vec3 }) {
  const m = mats();
  return (
    <group position={position}>
      <mesh geometry={cyl(0.05, 0.07, 1.5, 12)} material={m.timber} position={[0, 0.75, 0]} castShadow />
      <mesh geometry={box(0.28, 0.06, 0.28, 0.01)} material={m.iron} position={[0, 1.52, 0]} />
      <mesh geometry={box(0.22, 0.28, 0.22, 0.02)} material={m.lamp} position={[0, 1.7, 0]} />
      <mesh geometry={cyl(0.02, 0.19, 0.16, 4)} material={m.iron} position={[0, 1.92, 0]} rotation={[0, Math.PI / 4, 0]} />
    </group>
  );
}

export function Plaza() {
  const m = mats();
  const y = VILLAGE.y;
  const stones = useMemo(() => Array.from({ length: 30 }, (_, i) => (i / 30) * Math.PI * 2), []);
  return (
    <group position={[VILLAGE.pos[0], y, VILLAGE.pos[1]]}>
      <mesh geometry={cyl(PLAZA_RADIUS + 0.2, PLAZA_RADIUS + 0.28, 0.1, 64)} material={m.cobble} position={[0, 0.0, 0]} receiveShadow />
      {stones.map((a) => (
        <mesh
          key={a}
          geometry={box(0.5, 0.12, 0.24, 0.04)}
          material={m.stone}
          position={[Math.cos(a) * (PLAZA_RADIUS + 0.32), 0.04, Math.sin(a) * (PLAZA_RADIUS + 0.32)]}
          rotation={[0, Math.PI / 2 - a, 0]}
          receiveShadow
        />
      ))}
      <Well />
      <Lantern position={[1.95, 0, -1.55]} />
      <Lantern position={[-1.95, 0, 1.55]} />
      {/* Bank am Brunnen */}
      <group position={[-1.5, 0, -1.4]} rotation={[0, 0.85, 0]}>
        <mesh geometry={box(1.2, 0.08, 0.36, 0.02)} material={m.woodLight} position={[0, 0.42, 0]} castShadow />
        {[-0.48, 0.48].map((x) => (
          <mesh key={x} geometry={box(0.1, 0.4, 0.3, 0.02)} material={m.timber} position={[x, 0.2, 0]} />
        ))}
      </group>
    </group>
  );
}

// ---------- Hängebrücken und Felstreppen ----------

function curveFor(c: Connection, offset: number, lift: number, n = 24) {
  const dx = c.to[0] - c.from[0];
  const dz = c.to[2] - c.from[2];
  const len = Math.hypot(dx, dz);
  const px = -dz / len;
  const pz = dx / len;
  return new THREE.CatmullRomCurve3(
    Array.from({ length: n + 1 }, (_, i) => {
      const [x, y, z] = connectionPoint(c, i / n);
      return new THREE.Vector3(x + px * offset, y + lift, z + pz * offset);
    }),
  );
}

function Bridge({ c }: { c: Connection }) {
  const m = mats();
  const planks = useRef<THREE.InstancedMesh>(null);
  const len = Math.hypot(c.to[0] - c.from[0], c.to[2] - c.from[2]);
  const count = Math.max(4, Math.ceil(len / 0.3));
  const rails = useMemo(() => [-0.62, 0.62].map((o) => new THREE.TubeGeometry(curveFor(c, o, 0.85), 40, 0.035, 6)), [c]);
  const lower = useMemo(() => [-0.6, 0.6].map((o) => new THREE.TubeGeometry(curveFor(c, o, 0.02), 40, 0.03, 6)), [c]);
  const hangers = useMemo(() => {
    const out: { p: Vec3; h: number }[] = [];
    const dx = c.to[0] - c.from[0];
    const dz = c.to[2] - c.from[2];
    const px = -dz / len;
    const pz = dx / len;
    const k = Math.max(2, Math.round(len / 0.7));
    for (let i = 1; i < k; i++) {
      const [x, y, z] = connectionPoint(c, i / k);
      for (const o of [-0.62, 0.62]) out.push({ p: [x + px * o, y + 0.43, z + pz * o], h: 0.84 });
    }
    return out;
  }, [c, len]);

  useLayoutEffect(() => {
    const mesh = planks.current;
    if (!mesh) return;
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const a = new THREE.Vector3(...connectionPoint(c, Math.max(0, t - 0.01)));
      const b = new THREE.Vector3(...connectionPoint(c, Math.min(1, t + 0.01)));
      dir.subVectors(b, a).normalize();
      const side = new THREE.Vector3().crossVectors(up, dir).normalize();
      const nrm = new THREE.Vector3().crossVectors(dir, side).normalize();
      const basis = new THREE.Matrix4().makeBasis(dir, nrm, side);
      q.setFromRotationMatrix(basis);
      const wobble = new THREE.Quaternion().setFromAxisAngle(nrm, ((i * 7919) % 13) / 13 * 0.08 - 0.04);
      q.multiply(wobble);
      const p = new THREE.Vector3(...connectionPoint(c, t)).addScaledVector(nrm, -0.02);
      mtx.compose(p, q, new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, mtx);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [c, count]);

  const posts = [c.from, c.to].flatMap((p, end) => {
    const dx = c.to[0] - c.from[0];
    const dz = c.to[2] - c.from[2];
    const px = -dz / len;
    const pz = dx / len;
    const back = end === 0 ? -0.15 : 0.15;
    return [-0.66, 0.66].map((o) => [p[0] + px * o + (dx / len) * back, p[1], p[2] + pz * o + (dz / len) * back] as Vec3);
  });

  return (
    <group>
      <instancedMesh ref={planks} args={[box(0.26, 0.06, 1.2, 0.015), m.wood, count]} castShadow receiveShadow />
      {[...rails, ...lower].map((g, i) => (
        <mesh key={i} geometry={g} material={m.rope} castShadow />
      ))}
      {hangers.map((h, i) => (
        <mesh key={i} geometry={cyl(0.012, 0.012, h.h, 5)} material={m.rope} position={h.p} />
      ))}
      {posts.map((p, i) => (
        <group key={i} position={p}>
          <mesh geometry={cyl(0.09, 0.11, 1.25, 12)} material={m.log} position={[0, 0.55, 0]} castShadow />
          <mesh geometry={cyl(0.08, 0.08, 0.02, 12)} material={m.logEnd} position={[0, 1.18, 0]} />
        </group>
      ))}
    </group>
  );
}

function Stairs({ c }: { c: Connection }) {
  const m = mats();
  const steps = useRef<THREE.InstancedMesh>(null);
  const dx = c.to[0] - c.from[0];
  const dz = c.to[2] - c.from[2];
  const len = Math.hypot(dx, dz);
  const rise = Math.abs(c.to[1] - c.from[1]);
  const count = Math.max(3, Math.round(Math.max(len / 0.42, rise / 0.2)));
  const rot = Math.atan2(dx, dz);

  useLayoutEffect(() => {
    const mesh = steps.current;
    if (!mesh) return;
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const [x, y, z] = connectionPoint(c, t);
      const jitter = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot + (((i * 31) % 7) - 3) * 0.02, 0));
      mtx.compose(new THREE.Vector3(x, y - 0.12, z), i % 2 ? q : jitter, new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, mtx);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [c, count, rot]);

  // Holzpfosten mit Seil an beiden Seiten
  const rails = useMemo(() => [-0.78, 0.78].map((o) => new THREE.TubeGeometry(curveFor(c, o, 0.75, 16), 32, 0.028, 6)), [c]);
  const posts = useMemo(() => {
    const k = Math.max(2, Math.round(len / 1.4));
    const px = -dz / len;
    const pz = dx / len;
    return Array.from({ length: k + 1 }, (_, i) => {
      const [x, y, z] = connectionPoint(c, i / k);
      return [-0.78, 0.78].map((o) => [x + px * o, y - 0.08, z + pz * o] as Vec3);
    }).flat();
  }, [c, dx, dz, len]);

  return (
    <group>
      <instancedMesh ref={steps} args={[box(1.5, 0.24, len / count + 0.06, 0.05), m.stone, count]} castShadow receiveShadow />
      {rails.map((g, i) => (
        <mesh key={i} geometry={g} material={m.rope} />
      ))}
      {posts.map((p, i) => (
        <mesh key={i} geometry={cyl(0.06, 0.07, 0.9, 10)} material={m.log} position={[p[0], p[1] + 0.42, p[2]]} castShadow />
      ))}
    </group>
  );
}

export function Crossings() {
  return (
    <group>
      {CONNECTIONS.map((c) => (c.kind === 'bridge' ? <Bridge key={`${c.a}-${c.b}`} c={c} /> : <Stairs key={`${c.a}-${c.b}`} c={c} />))}
    </group>
  );
}

// ---------- Wasser ----------

const waterNormal = (() => {
  let t: THREE.Texture | null = null;
  return () => {
    if (!t) {
      t = tex('leafy').normal.clone();
      t.repeat.set(0.6, 0.6);
      t.needsUpdate = true;
    }
    return t;
  };
})();

export function Lake() {
  const m = mats();
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: '#3d8fe3', roughness: 0.15, metalness: 0.05, normalMap: waterNormal(), normalScale: new THREE.Vector2(0.25, 0.25),
      transparent: true, opacity: 0.92,
    }),
    [],
  );
  useFrame(() => {
    const t = worldTime.value;
    if (mat.normalMap) mat.normalMap.offset.set(t * 0.02, t * 0.013);
  });
  const reeds = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const a = i * 2.4 + 0.3;
    const r = LAKE.r + 0.05 + (i % 3) * 0.08;
    return { x: LAKE.pos[0] + Math.cos(a) * r, z: LAKE.pos[1] + Math.sin(a) * r, h: 0.4 + (i % 4) * 0.12 };
  }), []);
  return (
    <group>
      <mesh position={[LAKE.pos[0], LAKE.y, LAKE.pos[1]]} rotation={[-Math.PI / 2, 0, 0]} material={mat} receiveShadow>
        <circleGeometry args={[LAKE.r + 0.45, 40]} />
      </mesh>
      {reeds.map((r, i) => (
        <mesh key={i} geometry={cyl(0.015, 0.025, r.h, 5)} position={[r.x, heightAt(r.x, r.z) + r.h / 2, r.z]}>
          <meshStandardMaterial color={i % 2 ? '#6aae3c' : '#80c046'} roughness={0.9} />
        </mesh>
      ))}
      {[0.4, 2.1, 3.6, 5.0].map((a, i) => {
        const x = LAKE.pos[0] + Math.cos(a) * (LAKE.r + 0.35);
        const z = LAKE.pos[1] + Math.sin(a) * (LAKE.r + 0.35);
        return (
          <mesh key={i} geometry={sphere(0.28, 16, 10)} material={m.rock} position={[x, heightAt(x, z) + 0.05, z]} scale={[1.2, 0.6, 1]} castShadow />
        );
      })}
    </group>
  );
}

const waterfallMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: worldTime },
    vertexShader: `
      varying vec2 vUv; varying float vFall;
      attribute float fall;
      void main() { vUv = uv; vFall = fall; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime; varying vec2 vUv; varying float vFall;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        float speed = mix(0.6, 2.2, vFall);
        float s = n(vec2(vUv.x * 9.0, vUv.y * 1.4 - uTime * speed)) * 0.6 + n(vec2(vUv.x * 23.0, vUv.y * 3.0 - uTime * speed * 1.3)) * 0.4;
        vec3 deep = vec3(0.32, 0.66, 0.78);
        vec3 foam = vec3(0.96, 0.99, 1.0);
        vec3 c = mix(deep, foam, smoothstep(0.35, 0.85, s) * (0.4 + vFall * 0.6));
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float a = edge * mix(0.85, 0.75 + s * 0.25, vFall);
        gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
      }`,
  });

/** Wasserlauf: erst über das Plateau, dann die Felswand hinunter bis in die Wolken oder in die Schlucht. */
function Waterfall({ start, dir, width = 0.8 }: { start: Vec2; dir: Vec2; width?: number }) {
  const { geo, bottom } = useMemo(() => {
    const len = Math.hypot(dir[0], dir[1]);
    const ux = dir[0] / len;
    const uz = dir[1] / len;
    const pts: { p: THREE.Vector3; fall: number }[] = [];
    let prevY = heightAt(start[0], start[1]);
    for (let s = 0; s < 22; s += 0.22) {
      const x = start[0] + ux * s;
      const z = start[1] + uz * s;
      const y = heightAt(x, z);
      const drop = Math.max(0, prevY - y) / 0.22;
      pts.push({ p: new THREE.Vector3(x + ux * Math.min(0.35, drop * 0.1), y + 0.07 + Math.min(0.3, drop * 0.06), z + uz * Math.min(0.35, drop * 0.1)), fall: Math.min(1, drop * 0.6) });
      prevY = y;
      if (y < 0.2) break;
      // unten in der Schlucht angekommen und wieder flach
      if (pts.length > 12 && drop < 0.05 && pts[pts.length - 6].p.y - y > 1.5) break;
    }
    const positions: number[] = [];
    const uvs: number[] = [];
    const falls: number[] = [];
    const idx: number[] = [];
    let v = 0;
    pts.forEach((pt, i) => {
      const w = width * (0.8 + pt.fall * 0.6) * 0.5;
      positions.push(pt.p.x - uz * w, pt.p.y, pt.p.z + ux * w, pt.p.x + uz * w, pt.p.y, pt.p.z - ux * w);
      if (i > 0) v += pt.p.distanceTo(pts[i - 1].p);
      uvs.push(0, v, 1, v);
      falls.push(pt.fall, pt.fall);
      if (i < pts.length - 1) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('fall', new THREE.Float32BufferAttribute(falls, 1));
    g.setIndex(idx);
    return { geo: g, bottom: pts[pts.length - 1]?.p ?? new THREE.Vector3() };
  }, [start, dir, width]);
  const mat = useMemo(waterfallMaterial, []);
  return (
    <group>
      <mesh geometry={geo} material={mat} renderOrder={2} />
      <Mist position={[bottom.x, bottom.y + 0.3, bottom.z]} />
    </group>
  );
}

function Mist({ position }: { position: Vec3 }) {
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  const map = softDotTexture();
  useFrame(() => {
    const t = worldTime.value;
    refs.current.forEach((s, i) => {
      if (!s) return;
      const u = (t * 0.25 + i / 4) % 1;
      s.position.set(Math.sin(i * 2.1) * 0.4, u * 1.2, Math.cos(i * 1.7) * 0.4);
      s.scale.setScalar(0.8 + u * 1.6);
      (s.material as THREE.SpriteMaterial).opacity = 0.5 * (1 - u);
    });
  });
  return (
    <group position={position}>
      {[0, 1, 2, 3].map((i) => (
        <sprite key={i} ref={(s) => { refs.current[i] = s; }}>
          <spriteMaterial map={map} color="#ffffff" transparent depthWrite={false} opacity={0.4} />
        </sprite>
      ))}
    </group>
  );
}

export function Waterfalls() {
  const lakeOut = useMemo(() => {
    const c = PEAKS.clay.pos;
    const d: Vec2 = [LAKE.pos[0] - c[0], LAKE.pos[1] - c[1]];
    return { start: [LAKE.pos[0] + d[0] * 0.3, LAKE.pos[1] + d[1] * 0.3] as Vec2, dir: d };
  }, []);
  const spring = (key: string, deg: number) => {
    const p = PEAKS[key];
    const a = (deg * Math.PI) / 180;
    const d: Vec2 = [Math.cos(a), Math.sin(a)];
    return { start: [p.pos[0] + d[0] * (p.r - 0.9), p.pos[1] + d[1] * (p.r - 0.9)] as Vec2, dir: d };
  };
  const forest = spring('forest', (Math.atan2(-PEAKS.forest.pos[1], -PEAKS.forest.pos[0]) * 180) / Math.PI + 38);
  const quarry = spring('quarry', (Math.atan2(PEAKS.quarry.pos[1], PEAKS.quarry.pos[0]) * 180) / Math.PI - 30);
  return (
    <group>
      <Waterfall start={lakeOut.start} dir={lakeOut.dir} width={0.9} />
      <Waterfall start={forest.start} dir={forest.dir} width={0.7} />
      <Waterfall start={quarry.start} dir={quarry.dir} width={0.6} />
    </group>
  );
}

// ---------- Kontaktschatten unter Gebäuden ----------

export function GroundShadow({ radius, opacity = 0.22 }: { radius: number; opacity?: number }) {
  const map = softDotTexture();
  return (
    <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <planeGeometry args={[radius * 2, radius * 2]} />
      <meshBasicMaterial map={map} color="#5a4526" transparent opacity={opacity} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
}

/** Plot-Hilfe: Höhe des Plateaus unter einem Gebäude. */
export const plotY = (type: string) => PLOTS[type]?.y ?? 0;

export { bridgeSag };
