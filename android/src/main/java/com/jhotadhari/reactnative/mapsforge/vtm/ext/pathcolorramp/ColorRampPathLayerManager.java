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

    // ── Constructor ────────────────────────────────────────────────────────

    protected ColorRampPathLayerManager(int nativeNodeHandle,
                                         @NonNull MapView mapView,
                                         @NonNull String name) {
        super(nativeNodeHandle, mapView, name);
    }

    // ── Style default override ────────────────────────────────────────────

    /**
     * Overrides the parent's default strokeColor from red ({@code #ff0000})
     * to white ({@code #ffffff}) so the colour-ramp shader's
     * {@code u_color * texture2D(...)} multiplication passes the ramp
     * colour through unchanged.
     */
    @NonNull
    @Override
    protected Style.Builder getStyleBuilder(@Nullable ReadableMap styleMap) {
        if (styleMap != null && styleMap.hasKey("strokeColor")) {
            return super.getStyleBuilder(styleMap);
        }
        WritableMap merged = new WritableNativeMap();
        if (styleMap != null) {
            merged.merge(styleMap);
        }
        merged.putString("strokeColor", "#ffffff");
        return super.getStyleBuilder(merged);
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

        // ── Parse vertex values (per-vertex mode, no blend zones) ──
        float[] vertexValues = null;
        if (Utils.rMapHasKey(params, "vertexValues")) {
            ReadableArray vvArray = params.getArray("vertexValues");
            if (vvArray != null && vvArray.size() > 0) {
                vertexValues = new float[vvArray.size()];
                for (int i = 0; i < vvArray.size(); i++) {
                    vertexValues[i] = (float) vvArray.getDouble(i);
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
        //     re-register drawables with values ────────────────────────
        if ((segmentValues != null && segmentValues.length > 0)
                || (vertexValues != null && vertexValues.length > 0)) {
            PathEntry entry = result.entry;
            ColorRampVectorLayer crLayer = (ColorRampVectorLayer)
                    getSharedLayer(entry.fragmentUuid);

            if (crLayer != null && !entry.drawables.isEmpty()) {
                // Remove plain drawables, re-add with values.
                for (LineDrawable d : entry.drawables) {
                    crLayer.remove(d);
                    drawableToEntry.remove(d);
                }
                entry.drawables.clear();

                Style style = getStyleBuilder(
                        Utils.rMapHasKey(params, "paint")
                                ? params.getMap("paint")
                                : null).build();

                Coordinate[] coords = entry.jtsCoordinates;
                int expectedSegments = coords.length - 1;
                if (segmentValues != null
                        && segmentValues.length != expectedSegments) {
                    log.warning("segmentValues length ("
                            + segmentValues.length
                            + ") does not match segment count ("
                            + expectedSegments
                            + ") for entry " + entryUuid
                            + "; values will be mismatched");
                }
                rebuildDrawablesWithValues(crLayer, entry, coords,
                        segmentValues, vertexValues, params, style);
            }
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

        // ── Parse vertex values (per-vertex mode, no blend zones) ──
        float[] vertexValues = null;
        if (Utils.rMapHasKey(params, "vertexValues")) {
            ReadableArray vvArray = params.getArray("vertexValues");
            if (vvArray != null && vvArray.size() > 0) {
                vertexValues = new float[vvArray.size()];
                for (int i = 0; i < vvArray.size(); i++) {
                    vertexValues[i] = (float) vvArray.getDouble(i);
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
        //     colour-ramp-valued ones if segment or vertex values present ──
        if ((segmentValues != null && segmentValues.length > 0)
                || (vertexValues != null && vertexValues.length > 0)) {
            ColorRampVectorLayer crLayer = (ColorRampVectorLayer)
                    getSharedLayer(entry.fragmentUuid);
            if (crLayer != null && !entry.drawables.isEmpty()) {
                // Remove parent's plain drawables.
                for (LineDrawable d : entry.drawables) {
                    crLayer.remove(d);
                    drawableToEntry.remove(d);
                }
                entry.drawables.clear();

                Style style = getStyleBuilder(
                        Utils.rMapHasKey(params, "paint")
                                ? params.getMap("paint")
                                : null).build();

                Coordinate[] coords = entry.jtsCoordinates;
                int expectedSegments = coords.length - 1;
                if (segmentValues != null
                        && segmentValues.length != expectedSegments) {
                    log.warning("segmentValues length ("
                            + segmentValues.length
                            + ") does not match segment count ("
                            + expectedSegments
                            + ") for entry " + entry.pathUuid
                            + " in updateEntry; values will be mismatched");
                }
                rebuildDrawablesWithValues(crLayer, entry, coords,
                        segmentValues, vertexValues, params, style);
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
        super.remove(entryUuid);
    }

    // ── Shared drawable-rebuild helper ────────────────────────────────────

    /**
     * Rebuilds colour-ramp drawables for an entry, replacing any plain
     * parent-created drawables with value-bearing sub-segment drawables.
     * Shared by {@link #createEntry} and {@link #updateEntry}.
     */
    private void rebuildDrawablesWithValues(
            @NonNull ColorRampVectorLayer crLayer,
            @NonNull PathEntry entry,
            @NonNull Coordinate[] coords,
            @Nullable float[] segmentValues,
            @Nullable float[] vertexValues,
            @NonNull ReadableMap params,
            @NonNull Style style) {

        float blendRatio = 0.15f;
        if (Utils.rMapHasKey(params, "blendRatio")) {
            blendRatio = (float) params.getDouble("blendRatio");
            blendRatio = Math.max(0.0f, Math.min(0.45f, blendRatio));
        }

        // Vertex mode: per-vertex values, full-segment gradients,
        // no blend zones.
        if (vertexValues != null && vertexValues.length > 0) {
            if (vertexValues.length != coords.length) {
                log.warning("vertexValues length (" + vertexValues.length
                        + ") does not match vertex count (" + coords.length
                        + "); skipping");
            } else {
                addVertexGradientDrawables(crLayer, entry, coords,
                        vertexValues, style);
                crLayer.update();
                return;
            }
        }

        // Compute per-vertex values.
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

        for (int i = 1; i < coords.length; i++) {
            int segIdx = i - 1;
            float segVal = segIdx < segmentValues.length
                    ? segmentValues[segIdx] : 0.5f;
            float startVal = vertexVals[i - 1];
            float endVal = vertexVals[i];
            addSegmentDrawables(crLayer, entry, style,
                    coords[i - 1], coords[i],
                    startVal, segVal, endVal, blendRatio);
        }

        crLayer.update();
    }

    // ── Segment subdivision for spline-like blending ───────────────────────

    /**
     * Creates one or more {@link LineDrawable}s for a single path segment,
     * subdividing into entry-blend / pure / exit-blend zones so the GPU
     * linearly interpolates across short blend zones while the middle of
     * the segment stays at its true colour.
     *
     * <p><b>Value ordering:</b> {@link LineDrawable} stores coordinates as
     * {@code {end, start}} (reversed).  After JTS transformation the geometry
     * buffer has the end point first and start point last.  In
     * {@code addLineWithValues}, {@code values[0]} is used at the first
     * (end) point and {@code values[last]} at the last (start) point.
     * The effective gradient along the path (start → end) is therefore
     * {@code values[last] → values[0]}.  We pass values in reverse order
     * so the path-travel direction matches the user's intent.
     *
     * <pre>
     *   c0  ──[entry: startVal→segVal]──▶ mid1
     *       ──[pure:   segVal→segVal  ]──▶ mid2
     *       ──[exit:   segVal→endVal  ]──▶ c1
     * </pre>
     *
     * @param crLayer    target colour-ramp layer
     * @param entry      path entry (for priority)
     * @param style      line style
     * @param c0         segment start coordinate
     * @param c1         segment end coordinate
     * @param startVal   value at c0 (vertex average with previous segment)
     * @param segVal     true value of this segment
     * @param endVal     value at c1 (vertex average with next segment)
     * @param blendRatio fraction of segment length used for each blend zone
     */
    private void addSegmentDrawables(
            @NonNull ColorRampVectorLayer crLayer,
            @NonNull PathEntry entry,
            @NonNull Style style,
            @NonNull org.locationtech.jts.geom.Coordinate c0,
            @NonNull org.locationtech.jts.geom.Coordinate c1,
            float startVal, float segVal, float endVal,
            float blendRatio) {

        if (blendRatio < 0.01f) {
            // No blending — single drawable with vertex-averaged boundaries.
            // Values reversed: effective gradient (start→end) = endVal→startVal.
            double[] seg = new double[]{c1.x, c1.y, c0.x, c0.y};
            LineDrawable d = new LineDrawable(seg, style);
            d.setPriority(entry.positionIndex * 2);
            crLayer.addLineDrawableWithValues(d,
                    new float[]{endVal, startVal});
            entry.drawables.add(d);
            return;
        }

        double t = blendRatio;
        double mx1 = c0.x + (c1.x - c0.x) * t;
        double my1 = c0.y + (c1.y - c0.y) * t;
        double mx2 = c0.x + (c1.x - c0.x) * (1.0 - t);
        double my2 = c0.y + (c1.y - c0.y) * (1.0 - t);

        // Pure (long) zone gets higher priority so it renders above the
        // shorter blend zones.
        int basePrio = entry.positionIndex * 2;
        int purePrio = basePrio + 1;

        // Entry blend zone: c0 → mid1.
        // Effective gradient (start→end): startVal → segVal.
        double[] entrySeg = new double[]{mx1, my1, c0.x, c0.y};
        LineDrawable entryD = new LineDrawable(entrySeg, style);
        entryD.setPriority(basePrio);
        crLayer.addLineDrawableWithValues(entryD,
                new float[]{segVal, startVal});
        entry.drawables.add(entryD);

        // Pure zone: mid1 → mid2.
        // Effective gradient (start→end): segVal → segVal.
        double[] pureSeg = new double[]{mx2, my2, mx1, my1};
        LineDrawable pureD = new LineDrawable(pureSeg, style);
        pureD.setPriority(purePrio);
        crLayer.addLineDrawableWithValues(pureD,
                new float[]{segVal, segVal});
        entry.drawables.add(pureD);

        // Exit blend zone: mid2 → c1.
        // Effective gradient (start→end): segVal → endVal.
        double[] exitSeg = new double[]{c1.x, c1.y, mx2, my2};
        LineDrawable exitD = new LineDrawable(exitSeg, style);
        exitD.setPriority(basePrio);
        crLayer.addLineDrawableWithValues(exitD,
                new float[]{endVal, segVal});
        entry.drawables.add(exitD);
    }

    // ── Vertex-mode drawable creation (no blend zones) ─────────────────────

    /**
     * Creates one {@link LineDrawable} per segment with a full gradient from
     * the start vertex value to the end vertex value.  No blend zones are
     * needed because each interior vertex is shared by adjacent segments,
     * so the colour transitions are naturally seamless.
     *
     * <p>Use this for per-vertex data (elevation, speed, temperature)
     * where the value belongs to a specific point, not a stretch of path.
     *
     * <p><b>Value ordering:</b> Same reversal as
     * {@link #addSegmentDrawables} — coordinates are stored
     * {@code {end, start}} and values are passed in reverse so the
     * effective gradient follows the path direction (start → end).
     *
     * @param crLayer      target colour-ramp layer
     * @param entry        path entry (for priority)
     * @param coords       all coordinates of the path
     * @param vertexValues per-vertex values (length = coords.length)
     * @param style        line style
     */
    private void addVertexGradientDrawables(
            @NonNull ColorRampVectorLayer crLayer,
            @NonNull PathEntry entry,
            @NonNull Coordinate[] coords,
            @NonNull float[] vertexValues,
            @NonNull Style style) {

        int basePrio = entry.positionIndex * 2;

        for (int i = 1; i < coords.length; i++) {
            float vStart = (i - 1) < vertexValues.length
                    ? vertexValues[i - 1] : 0.5f;
            float vEnd = i < vertexValues.length
                    ? vertexValues[i] : 0.5f;

            // Coordinates reversed: {end, start}.
            // Values reversed: {endVal, startVal} so effective
            // gradient (start→end) = vStart → vEnd.
            double[] seg = new double[]{
                    coords[i].x, coords[i].y,
                    coords[i - 1].x, coords[i - 1].y};
            LineDrawable d = new LineDrawable(seg, style);
            d.setPriority(basePrio);
            crLayer.addLineDrawableWithValues(d,
                    new float[]{vEnd, vStart});
            entry.drawables.add(d);
        }
    }

    // ── Gesture listener factory ───────────────────────────────────────────

    @NonNull
    protected VectorLayer.GestureListener createGestureListener() {
        return super.createGestureListener();
    }

}
