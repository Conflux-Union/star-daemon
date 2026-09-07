import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { cameraPose, journeyState, planets, type Planet } from './journey';
import { glowTexture } from './textures';

interface SceneProps {
  progress: React.RefObject<number>;
  reducedMotion: boolean;
  onReady: () => void;
  onFailure: () => void;
}

const surfaceFiles = [
  '2k_mars.jpg',
  '2k_earth_daymap.jpg',
  '2k_venus_surface.jpg',
  '2k_saturn.jpg',
  '2k_haumea_fictional.jpg',
  '2k_jupiter.jpg',
];
const textureURL = (file: string) => `${import.meta.env.BASE_URL}textures/${file}`;

const atmosphereVertex = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    vPosition = p.xyz;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * p;
  }
`;
const atmosphereFragment = `
  uniform vec3 tint;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(-vPosition))), 3.5);
    float sunlight = smoothstep(-0.15, 0.6, dot(normalize(vWorldNormal), normalize(-vWorldPosition)));
    gl_FragColor = vec4(tint, rim * 0.38 * sunlight);
  }
`;

function PlanetMesh({
  planet,
  index,
  reducedMotion,
}: {
  planet: Planet;
  index: number;
  reducedMotion: boolean;
}) {
  const sphere = useRef<THREE.Mesh>(null);
  const source = useLoader(THREE.TextureLoader, textureURL(surfaceFiles[index]));
  const texture = useMemo(() => {
    const map = source.clone();
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    map.needsUpdate = true;
    return map;
  }, [source]);
  const atmosphere = useMemo(
    () => ({ tint: { value: new THREE.Color(planet.color) } }),
    [planet.color],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame((_, delta) => {
    if (sphere.current && !reducedMotion)
      sphere.current.rotation.y += Math.min(delta, 0.05) * 0.035;
  });
  return (
    <group
      name={planet.id}
      position={planet.position}
      rotation={planet.kind === 'gas' ? [0.44, 0.18, -0.25] : [0.07, 0, 0.12]}
    >
      <mesh ref={sphere} rotation={[0, index, 0]}>
        <sphereGeometry args={[planet.radius, 64, 48]} />
        <meshStandardMaterial
          map={texture}
          color={
            planet.kind === 'storm' ? '#a492e0' : planet.kind === 'ice' ? '#b4d7df' : '#ffffff'
          }
          bumpMap={texture}
          bumpScale={
            planet.kind === 'gas' || planet.kind === 'ocean' || planet.kind === 'storm' ? 0 : 0.015
          }
          roughness={planet.kind === 'ocean' ? 0.48 : 0.93}
          metalness={0}
        />
      </mesh>
      <mesh scale={1.035}>
        <sphereGeometry args={[planet.radius, 48, 32]} />
        <shaderMaterial
          vertexShader={atmosphereVertex}
          fragmentShader={atmosphereFragment}
          uniforms={atmosphere}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {planet.kind === 'ocean' && <Clouds radius={planet.radius} reducedMotion={reducedMotion} />}
      {planet.kind === 'gas' && <Rings radius={planet.radius} />}
    </group>
  );
}

function Clouds({ radius, reducedMotion }: { radius: number; reducedMotion: boolean }) {
  const texture = useLoader(THREE.TextureLoader, textureURL('2k_earth_clouds.jpg'));
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (mesh.current && !reducedMotion) mesh.current.rotation.y += Math.min(delta, 0.05) * 0.045;
  });
  return (
    <mesh ref={mesh} rotation={[0, 1, 0]}>
      <sphereGeometry args={[radius * 1.012, 64, 48]} />
      <meshStandardMaterial
        alphaMap={texture}
        color="#ffffff"
        transparent
        opacity={0.74}
        depthWrite={false}
      />
    </mesh>
  );
}

function Rings({ radius }: { radius: number }) {
  const texture = useLoader(THREE.TextureLoader, textureURL('2k_saturn_ring_alpha.png'));
  const geometry = useMemo(() => {
    const ring = new THREE.RingGeometry(radius * 1.28, radius * 2.3, 192);
    const positions = ring.attributes.position;
    const uv = ring.attributes.uv;
    for (let i = 0; i < positions.count; i++) {
      uv.setXY(i, (Math.hypot(positions.getX(i), positions.getY(i)) / radius - 1.28) / 1.02, 0.5);
    }
    return ring;
  }, [radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial
        map={texture}
        color="#d6c7a7"
        emissive="#a09179"
        emissiveIntensity={0.09}
        transparent
        opacity={0.85}
        side={THREE.DoubleSide}
        roughness={1}
        depthWrite={false}
      />
    </mesh>
  );
}

function Star({ reducedMotion }: Pick<SceneProps, 'reducedMotion'>) {
  const glow = useMemo(glowTexture, []);
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ time: { value: 0 } }), []);
  useEffect(() => () => glow.dispose(), [glow]);
  useFrame((_, delta) => {
    if (material.current && !reducedMotion)
      material.current.uniforms.time.value += Math.min(delta, 0.05);
  });
  return (
    <group name="star">
      <mesh>
        <sphereGeometry args={[2.7, 64, 48]} />
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={`
        varying vec3 vPosition;
        varying vec3 vNormal;
        void main() {
          vPosition = position;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `}
          fragmentShader={`
        uniform float time;
        varying vec3 vPosition;
        varying vec3 vNormal;
        void main() {
          vec3 p = vPosition * 16.0;
          float grain = sin(p.x + sin(p.y * 1.8) + time * 0.12) * sin(p.y + cos(p.z * 1.3)) * sin(p.z + sin(p.x));
          float limb = pow(max(0.0, vNormal.z), 0.35);
          vec3 color = mix(vec3(0.94, 0.29, 0.055), vec3(1.0, 0.88, 0.59), limb);
          gl_FragColor = vec4(color * (0.91 + grain * 0.09), 1.0);
        }
      `}
        />
      </mesh>
      <sprite scale={[29, 29, 1]}>
        <spriteMaterial
          map={glow}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          opacity={0.8}
        />
      </sprite>
    </group>
  );
}

function Starfield() {
  const positions = useMemo(() => {
    const data = new Float32Array(1800 * 3);
    let seed = 71;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      return (seed >>> 0) / 4294967296;
    };
    for (let i = 0; i < 1800; i++) {
      const theta = random() * Math.PI * 2;
      const y = random() * 2 - 1;
      const radius = 180 + random() * 150;
      const horizontal = Math.sqrt(1 - y * y);
      data.set(
        [Math.cos(theta) * horizontal * radius, y * radius, Math.sin(theta) * horizontal * radius],
        i * 3,
      );
    }
    return data;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#c7d3df"
        size={0.24}
        sizeAttenuation
        transparent
        opacity={0.75}
        depthWrite={false}
      />
    </points>
  );
}

function Orbits() {
  const lines = useMemo(
    () =>
      planets.map((planet) => {
        const points = Array.from({ length: 193 }, (_, i) => {
          const angle = (i / 192) * Math.PI * 2;
          return new THREE.Vector3(
            Math.cos(angle) * planet.orbit,
            0,
            Math.sin(angle) * planet.orbit,
          );
        });
        return new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({
            color: '#bba88d',
            transparent: true,
            opacity: 0.17,
            depthWrite: false,
          }),
        );
      }),
    [],
  );
  useEffect(
    () => () =>
      lines.forEach((line) => {
        line.geometry.dispose();
        line.material.dispose();
      }),
    [lines],
  );
  return (
    <group name="orbits">
      {lines.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
    </group>
  );
}

function CameraRig({ progress, reducedMotion, onReady, onFailure }: SceneProps) {
  const { camera, size, gl } = useThree();
  const ready = useRef(false);
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      onFailure();
    };
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [gl, onFailure]);
  useFrame(() => {
    const progressValue = reducedMotion ? journeyState(progress.current).active : progress.current;
    const pose = cameraPose(progressValue, size.width < 760);
    camera.position.set(...pose.eye);
    camera.lookAt(...pose.target);
    if (!ready.current) {
      ready.current = true;
      onReady();
    }
  });
  return null;
}

export default function Scene(props: SceneProps) {
  return (
    <Canvas
      dpr={[1, window.innerWidth < 760 ? 1.25 : 1.75]}
      camera={{ fov: 43, near: 0.1, far: 600, position: [0, 34, 64] }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      fallback={<span>3D 场景不可用</span>}
    >
      <ambientLight intensity={0.19} color="#8fadd2" />
      <pointLight position={[0, 0, 0]} intensity={3.3} decay={0} color="#ffe7ca" />
      <Starfield />
      <Star reducedMotion={props.reducedMotion} />
      <Orbits />
      {planets.map((planet, index) => (
        <PlanetMesh
          key={planet.id}
          planet={planet}
          index={index}
          reducedMotion={props.reducedMotion}
        />
      ))}
      <CameraRig {...props} />
    </Canvas>
  );
}
