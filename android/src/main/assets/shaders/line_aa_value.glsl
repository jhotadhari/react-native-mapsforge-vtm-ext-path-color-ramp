/*
 * SHADOWED from vtm v0.28.0 line_aa.glsl — added a_value + u_colorRamp.
 *
 * Changes from upstream:
 *   - Vertex: +attribute float a_value, +varying float v_value
 *   - Fragment: +uniform sampler2D u_colorRamp, +varying float v_value
 *   - gl_FragColor multiplies u_color ramp color instead of u_color
 *
 * The color ramp is a 2D RGBA8 texture with height=1 (GLES 2.0 lacks sampler1D).
 * The normalized value (0–1) maps to the s texture coordinate;
 * t=0.5 always hits the single row.
 */
#ifdef GLES
// highp is necessary to not loose texture coordinate bits
precision highp float;
#endif
uniform mat4 u_mvp;
// uniform mat4 u_vp;
// factor to increase line width relative to scale
uniform float u_width;
// xy hold position, zw extrusion vector
attribute vec4 a_pos;
// per-vertex data value for color-ramp lookup (0.0–1.0)
attribute float a_value;
uniform float u_height;
varying vec2 v_st;
varying float v_value;

void main() {
    // scale extrusion to u_width pixel
    // just ignore the two most insignificant bits.
    vec2 dir = a_pos.zw;
    gl_Position = u_mvp * vec4(a_pos.xy + (u_width * dir), u_height, 1.0);

    // last two bits hold the texture coordinates.
    v_st = abs(mod(dir, 4.0)) - 1.0;

    // Pass value through to fragment shader for color-ramp lookup.
    v_value = a_value;
}

$$

#ifdef GLES
precision highp float;
#endif
uniform sampler2D u_tex;
uniform float u_fade;
uniform int u_mode;
uniform vec4 u_color;
// 2D color-ramp texture (256×1 RGBA8): s = normalized value, t = 0.5
uniform sampler2D u_colorRamp;
varying vec2 v_st;
varying float v_value;

void main() {
    float len;
    if (u_mode == 2) {
        // round cap line
#ifdef DESKTOP_QUIRKS
        len = length(v_st);
#else
        len = texture2D(u_tex, v_st).a;
#endif
    } else {
        // flat cap line
        len = abs(v_st.s);
    }
    // Antialias line-edges:
    // - 'len' is 0 at center of line. -> (1.0 - len) is 0 at the
    // edges
    // - 'u_fade' is 'pixel' / 'width', i.e. the inverse width of
    // the
    // line in pixel on screen.
    // - 'pixel' is 1.5 / relativeScale
    // - '(1.0 - len) / u_fade' interpolates the 'pixel' on
    // line-edge
    // between 0 and 1 (it is greater 1 for all inner pixel).

    // Lookup color from ramp using normalized vertex value.
    // t=0.5 is safe: 2D texture with height=1 (GLES 2.0 lacks sampler1D).
    vec4 rampColor = texture2D(u_colorRamp, vec2(v_value, 0.5));

    // Multiply ramp color by u_color (for tinting/fading) and edge antialiasing.
    gl_FragColor = u_color * rampColor * clamp((1.0 - len) / u_fade, 0.0, 1.0);
}
