"use client";

import { useEffect, useRef } from "react";
import type { SkillId } from "@/lib/lessonTypes";

export type WorldZone = SkillId | "zh";

const ZONE_POSITIONS: Record<WorldZone, [number, number, number]> = {
  listening: [-4.2, 0, -2.2],
  reading: [-1.3, 0, -3.2],
  speaking: [-3.4, 0, 2.2],
  writing: [-0.1, 0, 2.5],
  zh: [4.1, 0, 1.9],
};

export default function ThreeFarmScene({
  selected,
  onSelect,
}: {
  selected: WorldZone;
  onSelect: (zone: WorldZone) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cancelled = false;
    let cleanup = () => {};

    void import("three").then((THREE) => {
      if (cancelled || !mountRef.current) return;
      const container = mountRef.current;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#dfeecf");
      scene.fog = new THREE.Fog("#dfeecf", 18, 34);

      const camera = new THREE.OrthographicCamera(-8, 8, 5.5, -5.5, 0.1, 60);
      camera.position.set(12, 12, 15);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.setAttribute("aria-label", "Nông trại học ngôn ngữ 3D. Dùng các nút bên dưới để chọn khu vực nếu không sử dụng chuột.");
      renderer.domElement.setAttribute("role", "img");
      container.appendChild(renderer.domElement);

      const hemi = new THREE.HemisphereLight("#fff8d8", "#54775a", 2.1);
      scene.add(hemi);
      const sun = new THREE.DirectionalLight("#fff0b0", 3.2);
      sun.position.set(-8, 14, 8);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      scene.add(sun);

      const ground = new THREE.Mesh(
        new THREE.CylinderGeometry(9, 9.5, 0.8, 8),
        new THREE.MeshStandardMaterial({ color: "#86ad68", roughness: 0.95 }),
      );
      ground.position.y = -0.45;
      ground.receiveShadow = true;
      scene.add(ground);

      const river = new THREE.Mesh(
        new THREE.PlaneGeometry(3.1, 18),
        new THREE.MeshStandardMaterial({ color: "#79c7bd", roughness: 0.25, metalness: 0.08, transparent: true, opacity: 0.9 }),
      );
      river.rotation.x = -Math.PI / 2;
      river.rotation.z = 0.22;
      river.position.set(2.25, 0.025, 0);
      scene.add(river);

      const bridgeMaterial = new THREE.MeshStandardMaterial({ color: "#a6743f", roughness: 0.9 });
      for (let i = -2; i <= 2; i += 1) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.14, 1.35), bridgeMaterial);
        plank.position.set(2.3 + i * 0.68, 0.18, 0.4 + i * -0.1);
        plank.rotation.y = -0.15;
        plank.castShadow = true;
        scene.add(plank);
      }

      const interactive: InstanceType<typeof THREE.Object3D>[] = [];
      const animatedTrees: InstanceType<typeof THREE.Group>[] = [];
      const clouds: InstanceType<typeof THREE.Group>[] = [];

      function material(color: string) {
        return new THREE.MeshStandardMaterial({ color, roughness: 0.86 });
      }
      function addTree(x: number, z: number, scale = 1) {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 1.1, 7), material("#765133"));
        trunk.position.y = 0.55;
        const crown = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.8, 7), material("#2f7048"));
        crown.position.y = 1.6;
        trunk.castShadow = crown.castShadow = true;
        tree.add(trunk, crown);
        tree.position.set(x, 0, z);
        tree.scale.setScalar(scale);
        scene.add(tree);
        animatedTrees.push(tree);
      }
      [[-7,-4],[-6,-5],[-5.2,-4.6],[5.8,-4.8],[6.8,-3.7],[7,-1.7],[6.4,4.2],[-6.7,3.6]].forEach(([x,z], index) => addTree(x, z, 0.8 + (index % 3) * 0.15));

      function addPlot(zone: WorldZone, color: string, rows: number) {
        const [x,,z] = ZONE_POSITIONS[zone];
        const group = new THREE.Group();
        group.userData.zone = zone;
        const soil = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 1.55), material("#7b5638"));
        soil.position.y = 0.06;
        soil.receiveShadow = true;
        group.add(soil);
        for (let row = 0; row < rows; row += 1) {
          const crop = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), material(color));
          crop.scale.y = 1.5;
          crop.position.set(-0.7 + row * (1.4 / Math.max(1, rows - 1)), 0.35, 0);
          crop.castShadow = true;
          group.add(crop);
        }
        group.position.set(x, 0, z);
        group.traverse((object) => { object.userData.zone = zone; interactive.push(object); });
        scene.add(group);
      }
      addPlot("listening", "#6cc5cb", 3);
      addPlot("reading", "#f2d36f", 4);
      addPlot("speaking", "#ef9b83", 3);
      addPlot("writing", "#c8a5df", 4);

      const village = new THREE.Group();
      village.userData.zone = "zh";
      const house = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.55, 1.65), material("#f3d695"));
      house.position.y = 0.78;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.55, 1, 4), material("#be5d43"));
      roof.position.y = 2;
      roof.rotation.y = Math.PI / 4;
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.86, 0.08), material("#5a4031"));
      door.position.set(0, 0.47, 0.86);
      village.add(house, roof, door);
      village.position.set(...ZONE_POSITIONS.zh);
      village.traverse((object) => { object.userData.zone = "zh"; interactive.push(object); });
      scene.add(village);

      const mountainMaterial = material("#769070");
      [[5,-6,2.5],[2.8,-7,2],[7,-7,3.1]].forEach(([x,z,s]) => {
        const mountain = new THREE.Mesh(new THREE.ConeGeometry(s, s * 1.7, 6), mountainMaterial);
        mountain.position.set(x, s * 0.72, z);
        mountain.castShadow = true;
        scene.add(mountain);
      });

      const hiker = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.72, 8), material("#f1c45f"));
      body.position.y = 0.66;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8), material("#f3c7a2"));
      head.position.y = 1.22;
      const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.52, 0.24), material("#285c42"));
      backpack.position.set(0, 0.72, -0.25);
      hiker.add(body, head, backpack);
      hiker.position.set(-5.8, 0, 3.8);
      hiker.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = true; });
      scene.add(hiker);

      for (let i = 0; i < 3; i += 1) {
        const cloud = new THREE.Group();
        for (let j = 0; j < 3; j += 1) {
          const puff = new THREE.Mesh(new THREE.SphereGeometry(0.65 + j * 0.1, 10, 8), new THREE.MeshBasicMaterial({ color: "#fffdf0", transparent: true, opacity: 0.82 }));
          puff.position.x = j * 0.7;
          cloud.add(puff);
        }
        cloud.position.set(-7 + i * 5, 5.8 + i * 0.5, -5 - i);
        scene.add(cloud);
        clouds.push(cloud);
      }

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const target = new THREE.Vector3(...ZONE_POSITIONS[selectedRef.current]);
      function handlePointer(event: PointerEvent) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(interactive, false)[0];
        const zone = hit?.object.userData.zone as WorldZone | undefined;
        if (zone) onSelectRef.current(zone);
      }
      renderer.domElement.addEventListener("pointerdown", handlePointer);

      const resizeObserver = new ResizeObserver(() => {
        const width = Math.max(320, container.clientWidth);
        const height = Math.max(300, container.clientHeight);
        const aspect = width / height;
        const viewHeight = 10.5;
        camera.left = -(viewHeight * aspect) / 2;
        camera.right = (viewHeight * aspect) / 2;
        camera.top = viewHeight / 2;
        camera.bottom = -viewHeight / 2;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      });
      resizeObserver.observe(container);

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const clock = new THREE.Clock();
      let animationFrame = 0;
      function render() {
        const elapsed = clock.getElapsedTime();
        target.set(...ZONE_POSITIONS[selectedRef.current]);
        const distance = hiker.position.distanceTo(target);
        if (distance > 0.25) {
          hiker.lookAt(target.x, hiker.position.y, target.z);
          hiker.position.lerp(target, reducedMotion ? 0.16 : 0.035);
        }
        if (!reducedMotion) {
          hiker.position.y = Math.abs(Math.sin(elapsed * 5)) * Math.min(0.08, distance * 0.03);
          river.material.opacity = 0.83 + Math.sin(elapsed * 1.8) * 0.06;
          animatedTrees.forEach((tree, index) => { tree.rotation.z = Math.sin(elapsed * 0.8 + index) * 0.025; });
          clouds.forEach((cloud, index) => { cloud.position.x += 0.002 + index * 0.0005; if (cloud.position.x > 9) cloud.position.x = -9; });
        }
        renderer.render(scene, camera);
        animationFrame = window.requestAnimationFrame(render);
      }
      render();

      cleanup = () => {
        window.cancelAnimationFrame(animationFrame);
        resizeObserver.disconnect();
        renderer.domElement.removeEventListener("pointerdown", handlePointer);
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((item) => item.dispose());
          }
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    });

    return () => { cancelled = true; cleanup(); };
  }, []);

  return <div ref={mountRef} className="farm-scene" />;
}
