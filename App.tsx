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
import {
  crossProductVec2,
  crossProductVec3,
  dotProduct,
  getCircleAndSegmentIntersection,
  getRotationMatrix,
  identityMatrix3,
  multiply3,
  normalizeVec,
  Vec2,
  Vec3
} from './utils';

const source = Skia.RuntimeEffect.Make(`
uniform shader image;

uniform float2 c;
uniform float r;
uniform mat3 rotationMatrix;
uniform float2 res;

const float PI = 3.14159265359;
 
half4 main(float2 pos) {
  // Convert pos to xy in the range [-1, 1]
  float2 xy = (pos - c) / r;
  float z = sqrt(1.0 - dot(xy, xy));
  
  vec3 p = rotationMatrix * vec3(xy, z);
  
  // https://en.wikipedia.org/wiki/UV_mapping#Finding_UV_on_a_sphere
  float u = 0.5 + atan(p.x, p.z) / (2.0 * PI);
  float v = 0.5 + asin(p.y) / PI;
  
  return image.eval(vec2(u * res.x, v * res.y));
}`)!;


export default function App() {
  const image = useImage(require('./assets/Equirectangular-projection.jpg'))

  const { height, width, onLayout } = useLayout()
  const r = width / 2 - 20
  const cx = width / 2
  const cy = height / 2

  // A vector from sphere center to the point where user started the pan gesture
  const panStart = useSharedValue<Vec3>([0, 0, 0])
  const gestureStartedOutside = useSharedValue(false)
  const rotationAtPanStart = useSharedValue<Matrix3>(identityMatrix3)
  const prevRotation = useSharedValue<Matrix3>(identityMatrix3)

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

      // If the point is outside the sphere, find the intersection with the sphere
      if (Math.hypot(e.x - r, e.y - r) > r) {
        [x, y] = getCircleAndSegmentIntersection(panStart.value as unknown as Vec2, [x, y], r)
        z = 0
      }

      // A vector from sphere center to the current point
      const a = normalizeVec([x, y, z])
      // A vector from sphere center to the point where user started the pan gesture
      const b = normalizeVec(panStart.value)
      axis.value = normalizeVec(crossProductVec3(b, a))
      angle.value = Math.acos(dotProduct(b, a))
      prevRotation.value = rotationAtPanStart.value
    }).onFinalize((e) => {
      const x = e.x - r
      const y = e.y - r

      const velocity = Math.hypot(e.velocityX, e.velocityY) / r

      // TODO there might be a better way to check if velocity is in the same direction as the pan gesture
      // Take one of vectors perpendicular to the pan vector from Z plane and check if the gesture
      // and velocity are on the same side of this vector
      const perpendicularToGesture = [-(y - panStart.value[1]), (x - panStart.value[0])] as const
      const velocityCross = crossProductVec2(perpendicularToGesture, [e.velocityX, e.velocityY])
      const gestureCross = crossProductVec2(perpendicularToGesture, [x - panStart.value[0], y - panStart.value[1]])

      angle.value = withDecay({ velocity: velocity * Math.sign(velocityCross * gestureCross) })
    })

  const uniforms = useDerivedValue(() => ({
    c: [cx, cy],
    r,
    rotationMatrix: rotationMatrix.value,
    res: [image?.width() ?? 0, image?.height() ?? 0]
  }))

  return (
    <GestureHandlerRootView onLayout={onLayout}>
      {!!height && !!width && image && (
        <Canvas style={{ flex: 1 }}>
          <Fill>
            <Paint color={'#333'}/>
          </Fill>
          <Circle r={r} cy={cy} cx={cx}>
            <Shader source={source} uniforms={uniforms}>
              <ImageShader
                image={image} fit="cover"
                rect={{ x: 0, y: 0, height: image.height(), width: image.width() }}
              />
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

