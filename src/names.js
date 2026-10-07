/* bonedraw — Latin-style binomials built from the skeleton's features */
(function () {
  'use strict';
  const BD = (globalThis.BD = globalThis.BD || {});

  function genderOf(genus) {
    const g = genus.toLowerCase();
    if (/(soma|ma|ceras|um|on|odon)$/.test(g)) return 'n';
    if (/(us|os|ops|er|ax|ex|ix|ys|is|es|on|yx)$/.test(g)) return 'm';
    return 'f';
  }
  function decline(e, g) {
    if (e.w) return e.w;
    if (e.d === 3) return e.s + (g === 'n' ? 'e' : 'is');
    if (e.d === 0) return e.s;
    return e.s + (g === 'm' ? 'us' : g === 'f' ? 'a' : 'um');
  }
  function join(a, b) {
    const vowels = 'aeiouy';
    if (vowels.includes(a[a.length - 1]) && vowels.includes(b[0])) return a.slice(0, -1) + b;
    if (!vowels.includes(a[a.length - 1]) && !vowels.includes(b[0]) && b[0] !== 'r') return a + 'o' + b;
    return a + b;
  }
  // genusFeatures: feature keys ranked by prominence; epithetKeys: epithet keys
  function binomial(rng, genusFeatures, epithetKeys, _n, dict) {
    const { PREFIX, SUFFIX, EPI } = dict;
    const fa = genusFeatures.length ? genusFeatures : ['plain'];
    const pre = rng.pick(PREFIX[rng.chance(0.75) ? fa[0] : rng.pick(fa)] || PREFIX.plain);
    const sufKey = rng.chance(0.55) && fa.length > 1 ? fa[1] : rng.chance(0.5) ? fa[0] : 'plain';
    const suf = rng.pick(SUFFIX[sufKey] || SUFFIX.plain);
    let genus = join(pre, suf);
    if (genus.length > 16) genus = join(pre, rng.pick(SUFFIX.plain));
    genus = genus[0].toUpperCase() + genus.slice(1).toLowerCase();
    const g = genderOf(genus);
    const key = epithetKeys.length ? (rng.chance(0.7) ? epithetKeys[0] : rng.pick(epithetKeys)) : 'plain';
    return genus + ' ' + decline(rng.pick(EPI[key] || EPI.plain), g);
  }

  const BONE = {
    PREFIX: {
      disc: ['Dasy', 'Trygo', 'Pteroplat', 'Raj', 'Myliob', 'Urolo', 'Gymnur', 'Hypan', 'Potamo', 'Aeto'],
      horns: ['Cerat', 'Tricer', 'Dicer', 'Corn', 'Styraco', 'Kera'],
      frill: ['Chasmo', 'Pentacer', 'Lopho', 'Peris', 'Torosa'],
      wing: ['Ptero', 'Chiro', 'Myot', 'Noctil', 'Rhinolo', 'Dermo'],
      tentacle: ['Teuth', 'Plekto', 'Strepto', 'Helico', 'Kirro'],
      many: ['Poly', 'Myrio', 'Hexa', 'Octo', 'Pleio'],
      neck: ['Dolicho', 'Tanystro', 'Elasmo', 'Mamenchi', 'Trachel'],
      spiny: ['Acantho', 'Echino', 'Kentro', 'Stego', 'Hoplo'],
      armour: ['Ankylo', 'Thyreo', 'Scuto', 'Lorica', 'Placo', 'Chelo'],
      tail: ['Macro', 'Mastigo', 'Uro', 'Longi', 'Cerco'],
      ray: ['Dasy', 'Trygo', 'Raj', 'Batido', 'Rhino', 'Narc', 'Torpe'],
      fish: ['Ichthy', 'Salmo', 'Gado', 'Clupe', 'Scombro', 'Pisci', 'Cyprin'],
      serpent: ['Ophi', 'Lampro', 'Boa', 'Typhlo', 'Elapo', 'Dendro', 'Python'],
      lizard: ['Saur', 'Varan', 'Chamae', 'Gekk', 'Iguan', 'Lacert', 'Agam'],
      turtle: ['Chelo', 'Testud', 'Emyd', 'Trionyx', 'Caretto', 'Pleuro'],
      bat: ['Chiro', 'Vespertil', 'Myot', 'Ptero', 'Rhinolo', 'Megader'],
      mammal: ['Thero', 'Cyno', 'Felo', 'Mustel', 'Mega', 'Hyo', 'Proto'],
      frog: ['Ran', 'Buf', 'Hyl', 'Batracho', 'Pip', 'Lepto', 'Ceratophr'],
      plesio: ['Plesio', 'Elasmo', 'Nothos', 'Cryptoclid', 'Thalasso', 'Pistos'],
      humanoid: ['Homo', 'Anthropo', 'Hominid', 'Androm', 'Pithec', 'Tristo'],
      smiler: ['Tristo', 'Moro', 'Lugubro', 'Dysthymo', 'Glumo', 'Melancho'],
      plain: ['Neo', 'Para', 'Eu', 'Proto', 'Pseudo', 'Archae', 'Hemi', 'Xeno', 'Allo', 'Crypto'],
    },
    SUFFIX: {
      disc: ['trygon', 'batis', 'raja', 'ptera', 'urus'],
      horns: ['ceras', 'ceratops', 'cornus', 'ops'],
      frill: ['saurus', 'ceratops', 'ops'],
      wing: ['pteryx', 'pterus', 'chirus', 'ptera'],
      tentacle: ['teuthis', 'pus', 'nema', 'plectus'],
      many: ['pus', 'poda', 'dactylus', 'melus'],
      neck: ['saurus', 'derus', 'trachelus', 'auchen'],
      spiny: ['saurus', 'spondylus', 'cantha', 'phorus'],
      armour: ['saurus', 'chelys', 'derma', 'thorax'],
      tail: ['cercus', 'urus', 'cauda', 'ura'],
      ray: ['trygon', 'batis', 'raja', 'urus', 'rhina'],
      fish: ['ichthys', 'odus', 'pterus', 'stomus', 'cephalus'],
      serpent: ['ophis', 'phis', 'boa', 'dryas', 'aspis'],
      lizard: ['saurus', 'leo', 'odon', 'gnathus', 'ops'],
      turtle: ['chelys', 'emys', 'testudo', 'nyx'],
      bat: ['pteryx', 'otis', 'nycteris', 'chirus'],
      mammal: ['therium', 'odon', 'gale', 'cyon', 'don'],
      frog: ['batrachus', 'hyla', 'rana', 'phryne', 'bufo'],
      plesio: ['saurus', 'nectes', 'odon', 'dirus'],
      humanoid: ['pithecus', 'anthropus', 'homo', 'hominus', 'andros'],
      smiler: ['cephalus', 'prosopon', 'ops', 'facies', 'gelos'],
      plain: ['us', 'ia', 'odon', 'saurus', 'ops', 'ella', 'ides', 'is'],
    },
    EPI: {
      radiate: [{ s: 'radiat', d: 1 }, { s: 'pectinat', d: 1 }, { s: 'flabellat', d: 1 }],
      curl: [{ s: 'spiral', d: 3 }, { s: 'volut', d: 1 }, { s: 'cirrat', d: 1 }],
      digits: [{ s: 'polydactyl', d: 1 }, { s: 'multidigitat', d: 1 }],
      teeth: [{ s: 'dentat', d: 1 }, { s: 'serrat', d: 1 }, { w: 'ferox' }, { s: 'odontophor', d: 1 }],
      eyes: [{ s: 'oculat', d: 1 }, { w: 'megalops' }, { s: 'grandocul', d: 1 }],
      ribs: [{ s: 'costat', d: 1 }, { s: 'multicostat', d: 1 }, { s: 'cancellat', d: 1 }],
      membrane: [{ s: 'velat', d: 1 }, { s: 'membranace', d: 1 }, { s: 'alat', d: 1 }],
      fork: [{ s: 'furcat', d: 1 }, { s: 'bifid', d: 1 }],
      sad: [{ s: 'trist', d: 3 }, { s: 'maest', d: 1 }, { s: 'lugubr', d: 3 }, { s: 'moros', d: 1 }, { w: 'melancholicus' }, { s: 'flebil', d: 3 }],
      plain: [{ s: 'diaphan', d: 1 }, { s: 'ossifrag', d: 1 }, { s: 'pallid', d: 1 }, { s: 'spectral', d: 3 }, { s: 'osse', d: 1 }, { s: 'lucid', d: 1 }, { s: 'gracil', d: 3 }, { s: 'insolit', d: 1 }, { w: 'phantasma' }, { s: 'nocturn', d: 1 }, { s: 'fragil', d: 3 }],
    },
  };

  BD.names = { binomial, dicts: { bone: BONE } };
})();
