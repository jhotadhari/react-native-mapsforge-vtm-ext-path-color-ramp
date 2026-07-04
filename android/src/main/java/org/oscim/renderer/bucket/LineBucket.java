/*
 * Copyright 2013 Hannes Janetzek
 * Copyright 2016-2021 devemux86
 * Copyright 2026 react-native-mapsforge-vtm contributors
 *
 * This file is part of the OpenScienceMap project (http://www.opensciencemap.org).
 *
 * This program is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Lesser General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 *
 * -----------------------------------------------------------------------------------
 * SHADOWED from vtm v0.28.0 (mapsforge/vtm) — modified for per-vertex value support.
 *
 * Changes from upstream:
 *   - Vertex format extended from 4 → 5 shorts: (x, y, dx, dy, value).
 *   - New addVertex overload accepting a per-vertex float value.
 *   - addLine() variants accept optional float[] segmentValues.
 *   - Shader inner class: +uColorRamp (sampler2D), +aValue (float attribute).
 *   - Renderer inner class: loads "line_aa_value" / "line_aa_proj_value" shaders,
 *     binds color-ramp texture to unit 1, sets aValue attrib pointer
 *     (stride=10 bytes, offset=8 bytes).
 *
 * The 5th short is a normalized value (0–1) quantized to signed 16-bit:
 *   short sv = (short)(value * 32767);
 * The fragment shader uses this as a texture coordinate into u_colorRamp.
 */
package org.oscim.renderer.bucket;

import org.oscim.backend.GL;
import org.oscim.backend.GLAdapter;
import org.oscim.backend.canvas.Color;
import org.oscim.backend.canvas.Paint.Cap;
import org.oscim.core.GeometryBuffer;
import org.oscim.core.MercatorProjection;
import org.oscim.renderer.GLShader;
import org.oscim.renderer.GLState;
import org.oscim.renderer.GLUtils;
import org.oscim.renderer.GLViewport;
import org.oscim.theme.styles.LineStyle;

import java.util.logging.Logger;

import static org.oscim.backend.GLAdapter.gl;
import static org.oscim.renderer.MapRenderer.COORD_SCALE;

/**
 * Note:
 * Coordinates must be in range +/- (Short.MAX_VALUE / COORD_SCALE) if using GL.SHORT.
 * The maximum resolution for coordinates is 0.25 as points will be converted
 * to fixed point values.
 */
public class LineBucket extends RenderBucket {
    private static final Logger log = Logger.getLogger(LineBucket.class.getName());

    /**
     * scale factor mapping extrusion vector to short values
     */
    public static final float DIR_SCALE = 2048;

    /**
     * maximal resolution
     */
    public static final float MIN_DIST = 1 / 8f;

    /**
     * not quite right.. need to go back so that additional
     * bevel vertices are at least MIN_DIST apart
     */
    private static final float MIN_BEVEL = MIN_DIST * 4;

    /**
     * mask for packing last two bits of extrusion vector with texture
     * coordinates
     */
    private static final int DIR_MASK = 0xFFFFFFFC;

    /* lines referenced by this outline layer */
    public LineBucket outlines;
    public LineStyle line;
    public float scale = 1;

    public boolean roundCap;
    private float mMinDist = MIN_DIST;
    private float mMinBevel = MIN_BEVEL;

    public float heightOffset;

    // ── Per-instance color-ramp texture ID ──
    // 0 means no color ramp (use original shaders).
    // Non-zero: bind this 2D RGBA8 texture to unit 1 for the value shader.
    public int mColorRampTexID;

    private int tmin = Integer.MIN_VALUE, tmax = Integer.MAX_VALUE;

    public LineBucket(int layer) {
        super(RenderBucket.LINE, false, false);
        this.level = layer;
    }

    LineBucket(byte type, boolean indexed, boolean quads) {
        super(type, indexed, quads);
    }

