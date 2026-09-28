import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import land from "world-atlas/land-110m.json";
import type { Line2 } from "three-stdlib";
import { coordsOf } from "@/domain/geo";

/**
 * Tanıtım sayfasının açılış küresi — gerçek kıta sınırlarından örneklenmiş
 * nokta dokusu, İstanbul'dan kalkan kırmızı uçuş yayları.
 *
 * Kara maskesi Natural Earth 1:110m verisinden (world-atlas) bir kanvasa
 * eşdikdörtgen olarak çizilir; enlem halkaları boyunca eşit aralıklı noktalar
 * yalnız karaya düşüyorsa tutulur. Ağdan veri indirilmez.
 */

const D2R = Math.PI / 180;
const STEP = 1.2; // noktalar arası derece
const DOT = 0.0068;
const RED = new THREE.Color("#c70a0c");
const INK = new THREE.Color("#45454b");
const HUB = "IST";
const DESTS = ["LHR", "JFK", "DXB", "SIN", "CDG", "JNB", "FRA", "DEL", "CAI", "MAD", "NRT", "NBO", "BKK", "ARN"];
const SEGMENTS = 72;
const PERIOD = 9; // bir yayın doğup söndüğü süre (sn)
const VIEW_LON = 34; // kürenin ön yüzünün boylamı
const TILT = 0.42;

function vec(lat: number, lon: number, r = 1): THREE.Vector3 {
  const la = lat * D2R;
  const lo = lon * D2R;
  return new THREE.Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo));
}

type Dot = { v: THREE.Vector3; home: boolean };

/** Türkiye'nin kaba sınırı (boylam, enlem) — ev noktaları kırmızı çizilir. */
const TURKEY: [number, number][] = [
  [26.0, 40.6], [26.6, 41.7], [28.0, 42.0], [31.0, 41.2], [33.5, 42.1], [36.0, 41.7], [38.5, 41.0], [41.5, 41.5],
  [43.4, 41.1], [44.8, 39.7], [44.3, 37.2], [42.4, 37.1], [40.0, 36.9], [38.0, 36.8], [36.6, 36.2], [36.0, 35.8],
  [35.8, 36.8], [34.0, 36.2], [32.5, 36.1], [30.5, 36.3], [29.0, 36.6], [27.4, 37.0], [26.3, 38.3], [26.6, 39.5], [26.1, 40.0],
];

function inside(poly: [number, number][], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function landDots(): Dot[] {
  const W = 1440;
  const H = 720;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  const topo = land as unknown as Topology;
  const geo = feature(topo, topo.objects.land) as FeatureCollection<Polygon | MultiPolygon> | Feature<Polygon | MultiPolygon>;
  const features = "features" in geo ? geo.features : [geo];
  const px = ([lon, lat]: Position): [number, number] => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
  ctx.fillStyle = "#000";
  ctx.beginPath();
  for (const f of features) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      for (const ring of poly) {
        ring.forEach((p, i) => {
          const [x, y] = px(p);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
    }
  }
  ctx.fill("evenodd");
  const data = ctx.getImageData(0, 0, W, H).data;
  const isLand = (lat: number, lon: number) => {
    const x = Math.min(W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * W)));
    const y = Math.min(H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * H)));
    return data[(y * W + x) * 4 + 3] > 128;
  };

  const dots: Dot[] = [];
  let row = 0;
  for (let lat = -56; lat <= 82; lat += STEP, row++) {
    const n = Math.max(1, Math.round((360 / STEP) * Math.cos(lat * D2R)));
    for (let i = 0; i < n; i++) {
      const lon = -180 + ((i + (row % 2) * 0.5) * 360) / n;
      if (!isLand(lat, lon)) continue;
      dots.push({ v: vec(lat, lon, 1.001), home: inside(TURKEY, lon, lat) });
    }
  }
  return dots;
}

