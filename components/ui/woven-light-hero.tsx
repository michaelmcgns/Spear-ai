"use client";

import React, { useRef, useEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import * as THREE from 'three';

// Spear brand palette — used when colors prop omitted
const SPEAR_PALETTE = [
  0xD4AF37, // gold
  0xD4AF37, // gold (weighted)
  0xF5C842, // gold bright
  0xB8860B, // gold dark
  0xE8C040, // gold warm
  0xD4AF37, // gold (weighted again)
  0x1A3A6B, // navy highlight
];

interface WovenCanvasProps {
  /** Override the particle color palette. Hex numbers e.g. [0xD4AF37, 0x0A1628] */
  palette?: number[];
  /** Particle size. Default 0.02 */
  particleSize?: number;
}

// --- Standalone canvas — use this as a drop-in background ---
export const WovenCanvas = ({
  palette = SPEAR_PALETTE,
  particleSize = 0.022,
}: WovenCanvasProps) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const container = mountRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const mouse = new THREE.Vector2(0, 0);
    const clock = new THREE.Clock();

    const particleCount = 50000;
    const positions = new Float32Array(particleCount * 3);
    const originalPositions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    const geometry = new THREE.BufferGeometry();
    const torusKnot = new THREE.TorusKnotGeometry(1.5, 0.5, 200, 32);
    const threeColors = palette.map(hex => new THREE.Color(hex));

    for (let i = 0; i < particleCount; i++) {
      const vIdx = i % torusKnot.attributes.position.count;
      const x = torusKnot.attributes.position.getX(vIdx);
      const y = torusKnot.attributes.position.getY(vIdx);
      const z = torusKnot.attributes.position.getZ(vIdx);

      positions[i * 3] = originalPositions[i * 3] = x;
      positions[i * 3 + 1] = originalPositions[i * 3 + 1] = y;
      positions[i * 3 + 2] = originalPositions[i * 3 + 2] = z;

      const c = threeColors[Math.floor(Math.random() * threeColors.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: particleSize,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      const mouseWorld = new THREE.Vector3(mouse.x * 3, mouse.y * 3, 0);

      for (let i = 0; i < particleCount; i++) {
        const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2;
        const cur = new THREE.Vector3(positions[ix], positions[iy], positions[iz]);
        const orig = new THREE.Vector3(originalPositions[ix], originalPositions[iy], originalPositions[iz]);
        const vel = new THREE.Vector3(velocities[ix], velocities[iy], velocities[iz]);

        const dist = cur.distanceTo(mouseWorld);
        if (dist < 1.5) {
          const force = (1.5 - dist) * 0.012;
          vel.add(new THREE.Vector3().subVectors(cur, mouseWorld).normalize().multiplyScalar(force));
        }
        vel.add(new THREE.Vector3().subVectors(orig, cur).multiplyScalar(0.001));
        vel.multiplyScalar(0.95);

        positions[ix] += vel.x; positions[iy] += vel.y; positions[iz] += vel.z;
        velocities[ix] = vel.x; velocities[iy] = vel.y; velocities[iz] = vel.z;
      }
      geometry.attributes.position.needsUpdate = true;
      points.rotation.y = elapsedTime * 0.05;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [palette, particleSize]);

  return <div ref={mountRef} className="absolute inset-0 z-0" />;
};

// --- Full standalone hero (used at /demo) ---
export const WovenLightHero = () => {
  const textControls = useAnimation();
  const buttonControls = useAnimation();

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&family=Inter:wght@400&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    textControls.start((i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1 + 1.5, duration: 1.2, ease: [0.2, 0.65, 0.3, 0.9] },
    }));
    buttonControls.start({ opacity: 1, transition: { delay: 2.5, duration: 1 } });

    return () => { document.head.removeChild(link); };
  }, [textControls, buttonControls]);

  const headline = "Woven by Light";

  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-black">
      <WovenCanvas />
      <motion.nav
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 1, duration: 1 } }}
        className="absolute top-0 left-0 right-0 z-20 p-6"
      >
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">⎎</span>
            <span className="text-xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>Woven</span>
          </div>
        </div>
      </motion.nav>

      <div className="relative z-10 text-center px-4">
        <h1
          className="text-6xl md:text-8xl text-white"
          style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", textShadow: '0 0 50px rgba(255,255,255,0.3)' }}
        >
          {headline.split(" ").map((word, i) => (
            <span key={i} className="inline-block">
              {word.split("").map((char, j) => (
                <motion.span key={j} custom={i * 5 + j} initial={{ opacity: 0, y: 50 }} animate={textControls} style={{ display: 'inline-block' }}>
                  {char}
                </motion.span>
              ))}
              {i < headline.split(" ").length - 1 && <span>&nbsp;</span>}
            </span>
          ))}
        </h1>
        <motion.p
          custom={headline.length}
          initial={{ opacity: 0, y: 30 }}
          animate={textControls}
          className="mx-auto mt-6 max-w-xl text-lg text-slate-300"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          An interactive tapestry of light and motion, crafted with code and creativity.
        </motion.p>
        <motion.div initial={{ opacity: 0 }} animate={buttonControls} className="mt-10">
          <button className="rounded-full border-2 border-white/20 bg-white/10 px-8 py-3 font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20">
            Explore the Weave
          </button>
        </motion.div>
      </div>
    </div>
  );
};