    public void addOutline(LineBucket link) {
        for (LineBucket l = outlines; l != null; l = l.outlines)
            if (link == l)
                return;

        link.outlines = outlines;
        outlines = link;
    }

    public void setExtents(int min, int max) {
        tmin = min;
        tmax = max;
    }

    /**
     * For point reduction by minimal distance. Default is 1/8.
     */
    public void setDropDistance(float minDist) {
        mMinDist = minDist;
    }

    /**
     * Default is MIN_DIST * 4 = 1/8 * 4.
     */
    public void setBevelDistance(float minBevel) {
        mMinBevel = minBevel;
    }

    public void addLine(GeometryBuffer geom) {
        if (geom.isPoly())
            addLine(geom.points, geom.index, -1, true, null);
        else if (geom.isLine())
            addLine(geom.points, geom.index, -1, false, null);
        else
            log.fine("geometry must be LINE or POLYGON");
    }

    public void addLine(float[] points, int numPoints, boolean closed) {
        if (numPoints >= 4)
            addLine(points, null, numPoints, closed, null);
    }

    // ── New: segment-values overloads ─────────────────────────────────────

    /**
     * Like {@link #addLine(float[], int[], int, boolean)} but with per-vertex
     * data values for color-ramp rendering.
     *
     * @param values per-segment normalized values (length = numPoints/2 - 1
     *               for open lines, numPoints/2 for closed lines).
     *               May be null to disable value output.
     */
    public void addLine(float[] points, int[] index, int numPoints,
                        boolean closed, float[] values) {
        addLineImpl(points, index, numPoints, closed, values);
    }

    // ── Internal addLine (private → renamed, add values param) ────────────

    void addLine(float[] points, int[] index, int numPoints, boolean closed) {
        addLineImpl(points, index, numPoints, closed, null);
    }

    private void addLineImpl(float[] points, int[] index, int numPoints,
                             boolean closed, float[] values) {

        boolean rounded = false;
        boolean squared = false;

        if (line.cap == Cap.ROUND)
            rounded = true;
        else if (line.cap == Cap.SQUARE)
            squared = true;

        /* Note: just a hack to save some vertices, when there are
         * more than 200 lines per type. FIXME make optional! */
        if (rounded && index != null) {
            int cnt = 0;
            for (int i = 0, n = index.length; i < n; i++, cnt++) {
                if (index[i] < 0)
                    break;
                if (cnt > 400) {
                    rounded = false;
                    break;
                }
            }
        }
        roundCap = rounded;

        int n;
        int length = 0;

        if (index == null) {
            n = 1;
            if (numPoints > 0) {
                length = numPoints;
            } else {
                length = points.length;
            }
        } else {
            n = index.length;
        }

        for (int i = 0, pos = 0; i < n; i++) {
            if (index != null)
                length = index[i];

            /* check end-marker in indices */
            if (length < 0)
                break;

            int ipos = pos;
            pos += length;

            /* need at least two points */
            if (length < 4)
                continue;

            /* start and endpoint are equal */
            if (length == 4 &&
                    points[ipos] == points[ipos + 2] &&
                    points[ipos + 1] == points[ipos + 3])
                continue;

            /* avoid simple 180 degree angles */
            if (length == 6 &&
                    points[ipos] == points[ipos + 4] &&
                    points[ipos + 1] == points[ipos + 5])
                length -= 2;

            // Compute value offset into the values array.
            // ipos is in float coordinates (2 floats per point).
            // The first segment (ipos/2) corresponds to values[0].
            int valueOffset = ipos / 2;

            addLineWithValues(vertexItems, points, ipos, length,
                    rounded, squared, closed, values, valueOffset);

        }
    }

    // ── Vertex helpers ────────────────────────────────────────────────────

    /**
     * Original addVertex — used internally when no value data is available.
     * Delegates to the new overload with value = 0.5f (mid-ramp).
     */
    private void addVertex(VertexData vi,
                           float x, float y,
                           float vNextX, float vNextY,
                           float vPrevX, float vPrevY) {
        addVertex(vi, x, y, vNextX, vNextY, vPrevX, vPrevY, 0.5f);
    }

