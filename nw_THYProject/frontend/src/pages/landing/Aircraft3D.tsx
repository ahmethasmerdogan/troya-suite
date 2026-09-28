import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import type { MotionValue } from "motion/react";

/**
 * Açılış sahnesi — THY boyalı uçak, tamamen kodla üretilir (dış model yok,
 * ağdan hiçbir şey indirilmez). Gövde bir lathe profili, kanat ve kuyruklar
 * ekstrüzyon; boya (pencereler, yazı, kokpit) çalışma anında bir canvas'a
 * çizilir. Kaydırma ilerlemesi (`progress`, 0→1) uçağı yatırıp uzaklaştırır.
 */

const RED = "#c70a0c";
const BIRD =
  "M14 70 C 34 64, 48 58, 60 40 C 64 33, 70 28, 80 27 C 74 32, 72 38, 75 45 C 84 41, 93 44, 98 52 C 88 50, 80 54, 72 61 C 60 71, 38 76, 16 73 L 12 86 L 22 72 C 19 71, 16 71, 14 70 Z";

/* --- gövde ---------------------------------------------------------- */

const S0 = -4.3; // kuyruk ucu
const S1 = 4.25; // burun ucu
const R = 0.5;

function fuselageProfile(): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const N = 120;
  for (let i = 0; i <= N; i++) {
    const s = S0 + ((S1 - S0) * i) / N;
    let r = R;
    if (s > 2.4) {
      const k = (s - 2.4) / (S1 - 2.4);
      r = R * Math.sqrt(Math.max(0, 1 - k ** 2.2));
    } else if (s < -1.8) {
      const k = (-1.8 - s) / (-1.8 - S0);
      r = R * Math.max(0, 1 - k ** 1.8);
    }
    pts.push(new THREE.Vector2(r, s));
  }
  return pts;
}

