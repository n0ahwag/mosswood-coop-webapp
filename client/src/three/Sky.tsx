// Himmel, Wolkenmeer, ferne Berge und Licht. Wird von Dorf und Tal benutzt.

import { Environment, Lightformer } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { QUALITY, worldTime } from './clock';
import { fbm2, mulberry32 } from './layout';

export const SKY = {
  zenith: '#4c9fe6',
  horizon: '#d6ecfa',
  fog: '#dcebf5',
  sun: new THREE.Vector3(0.55, 0.62, 0.35).normalize(),
  cloudTop: '#ffffff',
  cloudShade: '#c4d6ee',
};

// ---------- Himmelskuppel ----------

export function SkyDome() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uZenith: { value: new THREE.Color(SKY.zenith) },
          uHorizon: { value: new THREE.Color(SKY.horizon) },
          uSun: { value: SKY.sun },
        },
        vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
        fragmentShader: `
          uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSun; varying vec3 vDir;
          void main() {
            vec3 d = normalize(vDir);
            float h = clamp(d.y, -0.2, 1.0);
            vec3 c = mix(uHorizon, uZenith, pow(smoothstep(-0.02, 0.75, h), 0.7));
            float s = max(dot(d, uSun), 0.0);
            c += vec3(1.0, 0.86, 0.6) * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.22 + pow(s, 3.0) * 0.06);
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[480, 32, 16]} />
    </mesh>
  );
}

// ---------- Wolkenmeer ----------

export function CloudSea({ y = 0.15 }: { y?: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        fog: false,
        uniforms: {
          uTime: worldTime,
          uTop: { value: new THREE.Color(SKY.cloudTop) },
          uShade: { value: new THREE.Color(SKY.cloudShade) },
          uHorizon: { value: new THREE.Color(SKY.horizon) },
          uSun: { value: SKY.sun },
        },
        vertexShader: `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `
          uniform float uTime; uniform vec3 uTop; uniform vec3 uShade; uniform vec3 uHorizon; uniform vec3 uSun; varying vec3 vW;
          float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float n(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
          float fbm(vec2 p) { float s = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
          float billow(vec2 p) { return 1.0 - abs(fbm(p) * 2.0 - 1.0); }
          void main() {
            vec2 drift = vec2(uTime * 0.012, uTime * 0.007);
            vec2 p = vW.xz * 0.05 + drift;
            float c = billow(p);
            float e = 0.08;
            float cx = billow(p + vec2(e, 0.0));
            float cz = billow(p + vec2(0.0, e));
            vec3 nrm = normalize(vec3((c - cx) * 3.0, 1.0, (c - cz) * 3.0));
            float lit = clamp(dot(nrm, uSun) * 0.7 + 0.45, 0.0, 1.0);
            vec3 col = mix(uShade, uTop, lit * (0.55 + c * 0.6));
            float dist = length(vW.xz - cameraPosition.xz);
            col = mix(col, uHorizon, smoothstep(90.0, 380.0, dist) * 0.85);
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  return (
    <mesh material={mat} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-5}>
      <circleGeometry args={[460, 64]} />
    </mesh>
  );
}

// ---------- Wolkenbänke: weiche Ballen am Fuß des Berges und am Himmel ----------

export function CloudBanks({ center = [0, 0], innerRadius = 20, outerRadius = 42, count = 26, seed = 3 }: {
  center?: [number, number];
  innerRadius?: number;
  outerRadius?: number;
  count?: number;
  seed?: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);
  const puffs = useMemo(() => {
    const rng = mulberry32(seed);
    const out: { p: THREE.Vector3; s: number }[] = [];
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2;
      const r = innerRadius + rng() * (outerRadius - innerRadius);
      const cx = center[0] + Math.cos(a) * r;
      const cz = center[1] + Math.sin(a) * r;
      const blobs = 3 + Math.floor(rng() * 4);
      for (let j = 0; j < blobs; j++) {
        out.push({
          p: new THREE.Vector3(cx + (j - blobs / 2) * 1.6 + rng(), 0.2 + rng() * 0.9 + (j % 2) * 0.5, cz + (rng() - 0.5) * 2.5),
          s: 1.4 + rng() * 2.2,
        });
      }
    }
    // ein paar Wolken hoch am Himmel
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rng();
      const r = 55 + rng() * 30;
      const cx = center[0] + Math.cos(a) * r;
      const cz = center[1] + Math.sin(a) * r;
      for (let j = 0; j < 5; j++) {
        out.push({ p: new THREE.Vector3(cx + (j - 2) * 2.6, 22 + rng() * 8 + (j % 2) * 1.2, cz + (rng() - 0.5) * 2), s: 2 + rng() * 2.2 });
      }
    }
    return out;
  }, [center, innerRadius, outerRadius, count, seed]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    puffs.forEach((pf, i) => {
      m.compose(pf.p, new THREE.Quaternion(), new THREE.Vector3(pf.s, pf.s * 0.62, pf.s));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [puffs]);

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.004;
  });

  return (
    <group ref={group}>
      <instancedMesh ref={ref} args={[undefined, undefined, puffs.length]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 3]} />
        <meshStandardMaterial color="#ffffff" emissive="#e4f0ff" emissiveIntensity={0.5} roughness={1} />
      </instancedMesh>
    </group>
  );
}

// ---------- Ferne Gipfel ----------

function mountainGeometry(seed: number, height: number, radius: number) {
  const g = new THREE.ConeGeometry(radius, height, 48, 18, true);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const snow = new THREE.Color('#ffffff');
  const rock = new THREE.Color('#9aaccc');
  const forest = new THREE.Color('#7fa98e');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = (y + height / 2) / height;
    const a = Math.atan2(z, x);
    const ridges = fbm2(Math.cos(a) * 3 + seed, Math.sin(a) * 3 + t * 4, 4);
    const k = 1 + (ridges - 0.5) * 0.55 * (1 - t * 0.4);
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
    pos.setY(i, y + (ridges - 0.5) * height * 0.08);
    const snowLine = 0.62 + (fbm2(a * 4 + seed, 1, 3) - 0.5) * 0.25;
    c.copy(forest).lerp(rock, THREE.MathUtils.smoothstep(t, 0.15, 0.45)).lerp(snow, THREE.MathUtils.smoothstep(t, snowLine, snowLine + 0.06));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

export function DistantMountains({ count = 18, minR = 150, maxR = 230, seed = 9 }: { count?: number; minR?: number; maxR?: number; seed?: number }) {
  const items = useMemo(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + rng() * 0.25;
      const r = minR + rng() * (maxR - minR);
      const h = 40 + rng() * 55;
      return { pos: [Math.cos(a) * r, h / 2 - 14, Math.sin(a) * r] as [number, number, number], geo: mountainGeometry(i * 13.7 + seed, h, h * (0.7 + rng() * 0.4)) };
    });
  }, [count, minR, maxR, seed]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: false }), []);
  return (
    <group>
      {items.map((it, i) => (
        <mesh key={i} geometry={it.geo} material={mat} position={it.pos} />
      ))}
    </group>
  );
}

// ---------- Licht ----------

export function Lights({ shadowSize = 36, target = [0, 3, 0] as [number, number, number] }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const mapSize = QUALITY === 'high' ? 4096 : 2048;
  useLayoutEffect(() => {
    const l = sun.current;
    if (!l) return;
    l.target.position.set(...target);
    l.target.updateMatrixWorld();
    // weichere, hellere Schatten wirken freundlicher
    (l.shadow as THREE.LightShadow & { intensity?: number }).intensity = 0.68;
  }, [target]);
  const sunPos = SKY.sun.clone().multiplyScalar(60).add(new THREE.Vector3(...target));
  return (
    <>
      <hemisphereLight args={['#e4efff', '#7fa860', 0.85]} />
      <directionalLight
        ref={sun}
        position={sunPos}
        intensity={2.8}
        color="#fff1cf"
        castShadow
        shadow-mapSize={[mapSize, mapSize]}
        shadow-camera-left={-shadowSize}
        shadow-camera-right={shadowSize}
        shadow-camera-top={shadowSize}
        shadow-camera-bottom={-shadowSize}
        shadow-camera-near={10}
        shadow-camera-far={130}
        shadow-bias={-0.0004}
        shadow-normalBias={0.035}
      />
      {/* Weiches Umgebungslicht für Glanz und Tiefe, ohne externe Bilddateien */}
      <Environment resolution={128} frames={1} environmentIntensity={0.35}>
        <color attach="background" args={['#cfe3ee']} />
        <Lightformer form="rect" intensity={2.2} color="#fff4de" position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[40, 40, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#bcd9ff" position={[-14, 4, -10]} scale={[20, 8, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.9} color="#ffd9a8" position={[16, 3, 12]} scale={[18, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.6} color="#9fbf7a" position={[0, -8, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[40, 40, 1]} />
      </Environment>
    </>
  );
}
