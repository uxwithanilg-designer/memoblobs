"""Blender side of the title-logo renderer: real 3D type (extrude + bevel), outline plates, materials, ornaments, lights.

Run through scripts/art/make_titles.py (it measures the fonts, writes a jobs file and calls):
  blender -b --factory-startup --python scripts/art/title3d.py -- <jobs.json>
Each job renders one transparent PNG: job["out"].
"""
import json
import math
import os
import random
import sys

import bpy
import mathutils
from bpy_extras.object_utils import world_to_camera_view

ARGS = sys.argv[sys.argv.index("--") + 1:]
STUDIO = os.path.join(os.path.dirname(bpy.app.binary_path), f"{bpy.app.version[0]}.{bpy.app.version[1]}", "datafiles", "studiolights", "world")


def hexc(h, a=1.0):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4  # noqa: E731
    return (lin(r), lin(g), lin(b), a)


# ---------------------------------------------------------------- materials
def ramp(nt, stops, fac_socket):
    cr = nt.nodes.new("ShaderNodeValToRGB")
    els = cr.color_ramp.elements
    while len(els) > 1: els.remove(els[-1])
    for i, (pos, col) in enumerate(stops):
        e = els[0] if i == 0 else els.new(pos)
        e.position = pos; e.color = hexc(col)
    nt.links.new(fac_socket, cr.inputs[0])
    return cr.outputs[0]


def grad_fac(nt, anchor, axis=1):
    tc = nt.nodes.new("ShaderNodeTexCoord"); tc.object = anchor
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], sep.inputs[0])
    mr = nt.nodes.new("ShaderNodeMapRange"); mr.label = "GRAD"  # 0 at the title's top, 1 at its bottom (set by fix_grad)
    nt.links.new(sep.outputs[axis], mr.inputs["Value"])
    return mr.outputs[0]


def front_fac(nt, lo=0.55, hi=0.97):
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Normal"], sep.inputs[0])
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = lo; mr.inputs["From Max"].default_value = hi
    nt.links.new(sep.outputs[2], mr.inputs["Value"])
    return mr.outputs[0]


def mix_col(nt, fac, a, b):
    m = nt.nodes.new("ShaderNodeMix"); m.data_type = "RGBA"
    nt.links.new(fac, m.inputs[0])
    for sock, v in ((m.inputs[6], a), (m.inputs[7], b)):
        if isinstance(v, str): sock.default_value = hexc(v)
        else: nt.links.new(v, sock)
    return m.outputs[2]


def fix_grad(mat, y0, y1):
    for nd in mat.node_tree.nodes:
        if nd.label == "GRAD":
            nd.inputs["From Min"].default_value = y1; nd.inputs["From Max"].default_value = y0


