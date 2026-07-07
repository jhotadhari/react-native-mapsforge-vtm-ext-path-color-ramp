package com.jhotadhari.reactnative.mapsforge.vtm.ext.pathcolorramp;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.oscim.backend.GL;
import org.oscim.core.Tile;
import org.oscim.layers.vector.geometries.Drawable;
import org.oscim.layers.vector.geometries.LineDrawable;
import org.oscim.layers.vector.geometries.Style;
import org.oscim.map.Map;
import org.oscim.renderer.bucket.LineBucket;
import org.oscim.renderer.bucket.LineTexBucket;
import org.oscim.theme.styles.LineStyle;
import org.oscim.utils.SpatialIndex;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.concurrent.ConcurrentHashMap;

import org.oscim.renderer.GLUtils;

import static org.oscim.backend.GLAdapter.gl;

/**
 * A {@link com.jhotadhari.reactnative.mapsforge.vtm.layer.VectorLayer} subclass
 * that supports per-segment data values for color-ramp rendering.
 *
 * <h3>How it works</h3>
 * <ol>
 *   <li>Callers add {@link LineDrawable}s via
 *       {@link #addLineDrawableWithValues(LineDrawable, float[])} instead of
 *       the normal {@link #add(Drawable)}.</li>
 *   <li>The per-segment {@code float[]} values (normalized 0–1) are stored in a
 *       {@link ConcurrentHashMap} keyed by the drawable.</li>
 *   <li>During {@link #draw(Task, int, Drawable, Style)}, when a drawable has
 *       associated values, the line is drawn via
 *       {@link #drawLineWithValues(Task, int, Geometry, Style, float[])} which
 *       passes values to the shadowed {@link LineBucket#addLine(float[], int[], int, boolean, float[])}
 *       overload.</li>
 *   <li>The color-ramp texture (stored as a static field on
 *       {@link LineBucket.Renderer#mColorRampTexID}) is bound by the shadowed
 *       renderer during the next frame.</li>
 * </ol>
 */
public class ColorRampVectorLayer extends com.jhotadhari.reactnative.mapsforge.vtm.layer.VectorLayer {

    /** Maps each LineDrawable to its per-segment normalized values (0–1). */
    private final java.util.Map<Drawable, float[]> drawableValues = new ConcurrentHashMap<>();

    /** The GL texture ID of the color ramp currently set on this layer. */
    private int mColorRampTexID = 0;

    /** True once the color-ramp texture has been uploaded to GL. */
    private boolean mColorRampReady = false;

    /** Pending pixel data for deferred GL upload (bridge thread → GL thread). */
    private ByteBuffer mPendingRampBuffer = null;
    private int mPendingRampWidth = 0;
    private volatile boolean mPendingRampUpload = false;
    private final Object mPendingLock = new Object();

    // ── Constructors ──────────────────────────────────────────────────────

    public ColorRampVectorLayer(@NonNull Map map) {
        super(map);
    }

    public ColorRampVectorLayer(@NonNull Map map, @NonNull String uuid,
                                boolean supportsGestures,
                                @Nullable GestureListener gestureListener,
                                float gestureScreenDistance) {
        super(map, uuid, supportsGestures, gestureListener, gestureScreenDistance);
    }

    // ── Public API ────────────────────────────────────────────────────────

    /**
     * Adds a {@link LineDrawable} with per-segment data values for color-ramp
     * rendering. Each value in {@code segmentValues} corresponds to one segment
     * of the line (length must equal the number of coordinates − 1).
     *
     * @param drawable      the line drawable to add
     * @param segmentValues per-segment normalized values (0–1); one per segment
     */
    public void addLineDrawableWithValues(@NonNull LineDrawable drawable,
                                          @NonNull float[] segmentValues) {
        drawableValues.put(drawable, segmentValues);
        add(drawable);
    }

    @Override
    public synchronized void remove(@NonNull Drawable drawable) {
        drawableValues.remove(drawable);
        super.remove(drawable);
    }

    @Override
    public synchronized void clearDrawables() {
        drawableValues.clear();
        super.clearDrawables();
    }

    // ── Color-ramp texture management ──────────────────────────────────────