function Dots({ dots }: { dots: Dot[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    const out = new THREE.Vector3();
    dots.forEach((d, i) => {
      o.position.copy(d.v);
      o.lookAt(out.copy(d.v).multiplyScalar(2));
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, d.home ? RED : INK);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [dots]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, dots.length]}>
      <circleGeometry args={[DOT, 8]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

/** Arka yüzdeki noktaları örten, kenara doğru hafif kırmızıya dönen küre. */
function Body() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { rim: { value: new THREE.Color("#efe3e3") } },
        vertexShader: `
          varying vec3 vN; varying vec3 vV;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform vec3 rim; varying vec3 vN; varying vec3 vV;
          void main() {
            float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.2);
            gl_FragColor = vec4(mix(vec3(1.0), rim, f), 1.0);
          }`,
      }),
    [],
  );
  return (
    <mesh material={material}>
      <sphereGeometry args={[0.994, 96, 96]} />
    </mesh>
  );
}

function arc(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] {
  const angle = a.angleTo(b);
  const lift = 0.04 + 0.2 * (angle / Math.PI);
  const pts: THREE.Vector3[] = [];
  const q = new THREE.Quaternion();
  const axis = new THREE.Vector3().crossVectors(a, b).normalize();
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    q.setFromAxisAngle(axis, angle * t);
    const v = a.clone().normalize().applyQuaternion(q);
    pts.push(v.multiplyScalar(1 + lift * Math.sin(Math.PI * t)));
  }
  return pts;
}

type Route = { code: string; pts: THREE.Vector3[]; end: THREE.Vector3; offset: number };

function useRoutes(): { hub: THREE.Vector3; routes: Route[] } {
  return useMemo(() => {
    const [hlat, hlon] = coordsOf(HUB) ?? [41.275, 28.752];
    const hub = vec(hlat, hlon);
    const routes = DESTS.flatMap((code, i) => {
      const c = coordsOf(code);
      if (!c) return [];
      const end = vec(c[0], c[1]);
      return [{ code, pts: arc(hub, end), end, offset: (i / DESTS.length) * PERIOD }];
    });
    return { hub, routes };
  }, []);
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Yüzeye yatık halka (dışa bakan normal) — iniş ve merkez darbesi. */
function Ring({ at, size, still }: { at: THREE.Vector3; size: number; still?: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useLayoutEffect(() => {
    ref.current?.position.copy(at).multiplyScalar(1.003);
    ref.current?.lookAt(at.clone().multiplyScalar(2));
  }, [at]);
  return (
    <mesh ref={ref} visible={!still}>
      <ringGeometry args={[size * 0.72, size, 40]} />
      <meshBasicMaterial color={RED} transparent opacity={0} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Flight({ route, reduce }: { route: Route; reduce: boolean }) {
  const line = useRef<Line2>(null);
  const head = useRef<THREE.Mesh>(null);
  const land = useRef<THREE.Group>(null);
  const pts = route.pts;

  useFrame(({ clock }) => {
    const l = line.current;
    if (!l || reduce) return;
    const t = ((clock.elapsedTime + route.offset) % PERIOD) / PERIOD;
    const grow = Math.min(1, t / 0.24);
    const k = ease(grow);
    const visible = t < 0.86;
    l.geometry.instanceCount = visible ? Math.max(1, Math.floor(k * SEGMENTS)) : 0;
    l.material.opacity = t < 0.7 ? 0.95 : Math.max(0, 0.95 * (1 - (t - 0.7) / 0.16));
    if (head.current) {
      head.current.visible = grow < 1;
      const p = pts[Math.min(SEGMENTS, Math.round(k * SEGMENTS))];
      head.current.position.copy(p);
    }
    const ring = land.current?.children[0] as THREE.Mesh | undefined;
    if (ring) {
      const lt = (t - 0.24) / 0.2;
      const on = lt > 0 && lt < 1;
      ring.visible = on;
      if (on) {
        ring.scale.setScalar(1 + lt * 2.4);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - lt);
      }
    }
  });

  return (
    <group>
      <Line points={pts} color="#c70a0c" lineWidth={1} transparent opacity={0.14} depthWrite={false} />
      <Line
        ref={line}
        points={pts}
        color="#c70a0c"
        lineWidth={1.8}
        transparent
        opacity={reduce ? 0.8 : 0}
        depthWrite={false}
      />
      <mesh ref={head} visible={false}>
        <sphereGeometry args={[0.012, 12, 12]} />
        <meshBasicMaterial color={RED} toneMapped={false} />
      </mesh>
      <mesh position={route.end.clone().multiplyScalar(1.004)}>
        <sphereGeometry args={[0.009, 10, 10]} />
        <meshBasicMaterial color={RED} toneMapped={false} />
      </mesh>
      <group ref={land}>
        <Ring at={route.end} size={0.022} still={reduce} />
      </group>
    </group>
  );
}

function Hub({ at, label, reduce }: { at: THREE.Vector3; label: string; reduce: boolean }) {
  const rings = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (reduce || !rings.current) return;
    rings.current.children.forEach((child, i) => {
      const t = ((clock.elapsedTime * 0.55 + i * 0.5) % 1 + 1) % 1;
      const m = child as THREE.Mesh;
      m.visible = true;
      m.scale.setScalar(1 + t * 3.2);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - t);
    });
  });
  return (
    <group>
      <mesh position={at.clone().multiplyScalar(1.006)}>
        <sphereGeometry args={[0.019, 16, 16]} />
        <meshBasicMaterial color={RED} toneMapped={false} />
      </mesh>
      <group ref={rings}>
        <Ring at={at} size={0.03} still />
        <Ring at={at} size={0.03} still />
      </group>
      <Html position={at.clone().multiplyScalar(1.02)} center zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <div
          className="translate-x-[46px] -translate-y-[16px] whitespace-nowrap rounded-full border border-black/[0.08] bg-white/95 px-2.5 py-1 text-[11px] font-semibold tracking-tight text-[#1d1d1f] shadow-[0_6px_18px_-8px_rgba(0,0,0,0.3)]"
        >
          <span className="mr-1.5 inline-block size-1.5 -translate-y-px rounded-full bg-[#c70a0c] align-middle" />
          {label}
        </div>
      </Html>
    </group>
  );
}

