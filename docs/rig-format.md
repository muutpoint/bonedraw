# Rig format

**Export → Rig (JSON)** in the app, or `node cli.js --seed <seed> --format rig`, writes a
skeleton as a tree of bones plus the drawing attached to each bone. Use it to pose and
render skeletons in TouchDesigner, Blender or your own code.

A working reference in Python is in [`examples/pose_from_json.py`](examples/pose_from_json.py).
It rebuilds a skeleton's pose from the JSON alone.

## Conventions

- Units: the trunk (shoulder to hip) is 100 units long.
- Axes: x to the right, **y down**, towards the tail. The head is at the top.
- Angles in **radians**, measured from +x towards +y (so π/2 points down, towards the tail).
  Joint **limits are in degrees**.
- Bones are listed **parents first**, so one pass computes every world transform.
- Left and right: the right side is built, then mirrored. Mirrored bones have `side` −1.
  Their limits are already flipped, so they apply as written.

## File

```jsonc
{
  "name": "Urolosaurus flabellatus",   // the Latin name
  "seed": "stingray",
  "params": { ... },                   // every parameter that made this skeleton
  "units": "trunk length = 100",
  "axes": "x right, y towards the tail; angles in radians, limits in degrees",
  "restCurve": [0, 0, -0.012, ...],    // one value per bone, see below
  "rig": { "bones": [ ... ], "items": [ ... ] }
}
```

## Bones

```jsonc
{
  "id": 40,
  "parent": 39,                 // -1 for the root (the skull)
  "role": "tail",               // skull neck trunk tail rib girdle limb digit ray horn
  "side": 0,                    // 0 on the midline, 1 right, -1 left
  "chain": "spine",             // bones of one run that bend together (spine, a finger, a fin ray); or null
  "k": 39, "n": 148,            // index in the chain, and chain length
  "head": [0, 122.55],          // joint position in the rest pose, world space
  "angle": 1.5708,              // direction in the rest pose, world space
  "length": 1.82,
  "local": { "offset": [1.83, 0], "angle": 0 },   // position and angle relative to the parent's frame
  "limits": [-20, 20],          // how far the joint may turn from its rest angle, degrees [min, max]
  "group": "disc", "u": 0.37,   // optional: a fan of rays and where this one sits in it, 0 to 1
  "limb": 2                     // optional: which limb this belongs to
}
```

`limits` of `[0, 0]` means the bone doesn't move (shells, horns, the trunk under a disc).

## Items (the drawing)

```jsonc
{
  "bone": 40,
  "kind": "bone",        // bone | line | ray | soft | shade (see below)
  "fill": true,          // a closed shape that hides what is behind it
  "closed": true,
  "z": 4,                // depth: higher draws on top
  "weight": 1,           // stroke width multiplier
  "local": [x0, y0, x1, y1, ...],   // outline, flat, in the bone's own frame
  "holes": [[...], [...]],          // optional: cut-outs (eye sockets, windows), same format
  "bone2": 41, "local2": [...], "weights": [0, 0.1, ...]   // optional: soft tissue, see below
}
```

- A bone's own frame has its origin at the bone's joint and its x axis along the bone.
- `kind`: `bone` is a filled bone shape with an outline; `line` is a detail stroke
  (sutures, vertebra marks); `ray` is a fin ray; `soft` is a membrane edge; `shade` is a
  light shading stroke.
- **Soft items** (wing and flipper membranes) are blended between two bones: each point is
  computed with `bone` and with `bone2` (using `local2`), then mixed by that point's weight.

## The pose

For bone *i*, with `delta[i]` the extra rotation you want in radians and `rest[i]` from
`restCurve`:

```
angle[i] = angle[parent] + local.angle[i] + rest[i] + delta[i]
pos[i]   = pos[parent] + rotate(local.offset[i], angle[parent])        // root: pos = local.offset
```

and an item's point `(x, y)` from `local` goes to `pos[b] + rotate((x, y), angle[b])`, where
`b` is the item's bone. Keep `delta[i]` within `limits[i]` (converted to radians).

**`restCurve`** is the rest pose's built-in bend: a serpent's S, a chameleon's coiled tail.
It's one extra rotation per bone, added to the angle the same way as `delta`. A straight
skeleton is all zeros.

**Foreshortening.** The app fakes depth for fins and wings tilting out of the page by
scaling the x of a bone's local frame (the part along the bone) by a factor between 0 and 1,
which also moves its children. If you pose in 3D you won't need it.
