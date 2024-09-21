import { Canvas, Circle, Fill, ImageShader, Paint, Shader, Skia, useImage } from '@shopify/react-native-skia';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useLayout } from '@react-native-community/hooks';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';
import { View } from 'react-native';
import { useEffect } from 'react';

const source = Skia.RuntimeEffect.Make(`
uniform shader image;

uniform float2 c;
uniform float r;
uniform float rotation;

const float PI = 3.14159265359;
 
half4 main(float2 pos) {
  float2 xy = (pos - c) / r;
  float z = sqrt(1.0 - dot(xy, xy));
  
  mat3 rotationMatrix = mat3(cos(rotation),  0, sin(rotation),
                             0,              1, 0, 
                             -sin(rotation), 0, cos(rotation));
                           
  vec3 p = rotationMatrix * vec3(xy, z);
  
  float u = 0.5 + atan(p.x, p.z) / (2.0 * PI);
  float v = 0.5 + asin(p.y) / PI;
  
  return image.eval(vec2(u*2.0, v));
}`)!;

export default function App() {
  const image = useImage(require('./assets/Equirectangular-projection.jpg'))

  const { height, width, onLayout } = useLayout()
  const r = width / 2 - 20
  const cx = width / 2
  const cy = height / 2

  const rotation = useSharedValue(0)

  useEffect(() => {
    rotation.value = withRepeat(withTiming(-2 * Math.PI, { duration: 10_000, easing: Easing.linear }), -1)
  }, []);

  const uniforms = useDerivedValue(() => ({ c: [cx, cy], r, rotation: rotation.value }))

  const gesture = Gesture.Pan()

  return (
    <GestureHandlerRootView onLayout={onLayout}>
      {!!height && !!width && (
        <Canvas style={{ flex: 1 }}>
          <Fill>
            <Paint color={'#333'}/>
          </Fill>
          <Circle r={r} cy={cy} cx={cx}>
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