def make_mat(name, m, anchor):
    """m: {type, grad:[[pos,hex]...] | color, side, rough, metal, coat, emit, emit_str, tex, bump, film}"""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    kind = m.get("type", "gloss")
    stops = m.get("grad") or [[0, m.get("color", "#ffffff")], [1, m.get("color", "#ffffff")]]
    face = ramp(nt, stops, grad_fac(nt, anchor, 1))
    # procedural surface patterns layered over the face colour
    tex = m.get("tex")
    if tex == "wood":
        w = nt.nodes.new("ShaderNodeTexWave"); w.wave_type = "RINGS"; w.inputs["Scale"].default_value = m.get("tex_scale", 1.6)
        w.inputs["Distortion"].default_value = 6; w.inputs["Detail"].default_value = 3
        face = mix_col(nt, w.outputs["Fac"], face, m.get("tex_col", "#5a2e12"))
    elif tex in ("stone", "noise"):
        n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = m.get("tex_scale", 6); n.inputs["Detail"].default_value = 8
        sep = nt.nodes.new("ShaderNodeMapRange"); sep.inputs["From Min"].default_value = 0.45; sep.inputs["From Max"].default_value = 0.75
        nt.links.new(n.outputs["Fac"], sep.inputs["Value"])
        face = mix_col(nt, sep.outputs[0], face, m.get("tex_col", "#555555"))
    elif tex == "stripes":
        w = nt.nodes.new("ShaderNodeTexWave"); w.wave_type = "BANDS"; w.bands_direction = "DIAGONAL"; w.inputs["Scale"].default_value = m.get("tex_scale", 3)
        mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value = 0.48; mr.inputs["From Max"].default_value = 0.52
        nt.links.new(w.outputs["Fac"], mr.inputs["Value"])
        face = mix_col(nt, mr.outputs[0], face, m.get("tex_col", "#ffffff"))
    elif tex == "checker":
        c = nt.nodes.new("ShaderNodeTexChecker"); c.inputs["Scale"].default_value = m.get("tex_scale", 8)
        c.inputs["Color1"].default_value = hexc("#ffffff"); c.inputs["Color2"].default_value = hexc("#000000")
        face = mix_col(nt, c.outputs["Fac"], face, m.get("tex_col", "#111111"))
    side = m.get("side")
    col = mix_col(nt, front_fac(nt), side, face) if side else face
    nt.links.new(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = m.get("rough", {"chrome": 0.06, "gold": 0.16, "clay": 0.62, "jelly": 0.04, "matte": 0.55, "neon": 0.3, "holo": 0.1, "carpaint": 0.32}.get(kind, 0.28))
    bsdf.inputs["Metallic"].default_value = m.get("metal", {"chrome": 0.35, "gold": 0.6, "holo": 0.45}.get(kind, 0.0))
    if kind == "chrome": bsdf.inputs["Coat Weight"].default_value = 1.0; bsdf.inputs["Coat Roughness"].default_value = 0.02
    if kind in ("gloss", "carpaint", "jelly", "candy") or m.get("coat"):
        bsdf.inputs["Coat Weight"].default_value = m.get("coat", 1.0); bsdf.inputs["Coat Roughness"].default_value = 0.04
    if kind == "jelly":
        # (Eevee drops the whole frame when text curves use transmission, so jelly = deep gloss + inner glow)
        bsdf.inputs["Subsurface Weight"].default_value = 0.4; bsdf.inputs["Subsurface Scale"].default_value = 0.1
        bsdf.inputs["Emission Color"].default_value = hexc(stops[-1][1]); bsdf.inputs["Emission Strength"].default_value = m.get("glow", 0.12)
    if kind == "clay":
        bsdf.inputs["Subsurface Weight"].default_value = 0.25; bsdf.inputs["Subsurface Scale"].default_value = 0.05
    if kind == "holo":
        bsdf.inputs["Thin Film Thickness"].default_value = m.get("film", 520); bsdf.inputs["Thin Film IOR"].default_value = 1.6
    if kind == "neon" or m.get("emit"):
        ec = m.get("emit", None)
        if ec: bsdf.inputs["Emission Color"].default_value = hexc(ec)
        else: nt.links.new(col, bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = m.get("emit_str", 3.0)
    bump = m.get("bump") or ({"clay": 0.25, "stone": 0.5}.get(kind) or (0.4 if tex in ("wood", "stone") else 0))
    if bump:
        n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = m.get("bump_scale", 14); n.inputs["Detail"].default_value = 6
        b = nt.nodes.new("ShaderNodeBump"); b.inputs["Strength"].default_value = bump; b.inputs["Distance"].default_value = 0.02
        nt.links.new(n.outputs["Fac"], b.inputs["Height"]); nt.links.new(b.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


# ---------------------------------------------------------------- geometry
def link(ob):
    bpy.context.scene.collection.objects.link(ob); return ob


def char_obj(ch, font, size, depth, bevel, bres, offset, shear, mat, name="c"):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = ch; cu.font = font; cu.size = size; cu.shear = shear
    cu.extrude = depth; cu.bevel_depth = bevel; cu.bevel_resolution = bres; cu.offset = offset
    cu.align_x = "LEFT"; cu.align_y = "TOP_BASELINE"
    cu.resolution_u = 6
    ob = link(bpy.data.objects.new(name, cu))
    ob.data.materials.append(mat)
    return ob


def star_mesh(name, points=5, r1=1.0, r2=0.45, depth=0.25, bev=0.06):
    import bmesh
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    vs = []
    for i in range(points * 2):
        a = math.pi / 2 + i * math.pi / points
        r = r1 if i % 2 == 0 else r2
        vs.append(bm.verts.new((r * math.cos(a), r * math.sin(a), 0)))
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]: v.co.z += depth
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, -depth / 2))
    bm.to_mesh(me); bm.free()
    ob = link(bpy.data.objects.new(name, me))
    mod = ob.modifiers.new("b", "BEVEL"); mod.width = bev; mod.segments = 4; mod.limit_method = "ANGLE"
    return ob


