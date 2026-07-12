import { useState, useEffect, Suspense, useMemo, Component, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, useGLTF } from "@react-three/drei";
import type { Seat, Cabin } from "@/domain/checkin";
import { seatMeta, SeatCard, type SeatMeta } from "./CabinMap";
import { Skeleton } from "@/components/ui/skeleton";

// 3D kabin — TEMİZ İÇ KABİN (dış kanat/koni yok → çakışma yok). three.js / R3F.
// İsteğe bağlı glTF: public/models/cabin.glb varsa onu yükler; yoksa aşağıdaki built kabin.
// Mouse ile döndür/yakınlaştır, 3B koltuğa tıkla.

const COLX: Record<string, number> = { A: -3.0, B: -2.1, C: -1.2, D: 1.2, E: 2.1, F: 3.0 };
const RZ = 1.0;
const WALL_X = 3.9;

// THY kırmızı+beyaz kimliği: mavi tonlar kaldırıldı. Kabinler nötr/warm gri tonlarla
// ayrışır (Business = hafif kırmızı-tint premium), seçili koltuk THY kırmızısı.
const SEATCOL: Record<Cabin, { c: string; b: string }> = {
  Business: { c: "#e6cfcf", b: "#d0adad" },
  Premium: { c: "#d7dbe1", b: "#bfc5ce" },
  Economy: { c: "#c8cdd5", b: "#adb3bd" },
};
const OCC = { c: "#9498a0", b: "#83878f" };
const SEL = { c: "#c70a0c", b: "#8f0507" };
const STRUCT = "#e7eaf0";
const STRUCT2 = "#dadfe8";

function Seat3D({ m, selected, onSelect, onHover }: { m: SeatMeta; selected: boolean; onSelect: (id: string) => void; onHover: (m: SeatMeta | null) => void }) {
  const col = m.occupied ? OCC : selected ? SEL : SEATCOL[m.cabin];
  const y = selected ? 0.16 : 0;
  return (
    <group
      position={[COLX[m.col], y, m.row * RZ]}
      onPointerOver={(e) => { e.stopPropagation(); onHover(m); if (!m.occupied) document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { onHover(null); document.body.style.cursor = "auto"; }}
      onClick={(e) => { e.stopPropagation(); if (!m.occupied) onSelect(m.id); }}
    >
      {/* minder */}
      <mesh position={[0, 0.12, 0.06]}><boxGeometry args={[0.74, 0.12, 0.74]} /><meshStandardMaterial color={col.c} emissive={selected ? SEL.c : "#000"} emissiveIntensity={selected ? 0.4 : 0} /></mesh>
      {/* sırtlık */}
      <mesh position={[0, 0.42, -0.3]}><boxGeometry args={[0.74, 0.62, 0.13]} /><meshStandardMaterial color={col.b} /></mesh>
      {/* başlık */}
      <mesh position={[0, 0.78, -0.28]}><boxGeometry args={[0.5, 0.22, 0.12]} /><meshStandardMaterial color={col.b} /></mesh>
      {/* kolçaklar */}
      <mesh position={[-0.4, 0.22, 0.06]}><boxGeometry args={[0.07, 0.12, 0.56]} /><meshStandardMaterial color={col.b} /></mesh>
      <mesh position={[0.4, 0.22, 0.06]}><boxGeometry args={[0.07, 0.12, 0.56]} /><meshStandardMaterial color={col.b} /></mesh>
    </group>
  );
}

// İç kabin gövdesi: zemin, içe eğik yan duvarlar (kavis hissi), tepe bagaj dolapları,
// pencereler, hafif tavan. Hiçbiri koltuk ölçeğiyle çakışmaz.
function InteriorCabin({ maxRow }: { maxRow: number }) {
  const len = maxRow * RZ;
  const midZ = len / 2;
  const rows = Array.from({ length: maxRow }, (_, i) => i + 1);
  return (
    <group>
      {/* zemin */}
      <mesh position={[0, -0.02, midZ]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2 * WALL_X, len + 4]} /><meshStandardMaterial color="#eef1f6" /></mesh>
      {/* koridor şeridi */}
      <mesh position={[0, 0.0, midZ]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2.2, len + 4]} /><meshStandardMaterial color="#e4e8ef" /></mesh>

      {/* içe eğik yan duvarlar */}
      <mesh position={[-WALL_X, 1.0, midZ]} rotation={[0, 0, -0.22]}><boxGeometry args={[0.12, 2.6, len + 4]} /><meshStandardMaterial color={STRUCT} /></mesh>
      <mesh position={[WALL_X, 1.0, midZ]} rotation={[0, 0, 0.22]}><boxGeometry args={[0.12, 2.6, len + 4]} /><meshStandardMaterial color={STRUCT} /></mesh>

      {/* tepe bagaj dolapları */}
      <mesh position={[-2.9, 2.5, midZ]} rotation={[0, 0, 0.5]}><boxGeometry args={[1.5, 0.55, len + 4]} /><meshStandardMaterial color={STRUCT2} /></mesh>
      <mesh position={[2.9, 2.5, midZ]} rotation={[0, 0, -0.5]}><boxGeometry args={[1.5, 0.55, len + 4]} /><meshStandardMaterial color={STRUCT2} /></mesh>

      {/* tavan şeridi (hafif) */}
      <mesh position={[0, 3.25, midZ]}><boxGeometry args={[3.4, 0.1, len + 4]} /><meshStandardMaterial color="#f1f4f8" transparent opacity={0.7} /></mesh>

      {/* pencereler */}
      {rows.map((r) => (
        <group key={r}>
          <mesh position={[-WALL_X + 0.18, 1.45, r * RZ]} rotation={[0, 0, -0.22]}><boxGeometry args={[0.06, 0.34, 0.44]} /><meshStandardMaterial color="#bcd6f5" emissive="#7ba6f1" emissiveIntensity={0.3} /></mesh>
          <mesh position={[WALL_X - 0.18, 1.45, r * RZ]} rotation={[0, 0, 0.22]}><boxGeometry args={[0.06, 0.34, 0.44]} /><meshStandardMaterial color="#bcd6f5" emissive="#7ba6f1" emissiveIntensity={0.3} /></mesh>
        </group>
      ))}
    </group>
  );
}

