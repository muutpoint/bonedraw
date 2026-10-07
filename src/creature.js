/* bonedraw — vertebrate-ish skeletons seen from above, built as a rig */
(function () {
  'use strict';
  const BD = (globalThis.BD = globalThis.BD || {});
  const G = BD.geom, PT = BD.parts;
  const { PI, sin, cos, abs, min, max, pow, floor, round, exp, sqrt } = Math;
  const { add, sub, mul, lerp, lerp2, clamp, smoothstep, norm, perp, dir, dist, rot, angleOf } = G;
  const T = 100; // trunk length (shoulder to hip); everything else is relative to it

  // ================================================================ parameters
  // The base pools never change, so seeds stay put. The humanoid only joins when the Humanoid
  // toggle is on, and then it can also infect other body plans through weirdness.
  const ARCH_BASE = ['ray', 'fish', 'serpent', 'lizard', 'turtle', 'bat', 'mammal', 'frog', 'plesio'];
  const ARCH = ARCH_BASE.concat('humanoid');
  const HUMAN_WEIGHT = 3;
  const ARCH_WEIGHTS = { ray: 2.2, fish: 1.1, serpent: 1, lizard: 1.3, turtle: 1, bat: 1, mammal: 1, frog: 0.9, plesio: 0.9 };
  const ARCH_LABEL = {
    ray: 'Ray / skate', fish: 'Bony fish', serpent: 'Serpent', lizard: 'Lizard', turtle: 'Turtle', bat: 'Bat',
    mammal: 'Mammal', frog: 'Frog', plesio: 'Sea reptile', humanoid: 'Humanoid (smiler)',
  };
  const LIMBS_BASE = ['none', 'sprawl', 'upright', 'wing', 'flipper', 'fin', 'tentacle', 'stub'];
  const LIMBS = LIMBS_BASE.concat('arm', 'leg');
  const LIMB_LABEL = { none: 'none', sprawl: 'sprawling leg', upright: 'upright leg', wing: 'wing', flipper: 'flipper', fin: 'fin', tentacle: 'tentacle', stub: 'stub', arm: 'arm', leg: 'leg' };

  const range = (key, group, label, min, max, step = 0.01) => ({ key, group, label, type: 'range', min, max, step });
  const int = (key, group, label, min, max) => ({ key, group, label, type: 'range', min, max, step: 1, int: true });
  const select = (key, group, label, options, labels) => ({ key, group, label, type: 'select', options, labels });
  const bool = (key, group, label) => ({ key, group, label, type: 'bool' });

  const SCHEMA = [
    select('archetype', 'Body', 'Body plan', ARCH, ARCH_LABEL),
    range('skullLength', 'Body', 'Skull length', 0.05, 0.7),
    range('neckLength', 'Body', 'Neck length', 0, 1.6),
    range('tailLength', 'Body', 'Tail length', 0, 3.5),
    range('bodyWidth', 'Body', 'Body width', 0.03, 0.8),
    range('spineWave', 'Body', 'Body curve', 0, 1),
    range('tailCurl', 'Body', 'Tail curl', 0, 1),

    int('trunkVerts', 'Spine', 'Trunk vertebrae', 5, 220),
    int('neckVerts', 'Spine', 'Neck vertebrae', 1, 45),
    int('tailVerts', 'Spine', 'Tail vertebrae', 2, 160),
    range('vertWidth', 'Spine', 'Vertebra width', 0.3, 2.4),
    range('transverse', 'Spine', 'Side processes', 0, 2.4),
    range('transverseSweep', 'Spine', 'Process sweep', -1, 1),
    range('tailTaper', 'Spine', 'Tail tip width', 0.04, 1),

    select('skullShape', 'Skull', 'Shape', ['wedge', 'round', 'broad', 'long', 'hammer', 'disc', 'fish', 'smiler']),
    range('skullWidth', 'Skull', 'Width', 0.3, 2.8),
    range('snout', 'Skull', 'Snout', 0, 1),
    range('orbitSize', 'Skull', 'Eye sockets', 0, 1),
    range('orbitPos', 'Skull', 'Eye position', 0, 1),
    int('fenestrae', 'Skull', 'Skull windows', 0, 3),
    range('teeth', 'Skull', 'Teeth', 0, 1),
    range('jaw', 'Skull', 'Jaw', 0, 1),
    range('casque', 'Skull', 'Casque', 0, 1),

    select('horns', 'Horns & frill', 'Horns', ['none', 'pair', 'brow', 'nasal', 'crown', 'antlers']),
    range('hornLength', 'Horns & frill', 'Horn length', 0.1, 1.8),
    range('hornCurve', 'Horns & frill', 'Horn curve', -1, 1),
    range('frill', 'Horns & frill', 'Frill', 0, 1),

    select('ribs', 'Ribs', 'Ribs', ['none', 'free', 'cage', 'short', 'carapace']),
    range('ribLength', 'Ribs', 'Length', 0.1, 1.8),
    range('ribSweep', 'Ribs', 'Sweep back', 0, 1),
    range('ribCurve', 'Ribs', 'Curve', 0, 1),
    range('ribSpan', 'Ribs', 'Span', 0.15, 1),
    bool('gastralia', 'Ribs', 'Belly ribs'),
    range('pinBones', 'Ribs', 'Pin bones', 0, 1),
    bool('cervicalRibs', 'Ribs', 'Neck ribs'),

    select('frontLimb', 'Limbs', 'Front limbs', LIMBS, LIMB_LABEL),
    select('hindLimb', 'Limbs', 'Hind limbs', LIMBS, LIMB_LABEL),
    int('extraPairs', 'Limbs', 'Extra pairs', 0, 4),
    select('extraLimb', 'Limbs', 'Extra limbs', LIMBS.slice(1), LIMB_LABEL),
    range('limbLength', 'Limbs', 'Length', 0.2, 2.4),
    range('hindScale', 'Limbs', 'Hind / front', 0.3, 2.6),
    range('limbThickness', 'Limbs', 'Thickness', 0.4, 2.4),
    range('frontPos', 'Limbs', 'Shoulder position', 0, 0.6),
    range('limbPose', 'Limbs', 'Pose', -1, 1),
    int('digits', 'Limbs', 'Digits', 1, 8),
    range('digitLength', 'Limbs', 'Digit length', 0.2, 3.6),
    int('phalanges', 'Limbs', 'Finger bones', 1, 9),
    range('digitSpread', 'Limbs', 'Digit spread', 0.1, 1.6),
    bool('claws', 'Limbs', 'Claws'),
    bool('membrane', 'Limbs', 'Membranes'),

    range('disc', 'Disc & fins', 'Disc', 0, 1.8),
    range('discFront', 'Disc & fins', 'Front lobes', 0, 1),
    range('discRound', 'Disc & fins', 'Roundness', 0, 1),
    int('rays', 'Disc & fins', 'Disc rays', 16, 150),
    int('rayJoints', 'Disc & fins', 'Ray joints', 1, 6),
    select('rayStyle', 'Disc & fins', 'Ray style', ['line', 'beaded', 'double']),
    range('rayFork', 'Disc & fins', 'Ray forks', 0, 1),
    range('cephalic', 'Disc & fins', 'Head lobes', 0, 1),
    int('gillArches', 'Disc & fins', 'Gill arches', 0, 8),
    range('finSize', 'Disc & fins', 'Fin size', 0.2, 2.2),
    int('finRays', 'Disc & fins', 'Fin rays', 4, 40),

    select('tailEnd', 'Tail', 'Tail tip', ['point', 'fan', 'fork', 'whip', 'barb', 'club', 'spikes', 'rattle', 'leaf']),

    range('osteoderms', 'Armour', 'Plates', 0, 1),
    int('osteoRows', 'Armour', 'Plate rows', 1, 4),
    range('lateralSpines', 'Armour', 'Side spines', 0, 1),

    range('lineWeight', 'Drawing', 'Line weight', 0.4, 2.5),
    range('detail', 'Drawing', 'Detail', 0, 1),
    range('wobble', 'Drawing', 'Wobble', 0, 1),
  ];

  // trait groups that travel together when weirdness borrows from another body plan
  const TRAIT_GROUPS = [
    ['skullShape', 'skullWidth', 'snout'], ['orbitSize', 'orbitPos', 'fenestrae'], ['teeth', 'jaw'], ['casque'],
    ['horns', 'hornLength', 'hornCurve'], ['frill'],
    ['ribs', 'ribLength', 'ribSweep', 'ribCurve', 'ribSpan'], ['gastralia'], ['pinBones'],
    ['frontLimb'], ['hindLimb'], ['digits', 'digitLength', 'phalanges', 'digitSpread', 'claws'], ['membrane'],
    ['limbLength', 'limbThickness', 'hindScale', 'limbPose'],
    ['disc', 'discFront', 'discRound', 'rays', 'rayJoints', 'rayStyle', 'rayFork', 'gillArches'], ['cephalic'], ['finSize', 'finRays'],
    ['tailEnd'], ['tailLength', 'tailVerts', 'tailTaper'], ['tailCurl'], ['neckLength', 'neckVerts', 'cervicalRibs'],
    ['transverse', 'transverseSweep'], ['osteoderms', 'osteoRows'], ['lateralSpines'], ['spineWave'],
  ];

  function base(r) {
    return {
      skullLength: r.range(0.22, 0.32), neckLength: r.range(0.1, 0.22), tailLength: r.range(0.6, 1.2), bodyWidth: r.range(0.22, 0.32),
      spineWave: 0, tailCurl: 0,
      trunkVerts: r.int(14, 22), neckVerts: r.int(4, 7), tailVerts: r.int(20, 40), vertWidth: r.range(0.85, 1.2),
      transverse: r.range(0.5, 1), transverseSweep: r.range(-0.2, 0.4), tailTaper: r.range(0.12, 0.3),
      skullShape: 'wedge', skullWidth: r.range(0.6, 0.85), snout: r.range(0.3, 0.5), orbitSize: r.range(0.45, 0.7), orbitPos: r.range(0.35, 0.6),
      fenestrae: r.int(0, 2), teeth: r.range(0, 0.6), jaw: r.range(0.2, 0.6), casque: 0,
      horns: 'none', hornLength: r.range(0.4, 0.8), hornCurve: r.range(-0.5, 0.5), frill: 0,
      ribs: 'free', ribLength: r.range(0.85, 1.1), ribSweep: r.range(0.3, 0.6), ribCurve: r.range(0.3, 0.6), ribSpan: r.range(0.75, 0.95),
      gastralia: false, pinBones: 0, cervicalRibs: false,
      frontLimb: 'sprawl', hindLimb: 'sprawl', extraPairs: 0, extraLimb: 'sprawl', limbLength: r.range(0.75, 1), hindScale: r.range(0.95, 1.2),
      limbThickness: r.range(0.85, 1.15), frontPos: r.range(0.04, 0.12), limbPose: r.range(-0.3, 0.3),
      digits: 5, digitLength: r.range(0.85, 1.15), phalanges: r.int(2, 4), digitSpread: r.range(0.6, 1), claws: true, membrane: false,
      disc: 0, discFront: r.range(0.3, 0.8), discRound: r.range(0.3, 0.7), rays: r.int(60, 110), rayJoints: r.int(3, 5),
      rayStyle: r.weighted({ beaded: 3, line: 1, double: 2 }), rayFork: r.range(0.3, 0.8), cephalic: 0, gillArches: 0,
      finSize: r.range(0.8, 1.2), finRays: r.int(10, 18),
      tailEnd: 'point',
      osteoderms: 0, osteoRows: r.int(1, 3), lateralSpines: 0,
      lineWeight: 1, detail: r.range(0.45, 0.8), wobble: r.range(0.1, 0.3),
    };
  }

  const ARCHETYPES = {
    humanoid: (r) => ({
      skullLength: r.range(0.4, 0.5), neckLength: r.range(0.16, 0.24), neckVerts: 7, tailLength: r.range(0.05, 0.09), tailVerts: 4, tailTaper: r.range(0.3, 0.5),
      bodyWidth: r.range(0.3, 0.36), trunkVerts: 17, vertWidth: r.range(0.85, 1.05), transverse: r.range(0.5, 0.8), transverseSweep: r.range(-0.1, 0.2),
      skullShape: 'smiler', skullWidth: r.range(0.86, 0.98), snout: 0, orbitSize: r.range(0.55, 0.85), teeth: r.range(0.5, 0.95), jaw: r.range(0.35, 0.65), fenestrae: 0,
      ribs: 'cage', ribLength: r.range(1.05, 1.2), ribSweep: r.range(0.85, 1), ribCurve: r.range(0.35, 0.6), ribSpan: r.range(0.58, 0.66),
      frontLimb: 'arm', hindLimb: 'leg', limbLength: r.range(1.5, 1.75), hindScale: r.range(1.15, 1.35), limbThickness: r.range(0.8, 1), frontPos: r.range(0.02, 0.05),
      limbPose: r.range(-0.15, 0.15), digits: 5, phalanges: r.int(2, 3), digitLength: r.range(0.65, 0.85), digitSpread: r.range(0.4, 0.6), claws: false,
      tailEnd: 'point',
    }),
    ray: (r, wild) => ({
      skullLength: r.range(0.17, 0.25), neckLength: 0, tailLength: r.range(1.1, 2.6), bodyWidth: r.range(0.26, 0.36),
      trunkVerts: r.int(26, 40), tailVerts: r.int(80, 140), vertWidth: r.range(0.55, 0.8), transverse: r.range(0.2, 0.5), tailTaper: r.range(0.06, 0.18),
      skullShape: 'disc', skullWidth: r.range(1.9, 2.6), snout: r.range(0.05, 0.25), orbitSize: r.range(0.35, 0.6), orbitPos: r.range(0.5, 0.8),
      fenestrae: 0, teeth: 0, jaw: 0,
      ribs: r.weighted({ none: 2, short: 1 }), ribLength: r.range(0.15, 0.3), ribSweep: r.range(0.5, 0.8),
      frontLimb: 'none', hindLimb: 'fin', finSize: r.range(0.6, 0.95), finRays: r.int(9, 15),
      disc: r.range(0.95, 1.5), gillArches: r.int(4, 6), rays: wild ? r.int(70, 130) : r.int(85, 150), rayStyle: r.weighted({ double: 3, beaded: 2, line: 1 }),
      cephalic: r.chance(0.15) ? r.range(0.5, 1) : 0,
      tailEnd: r.weighted({ whip: 3, barb: 3, fan: 1, leaf: 1 }),
      osteoderms: r.chance(0.2) ? r.range(0.2, 0.6) : 0, osteoRows: 1,
    }),
    fish: (r) => ({
      skullLength: r.range(0.3, 0.45), neckLength: 0, tailLength: r.range(0.5, 0.9), bodyWidth: r.range(0.14, 0.24),
      trunkVerts: r.int(14, 24), tailVerts: r.int(16, 28), vertWidth: r.range(0.7, 1), transverse: r.range(0.1, 0.4), tailTaper: r.range(0.35, 0.6),
      skullShape: r.weighted({ fish: 4, long: 1, wedge: 1 }), skullWidth: r.range(0.5, 0.8), snout: r.range(0.15, 0.45), orbitSize: r.range(0.6, 0.9),
      fenestrae: 0, teeth: r.range(0, 0.7), jaw: r.range(0.3, 0.8),
      ribs: 'short', ribLength: r.range(0.8, 1.2), ribSweep: r.range(0.65, 0.9), ribCurve: r.range(0.1, 0.4), ribSpan: r.range(0.85, 1),
      pinBones: r.range(0.5, 1),
      frontLimb: 'fin', hindLimb: r.weighted({ fin: 4, none: 1 }), frontPos: 0, finSize: r.range(0.8, 1.5), finRays: r.int(12, 22),
      tailEnd: r.weighted({ fork: 3, fan: 2 }),
    }),
    serpent: (r) => ({
      skullLength: r.range(0.05, 0.08), neckLength: 0, tailLength: r.range(0.12, 0.3), bodyWidth: r.range(0.04, 0.07), spineWave: r.range(0.55, 1),
      trunkVerts: r.int(100, 180), tailVerts: r.int(30, 60), vertWidth: r.range(0.45, 0.65), transverse: r.range(0.25, 0.6), tailTaper: r.range(0.1, 0.3),
      skullShape: r.weighted({ wedge: 4, round: 1, long: 1 }), skullWidth: r.range(0.5, 0.75), snout: r.range(0.25, 0.5), orbitSize: r.range(0.4, 0.7),
      fenestrae: r.int(0, 1), teeth: r.range(0.4, 1), jaw: r.range(0.4, 0.9),
      ribs: 'free', ribLength: r.range(0.9, 1.3), ribSweep: r.range(0.45, 0.8), ribCurve: r.range(0.4, 0.8), ribSpan: 1,
      frontLimb: 'none', hindLimb: r.chance(0.25) ? 'stub' : 'none', frontPos: 0, limbLength: r.range(0.3, 0.6),
      tailEnd: r.weighted({ point: 5, rattle: 1 }),
    }),
    lizard: (r) => {
      const cham = r.chance(0.25);
      return {
        skullLength: r.range(0.22, 0.3), neckLength: r.range(0.1, 0.18), tailLength: r.range(1, 2), bodyWidth: r.range(0.2, 0.28),
        trunkVerts: r.int(18, 26), tailVerts: r.int(36, 60), tailCurl: cham ? r.range(0.6, 1) : r.chance(0.2) ? r.range(0.1, 0.3) : 0,
        skullShape: 'wedge', snout: r.range(0.3, 0.55), fenestrae: r.int(1, 2), teeth: r.range(0.2, 0.6),
        casque: cham ? r.range(0.4, 0.9) : 0,
        horns: r.weighted({ none: 6, crown: 1, brow: 1, pair: 1 }),
        ribs: 'free', ribLength: r.range(0.9, 1.25), gastralia: r.chance(0.4),
        frontLimb: 'sprawl', hindLimb: 'sprawl', limbLength: r.range(0.75, 1.05), digits: 5, phalanges: r.int(3, 4),
        osteoderms: r.chance(0.3) ? r.range(0.3, 0.8) : 0, lateralSpines: r.chance(0.15) ? r.range(0.3, 0.7) : 0,
      };
    },
    turtle: (r) => ({
      skullLength: r.range(0.2, 0.28), neckLength: r.range(0.3, 0.55), neckVerts: 8, tailLength: r.range(0.2, 0.4), tailVerts: r.int(10, 16), bodyWidth: r.range(0.45, 0.6),
      trunkVerts: r.int(9, 11), vertWidth: r.range(1, 1.3), transverse: r.range(0.2, 0.5),
      skullShape: r.weighted({ broad: 2, round: 1, wedge: 1 }), skullWidth: r.range(0.7, 0.95), snout: r.range(0.1, 0.3), teeth: 0, jaw: r.range(0.4, 0.9), fenestrae: r.int(0, 1),
      ribs: 'carapace', ribLength: r.range(0.9, 1.1),
      frontLimb: r.weighted({ flipper: 1, sprawl: 1 }), hindLimb: r.weighted({ flipper: 1, sprawl: 2 }), frontPos: r.range(0.08, 0.16), limbLength: r.range(0.8, 1.2),
      phalanges: r.int(3, 5), digits: 5, digitSpread: r.range(0.4, 0.8),
    }),
    bat: (r) => ({
      skullLength: r.range(0.24, 0.32), neckLength: r.range(0.08, 0.14), tailLength: r.range(0.3, 0.9), tailVerts: r.int(8, 14), bodyWidth: r.range(0.24, 0.32),
      trunkVerts: r.int(13, 16), vertWidth: r.range(0.75, 1), tailTaper: r.range(0.15, 0.3),
      skullShape: 'round', skullWidth: r.range(0.6, 0.8), snout: r.range(0.2, 0.4), orbitSize: r.range(0.4, 0.7), fenestrae: 0, teeth: r.range(0.3, 0.7),
      ribs: 'cage', ribLength: r.range(0.9, 1.15), ribSpan: r.range(0.7, 0.85),
      frontLimb: 'wing', hindLimb: 'sprawl', limbLength: r.range(1.3, 1.8), hindScale: r.range(0.35, 0.55), frontPos: r.range(0.02, 0.1),
      digits: 5, digitLength: r.range(1, 1.4), phalanges: r.int(2, 3), digitSpread: r.range(0.8, 1.2), membrane: true,
    }),
    mammal: (r) => ({
      skullLength: r.range(0.3, 0.4), neckLength: r.range(0.25, 0.38), neckVerts: 7, tailLength: r.range(0.3, 1.2), tailVerts: r.int(12, 28), bodyWidth: r.range(0.24, 0.34),
      trunkVerts: r.int(19, 22), vertWidth: r.range(0.9, 1.3), transverse: r.range(0.6, 1.1),
      skullShape: 'round', skullWidth: r.range(0.55, 0.75), snout: r.range(0.4, 0.65), fenestrae: 0, teeth: r.range(0.3, 0.8), jaw: r.range(0.1, 0.4),
      horns: r.weighted({ none: 8, pair: 1, antlers: 1 }),
      ribs: 'cage', ribLength: r.range(0.95, 1.2), ribSpan: r.range(0.6, 0.75),
      frontLimb: 'upright', hindLimb: 'upright', limbLength: r.range(1, 1.35), digits: r.int(4, 5), phalanges: 3, claws: r.chance(0.7),
    }),
    frog: (r) => ({
      skullLength: r.range(0.32, 0.42), neckLength: 0, tailLength: r.range(0.3, 0.45), tailVerts: r.int(2, 3), bodyWidth: r.range(0.22, 0.3),
      trunkVerts: r.int(7, 9), vertWidth: r.range(0.9, 1.3), transverse: r.range(1.4, 2.3), transverseSweep: r.range(-0.3, 0.2), tailTaper: r.range(0.4, 0.7),
      skullShape: 'broad', skullWidth: r.range(1.15, 1.5), snout: r.range(0.05, 0.25), orbitSize: r.range(0.75, 0.95), orbitPos: r.range(0.5, 0.8), fenestrae: 0, teeth: 0, jaw: r.range(0.3, 0.6),
      ribs: 'none',
      frontLimb: 'sprawl', hindLimb: 'sprawl', limbLength: r.range(0.75, 1), hindScale: r.range(1.7, 2.4), frontPos: 0.02, digits: r.int(4, 5), phalanges: r.int(2, 4),
      digitLength: r.range(1.1, 1.6), claws: false, limbPose: r.range(0, 0.5),
    }),
    plesio: (r) => ({
      skullLength: r.range(0.12, 0.2), neckLength: r.range(0.9, 1.5), neckVerts: r.int(26, 40), tailLength: r.range(0.4, 0.65), tailVerts: r.int(22, 32), bodyWidth: r.range(0.28, 0.38),
      trunkVerts: r.int(18, 22), cervicalRibs: true, spineWave: r.chance(0.4) ? r.range(0.1, 0.25) : 0,
      skullShape: r.weighted({ long: 2, wedge: 1 }), snout: r.range(0.4, 0.7), teeth: r.range(0.7, 1), jaw: r.range(0.3, 0.6), fenestrae: r.int(1, 2),
      ribs: 'free', ribLength: r.range(0.9, 1.2), gastralia: true,
      frontLimb: 'flipper', hindLimb: 'flipper', limbLength: r.range(1.2, 1.6), hindScale: r.range(0.85, 1.1), frontPos: r.range(0.08, 0.16),
      digits: 5, phalanges: r.int(5, 8), digitLength: r.range(1, 1.4), digitSpread: r.range(0.2, 0.45), claws: false,
    }),
  };

  // features weirdness can bolt on, each about as likely as p at full weirdness
  const ADDONS = [
    { p: 0.35, fn: (P, r) => { P.extraPairs = r.int(1, 3); P.extraLimb = r.pick(LIMBS_BASE.slice(1)); } },
    { p: 0.4, fn: (P, r) => { P.horns = r.pick(['pair', 'brow', 'nasal', 'crown', 'antlers']); P.hornLength = r.range(0.7, 1.8); P.hornCurve = r.range(-1, 1); } },
    { p: 0.25, fn: (P, r) => { P.frill = r.range(0.4, 1); } },
    { p: 0.3, fn: (P, r) => { P.disc = r.range(0.6, 1.6); P.rays = r.int(50, 130); } },
    { p: 0.2, fn: (P, r) => { P.cephalic = r.range(0.5, 1); } },
    { p: 0.3, fn: (P, r) => { P.frontLimb = r.pick(['tentacle', 'wing', 'flipper', 'fin']); } },
    { p: 0.3, fn: (P, r) => { P.hindLimb = r.pick(['tentacle', 'wing', 'flipper', 'fin', 'upright']); } },
    { p: 0.35, fn: (P, r) => { P.osteoderms = r.range(0.5, 1); P.osteoRows = r.int(1, 4); } },
    { p: 0.3, fn: (P, r) => { P.lateralSpines = r.range(0.4, 1); } },
    { p: 0.4, fn: (P, r) => { P.tailEnd = r.pick(['barb', 'club', 'spikes', 'fan', 'fork', 'rattle', 'leaf']); } },
    { p: 0.25, fn: (P, r) => { P.neckLength = r.range(0.8, 1.6); P.neckVerts = r.int(14, 40); } },
    { p: 0.2, fn: (P, r) => { P.casque = r.range(0.5, 1); } },
    { p: 0.25, fn: (P, r) => { P.digits = r.int(6, 8); P.phalanges = r.int(4, 8); } },
    { p: 0.2, fn: (P, r) => { P.membrane = true; } },
    { p: 0.25, fn: (P, r) => { P.tailCurl = r.range(0.5, 1); P.tailLength = Math.max(P.tailLength, r.range(1, 2.5)); } },
    { p: 0.2, fn: (P, r) => { P.gastralia = true; P.pinBones = r.range(0.4, 1); } },
    { p: 0.2, fn: (P, r) => { P.transverse = r.range(1.5, 2.4); P.transverseSweep = r.range(-1, 1); } },
    { p: 0.2, fn: (P, r) => { P.skullShape = r.pick(['hammer', 'long', 'disc']); } },
  ];
  // with the toggle on, the smiler spreads: its skull, arms and legs can turn up on anything
  const INFECTION = [
    { p: 0.45, fn: (P, r) => { P.skullShape = 'smiler'; P.skullWidth = r.range(0.85, 1); P.snout = 0; P.orbitSize = r.range(0.5, 0.9); } },
    { p: 0.3, fn: (P) => { P.frontLimb = 'arm'; } },
    { p: 0.3, fn: (P, r) => { P.hindLimb = 'leg'; P.hindScale = r.range(1, 1.6); } },
    { p: 0.15, fn: (P, r) => { P.extraLimb = 'arm'; P.extraPairs = r.int(1, 2); } },
  ];
  for (const k of ['hornLength', 'limbLength', 'digitLength', 'tailLength', 'neckLength', 'disc', 'transverse', 'ribLength', 'finSize', 'lateralSpines', 'osteoderms', 'frill']) {
    SCHEMA.find((s) => s.key === k).bias = 0.85;
  }
  // structure counts stay sane under weirdness
  for (const k of ['trunkVerts', 'neckVerts', 'tailVerts', 'rays', 'rayJoints', 'lineWeight', 'wobble', 'detail', 'skullLength', 'bodyWidth']) SCHEMA.find((s) => s.key === k).noMutate = true;

  const sanitize = (P) => BD.species.sanitize(SCHEMA, P);
  const sampleArchFor = (wild) => (arch, r) => Object.assign(base(r), ARCHETYPES[arch](r, wild), { archetype: arch });

  // Wild mode keeps the first, unruly build: bodies may curve under a disc or a shell and
  // tear it into shards, armour plates scale with the bones they sit on, fin rays fork once.
  function sample(seed, overrides = {}, weirdness = 0.15, opts = {}) {
    const sampleArch = sampleArchFor(!!opts.wild);
    const human = !!opts.humanoid;
    const pool = human ? ARCH : ARCH_BASE;
    const weights = human ? Object.assign({}, ARCH_WEIGHTS, { humanoid: HUMAN_WEIGHT }) : ARCH_WEIGHTS;
    const root = new BD.Rng(seed);
    const r = root.fork('params');
    const arch = pool.includes(overrides.archetype) ? overrides.archetype : r.weighted(weights);
    const P = sampleArch(arch, r);
    BD.species.mutate({
      P, schema: SCHEMA, groups: TRAIT_GROUPS, sampleArch, others: pool.filter((a) => a !== arch),
      w: weirdness, rng: root.fork('mutate'), addons: human ? ADDONS.concat(INFECTION) : ADDONS,
    });
    for (const k in overrides) if (k !== 'archetype' && overrides[k] !== undefined) P[k] = overrides[k];
    return sanitize(P);
  }

  // ================================================================ building
  // depth layers (higher is drawn on top)
  const Z = { membrane: 0.2, ray: 0.5, gill: 1, gastralia: 1.2, pin: 1.5, rib: 2, digit: 3, carpal: 3.1, zeugo: 3.15, stylo: 3.2, girdle: 3.5, frame: 3.6, spine: 4, frill: 4.6, jaw: 4.85, teeth: 4.9, skull: 5, horn: 5.2, plate: 6, shell: 6.2 };

  // interpolate a profile [[t, v], …] (t ascending) with smooth steps between knots
  function profileAt(prof, t) {
    if (t <= prof[0][0]) return prof[0][1];
    for (let i = 0; i < prof.length - 1; i++) {
      const a = prof[i], b = prof[i + 1];
      if (t <= b[0]) return lerp(a[1], b[1], smoothstep(0, 1, (t - a[0]) / Math.max(1e-6, b[0] - a[0])));
    }
    return prof[prof.length - 1][1];
  }

  // skull half-width profiles, t from the back of the skull (0) to the snout tip (1).
  // t <= 0.55 is braincase, the rest is stretched or squeezed by the Snout setting.
  const SKULLS = {
    wedge: [[0, 0.8], [0.1, 1], [0.3, 0.92], [0.55, 0.7], [0.8, 0.42], [1, 0.16]],
    round: [[0, 0.5], [0.14, 0.9], [0.32, 1], [0.5, 0.8], [0.6, 0.5], [0.8, 0.38], [1, 0.22]],
    broad: [[0, 0.78], [0.18, 1], [0.55, 0.98], [0.82, 0.82], [1, 0.42]],
    long: [[0, 0.75], [0.15, 1], [0.35, 0.8], [0.52, 0.4], [0.7, 0.2], [1, 0.12]],
    hammer: [[0, 0.6], [0.25, 0.62], [0.5, 0.42], [0.62, 0.42], [0.7, 1.8], [0.8, 1.85], [0.86, 0.5], [1, 0.3]],
    disc: [[0, 0.72], [0.2, 0.88], [0.5, 1], [0.82, 0.92], [1, 0.6]],
    fish: [[0, 1], [0.3, 0.95], [0.55, 0.75], [0.8, 0.45], [1, 0.24]],
    smiler: [[0, 0.3], [0.1, 0.6], [0.2, 0.8], [0.35, 0.95], [0.5, 1], [0.65, 0.95], [0.8, 0.8], [0.9, 0.6], [1, 0.3]],
  };

  function build(P, seed, opts = {}) {
    const rig = new BD.Rig();
    const R = new BD.Rng(seed).fork('build');
    const c = { P, rig, R, rd: [], verts: [], detail: P.detail, wild: !!opts.wild };
    // webs: membranes between bones, as [bone, rest point] lists, filled in by the post looks
    c.meta = rig.meta = { arch: P.archetype, disc: P.disc > 0.05, cephalic: P.disc > 0.05 && P.cephalic > 0.05, limbs: [], webs: [] };
    const Ls = P.skullLength * T;
    c.Ls = Ls;
    // the skull is the root: rest joint at the back of the skull, pointing forward (up)
    c.skull = rig.bone({ h: [0, 0], a: -PI / 2, len: Ls, role: 'skull', lim: [-20, 20] });

    buildSpine(c);
    buildSkull(c);                 // midline outline, holes, jaw, frill, nasal horn
    buildMidline(c);               // girdle bars, tail barb/club/rattle
    const m = rig.mark();          // everything after this is the right side, mirrored at the end
    buildSkullSides(c);
    buildRibs(c);
    buildArmour(c);
    buildLimbs(c);
    if (P.disc > 0.05) buildDisc(c);
    buildTailSides(c);
    const map = rig.mirror(m);
    for (const k in map) if (c.rd[k]) c.rd[map[k]] = -c.rd[k];
    c.meta.webs = c.meta.webs.concat(c.meta.webs.map((w) => w.map(([id, p]) => [id in map ? map[id] : id, [-p[0], p[1]]])));

    const noise = new BD.Noise(new BD.Rng(seed).fork('wobble'));
    rig.finalize({ restDelta: c.rd, wobble: P.wobble * 0.18, noise });
    return { rig, marks: c.marks || {} };
  }

  // ---------------------------------------------------------------- spine
  function buildSpine(c) {
    const { P, rig } = c;
    const nN = P.neckLength > 0.02 ? P.neckVerts : 0;
    const neckL = nN ? P.neckLength * T : 0;
    const nT = P.trunkVerts, nC = P.tailLength > 0.02 ? P.tailVerts : 0, tailL = nC ? P.tailLength * T : 0;
    const vw = P.vertWidth * 2.8;
    c.vw = vw;
    // tail vertebrae get shorter towards the tip
    const tq = [];
    let tqs = 0;
    for (let i = 0; i < nC; i++) { const q = 1 - 0.55 * (i / Math.max(1, nC)); tq.push(q); tqs += q; }
    const segs = [];
    for (let i = 0; i < nN; i++) segs.push({ region: 'neck', i, l: neckL / nN, w: vw * 0.82, tp: vw * P.transverse * 0.45 });
    for (let i = 0; i < nT; i++) {
      const t = i / Math.max(1, nT - 1);
      segs.push({ region: 'trunk', i, t, l: T / nT, w: vw * (1 + 0.08 * sin(PI * t)), tp: vw * P.transverse * (0.8 + 0.5 * sin(PI * min(1, t * 1.2))) });
    }
    for (let i = 0; i < nC; i++) {
      const t = i / Math.max(1, nC - 1);
      const w = vw * lerp(0.92, P.tailTaper, pow(t, 0.75));
      segs.push({ region: 'tail', i, t, l: (tailL * tq[i]) / tqs, w, tp: vw * P.transverse * 1.1 * max(0, 1 - t / 0.45) });
    }
    let y = 0, parent = c.skull;
    const n = segs.length, lim = { neck: [-16, 16], trunk: P.ribs === 'carapace' ? [0, 0] : P.archetype === 'serpent' ? [-14, 14] : [-6, 6], tail: [-20, 20] };
    segs.forEach((s, k) => {
      // the trunk swells towards the middle and slims towards shoulders and hips
      const flesh = s.region === 'trunk' ? (P.disc > 0.05 ? discFrameW(c) * 0.95 : max(s.w * 1.5, P.bodyWidth * T * 0.75 * (0.62 + 0.38 * sin(PI * clamp(s.t * 1.1 - 0.02, 0, 1))))) : s.region === 'neck' ? s.w * 2.3 + 0.8 : s.w * 2.6 + s.tp * 0.4;
      const id = rig.bone({ parent, h: [0, y], a: PI / 2, len: s.l, role: s.region, chain: 'spine', k, n, lim: lim[s.region], flesh });
      const v = PT.vertebra([0, y], PI / 2, s.l, s.w, { tp: s.tp, sweep: P.transverseSweep, zyg: s.region === 'tail' ? 0.12 : 0.18, spineLen: s.region === 'neck' ? 0.6 : 0.45 });
      rig.add(id, v.poly, { fill: true, z: Z.spine });
      if (c.detail > 0.25) for (const d of v.det) rig.add(id, d, { z: Z.spine, kind: 'line' });
      c.verts.push({ id, y, l: s.l, w: s.w, tp: s.tp, region: s.region, i: s.i, t: s.t, tip: v.tip });
      y += s.l;
      parent = id;
    });
    c.trunk = c.verts.filter((v) => v.region === 'trunk');
    c.tail = c.verts.filter((v) => v.region === 'tail');
    c.neck = c.verts.filter((v) => v.region === 'neck');
    c.y0 = neckL;          // top of the trunk
    c.y1 = neckL + T;      // hips
    c.yEnd = y;
    c.bodyLen = y + c.Ls;
    // the built-in rest curve: a travelling S for serpents, a spiral for curled tails
    const total = y, A = P.spineWave * 0.85, lam = total / (1.2 + P.spineWave * 1.3);
    const curlSide = c.R.sign();
    // a disc or a shell is one rigid sheet across many vertebrae, so the trunk under it stays straight
    const rigid = !c.wild && (P.disc > 0.05 || P.ribs === 'carapace');
    const env = (s) => smoothstep(0, 0.12 * total, s) * (rigid ? smoothstep(c.y1, c.y1 + 0.15 * max(1, tailL), s) : 1);
    const heading = (s) => {
      let h = A * sin((2 * PI * s) / lam) * env(s);
      if (tailL > 0 && s > c.y1) h += curlSide * P.tailCurl * 9 * pow((s - c.y1) / tailL, 2.6);
      return h;
    };
    let prev = 0;
    for (const v of c.verts) {
      const h = heading(v.y);
      c.rd[v.id] = h - prev;
      prev = h;
    }
  }
  const vertAt = (c, y) => {
    let best = c.verts[0];
    for (const v of c.verts) if (v.y <= y + 1e-6) best = v;
    return best;
  };
  const trunkAt = (c, t) => c.trunk[clamp(round(t * (c.trunk.length - 1)), 0, c.trunk.length - 1)];

  // ---------------------------------------------------------------- skull
  function skullGeom(c) {
    if (c.sk) return c.sk;
    const { P } = c;
    const r = c.R.fork('skull');
    const Ls = c.Ls, W = P.skullWidth * Ls * 0.5;
    const smiler = P.skullShape === 'smiler';
    const sf = smiler ? 0 : lerp(0.22, 0.7, P.snout);
    const prof = smiler ? SKULLS.smiler : SKULLS[P.skullShape].map(([t, w]) => [t <= 0.55 ? (t * (1 - sf)) / 0.55 : 1 - sf + ((t - 0.55) / 0.45) * sf, w * r.range(0.93, 1.07)]);
    const wAt = (t) => profileAt(prof, t) * W;
    const at = (t, v) => [v, -t * Ls];
    c.sk = { Ls, W, sf, wAt, at, r };
    return c.sk;
  }

  function buildSkull(c) {
    const { P, rig } = c;
    const { Ls, W, sf, wAt, at } = skullGeom(c);
    const r = c.R.fork('skull2');
    const sb = c.skull;
    if (P.skullShape === 'smiler') buildSmiler(c);
    else {
      // outline: back edge (overlapping the first vertebra a little), sides, snout tip
      const back = P.casque > 0.02 ? P.casque * 0.75 * Ls : 0.05 * Ls;
      const half = [[0, back]];
      if (P.casque > 0.02) half.push([wAt(0) * 0.45, back * 0.45]);
      const N = P.skullShape === 'hammer' ? 44 : 26;
      for (let i = 0; i <= N; i++) { const t = (i / N) * 0.985; half.push(at(t, wAt(t))); }
      half.push([wAt(1) * 0.55, -Ls * 1.0], [0, -Ls - wAt(1) * 0.25]);
      const outline = G.chaikin(G.symmetricOutline(half), 2, true);

      // holes: eye sockets, windows behind them, nostrils, a fontanelle on disc skulls
      const holes = [];
      const pair = (pts) => { holes.push(pts, G.mirrorX(pts).reverse()); };
      let to = (1 - sf) * lerp(0.6, 1.08, P.orbitPos);
      if (P.skullShape === 'hammer') to = 1 - sf + sf * 0.2 + 0.03;
      to = clamp(to, 0.15, 0.88);
      const wo = wAt(to);
      // grow the socket as asked, then shrink it until it sits inside the outline with a rim of bone
      const fits = (pts, rim) => pts.every((p) => p[0] > 0.05 * W && G.pointInPoly(p, outline) && G.distToPoly(p, outline) > rim);
      const fitHole = (cx, t, rx, ry, rot0, rough, rim) => {
        for (let k = 0; k < 24 && rx > 0.04 * W; k++) {
          const pts = PT.blob(at(t, cx), rx, ry, rot0, r, rough, 18);
          if (fits(pts, rim)) return pts;
          rx *= 0.9; ry *= 0.9;
        }
        return null;
      };
      const ocx = P.skullShape === 'hammer' ? wo * 0.85 : wo * lerp(0.5, 0.56, P.orbitSize);
      let orx = P.orbitSize * 0.48 * wo, ory = min(orx * r.range(1.05, 1.3), Ls * 0.24);
      if (P.skullShape === 'hammer') { orx = min(wo * 0.12, Ls * 0.06); ory = orx; }
      c.orbit = null;
      if (P.orbitSize > 0.04) {
        const o = fitHole(ocx, to, orx, ory, 0, 0.06, 0.07 * W);
        if (o) {
          pair(o);
          const bb = G.bbox(o);
          c.orbit = { t: to, x: ocx, rx: (bb[2] - bb[0]) / 2, ry: (bb[3] - bb[1]) / 2 };
        }
      }
      for (let j = 0; j < P.fenestrae; j++) {
        const tf = to - (c.orbit ? c.orbit.ry / Ls : 0.05) - 0.07 - j * 0.13 * (1 - sf);
        if (tf < 0.07) break;
        const wf = wAt(tf), rx = min(wf * 0.26, (c.orbit ? c.orbit.rx : wf * 0.3) * 0.8), ry = Ls * r.range(0.04, 0.06);
        const fe = fitHole(wf * 0.52, tf, rx, ry, r.range(-0.3, 0.3), 0.2, 0.05 * W);
        if (!fe) break;
        pair(fe);
      }
      if (sf > 0.3 && P.skullShape !== 'disc') {
        const tn = 0.93, wn = wAt(tn);
        const na = fitHole(wn * 0.42, tn, wn * 0.22, Ls * 0.025, 0.2, 0.1, 0.02 * W);
        if (na) pair(na);
      }
      if (P.skullShape === 'disc') holes.push(PT.blob(at(0.42, 0), W * 0.32, Ls * 0.24, 0, r, 0.08, 20));
      rig.add(sb, outline, { fill: true, z: Z.skull, holes });
      rig.bones[sb].flesh = W * 0.95;

      // sutures and a shading contour
      if (c.detail > 0.15) {
        const mid = [];
        for (let i = 0; i <= 30; i++) { const t = lerp(0.05, 0.92, i / 30); mid.push(at(t, sin(i * 2.1) * 0.012 * W * (1 + c.detail))); }
        if (P.skullShape !== 'disc') rig.add(sb, mid, { z: Z.skull, kind: 'line' });
        const ts = c.orbit ? c.orbit.t - c.orbit.ry / Ls - 0.04 : 0.45;
        if (ts > 0.1) {
          const arc = [];
          for (let i = 0; i <= 12; i++) { const u = i / 12 - 0.5; arc.push(at(ts - 0.04 * cos(u * PI), u * 2 * wAt(ts) * 0.62)); }
          rig.add(sb, arc, { z: Z.skull, kind: 'line' });
        }
        if (c.detail > 0.4) {
          const sh = [];
          for (let i = 0; i <= 14; i++) { const t = lerp(0.08, 0.7, i / 14); sh.push(at(t, wAt(t) * 0.84)); }
          rig.add(sb, sh, { z: Z.skull, kind: 'shade' });
        }
      }
      // disc skulls: nasal capsules bulging at the front
      if (P.skullShape === 'disc') {
        for (const s of [1, -1]) rig.add(sb, PT.blob(at(0.9, s * W * 0.42), W * 0.36, Ls * 0.16, 0, r, 0.08), { fill: true, z: Z.skull - 0.01 });
      }
      // lower jaw rim showing round the edge
      if (P.jaw > 0.05) {
        const jh = [];
        const jx = 1 + 0.06 * P.jaw;
        for (let i = 0; i <= 20; i++) { const t = lerp(0.04, 0.985, i / 20); jh.push(at(t, wAt(t) * jx + 0.02 * W * P.jaw)); }
        jh.push([wAt(1) * 0.6 * jx, -Ls * (1.0 + 0.04 * P.jaw)], [0, -Ls * (1 + 0.05 * P.jaw) - wAt(1) * 0.3]);
        jh.unshift([wAt(0.04) * 0.7, 0.02 * Ls]);
        rig.add(sb, G.chaikin(G.symmetricOutline(jh), 2, true), { fill: true, z: Z.jaw });
      }
    }
    // frill: a scalloped shield behind the skull, with a window each side
    if (P.frill > 0.05) {
      const Rf = wAt(0) * 0.6 + P.frill * Ls * 1.1, spread = lerp(1.1, 1.55, P.frill), nb = 5 + round(P.frill * 6);
      const pts = [];
      for (let i = 0; i <= 60; i++) {
        const u = i / 60, ang = PI / 2 - spread + u * 2 * spread;
        const bump = 1 + 0.06 * pow(abs(sin(u * PI * nb)), 0.6);
        pts.push(add([0, -0.05 * Ls], mul(dir(ang), Rf * bump * (0.9 + 0.1 * sin(u * PI)))));
      }
      pts.push(at(0.1, -wAt(0.1) * 0.8), at(0.1, wAt(0.1) * 0.8));
      const fh = [];
      const hc = add([0, -0.05 * Ls], mul(dir(PI / 2 - spread * 0.45), Rf * 0.58));
      const hole = PT.blob(hc, Rf * 0.16, Rf * 0.22, -0.4, r, 0.1);
      fh.push(hole, G.mirrorX(hole).reverse());
      rig.add(sb, G.chaikin(pts, 1, true), { fill: true, z: Z.frill, holes: fh });
    }
    // nasal horn sits on the midline
    if (P.horns === 'nasal') {
      const b = at(0.86, 0), len = P.hornLength * Ls * 0.8;
      const id = rig.bone({ parent: sb, h: b, a: -PI / 2, len, role: 'horn' });
      const tip = add(b, mul(dir(-PI / 2 + P.hornCurve * 0.2), len));
      rig.add(id, PT.claw(b, tip, W * 0.2, -0.12 - P.hornCurve * 0.2), { fill: true, z: Z.horn });
    }
  }

  // The smiler: a round skull read straight from Ro's logo. Round eye sockets, and a mouth made of two
  // crossing arcs (upper jaw and lower jaw) with a lens-shaped gap between them, lined with teeth.
  // Proportions are the logo's, in units of the skull radius R.
  function buildSmiler(c) {
    const { P, rig } = c;
    const { Ls, W } = skullGeom(c);
    const r = c.R.fork('smiler');
    const sb = c.skull;
    const R = Ls * 0.5, Rx = R * clamp(P.skullWidth / 0.92, 0.82, 1.15), C = [0, -R];
    const p = (x, y) => [C[0] + x * R, C[1] + y * R];
    // a slightly squared circle, like the logo's ring
    const outline = [];
    const n = 2.35;
    for (let i = 0; i < 80; i++) {
      const t = (i / 80) * 2 * PI, cs = cos(t), sn = sin(t);
      outline.push([C[0] + Rx * Math.sign(cs) * pow(abs(cs), 2 / n), C[1] + R * Math.sign(sn) * pow(abs(sn), 2 / n)]);
    }
    const holes = [];
    const er = lerp(0.11, 0.21, P.orbitSize);
    for (const sx of [-1, 1]) holes.push(G.ellipse(p(sx * 0.33 * (Rx / R), -0.3), er * R, er * R * 1.05, 28));
    c.orbit = { t: (R + 0.3 * R) / Ls, x: 0.33 * Rx, rx: er * R, ry: er * R };
    // the mouth: lens between the arcs
    const ms = lerp(0.88, 1.12, P.jaw), mx = 0.42 * ms, my = 0.285;
    const lensTop = G.quadBezier(p(-mx, my), p(0, -0.077 + (1 - ms) * 0.2), p(mx, my), 16);
    const lensBot = G.quadBezier(p(mx, my), p(0, 0.645 * ms + (1 - ms) * 0.3), p(-mx, my), 16);
    holes.push([...lensTop, ...lensBot.slice(1, -1)]);
    rig.add(sb, outline, { fill: true, z: Z.skull, holes });
    rig.bones[sb].flesh = W * 0.95;
    // the two jaw arcs crossing at the corners of the mouth
    const bw = 0.075 * R * ms, ex = 0.6 * ms;
    const lower = G.quadBezier(p(-ex, 0.05), p(0, 1.03 * ms - (ms - 1) * 0.3), p(ex, 0.05), 24);
    const upper = G.quadBezier(p(-ex, 0.55 * ms), p(0, -0.51 * ms), p(ex, 0.55 * ms), 24);
    for (const arc of [lower, upper]) rig.add(sb, PT.rod(arc, bw, bw, { capStart: false, capEnd: false }), { fill: true, z: Z.skull + 0.05 });
    // teeth along both arcs, pointing into the mouth
    const nt = 3 + round(P.teeth * 9);
    const cumU = G.cumLengths(upper), cumL = G.cumLengths(lower), LU = cumU[cumU.length - 1], LL = cumL[cumL.length - 1];
    for (let i = 0; i < nt; i++) {
      const u = (i + 0.5) / nt;
      for (const [arc, cum, L, dirn] of [[upper, cumU, LU, 1], [lower, cumL, LL, -1]]) {
        const s0 = L * lerp(0.22, 0.78, u);
        const q = G.pointAtLength(arc, cum, s0);
        const fall = 1 - pow(abs(u - 0.5) * 2, 2);
        const len = R * (0.05 + 0.07 * fall) * r.range(0.85, 1.15);
        rig.add(sb, PT.claw(q, add(q, [0, dirn * len]), R * 0.028, 0.05), { fill: true, z: Z.skull + 0.04 });
      }
    }
    // sutures and a little shading
    if (c.detail > 0.15) {
      const sag = [];
      for (let i = 0; i <= 18; i++) { const t = i / 18; sag.push(p(sin(i * 2.3) * 0.012, lerp(-0.98, -0.52, t))); }
      rig.add(sb, sag, { z: Z.skull, kind: 'line' });
      const cor = [];
      for (let i = 0; i <= 20; i++) { const u = i / 20 - 0.5; cor.push(p(u * 1.5 * (Rx / R), -0.62 - 0.22 * cos(u * PI) + sin(i * 2.7) * 0.01)); }
      rig.add(sb, cor, { z: Z.skull, kind: 'line' });
    }
    if (c.detail > 0.4) {
      for (const sx of [-1, 1]) {
        const arc = [];
        for (let i = 0; i <= 12; i++) { const a = lerp(-0.4, 1.0, i / 12); arc.push(p(sx * (Rx / R) * 0.86 * cos(a), 0.86 * sin(a))); }
        rig.add(sb, arc, { z: Z.skull, kind: 'shade' });
      }
    }
  }

  // right-side skull parts: teeth, horns, gill covers
  function buildSkullSides(c) {
    const { P, rig } = c;
    const { Ls, W, sf, wAt, at } = skullGeom(c);
    const r = c.R.fork('skullSides');
    const sb = c.skull;
    if (P.teeth > 0.05 && P.skullShape !== 'smiler') {
      const n = round(P.teeth * (4 + 16 * sf));
      for (let i = 0; i < n; i++) {
        const t = lerp(1 - sf * 0.95, 0.96, (i + 0.5) / n), w = wAt(t);
        const tb = at(t, w * 0.92), sz = (0.025 + 0.035 * P.teeth) * W * r.range(0.8, 1.25);
        const tip = add(tb, rot([sz * 1.6, sz * 0.5], r.range(-0.15, 0.15)));
        rig.add(sb, PT.claw(tb, tip, sz * 0.45, 0.15), { fill: true, z: Z.teeth });
      }
    }
    if (P.skullShape === 'fish') {
      const oc = at(0.12, W * 0.72), rx = W * 0.5, ry = Ls * 0.2;
      rig.add(sb, PT.blob(oc, rx, ry, 0.15, r, 0.05, 18), { fill: true, z: Z.jaw - 0.02 });
      for (let k = 1; k <= 3; k++) {
        const arc = [];
        for (let i = 0; i <= 10; i++) { const u = -0.9 + (1.8 * i) / 10; arc.push(add(add(oc, [-rx * 0.4, 0]), mul([cos(u), sin(u)], rx * (0.35 + k * 0.17)))); }
        rig.add(sb, arc, { z: Z.jaw - 0.02, kind: 'line' });
      }
    }
    const hl = P.hornLength * Ls;
    const horn = (b, a0, len, w, curl, ridges = true) => {
      const id = rig.bone({ parent: sb, h: b, a: a0, len, role: 'horn', side: 1 });
      const center = G.walk(b, (s) => a0 + curl * 1.8 * (s / len), len, len / 14);
      rig.add(id, PT.rod(center, w, w * 0.05, { capEnd: false }), { fill: true, z: Z.horn });
      if (ridges && c.detail > 0.3) {
        const cum = G.cumLengths(center), L = cum[cum.length - 1];
        for (let s = L * 0.12; s < L * 0.8; s += max(L / 9, w * 0.5)) {
          const p = G.pointAtLength(center, cum, s), q = G.pointAtLength(center, cum, s + 0.05);
          const nn = perp(norm(sub(q, p))), ww = lerp(w, w * 0.05, s / L) * 0.85;
          rig.add(id, [add(p, mul(nn, ww)), sub(p, mul(nn, ww))], { z: Z.horn, kind: 'line' });
        }
      }
      return { id, center };
    };
    if (P.horns === 'pair') horn(at(0.07, wAt(0.07) * 0.75), lerp(-0.7, 0.4, (P.hornCurve + 1) / 2), hl, W * 0.15, P.hornCurve * 0.6);
    else if (P.horns === 'brow' && c.orbit) horn(at(c.orbit.t + c.orbit.ry / Ls * 0.6, c.orbit.x + c.orbit.rx * 0.5), -1.1, hl * 0.6, W * 0.1, 0.25 + P.hornCurve * 0.3);
    else if (P.horns === 'crown') {
      const n = 4 + round(P.hornLength * 3);
      for (let i = 0; i < n; i++) {
        const t = lerp(0.0, 0.35, i / Math.max(1, n - 1)), w = wAt(t);
        horn(at(t, w * 0.85), lerp(1.0, 0.1, i / Math.max(1, n - 1)), hl * lerp(0.55, 0.3, i / n), W * 0.08, 0.1, false);
      }
    } else if (P.horns === 'antlers') {
      const main = horn(at(0.12, wAt(0.12) * 0.55), -0.5, hl * 1.3, W * 0.09, 0.5 + P.hornCurve * 0.3, false);
      const cum = G.cumLengths(main.center), L = cum[cum.length - 1];
      const nt = 2 + round(P.hornLength);
      for (let i = 0; i < nt; i++) {
        const s = L * lerp(0.25, 0.85, i / Math.max(1, nt - 1));
        const p = G.pointAtLength(main.center, cum, s), q = G.pointAtLength(main.center, cum, s + 0.1);
        const a0 = angleOf(sub(q, p)) - 0.9;
        const len = hl * r.range(0.3, 0.5);
        const id = rig.bone({ parent: main.id, h: p, a: a0, len, role: 'horn', side: 1 });
        rig.add(id, PT.claw(p, add(p, mul(dir(a0), len)), W * 0.06, -0.15), { fill: true, z: Z.horn - 0.01 });
      }
    }
  }

  // ---------------------------------------------------------------- midline extras
  function buildMidline(c) {
    const { P, rig } = c;
    const r = c.R.fork('mid');
    if (P.ribs === 'cage' && P.frontLimb === 'arm') {
      // breastbone: handle, body and the little xiphoid tip, laid over the spine
      const ribbed = c.trunk.filter((v) => v.t <= P.ribSpan + 1e-6);
      if (ribbed.length > 2) {
        const v0 = ribbed[0], y0 = v0.y, y1 = ribbed[floor(ribbed.length * 0.62)].y, w = c.vw * 1.25;
        const half = [[0, y0 - w * 0.2], [w * 1.25, y0 + w * 0.2], [w * 1.1, y0 + w * 1.4], [w * 0.8, y0 + w * 1.7], [w * 0.95, lerp(y0, y1, 0.55)], [w * 0.75, y1], [w * 0.3, y1 + w * 0.5], [0, y1 + w * 1.6]];
        rig.add(v0.id, G.chaikin(G.symmetricOutline(half), 2, true), { fill: true, z: Z.spine + 0.2 });
        if (c.detail > 0.3) for (let k = 1; k < 4; k++) { const yy = lerp(y0 + w * 1.6, y1, k / 4); rig.add(v0.id, [[-w * 0.8, yy], [w * 0.8, yy]], { z: Z.spine + 0.2, kind: 'line' }); }
      }
    }
    // ray: shoulder bar across the body, pelvic bar at the hips
    if (P.disc > 0.05) {
      const gv = trunkAt(c, 0.3), fw = discFrameW(c);
      c.discGirdle = gv;
      const bar = [];
      for (let i = 0; i <= 16; i++) { const u = i / 16 * 2 - 1; bar.push([u * fw, gv.y - 2.2 * (1 - u * u)]); }
      rig.add(gv.id, PT.rod(bar, T * 0.022, T * 0.022, { wf: (t) => T * (0.016 + 0.012 * pow(abs(t * 2 - 1), 2)) }), { fill: true, z: Z.frame + 0.05 });
      const pv = c.trunk[c.trunk.length - 1], pw = fw * 0.85;
      const pb = [];
      for (let i = 0; i <= 16; i++) { const u = i / 16 * 2 - 1; pb.push([u * pw, pv.y + pv.l * 0.5 + T * 0.035 * (1 - u * u)]); }
      rig.add(pv.id, PT.rod(pb, T * 0.016, T * 0.016), { fill: true, z: Z.frame });
    }
    if (!c.tail.length) return;
    const tl = c.tail;
    if (P.tailEnd === 'barb') {
      const v = tl[min(tl.length - 1, floor(tl.length * r.range(0.18, 0.32)))];
      const len = T * r.range(0.22, 0.36), w = v.w * 1.1 + 0.8;
      const b = [0, v.y + v.l * 0.3];
      const pts = [];
      const nt = 14 + round(len / 2);
      for (let i = 0; i <= nt; i++) {
        const t = i / nt, ww = w * (1 - pow(t, 1.2)) * (i % 2 ? 1.18 : 0.92);
        pts.push([ww, b[1] + t * len]);
      }
      const id = rig.bone({ parent: v.id, h: b, a: PI / 2, len, role: 'horn' });
      rig.add(id, G.symmetricOutline([[0, b[1] - w * 0.4], ...pts.slice(0, -1), [0, b[1] + len]]), { fill: true, z: Z.plate });
      rig.add(id, [[0, b[1] + len * 0.05], [0, b[1] + len * 0.85]], { z: Z.plate, kind: 'line' });
    } else if (P.tailEnd === 'club') {
      const v = tl[tl.length - 1], s = max(T * 0.07, v.w * 4);
      for (const sx of [1, -1]) rig.add(v.id, PT.blob([sx * s * 0.55, v.y + v.l], s * 0.75, s * 0.6, 0, r, 0.18), { fill: true, z: Z.plate });
      rig.add(v.id, PT.blob([0, v.y + v.l + s * 0.35], s * 0.6, s * 0.55, 0, r, 0.15), { fill: true, z: Z.plate + 0.01 });
    } else if (P.tailEnd === 'rattle') {
      const v = tl[tl.length - 1];
      let y = v.y + v.l * 0.6, w = max(1.2, v.w * 2.2);
      const n = r.int(5, 9);
      for (let i = 0; i < n; i++) {
        const h = w * 0.75;
        rig.add(v.id, G.chaikin(G.symmetricOutline([[0, y - h * 0.1], [w * 0.9, y], [w, y + h * 0.5], [w * 0.8, y + h], [0, y + h * 1.05]]), 2, true), { fill: true, z: Z.plate });
        y += h * 0.7; w *= 0.93;
      }
    }
  }

  // ---------------------------------------------------------------- ribs, gastralia, pin bones
  function buildRibs(c) {
    const { P, rig } = c;
    const r = c.R.fork('ribs');
    const BW = P.bodyWidth * T, vw = c.vw;
    const nT = c.trunk.length;
    if (P.cervicalRibs) {
      for (const v of c.neck) {
        const b = [v.w * 0.7 + v.tp * 0.6, v.y + v.l * 0.35];
        const len = v.w * 1.6 + v.l * 0.8;
        const id = rig.bone({ parent: v.id, h: b, a: 1.1, len, role: 'rib', side: 1, lim: [-3, 3], flesh: v.w * 0.6 });
        rig.add(id, PT.claw(b, add(b, mul(dir(1.2), len)), v.w * 0.22, 0.1), { fill: true, z: Z.rib });
      }
    }
    if (P.ribs === 'carapace') return buildCarapace(c);
    if (P.ribs !== 'none') {
      const span = P.ribSpan;
      const ribbed = c.trunk.filter((v) => v.t <= span + 1e-6 && !(P.disc > 0.05 && v.t < 0.35));
      const cage = P.ribs === 'cage', short = P.ribs === 'short';
      ribbed.forEach((v, k) => {
        const t = ribbed.length > 1 ? k / (ribbed.length - 1) : 0.5;
        const prof = 0.35 + 0.65 * pow(sin(PI * min(1, t * 0.95 + 0.1)), 0.7);
        let L = P.ribLength * BW * prof * (cage ? 1.55 : short ? 0.75 : 1.15);
        const b = [v.w * 0.62 + v.tp * 0.75, v.y + v.l * 0.4];
        const a0 = cage ? 0.05 + P.ribSweep * 0.35 : short ? 0.55 + P.ribSweep * 0.7 : 0.1 + P.ribSweep * 0.8;
        const turn = cage ? 1.9 + P.ribCurve * 1.1 : short ? P.ribCurve * 0.4 : P.ribCurve * 1.3;
        let center = G.walk(b, (s) => a0 + turn * pow(s / L, 1.4), L, max(0.3, L / 20));
        if (cage) {
          // hoops curve back towards the breastbone; stop short of the midline
          const keep = [];
          for (const p of center) { if (keep.length > 4 && p[0] < vw * 1.6) break; keep.push(p); }
          center = keep;
          L = G.polyLength(center);
        }
        if (center.length < 2) return;
        const w0 = max(0.18, min(v.w * (short ? 0.16 : 0.24) * (cage ? 1.1 : 1), v.l * 0.3));
        const tipR = center[center.length - 1];
        const id = rig.bone({ parent: v.id, h: b, a: angleOf(sub(tipR, b)), len: dist(b, tipR), role: 'rib', side: 1, chain: 'rib', k, n: ribbed.length, lim: [-4, 4], flesh: w0 * 2.2 + 0.5 });
        // very fine ribs (a snake's hundreds) read better as single strokes than as outlines
        if (w0 < c.bodyLen * 0.0035) rig.add(id, center, { z: Z.rib, kind: 'line', w: 1.3 });
        else rig.add(id, PT.rod(center, w0, w0 * 0.45), { fill: true, z: Z.rib });
        if (c.detail > 0.55 && L > 6) rig.add(id, G.offsetLine(center.slice(1, -1), -w0 * 0.3).slice(1, -2), { z: Z.rib, kind: 'shade' });
      });
    }
    // belly ribs: thin chevrons between the girdles
    if (P.gastralia) {
      const ya = c.y0 + T * (P.frontPos + 0.12), yb = c.y1 - T * 0.1;
      const n = max(4, round((yb - ya) / (T / 15)));
      for (let i = 0; i < n; i++) {
        const y = lerp(ya, yb, i / (n - 1));
        const v = vertAt(c, y), xw = BW * lerp(0.75, 0.95, sin(PI * (i / (n - 1))));
        rig.add(v.id, G.catmullRom([[0, y + T * 0.03], [xw * 0.5, y + T * 0.012], [xw, y - T * 0.005]], 6), { z: Z.gastralia, kind: 'line', w: 1.4 });
      }
    }
    // pin bones (intermuscular bones of fish): fine spines angled back from each vertebra
    if (P.pinBones > 0.03) {
      const src = [...c.trunk, ...c.tail.slice(0, floor(c.tail.length * 0.85))];
      src.forEach((v, k) => {
        const fade = v.region === 'tail' ? 1 - v.t * 0.8 : 1;
        const L = P.pinBones * BW * 0.95 * fade;
        if (L < 1) return;
        for (const off of [0.25, 0.75]) {
          const b = [v.w * 0.75, v.y + v.l * off];
          const a = 0.95 + r.range(-0.08, 0.08);
          rig.add(v.id, G.walk(b, (s) => a + 0.25 * (s / L), L, L / 6), { z: Z.pin, kind: 'line', w: 0.9 });
          const b2 = [v.w * 0.4, v.y + v.l * off];
          if (c.detail > 0.5) rig.add(v.id, G.walk(b2, (s) => a + 0.35 + 0.2 * (s / L), L * 0.55, L / 8), { z: Z.pin, kind: 'line', w: 0.8 });
        }
      });
    }
  }

  // turtle shell: rib plates out to a ring of marginal bones
  function buildCarapace(c) {
    const { P, rig } = c;
    const r = c.R.fork('shell');
    const BW = P.bodyWidth * T * P.ribLength, vw = c.vw;
    const cy = c.y0 + T * 0.5, CL = T * 0.66, CW = BW * 1.05;
    const ring = (t, s) => [CW * s * sin(t), cy - CL * s * cos(t)]; // t: 0 = front, PI = back
    const nP = 10 + r.int(0, 3);
    const bw = 0.13;
    for (let i = 0; i < nP; i++) {
      const t0 = 0.05 + (i / nP) * (PI - 0.1), t1 = 0.05 + ((i + 1) / nP) * (PI - 0.1);
      const pts = [];
      for (let k = 0; k <= 5; k++) pts.push(ring(lerp(t0, t1, k / 5), 1 + bw));
      for (let k = 5; k >= 0; k--) pts.push(ring(lerp(t0, t1, k / 5), 1));
      const mid = ring((t0 + t1) / 2, 1);
      rig.add(vertAt(c, clamp(mid[1], c.y0, c.y1 - 0.01)).id, pts, { fill: true, z: Z.shell });
    }
    // nuchal and pygal plates on the midline (built on the right, mirrored into one piece visually)
    const nu = [ring(0.05, 1), ring(0.05, 1 + bw), [0, cy - CL * (1 + bw) - 1], [0, cy - CL + 1.5]];
    rig.add(c.trunk[0].id, nu, { fill: true, z: Z.shell });
    const py = [ring(PI - 0.05, 1), ring(PI - 0.05, 1 + bw), [0, cy + CL * (1 + bw) + 1], [0, cy + CL - 1.5]];
    rig.add(c.trunk[c.trunk.length - 1].id, py, { fill: true, z: Z.shell });
    // costal ribs: spokes widening into the shell
    const ribbed = c.trunk.slice(1, -1);
    ribbed.forEach((v, k) => {
      const b = [v.w * 0.6, v.y + v.l * 0.5];
      const tt = clamp(Math.acos(clamp((cy - b[1]) / CL, -1, 1)), 0.2, PI - 0.2);
      const e = ring(tt, 1.02);
      const center = G.catmullRom([b, lerp2(b, e, 0.5), e], 6);
      const wv = v.l * 0.32;
      const id = rig.bone({ parent: v.id, h: b, a: angleOf(sub(e, b)), len: dist(b, e), role: 'rib', side: 1, chain: 'rib', k, n: ribbed.length, lim: [0, 0], flesh: wv * 1.4 });
      rig.add(id, PT.rod(center, wv * 0.5, wv * 1.1, { wf: (t) => wv * (0.45 + 0.9 * pow(t, 2)) }), { fill: true, z: Z.rib });
      if (c.detail > 0.4) rig.add(id, center.slice(1, -1), { z: Z.rib, kind: 'shade' });
    });
  }

  // ---------------------------------------------------------------- armour
  function buildArmour(c) {
    const { P, rig } = c;
    const r = c.R.fork('armour');
    if (P.osteoderms > 0.03 && c.wild) {
      // wild: plates sized by the vertebrae they sit on, so long bones carry huge plates
      const src = [...c.trunk, ...c.tail.slice(0, floor(c.tail.length * 0.6))];
      const minL = 2.4;
      let acc = 0, start = null;
      for (const v of src) {
        if (!start) { start = v; acc = 0; }
        acc += v.l;
        if (acc < minL) continue;
        const scale = P.osteoderms * (v.region === 'tail' ? 1 - v.t : 1);
        const ph = acc * 0.48 * (0.6 + 0.4 * P.osteoderms), pw = max(acc * 0.42, start.w * 0.5) * (0.6 + 0.5 * scale);
        for (let row = 0; row < P.osteoRows; row++) {
          const x = start.w * 1.05 + start.tp * 0.2 + (row + 0.5) * pw * 2.15;
          const cpt = [x, start.y + acc * 0.5];
          if (scale < 0.1) continue;
          rig.add(start.id, PT.blob(cpt, pw, ph, 0, r, 0.1, 12), { fill: true, z: Z.plate });
          if (c.detail > 0.3) rig.add(start.id, [[x, cpt[1] - ph * 0.55], [x + pw * 0.1, cpt[1] + ph * 0.55]], { z: Z.plate, kind: 'line' });
        }
        start = null;
      }
    } else if (P.osteoderms > 0.03) {
      const tailEnd = c.tail.length ? c.tail[floor((c.tail.length - 1) * 0.6)] : null;
      const yEnd = tailEnd ? tailEnd.y + tailEnd.l : c.y1;
      const ps = clamp(c.vw * 0.75, 1, 4.5) * (0.6 + 0.5 * P.osteoderms);
      for (let y = c.y0 + ps; y < yEnd - ps * 0.5; y += ps * 2.05) {
        const v = vertAt(c, y);
        const scale = v.region === 'tail' ? 1 - v.t / 0.6 : 1;
        if (scale < 0.15) continue;
        const pw = ps * (0.55 + 0.45 * scale), ph = ps * 0.95 * (0.55 + 0.45 * scale);
        for (let row = 0; row < P.osteoRows; row++) {
          const x = v.w * 1.05 + v.tp * 0.15 + (row + 0.5) * pw * 2.15;
          rig.add(v.id, PT.blob([x, y], pw, ph, 0, r, 0.1, 12), { fill: true, z: Z.plate });
          if (c.detail > 0.3) rig.add(v.id, [[x, y - ph * 0.55], [x + pw * 0.1, y + ph * 0.55]], { z: Z.plate, kind: 'line' });
        }
      }
    }
    if (P.lateralSpines > 0.03) {
      const BW = P.bodyWidth * T;
      const src = c.trunk.length > 30 ? c.trunk.filter((_, i) => i % 3 === 0) : c.trunk.length > 14 ? c.trunk.filter((_, i) => i % 2 === 0) : c.trunk;
      src.forEach((v) => {
        const len = P.lateralSpines * BW * 0.7 * (0.4 + 0.6 * sin(PI * clamp(v.t * 1.1, 0, 1)));
        if (len < 1) return;
        const b = v.tip, a = 0.15 + P.transverseSweep * 0.4;
        rig.add(v.id, PT.claw(b, add(b, mul(dir(a), len)), max(0.5, v.l * 0.3), 0.12), { fill: true, z: Z.spine - 0.05 });
      });
    }
  }

  // ---------------------------------------------------------------- limbs
  function buildLimbs(c) {
    const { P } = c;
    const pairs = [];
    const iF = clamp(P.frontPos, 0, 0.6);
    if (P.frontLimb !== 'none') pairs.push({ type: P.frontLimb, t: iF, front: true, scale: 1 });
    // pelvic fins of fish sit mid-body; everything else hangs from the hips
    const hindT = P.hindLimb === 'fin' && P.disc <= 0.05 ? 0.55 : 1;
    if (P.hindLimb !== 'none') pairs.push({ type: P.hindLimb, t: hindT, front: false, scale: P.hindScale });
    for (let e = 1; e <= P.extraPairs; e++) {
      const t = lerp(iF, 1, e / (P.extraPairs + 1));
      pairs.push({ type: P.extraLimb, t, front: t < 0.5, scale: lerp(1, P.hindScale, t) * 0.85, extra: true });
    }
    // every bone of a limb carries its index, so motion can find the whole limb
    pairs.forEach((pr, i) => {
      const b0 = c.rig.bones.length;
      limb(c, pr, i);
      for (let j = b0; j < c.rig.bones.length; j++) c.rig.bones[j].limb = i;
      c.meta.limbs.push({ idx: i, type: pr.type, front: pr.front, t: pr.t, extra: !!pr.extra });
    });
  }

  function limb(c, pr, idx) {
    const { P, rig } = c;
    const r = c.R.fork('limb' + idx);
    const v = trunkAt(c, pr.t);
    const BW = P.bodyWidth * T, vw = c.vw;
    const front = pr.front;
    const disc = P.disc > 0.05;
    const fw = disc ? discFrameW(c) : 0;
    let gx = vw + BW * (front ? 0.55 : 0.45) * (P.ribs === 'carapace' ? 0.8 : 1);
    if (pr.type === 'arm') gx = vw + BW * 1.1;
    else if (pr.type === 'leg') gx = vw + BW * 0.62;
    if (disc) gx = max(gx, (front ? fw : fw * 0.85) * 1.02);
    const y = v.y + (front ? v.l * 0.4 : v.l * 0.6);
    const S = [gx, y];
    const L = P.limbLength * T * 0.45 * pr.scale;
    const th = max(0.35, L * 0.034 * P.limbThickness);
    const type = pr.type;
    c.curLimb = { S };
    const gid = c.curLimb.gid = rig.bone({ parent: v.id, h: [vw * 0.8, y], a: angleOf(sub(S, [vw * 0.8, y])), len: dist(S, [vw * 0.8, y]), role: 'girdle', side: 1, lim: [-4, 4], flesh: th * 1.6 });
    girdle(c, gid, S, v, front, type, th, r);
    const chainId = 'limb' + idx;
    if (type === 'fin') return finLimb(c, gid, S, front, pr, r, chainId);
    if (type === 'tentacle') return tentacle(c, gid, S, front, L, th, r, chainId);
    const pose = P.limbPose * 0.35;
    let A;
    switch (type) {
      case 'upright': A = front ? { h: [-0.5, -0.95, -1.25], l: [0.36, 0.38, 0.26] } : { h: [0.55, 1.05, 1.3], l: [0.38, 0.38, 0.3] }; break;
      case 'wing': A = front ? { h: [-0.8, 0.05, 0.1], l: [0.32, 0.55, 0.05] } : { h: [0.6, 1.0, 1.1], l: [0.32, 0.55, 0.05] }; break;
      case 'flipper': A = front ? { h: [0.05, 0.25, 0.45], l: [0.3, 0.17, 0.6] } : { h: [0.5, 0.7, 0.9], l: [0.3, 0.17, 0.6] }; break;
      case 'stub': A = { h: [0.6, 1.2, 1.4], l: [0.12, 0.05, 0.05] }; break;
      // arms hang at the sides, legs stand straight under the hips (seen from the front)
      case 'arm': A = { h: [1.3, 1.43, 1.52], l: [0.4, 0.34, 0.26] }; break;
      case 'leg': A = { h: [1.63, 1.57, 1.25], l: [0.47, 0.42, 0.11] }; break;
      default: A = front ? { h: [0.25, -0.65, -0.95], l: [0.38, 0.32, 0.3] } : { h: [-0.15, 0.85, 1.05], l: [0.38, 0.34, 0.36] };
    }
    const h = A.h.map((a, i) => a + pose * (i ? 1 : 0.6) + r.range(-0.06, 0.06));
    const E = add(S, mul(dir(h[0]), A.l[0] * L));
    const Wr = add(E, mul(dir(h[1]), A.l[1] * L));
    const sid = rig.bone({ parent: gid, h: S, a: h[0], len: A.l[0] * L, role: 'limb', side: 1, chain: chainId, k: 0, n: 3, seg: 0, lim: [-35, 35], flesh: th * (type === 'wing' ? 1.6 : 3) });
    const st = PT.longBone(S, E, { w: th, ka: 1.75, kb: 1.9, bow: r.range(-0.05, 0.05) });
    rig.add(sid, st.poly, { fill: true, z: Z.stylo });
    if (c.detail > 0.35) rig.add(sid, st.shade, { z: Z.stylo, kind: 'shade' });
    if (type === 'leg') rig.add(sid, PT.blob(add(E, mul(dir(h[0]), -th * 0.6)), th * 1.25, th * 1.45, h[0], r, 0.1, 14), { fill: true, z: Z.stylo + 0.05 });
    const zid = rig.bone({ parent: sid, h: E, a: h[1], len: A.l[1] * L, role: 'limb', side: 1, chain: chainId, k: 1, n: 3, seg: 1, lim: [-45, 45], flesh: th * (type === 'wing' ? 1.4 : 2.6) });
    if (type === 'stub') {
      rig.add(zid, PT.claw(E, add(E, mul(dir(h[1]), L * 0.12 + 1)), th * 0.8, 0.3), { fill: true, z: Z.zeugo });
      return;
    }
    const nrm = perp(dir(h[1]));
    const sep = type === 'flipper' ? th * 1.0 : type === 'wing' ? th * 0.35 : th * 0.62;
    const zw = type === 'flipper' ? th * 0.8 : type === 'wing' ? th * 0.5 : th * 0.58;
    const z1 = PT.longBone(add(E, mul(nrm, sep * 0.8)), add(Wr, mul(nrm, sep)), { w: zw, ka: 1.5, kb: 1.6 });
    rig.add(zid, z1.poly, { fill: true, z: Z.zeugo });
    const short2 = type === 'wing' ? 0.45 : 1;
    const z2 = PT.longBone(sub(E, mul(nrm, sep * 0.8)), lerp2(sub(E, mul(nrm, sep * 0.8)), sub(Wr, mul(nrm, sep * 0.9)), short2), { w: zw * (type === 'wing' ? 0.6 : 0.9), ka: 1.6, kb: 1.4 });
    rig.add(zid, z2.poly, { fill: true, z: Z.zeugo + 0.01 });
    if (c.detail > 0.35) rig.add(zid, z1.shade, { z: Z.zeugo, kind: 'shade' });
    // wrist: a cluster of small carpal bones
    const carpL = max(0.6, th * 1.6);
    const cid = rig.bone({ parent: zid, h: Wr, a: h[2], len: carpL, role: 'limb', side: 1, chain: chainId, k: 2, n: 3, seg: 2, lim: [-30, 30], flesh: th * 2.2 });
    const nc = type === 'wing' ? 3 : min(8, 2 + P.digits);
    for (let i = 0; i < nc; i++) {
      const row = i % 2, u = (floor(i / 2) + 0.5) / Math.ceil(nc / 2) - 0.5;
      const cp = add(add(Wr, mul(dir(h[2]), carpL * (0.3 + row * 0.55))), mul(perp(dir(h[2])), u * th * 2.6));
      rig.add(cid, PT.blob(cp, th * 0.5, th * 0.42, h[2], r, 0.15, 10), { fill: true, z: Z.carpal });
    }
    const Hd = add(Wr, mul(dir(h[2]), carpL));
    digits(c, cid, Hd, h[2], type, L * A.l[2], th, r, chainId, front);
  }

  function digits(c, parent, Hd, hd, type, Lh, th, r, chainId, front) {
    const { P, rig } = c;
    const nd = type === 'wing' ? max(3, P.digits) : P.digits;
    const spread = P.digitSpread * (type === 'wing' ? 1.9 : type === 'flipper' ? 0.45 : 1.05) * (nd > 1 ? 1 : 0);
    const tips = [];
    for (let i = 0; i < nd; i++) {
      const u = nd > 1 ? i / (nd - 1) : 0.5;
      let len, ang = hd + (u - 0.5) * spread, np = P.phalanges + (abs(u - 0.5) < 0.3 ? 1 : 0), clawed = P.claws, w = th * 0.5;
      if (type === 'wing') {
        if (i === 0) { len = Lh * 0 + P.limbLength * T * 0.07; ang = hd - 1.35; np = 2; clawed = true; }
        else { len = P.limbLength * T * 0.45 * 0.62 * P.digitLength * lerp(1, 0.78, (i - 1) / max(1, nd - 2)) * r.range(0.95, 1.05); ang = hd - 0.4 + ((i - 1) / max(1, nd - 2)) * spread; clawed = false; w = th * 0.32; }
      } else if (type === 'flipper') {
        len = Lh * P.digitLength * (0.7 + 0.3 * sin(PI * (u * 0.85 + 0.1))) * r.range(0.95, 1.05);
        w = th * 0.42; clawed = false;
      } else {
        const sh = type === 'sprawl' ? 0.55 + 0.45 * sin(PI * (i + 0.8) / (nd + 0.5)) : 0.65 + 0.35 * sin(PI * (i + 0.5) / nd);
        len = Lh * P.digitLength * sh * r.range(0.92, 1.08) * (type === 'upright' ? 0.75 : 1);
      }
      const root = add(Hd, mul(perp(dir(hd)), (u - 0.5) * th * 1.1 * min(nd, 6) * (type === 'wing' ? 0.4 : 1)));
      // metapodial then phalanges, each shorter than the last
      const segL = [0.4];
      let rem = 0.6, q = 1;
      const qs = [];
      for (let k = 0; k < np; k++) { qs.push(q); q *= 0.78; }
      const qt = qs.reduce((a, b) => a + b, 0);
      for (const qq of qs) segL.push((rem * qq) / qt);
      let p = root, parentId = parent, a = ang;
      const curl = type === 'wing' ? 0.04 : type === 'flipper' ? 0.06 : 0.1 * (front ? -1 : 1) * (i < nd / 2 ? 1 : -1) * 0;
      segL.forEach((f, k) => {
        const sl = len * f;
        const last = k === segL.length - 1;
        a += k ? curl + r.range(-0.04, 0.04) : 0;
        const e = add(p, mul(dir(a), sl));
        const id = rig.bone({ parent: parentId, h: p, a, len: sl, role: 'digit', side: 1, chain: chainId + 'd' + i, k, n: segL.length, lim: [-20, 20], g: 'digit', u, flesh: w * (type === 'wing' ? 1.6 : 2.3) });
        const ww = w * (k === 0 ? 1 : lerp(0.85, 0.55, k / segL.length));
        if (last && clawed) rig.add(id, PT.claw(p, add(p, mul(dir(a + 0.15 * (i < nd / 2 ? -1 : 1)), sl * 1.25)), ww * 1.15, 0.22 * (i < nd / 2 ? -1 : 1)), { fill: true, z: Z.digit });
        else rig.add(id, PT.longBone(p, e, { w: ww, ka: 1.45, kb: last ? 1.1 : 1.45, notch: last ? 0 : 0.4, n: 8 }).poly, { fill: true, z: Z.digit });
        p = e; parentId = id;
      });
      tips.push({ p, id: parentId, i });
    }
    // flight membranes / flipper webbing: soft edges blended between neighbouring digit tips
    if (P.membrane || type === 'flipper') {
      const tp = type === 'wing' ? tips.slice(1) : tips;
      const web = [];
      if (type === 'wing' && c.curLimb) web.push([c.curLimb.gid, c.curLimb.S]);
      web.push([parent, Hd]);
      for (const t of tp) web.push([t.id, t.p]);
      if (type === 'wing' && tp.length) { const an = c.trunk[c.trunk.length - 1]; web.push([an.id, [c.vw * 2.2, an.y + an.l]]); }
      if (web.length > 2) c.meta.webs.push(web);
      for (let i = 0; i < tp.length - 1; i++) {
        const a = tp[i], b = tp[i + 1];
        const m = lerp2(a.p, b.p, 0.5), sag = sub(lerp2(Hd, m, 0.82), m);
        const pts = G.quadBezier(a.p, add(m, mul(sag, type === 'wing' ? 1.6 : 0.4)), b.p, 14);
        c.rig.add(a.id, pts, { kind: 'soft', z: Z.membrane, bone2: b.id, wts: pts.map((_, k) => k / (pts.length - 1)) });
      }
      if (type === 'wing' && tp.length) {
        // trailing edge back to the body, and the leading edge from wrist to shoulder
        const last = tp[tp.length - 1], anchor = c.trunk[c.trunk.length - 1];
        const end = [c.vw * 2.2, anchor.y + anchor.l];
        const pts = G.quadBezier(last.p, lerp2(lerp2(last.p, end, 0.5), Hd, 0.35), end, 16);
        c.rig.add(last.id, pts, { kind: 'soft', z: Z.membrane, bone2: anchor.id, wts: pts.map((_, k) => k / (pts.length - 1)) });
        const first = tp[0];
        const fpts = G.quadBezier(first.p, lerp2(first.p, Hd, 0.5), Hd, 8);
        c.rig.add(first.id, fpts, { kind: 'soft', z: Z.membrane, bone2: parent, wts: fpts.map((_, k) => k / (fpts.length - 1)) });
      }
    }
  }

  function girdle(c, gid, S, v, front, type, th, r) {
    const { P, rig } = c;
    const vw = c.vw, y = S[1];
    if (P.disc > 0.05) return; // the disc frame carries the limbs
    if (type === 'fin') {
      // cleithrum: a crescent from the spine to the fin base
      const arc = G.catmullRom([[vw * 1.1, y - T * 0.05], [S[0] * 0.75, y - T * 0.02], [S[0], y + th]], 6);
      rig.add(gid, PT.rod(arc, th * 0.7, th * 1.1), { fill: true, z: Z.girdle });
      return;
    }
    if (front) {
      if (type === 'flipper') {
        rig.add(gid, PT.blob([S[0] * 0.55, y + T * 0.05], S[0] * 0.55, T * 0.07, 0.2, r, 0.08), { fill: true, z: Z.girdle - 0.1 });
      } else {
        // scapula blade over the ribs, collarbone in front
        const sl = T * (type === 'upright' || type === 'wing' || type === 'arm' ? 0.17 : 0.1) * (0.8 + P.limbThickness * 0.2);
        const blade = [[vw * 1.4, y - th * 1.5], [lerp(vw, S[0], 0.55), y - th * 2.6], [S[0] - th * 0.5, y - th * 1.7], [S[0] + th * 0.9, y + th * 0.2], [S[0] - th * 0.2, y + th * 1.8], [lerp(vw, S[0], 0.62), y + sl], [vw * 1.7, y + sl * 0.85]];
        // seen from the front, a shoulder blade sits behind the ribcage
        rig.add(gid, G.chaikin(blade, 2, true), { fill: true, z: type === 'arm' ? Z.rib - 0.1 : Z.girdle });
        if (c.detail > 0.3) rig.add(gid, [[lerp(vw, S[0], 0.3), y + sl * 0.55], [S[0] - th * 1.2, y + th * 0.2]], { z: Z.girdle, kind: 'line' });
        const cl = G.catmullRom([S, [lerp(vw, S[0], 0.5), y - th * 3.2], [vw * 0.5, y - th * 3.6]], 6);
        rig.add(gid, PT.rod(cl, th * 0.4, th * 0.35), { fill: true, z: Z.girdle - 0.2 });
      }
    } else if (type === 'leg') {
      // a standing pelvis, seen from the front: flared iliac wings above the hip socket, a ring below
      const il = T * 0.17, X = S[0];
      const half = [[vw * 0.6, y - il * 0.55], [X * 0.5, y - il * 1.0], [X * 1.1, y - il * 1.08], [X * 1.32, y - il * 0.62], [X * 1.12, y - th * 1.3], [X + th * 0.7, y + th * 0.4],
        [X * 0.95, y + il * 0.48], [X * 0.55, y + il * 0.58], [vw * 0.45, y + il * 0.32], [vw * 0.3, y - il * 0.1]];
      const holes = [PT.blob([X * 0.72, y + il * 0.27], X * 0.16, il * 0.15, 0.3, r, 0.1, 14)];
      rig.add(gid, G.chaikin(half, 2, true), { fill: true, z: Z.girdle, holes });
      if (c.detail > 0.3) rig.add(gid, G.catmullRom([[X * 0.55, y - il * 0.75], [X * 0.95, y - il * 0.55], [X * 1.05, y - il * 0.2]], 6), { z: Z.girdle, kind: 'shade' });
    } else {
      // pelvis: ilium forward along the spine, ischium and pubis behind the hip socket
      const il = T * (type === 'upright' ? 0.13 : 0.09);
      const half = [[vw * 0.9, y - il], [lerp(vw, S[0], 0.45), y - il * 0.95], [S[0] - th * 0.6, y - th * 2.2], [S[0] + th * 1.1, y], [S[0] - th * 0.2, y + th * 2.2], [lerp(vw, S[0], 0.7), y + il * 0.75], [vw * 0.4, y + il * 0.9], [vw * 0.4, y - il * 0.2]];
      const poly = G.chaikin(half, 2, true);
      const holes = [];
      if (type === 'upright' || type === 'sprawl') holes.push(PT.blob([lerp(vw, S[0], 0.55), y + il * 0.38], (S[0] - vw) * 0.18, il * 0.22, 0, r, 0.1, 12));
      rig.add(gid, poly, { fill: true, z: Z.girdle, holes });
    }
  }

  // a fan fin: a short base (radials) and a spray of jointed rays
  function finLimb(c, gid, S, front, pr, r, chainId) {
    const { P, rig } = c;
    const disc = P.disc > 0.05;
    const Lf = P.finSize * T * (pr.extra ? 0.22 : 0.3) * (front ? 1 : 0.75) * (disc ? 1.25 : 1);
    const hf = (front ? 0.45 : disc ? 0.95 : 0.8) + P.limbPose * 0.3;
    const rl = Lf * 0.16;
    const bid = rig.bone({ parent: gid, h: S, a: hf, len: rl, role: 'limb', side: 1, chain: chainId, k: 0, n: 1, seg: 0, lim: [-30, 30], flesh: Lf * 0.11 });
    const nRad = 4;
    const bw = Lf * 0.16;
    const nf = perp(dir(hf));
    for (let i = 0; i < nRad; i++) {
      const u = i / (nRad - 1) - 0.5;
      const a = add(S, mul(nf, u * bw * 0.6)), b = add(add(S, mul(dir(hf), rl)), mul(nf, u * bw * 1.6));
      rig.add(bid, PT.longBone(a, b, { w: max(0.25, bw * 0.12), ka: 1.3, kb: 1.4, n: 6 }).poly, { fill: true, z: Z.zeugo });
    }
    const nr = P.finRays;
    const spread = 0.8 + P.finSize * 0.35;
    const rays = [];
    for (let i = 0; i < nr; i++) {
      const u = nr > 1 ? i / (nr - 1) : 0.5;
      const b = add(add(S, mul(dir(hf), rl * 0.95)), mul(nf, (u - 0.5) * bw * 1.7));
      const a = hf + (u - 0.5) * spread;
      const len = Lf * (0.62 + 0.38 * sin(PI * (u * 0.8 + 0.12))) * (i === 0 ? 1.08 : 1) * r.range(0.96, 1.04);
      const bend = (u - 0.5) * 0.25;
      rays.push(G.walk(b, (s) => a + bend * (s / len), len, len / 10));
    }
    rayChains(c, bid, rays, { joints: P.disc > 0.05 ? 3 : 2, chain: chainId + 'r', w: 0.9, bead: P.rayStyle === 'beaded' ? 1.9 : 0, fork: 0.25, flesh: clamp((Lf * spread) / max(1, nr) * 0.55, 0.4, 4) });
  }

  function tentacle(c, gid, S, front, L, th, r, chainId) {
    const { rig } = c;
    const n = 12 + round(L / 4);
    let p = S, parent = gid, a = front ? 0.15 : 0.9, l = (L * 1.6) / n / 0.6, w = th * 1.1;
    const curl = c.R.fork('tc' + chainId).range(0.08, 0.22);
    for (let k = 0; k < n; k++) {
      const e = add(p, mul(dir(a), l));
      const id = rig.bone({ parent, h: p, a, len: l, role: 'limb', side: 1, chain: chainId, k, n, seg: k, lim: [-25, 25], flesh: w * 1.35 });
      rig.add(id, PT.blob(lerp2(p, e, 0.5), l * 0.62, w, a, r, 0.06, 12), { fill: true, z: Z.stylo - k * 0.001 });
      if (c.detail > 0.4 && w > 0.6) rig.add(id, [add(lerp2(p, e, 0.5), mul(perp(dir(a)), w * 0.45)), add(lerp2(p, e, 0.5), mul(perp(dir(a)), -w * 0.45))], { z: Z.stylo, kind: 'line' });
      c.rd[id] = k ? curl * pow(k / n, 1.2) : 0;
      p = e; parent = id; l *= 0.955; w *= 0.94;
    }
  }

  // jointed fin rays: each ray becomes a chain of bones; the drawing on each joint is a run of the ray
  function rayChains(c, parentOf, rays, o) {
    const { P, rig } = c;
    const r = c.R.fork('rays' + (o.chain || ''));
    const K = max(1, o.joints || 3);
    const cuts = [];
    for (let k = 0; k <= K; k++) cuts.push(pow(k / K, 0.85));
    rays.forEach((pl, i) => {
      if (pl.length < 2) return;
      const runs = PT.splitAt(pl, cuts);
      let parent = typeof parentOf === 'function' ? parentOf(i, pl) : parentOf;
      const fork = r.chance(o.fork || 0);
      const L = G.polyLength(pl);
      const rw = (o.rw || 0.32) * (o.rwScale ? o.rwScale(i) : 1);
      runs.forEach((run, k) => {
        const id = rig.bone({ parent, h: run[0], a: angleOf(sub(run[run.length - 1], run[0])), len: dist(run[0], run[run.length - 1]), role: 'ray', side: 1, chain: o.chain + i, k, n: K, lim: [-18, 18], g: o.chain, u: rays.length > 1 ? i / (rays.length - 1) : 0.5, flesh: o.flesh || 0.6 });
        const last = k === runs.length - 1;
        let main = run;
        if (last && fork && run.length > 3) {
          // the ray splits in two near its tip, and the branches may split again
          const cum = G.cumLengths(run), RL = cum[cum.length - 1];
          const fa = c.wild ? 0.35 : 0.3;
          const fp = G.pointAtLength(run, cum, RL * fa);
          main = G.subPath(run, cum, 0, RL * fa, 4);
          const end = run[run.length - 1], nn = perp(norm(sub(end, fp))), off = (o.forkOff || 0.9) * (0.6 + 0.4 * rw / 0.32);
          const twice = !c.wild && r.chance((o.fork || 0) * 0.7);
          for (const s of [1, -1]) {
            const bEnd = add(end, mul(nn, s * off));
            const br = G.quadBezier(fp, lerp2(fp, add(end, mul(nn, s * off * 0.4)), 0.5), bEnd, c.wild ? 6 : 8);
            if (twice) {
              const bc = G.cumLengths(br), BLn = bc[bc.length - 1];
              const fp2 = G.pointAtLength(br, bc, BLn * 0.6);
              addRay(c, id, G.subPath(br, bc, 0, BLn * 0.6, 5), rw * 0.75, o, false);
              for (const s2 of [1, -1]) addRay(c, id, G.quadBezier(fp2, lerp2(fp2, bEnd, 0.5), add(bEnd, mul(nn, s2 * off * 0.42)), 4), rw * 0.55, o, true);
            } else addRay(c, id, br, rw * 0.75, o, last);
          }
        }
        addRay(c, id, main, rw * (1 - 0.45 * (k / K)), o, last);
        parent = id;
      });
    });
  }
  function addRay(c, id, pl, rw, o, last) {
    const { P, rig } = c;
    const style = o.style || P.rayStyle;
    if (style === 'double' && rw > 0.12) {
      rig.add(id, PT.rod(pl, rw, rw * 0.8, { capEnd: !last, capStart: false }), { fill: true, z: Z.ray, w: 0.6 });
      // joints across the ray, like the segments of real fin rays
      if (c.detail > 0.3 && !c.wild) for (const tk of PT.rayMarks(pl, rw * 0.8, max(1.1, rw * 4.5))) rig.add(id, tk, { z: Z.ray, kind: 'shade', w: 0.8 });
    } else {
      rig.add(id, pl, { z: Z.ray, kind: 'ray', w: o.w || 1 });
    }
    const bead = o.bead === undefined ? (style === 'beaded' ? 1.7 : 0) : o.bead;
    if (bead && style !== 'double') for (const tk of PT.rayMarks(pl, max(0.22, rw * 0.9), bead)) rig.add(id, tk, { z: Z.ray, kind: 'ray', w: (o.w || 1) * 0.9 });
  }

  // ---------------------------------------------------------------- the disc (rays, skates)
  const discFrameW = (c) => c.P.bodyWidth * T * 0.9 + c.vw;

  function buildDisc(c) {
    const { P, rig } = c;
    const r = c.R.fork('disc');
    const Ls = c.Ls, fw = discFrameW(c);
    const gv = c.discGirdle || trunkAt(c, 0.3);
    const gy = gv.y;
    const pv = c.trunk[c.trunk.length - 1];
    const yP = pv.y + pv.l * 0.5, pw = fw * 0.85;
    const DW = fw + P.disc * T * 0.55;
    const yHead = -Ls; // snout tip
    const yF = yHead - P.discFront * T * 0.38 - 2;
    const yA = lerp(gy, yP, 0.08);
    const yB = yP + T * 0.1;
    // base: the frame bars the rays spring from (propterygium forward, metapterygium back)
    const pro = G.catmullRom([[fw, gy], [fw * 1.03, lerp(c.y0, gy, 0.3)], [fw * 0.95, -Ls * 0.25], [fw * 0.62, -Ls * 0.78], [fw * 0.2, yHead - 1]], 8);
    const meta = G.catmullRom([[fw, gy], [fw * 1.22, lerp(gy, yP, 0.45)], [pw * 1.08, lerp(gy, yP, 0.85)], [pw, yP]], 8);
    const proId = rig.bone({ parent: gv.id, h: [fw, gy], a: -PI / 2, len: dist([fw, gy], pro[pro.length - 1]), role: 'girdle', side: 1, lim: [-3, 3], flesh: T * 0.045 });
    const metaId = rig.bone({ parent: gv.id, h: [fw, gy], a: PI / 2, len: dist([fw, gy], meta[meta.length - 1]), role: 'girdle', side: 1, lim: [-3, 3], flesh: T * 0.045 });
    const bw = T * 0.02;
    rig.add(proId, PT.rod(pro, bw * 1.1, bw * 0.45), { fill: true, z: Z.frame });
    {
      const sk = skullGeom(c), ta = 0.55, sx = sk.wAt(ta) * 0.92;
      const pc = G.cumLengths(pro);
      let best = pro[0], bd = Infinity;
      for (const p of pro) { const d = abs(p[1] - (-ta * Ls)); if (d < bd && p[0] > sx) { bd = d; best = p; } }
      const bar = G.quadBezier([sx, -ta * Ls], [lerp(sx, best[0], 0.5), -ta * Ls - T * 0.02], best, 8);
      rig.add(proId, PT.rod(bar, bw * 0.5, bw * 0.4), { fill: true, z: Z.frame - 0.01 });
    }
    rig.add(metaId, PT.rod(meta, bw * 1.1, bw * 0.7), { fill: true, z: Z.frame });
    if (c.detail > 0.4) {
      rig.add(proId, G.offsetLine(pro.slice(2, -3), bw * 0.35), { z: Z.frame, kind: 'shade' });
      rig.add(metaId, G.offsetLine(meta.slice(2, -3), -bw * 0.35), { z: Z.frame, kind: 'shade' });
    }
    // margin of the disc, front notch to the hips
    const ro = lerp(0.85, 1.12, P.discRound);
    const margin = G.catmullRom([
      [fw * 0.12, yHead - 0.5],
      [fw * 0.3, yF],
      [lerp(fw * 0.3, DW, 0.5) * ro + fw * 0.1, lerp(yF, yA, 0.42) - (ro - 0.85) * T * 0.08],
      [DW, yA],
      [lerp(DW, pw, 0.18) * ro, lerp(yA, yB, 0.5)],
      [lerp(DW, pw, 0.5), lerp(yA, yB, 0.86)],
      [pw * 1.3, yB],
    ], 10);
    const base = [...pro.slice().reverse(), ...meta.slice(1)];
    const nR = P.rays;
    const bc = G.cumLengths(base), BL = bc[bc.length - 1];
    const mc = G.cumLengths(margin), ML = mc[mc.length - 1];
    const proL = G.polyLength(pro);
    const rays = [], parents = [];
    for (let i = 0; i < nR; i++) {
      const u = (i + 0.5) / nR;
      const sb = BL * u, sm = ML * u;
      const b = G.pointAtLength(base, bc, sb), m = G.pointAtLength(margin, mc, sm);
      const tb = norm(sub(G.pointAtLength(base, bc, sb + 0.5), G.pointAtLength(base, bc, sb - 0.5)));
      let nb = [tb[1], -tb[0]];
      if (nb[0] < 0) nb = mul(nb, -1);
      const d = dist(b, m);
      const pl = PT.cubic(b, add(b, mul(nb, d * 0.38)), lerp2(b, m, 0.7), m, 18);
      rays.push(pl);
      parents.push(sb < proL ? proId : metaId);
    }
    // ray width tapers towards the front and back of the disc
    rayChains(c, (i) => parents[i], rays, {
      joints: P.rayJoints, chain: 'disc', fork: P.rayFork, w: 1,
      rw: clamp((ML / nR) * 0.16, 0.12, 0.4), rwScale: (i) => 0.7 + 0.3 * sin(PI * (i + 0.5) / nR),
      forkOff: clamp((ML / nR) * 0.32, 0.25, 1.2), flesh: clamp((ML / nR) * 0.85, 0.4, 3),
    });
    // gill arches with their rakers, inside the frame
    const nG = P.gillArches;
    for (let j = 0; j < nG; j++) {
      const y = lerp(c.y0 + (gy - c.y0) * 0.12, gy * 0.9, nG > 1 ? j / (nG - 1) : 0.5);
      const v = vertAt(c, y);
      const xo = fw * lerp(0.62, 0.78, sin(PI * (j + 0.5) / nG));
      const arc = G.catmullRom([[c.vw * 1.5, y], [xo * 0.6, y - T * 0.012], [xo, y + T * 0.02]], 8);
      rig.add(v.id, PT.rod(arc, T * 0.006, T * 0.004), { fill: true, z: Z.gill });
      const cum = G.cumLengths(arc), AL = cum[cum.length - 1];
      for (let s = AL * 0.15; s < AL; s += 0.75) {
        const p = G.pointAtLength(arc, cum, s), q = G.pointAtLength(arc, cum, s + 0.1);
        const nn = perp(norm(sub(q, p)));
        const rl = T * 0.028 * (0.6 + 0.4 * sin(PI * s / AL));
        rig.add(v.id, [p, add(p, mul(add(mul(nn, -1), [0.35, 0.25]), rl))], { z: Z.gill, kind: 'line', w: 0.8 });
      }
    }
    // head lobes (cephalic fins): forward-pointing horns with a comb of short rays
    if (P.cephalic > 0.05) {
      const len = P.cephalic * T * 0.32, b = [fw * 0.25, yHead + Ls * 0.1];
      const a0 = -PI / 2 + 0.28;
      const center = G.walk(b, (s) => a0 - 0.5 * (s / len), len, len / 12);
      const id = rig.bone({ parent: c.skull, h: b, a: a0, len, role: 'ray', side: 1, chain: 'cephalic', k: 0, n: 1, lim: [-25, 25], flesh: T * 0.025 });
      rig.add(id, PT.rod(center, T * 0.012, T * 0.005), { fill: true, z: Z.frame });
      const cum = G.cumLengths(center), L = cum[cum.length - 1];
      for (let s = L * 0.1; s < L * 0.95; s += 1.1) {
        const p = G.pointAtLength(center, cum, s), q = G.pointAtLength(center, cum, s + 0.1);
        const nn = perp(norm(sub(q, p)));
        rig.add(id, [p, add(p, mul(nn, -T * 0.035 * sin(PI * s / L)))], { z: Z.ray, kind: 'ray' });
      }
    }
    c.marks = Object.assign(c.marks || {}, { disc: true });
  }

  // ---------------------------------------------------------------- tail sides
  function buildTailSides(c) {
    const { P, rig } = c;
    const r = c.R.fork('tail');
    const tl = c.tail;
    if (!tl.length) return;
    const last = tl[tl.length - 1];
    if (P.tailEnd === 'fan' || P.tailEnd === 'fork') {
      const nh = max(3, round(P.finRays * 0.6));
      const Lc = P.finSize * T * 0.32 * (P.archetype === 'fish' ? 1 : 0.7);
      const spread = 0.9 + P.finSize * 0.2;
      const nb = min(4, tl.length);
      const rays = [], par = [];
      for (let i = 0; i < nh; i++) {
        const u = (i + 0.5) / nh; // 0 = centre, 1 = outer edge
        const v = tl[tl.length - 1 - min(nb - 1, floor(u * nb))];
        const b = [v.w * 0.5, v.y + v.l * 0.5];
        const a = PI / 2 - u * spread * 0.5;
        const prof = P.tailEnd === 'fork' ? 0.45 + 0.55 * pow(u, 1.6) : 0.75 + 0.25 * sin(PI * (0.5 + u * 0.5)) * 0 + 0.25 * (1 - u * u);
        const len = Lc * prof * r.range(0.97, 1.03);
        rays.push(G.walk(b, (s) => a - 0.15 * u * (s / len), len, len / 10));
        par.push(v.id);
      }
      rayChains(c, (i) => par[i], rays, { joints: 2, chain: 'caudal', fork: 0.3, w: 1, flesh: clamp((Lc * spread) / max(1, nh) * 0.45, 0.4, 4) });
    } else if (P.tailEnd === 'spikes') {
      const v = tl[min(tl.length - 1, floor(tl.length * 0.82))];
      for (const [a, f] of [[0.55, 1], [0.95, 0.85]]) {
        const b = [v.w * 0.6, v.y + v.l * (f > 0.9 ? 0.2 : 0.8)];
        const len = T * 0.16 * f;
        rig.add(v.id, PT.claw(b, add(b, mul(dir(a), len)), max(0.9, v.w * 0.9), -0.08), { fill: true, z: Z.plate });
      }
    } else if (P.tailEnd === 'leaf') {
      const from = floor(tl.length * 0.4);
      const span = tl.length - from;
      for (let i = from; i < tl.length; i++) {
        const v = tl[i], u = (i - from) / max(1, span - 1);
        const len = T * 0.07 * sin(PI * clamp(u * 0.95 + 0.04, 0, 1)) * (P.finSize * 0.8 + 0.2);
        if (len < 0.6) continue;
        for (let k = 0; k < 2; k++) {
          const b = [v.w * 0.5, v.y + v.l * (k ? 0.75 : 0.25)];
          rig.add(v.id, G.walk(b, (s) => 0.55 + 0.3 * (s / len), len, len / 5), { z: Z.ray, kind: 'ray', w: 0.9 });
        }
      }
    }
  }

  // ================================================================ names
  function name(P, seed) {
    const r = new BD.Rng(seed).fork('name');
    const f = [];
    if (P.disc > 0.05) f.push('disc');
    if (P.horns !== 'none' && P.hornLength > 0.3) f.push('horns');
    if (P.frill > 0.3) f.push('frill');
    if (P.frontLimb === 'wing' || P.hindLimb === 'wing') f.push('wing');
    if (P.frontLimb === 'tentacle' || P.hindLimb === 'tentacle') f.push('tentacle');
    if (P.extraPairs > 0) f.push('many');
    if (P.neckLength > 0.7) f.push('neck');
    if (P.tailEnd === 'barb' || P.lateralSpines > 0.3) f.push('spiny');
    if (P.osteoderms > 0.4 || P.ribs === 'carapace' || P.tailEnd === 'club') f.push('armour');
    if (P.tailLength > 1.6) f.push('tail');
    if (P.skullShape === 'smiler' && P.archetype !== 'humanoid') f.unshift('smiler');
    f.push(P.archetype);
    const e = [];
    if (P.skullShape === 'smiler') e.push('sad');
    if (P.rays > 90 && P.disc > 0.05) e.push('radiate');
    if (P.tailCurl > 0.4) e.push('curl');
    if (P.digits >= 6) e.push('digits');
    if (P.teeth > 0.6) e.push('teeth');
    if (P.orbitSize > 0.75) e.push('eyes');
    if (P.ribs === 'cage' || P.ribs === 'free') e.push('ribs');
    if (P.membrane) e.push('membrane');
    if (P.tailEnd === 'fork') e.push('fork');
    e.push('plain');
    return BD.names.binomial(r, f, e, 0, BD.names.dicts.bone);
  }

  BD.creature = {
    id: 'creature', schema: SCHEMA, archetypeLabels: ARCH_LABEL, sample, build, name, T,
  };
})();
