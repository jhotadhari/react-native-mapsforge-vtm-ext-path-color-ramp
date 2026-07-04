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

                        float val = (i - 1) < segmentValues.length
                                ? segmentValues[i - 1] : 0.5f;
                        crLayer.addLineDrawableWithValues(drawable,
                                new float[]{val});
                        entry.drawables.add(drawable);
                    }
                }

                entrySegmentValues.put(entryUuid, segmentValues);
                crLayer.update();
            }
        }

        // ── Upload color-ramp texture if stops provided ──
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
        // ── Update color ramp stops if provided ──
        if (Utils.rMapHasKey(params, "colorRampStops")) {
            ReadableArray crArray = params.getArray("colorRampStops");
            if (crArray != null && crArray.size() >= 2) {
                String[] colorRampStops = new String[crArray.size()];
                for (int i = 0; i < crArray.size(); i++) {
                    colorRampStops[i] = crArray.getString(i);
                }
                ColorRampVectorLayer crLayer = (ColorRampVectorLayer)
                        getSharedLayer(entry.fragmentUuid);
                if (crLayer != null) {
                    crLayer.setColorRampStops(colorRampStops);
                }
            }
        }

        // ── Update segment values if provided ──
        if (Utils.rMapHasKey(params, "segmentValues")) {
            ReadableArray svArray = params.getArray("segmentValues");
            if (svArray != null && svArray.size() > 0) {
                float[] segmentValues = new float[svArray.size()];
                for (int i = 0; i < svArray.size(); i++) {
                    segmentValues[i] = (float) svArray.getDouble(i);
                }
                entrySegmentValues.put(entry.pathUuid, segmentValues);

                // Re-register drawables with new values.
                ColorRampVectorLayer crLayer = (ColorRampVectorLayer)
                        getSharedLayer(entry.fragmentUuid);
                if (crLayer != null && !entry.drawables.isEmpty()) {
                    for (LineDrawable d : entry.drawables) {
                        crLayer.remove(d);
                    }
                    entry.drawables.clear();

                    Style style = getStyleBuilder(
                            Utils.rMapHasKey(params, "style")
                                    ? params.getMap("style")
                                    : null).build();

                    Coordinate[] coords = entry.jtsCoordinates;
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

                            float val = (i - 1) < segmentValues.length
                                    ? segmentValues[i - 1] : 0.5f;
                            crLayer.addLineDrawableWithValues(drawable,
                                    new float[]{val});
                            entry.drawables.add(drawable);
                        }
                    }
                }
            }
        }

        // Delegate to parent for standard coordinate/style update.
        return super.updateEntry(entry, params, mapFragment, contentResolver);
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
    private VectorLayer.GestureListener createGestureListener() {
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