    /**
     * Builds a 256×1 RGBA8 pixel array from an array of hex color stops
     * (e.g. {@code "#440154"}) and defers the GPU upload to the next
     * {@link #update()} call, which runs on the GL render thread.
     *
     * <p>OpenGL calls must happen on the GL thread. Since this method is
     * called from the React Native bridge thread (via the TurboModule),
     * we only build the pixel buffer here and set a flag. The actual
     * {@code glGenTextures} / {@code glTexImage2D} happens in
     * {@link #uploadPendingRamp()}, invoked from {@link #update()}.
     *
     * <p>Once uploaded, the texture ID is stored in this layer instance and
     * written to each {@link LineBucket} during
     * {@link #drawLineWithValues(Task, int, Geometry, Style, float[])}.
     *
     * @param colorRampStops array of hex color strings (at least 2)
     */
    public void setColorRampStops(@NonNull String[] colorRampStops) {
        if (colorRampStops.length < 2) {
            return;
        }

        // Build a 256×1 RGBA8 pixel array.
        int width = 256;
        ByteBuffer buffer = ByteBuffer.allocateDirect(width * 4);
        buffer.order(ByteOrder.nativeOrder());

        int numStops = colorRampStops.length;
        for (int x = 0; x < width; x++) {
            float t = (float) x / (width - 1);

            // Find the two stops that bracket t.
            int idx = (int) (t * (numStops - 1));
            if (idx >= numStops - 1) {
                idx = numStops - 2;
            }
            float localT = (t - (float) idx / (numStops - 1)) * (numStops - 1);
            localT = Math.max(0f, Math.min(1f, localT));

            int c1 = parseHexColor(colorRampStops[idx]);
            int c2 = parseHexColor(colorRampStops[idx + 1]);

            int r = lerp((c1 >> 16) & 0xFF, (c2 >> 16) & 0xFF, localT);
            int g = lerp((c1 >> 8) & 0xFF, (c2 >> 8) & 0xFF, localT);
            int b = lerp(c1 & 0xFF, c2 & 0xFF, localT);

            buffer.put((byte) r);
            buffer.put((byte) g);
            buffer.put((byte) b);
            buffer.put((byte) 0xFF);
        }
        buffer.flip();

        // Store for deferred upload on the GL thread (via LineBucket.Renderer).
        synchronized (org.oscim.renderer.bucket.LineBucket.Renderer.sPendingLock) {
            org.oscim.renderer.bucket.LineBucket.Renderer.sPendingRampBuffer = buffer;
            org.oscim.renderer.bucket.LineBucket.Renderer.sPendingRampWidth = width;
            org.oscim.renderer.bucket.LineBucket.Renderer.sPendingRampUpload = true;
        }
    }

