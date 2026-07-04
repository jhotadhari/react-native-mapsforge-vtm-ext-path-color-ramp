/*
 * SHADOWED from vtm v0.28.0 line_aa_proj.glsl — added a_value + u_colorRamp.
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

#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif
#ifdef GLES
precision highp float;
#endif
uniform sampler2D u_tex;
uniform int u_mode;
uniform vec4 u_color;
// 2D color-ramp texture (256x1 RGBA8): s = normalized value, t = 0.5
uniform sampler2D u_colorRamp;
uniform float u_fade;
varying vec2 v_st;
varying float v_value;

void main() {
    float len;
    float fuzz;
    if (u_mode == 2) {
        /* round cap line */
#ifdef DESKTOP_QUIRKS
        len = length(v_st);
#else
        len = texture2D(u_tex, v_st).a;
#endif
        vec2 st_width = fwidth(v_st);
        fuzz = max(st_width.s, st_width.t);
    } else {
        /* flat cap line */
        len = abs(v_st.s);
        fuzz = fwidth(v_st.s);
    }

    // Lookup color from ramp using normalized vertex value.
    // t=0.5 is safe: 2D texture with height=1 (GLES 2.0 lacks sampler1D).
    vec4 rampColor = texture2D(u_colorRamp, vec2(v_value, 0.5));

    // Multiply ramp color by edge antialiasing.
    if (fuzz > 2.0)
        gl_FragColor = rampColor * 0.5;
    else
        gl_FragColor = rampColor * clamp((1.0 - len) / max(u_fade, fuzz), 0.0, 1.0);
}
