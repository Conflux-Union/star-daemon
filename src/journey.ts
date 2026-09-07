export type Vec3 = [number, number, number];
export type PlanetKind = 'rock' | 'ocean' | 'desert' | 'gas' | 'ice' | 'storm';

export interface Planet {
  id: string;
  name: string;
  title: string;
  subtitle: string;
  description: string;
  kind: PlanetKind;
  color: string;
  position: Vec3;
  radius: number;
  orbit: number;
  facts: [string, string][];
}

export const planets: Planet[] = [
  {
    id: 'pyra',
    name: 'XXXXX',
    title: 'XXXXX',
    subtitle: 'XXXXX',
    kind: 'rock',
    color: '#d38b62',
    position: [7, 0, 5],
    radius: 0.85,
    orbit: Math.hypot(7, 5),
    description: 'XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX.',
    facts: [
      ['XXXXX', 'XXXXX'],
      ['XXXXX', 'XXXXX'],
      ['XXXXX', 'XXXXX'],
    ],
  },
  {
    id: 'thalassa',
    name: 'XXXXX',
    title: 'XXXXX',
    subtitle: 'XXXXX',
    kind: 'ocean',
    color: '#8bbfda',
    position: [-10, 0, -8],
    radius: 1.25,
    orbit: Math.hypot(10, 8),
    description: 'XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX.',
    facts: [
      ['XXXXX', 'XXXXX'],
      ['XXXXX', 'XXXXX'],
      ['XXXXX', 'XXXXX'],
    ],
  },
  {
    id: 'sahra',
    name: 'XXXXX',
    title: 'XXXXX',
    subtitle: 'XXXXX',
    kind: 'desert',
    color: '#d9b47c',
    position: [17, 0, -9],
    radius: 1.05,
    orbit: Math.hypot(17, 9),
    description: 'XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX.',
    facts: [
      ['XXXXX', 'XXXXX'],
      ['XXXXX', 'XXXXX'],
      ['XXXXX', 'XXXXX'],
    ],
  },
  {
    id: 'aurelia',
    name: 'XXXXX',
    title: 'XXXXX',
    subtitle: 'XXXXX',
    kind: 'gas',
    color: '#dfc79e',
    position: [24, 0, 9],
    radius: 2.4,
    orbit: Math.hypot(24, 9),
    description: 'XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX.',
    facts: [
      ['XXXXX', 'XXXXX'],
      ['XXXXX', 'XXXXX'],
      ['XXXXX', 'XXXXX'],
    ],
  },
  {
    id: 'nivalis',
    name: 'XXXXX',
    title: 'XXXXX',
    subtitle: 'XXXXX',
    kind: 'ice',
    color: '#b1d5dd',
    position: [-27, 0, 13],
    radius: 1.5,
    orbit: Math.hypot(27, 13),
    description: 'XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX.',
    facts: [
      ['XXXXX', 'XXXXX'],
      ['XXXXX', 'XXXXX'],
      ['XXXXX', 'XXXXX'],
    ],
  },
  {
    id: 'vesper',
    name: 'XXXXX',
    title: 'XXXXX',
    subtitle: 'XXXXX',
    kind: 'storm',
    color: '#b0a0d8',
    position: [5, 0, -38],
    radius: 1.9,
    orbit: Math.hypot(5, 38),
    description: 'XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX.',
    facts: [
      ['XXXXX', 'XXXXX'],
      ['XXXXX', 'XXXXX'],
      ['XXXXX', 'XXXXX'],
    ],
  },
];

export const chapterCount = planets.length + 1;
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const smoothstep = (t: number) => t * t * (3 - 2 * t);

// Each chapter reserves its first 30% for reading before the next flight.
export function journeyState(progress: number) {
  const value = clamp(Number.isFinite(progress) ? progress : 0, 0, chapterCount - 1);
  const from = Math.floor(value);
  const to = Math.min(from + 1, chapterCount - 1);
  const t = smoothstep(clamp((value - from - 0.3) / 0.7, 0, 1));
  return { from, to, t, active: t < 0.5 ? from : to };
}

export function chapterPose(index: number, mobile: boolean): { eye: Vec3; target: Vec3 } {
  if (index === 0)
    return mobile
      ? { eye: [0, 53, 82], target: [0, -9, 0] }
      : { eye: [0, 34, 64], target: [-10, 0, 0] };
  const planet = planets[index - 1];
  const [x, y, z] = planet.position;
  const distance =
    planet.radius *
    (mobile ? (planet.kind === 'gas' ? 13 : 8.5) : planet.kind === 'gas' ? 7.8 : 6.4);
  const offset = mobile ? 0 : planet.radius * (index % 2 === 1 ? -1.4 : 1.4);
  // View from 55 degrees off the star-facing direction for a lit crescent edge.
  const angle = Math.atan2(-x, -z) + Math.PI * 0.305;
  const dx = Math.sin(angle),
    dz = Math.cos(angle);
  const target: Vec3 = [
    x + dz * offset,
    y - (mobile ? planet.radius * (planet.kind === 'gas' ? 2.6 : 1.7) : 0),
    z - dx * offset,
  ];
  return {
    eye: [target[0] + dx * distance, y + distance * 0.2, target[2] + dz * distance],
    target,
  };
}

export function cameraPose(progress: number, mobile: boolean) {
  const { from, to, t } = journeyState(progress);
  const a = chapterPose(from, mobile);
  const b = chapterPose(to, mobile);
  const mix = (start: Vec3, end: Vec3): Vec3 => start.map((v, i) => v + (end[i] - v) * t) as Vec3;
  const eye = mix(a.eye, b.eye);
  // Lift flights above the orbital plane instead of cutting through the star.
  eye[1] += Math.sin(Math.PI * t) * 13;
  return { eye, target: mix(a.target, b.target) };
}
