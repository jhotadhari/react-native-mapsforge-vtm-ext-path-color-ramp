package com.jhotadhari.reactnative.mapsforge.vtm.ext.pathcolorramp;

import android.content.ContentResolver;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableType;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeMap;
import com.jhotadhari.reactnative.mapsforge.vtm.PathLayerManager;
import com.jhotadhari.reactnative.mapsforge.vtm.Utils;
import com.jhotadhari.reactnative.mapsforge.vtm.layer.LayerManager;
import com.jhotadhari.reactnative.mapsforge.vtm.layer.VectorLayer;
import com.jhotadhari.reactnative.mapsforge.vtm.views.MapFragment;

import org.locationtech.jts.geom.Coordinate;
import org.oscim.android.MapView;
import org.oscim.layers.Layer;
import org.oscim.layers.vector.geometries.LineDrawable;
import org.oscim.layers.vector.geometries.Style;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * Extends {@link PathLayerManager} to support per-segment color-ramp rendering.
 *
 * <h3>Design</h3>
 * <ul>
 *   <li>{@link #createSharedLayer()} returns a {@link ColorRampVectorLayer}
 *       instead of a plain {@code VectorLayer}.</li>
 *   <li>{@link #createEntry} extracts {@code segmentValues} and
 *       {@code colorRampStops} from the JS params, then delegates to the
 *       parent for the standard coordinate/style parsing.</li>
 *   <li>Per-segment values are stored per-drawable in the
 *       {@link ColorRampVectorLayer} via
 *       {@link ColorRampVectorLayer#addLineDrawableWithValues}.</li>
 * </ul>
 *
 * <p>Use {@link #get(int, MapView)} to obtain or create the singleton
 * manager for a given map view.
 */
public class ColorRampPathLayerManager extends PathLayerManager {

    private static final Logger log = Logger.getLogger(
            ColorRampPathLayerManager.class.getName());

    // ── Factory ────────────────────────────────────────────────────────────

    /** Unique name — avoids clashing with plain PathLayerManager instances. */
    private static final String MGR_NAME = NAME + "_colorramp";

    @NonNull
    public static ColorRampPathLayerManager get(int nativeNodeHandle,
                                                 @NonNull MapView mapView) {
        // Use a method reference to the protected constructor.
        LayerManager.Factory<ColorRampPathLayerManager> factory =
                (nh, mv, n) -> new ColorRampPathLayerManager(nh, mv, n);
        return LayerManager.get(nativeNodeHandle, mapView, MGR_NAME, factory);
    }

    @Nullable
    public static ColorRampPathLayerManager getInstance(int nativeNodeHandle) {
        return (ColorRampPathLayerManager) LayerManager.getInstance(
                nativeNodeHandle, MGR_NAME);
    }

    // ── Per-entry segment values ───────────────────────────────────────────

    /** Maps entry uuid → per-segment normalized values (0–1). */
    private final Map<String, float[]> entrySegmentValues = new ConcurrentHashMap<>();

    // ── Constructor ────────────────────────────────────────────────────────

    protected ColorRampPathLayerManager(int nativeNodeHandle,
                                         @NonNull MapView mapView,
                                         @NonNull String name) {
        super(nativeNodeHandle, mapView, name);
    }

    // ── LayerManager overrides ─────────────────────────────────────────────

    @NonNull
    @Override
    protected Layer createSharedLayer() {
        ColorRampVectorLayer layer = new ColorRampVectorLayer(
                mapView.map(),
                sharedLayerUuid,
                true,
                createGestureListener(),
                30f
        );
        // Install uuid resolver so gesture events carry per-entry uuids.
        layer.setUuidResolver(drawable -> {
            for (PathEntry entry : entries.values()) {
                if (entry.drawables.contains(drawable)) {
                    return entry.pathUuid;
                }
            }
            return sharedLayerUuid;
        });
        return layer;
    }

    @NonNull
    @Override
    protected CreateResult<PathEntry> createEntry(
            @NonNull String entryUuid,
            @NonNull ReadableMap params,
            @NonNull MapFragment mapFragment,
            @NonNull ContentResolver contentResolver,
            @NonNull ReactApplicationContext reactContext
    ) throws Exception {
        // ── Parse segment values before delegating ──
        float[] segmentValues = null;
        if (Utils.rMapHasKey(params, "segmentValues")) {
            ReadableArray svArray = params.getArray("segmentValues");
            if (svArray != null && svArray.size() > 0) {
                segmentValues = new float[svArray.size()];
                for (int i = 0; i < svArray.size(); i++) {
                    segmentValues[i] = (float) svArray.getDouble(i);
                }
            }
        }

        // ── Parse color ramp stops ──
        String[] colorRampStops = null;
        if (Utils.rMapHasKey(params, "colorRampStops")) {
            ReadableArray crArray = params.getArray("colorRampStops");
            if (crArray != null && crArray.size() >= 2) {
                colorRampStops = new String[crArray.size()];
                for (int i = 0; i < crArray.size(); i++) {
                    colorRampStops[i] = crArray.getString(i);
                }
            }
        }

        // ── Delegate to parent for standard parsing and drawable creation ──
        CreateResult<PathEntry> result = super.createEntry(
                entryUuid, params, mapFragment, contentResolver, reactContext);

        // ── Post-process: if we have per-segment values, re-register
        //     drawables with values in the ColorRampVectorLayer ─────────
        if (segmentValues != null && segmentValues.length > 0) {
            PathEntry entry = result.entry;
            ColorRampVectorLayer crLayer = (ColorRampVectorLayer)
                    getSharedLayer(entry.fragmentUuid);

            if (crLayer != null && !entry.drawables.isEmpty()) {
                // Remove plain drawables, re-add with values.
                for (LineDrawable d : entry.drawables) {
                    crLayer.remove(d);
                }
                entry.drawables.clear();

                Style style = getStyleBuilder(
                        Utils.rMapHasKey(params, "style")
                                ? params.getMap("style")
                                : null).build();

                Coordinate[] coords = entry.jtsCoordinates;
                int expectedSegments = coords.length - 1;
                if (segmentValues.length != expectedSegments) {
                    log.warning("segmentValues length ("
                            + segmentValues.length
                            + ") does not match segment count ("
                            + expectedSegments
                            + ") for entry " + entryUuid
                            + "; values will be mismatched");
                }
                // Pre-compute per-vertex values. Each vertex connecting
                // two segments blends those segments' values. The blend
                // strength is controlled by BLEND_LENGTH_M: segments
                // shorter than this blend fully; longer segments keep
                // more of their own colour through the middle.
                float[] vertexVals = new float[coords.length];
                for (int i = 0; i < coords.length; i++) {
                    if (i == 0) {
                        vertexVals[i] = segmentValues.length > 0
                                ? segmentValues[0] : 0.5f;
                    } else if (i == coords.length - 1) {
                        vertexVals[i] = segmentValues.length > 0
                                ? segmentValues[segmentValues.length - 1] : 0.5f;
                    } else {
                        float a = (i - 1) < segmentValues.length
                                ? segmentValues[i - 1] : 0.5f;
                        float b = i < segmentValues.length
                                ? segmentValues[i] : 0.5f;

                        // Simple average of adjacent segment values at
                        // connecting vertices.  The GPU linearly interpolates
                        // between start and end vertices within each segment,
                        // producing a smooth gradient.
                        vertexVals[i] = (a + b) / 2.0f;
                    }
                }
                for (int i = 0; i < coords.length; i++) {
                    if (i != 0) {
                        double[] segment = new double[4];
                        segment[0] = coords[i].x;
                        segment[1] = coords[i].y;
                        segment[2] = coords[i - 1].x;
                        segment[3] = coords[i - 1].y;
                        LineDrawable drawable = new LineDrawable(
                                segment, style);
                        drawable.setPriority(entry.positionIndex);

                        // Pass both vertex values so the line builder
                        // can assign per-vertex colors for smooth shading.
                        crLayer.addLineDrawableWithValues(drawable,
                                new float[]{vertexVals[i - 1], vertexVals[i]});
                        entry.drawables.add(drawable);
                    }
                }

                entrySegmentValues.put(entryUuid, segmentValues);
            }
        } else {
        }

        // ── Upload color-ramp texture if stops provided ──
        // setColorRampStops builds the pixel buffer on the bridge thread;
        // the GL-thread update() call in the next frame uploads it to the GPU.
        if (colorRampStops != null) {
            ColorRampVectorLayer crLayer = (ColorRampVectorLayer)
                    getSharedLayer(result.entry.fragmentUuid);
            if (crLayer != null) {
                crLayer.setColorRampStops(colorRampStops);
            }
        }

        return result;
    }

    @NonNull
    @Override
    protected UpdateResult updateEntry(
            @NonNull PathEntry entry,
            @NonNull ReadableMap params,
            @NonNull MapFragment mapFragment,
            @NonNull ContentResolver contentResolver
    ) throws Exception {
        // ── Snapshot the incoming segment values and color-ramp stops ──
        //     before delegating to the parent (which recreates drawables).
        float[] segmentValues = null;
        if (Utils.rMapHasKey(params, "segmentValues")) {
            ReadableArray svArray = params.getArray("segmentValues");
            if (svArray != null && svArray.size() > 0) {
                segmentValues = new float[svArray.size()];
                for (int i = 0; i < svArray.size(); i++) {
                    segmentValues[i] = (float) svArray.getDouble(i);
                }
            }
        }

        String[] colorRampStops = null;
        if (Utils.rMapHasKey(params, "colorRampStops")) {
            ReadableArray crArray = params.getArray("colorRampStops");
            if (crArray != null && crArray.size() >= 2) {
                colorRampStops = new String[crArray.size()];
                for (int i = 0; i < crArray.size(); i++) {
                    colorRampStops[i] = crArray.getString(i);
                }
            }
        }

        // ── Delegate to parent FIRST (handles coordinate/style update,
        //     removes old drawables, recreates plain ones) ──
        UpdateResult result = super.updateEntry(entry, params,
                mapFragment, contentResolver);

        // ── Post-process: replace parent's plain drawables with
        //     color-ramp-valued ones if segment values are present ──
        if (segmentValues != null && segmentValues.length > 0) {
            entrySegmentValues.put(entry.pathUuid, segmentValues);

            ColorRampVectorLayer crLayer = (ColorRampVectorLayer)
                    getSharedLayer(entry.fragmentUuid);
            if (crLayer != null && !entry.drawables.isEmpty()) {
                // Remove parent's plain drawables.
                for (LineDrawable d : entry.drawables) {
                    crLayer.remove(d);
                }
                entry.drawables.clear();

                Style style = getStyleBuilder(
                        Utils.rMapHasKey(params, "style")
                                ? params.getMap("style")
                                : null).build();

                Coordinate[] coords = entry.jtsCoordinates;
                int expectedSegments = coords.length - 1;
                if (segmentValues.length != expectedSegments) {
                    log.warning("segmentValues length ("
                            + segmentValues.length
                            + ") does not match segment count ("
                            + expectedSegments
                            + ") for entry " + entry.pathUuid
                            + " in updateEntry; values will be mismatched");
                }
                // Per-vertex averaging — mirrors createEntry() so updates
                // produce the same smooth gradients as initial creation.
                float[] vertexVals = new float[coords.length];
                for (int i = 0; i < coords.length; i++) {
                    if (i == 0) {
                        vertexVals[i] = segmentValues.length > 0
                                ? segmentValues[0] : 0.5f;
                    } else if (i == coords.length - 1) {
                        vertexVals[i] = segmentValues.length > 0
                                ? segmentValues[segmentValues.length - 1] : 0.5f;
                    } else {
                        float a = (i - 1) < segmentValues.length
                                ? segmentValues[i - 1] : 0.5f;
                        float b = i < segmentValues.length
                                ? segmentValues[i] : 0.5f;
                        vertexVals[i] = (a + b) / 2.0f;
                    }
                }
                for (int i = 0; i < coords.length; i++) {
                    if (i != 0) {
                        double[] segment = new double[4];
                        segment[0] = coords[i].x;
                        segment[1] = coords[i].y;
                        segment[2] = coords[i - 1].x;
                        segment[3] = coords[i - 1].y;
                        LineDrawable drawable = new LineDrawable(
                                segment, style);
                        drawable.setPriority(entry.positionIndex);

                        crLayer.addLineDrawableWithValues(drawable,
                                new float[]{vertexVals[i - 1], vertexVals[i]});
                        entry.drawables.add(drawable);
                    }
                }
                crLayer.update();
            }
        }

        // ── Upload color-ramp texture if stops provided ──
        if (colorRampStops != null) {
            ColorRampVectorLayer crLayer = (ColorRampVectorLayer)
                    getSharedLayer(entry.fragmentUuid);
            if (crLayer != null) {
                crLayer.setColorRampStops(colorRampStops);
            }
        }

        return result;
    }

    @Override
    public void remove(@NonNull String entryUuid) {
        entrySegmentValues.remove(entryUuid);
        super.remove(entryUuid);
    }

    /**
     * Returns the per-segment values for an entry, or null if none are stored.
     */
    @Nullable
    public float[] getSegmentValues(@NonNull String entryUuid) {
        return entrySegmentValues.get(entryUuid);
    }

    // ── Gesture listener factory ───────────────────────────────────────────

    @NonNull
    protected VectorLayer.GestureListener createGestureListener() {
        return (type, eventParams) -> {
            if (eventCallback == null) return;
            WritableMap payload = new WritableNativeMap();
            if (eventParams.hasKey("uuid")) {
                payload.putString("uuid", eventParams.getString("uuid"));
            }
            if (eventParams.hasKey("distance")) {
                payload.putDouble("distance",
                        eventParams.getDouble("distance"));
            }
            if (eventParams.hasKey("nearestPoint")) {
                payload.putArray("nearestPoint",
                        eventParams.getArray("nearestPoint"));
            }
            if (eventParams.hasKey("eventPosition")) {
                payload.putArray("eventPosition",
                        eventParams.getArray("eventPosition"));
            }
            payload.putString("type", type);
            payload.putInt("nativeNodeHandle", nativeNodeHandle);
            eventCallback.emit("onPathEvent", payload);
        };
    }

}
