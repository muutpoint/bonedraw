#!/usr/bin/env python3
"""Rebuild a bonedraw skeleton's pose from its rig JSON, with no bonedraw code.

    node cli.js --seed stingray --format rig > stingray.json
    python3 docs/examples/pose_from_json.py stingray.json            # rest pose
    python3 docs/examples/pose_from_json.py stingray.json 0.3        # every bone turned 0.3 rad, clamped to its limits

Prints the bounds of the pose. Use pose() and world_points() in TouchDesigner, Blender or anything else.
"""
import json, math, sys

def pose(rig, rest_curve, delta=None, stretch=None):
    """World position and angle of every bone. Bones come parents-first.
    delta[i]: extra rotation (radians) on bone i; stretch[i]: scale along bone i (foreshortening)."""
    bones = rig["bones"]
    X, Y, A = [0.0] * len(bones), [0.0] * len(bones), [0.0] * len(bones)
    for i, b in enumerate(bones):
        d = (delta[i] if delta else 0.0) + (rest_curve[i] if rest_curve else 0.0)
        ox, oy = b["local"]["offset"]
        if b["parent"] < 0:
            X[i], Y[i], A[i] = ox, oy, b["local"]["angle"] + d
        else:
            p = b["parent"]
            k = stretch[p] if stretch else 1.0
            c, s = math.cos(A[p]), math.sin(A[p])
            X[i] = X[p] + ox * k * c - oy * s
            Y[i] = Y[p] + ox * k * s + oy * c
            A[i] = A[p] + b["local"]["angle"] + d
    return X, Y, A

def world_points(item, bones_pose, stretch=None):
    """An item's outline in world space. Points are stored flat: [x0, y0, x1, y1, ...] in the bone's own frame."""
    X, Y, A = bones_pose
    b = item["bone"]
    k = stretch[b] if stretch else 1.0
    c, s = math.cos(A[b]), math.sin(A[b])
    pts = item["local"]
    out = []
    for j in range(0, len(pts), 2):
        x, y = pts[j] * k, pts[j + 1]
        out.append((X[b] + x * c - y * s, Y[b] + x * s + y * c))
    return out  # items with bone2/weights blend towards a second bone: out + (p2 - out) * weight

if __name__ == "__main__":
    data = json.load(open(sys.argv[1]))
    rig, rest = data["rig"], data.get("restCurve")
    turn = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0
    delta = None
    if turn:
        delta = [max(math.radians(b["limits"][0]), min(math.radians(b["limits"][1]), turn)) for b in rig["bones"]]
    P = pose(rig, rest, delta)
    xs, ys = [], []
    for it in rig["items"]:
        if it.get("bone2") is not None:
            continue  # blended soft items need the second bone too; skipped in this demo
        for x, y in world_points(it, P):
            xs.append(x); ys.append(y)
    print("bounds", round(min(xs), 2), round(min(ys), 2), round(max(xs), 2), round(max(ys), 2))
