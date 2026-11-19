/* fantomes.js : les autres visiteurs du bar, en fantômes (aucune dépendance de plus : il se sert de pnj.js et de la page).

   Un fantôme = le PNJ du bar dans sa tenue commune, à 65 % d'opacité (réglage « opacite »), avec une des têtes dessinées par Léo
   (pnj/tete3.png … tete30.png et leur dos), tirée au hasard pour chaque visiteur. On le traverse, on ne lui parle pas, le pipi
   ne le touche pas. Il marche là où marche le visiteur, regarde où il regarde, s'assoit sur le siège où il s'assoit.

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

     FANTOMES.arrive('a7', { tete: 4, x: 1.2, z: 0.5, a: 0, s: 0 });   // tete : rang dans TETES ; x, z en mètres ; a : cap du visiteur
                                                                       // (radians, celui du joueur : 0 = vers le nord) ; s : 0 debout,
                                                                       // n = assis sur le siège n - 1 de bodega.siege.liste
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
    saut: 3                         // au-delà (mètres) il ne court pas à travers le bar : il est déplacé d'un coup
  };
  var B = null, tous = {}, horloge = 0, tri = 0, demo = null, voulu = 0, panne = false;

  function siege(f) { return (f.s > 0 && B.siege && B.siege.liste[f.s - 1]) || null; }
  function nombre(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  // ---- Ce que le relais (ou la démonstration) annonce ----
  function arrive(id, e) {
    e = e || {};
    if (tous[id] && !tous[id].part) return bouge(id, e);
    var vieux = tous[id];                                               // il revient avant d'avoir fini de s'effacer : on garde son corps
    tous[id] = { id: id, tete: ((Math.round(nombre(e.tete, 0)) % TETES.length) + TETES.length) % TETES.length,
                 x: nombre(e.x, 0), z: nombre(e.z, 0), a: nombre(e.a, 0), s: Math.max(0, Math.round(nombre(e.s, 0))),
                 pnj: vieux ? vieux.pnj : null, voile: vieux ? vieux.voile : 0, pose: vieux ? vieux.pose : 0, cap: vieux ? vieux.cap : 0,
                 elu: false, part: false, neuf: true, loin: 0 };
    if (vieux && vieux.tete !== tous[id].tete && vieux.pnj) { vieux.pnj.retirer(); tous[id].pnj = null; tous[id].voile = 0; tous[id].pose = 0; }
    tri = 0;
    return api;
  }
  function bouge(id, e) {
    var f = tous[id]; if (!f || f.part || !e) return api;
    f.x = nombre(e.x, f.x); f.z = nombre(e.z, f.z); f.a = nombre(e.a, f.a);
    if (e.s !== undefined) f.s = Math.max(0, Math.round(nombre(e.s, 0)));
    f.neuf = true;
    return api;
  }
  function part(id) { var f = tous[id]; if (f) f.part = true; return api; }
  function vider() { for (var id in tous) tous[id].part = true; return api; }

  // ---- Leur corps ----
  function incarner(f) {
    var t = TETES[f.tete];
    f.pnj = B.pnj({ pos: [f.x, f.z], regard: f.a + Math.PI, fantome: R.opacite, solide: false, portee: 0,
                    tete: t[0] + '.png', teteDos: t[0] + '-dos.png', cou: t[1], enfonce: t[2], grosseur: t[3] });
    f.pnj.voile(f.voile); f.pose = 0;
    if (siege(f)) poser(f, siege(f));
  }
  function taille(pose) { var t = B.pnjTaille || {}; return pose === 'tabouret' ? t.perche || 1.5 : pose === 'assis' ? t.assis || 1.5 : t.debout || 1.85; }
  function poser(f, S) {                                                // assis : sur le siège, tourné comme le siège, à la taille des PNJ assis du bar
    var n = f.pnj, cap = S.cap;
    if (S.genre === 'banc' && !S.dossier && Math.cos(f.a - cap) < 0) cap += Math.PI;   // un banc sans dossier : du côté où il regardait en s'asseyant
    n.placer(f.x, f.z); n.regarder(cap + Math.PI);
    if (S.genre === 'tabouret') { n.options.taille = taille('tabouret'); n.percher(S.h); } else { n.options.taille = taille('assis'); n.asseoir(S.h); }
    f.pose = f.s; f.cap = cap;
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
      } else if (!n.enMarche()) n.regarder(f.a + Math.PI);              // arrêté : il regarde où regarde le visiteur
    }
    f.neuf = false;
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
      if (voulu) lancerDemo(voulu); else if (RELAIS) connecter(RELAIS);
    }
    if (!(dt > 0)) dt = 0;
    horloge += dt;
    if (demo) demo.maj(dt);
    relayer(dt);
    tri -= dt; if (tri <= 0) { tri = 0.5; choisir(); }
    var id, f, cible, pas = R.fondu > 0 ? dt / R.fondu : 1, neuf = false;
    for (id in tous) {
      f = tous[id]; cible = (f.part || !f.elu) ? 0 : 1;
      if (!f.pnj && cible && !neuf) { incarner(f); neuf = true; }       // un corps de plus par image, pas davantage : fabriquer ses textures prend quelques millisecondes
      if (f.pnj) {
        if (!f.part) animer(f);
        f.voile += Math.max(-pas, Math.min(pas, cible - f.voile));
        f.pnj.voile(f.voile);
        if (!cible && f.voile <= 0) { f.pnj.retirer(); f.pnj = null; f.pose = 0; }
      }
      if (f.part && !f.pnj) delete tous[id];
    }
  }

  // ---- Le relais : les vrais visiteurs ----
  // Ce qui s'échange est décrit dans salon/src/bar.js. Tout ce qui arrive du relais est traité comme une donnée douteuse :
  // des nombres vérifiés, un nombre de fantômes plafonné, rien d'autre que des positions.
  var DELAIS = [1, 2, 5, 10, 30, 60, 60, 60, 300];                      // secondes avant de réessayer, d'échec en échec
  var net = { url: '', ws: null, etat: 'ferme', id: null, nom: null, tete: null, essais: 0, attente: 0, envoi: 0, battement: 0,
              dernier: null, envoyes: 0, recus: 0, pause: false, plein: false, veille: 0 };
  function purger() { for (var id in tous) if (id.slice(0, 2) === 'r:') tous[id].part = true; }
  function distants() { var n = 0; for (var id in tous) if (id.slice(0, 2) === 'r:' && !tous[id].part) n++; return n; }
  function venir(id, tete, nom, x, z, a, s) {
    if (typeof id !== 'string' || !id || id.length > 12 || id === net.id || distants() >= 40) return;
    arrive('r:' + id, { tete: nombre(tete, 0), x: nombre(x, 0) / 100, z: nombre(z, 0) / 100, a: nombre(a, 0) * Math.PI / 180, s: nombre(s, 0) });
    if (tous['r:' + id]) tous['r:' + id].nom = String(nom || '').slice(0, 24);
  }
  function recevoir(texte) {
    if (typeof texte !== 'string' || texte === 'pong' || texte.length > 8000) return;
    var m; try { m = JSON.parse(texte); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    net.recus++;
    if (m.t === 'w') {                                                  // bienvenue : qui l'on est, qui est déjà là
      net.id = String(m.id); net.nom = String(m.nom || ''); net.tete = nombre(m.tete, 0); net.dernier = null; net.envoi = 0;
      purger();
      (m.les instanceof Array ? m.les : []).slice(0, 40).forEach(function (l) { if (l instanceof Array && l.length >= 7) venir(l[0], l[1], l[2], l[3], l[4], l[5], l[6]); });
    } else if (m.t === '+') venir(m.id, m.tete, m.nom, m.x, m.z, m.a, m.s);
    else if (m.t === 'p') { if (typeof m.id === 'string' && tous['r:' + m.id]) bouge('r:' + m.id, { x: nombre(m.x, 0) / 100, z: nombre(m.z, 0) / 100, a: nombre(m.a, 0) * Math.PI / 180, s: nombre(m.s, 0) }); }
    else if (m.t === '-') { if (typeof m.id === 'string') part('r:' + m.id); }
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
    return { x: Math.round(x * 100), z: Math.round(z * 100), a: ((Math.round(v.yaw * 180 / Math.PI) % 360) + 360) % 360, s: s };
  }
  function relayer(dt) {
    if (!net.url) return;
    if (net.etat === 'attente') { net.attente -= dt; if (net.attente <= 0) ouvrir(); return; }
    if (net.etat !== 'ouvert' || !net.ws || !net.id) return;
    net.envoi -= dt; net.battement -= dt;
    if (net.envoi <= 0) {
      var e = moi(), d = net.dernier, da = d ? Math.abs(((e.a - d.a + 540) % 360) - 180) : 0;
      // on n'envoie que ce qui change : un pas (2 cm), un regard (3°, sauf assis : le fantôme assis ne tourne pas la tête), un siège
      if (!d || e.s !== d.s || Math.abs(e.x - d.x) > 2 || Math.abs(e.z - d.z) > 2 || (!e.s && da > 3)) {
        try { net.ws.send(JSON.stringify({ t: 'p', x: e.x, z: e.z, a: e.a, s: e.s })); net.envoyes++; } catch (err) {}
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
      gens.push(g); arrive(g.id, { tete: tetes[k % tetes.length], x: g.x, z: g.z, a: g.a, s: 0 });
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
              else { g.mode = 'pause'; g.attente = 1.5 + alea() * 4; }
            }
          } else if (g.mode === 'assis') {
            g.attente -= dt; g.a = g.cap + 0.6 * Math.sin(horloge * 0.5 + g.phase);          // assis, il tourne la tête
            if (g.attente <= 0) { delete pris[g.vise]; g.vise = -1; g.s = 0; g.x = g.retour[0]; g.z = g.retour[1]; g.mode = 'pause'; g.attente = 0.8 + alea() * 1.5; }
          } else {
            g.attente -= dt; g.a += 0.5 * Math.sin(horloge * 0.6 + g.phase) * dt;             // debout, il regarde autour de lui
            if (g.attente <= 0) partir(g);
          }
          g.envoi -= dt;
          if (g.envoi <= 0) { g.envoi += CADENCE; if (g.envoi < 0) g.envoi = 0; bouge(g.id, { x: g.x, z: g.z, a: g.a, s: g.s }); }   // cinq positions par seconde, comme le relais
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
    reseau: function () { return { url: net.url, etat: net.etat, id: net.id, nom: net.nom, tete: net.tete, essais: net.essais, attente: net.attente, envoyes: net.envoyes, recus: net.recus, distants: distants() }; },
    demo: function (n, graine) { return lancerDemo(n, graine); },
    enDemo: function () { return demo ? demo.gens.length : 0; },
    // pour les essais : chaque fantôme, là où le visiteur est (x, z) et là où son corps en est (px, pz)
    liste: function () {
      var l = [], id, f, q;
      for (id in tous) {
        f = tous[id]; q = f.pnj ? f.pnj.position() : null;
        l.push({ id: id, nom: f.nom || null, tete: TETES[f.tete][0], x: f.x, z: f.z, a: f.a, s: f.s, corps: !!f.pnj, voile: f.voile, part: f.part, elu: f.elu,
                 px: q ? q[0] : null, pz: q ? q[1] : null, pose: f.pnj ? f.pnj.options.pose : null, marche: f.pnj ? f.pnj.enMarche() : false });
      }
      return l;
    },
    corps: function (id) { return tous[id] ? tous[id].pnj : null; }
  };
  return api;
})();