function World({ reduce, label, drag }: { reduce: boolean; label: string; drag: React.MutableRefObject<{ offset: number; velocity: number; active: boolean }> }) {
  const spin = useRef<THREE.Group>(null);
  const dots = useMemo(landDots, []);
  const { hub, routes } = useRoutes();

  useFrame(({ clock }, delta) => {
    const g = spin.current;
    if (!g) return;
    const d = drag.current;
    if (!d.active) {
      d.offset += d.velocity;
      d.velocity *= 0.92;
      d.offset *= 1 - Math.min(1, delta * 0.35);
    }
    const sway = reduce ? 0 : Math.sin(clock.elapsedTime * 0.11) * 0.32;
    g.rotation.y = -VIEW_LON * D2R + sway + d.offset;
  });

  return (
    <group rotation={[TILT, 0, -0.12]}>
      <group ref={spin}>
        <Body />
        <Dots dots={dots} />
        {routes.map((r) => <Flight key={r.code} route={r} reduce={reduce} />)}
        <Hub at={hub} label={label} reduce={reduce} />
      </group>
    </group>
  );
}

export default function DotGlobe({ reduce, label }: { reduce: boolean; label: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const drag = useRef({ offset: 0, velocity: 0, active: false });
  const last = useRef(0);

  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={wrap}
      className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
      onPointerDown={(e) => {
        drag.current.active = true;
        drag.current.velocity = 0;
        last.current = e.clientX;
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current.active) return;
        const dx = e.clientX - last.current;
        last.current = e.clientX;
        drag.current.offset += dx * 0.006;
        drag.current.velocity = dx * 0.006;
      }}
      onPointerUp={() => { drag.current.active = false; }}
      onPointerCancel={() => { drag.current.active = false; }}
    >
      <Canvas
        frameloop={visible ? "always" : "never"}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 4.1], fov: 32 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <fog attach="fog" args={["#ffffff", 3.15, 4.7]} />
        <World reduce={reduce} label={label} drag={drag} />
      </Canvas>
    </div>
  );
}
