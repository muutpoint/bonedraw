# How it works

## Seeds and parameters

A seed picks a body plan and samples about 75 anatomical parameters from that plan's
ranges. Each part of the build forks its own random stream from the seed, so changing one
parameter doesn't reshuffle the randomness of every other part. **Weirdness** then works in
three layers that kick in progressively:

1. **Hybridise** (from about 0.1): borrow whole trait groups (a skull, a limb type, a disc)
   from another body plan.
2. **Exaggerate** (from about 0.4): push proportions out towards the slider extremes.
3. **Pile on** (from about 0.5): bolt on extra features such as limbs, horns, frills,
   tentacles and odd tails.

## Anatomy

All body plans share one anatomy, so every part can turn up on any of them.

- **Skull**: wedge, round, broad, long, hammer, disc, fish or smiler outline, with eye
  sockets, skull windows, nostrils, teeth, a jaw rim, a casque, horns (pair, brow, nasal,
  crown, antlers) and a frill. Holes are fitted inside the outline with a rim of bone.
- **Spine**: neck, trunk and tail vertebrae with side processes. A body curve (serpents)
  and a tail curl (chameleons) are stored as a **rest pose** on a straight skeleton, not
  baked into the bones.
- **Ribs**: free, cage, short (fish), or a turtle shell of rib plates and marginal bones.
  Also belly ribs, neck ribs and fish pin bones. Very fine ribs (a snake's) draw as single
  strokes.
- **Limbs**: sprawling and upright legs, wings with membranes, flippers, fan fins,
  tentacles and stubs, on any number of pairs, plus the humanoid's arms and legs. Girdles,
  long bones with knobbed ends, paired forearm bones, carpals, digits and claws.
- **Disc**: the batoid fin. Frame bars run from the snout round to the hips, and up to 150
  jointed fin rays per side fan out to the disc edge, forking near the margin. Gill arches
  with rakers sit inside the frame; optional head lobes stick out in front as on a manta.
- **Tail tips**: point, fan, fork, whip, barb, club, spikes, rattle, leaf.
- **Armour**: rows of bony plates and side spines.

## The rig

The generator builds bones first and attaches every drawn shape to a bone, in that bone's
own frame, so posing the skeleton carries the drawing with it.

Each bone has a parent, a pivot (its joint), a rest angle, a length, **joint limits**, a
role (skull, neck, trunk, tail, rib, girdle, limb, digit, ray, horn), a side (mirrored bones
carry −1 and flipped limits) and a **chain** id for runs that bend together (the spine, a
finger, a fin ray). Soft items such as wing membranes blend between two bones. See
[rig-format.md](rig-format.md) for the exported data.

## Motion

Motion is procedural, with no keyframes. For a pose at time *t*:

- Every movement is a **fraction of each joint's limits**, so a vertebra, a rib, an elbow and
  a fin ray each move within their own range. Joint range scales those limits. Shells, horns
  and the trunk under a disc have no range, so they stay put.
- **Waves run along chains as a change of heading**: each joint turns by the difference in
  heading from the one before it, so a 200-vertebra snake bends as smoothly as a 20-vertebra
  lizard.
- **Foreshortening** fakes depth. A fin or wing that tilts out of the page looks shorter
  from above; tilt accumulates down a chain and shortens each bone by the cosine of it. That
  is how a stingray's ripple and a bat's wing-beat read in a flat top view.
- The middle of the body is held still each frame, so the head and tail swing round it.
- Loops are seamless: breathing and writhing run at half rate, so one loop is two strokes
  (4 seconds at speed 1).

Presets set a mix of six layers (body, fins, legs, wings, breathe, writhe). *Auto* picks one
by body plan.

## X-ray and cleared & stained

Each frame is drawn into two 2D-canvas layers, then a WebGL2 fragment shader (plain GLSL ES
3.0, in `src/post.js`) combines them:

1. **Bones** at full size, drawn additively with ossified bone in the red channel,
   cartilage in the green and soft edges in the blue. Overlaps and rims come out denser,
   as on film. Which bones are bone and which cartilage follows an ossification order: skull
   and trunk first, then long bones, with fingertips, carpals and fin rays last.
2. **Flesh** at quarter size: every bone carries a flesh radius set by the builder (the trunk
   is as wide as the body, limbs and tails are padded, fin rays get just enough to merge into
   a membrane), drawn as a soft capsule round each bone, plus web outlines between the
   fingers of wings and flippers. Blurring it merges the capsules into one body that follows
   the animation.

The shader turns that into film (density, glow, tint, grain, vignette) or a cleared specimen
(amber flesh with a lit rim, stained bone and cartilage).

## Names

Latin binomials are built from the skeleton's features: its prominent traits pick the genus
parts and its details pick the epithet, so a horned, long-tailed ray might be called
*Ceratourus radiatus*. Humanoids get gloomy epithets (*maestus*, *tristis*).

## Exports

- **Stills**: PNG from the canvas; SVG from the same drawing instructions.
- **Video and GIF**: each frame is drawn at its exact moment in the loop, then encoded:
  H.264 through the browser's WebCodecs `VideoEncoder` and packed by mp4-muxer, or GIF by
  gifenc with one palette sampled from three frames across the loop so colours don't flicker.

## Frozen behaviour

Two checks keep earlier output from changing by accident:

- `node tools/check-wild.js` verifies 32 seeds of **Wild** mode.
- `node tools/check-base.js` verifies 60 seeds of **Anatomical** mode, which must not change
  when the Humanoid toggle is off.

Run both after touching `src/creature.js`.
