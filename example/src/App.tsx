import { useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  useWindowDimensions,
  Pressable,
} from "react-native";
import { MapContainer, LayerBitmapTile } from "react-native-mapsforge-vtm";
import {
  LayerPathColorRamp,
  usePathColorRamp,
  calculateSlope,
  COLOR_RAMPS,
  extractElevation,
  type ColorRamp,
} from "react-native-mapsforge-vtm-ext-path-color-ramp";
import { coordinates } from "./data";
/**
 * Prerequisites:
 * - A .map file on the device (e.g., adb push germany.map /sdcard/)
 * - yalc link react-native-mapsforge-vtm (during development)
 * - react-native-mapsforge-vtm installed as a peer dependency
 *
 * NOTE: This file will only typecheck after `yalc link react-native-mapsforge-vtm`
 * in the example directory, since the core library provides MapContainer types.
 */

/** Maps a 0-1 normalised colour ramp to span the actual data range.
 *  Output stops carry {@code unit: 'absolute'} since the values are now
 *  in the data's real-world units (metres, km/h, etc.). */
function createDataRangeRamp(
  values: number[],
  baseRamp: ColorRamp
): ColorRamp {
  if (values.length === 0) return baseRamp;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) {
    return baseRamp.map((stop) => ({
      ...stop,
      value: min,
      unit: "absolute" as const,
    }));
  }
  return baseRamp.map((stop) => ({
    ...stop,
    value: min + stop.value * range,
    unit: "absolute" as const,
  }));
}

type MetricKey = "slope" | "elevation";

interface MetricPreset {
  key: MetricKey;
  label: string;
  prepare: (
    coords: [number, number, number][]
  ) => {
    segmentValues?: number[];
    vertexValues?: number[];
    colorRamp: ColorRamp | undefined;
  };
}

const METRICS: readonly MetricPreset[] = [
  {
    key: "slope",
    label: "Slope",
    prepare: (coords) => ({
      segmentValues: calculateSlope(coords),
      colorRamp: COLOR_RAMPS.slope,
    }),
  },
  {
    key: "elevation",
    label: "Elevation",
    prepare: (coords) => {
      const vertexVals = extractElevation(coords);
      return {
        vertexValues: vertexVals,
        colorRamp: createDataRangeRamp(vertexVals, COLOR_RAMPS.elevation),
      };
    },
  },
] as const;

export default function App() {

	const { width, height } = useWindowDimensions();



  const defaultCenter = useMemo( () => coordinates[Math.floor(coordinates.length/2)].slice(0,2) as [number, number], [coordinates]);


  const [activeKey, setActiveKey] = useState<MetricKey>("slope");

  const activePreset = useMemo(
    () => METRICS.find((m) => m.key === activeKey)!,
    [activeKey]
  );

  const prepared = useMemo(
    () => activePreset.prepare(coordinates),
    [activePreset, coordinates]
  );

  const {
    segmentColors,
    colorRampStops,
    normalizedValues,
    valueMode,
  } = usePathColorRamp({
    coordinates,
    segmentValues: prepared.segmentValues,
    vertexValues: prepared.vertexValues,
    colorRamp: prepared.colorRamp,
  });

  return (
    <View style={styles.container}>
			<MapContainer
				width={width}
				height={height}
				center={defaultCenter}
				zoomLevel={14}
			>
        <LayerBitmapTile />
        {coordinates.length > 0 && (
          <LayerPathColorRamp
            coordinates={coordinates}
            segmentValues={
              valueMode === "segment" ? normalizedValues : undefined
            }
            vertexValues={
              valueMode === "vertex" ? normalizedValues : undefined
            }
            colorRampStops={colorRampStops}
            style={{ strokeWidth: 6 }}
          />
        )}
      </MapContainer>

      {/* Metric toggle chips */}
      <View style={styles.toggleBar}>
        {METRICS.map((metric) => {
          const isActive = metric.key === activeKey;
          return (
            <Pressable
              key={metric.key}
              style={[
                styles.toggleChip,
                isActive && styles.toggleChipActive,
              ]}
              onPress={() => setActiveKey(metric.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[
                  styles.toggleChipText,
                  isActive && styles.toggleChipTextActive,
                ]}
              >
                {metric.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.info}>
        {activePreset.label} coloring. {coordinates.length} points.{" "}
        Segments: {segmentColors?.length ?? 0}
        {"\n"}vals:{" "}
        {normalizedValues.length > 0
          ? `${Math.min(...normalizedValues).toFixed(3)}..${Math.max(...normalizedValues).toFixed(3)}`
          : "none"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toggleBar: {
    position: "absolute",
    top: 50,
    alignSelf: "center",
    flexDirection: "row",
    gap: 8,
  },
  toggleChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    minWidth: 80,
    alignItems: "center",
  },
  toggleChipActive: {
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  toggleChipText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontWeight: "600",
  },
  toggleChipTextActive: {
    color: "#1a1a1a",
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