    /**
     * Extended addVertex with a per-vertex data value.
     *
     * @param vi    vertex data target (5 shorts per vertex: x, y, dx, dy, val)
     * @param value normalized value 0–1 for the color-ramp lookup
     */
    private void addVertex(VertexData vi,
                           float x, float y,
                           float vNextX, float vNextY,
                           float vPrevX, float vPrevY,
                           float value) {

        float ux = vNextX + vPrevX;
        float uy = vNextY + vPrevY;

        /* vPrev times perpendicular of sum(vNext, vPrev) */
        double a = uy * vPrevX - ux * vPrevY;

        if (a < 0.01 && a > -0.01) {
            ux = -vPrevY;
            uy = vPrevX;
        } else {
            ux /= a;
            uy /= a;
        }

        short ox = (short) (x * COORD_SCALE);
        short oy = (short) (y * COORD_SCALE);

        int ddx = (int) (ux * DIR_SCALE);
        int ddy = (int) (uy * DIR_SCALE);

        // Quantize the normalized value to a signed 16-bit short.
        short sv = (short) (value * 32767);

        // Vertex 1: positive extrusion side
        vi.add(ox, oy,
                (short) (0 | ddx & DIR_MASK),
                (short) (1 | ddy & DIR_MASK));
        vi.add(sv);

        // Vertex 2: negative extrusion side
        vi.add(ox, oy,
                (short) (2 | -ddx & DIR_MASK),
                (short) (1 | -ddy & DIR_MASK));
        vi.add(sv);
    }

    // ── Core line-building with value support ─────────────────────────────