function GltfCabin() {
  // public/models/cabin.glb varsa yükler. Yoksa hata → ErrorBoundary fallback (InteriorCabin).
  const { scene } = useGLTF("/models/cabin.glb");
  return <primitive object={scene} />;
}

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Scene({ seats, selected, onSelect, onHover, hasModel }: { seats: SeatMeta[]; selected: string | null; onSelect: (id: string) => void; onHover: (m: SeatMeta | null) => void; hasModel: boolean }) {
  const maxRow = Math.max(...seats.map((s) => s.row));
  const midZ = (maxRow * RZ) / 2;
  const exitRows = Array.from(new Set(seats.filter((s) => s.exit).map((s) => s.row)));
  const zoneStarts = useMemo(() => {
    const res: { cabin: Cabin; row: number }[] = [];
    const sorted = [...new Set(seats.map((s) => s.row))].sort((a, b) => a - b);
    let prev: Cabin | null = null;
    for (const r of sorted) { const c = seats.find((s) => s.row === r)!.cabin; if (c !== prev) { res.push({ cabin: c, row: r }); prev = c; } }
    return res;
  }, [seats]);

  return (
    <group position={[0, 0, -midZ]}>
      {hasModel ? (
        <ModelBoundary fallback={<InteriorCabin maxRow={maxRow} />}>
          <Suspense fallback={<InteriorCabin maxRow={maxRow} />}>
            <GltfCabin />
          </Suspense>
        </ModelBoundary>
      ) : (
        <InteriorCabin maxRow={maxRow} />
      )}

      {/* çıkış işaretleri */}
      {exitRows.map((r) => (
        <group key={r}>
          <mesh position={[-WALL_X + 0.05, 0.5, r * RZ]} rotation={[0, 0, -0.22]}><boxGeometry args={[0.16, 0.8, 0.95]} /><meshStandardMaterial color="#16a34a" /></mesh>
          <mesh position={[WALL_X - 0.05, 0.5, r * RZ]} rotation={[0, 0, 0.22]}><boxGeometry args={[0.16, 0.8, 0.95]} /><meshStandardMaterial color="#16a34a" /></mesh>
        </group>
      ))}

      {/* bölge etiketleri */}
      {zoneStarts.map((z) => (
        <Html key={z.cabin} position={[-WALL_X - 0.4, 0.7, z.row * RZ]} center distanceFactor={22}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#5c6068", whiteSpace: "nowrap", textTransform: "uppercase" }}>{z.cabin}</span>
        </Html>
      ))}
      {Object.entries(COLX).map(([c, x]) => (
        <Html key={c} position={[x, 0.25, -0.4]} center distanceFactor={22}><span style={{ fontSize: 11, color: "#9ca0a8", fontWeight: 600 }}>{c}</span></Html>
      ))}

      {seats.map((s) => <Seat3D key={s.id} m={s} selected={selected === s.id} onSelect={onSelect} onHover={onHover} />)}
    </group>
  );
}

export function Cabin3D({ seats, selected, onSelect }: { seats: Seat[]; selected: string | null; onSelect: (id: string) => void }) {
  const [hover, setHover] = useState<SeatMeta | null>(null);
  const [hasModel, setHasModel] = useState(false);
  const metas = useMemo(() => seats.map(seatMeta), [seats]);
  const focus = hover ?? (selected ? metas.find((s) => s.id === selected) ?? null : null);

  // Opsiyonel glTF: dosya gerçekten varsa (ve HTML değilse) yükle. Yoksa built iç kabin.
  useEffect(() => {
    let alive = true;
    fetch("/models/cabin.glb", { method: "HEAD" })
      .then((r) => { const ct = r.headers.get("content-type") || ""; if (alive) setHasModel(r.ok && !ct.includes("text/html")); })
      .catch(() => alive && setHasModel(false));
    return () => { alive = false; };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <SeatCard seat={focus} selected={selected} onSelect={onSelect} />
      <div className="h-[68vh] overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-linear-to-b from-[#eef2f7] to-[#dde3ec]">
        <Suspense fallback={<Skeleton className="h-full w-full" />}>
          <Canvas camera={{ position: [7, 13, 22], fov: 36 }} dpr={[1, 2]}>
            <ambientLight intensity={1.0} />
            <directionalLight position={[8, 18, 8]} intensity={0.55} />
            <directionalLight position={[-6, 10, -4]} intensity={0.2} />
            <Scene seats={metas} selected={selected} onSelect={onSelect} onHover={setHover} hasModel={hasModel} />
            <OrbitControls enablePan={false} enableDamping minDistance={10} maxDistance={55} minPolarAngle={0.1} maxPolarAngle={1.45} />
          </Canvas>
        </Suspense>
      </div>
      <p className="text-center text-[11px] text-tertiary">Döndürmek için sürükleyin · yakınlaştırmak için kaydırın · koltuğa tıklayın</p>
    </div>
  );
}
