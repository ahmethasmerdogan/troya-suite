import { useEffect, useRef, useState } from "react";
import { cx } from "./cx";

/* Lazy three.js scene — the library chunk loads only when scrolled into view. */
export function ThreeOrb({
  height = 340,
  className,
}: {
  height?: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    const obs = new IntersectionObserver(
      async ([e]) => {
        if (!e.isIntersecting || cleanup) return;
        obs.disconnect();
        const THREE = await import("three");
        if (disposed) return;

        const w = host.clientWidth;
        const h = host.clientHeight;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
        camera.position.z = 5.4;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        renderer.setSize(w, h);
        host.appendChild(renderer.domElement);

        /* wireframe icosahedron */
        const geo = new THREE.IcosahedronGeometry(1.9, 1);
        const wire = new THREE.LineSegments(
          new THREE.WireframeGeometry(geo),
          new THREE.LineBasicMaterial({
            color: 0x34d399,
            transparent: true,
            opacity: 0.55,
          }),
        );
        scene.add(wire);

        /* inner glowing core */
        const core = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.55, 2),
          new THREE.MeshBasicMaterial({
            color: 0x6ee7b7,
            transparent: true,
            opacity: 0.85,
          }),
        );
        scene.add(core);

        /* orbiting particles */
        const N = 900;
        const pos = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
          const r = 2.4 + Math.random() * 1.6;
          const th = Math.random() * Math.PI * 2;
          const ph = Math.acos(2 * Math.random() - 1);
          pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
          pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.55;
          pos[i * 3 + 2] = r * Math.cos(ph);
        }
        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const points = new THREE.Points(
          pGeo,
          new THREE.PointsMaterial({
            color: 0x34d399,
            size: 0.035,
            transparent: true,
            opacity: 0.7,
          }),
        );
        scene.add(points);

        let mx = 0;
        let my = 0;
        const onMove = (ev: MouseEvent) => {
          const r = host.getBoundingClientRect();
          mx = ((ev.clientX - r.left) / r.width - 0.5) * 2;
          my = ((ev.clientY - r.top) / r.height - 0.5) * 2;
        };
        host.addEventListener("mousemove", onMove);

        const onResize = () => {
          const nw = host.clientWidth;
          const nh = host.clientHeight;
          camera.aspect = nw / nh;
          camera.updateProjectionMatrix();
          renderer.setSize(nw, nh);
        };
        window.addEventListener("resize", onResize);

        let raf = 0;
        const t0 = performance.now();
        const loop = (t: number) => {
          const s = (t - t0) / 1000;
          wire.rotation.y = s * 0.25 + mx * 0.4;
          wire.rotation.x = s * 0.11 + my * 0.3;
          points.rotation.y = -s * 0.06;
          core.scale.setScalar(1 + Math.sin(s * 2.1) * 0.08);
          renderer.render(scene, camera);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        setReady(true);

        cleanup = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener("resize", onResize);
          host.removeEventListener("mousemove", onMove);
          renderer.dispose();
          geo.dispose();
          pGeo.dispose();
          host.removeChild(renderer.domElement);
        };
      },
      { threshold: 0.15 },
    );
    obs.observe(host);

    return () => {
      disposed = true;
      obs.disconnect();
      cleanup?.();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={cx("relative w-full overflow-hidden rounded-2xl", className)}
      style={{ height }}
    >
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center font-mono text-[12px] text-ink-3">
          loading three.js scene…
        </div>
      )}
    </div>
  );
}
