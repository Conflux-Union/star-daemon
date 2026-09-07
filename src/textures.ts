import { CanvasTexture } from 'three';

export function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,241,205,1)');
  gradient.addColorStop(0.14, 'rgba(255,207,125,.6)');
  gradient.addColorStop(0.3, 'rgba(241,142,61,.19)');
  gradient.addColorStop(0.6, 'rgba(202,94,30,.04)');
  gradient.addColorStop(1, 'rgba(180,72,20,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new CanvasTexture(canvas);
}
