import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cameraPose, chapterCount, chapterPose, journeyState, planets } from './journey.ts';

test('scroll boundaries and invalid inputs stay within the seven chapters', () => {
  assert.equal(journeyState(-2).active, 0);
  assert.equal(journeyState(NaN).active, 0);
  assert.equal(journeyState(99).active, 6);
  assert.equal(chapterCount, 7);
});

test('chapter arrivals and reading plateaus use the exact composed pose', () => {
  for (const mobile of [false, true]) {
    for (let i = 0; i < chapterCount; i++) {
      assert.deepEqual(cameraPose(i, mobile), chapterPose(i, mobile));
      assert.deepEqual(cameraPose(i + 0.2, mobile), chapterPose(i, mobile));
    }
  }
});

test('flights are continuous, reversible, finite and avoid celestial bodies', () => {
  for (const mobile of [false, true]) {
    let last = cameraPose(0, mobile);
    for (let step = 1; step <= 6000; step++) {
      const progress = step / 1000;
      const pose = cameraPose(progress, mobile);
      assert.deepEqual(pose, cameraPose(progress, mobile));
      assert.ok([...pose.eye, ...pose.target].every(Number.isFinite));
      assert.ok(Math.hypot(...pose.eye.map((v, i) => v - last.eye[i])) < 0.25);
      assert.ok(Math.hypot(...pose.eye) > 3.2);
      for (const planet of planets) {
        assert.ok(
          Math.hypot(...pose.eye.map((v, i) => v - planet.position[i])) > planet.radius * 1.1,
        );
      }
      last = pose;
    }
  }
});