def ornament(o, mats_cache, anchor, box):
    """o: {type, u, v (0..1 in the title box), s (size, title-height units), rot, z, mat}"""
    (x0, y0, x1, y1) = box
    x = x0 + o.get("u", 0.5) * (x1 - x0); y = y1 - o.get("v", 0.5) * (y1 - y0)
    s = o.get("s", 0.2) * (y1 - y0)
    key = json.dumps(o.get("mat", {"type": "gloss", "color": "#ffd25a"}), sort_keys=True)
    if key not in mats_cache:
        mats_cache[key] = make_mat("orn", json.loads(key), anchor); fix_grad(mats_cache[key], y0, y1)
    mat = mats_cache[key]
    t = o["type"]
    if t == "star":
        ob = star_mesh("star", o.get("points", 5), 1, o.get("inner", 0.45), 0.35, 0.08)
    elif t == "sparkle":
        ob = star_mesh("sparkle", 4, 1, 0.18, 0.12, 0.03)
    elif t == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1); ob = bpy.context.active_object
        bpy.ops.object.shade_smooth()
    elif t == "ring":
        bpy.ops.mesh.primitive_torus_add(major_radius=1, minor_radius=o.get("thick", 0.18), major_segments=64, minor_segments=16); ob = bpy.context.active_object
        bpy.ops.object.shade_smooth()
    elif t == "bar":  # rounded speed streak
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.5, depth=1); ob = bpy.context.active_object
        ob.rotation_euler = (0, math.pi / 2, 0); bpy.ops.object.transform_apply(rotation=True)
        ob.scale = (o.get("len", 6), 1, 1); bpy.ops.object.transform_apply(scale=True)
        mod = ob.modifiers.new("b", "BEVEL"); mod.width = 0.45; mod.segments = 6
        bpy.ops.object.shade_smooth()
    elif t == "leaf":
        ob = leaf_mesh()
    elif t == "drop":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1); ob = bpy.context.active_object
        for v in ob.data.vertices:
            if v.co.z > 0:
                sh = (1 - v.co.z) ** 0.85; v.co.x *= sh; v.co.y *= sh; v.co.z *= 1.9
        ob.rotation_euler = (-math.pi / 2, 0, 0); bpy.ops.object.transform_apply(rotation=True)
        bpy.ops.object.shade_smooth()
    elif t == "crown":
        ob = crown_mesh()
    elif t == "cube":
        bpy.ops.mesh.primitive_cube_add(size=1.6); ob = bpy.context.active_object
        mod = ob.modifiers.new("b", "BEVEL"); mod.width = 0.18; mod.segments = 5
    else:
        return None
    ob.data.materials.clear(); ob.data.materials.append(mat)
    ob.location = (x, y, o.get("z", 0.4) * (y1 - y0) * 0.3)
    ob.scale = (s * o.get("sx", 1), s * o.get("sy", 1), s * o.get("sz", 1))
    ob.rotation_euler = (math.radians(o.get("rx", 0)), math.radians(o.get("ry", 0)), math.radians(o.get("rot", 0)))
    return ob


def leaf_mesh():
    import bmesh
    me = bpy.data.meshes.new("leaf"); bm = bmesh.new()
    n = 24; top, bot = [], []
    for i in range(n + 1):
        t = i / n; x = (t - 0.5) * 2.4; w = math.sin(math.pi * t) ** 0.8 * 0.55
        top.append((x, w)); bot.append((x, -w))
    pts = top + bot[::-1][1:-1]
    vs = [bm.verts.new((x, y, 0)) for x, y in pts]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]: v.co.z += 0.08
    for v in bm.verts: v.co.z += 0.18 * (1 - (v.co.x / 1.2) ** 2) - 0.12 * abs(v.co.y)  # cupped
    bm.to_mesh(me); bm.free()
    ob = link(bpy.data.objects.new("leaf", me))
    mod = ob.modifiers.new("s", "SUBSURF"); mod.levels = 2; mod.render_levels = 2
    for p in me.polygons: p.use_smooth = True
    return ob


