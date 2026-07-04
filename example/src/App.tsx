import { View, StyleSheet, Text } from 'react-native';
import { MapContainer, LayerMapsforge } from 'react-native-mapsforge-vtm';
import {
  LayerPathColorRamp,
  usePathColorRamp,
  calculateSlope,
} from 'react-native-mapsforge-vtm-ext-path-color-ramp';

/**
 * Minimal example demonstrating the color-ramp path extension.
 *
 * Prerequisites:
 * - A .map file on the device (e.g., adb push germany.map /sdcard/)
 * - yalc link react-native-mapsforge-vtm (during development)
 * - react-native-mapsforge-vtm installed as a peer dependency
 *
 * NOTE: This file will only typecheck after `yalc link react-native-mapsforge-vtm`
 * in the example directory, since the core library provides MapContainer types.
 */
export default function App() {
  // Example: a short path with elevation data for slope coloring.
  // Position format: [lng, lat, alt?] (geojson Position).
  const coordinates: [number, number, number][] = [
    [13.405, 52.52, 34],
    [13.41, 52.53, 42],
    [13.42, 52.54, 55],
    [13.43, 52.54, 48],
    [13.44, 52.53, 36],
  ];

  const slopeValues = calculateSlope(coordinates);
  const { segmentColors, colorRampStops } = usePathColorRamp({
    coordinates,
    segmentValues: slopeValues,
  });

  return (
    <View style={styles.container}>
      <MapContainer style={styles.map}>
        <LayerMapsforge mapFile="/sdcard/germany.map" />
        {coordinates.length > 0 && (
          <LayerPathColorRamp
            coordinates={coordinates}
            segmentValues={slopeValues}
            colorRampStops={colorRampStops}
            style={{ strokeWidth: 6 }}
          />
        )}
      </MapContainer>
      <Text style={styles.info}>
        Color-ramp path with {coordinates.length} points.{' '}
        Segments: {segmentColors?.length ?? 0}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  info: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    padding: 10,
    borderRadius: 8,
    fontSize: 13,
  },
});
