export type PreludeState = 'rest' | 'flow' | 'charge';

// One closed eight-curve silhouette in three authored postures. Matching point
// counts let the homepage interpolate this single body without swapping art.
const SHAPES: Record<PreludeState, readonly number[]> = {
  rest: [
    337, 81,
    415, 66, 488, 119, 510, 192,
    527, 248, 504, 278, 537, 330,
    581, 398, 566, 478, 509, 527,
    454, 575, 391, 562, 335, 571,
    265, 583, 194, 587, 148, 531,
    108, 482, 128, 424, 124, 363,
    119, 299, 90, 245, 125, 186,
    161, 127, 227, 103, 337, 81,
  ],
  flow: [
    337, 78,
    420, 59, 495, 105, 516, 184,
    534, 245, 514, 279, 542, 336,
    581, 404, 567, 487, 501, 542,
    442, 589, 375, 577, 322, 590,
    249, 589, 184, 569, 142, 523,
    101, 472, 121, 407, 113, 351,
    110, 286, 87, 234, 130, 171,
    171, 117, 237, 92, 337, 78,
  ],
  charge: [
    331, 63,
    421, 45, 499, 94, 529, 177,
    545, 245, 529, 274, 557, 336,
    607, 405, 566, 496, 506, 551,
    448, 602, 364, 580, 318, 594,
    244, 597, 175, 584, 129, 530,
    81, 478, 112, 397, 103, 338,
    98, 271, 88, 214, 129, 160,
    175, 100, 241, 82, 331, 63,
  ],
};

function pathFrom(points: readonly number[]) {
  let path = `M${points[0]} ${points[1]}`;
  for (let index = 2; index < points.length; index += 6) {
    path += `C${points[index]} ${points[index + 1]} ${points[index + 2]} ${points[index + 3]} ${points[index + 4]} ${points[index + 5]}`;
  }
  return `${path}Z`;
}

export function preludePath(state: PreludeState) {
  return pathFrom(SHAPES[state]);
}

export function interpolatePreludePath(from: PreludeState, to: PreludeState, amount: number) {
  const start = SHAPES[from];
  const end = SHAPES[to];
  const points = start.map((point, index) => Math.round((point + (end[index] - point) * amount) * 10) / 10);
  return pathFrom(points);
}
