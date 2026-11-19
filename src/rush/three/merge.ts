// Merge a group's static meshes by material, so a chunk of scenery (or Rollo's body) is a handful of draw calls. Parts
// marked userData.dyn (and instanced meshes, sprites, points) are left alone.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** merge a group's static meshes by material (keeps instanced meshes, sprites, points and animated parts) */
export function mergeStatic(group: THREE.Object3D) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const drop: THREE.Mesh[] = [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material)) return;
    for (let p: THREE.Object3D | null = m; p && p !== group; p = p.parent) if (p.userData.dyn) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    const list = byMat.get(m.material as THREE.Material) ?? byMat.set(m.material as THREE.Material, []).get(m.material as THREE.Material)!;
    list.push(g); drop.push(m);
  });
  const made: THREE.BufferGeometry[] = [];
  for (const [mat, list] of byMat) {
    if (list.length < 2) { list.forEach((g) => g.dispose()); continue; }
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat); mesh.receiveShadow = true;
    group.add(mesh); made.push(merged);
  }
  for (const m of drop) { if (byMat.get(m.material as THREE.Material)!.length >= 2) m.removeFromParent(); }
  return made;
}