    private void addLineWithValues(VertexData vertices, float[] points,
                                   int start, int length,
                                   boolean rounded, boolean squared,
                                   boolean closed,
                                   float[] values, int valueOffset) {

        float ux, uy;
        float vPrevX, vPrevY;
        float vNextX, vNextY;
        float curX, curY;
        float nextX, nextY;
        double a;

        /* amount of vertices used
         * + 2 for drawing triangle-strip
         * + 4 for round caps
         * + 2 for closing polygons */
        numVertices += length + (rounded ? 6 : 2) + (closed ? 2 : 0);

        int ipos = start;

        curX = points[ipos++];
        curY = points[ipos++];
        nextX = points[ipos++];
        nextY = points[ipos++];

        /* Unit vector to next node */
        vPrevX = nextX - curX;
        vPrevY = nextY - curY;
        a = (float) Math.sqrt(vPrevX * vPrevX + vPrevY * vPrevY);
        vPrevX /= a;
        vPrevY /= a;

        /* perpendicular on the first segment */
        ux = -vPrevY;
        uy = vPrevX;

        int ddx, ddy;

        /* vertex point coordinate */
        short ox = (short) (curX * COORD_SCALE);
        short oy = (short) (curY * COORD_SCALE);

        short dx, dy;

        /* when the endpoint is outside the tile region omit round caps. */
        boolean outside = (curX < tmin || curX > tmax || curY < tmin || curY > tmax);

        // First-segment value (or 0.5f if no values array).
        float startVal = (values != null && valueOffset < values.length)
                ? values[valueOffset] : 0.5f;
        short svStart = (short) (startVal * 32767);

        if (rounded && !outside) {
            ddx = (int) ((ux - vPrevX) * DIR_SCALE);
            ddy = (int) ((uy - vPrevY) * DIR_SCALE);
            dx = (short) (0 | ddx & DIR_MASK);
            dy = (short) (2 | ddy & DIR_MASK);

            vertices.add(ox, oy, (short) dx, (short) dy);
            vertices.add(svStart);
            vertices.add(ox, oy, (short) dx, (short) dy);
            vertices.add(svStart);

            ddx = (int) (-(ux + vPrevX) * DIR_SCALE);
            ddy = (int) (-(uy + vPrevY) * DIR_SCALE);

            vertices.add(ox, oy,
                    (short) (2 | ddx & DIR_MASK),
                    (short) (2 | ddy & DIR_MASK));
            vertices.add(svStart);

            /* Start of line */
            ddx = (int) (ux * DIR_SCALE);
            ddy = (int) (uy * DIR_SCALE);

            vertices.add(ox, oy,
                    (short) (0 | ddx & DIR_MASK),
                    (short) (1 | ddy & DIR_MASK));
            vertices.add(svStart);

            vertices.add(ox, oy,
                    (short) (2 | -ddx & DIR_MASK),
                    (short) (1 | -ddy & DIR_MASK));
            vertices.add(svStart);
        } else {
            /* outside means line is probably clipped
             * TODO should align ending with tile boundary
             * for now, just extend the line a little */
            float tx = vPrevX;
            float ty = vPrevY;

            if (!rounded && !squared) {
                tx = 0;
                ty = 0;
            } else if (rounded) {
                tx *= 0.5;
                ty *= 0.5;
            }

            if (rounded)
                numVertices -= 2;

            /* add first vertex twice */
            ddx = (int) ((ux - tx) * DIR_SCALE);
            ddy = (int) ((uy - ty) * DIR_SCALE);
            dx = (short) (0 | ddx & DIR_MASK);
            dy = (short) (1 | ddy & DIR_MASK);

            vertices.add(ox, oy, (short) dx, (short) dy);
            vertices.add(svStart);
            vertices.add(ox, oy, (short) dx, (short) dy);
            vertices.add(svStart);

            ddx = (int) (-(ux + tx) * DIR_SCALE);
            ddy = (int) (-(uy + ty) * DIR_SCALE);

            vertices.add(ox, oy,
                    (short) (2 | ddx & DIR_MASK),
                    (short) (1 | ddy & DIR_MASK));
            vertices.add(svStart);
        }

        curX = nextX;
        curY = nextY;

        /* Unit vector pointing back to previous node */
        vPrevX *= -1;
        vPrevY *= -1;

        int segmentIndex = 0;

        for (int end = start + length; ; ) {

            if (ipos < end) {
                nextX = points[ipos++];
                nextY = points[ipos++];
                segmentIndex++;
            } else if (closed && ipos < end + 2) {
                /* add startpoint == endpoint */
                nextX = points[start];
                nextY = points[start + 1];
                ipos += 2;
                segmentIndex++;
            } else
                break;

            /* unit vector pointing forward to next node */
            vNextX = nextX - curX;
            vNextY = nextY - curY;
            a = Math.sqrt(vNextX * vNextX + vNextY * vNextY);
            /* skip two vertex segments except end */
            if (a < mMinDist && ipos < end) {
                numVertices -= 2;
                continue;
            }
            vNextX /= a;
            vNextY /= a;

            double dotp = (vNextX * vPrevX + vNextY * vPrevY);

            // Value for this point: the incoming segment's value.
            int curValIdx = valueOffset + segmentIndex - 1;
            float curVal = (values != null && curValIdx >= 0 && curValIdx < values.length)
                    ? values[curValIdx] : 0.5f;

            if (dotp > 0.65) {
                /* add bevel join to avoid miter going to infinity */
                numVertices += 2;

                float px, py;
                if (dotp > 0.999) {
                    /* 360 degree angle, set points aside */
                    ux = vPrevX + vNextX;
                    uy = vPrevY + vNextY;
                    a = vNextX * uy - vNextY * ux;
                    if (a < 0.1 && a > -0.1) {
                        /* Almost straight */
                        ux = -vNextY;
                        uy = vNextX;
                    } else {
                        ux /= a;
                        uy /= a;
                    }
                    px = curX - ux * mMinBevel;
                    py = curY - uy * mMinBevel;
                    curX = curX + ux * mMinBevel;
                    curY = curY + uy * mMinBevel;
                } else {
                    /* go back by min dist */
                    px = curX + vPrevX * mMinBevel;
                    py = curY + vPrevY * mMinBevel;
                    /* go forward by min dist */
                    curX = curX + vNextX * mMinBevel;
                    curY = curY + vNextY * mMinBevel;
                }

                /* unit vector pointing forward to next node */
                vNextX = curX - px;
                vNextY = curY - py;
                a = Math.sqrt(vNextX * vNextX + vNextY * vNextY);
                vNextX /= a;
                vNextY /= a;

                addVertex(vertices, px, py, vPrevX, vPrevY, vNextX, vNextY, curVal);

                /* flip unit vector to point back */
                vPrevX = -vNextX;
                vPrevY = -vNextY;

                /* unit vector pointing forward to next node */
                vNextX = nextX - curX;
                vNextY = nextY - curY;
                a = Math.sqrt(vNextX * vNextX + vNextY * vNextY);
                vNextX /= a;
                vNextY /= a;
            }

            addVertex(vertices, curX, curY, vPrevX, vPrevY, vNextX, vNextY, curVal);

            curX = nextX;
            curY = nextY;

            /* flip vector to point back */
            vPrevX = -vNextX;
            vPrevY = -vNextY;
        }

        ux = vPrevY;
        uy = -vPrevX;

        outside = (curX < tmin || curX > tmax || curY < tmin || curY > tmax);

        ox = (short) (curX * COORD_SCALE);
        oy = (short) (curY * COORD_SCALE);

        // Last-segment value.
        int lastValIdx = valueOffset + segmentIndex - 1;
        float lastVal = (values != null && lastValIdx >= 0 && lastValIdx < values.length)
                ? values[lastValIdx] : 0.5f;
        short svLast = (short) (lastVal * 32767);

        if (rounded && !outside) {
            ddx = (int) (ux * DIR_SCALE);
            ddy = (int) (uy * DIR_SCALE);

            vertices.add(ox, oy,
                    (short) (0 | ddx & DIR_MASK),
                    (short) (1 | ddy & DIR_MASK));
            vertices.add(svLast);

            vertices.add(ox, oy,
                    (short) (2 | -ddx & DIR_MASK),
                    (short) (1 | -ddy & DIR_MASK));
            vertices.add(svLast);

            /* For rounded line edges */
            ddx = (int) ((ux - vPrevX) * DIR_SCALE);
            ddy = (int) ((uy - vPrevY) * DIR_SCALE);

            vertices.add(ox, oy,
                    (short) (0 | ddx & DIR_MASK),
                    (short) (0 | ddy & DIR_MASK));
            vertices.add(svLast);

            /* last vertex */
            ddx = (int) (-(ux + vPrevX) * DIR_SCALE);
            ddy = (int) (-(uy + vPrevY) * DIR_SCALE);
            dx = (short) (2 | ddx & DIR_MASK);
            dy = (short) (0 | ddy & DIR_MASK);

        } else {
            if (!rounded && !squared) {
                vPrevX = 0;
                vPrevY = 0;
            } else if (rounded) {
                vPrevX *= 0.5;
                vPrevY *= 0.5;
            }

            if (rounded)
                numVertices -= 2;

            ddx = (int) ((ux - vPrevX) * DIR_SCALE);
            ddy = (int) ((uy - vPrevY) * DIR_SCALE);

            vertices.add(ox, oy,
                    (short) (0 | ddx & DIR_MASK),
                    (short) (1 | ddy & DIR_MASK));
            vertices.add(svLast);

            /* last vertex */
            ddx = (int) (-(ux + vPrevX) * DIR_SCALE);
            ddy = (int) (-(uy + vPrevY) * DIR_SCALE);
            dx = (short) (2 | ddx & DIR_MASK);
            dy = (short) (1 | ddy & DIR_MASK);
        }

        /* add last vertex twice */
        vertices.add(ox, oy, (short) dx, (short) dy);
        vertices.add(svLast);
        vertices.add(ox, oy, (short) dx, (short) dy);
        vertices.add(svLast);
    }

