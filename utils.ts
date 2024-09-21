import { Matrix3 } from '@shopify/react-native-skia/src/skia/types/Matrix4';

export type Vec3 = readonly [number, number, number];
export type Vec2 = readonly [number, number];

export const identityMatrix3: Matrix3 = [
  1, 0, 0,
  0, 1, 0,
  0, 0, 1,
];

/**
 * Returns a point in which a segment ab intersects with a circle centered in (0, 0)
 * @param A A point within circle
 * @param B A point outside circle
 * @param r Radius of the circle
 */
export const getCircleAndSegmentIntersection = (A: Vec2, B: Vec2, r: number): Vec2 => {
  'worklet';
  const dx = B[0] - A[0];
  const dy = B[1] - A[1];

  const a = dx * dx + dy * dy;
  const b = 2 * (A[0] * dx + A[1] * dy);
  const c = A[0] * A[0] + A[1] * A[1] - r * r;

  const discriminant = b * b - 4 * a * c;

  const t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
  const t2 = (-b - Math.sqrt(discriminant)) / (2 * a);

  const t = (0 <= t1 && t1 <= 1) ? t1 : t2;

  const x = A[0] + t! * dx;
  const y = A[1] + t! * dy;
  return [x, y];
}

// https://en.wikipedia.org/wiki/Rotation_matrix#Rotation_matrix_from_axis_and_angle
export const getRotationMatrix = (
  axisVec: Vec3,
  angle: number
): Matrix3 => {
  'worklet';
  const x = axisVec[0];
  const y = axisVec[1];
  const z = axisVec[2];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  return [
    t * x * x + c,
    t * x * y - s * z,
    t * x * z + s * y,
    t * x * y + s * z,
    t * y * y + c,
    t * y * z - s * x,
    t * x * z - s * y,
    t * y * z + s * x,
    t * z * z + c,
  ];
};

export const normalizeVec = (vec: Vec3): Vec3 => {
  'worklet';
  const [x, y, z] = vec;
  const length = Math.hypot(x, y, z);
  if (length === 0) {
    return [0, 0, 0];
  }
  return [x / length, y / length, z / length];
}

export const crossProductVec3 = (a: Vec3, b: Vec3): Vec3 => {
  'worklet';
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
};

export const crossProductVec2 = (a: Vec2, b: Vec2): number => {
  'worklet';
  return a[0] * b[1] - a[1] * b[0];
}

export const dotProduct = (a: Vec3, b: Vec3) => {
  'worklet';
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
};

export const multiply3 = (a: Matrix3, b: Matrix3): Matrix3 => {
  'worklet';
  const result = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      result[i * 3 + j] =
        a[i * 3] * b[j] +
        a[i * 3 + 1] * b[j + 3] +
        a[i * 3 + 2] * b[j + 6];
    }
  }
  return result as unknown as Matrix3;
};
