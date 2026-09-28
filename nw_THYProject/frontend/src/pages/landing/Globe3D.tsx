import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import * as THREE from "three";
import { coordsOf } from "@/domain/geo";

/**
 * Interline küresi — kırmızı zemin üstünde beyaz enlem/boylam ağı, nokta
 * dokusu ve İstanbul'dan çıkan büyük daire yayları. Yaylar üzerinde kesikli
 * çizgi akar (kupon kontrolünün ağda dolaşması). Ağdan veri indirilmez;
 * koordinatlar `domain/geo.ts`'ten gelir.
 */

const RADIUS = 2;
const HUB = "IST";
const DESTS = ["LHR", "FRA", "CDG", "MAD", "JFK", "YYZ", "LAX", "GRU", "JNB", "NBO", "CAI", "DXB", "DEL", "BKK", "SIN", "PEK", "ICN", "NRT"];

function toVec(lat: number, lon: number, r = RADIUS): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

function arcPoints(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] {
  const angle = a.angleTo(b);
  const lift = 0.06 + 0.32 * (angle / Math.PI);
  const pts: THREE.Vector3[] = [];
  const n = 64;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const v = new THREE.Vector3().copy(a).normalize().lerp(b.clone().normalize(), t).normalize();
    pts.push(v.multiplyScalar(RADIUS * (1 + lift * Math.sin(Math.PI * t))));
  }
  return pts;
}

function graticule(): Float32Array {
  const out: number[] = [];
  const push = (p: THREE.Vector3, q: THREE.Vector3) => out.push(p.x, p.y, p.z, q.x, q.y, q.z);
  for (let lat = -60; lat <= 60; lat += 20) {
    for (let lon = -180; lon < 180; lon += 4) push(toVec(lat, lon, RADIUS * 1.001), toVec(lat, lon + 4, RADIUS * 1.001));
  }
  for (let lon = -180; lon < 180; lon += 20) {
    for (let lat = -84; lat < 84; lat += 4) push(toVec(lat, lon, RADIUS * 1.001), toVec(lat + 4, lon, RADIUS * 1.001));
  }
  return new Float32Array(out);
}

function fibonacciDots(n: number): Float32Array {
  const out = new Float32Array(n * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    out[i * 3] = Math.cos(th) * r * RADIUS * 1.003;
    out[i * 3 + 1] = y * RADIUS * 1.003;
    out[i * 3 + 2] = Math.sin(th) * r * RADIUS * 1.003;
  }
  return out;
}

type LineRef = { material: { dashOffset: number } };

function Arc({ points, speed, delay }: { points: THREE.Vector3[]; speed: number; delay: number }) {
  const ref = useRef<LineRef>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.material.dashOffset -= dt * speed;
  });
  return (
    <>
      <Line points={points} color="#ffffff" lineWidth={1} transparent opacity={0.28} />
      <Line
        ref={ref as never}
        points={points}
        color="#ffffff"
        lineWidth={2.2}
        dashed
        dashSize={0.35}
        gapSize={2.4}
        dashOffset={delay}
        transparent
        opacity={0.95}
      />
    </>
  );
}

function Globe({ reduce, hubLabel }: { reduce: boolean; hubLabel: string }) {
  const spin = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Mesh>(null);

  const data = useMemo(() => {
    const [hl, hn] = coordsOf(HUB)!;
    const hub = toVec(hl, hn);
    const arcs = DESTS.flatMap((code, i) => {
      const c = coordsOf(code);
      if (!c) return [];
      const to = toVec(c[0], c[1]);
      return [{ code, to, points: arcPoints(hub, to), speed: 0.8 + (i % 5) * 0.12, delay: i * 0.37 }];
    });
    const lines = new THREE.BufferGeometry();
    lines.setAttribute("position", new THREE.BufferAttribute(graticule(), 3));
    const dots = new THREE.BufferGeometry();
    dots.setAttribute("position", new THREE.BufferAttribute(fibonacciDots(2600), 3));
    // İstanbul kameraya dönük başlasın.
    const base = -Math.atan2(hub.x, hub.z);
    return { hub, arcs, lines, dots, base };
  }, []);

  useFrame((state) => {
    const t = reduce ? 0 : state.clock.elapsedTime;
    if (spin.current) spin.current.rotation.y = data.base + Math.sin(t * 0.12) * 0.55;
    if (pulse.current) {
      const k = (t * 0.6) % 1;
      pulse.current.scale.setScalar(1 + k * 2.6);
      (pulse.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - k);
    }
  });

  return (
    <group rotation={[0.42, 0, 0]}>
      <group ref={spin}>
        <mesh>
          <sphereGeometry args={[RADIUS, 96, 96]} />
          <meshStandardMaterial color="#a8080a" roughness={0.55} metalness={0.1} />
        </mesh>
        <mesh>
          <sphereGeometry args={[RADIUS * 1.07, 64, 64]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.05} side={THREE.BackSide} />
        </mesh>
        <lineSegments geometry={data.lines}>
          <lineBasicMaterial color="#ffffff" transparent opacity={0.16} />
        </lineSegments>
        <points geometry={data.dots}>
          <pointsMaterial color="#ffffff" size={0.018} transparent opacity={0.4} sizeAttenuation />
        </points>

        {data.arcs.map((a) => (
          <group key={a.code}>
            <Arc points={a.points} speed={a.speed} delay={a.delay} />
            <mesh position={a.to}>
              <sphereGeometry args={[0.028, 16, 16]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
        ))}

        <group position={data.hub} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), data.hub.clone().normalize())}>
          <mesh>
            <circleGeometry args={[0.06, 32]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh ref={pulse}>
            <ringGeometry args={[0.07, 0.085, 48]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
          </mesh>
          <Html position={[0, -0.16, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
            <span className="whitespace-nowrap rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-[#c70a0c] shadow-lg">{hubLabel}</span>
          </Html>
        </group>
      </group>
    </group>
  );
}

export default function Globe3D({ active, reduce, hubLabel }: { active: boolean; reduce: boolean; hubLabel: string }) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 6.2], fov: 38 }}
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[-4, 5, 5]} intensity={1.6} />
      <Globe reduce={reduce} hubLabel={hubLabel} />
    </Canvas>
  );
}