    // ── Shader ─────────────────────────────────────────────────────────────

    static class Shader extends GLShader {
        int uMVP, uFade, uWidth, uColor, uMode, uHeight, aPos;
        // ── Color-ramp additions ──
        int uColorRamp, aValue;

        Shader(String shaderFile) {
            if (!create(shaderFile))
                return;
            uMVP = getUniform("u_mvp");
            uFade = getUniform("u_fade");
            uWidth = getUniform("u_width");
            uColor = getUniform("u_color");
            uMode = getUniform("u_mode");
            uHeight = getUniform("u_height");
            aPos = getAttrib("a_pos");
            // Color-ramp uniform and attribute
            uColorRamp = getUniform("u_colorRamp");
            aValue = getAttrib("a_value");
        }

        @Override
        public boolean useProgram() {
            if (super.useProgram()) {
                if (aValue >= 0) {
                    GLState.enableVertexArrays(aPos, aValue, GLState.DISABLED);
                } else {
                    GLState.enableVertexArrays(aPos, GLState.DISABLED);
                }
                return true;
            }
            return false;
        }
    }

    // ── Renderer ───────────────────────────────────────────────────────────

    public static final class Renderer {
        /* TODO:
         * http://http.developer.nvidia.com/GPUGems2/gpugems2_chapter22.html */