/** Boya: 1 birim = 326 px her iki eksende (yazı basık görünmesin). */
function makeLivery(): THREE.CanvasTexture {
  const W = 1024;
  const H = Math.round(((S1 - S0) * W) / (2 * Math.PI * R));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, W, H);

  const X = (u: number) => u * W;
  const Y = (s: number) => (1 - (s - S0) / (S1 - S0)) * H;
  const ppu = W / (2 * Math.PI * R);

  // Pencereler — her iki yan, gövde ortasının biraz üstünde.
  g.fillStyle = "#20232b";
  for (const u of [0.43, 0.07]) {
    for (let s = -1.55; s < 2.35; s += 0.19) {
      if (Math.abs(s - 0.35) < 0.12) continue; // kanat üstü çıkış kapısı boşluğu
      const w = 0.085 * ppu;
      const h = 0.13 * ppu;
      g.beginPath();
      g.roundRect(X(u) - h / 2, Y(s) - w / 2, h, w, Math.min(w, h) / 2.2);
      g.fill();
    }
  }

  // Kapı çizgileri
  g.strokeStyle = "#d4d7dd";
  g.lineWidth = 3;
  for (const u of [0.43, 0.07]) {
    for (const s of [2.72, -1.78]) {
      g.beginPath();
      g.roundRect(X(u) - 0.12 * ppu, Y(s) - 0.09 * ppu, 0.36 * ppu, 0.18 * ppu, 10);
      g.stroke();
    }
  }

  // Kokpit camı — burnun üstünü saran koyu şerit.
  g.fillStyle = "#1a1c22";
  g.beginPath();
  g.moveTo(X(0.08), Y(3.3));
  g.lineTo(X(0.42), Y(3.3));
  g.lineTo(X(0.42), Y(3.5));
  g.quadraticCurveTo(X(0.25), Y(3.72), X(0.08), Y(3.5));
  g.closePath();
  g.fill();

  // "TURKISH AIRLINES" — yakın yan (+z) soldan sağa, uzak yan tersinden.
  const text = (u: number, s: number, rot: number) => {
    g.save();
    g.translate(X(u), Y(s));
    g.rotate(rot);
    g.fillStyle = RED;
    g.font = `600 ${Math.round(0.17 * ppu)}px "Geist Variable", Helvetica, Arial, sans-serif`;
    (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round(0.03 * ppu)}px`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("TURKISH AIRLINES", 0, 0);
    g.restore();
  };
  text(0.36, 0.6, -Math.PI / 2);
  text(0.14, 0.6, Math.PI / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeLogo(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2);
  g.fill();
  const k = 3.6;
  g.translate(S / 2 - 55 * k, S / 2 - 56 * k);
  g.scale(k, k);
  g.fillStyle = RED;
  g.fill(new Path2D(BIRD));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* --- yüzeyler ------------------------------------------------------- */

type P = [number, number];

function extruded(points: P[], depth: number, bevel: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 6,
  });
  return geo;
}

/** Yatay yüzey (kanat, yatay stabilize): şekil x=veter, y=açıklık → dünya x/z. */
function planform(points: P[], depth: number, bevel: number): THREE.ExtrudeGeometry {
  const geo = extruded(points, depth, bevel);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, depth / 2, 0);
  return geo;
}

function mirror(points: P[]): P[] {
  return points.map(([x, y]) => [x, -y]);
}

const WING: P[] = [[0.95, 0.3], [-1.3, 4.3], [-1.85, 4.3], [-1.25, 1.55], [-1.1, 0.3]];
const STAB: P[] = [[-3.25, 0.2], [-3.98, 1.62], [-4.3, 1.62], [-4.05, 0.2]];
const FIN: P[] = [[-2.45, 0.2], [-3.55, 2.2], [-4.05, 2.2], [-4.25, 0.2]];
const WINGLET: P[] = [[-1.28, 0], [-1.86, 0], [-2.0, 0.5], [-1.74, 0.5]];

function nacelleProfile(): THREE.Vector2[] {
  const pts: [number, number][] = [
    [0.17, -0.78], [0.22, -0.7], [0.27, -0.45], [0.31, -0.1], [0.325, 0.3], [0.32, 0.55], [0.305, 0.7], [0.285, 0.76],
  ];
  return pts.map(([r, s]) => new THREE.Vector2(r, s));
}

/* --- uçak ----------------------------------------------------------- */

function Aircraft({ progress, reduce }: { progress?: MotionValue<number>; reduce: boolean }) {
  const ref = useRef<THREE.Group>(null);
  // Ölçek ve konum ekran oranından: masaüstünde metnin altında büyük, telefonda sığacak kadar.
  const viewport = useThree((s) => s.viewport);
  const narrow = viewport.width / viewport.height < 1;
  const scale = Math.min(0.54, viewport.width / 9.6);
  const baseY = -viewport.height * (narrow ? 0.3 : 0.31);

  const parts = useMemo(() => {
    const body = new THREE.LatheGeometry(fuselageProfile(), 96, Math.PI, Math.PI * 2);
    body.rotateZ(-Math.PI / 2);
    // Kuyruk konisi yukarı kalkar (gerçek gövde gibi).
    const pos = body.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      if (x < -1.8) pos.setY(i, pos.getY(i) + 0.34 * ((-1.8 - x) / 2.5) ** 1.6);
    }
    body.computeVertexNormals();

    const nacelle = new THREE.LatheGeometry(nacelleProfile(), 64);
    nacelle.rotateZ(-Math.PI / 2);

    return {
      body,
      livery: makeLivery(),
      logo: makeLogo(),
      wingR: planform(WING, 0.05, 0.035),
      wingL: planform(mirror(WING), 0.05, 0.035),
      stabR: planform(STAB, 0.03, 0.02),
      stabL: planform(mirror(STAB), 0.03, 0.02),
      fin: (() => { const g = extruded(FIN, 0.06, 0.03); g.translate(0, 0, -0.03); return g; })(),
      winglet: (() => { const g = extruded(WINGLET, 0.02, 0.012); g.translate(0, 0, -0.01); return g; })(),
      nacelle,
    };
  }, []);

  useEffect(() => () => {
    Object.values(parts).forEach((p) => (p as { dispose?: () => void }).dispose?.());
  }, [parts]);

  useEffect(() => {
    if (ref.current) ref.current.rotation.order = "YZX";
  }, []);

  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;
    const p = progress?.get() ?? 0;
    const t = reduce ? 0 : state.clock.elapsedTime;
    const px = reduce ? 0 : state.pointer.x;
    const py = reduce ? 0 : state.pointer.y;
    const damp = (a: number, b: number) => THREE.MathUtils.damp(a, b, 3.2, dt);
    // Yandan 3/4 görünüş (gövde yazısı ve kuyruk logosu görünür); kaydırdıkça
    // yatar, tırmanır ve uzaklaşır.
    g.rotation.y = damp(g.rotation.y, 0.3 + px * 0.14 + p * 0.75);
    g.rotation.z = damp(g.rotation.z, 0.04 + py * 0.04 + p * 0.2);
    g.rotation.x = damp(g.rotation.x, -0.05 + Math.sin(t * 0.55) * 0.03 - px * 0.06 - p * 0.5);
    g.position.x = damp(g.position.x, p * viewport.width * 0.16);
    g.position.y = damp(g.position.y, baseY + Math.sin(t * 0.8) * 0.06 + p * viewport.height * 0.34);
    g.position.z = damp(g.position.z, -p * 5);
  });

  const white = (
    <meshPhysicalMaterial color="#ffffff" roughness={0.3} metalness={0.05} clearcoat={1} clearcoatRoughness={0.12} />
  );
  const red = <meshPhysicalMaterial color={RED} roughness={0.36} metalness={0.05} clearcoat={1} clearcoatRoughness={0.15} />;
  const grey = <meshStandardMaterial color="#e6e8ec" roughness={0.42} metalness={0.25} />;
  const dark = <meshStandardMaterial color="#17191e" roughness={0.5} metalness={0.4} />;

  return (
    <>
    <group ref={ref} scale={scale} position={[0, baseY, 0]}>
      <mesh geometry={parts.body}>
        <meshPhysicalMaterial map={parts.livery} roughness={0.28} metalness={0.05} clearcoat={1} clearcoatRoughness={0.1} />
      </mesh>

      {/* kanatlar — alçak kanat, hafif dihedral */}
      <group position={[0, -0.24, 0]} rotation={[-0.085, 0, 0]}>
        <mesh geometry={parts.wingR}>{grey}</mesh>
        <mesh geometry={parts.winglet} position={[0, 0.02, 4.28]} rotation={[-0.28, 0, 0]}>{red}</mesh>
      </group>
      <group position={[0, -0.24, 0]} rotation={[0.085, 0, 0]}>
        <mesh geometry={parts.wingL}>{grey}</mesh>
        <mesh geometry={parts.winglet} position={[0, 0.02, -4.28]} rotation={[0.28, 0, 0]}>{red}</mesh>
      </group>

      {/* motorlar */}
      {[1.62, -1.62].map((z) => (
        <group key={z} position={[0.32, -0.56, z]}>
          <mesh geometry={parts.nacelle}>{white}</mesh>
          <mesh position={[0.74, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <circleGeometry args={[0.285, 48]} />
            {dark}
          </mesh>
          <mesh position={[0.78, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.07, 0.16, 24]} />
            <meshStandardMaterial color="#9aa0a8" roughness={0.3} metalness={0.8} />
          </mesh>
          <mesh position={[0.62, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.322, 0.016, 12, 64]} />
            {red}
          </mesh>
          <mesh position={[-0.78, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <circleGeometry args={[0.17, 32]} />
            {dark}
          </mesh>
          {/* pilon */}
          <mesh position={[-0.05, 0.36, 0]}>
            <boxGeometry args={[0.9, 0.24, 0.07]} />
            {grey}
          </mesh>
        </group>
      ))}

      {/* yatay stabilize */}
      <group position={[0, 0.22, 0]} rotation={[-0.12, 0, 0]}><mesh geometry={parts.stabR}>{grey}</mesh></group>
      <group position={[0, 0.22, 0]} rotation={[0.12, 0, 0]}><mesh geometry={parts.stabL}>{grey}</mesh></group>

      {/* dikey kuyruk + logo */}
      <group position={[0, 0.14, 0]}>
        <mesh geometry={parts.fin}>{red}</mesh>
        <mesh position={[-3.62, 1.25, 0.062]}>
          <circleGeometry args={[0.42, 64]} />
          <meshPhysicalMaterial map={parts.logo} transparent roughness={0.3} clearcoat={1} />
        </mesh>
        <mesh position={[-3.62, 1.25, -0.062]} rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[0.42, 64]} />
          <meshPhysicalMaterial map={parts.logo} transparent roughness={0.3} clearcoat={1} />
        </mesh>
      </group>
    </group>
    <ContactShadows position={[0, baseY - 1.25 * (scale / 0.62), 0]} opacity={0.2} scale={18} blur={2.8} far={4} color="#3a0203" />
    </>
  );
}

export default function Aircraft3D({
  progress,
  active,
  reduce,
}: {
  progress?: MotionValue<number>;
  active: boolean;
  reduce: boolean;
}) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [7.2, 2.1, 8.4], fov: 30 }}
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 9, 6]} intensity={2.1} />
      <directionalLight position={[-6, 2, -4]} intensity={0.6} color="#ffe9e9" />
      <Aircraft progress={progress} reduce={reduce} />
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2.2} rotation-x={Math.PI / 2} position={[0, 6, -8]} scale={[12, 12, 1]} />
        <Lightformer intensity={1.6} rotation-y={Math.PI / 2} position={[-6, 1, -1]} scale={[20, 0.6, 1]} />
        <Lightformer intensity={1.2} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={[20, 1, 1]} />
        <Lightformer form="ring" color={RED} intensity={2.5} scale={4} position={[-6, 3, -6]} target={[0, 0, 0]} />
      </Environment>
    </Canvas>
  );
}
