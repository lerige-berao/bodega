/* fantomes.js : les autres visiteurs du bar, en fantômes (aucune dépendance de plus : il se sert de pnj.js et de la page).

   Un fantôme = le PNJ du bar dans sa tenue commune, à 65 % d'opacité (réglage « opacite »), avec une des têtes dessinées par Léo
   (pnj/tete3.png … tete30.png et leur dos), tirée au hasard pour chaque visiteur. On le traverse, on ne lui parle pas, le pipi
   ne le touche pas. Il marche là où marche le visiteur, s'assoit sur le siège où il s'assoit, et se tourne là où il regarde : on
   voit sa face quand il regarde vers soi, son dos quand il regarde ailleurs, et de quel côté il est tourné.

   Les vrais visiteurs : la page ouvre une connexion continue vers le relais (RELAIS, ci-dessous ; voir le dossier « salon »), lui
   envoie la position du joueur quand il bouge (cinq fois par seconde au plus) et reçoit celle des autres. Si le relais ne répond
   pas, le bar marche tout seul, et la page réessaie de loin en loin. Onglet caché plus de trente secondes : elle se déconnecte.

   La démonstration, sans réseau (des visiteurs inventés) :
     berao.fr/#fantomes          trois fantômes qui se promènent et s'assoient
     berao.fr/#fantomes12        douze (ou n'importe quel nombre de 1 à 30) : pour juger la fluidité au téléphone
     berao.fr/#fantomes-80       trois, à 80 % d'opacité (de 10 à 95) ; #fantomes12-50 : douze, à 50 %
     berao.fr/?fantomes=demo     pareil, pour un lien qu'on envoie ; ?fantomes=demo&opacite=80

   Ce que la page fournit (window.bodega) : pnj(options) qui fabrique un PNJ dans la tenue commune, pnjTaille les tailles de ses PNJ
   (debout, assis, perché), view() la position du joueur, siege.liste les sièges, colliders et radius les obstacles (pour la
   démonstration), siege.rang() le siège où le joueur est assis, siege.tele celui de la télé, tele.etat(). Elle appelle
   FANTOMES.maj(dt) à chaque image.

     FANTOMES.arrive('a7', { tete: 4, x: 1.2, z: 0.5, a: 0, s: 0, nom: 'leo' });   // tete : rang dans TETES ; x, z en mètres ; a : cap du visiteur ; nom : écrit au-dessus de sa tête
                                                                       // (radians, celui du joueur : 0 = vers le nord) ; s : 0 debout,
                                                                       // n = assis sur le siège n - 1 de bodega.siege.liste
     FANTOMES.bouge('a7', { k: 1, h: -0.6 });                          // ce qu'il fait : k = des bits (1 = pipi, 2 = boit une bière), h = la hauteur de son regard
                                                                       // (radians). On voit alors son jet, là où il vise.
     FANTOMES.bouge('a7', { x: 1.4, z: 0.7, a: 0.3, s: 0 });           // à chaque nouvelle position reçue (cinq par seconde)
     FANTOMES.part('a7');                                              // il s'efface
     FANTOMES.demo(3);  FANTOMES.demo(0);                              // lance, arrête la démonstration
     FANTOMES.liste();                                                 // pour les essais
     FANTOMES.connecter('wss://…');  FANTOMES.deconnecter();           // le relais, à la main
     FANTOMES.reseau();                                                // où en est la connexion
*/
var FANTOMES = (function () {
  'use strict';
  // [image, cou, enfonce, grosseur] : les réglages de chaque tête, repris de l'atelier PNJ.
  var TETES = [
    ['tete3', 0.47, 0.22, 1.25],    // cheveux longs et raides
    ['tete4', 0.5, 0.03, 1.1],      // cheveux bouclés, yeux fermés
    ['tete5', 0.40, 0, 1.05],       // casquette, dents en vrac
    ['tete6', 0.38, 0.22, 1.25],    // cheveux ondulés
    ['tete7', 0.48, 0, 1.2],        // crâne à cornes
    ['tete8', 0.47, 0, 1.05],       // singe
    ['tete9', 0.48, 0.33, 1.35],    // longs cheveux, yeux plissés
    ['tete10', 0.43, 0, 1.05],      // joufflu qui tire la langue
    ['tete11', 0.47, 0, 1.1],       // grand front, oreilles pointues
    ['tete12', 0.45, 0, 1.05],      // bosselé au monocle
    ['tete13', 0.43, 0, 1.1],       // gobelin
    ['tete14', 0.5, 0, 1.15],       // voile, bandeau de perles, oreilles pointues
    ['tete15', 0.5, 0.15, 1.3],     // cheveux en bataille, au feutre
    ['tete16', 0.5, 0.05, 1.25],    // profil à grandes dents
    ['tete17', 0.5, 0, 1.15],       // félin au crayon
    ['tete18', 0.5, 0, 1.1],        // crâne sur papier rose
    ['tete19', 0.5, 0, 1.1],        // gros yeux et cornes
    ['tete20', 0.5, 0.2, 1.25],     // diable aux yeux en croix, langue pendante
    ['tete21', 0.5, 0.03, 1.15],    // capuche, visage noir
    ['tete22', 0.58, 0, 0.85],      // cheveux en nuage, lunettes
    ['tete23', 0.5, 0.05, 1],       // aquarelle bleue, oreilles tombantes
    ['tete24', 0.45, 0.03, 1.2],    // rictus, longs cheveux, oreille pointue
    ['tete25', 0.5, 0, 1.1],        // bouclé, de trois quarts
    ['tete26', 0.5, 0, 1.2],        // coiffe en toile d'araignée
    ['tete27', 0.52, 0, 1.15],      // souris hilare
    ['tete28', 0.5, 0, 1.1],        // masque au stylo bleu
    ['tete29', 0.55, 0, 1.1],       // écailles au stylo violet
    ['tete30', 0.5, 0, 1.15]        // tigre qui rugit
  ];
  var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var RELAIS = 'wss://berao-salon.berao.workers.dev';   // l'adresse du relais (wss://berao-salon.….workers.dev) ; vide : la page ne se connecte à rien
  var R = {
    opacite: 0.65,                  // de 0.1 à 0.95 ; se règle aussi dans l'adresse (#fantomes-80)
    veille: 30,                     // secondes d'onglet caché avant de se déconnecter du relais
    max: coarse ? 12 : 20,          // corps affichés au plus : les plus proches du joueur
    fondu: 0.7,                     // secondes, à l'arrivée et au départ
    retard: 0.25,                   // le fantôme met ce temps à rejoindre la dernière position reçue (elles arrivent 5 fois par seconde)
    saut: 3,                        // au-delà (mètres) il ne court pas à travers le bar : il est déplacé d'un coup
    jets: 4                         // jets de pipi des autres visibles en même temps, au plus
  };
  var B = null, tous = {}, horloge = 0, tri = 0, demo = null, voulu = 0, panne = false, entrer = false;

  function siege(f) { return (f.s > 0 && B.siege && B.siege.liste[f.s - 1]) || null; }
  function nombre(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  // ---- Ce que le relais (ou la démonstration) annonce ----
  function arrive(id, e) {
    e = e || {};
    if (tous[id] && !tous[id].part) return bouge(id, e);
    var vieux = tous[id];                                               // il revient avant d'avoir fini de s'effacer : on garde son corps
    tous[id] = { id: id, tete: ((Math.round(nombre(e.tete, 0)) % TETES.length) + TETES.length) % TETES.length,
                 x: nombre(e.x, 0), z: nombre(e.z, 0), a: nombre(e.a, 0), s: Math.max(0, Math.round(nombre(e.s, 0))),
                 k: Math.round(nombre(e.k, 0)) & 255, h: nombre(e.h, 0), jet: vieux ? vieux.jet : null, vise: vieux ? vieux.vise : null,
                 nom: propre(e.nom) || (vieux ? vieux.nom : ''), etiq: vieux ? vieux.etiq : null,
                 pnj: vieux ? vieux.pnj : null, voile: vieux ? vieux.voile : 0, pose: vieux ? vieux.pose : 0, cap: vieux ? vieux.cap : 0,
                 elu: false, part: false, neuf: true, loin: 0 };
    if (vieux && vieux.tete !== tous[id].tete && vieux.pnj) { oterEtiquette(tous[id]); oterBulle(vieux); vieux.pnj.retirer(); tous[id].pnj = null; tous[id].voile = 0; tous[id].pose = 0; }
    tri = 0;
    return api;
  }
  // un pseudo affichable : sans caractères de contrôle, invisibles ou de sens d'écriture, 20 caractères au plus ('' sinon)
  function propre(v) {
    if (typeof v !== 'string') return '';
    var n = (v.normalize ? v.normalize('NFC') : v).replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, '').replace(/\s+/g, ' ').trim();
    return Array.from(n).slice(0, 20).join('').trim();
  }
  function bouge(id, e) {
    var f = tous[id]; if (!f || f.part || !e) return api;
    f.x = nombre(e.x, f.x); f.z = nombre(e.z, f.z); f.a = nombre(e.a, f.a);
    if (e.s !== undefined) f.s = Math.max(0, Math.round(nombre(e.s, 0)));
    if (e.k !== undefined) f.k = Math.round(nombre(e.k, 0)) & 255;
    if (e.h !== undefined) f.h = Math.max(-1.57, Math.min(1.57, nombre(e.h, 0)));
    if (e.nom !== undefined && propre(e.nom)) f.nom = propre(e.nom);
    f.neuf = true;
    return api;
  }
  function part(id) { var f = tous[id]; if (f) f.part = true; return api; }
  function vider() { for (var id in tous) tous[id].part = true; return api; }

  // ---- Leur corps ----
  function incarner(f) {
    var t = TETES[f.tete];
    f.pnj = B.pnj({ pos: [f.x, f.z], regard: f.a + Math.PI, face: 'regard', regardLibre: true, fantome: R.opacite, solide: false, portee: 0,
                    tete: t[0] + '.png', teteDos: t[0] + '-dos.png', cou: t[1], enfonce: t[2], grosseur: t[3] });
    f.pnj.voile(f.voile); f.pose = 0;
    if (siege(f)) poser(f, siege(f));
  }
  function taille(pose) { var t = B.pnjTaille || {}; return pose === 'tabouret' ? t.perche || 1.5 : pose === 'assis' ? t.assis || 1.5 : t.debout || 1.85; }
  function poser(f, S) {                                                // assis : sur le siège, tourné comme le siège, à la taille des PNJ assis du bar
    var n = f.pnj, cap = S.cap;
    if (S.genre === 'banc' && !S.dossier && Math.cos(f.a - cap) < 0) cap += Math.PI;   // un banc sans dossier : du côté où il regardait en s'asseyant
    n.placer(f.x, f.z);
    if (S.genre === 'tabouret') { n.options.taille = taille('tabouret'); n.percher(S.h); } else { n.options.taille = taille('assis'); n.asseoir(S.h); }
    f.pose = f.s; f.cap = cap;
  }
  // Où il regarde : là où regarde le visiteur (le cap du joueur, retourné : un PNJ compte ses angles depuis +z). Assis sur une chaise,
  // un banc ou une banquette, il ne se retourne pas tout à fait (70° de part et d'autre du siège) ; sur un tabouret il pivote librement.
  function regard(f, S) {
    if (!S || S.genre === 'tabouret') return f.a + Math.PI;
    var e = Math.atan2(Math.sin(f.a - f.cap), Math.cos(f.a - f.cap));
    return f.cap + Math.max(-1.2, Math.min(1.2, e)) + Math.PI;
  }
  function animer(f) {
    var n = f.pnj, S = siege(f), q = n.position(), dx = f.x - q[0], dz = f.z - q[1], d = Math.sqrt(dx * dx + dz * dz);
    if (S) {
      if (f.pose !== f.s) poser(f, S);
      else if (d > 0.02) n.placer(f.x, f.z);
    } else {
      if (f.pose) { n.options.taille = taille('debout'); n.lever(); n.placer(f.x, f.z); f.pose = 0; d = 0; }
      if (d > R.saut) n.placer(f.x, f.z);
      else if (d > 0.03) {
        if (f.neuf || !n.enMarche()) { n.options.vitesse = Math.max(0.5, Math.min(6, d / R.retard)); n.marcher(f.x, f.z); }
      }
    }
    n.regarder(regard(f, S));                                            // le PNJ tourne en douceur vers ce regard
    f.neuf = false;
  }
  // ---- Ce qu'ils font : le pipi ----
  // Le jet d'un autre visiteur est le même que celui du joueur (pipi.js, fabriqué par la page), pour l'œil seulement. Il part du
  // fantôme et va où le visiteur regarde. Quatre jets au plus à la fois ; un jet fini est démonté quand sa flaque a séché.
  var orphelins = [];
  function jetsVivants() { var n = orphelins.length, id; for (id in tous) if (tous[id].jet) n++; return n; }
  function arroser(f, dt) {
    var veut = !!(f.k & 1) && !!f.pnj && !f.part && !f.s && f.voile > 0.5;
    if (veut && !f.jet && B.jet && jetsVivants() < R.jets) {
      f.jet = B.jet();
      if (f.jet) { f.jet.groupe.traverse(function (m) { if (m.isMesh) m.renderOrder += 30; }); f.vise = { x: f.x, z: f.z, yaw: f.a, pitch: f.h }; }   // après les fantômes : devant eux, le jet se voit
    }
    if (!f.jet) return;
    if (!veut && f.jet.repos()) return;                                  // plus rien ne coule ni ne sèche : on n'y touche pas
    var q = f.pnj ? f.pnj.position() : [f.x, f.z], v = f.vise, k = Math.min(1, dt * 12);
    v.x = q[0]; v.z = q[1]; v.yaw += Math.atan2(Math.sin(f.a - v.yaw), Math.cos(f.a - v.yaw)) * k; v.pitch += (f.h - v.pitch) * k;
    if (veut) f.jet.ouvrir(); else if (f.jet.ouvert()) f.jet.fermer();
    f.jet.maj(dt, v);
  }
  function trinquer(f) {                                                // bit 2 : il boit une bière ; on le voit au moment où il s'y met
    var veut = !!(f.k & 2) && !!f.pnj && !f.part && f.voile > 0.5;
    if (veut && !f.bu && f.pnj.boire) f.pnj.boire(6.1);                 // le geste du visiteur dure 6 s ; celui du fantôme aussi
    f.bu = veut;
  }
  var ETIQ = { haut: 0.07, marge: 0.07, police: 13, opacite: 0.95 };   // hauteur de l'étiquette (m), écart au-dessus de la tête (m), taille du texte (px)
  function texteEtiquette(nom) {                                        // le pseudo, en pixels nets, blanc cassé sur un bandeau sombre
    var c = document.createElement('canvas'), g = c.getContext('2d'), P = ETIQ.police, font = 'bold ' + P + 'px "Courier New", Courier, monospace';
    g.font = font;
    var l = Math.ceil(g.measureText(nom).width) + 8, h = P + 5;
    c.width = l; c.height = h; g = c.getContext('2d'); g.font = font;
    g.fillStyle = 'rgba(20, 17, 13, 0.58)'; g.fillRect(0, 0, l, h);
    g.fillStyle = '#f4ead2'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(nom, l / 2, h / 2 + 0.5);
    var t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    return { tex: t, l: l, h: h };
  }
  function etiqueter(f) {
    var p = f.pnj;
    if (!p || !f.nom || !p.groupe || !p.morceaux || !window.THREE) { oterEtiquette(f); return; }
    var E = f.etiq;
    if (E && (E.nom !== f.nom || E.pnj !== p)) { oterEtiquette(f); E = null; }
    if (!E) {
      var t = texteEtiquette(f.nom);
      var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t.tex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      m.scale.set(ETIQ.haut * t.l / t.h, ETIQ.haut, 1); m.renderOrder = 19.9;   // après les fantômes, avant la main de la télé
      p.groupe.add(m);
      E = f.etiq = { nom: f.nom, pnj: p, m: m, tex: t.tex };
    }
    var te = p.morceaux.tete, v = B.view(), gp = p.groupe.position;
    var haut = te.visible ? p.corps.position.y + te.position.y + te.scale.y : 1.9;   // le haut de sa tête
    E.m.position.set(0, haut + ETIQ.marge + ETIQ.haut / 2, 0);
    E.m.rotation.y = Math.atan2(v.x - gp.x, v.z - gp.z) - p.groupe.rotation.y;     // tournée vers le joueur
    E.m.material.opacity = ETIQ.opacite * Math.max(0, Math.min(1, f.voile));
    E.m.visible = te.visible && f.voile > 0.02;
  }
  function texteBulle(txt) {
    var mots = txt.split(' '), lignes = [], l = '', i, MAXC = 22;
    for (i = 0; i < mots.length; i++) {
      var m = mots[i];
      while (Array.from(m).length > MAXC) { if (l) { lignes.push(l); l = ''; } lignes.push(Array.from(m).slice(0, MAXC).join('')); m = Array.from(m).slice(MAXC).join(''); }
      if (!l) l = m; else if (Array.from(l + ' ' + m).length <= MAXC) l += ' ' + m; else { lignes.push(l); l = m; }
    }
    if (l) lignes.push(l);
    if (lignes.length > 4) { lignes = lignes.slice(0, 4); lignes[3] = Array.from(lignes[3]).slice(0, MAXC - 1).join('') + '…'; }
    var c = document.createElement('canvas'), g = c.getContext('2d'), P = ETIQ.police, font = P + 'px "Courier New", Courier, monospace', lh = P + 3;
    g.font = font;
    var w = 0; lignes.forEach(function (x) { w = Math.max(w, g.measureText(x).width); });
    var L = Math.ceil(w) + 12, H = lignes.length * lh + 9 + 5;
    c.width = L; c.height = H; g = c.getContext('2d'); g.font = font;
    g.fillStyle = 'rgba(244, 234, 210, 0.92)'; g.fillRect(0, 0, L, H - 5);                    // la bulle, et sa pointe vers la tête
    g.beginPath(); g.moveTo(L / 2 - 5, H - 5); g.lineTo(L / 2 + 5, H - 5); g.lineTo(L / 2, H); g.closePath(); g.fill();
    g.fillStyle = '#17100b'; g.textBaseline = 'top'; g.textAlign = 'center';
    lignes.forEach(function (x, k) { g.fillText(x, L / 2, 5 + k * lh); });
    var t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    return { tex: t, l: L, h: H };
  }
  function bullifier(f, dt) {                                           // la bulle de ce qu'il vient de dire, au-dessus de son étiquette
    var b = f.bulle, p = f.pnj;
    if (!b) return;
    b.t -= dt;
    if (b.t <= 0 || !p || !f.etiq || muets[f.id.slice(2)]) { oterBulle(f); return; }
    if (b.vu !== b.txt || (b.mesh && b.mesh.parent !== p.groupe)) {
      if (b.mesh) { if (b.mesh.parent) b.mesh.parent.remove(b.mesh); try { b.mesh.material.map.dispose(); b.mesh.material.dispose(); b.mesh.geometry.dispose(); } catch (e) {} }
      var t = texteBulle(b.txt), k = ETIQ.haut * 0.95 / (ETIQ.police + 5);              // même taille de lettre que l'étiquette
      b.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t.tex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      b.mesh.scale.set(t.l * k, t.h * k, 1); b.mesh.renderOrder = 19.95; b.vu = b.txt;
      p.groupe.add(b.mesh);
    }
    var E = f.etiq.m;
    b.mesh.position.set(0, E.position.y + ETIQ.haut / 2 + 0.03 + b.mesh.scale.y / 2, 0);
    b.mesh.rotation.y = E.rotation.y;
    b.mesh.material.opacity = Math.min(1, b.t / 0.5) * Math.max(0, Math.min(1, f.voile));
    b.mesh.visible = E.visible;
  }
  function oterBulle(f) {
    var b = f && f.bulle; if (!b) return;
    if (b.mesh) { if (b.mesh.parent) b.mesh.parent.remove(b.mesh); try { b.mesh.material.map.dispose(); b.mesh.material.dispose(); b.mesh.geometry.dispose(); } catch (e) {} }
    f.bulle = null;
  }
  function oterEtiquette(f) {
    var E = f && f.etiq; if (!E) return;
    if (E.m.parent) E.m.parent.remove(E.m);
    try { E.tex.dispose(); E.m.material.dispose(); E.m.geometry.dispose(); } catch (e) {}
    f.etiq = null;
  }
  function lacher(f) {                                                  // le fantôme s'en va : son jet finit de couler tout seul
    if (!f.jet) return;
    if (f.jet.ouvert()) f.jet.fermer();
    orphelins.push({ jet: f.jet, vise: f.vise, age: 0 }); f.jet = null;
  }
  function demonter(jet) {
    var g = jet.groupe; if (g.parent) g.parent.remove(g);
    g.traverse(function (m) { if (m.geometry && m.geometry.dispose) m.geometry.dispose(); if (m.material) { if (m.material.map && m.material.map.dispose) m.material.map.dispose(); if (m.material.dispose) m.material.dispose(); } });
  }
  function finirJets(dt) {
    for (var i = orphelins.length - 1; i >= 0; i--) {
      var o = orphelins[i]; o.age += dt;
      if (o.jet.ouvert()) o.jet.fermer();
      o.jet.maj(dt, o.vise);
      if (o.jet.repos() || o.age > 40) { demonter(o.jet); orphelins.splice(i, 1); }
    }
  }

  function choisir() {                                                  // qui a droit à un corps : les plus proches du joueur
    var v = B.view(), l = [], id, f;
    for (id in tous) { f = tous[id]; f.loin = (f.x - v.x) * (f.x - v.x) + (f.z - v.z) * (f.z - v.z); if (!f.part) l.push(f); }
    l.sort(function (a, b) { return a.loin - b.loin; });
    l.forEach(function (f, k) { f.elu = k < R.max; });
  }

  // Appelée par la page à chaque image. Quoi qu'il arrive ici, le bar continue : à la première erreur, les fantômes s'arrêtent.
  function maj(dt) {
    if (panne) return;
    try { avancer(dt); } catch (e) { panne = true; if (window.console) console.warn('fantomes.js arrêté : ' + (e && e.message)); }
  }
  function avancer(dt) {
    if (!B) {
      if (!(window.bodega && window.bodega.pnj && window.bodega.view && window.PNJ)) return;
      B = window.bodega;
      if (voulu) lancerDemo(voulu); else if (RELAIS) entrer = true;
    }
    if (entrer && !(window.BodegaIntro && window.BodegaIntro.etat === 'facade')) { entrer = false; connecter(RELAIS); }   // il est entré dans le bar
    if (!(dt > 0)) dt = 0;
    horloge += dt;
    if (demo) demo.maj(dt);
    relayer(dt);
    tri -= dt; if (tri <= 0) { tri = 0.5; choisir(); }
    var id, f, cible, pas = R.fondu > 0 ? dt / R.fondu : 1, neuf = false;
    for (id in tous) {
      f = tous[id]; cible = (f.part || !f.elu) ? 0 : 1;
      if (!f.pnj && cible && !neuf) { incarner(f); neuf = true; }       // un corps de plus par image, pas davantage : fabriquer ses textures prend quelques millisecondes
      arroser(f, dt); trinquer(f);
      if (f.pnj) {
        if (!f.part) animer(f);
        f.voile += Math.max(-pas, Math.min(pas, cible - f.voile));
        f.pnj.voile(f.voile);
        etiqueter(f); bullifier(f, dt);
        if (!cible && f.voile <= 0) { oterBulle(f); oterEtiquette(f); f.pnj.retirer(); f.pnj = null; f.pose = 0; }
      }
      if (f.part && !f.pnj) { lacher(f); delete tous[id]; }
    }
    finirJets(dt);
  }

  // ---- Le relais : les vrais visiteurs ----
  // Ce qui s'échange est décrit dans salon/src/bar.js. Tout ce qui arrive du relais est traité comme une donnée douteuse :
  // des nombres vérifiés, un nombre de fantômes plafonné, rien d'autre que des positions.
  var DELAIS = [1, 2, 5, 10, 30, 60, 60, 60, 300];                      // secondes avant de réessayer, d'échec en échec
  var net = { url: '', ws: null, etat: 'ferme', id: null, nom: null, tete: null, essais: 0, attente: 0, envoi: 0, battement: 0,
              dernier: null, envoyes: 0, recus: 0, pause: false, plein: false, veille: 0, chat: true, expulse: false };
  var ecouteurs = [], muets = {};                                       // le chat : qui écoute (chat.js), qui est masqué (sur cette page seulement)
  function prevenir(m) { for (var i = 0; i < ecouteurs.length; i++) { try { ecouteurs[i](m); } catch (e) {} } }
  function purger() { for (var id in tous) if (id.slice(0, 2) === 'r:') tous[id].part = true; }
  function distants() { var n = 0; for (var id in tous) if (id.slice(0, 2) === 'r:' && !tous[id].part) n++; return n; }
  function venir(id, tete, nom, x, z, a, s, k, h) {
    if (typeof id !== 'string' || !id || id.length > 12 || id === net.id || distants() >= 40) return;
    arrive('r:' + id, { tete: nombre(tete, 0), x: nombre(x, 0) / 100, z: nombre(z, 0) / 100, a: nombre(a, 0) * Math.PI / 180, s: nombre(s, 0), k: nombre(k, 0), h: nombre(h, 0) * Math.PI / 180 });
    if (tous['r:' + id]) tous['r:' + id].nom = propre(nom);
  }
  function propre140(v) {                                               // un message du chat affichable (140 caractères au plus)
    if (typeof v !== 'string') return '';
    var n = (v.normalize ? v.normalize('NFC') : v).replace(/[\t\n\r\f\v]/g, ' ').replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, '').replace(/\s+/g, ' ').trim();
    return Array.from(n).slice(0, 140).join('').trim();
  }
  function envoyerChat(txt) {
    txt = propre140(txt);
    if (!txt || !net.ws || net.etat !== 'ouvert' || !net.id) return false;
    try { net.ws.send(JSON.stringify({ t: 'm', txt: txt })); return true; } catch (e) { return false; }
  }
  function ordonner(cle, ordre, id) {
    if (!net.ws || net.etat !== 'ouvert' || typeof cle !== 'string' || !cle) return false;
    var o = { t: 'admin', cle: cle, ordre: ordre }; if (id) o.id = id;
    try { net.ws.send(JSON.stringify(o)); return true; } catch (e) { return false; }
  }
  function monPseudo() {                                                 // celui tapé à l'entrée, sinon le dernier gardé dans ce navigateur
    var I = window.BodegaIntro, p = I && I.pseudo ? I.pseudo : '';
    if (!p) { try { p = localStorage.getItem('berao-pseudo') || ''; } catch (e) { p = ''; } }
    return propre(p);
  }
  function recevoir(texte) {
    if (typeof texte !== 'string' || texte === 'pong' || texte.length > 8000) return;
    var m; try { m = JSON.parse(texte); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    net.recus++;
    if (m.t === 'w') {                                                  // bienvenue : qui l'on est, qui est déjà là
      net.id = String(m.id); net.nom = String(m.nom || ''); net.chat = m.chat !== false; net.tete = nombre(m.tete, 0); net.dernier = null; net.envoi = 0;
      purger();
      (m.les instanceof Array ? m.les : []).slice(0, 40).forEach(function (l) { if (l instanceof Array && l.length >= 7) venir(l[0], l[1], l[2], l[3], l[4], l[5], l[6], l[7], l[8]); });
      var ps = monPseudo();                                             // le pseudo tapé à l'entrée : il remplace « Guest n » chez les autres
      if (ps && net.ws) { try { net.ws.send(JSON.stringify({ t: 'n', nom: ps })); net.nom = ps; } catch (e) {} }
    } else if (m.t === '+') venir(m.id, m.tete, m.nom, m.x, m.z, m.a, m.s, m.k, m.h);
    else if (m.t === 'p') { if (typeof m.id === 'string' && tous['r:' + m.id]) bouge('r:' + m.id, { x: nombre(m.x, 0) / 100, z: nombre(m.z, 0) / 100, a: nombre(m.a, 0) * Math.PI / 180, s: nombre(m.s, 0), k: nombre(m.k, 0), h: nombre(m.h, 0) * Math.PI / 180 }); }
    else if (m.t === 'n') { if (typeof m.id === 'string' && tous['r:' + m.id] && propre(m.nom)) tous['r:' + m.id].nom = propre(m.nom); }   // il donne son pseudo
    else if (m.t === '-') { if (typeof m.id === 'string') part('r:' + m.id); }
    else if (m.t === 'm') {                                             // un message du chat
      if (typeof m.id !== 'string' || typeof m.txt !== 'string') return;
      var txt = propre140(m.txt), qui = tous['r:' + m.id], nom = propre(m.nom) || (qui ? qui.nom : '') || '?';
      if (!txt) return;
      if (qui && !muets[m.id]) qui.bulle = { txt: txt, t: Math.min(9, 4 + Array.from(txt).length / 15), mesh: qui.bulle ? qui.bulle.mesh : null, vu: '' };
      prevenir({ t: 'm', id: m.id, nom: nom, txt: txt, moi: m.id === net.id });
    }
    else if (m.t === 'chat') { net.chat = m.ouvert !== false; prevenir({ t: 'chat', ouvert: net.chat }); }
    else if (m.t === 'refus') prevenir({ t: 'refus', pourquoi: String(m.pourquoi || '') });
    else if (m.t === 'admin') prevenir({ t: 'admin', ok: !!m.ok, chat: m.chat !== false });
    else if (m.t === 'expulse') { net.expulse = true; prevenir({ t: 'expulse' }); deconnecter(); }   // expulsé : on ne revient pas tout seul
    else if (m.t === 'plein') net.plein = true;                         // la salle est pleine : on réessaiera plus tard
  }
  function ouvrir() {
    if (!net.url || net.ws || typeof WebSocket === 'undefined') return;
    var ws; net.etat = 'ouvre';
    try { ws = new WebSocket(net.url); } catch (e) { perdre(); return; }
    net.ws = ws;
    ws.onopen = function () { if (net.ws !== ws) return; net.etat = 'ouvert'; net.essais = 0; net.dernier = null; net.envoi = 0; net.battement = 25; };
    ws.onmessage = function (ev) { if (net.ws === ws) recevoir(ev.data); };
    ws.onclose = ws.onerror = function () { if (net.ws !== ws) return; net.ws = null; perdre(); };
  }
  function perdre() {                                                   // connexion perdue ou refusée : les fantômes s'effacent, on réessaiera
    purger(); net.id = null;
    if (!net.url) { net.etat = 'ferme'; return; }
    net.etat = 'attente';
    net.attente = net.pause ? Infinity : net.plein ? 120 : DELAIS[Math.min(net.essais, DELAIS.length - 1)] * (0.8 + 0.4 * Math.random());
    net.essais++; net.plein = false;
  }
  function connecter(url) {
    deconnecter();
    net.url = String(url || ''); net.essais = 0; net.pause = false;
    if (net.url) ouvrir();
    return api;
  }
  function deconnecter() {
    var ws = net.ws; net.url = ''; net.ws = null; net.etat = 'ferme'; net.id = null;
    if (ws) { ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null; try { ws.close(1000, 'au revoir'); } catch (e) {} }
    purger();
    return api;
  }
  function moi() {                                                      // ce que les autres doivent voir du joueur : centimètres, degrés, siège
    var v = B.view(), x = v.x, z = v.z, s = 0, S = B.siege, r;
    if (S && B.tele && B.tele.etat && B.tele.etat() !== 'salle' && S.tele >= 0 && S.liste[S.tele]) { s = S.tele + 1; x = S.liste[S.tele].ax; z = S.liste[S.tele].az; }   // devant la télé : sur sa chaise
    else if (S && S.rang) { r = S.rang(); if (r >= 0) s = r + 1; }
    var cap = v.yaw; if (s && S.tele >= 0 && s === S.tele + 1 && B.tele.cap && typeof B.tele.cap() === 'number') cap = B.tele.cap();   // devant la télé : il regarde la télé
    var k = (B.pipi && B.pipi.ouvert && B.pipi.ouvert()) ? 1 : 0;                               // ce qu'il fait : 1 = pipi
    if (B.BOIRE && B.BOIRE.actif) k |= 2;                                                       // 2 = il boit une bière
    return { x: Math.round(x * 100), z: Math.round(z * 100), a: ((Math.round(cap * 180 / Math.PI) % 360) + 360) % 360, s: s,
             k: k, h: (k & 1) ? Math.max(-90, Math.min(90, Math.round((v.pitch || 0) * 180 / Math.PI))) : 0 };
  }
  function relayer(dt) {
    if (!net.url) return;
    if (net.etat === 'attente') { net.attente -= dt; if (net.attente <= 0) ouvrir(); return; }
    if (net.etat !== 'ouvert' || !net.ws || !net.id) return;
    net.envoi -= dt; net.battement -= dt;
    if (net.envoi <= 0) {
      var e = moi(), d = net.dernier, da = d ? Math.abs(((e.a - d.a + 540) % 360) - 180) : 0;
      // on n'envoie que ce qui change : un pas (2 cm), un regard (3° ; en plein pipi 2°, et aussi sa hauteur), un siège, une action
      if (!d || e.s !== d.s || e.k !== d.k || Math.abs(e.x - d.x) > 2 || Math.abs(e.z - d.z) > 2 || da > ((e.k & 1) ? 2 : 3) || ((e.k & 1) && Math.abs(e.h - d.h) > 2)) {
        try { net.ws.send(JSON.stringify(e.k ? { t: 'p', x: e.x, z: e.z, a: e.a, s: e.s, k: e.k, h: e.h } : { t: 'p', x: e.x, z: e.z, a: e.a, s: e.s })); net.envoyes++; } catch (err) {}
        net.dernier = e; net.envoi = 0.2; net.battement = 25;
      }
    }
    if (net.battement <= 0) { try { net.ws.send('ping'); } catch (err) {} net.battement = 25; }   // de loin en loin, pour que la connexion ne soit pas coupée en route
  }
  // Onglet caché : au bout de trente secondes on se déconnecte (les autres voient le fantôme partir) ; de retour, on se reconnecte.
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', function () {
    clearTimeout(net.veille);
    if (document.hidden) net.veille = setTimeout(function () { if (document.hidden && net.ws) { net.pause = true; try { net.ws.close(1000, 'onglet caché'); } catch (e) {} } }, R.veille * 1000);
    else if (net.pause) { net.pause = false; net.essais = 0; if (net.etat === 'attente') net.attente = 0; }
  });

  // ---- La démonstration : des visiteurs inventés, qui passent par le même chemin que les vrais (arrive / bouge / part) ----
  function hasard(graine) {                                             // tirage reproductible
    var s = graine >>> 0;
    return function () { s = (s + 0x6D2B79F5) >>> 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function lancerDemo(n, graine) {
    if (demo) { demo.finir(); demo = null; }
    n = Math.max(0, Math.min(30, Math.round(n || 0)));
    if (!n || !B) { voulu = n; return api; }
    var alea = hasard(graine === undefined ? 20191116 : graine);
    // Le plancher : une grille de cases de 15 cm où un visiteur tient debout, atteintes de proche en proche depuis le joueur.
    var C = (B.colliders || []).filter(function (c) { return !c.jet; }), ray = (B.radius || 0.2) + 0.05, PAS = 0.15;
    var x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    C.forEach(function (c) { x0 = Math.min(x0, c.ax, c.bx); x1 = Math.max(x1, c.ax, c.bx); z0 = Math.min(z0, c.az, c.bz); z1 = Math.max(z1, c.az, c.bz); });
    function libre(x, z) {
      for (var i = 0; i < C.length; i++) {
        var c = C[i], ex = c.bx - c.ax, ez = c.bz - c.az, l2 = ex * ex + ez * ez, t = l2 > 0 ? ((x - c.ax) * ex + (z - c.az) * ez) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        var dx = x - (c.ax + ex * t), dz = z - (c.az + ez * t);
        if (dx * dx + dz * dz < (ray + (c.pad || 0)) * (ray + (c.pad || 0))) return false;
      }
      return true;
    }
    var NX = Math.max(1, Math.ceil((x1 - x0) / PAS) + 1), NZ = Math.max(1, Math.ceil((z1 - z0) / PAS) + 1);
    var atteinte = new Uint8Array(NX * NZ), cases = [];
    function rang(x, z) { var i = Math.round((x - x0) / PAS), j = Math.round((z - z0) / PAS); return (i < 0 || j < 0 || i >= NX || j >= NZ) ? -1 : j * NX + i; }
    function centre(k) { return [x0 + (k % NX) * PAS, z0 + Math.floor(k / NX) * PAS]; }
    (function () {
      var v = B.view(), k = rang(v.x, v.z), file, p, q, i, j, d;
      if (k < 0) return;
      if (!libre(centre(k)[0], centre(k)[1])) {                         // le joueur est assis, ou collé à un meuble : la case libre la plus proche
        var mieux = -1, dm = Infinity;
        for (j = 0; j < NX * NZ; j++) { p = centre(j); d = (p[0] - v.x) * (p[0] - v.x) + (p[1] - v.z) * (p[1] - v.z); if (d < dm && d < 4 && libre(p[0], p[1])) { dm = d; mieux = j; } }
        if (mieux < 0) return; k = mieux;
      }
      file = [k]; atteinte[k] = 1;
      while (file.length) {
        p = file.pop(); cases.push(p); i = p % NX; j = Math.floor(p / NX);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (dd) {
          var a = i + dd[0], b = j + dd[1]; if (a < 0 || b < 0 || a >= NX || b >= NZ) return;
          q = b * NX + a; if (atteinte[q]) return;
          if (libre(x0 + a * PAS, z0 + b * PAS)) { atteinte[q] = 1; file.push(q); }
        });
      }
    })();
    if (!cases.length) return api;                                      // pas de plancher : pas de démonstration
    function droit(a, b) {                                              // peut-on aller de a à b en ligne droite ?
      var dx = b[0] - a[0], dz = b[1] - a[1], n = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dz * dz) / 0.08)), i, k;
      for (i = 1; i < n; i++) { k = rang(a[0] + dx * i / n, a[1] + dz * i / n); if (k < 0 || !atteinte[k]) return false; }
      return true;
    }
    function chemin(de, vers) {                                         // de case en case, puis redressé : des lignes droites entre les meubles
      var a = rang(de[0], de[1]), b = rang(vers[0], vers[1]); if (a < 0 || b < 0 || !atteinte[b]) return null;
      if (!atteinte[a]) return [vers];
      var d = new Int32Array(NX * NZ).fill(-1), file = [a], t = 0, p, i, j, q, k, m;
      d[a] = a;
      while (t < file.length && d[b] < 0) {
        p = file[t++]; i = p % NX; j = Math.floor(p / NX);
        for (k = 0; k < 4; k++) {
          var ai = i + [1, -1, 0, 0][k], bj = j + [0, 0, 1, -1][k]; if (ai < 0 || bj < 0 || ai >= NX || bj >= NZ) continue;
          q = bj * NX + ai; if (d[q] >= 0 || !atteinte[q]) continue;
          d[q] = p; file.push(q);
        }
      }
      if (d[b] < 0) return null;
      var pts = []; for (p = b; p !== a; p = d[p]) pts.push(centre(p)); pts.push(de); pts.reverse();
      var net = [], cur = 0;
      while (cur < pts.length - 1) { m = pts.length - 1; while (m > cur + 1 && !droit(pts[cur], pts[m])) m--; net.push(pts[m]); cur = m; }
      return net;
    }
    function caseAuHasard() { return centre(cases[Math.floor(alea() * cases.length)]); }
    function pres(x, z, portee) {                                       // la case atteinte la plus proche d'un point, à portée
      var mieux = null, dm = portee * portee, m = Math.ceil(portee / PAS), i0 = Math.round((x - x0) / PAS), j0 = Math.round((z - z0) / PAS), i, j, p, d;
      for (j = j0 - m; j <= j0 + m; j++) for (i = i0 - m; i <= i0 + m; i++) {
        if (i < 0 || j < 0 || i >= NX || j >= NZ || !atteinte[j * NX + i]) continue;
        p = [x0 + i * PAS, z0 + j * PAS]; d = (p[0] - x) * (p[0] - x) + (p[1] - z) * (p[1] - z);
        if (d < dm) { dm = d; mieux = p; }
      }
      return mieux;
    }
    var sieges = (B.siege && B.siege.liste) || [], pris = {}, VITESSE = 1.5, CADENCE = 0.2;
    var tetes = TETES.map(function (t, k) { return k; }), k, x, tmp;
    for (k = tetes.length - 1; k > 0; k--) { x = Math.floor(alea() * (k + 1)); tmp = tetes[k]; tetes[k] = tetes[x]; tetes[x] = tmp; }
    var v0 = B.view(), gens = [];
    for (k = 0; k < n; k++) {
      var p = caseAuHasard(), essais = 0;
      while (essais++ < 40 && ((p[0] - v0.x) * (p[0] - v0.x) + (p[1] - v0.z) * (p[1] - v0.z) < 1.4 || gens.some(function (g) { return (g.x - p[0]) * (g.x - p[0]) + (g.z - p[1]) * (g.z - p[1]) < 0.6; }))) p = caseAuHasard();
      var g = { id: 'demo' + (k + 1), x: p[0], z: p[1], a: alea() * 6.283, s: 0, mode: 'pause', attente: 0.5 + alea() * 3, route: null, etape: 0, vise: -1, retour: null, cap: 0, phase: alea() * 6.283, envoi: alea() * CADENCE };
      gens.push(g); arrive(g.id, { tete: tetes[k % tetes.length], x: g.x, z: g.z, a: g.a, s: 0, nom: 'Guest ' + (1 + Math.floor(alea() * 99)) });
    }
    function partir(g) {                                                // où va-t-il ? Une fois sur trois vers un siège libre, sinon ailleurs dans le bar
      var libres = [], i, r, but, q;
      if (alea() < 0.38) for (i = 0; i < sieges.length; i++) if (!pris[i]) libres.push(i);
      if (libres.length) {
        i = libres[Math.floor(alea() * libres.length)]; var S = sieges[i], u = alea();
        but = [S.ax + (S.bx - S.ax) * u, S.az + (S.bz - S.az) * u]; q = pres(but[0], but[1], 1.1);
        r = q && chemin([g.x, g.z], q);
        if (r) { pris[i] = g.id; g.vise = i; g.place = but; g.retour = q; g.route = r; g.etape = 0; g.mode = 'marche'; return; }
      }
      for (i = 0; i < 6; i++) {
        but = caseAuHasard(); if ((but[0] - g.x) * (but[0] - g.x) + (but[1] - g.z) * (but[1] - g.z) < 2.2) continue;
        r = chemin([g.x, g.z], but);
        if (r) { g.vise = -1; g.route = r; g.etape = 0; g.mode = 'marche'; return; }
      }
      g.attente = 1 + alea() * 2;
    }
    demo = {
      gens: gens, cases: cases.length,
      maj: function (dt) {
        gens.forEach(function (g) {
          if (g.mode === 'marche') {
            var reste = VITESSE * dt;
            while (reste > 0 && g.etape < g.route.length) {
              var c = g.route[g.etape], dx = c[0] - g.x, dz = c[1] - g.z, d = Math.sqrt(dx * dx + dz * dz);
              if (d > 1e-6) g.a = Math.atan2(-dx, -dz);                 // le cap du joueur : 0 = vers le nord (z négatif)
              if (d <= reste) { g.x = c[0]; g.z = c[1]; reste -= d; g.etape++; } else { g.x += dx / d * reste; g.z += dz / d * reste; reste = 0; }
            }
            if (g.etape >= g.route.length) {
              if (g.vise >= 0) { var S = sieges[g.vise]; g.cap = S.cap; g.a = S.cap; g.x = g.place[0]; g.z = g.place[1]; g.s = g.vise + 1; g.mode = 'assis'; g.attente = 6 + alea() * 9; }
              else { g.mode = 'pause'; g.attente = 1.5 + alea() * 4; if (alea() < 0.3) { g.pipi = 2 + alea() * 2.5; g.attente = Math.max(g.attente, g.pipi + 0.8); } else if (alea() < 0.35) { g.biere = 6.2; g.attente = Math.max(g.attente, 6.8); } }
            }
          } else if (g.mode === 'assis') {
            g.attente -= dt; g.a = g.cap + 0.6 * Math.sin(horloge * 0.5 + g.phase);          // assis, il tourne la tête
            if (g.attente <= 0) { delete pris[g.vise]; g.vise = -1; g.s = 0; g.x = g.retour[0]; g.z = g.retour[1]; g.mode = 'pause'; g.attente = 0.8 + alea() * 1.5; }
          } else {
            g.attente -= dt; g.a += 0.5 * Math.sin(horloge * 0.6 + g.phase) * dt;             // debout, il regarde autour de lui
            if (g.pipi > 0) { g.pipi -= dt; g.k = 1; g.h = -0.62 + 0.12 * Math.sin(horloge * 1.7 + g.phase); g.a += 0.45 * dt; } else { g.k = 0; g.h = 0; }
            if (g.biere > 0) { g.biere -= dt; g.k |= 2; }                    // ou il boit une bière   // parfois, il fait pipi en tournant un peu
            if (g.attente <= 0) partir(g);
          }
          g.envoi -= dt;
          if (g.envoi <= 0) { g.envoi += CADENCE; if (g.envoi < 0) g.envoi = 0; bouge(g.id, { x: g.x, z: g.z, a: g.a, s: g.s, k: g.mode === 'pause' ? g.k || 0 : 0, h: g.h || 0 }); }   // cinq positions par seconde, comme le relais
        });
      },
      finir: function () { gens.forEach(function (g) { part(g.id); }); }
    };
    voulu = n;
    return api;
  }

  // Dans l'adresse : #fantomes, #fantomes12, #fantomes-80, #fantomes12-50, ?fantomes=demo, ?fantomes=12, &opacite=80
  (function () {
    var m = null, o = null, ici = '';
    try { ici = String(location.search || '') + String(location.hash || ''); } catch (e) {}
    m = /[?&#]fantomes=?(?:demo)?(\d*)(?:-(\d{1,3}))?/.exec(ici); o = /[?&#]opacite=(\d{1,3})/.exec(ici);
    if (m) voulu = Math.max(1, Math.min(30, m[1] ? parseInt(m[1], 10) : 3));
    o = o ? o[1] : m ? m[2] : null;
    if (o) R.opacite = Math.max(10, Math.min(95, parseInt(o, 10))) / 100;
  })();

  var api = {
    arrive: arrive, bouge: bouge, part: part, vider: vider, maj: maj, reglages: R, tetes: TETES, enPanne: function () { return panne; },
    connecter: connecter, deconnecter: deconnecter,
    // le chat (pour chat.js) : envoyer un message, écouter ce qui arrive, masquer quelqu'un (ici seulement), modérer avec la clé
    chat: {
      envoyer: envoyerChat,
      ecouter: function (f) { if (typeof f === 'function') ecouteurs.push(f); },
      pret: function () { return net.etat === 'ouvert' && !!net.id; },
      ouvert: function () { return net.chat; },
      expulse: function () { return net.expulse; },
      moi: function () { return { id: net.id, nom: net.nom }; },
      muet: function (id, oui) { if (oui) muets[id] = true; else delete muets[id]; },
      estMuet: function (id) { return !!muets[id]; },
      admin: ordonner
    },
    reseau: function () { return { url: net.url, etat: net.etat, id: net.id, nom: net.nom, tete: net.tete, essais: net.essais, attente: net.attente, envoyes: net.envoyes, recus: net.recus, distants: distants() }; },
    demo: function (n, graine) { return lancerDemo(n, graine); },
    enDemo: function () { return demo ? demo.gens.length : 0; },
    // pour les essais : chaque fantôme, là où le visiteur est (x, z) et là où son corps en est (px, pz)
    liste: function () {
      var l = [], id, f, q;
      for (id in tous) {
        f = tous[id]; q = f.pnj ? f.pnj.position() : null;
        l.push({ id: id, nom: f.nom || null, bulle: f.bulle ? { txt: f.bulle.txt, visible: !!(f.bulle.mesh && f.bulle.mesh.visible), y: f.bulle.mesh ? f.bulle.mesh.position.y : null } : null, etiquette: f.etiq ? { nom: f.etiq.nom, visible: f.etiq.m.visible, y: f.etiq.m.position.y, opacite: f.etiq.m.material.opacity } : null, tete: TETES[f.tete][0], x: f.x, z: f.z, a: f.a, s: f.s, k: f.k, h: f.h, jet: f.jet ? (f.jet.ouvert() ? 'coule' : f.jet.repos() ? 'repos' : 'finit') : null, boit: !!(f.pnj && f.pnj.boit && f.pnj.boit()), corps: !!f.pnj, voile: f.voile, part: f.part, elu: f.elu,
                 px: q ? q[0] : null, pz: q ? q[1] : null, pose: f.pnj ? f.pnj.options.pose : null, marche: f.pnj ? f.pnj.enMarche() : false });
      }
      return l;
    },
    corps: function (id) { return tous[id] ? tous[id].pnj : null; },
    jet: function (id) { return tous[id] ? tous[id].jet : null; }, jetsFinissants: function () { return orphelins.length; }
  };
  return api;
})();