        /* factor to normalize extrusion vector and scale to coord scale */
        private static final float COORD_SCALE_BY_DIR_SCALE =
                COORD_SCALE / LineBucket.DIR_SCALE;

        private static final int CAP_THIN = 0;
        private static final int CAP_BUTT = 1;
        private static final int CAP_ROUND = 2;

        private static final int SHADER_FLAT = 1;
        private static final int SHADER_PROJ = 0;

        public static int mTexID;
        // ── Color-ramp state ──
        // Per-instance texture IDs are now stored on LineBucket.mColorRampTexID.
        // The static field is retained for the default white texture only.
        // Default 1×1 white texture bound when no color ramp is set,
        // so the value shader's u_colorRamp sample returns white (1,1,1,1)
        // and gl_FragColor depends solely on u_color (matching original behavior).
        private static int mDefaultRampTexID;
        // Two shader sets: original (no value) + color-ramp (with a_value / u_colorRamp).
        private static Shader[] valueShaders = {null, null};
        private static Shader[] originalShaders = {null, null};

        static boolean init() {

            // ── Load original shaders (still needed for non-color-ramp lines) ──
            originalShaders[0] = new Shader("line_aa_proj");
            originalShaders[1] = new Shader("line_aa");

            // ── Load custom color-ramp shaders ──
            valueShaders[0] = new Shader("line_aa_proj_value");
            valueShaders[1] = new Shader("line_aa_value");

            // ── Default 1×1 white ramp texture ──
            byte[] whitePixel = {(byte) 0xFF, (byte) 0xFF, (byte) 0xFF, (byte) 0xFF};
            mDefaultRampTexID = GLUtils.loadTexture(whitePixel, 1, 1, GL.RGBA,
                    GL.NEAREST, GL.NEAREST,
                    GL.CLAMP_TO_EDGE,
                    GL.CLAMP_TO_EDGE);

            /* create lookup table as texture for 'length(0..1,0..1)'
             * using mirrored wrap mode for 'length(-1..1,-1..1)' */
            byte[] pixel = new byte[128 * 128];

            for (int x = 0; x < 128; x++) {
                float xx = x * x;
                for (int y = 0; y < 128; y++) {
                    float yy = y * y;
                    int color = (int) (Math.sqrt(xx + yy) * 2);
                    if (color > 255)
                        color = 255;
                    pixel[x + y * 128] = (byte) color;
                }
            }

            mTexID = GLUtils.loadTexture(pixel, 128, 128, GL.ALPHA,
                    GL.NEAREST, GL.NEAREST,
                    GL.MIRRORED_REPEAT,
                    GL.MIRRORED_REPEAT);
            return true;
        }