def crown_mesh():
    import bmesh
    me = bpy.data.meshes.new("crown"); bm = bmesh.new()
    pts = [(-1.2, -0.6), (1.2, -0.6), (1.2, 0.2), (1.25, 0.75), (0.65, 0.25), (0, 0.95), (-0.65, 0.25), (-1.25, 0.75), (-1.2, 0.2)]
    vs = [bm.verts.new((x, y, 0)) for x, y in pts]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]: v.co.z += 0.35
    bm.to_mesh(me); bm.free()
    ob = link(bpy.data.objects.new("crown", me))
    mod = ob.modifiers.new("b", "BEVEL"); mod.width = 0.07; mod.segments = 4
    return ob


# ---------------------------------------------------------------- scene
def world_setup(w):
    world = bpy.data.worlds.new("w"); bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes["Background"]
    kind = w.get("env", "studio")
    if kind == "horizon":  # the classic chrome-type sky: bright sky, hard dark horizon, warm ground
        tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["Generated"], sep.inputs[0])
        stops = w.get("stops", [[0.0, "#3a2010"], [0.47, "#c07a3a"], [0.5, "#101020"], [0.53, "#4a7ad0"], [1.0, "#e8f4ff"]])
        nt.links.new(ramp(nt, stops, sep.outputs[2]), bg.inputs["Color"])
    else:
        env = nt.nodes.new("ShaderNodeTexEnvironment")
        env.image = bpy.data.images.load(os.path.join(STUDIO, f"{kind}.exr"))
        mp = nt.nodes.new("ShaderNodeMapping"); tc = nt.nodes.new("ShaderNodeTexCoord")
        mp.inputs["Rotation"].default_value[2] = math.radians(w.get("env_rot", 0))
        nt.links.new(tc.outputs["Generated"], mp.inputs[0]); nt.links.new(mp.outputs[0], env.inputs[0])
        nt.links.new(env.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = w.get("env_str", 0.55)


def light(name, loc, power, color="#ffffff", size=6.0, target=(0, 0, 0)):
    ld = bpy.data.lights.new(name, "AREA"); ld.energy = power; ld.size = size; ld.color = hexc(color)[:3]
    ob = link(bpy.data.objects.new(name, ld)); ob.location = loc
    d = mathutils.Vector(target) - mathutils.Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return ob


def bounds(objs):
    pts = []
    dg = bpy.context.evaluated_depsgraph_get()
    for ob in objs:
        ev = ob.evaluated_get(dg)
        for c in ev.bound_box: pts.append(ob.matrix_world @ mathutils.Vector(c))
    return pts


def fit_camera(cam, pts, tilt, yaw, lens, margin, longest):
    sc = bpy.context.scene
    cx = sum(p.x for p in pts) / len(pts); cy = sum(p.y for p in pts) / len(pts); cz = sum(p.z for p in pts) / len(pts)
    center = mathutils.Vector((cx, cy, cz))
    cam.data.lens = lens
    rot = mathutils.Euler((math.radians(tilt), math.radians(yaw), 0), "XYZ")
    fwd = rot.to_matrix() @ mathutils.Vector((0, 0, -1))
    cam.rotation_euler = rot
    # aspect from the extents seen from far away
    cam.location = center - fwd * 400; bpy.context.view_layer.update()
    inv = cam.matrix_world.inverted()
    xs = [(inv @ p).x / -(inv @ p).z for p in pts]; ys = [(inv @ p).y / -(inv @ p).z for p in pts]
    aspect = (max(xs) - min(xs)) / max(1e-6, (max(ys) - min(ys)))
    aspect = max(1.0, min(4.2, aspect * (1 + margin) / (1 + margin * aspect / 2.5)))
    sc.render.resolution_x = longest; sc.render.resolution_y = int(round(longest / aspect / 2) * 2)
    lo, hi = 0.5, 400.0
    for _ in range(40):
        mid = (lo + hi) / 2
        cam.location = center - fwd * mid; bpy.context.view_layer.update()
        ok = all(margin / 2 <= v.x <= 1 - margin / 2 and margin / 2 <= v.y <= 1 - margin / 2 and v.z > 0 for v in (world_to_camera_view(sc, cam, p) for p in pts))
        if ok: hi = mid
        else: lo = mid
    cam.location = center - fwd * hi
    # recentre: shift so the projected box sits in the middle
    bpy.context.view_layer.update()
    vs = [world_to_camera_view(sc, cam, p) for p in pts]
    cam.data.shift_x = ((min(v.x for v in vs) + max(v.x for v in vs)) / 2 - 0.5) * (1 if sc.render.resolution_x >= sc.render.resolution_y else sc.render.resolution_x / sc.render.resolution_y)
    cam.data.shift_y = ((min(v.y for v in vs) + max(v.y for v in vs)) / 2 - 0.5) * (sc.render.resolution_y / sc.render.resolution_x if sc.render.resolution_x >= sc.render.resolution_y else 1)


def build(job):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = job.get("view", "Standard")
    try: sc.view_settings.look = job.get("look", "None")
    except Exception: pass
    sc.view_settings.exposure = job.get("exposure", -0.15)
    ee = sc.eevee
    ee.taa_render_samples = job.get("samples", 32)
    for k, v in (("use_raytracing", job.get("raytrace", False)), ("use_shadows", True), ("shadow_ray_count", 1), ("shadow_step_count", 6)):
        try: setattr(ee, k, v)
        except Exception: pass
    try: ee.ray_tracing_options.resolution_scale = "1"
    except Exception: pass
    random.seed(job.get("seed", 7))

    anchor = link(bpy.data.objects.new("anchor", None))
    for L in job["lines"]:
        ms = L.get("mats") or [L.get("mat", {"type": "gloss", "color": "#ffd25a"})]
        L["_mats"] = [make_mat("m", dict(m), anchor) for m in ms]
        L["_plates"] = []
        for P in L.get("plates", []):
            P = dict(P); P["_mat"] = make_mat("p", P.get("mat", {"type": "gloss", "color": "#1a1036"}), anchor)
            L["_plates"].append(P)
    fonts = {}
    letters, plates = [], []
    lines = job["lines"]
    # measure each line (advances come from the font file, measured outside Blender)
    y = 0.0
    placed = []
    for li, L in enumerate(lines):
        fp = L["font"]
        if fp not in fonts: fonts[fp] = bpy.data.fonts.load(fp)
        size = L.get("size", 1.0)
        if "k" not in L:  # Blender units per em at size 1: measure the H glyph against its height from the font file
            t = bpy.data.objects.new("probe", bpy.data.curves.new("probe", "FONT")); link(t)
            t.data.body = "H"; t.data.font = fonts[fp]; t.data.size = 1.0
            bpy.context.view_layer.update(); L["k"] = t.dimensions.y / L["hH"]
            bpy.data.objects.remove(t)
        k = L["k"]
        trk = L.get("track", 0.0)
        xs, x = [], 0.0
        for i, ch in enumerate(L["text"]):
            xs.append(x)
            x += (L["adv"][i] + (L["kern"][i] if i < len(L["kern"]) else 0)) * k * size + trk * size
        width = x - trk * size
        y -= L["cap"] * size * k + (L.get("gap", 0.2) * size * k if li else 0) + (L.get("bounce", 0) * 0.12 * size if li else 0)
        placed.append((L, xs, width, y))
        y -= max(0.0, -L["desc"]) * size * k
    # vertical centre at 0
    top = 0.0; bot = y
    shift = -(top + bot) / 2
    allx0, allx1 = 0, 0
    widths = [p[2] for p in placed]
    line_objs = []
    for (L, xs, width, base) in placed:
        line_objs.append([])
        size = L.get("size", 1.0); k = L["k"]
        x0 = -width / 2 + L.get("dx", 0.0) * max(widths)
        n = len(L["text"])
        arc = L.get("arc", 0.0)  # + = arch up (smile upside-down), radius in title widths
        R = (max(widths) / arc) if arc else 0
        depth = L.get("depth", 0.12) * size; bev = L.get("bevel", 0.02) * size; off = L.get("offset", 0.0) * size
        for i, ch in enumerate(L["text"]):
            if ch == " ": continue
            cw = L["adv"][i] * k * size
            cx = x0 + xs[i] + cw / 2
            by = base + shift + L.get("dy", 0.0) * size
            rot = 0.0
            if arc:
                th = cx / R
                px, py = R * math.sin(th), R * math.cos(th) - R
                rot = -th
            else:
                px, py = cx, 0.0
            tl = math.radians(L.get("rot", 0))  # tilt the whole line
            if tl:
                px, py = px * math.cos(tl) - py * math.sin(tl), px * math.sin(tl) + py * math.cos(tl)
                rot += tl
            b = L.get("bounce", 0.0)
            jy = (random.uniform(-1, 1) * b * 0.16 * size) if b else 0
            jr = (random.uniform(-1, 1) * b * 10) if b else 0
            if L.get("wave"):
                jy += math.sin(i * 1.3 + L.get("wave_phase", 0)) * L["wave"] * size
            mat = L["_mats"][i % len(L["_mats"])]
            ob = char_obj(ch, fonts[L["font"]], size, depth, bev, L.get("bres", 4), off, L.get("shear", 0.0), mat)
            # glyph origin is its left edge; pivot around its centre
            ob.location = (px - cw / 2 * math.cos(rot) , by + py - cw / 2 * math.sin(rot) + jy, 0)
            ob.rotation_euler = (0, 0, rot + math.radians(jr))
            letters.append(ob); line_objs[-1].append(ob)
            for pi, P in enumerate(L.get("_plates", [])):
                # the plate grows by a round bevel (an outline offset makes miter spikes on sharp corners)
                g = P["grow"] * size + bev
                pob = char_obj(ch, fonts[L["font"]], size, P["depth"] * size, g, 3, off, L.get("shear", 0.0), P["_mat"], name="p")
                pob.location = (ob.location.x, ob.location.y - P.get("drop", 0) * size, -(depth + bev) * 0.2 - P["depth"] * size * 0.9 - g - pi * 0.002 - P.get("back", 0) * size)
                pob.rotation_euler = ob.rotation_euler
                plates.append(pob)
    # gradients are anchored on the whole title's height
    pts = bounds(letters)
    y0 = min(p.y for p in pts); y1 = max(p.y for p in pts); x0 = min(p.x for p in pts); x1 = max(p.x for p in pts)
    for (L, *_), objs in zip(placed, line_objs):
        lp = bounds(objs) if objs and L.get("grad_scope", "line") == "line" else pts
        ly0 = min(p.y for p in lp); ly1 = max(p.y for p in lp)
        for m in L["_mats"] + [P["_mat"] for P in L["_plates"]]: fix_grad(m, ly0, ly1)
    orn = []
    mcache = {}
    for o in job.get("ornaments", []):
        ob = ornament(o, mcache, anchor, (x0, y0, x1, y1))
        if ob: orn.append(ob)
    # lights
    W = x1 - x0; Hh = y1 - y0
    L = job.get("lights", {})
    light("key", (x0 - W * 0.2, y1 + Hh * 1.6, W * 0.9), L.get("key", 1300) * (W / 10) ** 2, L.get("key_col", "#ffffff"), size=W * 0.6)
    light("fill", (x1 + W * 0.3, y0 - Hh * 0.6, W * 0.8), L.get("fill", 380) * (W / 10) ** 2, L.get("fill_col", "#dfe8ff"), size=W * 0.8)
    light("rim", (0, y1 + Hh * 1.2, -W * 0.6), L.get("rim", 1400) * (W / 10) ** 2, L.get("rim_col", "#ffffff"), size=W * 0.5)
    world_setup(job.get("world", {}))
    cam = link(bpy.data.objects.new("cam", bpy.data.cameras.new("cam")))
    sc.camera = cam
    C = job.get("cam", {})
    fit_camera(cam, bounds(letters + plates + orn), C.get("tilt", 8), C.get("yaw", 0), C.get("lens", 70), C.get("margin", 0.06), job.get("res", 1800))
    sc.render.filepath = job["out"]
    bpy.ops.render.render(write_still=True)


def main():
    jobs = json.load(open(ARGS[0], encoding="utf8"))
    only = set(ARGS[1:])
    for job in jobs:
        if only and job["slug"] not in only: continue
        build(job)
        print("TITLE_DONE", job["slug"], flush=True)


if __name__ == "__main__":
    main()
