import {
  Canvas,
  Circle,
  Fill,
  ImageShader,
  Paint,
  Shader,
  Skia,
  useImage
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useLayout } from '@react-native-community/hooks';
import {
  useDerivedValue,
  useSharedValue, withDecay
} from 'react-native-reanimated';
import { View } from 'react-native';
import { Matrix3 } from '@shopify/react-native-skia/src/skia/types/Matrix4';

const source = Skia.RuntimeEffect.Make(`
uniform shader image;

uniform float2 c;
uniform float r;
uniform mat3 rotationMatrix;

const float PI = 3.14159265359;
 
half4 main(float2 pos) {
  // Convert pos to xy in the range [-1, 1]
  float2 xy = (pos - c) / r;
  float z = sqrt(1.0 - dot(xy, xy));
  
  vec3 p = rotationMatrix * vec3(xy, z);
  
  // https://en.wikipedia.org/wiki/UV_mapping#Finding_UV_on_a_sphere
  float u = 0.5 + atan(p.x, p.z) / (2.0 * PI);
  float v = 0.5 + asin(p.y) / PI;
  
  return image.eval(vec2(u*2.0, v));
}`)!;

type Vec3 = readonly [number, number, number];

// https://en.wikipedia.org/wiki/Rotation_matrix#Rotation_matrix_from_axis_and_angle
const getRotationMatrix = (
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

const normalizeVec = (vec: Vec3): Vec3 => {
  'worklet';
  const [x, y, z] = vec;
  const length = Math.hypot(x, y, z);
  if (length === 0) {
    return [0, 0, 0];
  }
  return [x / length, y / length, z / length];
}

const crossProductVec = (a: Vec3, b: Vec3): Vec3 => {
  'worklet';
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
};

const dotProduct = (a: Vec3, b: Vec3) => {
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


export default function App() {
  const image = useImage(require('./assets/Equirectangular-projection.jpg'))

  const { height, width, onLayout } = useLayout()
  const r = width / 2 - 20
  const cx = width / 2
  const cy = height / 2

  // A vector from sphere center to the point where user started the pan gesture
  const panStart = useSharedValue<Vec3>([0, 0, 0])
  const gestureStartedOutside = useSharedValue(false)
  const rotationAtPanStart = useSharedValue<Matrix3>([1, 0, 0, 0, 1, 0, 0, 0, 1])
  const prevRotation = useSharedValue<Matrix3>([1, 0, 0, 0, 1, 0, 0, 0, 1])

  const axis = useSharedValue<Vec3>([1, 0, 0])
  const angle = useSharedValue(0)

  const rotationMatrix = useDerivedValue(() =>
    multiply3(getRotationMatrix(axis.value, angle.value), prevRotation.value)
  )

  const gesture = Gesture.Pan()
    .onBegin((e) => {
      const x = e.x - r
      const y = e.y - r
      if (Math.hypot(x, y) > r) {
        gestureStartedOutside.value = true
        return
      } else {
        gestureStartedOutside.value = false
      }
      const z = Math.sqrt(r * r - x * x - y * y)
      panStart.value = [x, y, z]
      rotationAtPanStart.value = rotationMatrix.value
    }).onChange((e) => {
      if (gestureStartedOutside.value) {
        return
      }
      let x = e.x - r
      let y = e.y - r
      let z = Math.sqrt(r * r - x * x - y * y)
      if (Math.hypot(e.x - r, e.y - r) > r) {
        // Set x, y to the point where the pan gesture intersects with the sphere
        const dx = x - panStart.value[0];
        const dy = y - panStart.value[1];

        const a = dx * dx + dy * dy;
        const b = 2 * (panStart.value[0] * dx + panStart.value[1] * dy);
        const c = panStart.value[0] * panStart.value[0] + panStart.value[1] * panStart.value[1] - r * r;

        const discriminant = b * b - 4 * a * c;

        const t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
        const t2 = (-b - Math.sqrt(discriminant)) / (2 * a);

        const t = (0 <= t1 && t1 <= 1) ? t1 : t2;

        x = panStart.value[0] + t! * dx;
        y = panStart.value[1] + t! * dy;
        z = 0
      }

      // A vector from sphere center to the current point
      const a = normalizeVec([x, y, z])
      // A vector from sphere center to the point where user started the pan gesture
      const b = normalizeVec(panStart.value)
      prevRotation.value = rotationAtPanStart.value
      axis.value = normalizeVec(crossProductVec(b, a))
      angle.value = Math.acos(dotProduct(b, a))
    }).onFinalize((e) => {
      const x = e.x - r
      const y = e.y - r

      const velocity = Math.hypot(e.velocityX, e.velocityY) / r

      // TODO there might be a better way to check if velocity is in the same direction as the pan gesture
      // Take one of vectors perpendicular to the pan vector from Z plane and check if the pan
      // and velocity are on the same side
      const perpendicularToGesture = [-(y - panStart.value[1]), (x - panStart.value[0])]
      const velocityCross = perpendicularToGesture[0] * e.velocityY - perpendicularToGesture[1] * e.velocityX
      const gestureCross =
        perpendicularToGesture[0] * (y - panStart.value[1])
        - perpendicularToGesture[1] * (x - panStart.value[0])

      angle.value = withDecay({ velocity: velocity * Math.sign(velocityCross * panCross) })
    })

  const uniforms = useDerivedValue(() => ({ c: [cx, cy], r, rotationMatrix: rotationMatrix.value }))


  return (
    <GestureHandlerRootView onLayout={onLayout}>
      {!!height && !!width && (
        <Canvas style={{ flex: 1 }}>
          <Fill>
            <Paint color={'#333'}/>
          </Fill>
          <Circle r={r} cy={cy} cx={cx}>
            {/* TODO pass texture res as a uniform */}
            <Shader source={source} uniforms={uniforms}>
              <ImageShader image={image} fit="cover" rect={{ x: 0, y: 0, height: 1, width: 2 }}/>
            </Shader>
          </Circle>
        </Canvas>
      )}
      <GestureDetector gesture={gesture}>
        <View style={{
          width: 2 * r,
          height: 2 * r,
          borderRadius: r,
          position: 'absolute',
          top: cy - r,
          left: cx - r,
        }}/>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