        public static RenderBucket draw(RenderBucket b, GLViewport v,
                                        float scale, RenderBuckets buckets) {

            /* simple line shader does not take forward shortening into
             * account. only used when tilt is 0. */
            int mode = v.pos.tilt < 1 ? 1 : 0;

            GLState.blend(true);

            /* Somehow we loose the texture after an indefinite
             * time, when label/symbol textures are used.
             * Debugging gl on Desktop is most fun imaginable,
             * so for now: */
            if (!GLAdapter.GDX_DESKTOP_QUIRKS)
                GLState.bindTex2D(mTexID);

            // ── Track active shader set to avoid redundant program switches ──
            // 0 = not yet set, 1 = original shaders, 2 = value shaders
            int activeShaderSet = 0;
            Shader s = null;
            int uLineFade = 0, uLineMode = 0, uLineColor = 0;
            int uLineWidth = 0, uLineHeight = 0;

            v.mvp.setAsUniform(s.uMVP);

            /* Line scale factor for non fixed lines: Within a zoom-
             * level lines would be scaled by the factor 2 by view-matrix.
             * Though lines should only scale by sqrt(2). This is achieved
             * by inverting scaling of extrusion vector with: width/sqrt(s). */
            double variableScale = Math.sqrt(scale);

            /* scale factor to map one pixel on tile to one pixel on screen:
             * used with orthographic projection, (shader mode == 1) */
            double pixel = (mode == SHADER_PROJ) ? 0.0001 : 1.5 / scale;

            gl.uniform1f(uLineFade, (float) pixel);

            int capMode = 0;
            gl.uniform1i(uLineMode, capMode);

            boolean blur = false;
            double width;

            float heightOffset = 0;
            gl.uniform1f(uLineHeight, heightOffset);

            for (; b != null && b.type == RenderBucket.LINE; b = b.next) {
                LineBucket lb = (LineBucket) b;

                // ── Per-bucket shader selection & texture binding ──
                boolean useValue = (lb.mColorRampTexID != 0);
                int neededSet = useValue ? 2 : 1;
                if (neededSet != activeShaderSet) {
                    activeShaderSet = neededSet;
                    Shader[] activeShaders = useValue ? valueShaders : originalShaders;
                    s = activeShaders[mode];
                    s.useProgram();
                    uLineFade = s.uFade;
                    uLineMode = s.uMode;
                    uLineColor = s.uColor;
                    uLineWidth = s.uWidth;
                    uLineHeight = s.uHeight;

                    // a_pos: 4 shorts = 8 bytes, stride = 10 bytes, offset = 0
                    gl.vertexAttribPointer(s.aPos, 4, GL.SHORT, false, 10,
                            buckets.offset[LINE]);
                    // a_value: only enabled with value shaders
                    if (useValue) {
                        gl.vertexAttribPointer(s.aValue, 1, GL.SHORT, true, 10,
                                buckets.offset[LINE] + 8);
                    }
                }

                // Bind per-bucket color-ramp texture at unit 1.
                if (useValue) {
                    gl.activeTexture(GL.TEXTURE1);
                    gl.bindTexture(GL.TEXTURE_2D, lb.mColorRampTexID);
                    gl.uniform1i(s.uColorRamp, 1);
                    gl.activeTexture(GL.TEXTURE0);
                }

                LineStyle line = lb.line.current();

                if (line.heightOffset != lb.heightOffset)
                    lb.heightOffset = line.heightOffset;
                if (lb.heightOffset != heightOffset) {
                    heightOffset = lb.heightOffset;

                    gl.uniform1f(uLineHeight, (float) (heightOffset / MercatorProjection.groundResolution(v.pos)));
                }

                if (line.fadeScale < v.pos.zoomLevel) {
                    GLUtils.setColor(uLineColor, line.color, 1);
                } else if (line.fadeScale > v.pos.zoomLevel) {
                    continue;
                } else {
                    float alpha = (float) (scale > 1.2 ? scale : 1.2) - 1;
                    GLUtils.setColor(uLineColor, line.color, alpha);
                }

                if (mode == SHADER_PROJ && blur && line.blur == 0) {
                    gl.uniform1f(uLineFade, (float) pixel);
                    blur = false;
                }

                if (line.transparent && !Color.isOpaque(line.color)) {
                    gl.depthMask(true);
                    gl.clear(GL.DEPTH_BUFFER_BIT);
                    GLState.test(true, false);
                }

                /* draw LineLayer */
                if (!line.outline) {
                    /* invert scaling of extrusion vectors so that line
                     * width stays the same. */
                    if (line.fixed) {
                        width = Math.max(line.width, 1) / scale;
                    } else {
                        width = lb.scale * line.width / variableScale;
                    }

                    gl.uniform1f(uLineWidth,
                            (float) (width * COORD_SCALE_BY_DIR_SCALE));

                    /* Line-edge fade */
                    if (line.blur > 0) {
                        gl.uniform1f(uLineFade, line.blur);
                        blur = true;
                    } else if (mode == SHADER_FLAT) {
                        gl.uniform1f(uLineFade, (float) (pixel / width));
                    }

                    /* Cap mode */
                    if (lb.scale < 1.0) {
                        if (capMode != CAP_THIN) {
                            capMode = CAP_THIN;
                            gl.uniform1i(uLineMode, capMode);
                        }
                    } else if (lb.roundCap) {
                        if (capMode != CAP_ROUND) {
                            capMode = CAP_ROUND;
                            gl.uniform1i(uLineMode, capMode);
                        }
                    } else if (capMode != CAP_BUTT) {
                        capMode = CAP_BUTT;
                        gl.uniform1i(uLineMode, capMode);
                    }

                    gl.drawArrays(GL.TRIANGLE_STRIP,
                            b.vertexOffset, b.numVertices);

                    if (line.transparent && !Color.isOpaque(line.color)) {
                        gl.depthMask(false);
                    }

                    continue;
                }

                /* draw LineLayers references by this outline */

                for (LineBucket ref = lb.outlines; ref != null; ref = ref.outlines) {
                    LineStyle core = ref.line.current();

                    // core width
                    if (core.fixed) {
                        width = Math.max(core.width, 1) / scale;
                    } else {
                        width = ref.scale * core.width / variableScale;
                    }
                    // add outline width
                    if (line.fixed) {
                        width += line.width / scale;
                    } else {
                        width += lb.scale * line.width / variableScale;
                    }

                    gl.uniform1f(uLineWidth,
                            (float) (width * COORD_SCALE_BY_DIR_SCALE));

                    /* Line-edge fade */
                    if (line.blur > 0) {
                        gl.uniform1f(uLineFade, line.blur);
                        blur = true;
                    } else if (mode == SHADER_FLAT) {
                        gl.uniform1f(uLineFade, (float) (pixel / width));
                    }

                    /* Cap mode */
                    if (ref.roundCap) {
                        if (capMode != CAP_ROUND) {
                            capMode = CAP_ROUND;
                            gl.uniform1i(uLineMode, capMode);
                        }
                    } else if (capMode != CAP_BUTT) {
                        capMode = CAP_BUTT;
                        gl.uniform1i(uLineMode, capMode);
                    }

                    gl.drawArrays(GL.TRIANGLE_STRIP,
                            ref.vertexOffset, ref.numVertices);
                }

                if (line.transparent && !Color.isOpaque(line.color)) {
                    gl.depthMask(false);
                }
            }

            return b;
        }
    }
}