    /**
     * Uploads the pending color-ramp pixel data to a GL texture.
     * Must be called from the GL render thread (via {@link #update()}).
     */
    private void uploadPendingRamp() {
        ByteBuffer buffer;
        int width;
        synchronized (mPendingLock) {
            if (!mPendingRampUpload || mPendingRampBuffer == null) {
                return;
            }
            buffer = mPendingRampBuffer;
            width = mPendingRampWidth;
            mPendingRampBuffer = null;
            mPendingRampUpload = false;
        }

        // Delete old texture if one exists.
        if (mColorRampTexID != 0) {
            GLUtils.glDeleteTextures(1, new int[]{mColorRampTexID});
        }

        // Create new texture on the GL thread.
        // Use IntBuffer version — some GL impls don't properly write to int[] overload.
        java.nio.IntBuffer texBuf = java.nio.ByteBuffer.allocateDirect(4)
                .order(java.nio.ByteOrder.nativeOrder())
                .asIntBuffer();
        android.opengl.GLES20.glGenTextures(1, texBuf);
        mColorRampTexID = texBuf.get(0);
        mColorRampReady = true;

        gl.bindTexture(GL.TEXTURE_2D, mColorRampTexID);
        gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR);
        gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
        gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_S, GL.CLAMP_TO_EDGE);
        gl.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_WRAP_T, GL.CLAMP_TO_EDGE);
        gl.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, width, 1, 0,
                GL.RGBA, GL.UNSIGNED_BYTE, buffer);
    }

    /**
     * Returns the current color-ramp texture ID, or 0 if not set.
     */
    public int getColorRampTexID() {
        return mColorRampTexID;
    }

    /**
     * Releases the color-ramp texture. Call when the layer is destroyed.
     * Must be called from the GL render thread.
     */
    public void releaseColorRampTexture() {
        synchronized (mPendingLock) {
            mPendingRampBuffer = null;
            mPendingRampUpload = false;
        }
        if (mColorRampTexID != 0) {
            android.opengl.GLES20.glDeleteTextures(1, new int[]{mColorRampTexID}, 0);
            mColorRampTexID = 0;
        }
    }

    // ── GL-thread upload hook ──────────────────────────────────────────────

    private static int updateCallCount = 0;
    @Override
    public void update() {
        // Upload pending color-ramp texture before the render pass.
        // This runs on the GL render thread (called from MapRenderer).
        uploadPendingRamp();
        if (updateCallCount < 3) {
            updateCallCount++;
        }
        super.update();
    }

    // ── Rendering override ─────────────────────────────────────────────────

    private static int drawCallCount = 0;

    @Override
    protected void draw(Task t, int level, Drawable d, Style style) {
        // Intercept LineDrawables that have per-segment values.
        if (d instanceof LineDrawable) {
            float[] values = drawableValues.get(d);
            if (values != null) {
                drawLineWithValues(t, level, d.getGeometry(), style, values);
                return;
            }
        }
        // Fall through to standard rendering.
        super.draw(t, level, d, style);
    }

    /**
     * Modified version of {@code org.oscim.layers.vector.VectorLayer#drawLine}
     * that passes per-segment values through to
     * {@link LineBucket#addLine(float[], int[], int, boolean, float[])}.
     */
    protected void drawLineWithValues(Task t, int level,
                                      org.locationtech.jts.geom.Geometry line,
                                      Style style,
                                      float[] values) {

        // ── Stippled / textured lines use LineTexBucket which lacks
        //     a_value / u_colorRamp support. Fall back to standard rendering.
        if (style.stipple != 0 || style.texture != null) {
            super.draw(t, level, new org.oscim.layers.vector.geometries.LineDrawable(
                    line, style), style);
            return;
        }

        LineBucket ll = t.buckets.getLineBucket(level);
        // Use the static color-ramp texture uploaded by the GL-thread Renderer.
        ll.mColorRampTexID = LineBucket.Renderer.sColorRampTexID;
        ll.mHasColorRamp = (LineBucket.Renderer.sColorRampTexID != 0)
                || LineBucket.Renderer.sPendingRampUpload;
        if (ll.line == null) {
            ll.line = LineStyle.builder()
                    .reset()
                    .blur(style.blur)
                    .cap(style.cap)
                    .color(style.strokeColor)
                    .fixed(style.fixed)
                    .heightOffset(style.heightOffset)
                    .level(0)
                    .randomOffset(style.randomOffset)
                    .stipple(style.stipple)
                    .stippleColor(style.stippleColor)
                    .stippleWidth(style.stippleWidth)
                    .strokeIncrease(style.strokeIncrease)
                    .strokeWidth(style.strokeWidth)
                    .texture(style.texture)
                    .transparent(style.transparent)
                    .build();
            ll.setDropDistance(style.dropDistance);
            if (ll instanceof LineTexBucket)
                ((LineTexBucket) ll).setTexRepeat(style.textureRepeat);
        }

        if (!style.fixed && style.strokeIncrease > 1)
            ll.scale = (float) Math.pow(style.strokeIncrease,
                    Math.max(t.position.getZoom() - 12, 0));

        for (int i = 0; i < line.getNumGeometries(); i++) {
            mConverter.transformLineString(mGeom.clear(),
                    (org.locationtech.jts.geom.LineString) line.getGeometryN(i));
            if (!mClipper.clip(mGeom))
                continue;

            // ── Use shadowed addLine with per-segment values ──
            ll.addLine(mGeom.points, mGeom.index, -1, false, values);
        }
    }

    // ── Internal helpers ───────────────────────────────────────────────────

    private static int lerp(int a, int b, float t) {
        return Math.round(a + (b - a) * t);
    }

    private static int parseHexColor(@NonNull String hex) {
        try {
            String h = hex;
            if (h.startsWith("#")) {
                h = h.substring(1);
            }
            if (h.length() == 3) {
                // Short form: #RGB → #RRGGBB
                int r = Integer.parseInt(h.substring(0, 1), 16);
                int g = Integer.parseInt(h.substring(1, 2), 16);
                int b = Integer.parseInt(h.substring(2, 3), 16);
                return (0xFF << 24) | (r * 0x11 << 16) | (g * 0x11 << 8) | (b * 0x11);
            }
            return (0xFF << 24) | Integer.parseInt(h, 16);
        } catch (NumberFormatException | StringIndexOutOfBoundsException e) {
            // Malformed hex from JS — fall back to opaque white.
            return 0xFFFFFFFF;
        }
    }
}
