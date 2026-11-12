/* trace.js : le journal de visite du bodega.
   Il regarde ce que fait le visiteur, dans l'ordre (pièces traversées, juke-box, télé, bière, pipi, explosion, archives),
   note son trajet, et envoie le tout par petits lots à un collecteur (un Google Sheet : voir collecteur.gs).
   Il ne touche à rien dans le bodega : il se contente de lire window.bodega et window.Jukebox.

   Ce qui est envoyé : un numéro de visite tiré au hasard, l'appareil (téléphone ou ordinateur), les actions, le trajet.
   Ni nom, ni adresse e-mail, ni adresse IP, ni cookie. Le visiteur est prévenu à l'arrivée et peut refuser.

   Lien nominatif : berao.fr/?ami=marie  ->  la visite porte l'étiquette « marie » (visible aussi dans l'avertissement).
   Voir le journal en direct sur son propre écran : ajouter #trace à l'adresse. */
(function () {
  'use strict';

  /* ---------- Réglages ---------- */
  var ADRESSE = 'https://script.google.com/macros/s/AKfycbzxIYC_qeG9Yd7rmEn3EsJSEGDBR1pjO1lBELrhYRYWBjdAhwmR_Vl1lzFb9d6FWR2D/exec';                      // <- l'adresse du collecteur, qui finit par /exec. Vide : rien n'est envoyé.
  var R = {
    site: 'berao-bodega',                // le collecteur refuse tout ce qui ne porte pas ce nom
    envoi: 10,                           // un lot toutes les 10 secondes, s'il y a du nouveau
    avis: 10,                            // l'avertissement reste 10 secondes ; rien n'est envoyé avant qu'il s'efface
    accord: false,                       // true : on demande « OK / Non » et on n'enregistre qu'après un OK
    pas: 0.25,                           // un point de trajet au plus tous les quarts de seconde
    max: 3000                            // nombre d'actions au-delà duquel une visite n'est plus notée
  };

  /* ---------- La visite ---------- */
  var CLE = 'bodega-trace', REFUS = 'bodega-trace-refus';
  function lire(st, k) { try { return st.getItem(k); } catch (e) { return null; } }
  function ecrire(st, k, v) { try { st.setItem(k, v); } catch (e) {} }
  var visite = null;
  try { visite = JSON.parse(lire(sessionStorage, CLE) || 'null'); } catch (e) { visite = null; }
  if (visite && !(/^v[a-z0-9]{7}$/.test(String(visite.s)) && Date.now() - visite.t0 < 3 * 3600 * 1000 && Date.now() >= visite.t0)) visite = null;   // trop vieille ou abîmée
  var reprise = !!visite;                                     // on revient dans la même visite (retour des archives, page rechargée)
  if (reprise) { visite.ami = String(visite.ami || '').replace(/[^a-z0-9_-]/g, '').slice(0, 24); visite.n = +visite.n || 0; visite.b = +visite.b || 0; visite.ok = visite.ok === true; }
  if (!reprise) {
    var ami = '';
    try { ami = (new URLSearchParams(location.search).get('ami') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24); } catch (e) {}
    var id = 'v';
    for (var i = 0; i < 7; i++) id += 'abcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 36));
    visite = { s: id, n: 0, b: 0, t0: Date.now(), ami: ami, ok: false };
  }
  function garder() { ecrire(sessionStorage, CLE, JSON.stringify(visite)); }
  var refus = lire(localStorage, REFUS) === '1';
  var tactile = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  var bar = !!document.getElementById('stage');               // la page du bodega ; sinon, celle des archives
  var actif = !refus, fautes = 0;

  /* ---------- Le journal ---------- */
  var tout = [], file = [], resume = [], points = [], lieu = bar ? '' : 'archives', ici = [0, 0], o = null;   // o : l'état du bodega vu au tour précédent
  function temps() { return Math.round((Date.now() - visite.t0) / 100) / 10; }
  function noter(quoi, detail, court) {                       // court : ce qui passe dans le résumé de la visite (une ligne par visite)
    if (!actif || visite.n >= R.max) return;
    if (o && o.cand && o.cand !== lieu && quoi !== 'va') { lieu = o.cand; o.cand = ''; noter('va', lieu, '▸ ' + lieu); }   // on vient de changer de pièce : elle passe d'abord
    var e = [++visite.n, temps(), lieu, quoi, detail || '', Math.round(ici[0]), Math.round(ici[1])];
    tout.push(e); file.push(e);
    if (court) resume.push(court === true ? (detail || quoi) : court);
    if (tout.length > 4000) tout.shift();
    garder(); peindre();
  }

  /* ---------- L'envoi ---------- */
  // Chaque lot porte un numéro. La page ne peut pas lire la réponse du collecteur : elle sait seulement si l'aller-retour a
  // abouti. Sinon le lot est renvoyé tel quel, avec le même numéro, trois fois au plus ; le collecteur reconnaît les doublons.
  var enCours = false, attente = [];
  function nouveauLot() {
    if (!file.length && !points.length) return;
    visite.b = (visite.b || 0) + 1;
    attente.push({ essais: 0, corps: JSON.stringify({ site: R.site, v: 1, s: visite.s, b: visite.b, ami: visite.ami, ap: tactile ? 'téléphone' : 'ordinateur',
      t0: visite.t0, t: temps(), n: visite.n, e: file, p: points.join(';'), r: resume.join(' · ') }) });
    file = []; points = []; resume = []; garder();
    if (attente.length > 30) attente.shift();
  }
  function envoyer(dernier) {
    if (!ADRESSE || !actif || !visite.ok) return;
    nouveauLot();
    if (!attente.length) return;
    if (dernier) {                                            // la page s'en va : tout part d'un coup, sans attendre de réponse
      while (attente.length) {
        var parti = false;
        try { parti = !!(navigator.sendBeacon && navigator.sendBeacon(ADRESSE, attente[0].corps)); } catch (e) {}
        if (!parti) break;
        attente.shift();
      }
      return;
    }
    if (enCours) return;
    var lot = attente[0];
    function fini(abouti) {
      enCours = false;
      if ((abouti || lot.essais >= 3) && attente[0] === lot) attente.shift();
      if (abouti && attente.length) envoyer(false);
    }
    enCours = true; lot.essais++;
    // Du texte brut, en « no-cors » : le collecteur n'a pas à autoriser le site, et aucune requête préalable n'est faite.
    try {
      fetch(ADRESSE, { method: 'POST', mode: 'no-cors', keepalive: lot.corps.length < 60000, body: lot.corps })
        .then(function () { fini(true); }, function () { fini(false); });
    } catch (err) { fini(false); }
  }

  /* ---------- L'avertissement ---------- */
  var style = document.createElement('style');
  style.textContent =
    '#trAvis { top: 60px; left: max(16px, env(safe-area-inset-left, 0px)); max-width: min(310px, calc(100% - 196px)); padding: 6px 10px;' +
    ' background: var(--panel, rgba(20,17,13,.72)); border: 1px solid var(--line, rgba(239,230,210,.28)); color: var(--muted, #a89c84);' +
    ' display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; transition: opacity .6s; z-index: 6; }' +
    '#trAvis.part { opacity: 0; }' +
    '#trAvis i { font-style: normal; color: #e2553d; }' +
    '#trAvis button { pointer-events: auto; font: inherit; letter-spacing: inherit; text-transform: uppercase; color: var(--amber, #e0a83a);' +
    ' background: none; border: 1px solid var(--line, rgba(239,230,210,.28)); padding: 3px 9px; min-height: 28px; cursor: pointer; }' +
    '#trAvis button:focus-visible { outline: 2px solid var(--amber, #e0a83a); outline-offset: 2px; }' +
    '@media (pointer: coarse) { #trAvis button { min-height: 38px; padding: 6px 14px; } }' +
    '.trSeul { position: fixed; pointer-events: auto; font: 12px/1.5 ui-monospace, Menlo, Consolas, monospace; text-transform: none; }' +
    '#trVoir { position: fixed; left: 8px; bottom: 8px; z-index: 50; width: min(430px, calc(100% - 16px)); max-height: 46%; overflow: hidden;' +
    ' padding: 6px 8px; font: 11px/1.45 ui-monospace, Menlo, Consolas, monospace; color: #d9f5c8; background: rgba(0,0,0,.78);' +
    ' border: 1px solid rgba(217,245,200,.35); pointer-events: none; white-space: pre-wrap; }' +
    '@media (prefers-reduced-motion: reduce) { #trAvis { transition: none; } }';
  var avis = null, minuterie = null;
  function fermerAvis(mot) {
    if (!avis) return;
    var a = avis; avis = null; clearTimeout(minuterie);
    if (mot) { a.textContent = mot; setTimeout(function () { a.classList.add('part'); }, 1600); setTimeout(function () { a.remove(); }, 2400); }
    else { a.classList.add('part'); setTimeout(function () { a.remove(); }, 700); }
  }
  function accepter() { visite.ok = true; garder(); fermerAvis(''); envoyer(false); }
  function refuser() {
    actif = false; refus = true; ecrire(localStorage, REFUS, '1');
    file = []; points = []; resume = []; tout = []; attente = [];
    try { sessionStorage.removeItem(CLE); } catch (e) {}
    fermerAvis('Enregistrement arrêté.'); peindre();
  }
  function bouton(texte, action) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = texte;
    b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });   // ni marcher ni regarder en visant le bouton
    b.addEventListener('click', function (e) { e.stopPropagation(); action(); });
    return b;
  }
  function avertir() {
    if (!ADRESSE || !actif || visite.ok) return;
    document.head.appendChild(style);
    avis = document.createElement('div'); avis.id = 'trAvis'; avis.setAttribute('role', 'status');
    var hote = document.getElementById('stage');
    if (hote) avis.className = 'hud'; else { hote = document.body; avis.className = 'trSeul'; avis.style.cssText = 'left:16px;bottom:16px;top:auto'; }
    var texte = document.createElement('span'), pour = visite.ami ? ' (invité : ' + visite.ami + ')' : '';
    if (R.accord) {
      texte.innerHTML = '<i>●</i> Enregistrer cette visite ? Trajet et actions, sans nom' + pour + '.';
      avis.appendChild(texte); avis.appendChild(bouton('OK', accepter)); avis.appendChild(bouton('Non', refuser));
    } else {
      texte.innerHTML = '<i>●</i> Visite enregistrée : trajet et actions, sans nom' + pour + '.';
      avis.appendChild(texte); avis.appendChild(bouton('Refuser', refuser));
      minuterie = setTimeout(accepter, R.avis * 1000);
    }
    hote.appendChild(avis);
  }

  /* ---------- Voir le journal sur son écran (#trace) ---------- */
  var voir = null;
  function mmss(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  function ligne(e) { return mmss(e[1]) + '  ' + (e[2] ? '[' + e[2] + '] ' : '') + e[3] + (e[4] ? ' : ' + e[4] : ''); }
  function peindre() {
    if (!voir) return;
    voir.textContent = (actif ? 'visite ' + visite.s + (visite.ami ? ' · ' + visite.ami : '') + (ADRESSE ? '' : ' · rien n\'est envoyé') : 'enregistrement refusé') +
      '\n' + tout.slice(-13).map(ligne).join('\n');
  }
  if (/trace/.test(location.hash)) {
    document.head.appendChild(style);
    voir = document.createElement('div'); voir.id = 'trVoir'; (document.body || document.documentElement).appendChild(voir);
  }

  /* ---------- Les pièces du bodega (en pixels du croquis, comme le plan) ---------- */
  var WC = [[650, 210], [920, 210], [920, 370], [660, 366], [625, 290]];
  var DERRIERE = [[760, 461], [1196, 461], [1196, 700], [1035, 697], [900, 510], [775, 510]];
  var COMPTOIR = [[775, 550], [870, 550], [1005, 750], [1197, 750]], JUKE = [697, 540];
  function dans(q, x, y) {
    var d = false, i, j;
    for (i = 0, j = q.length - 1; i < q.length; j = i++) {
      if ((q[i][1] > y) !== (q[j][1] > y) && x < (q[j][0] - q[i][0]) * (y - q[i][1]) / (q[j][1] - q[i][1]) + q[i][0]) d = !d;
    }
    return d;
  }
  function loin(q, x, y) {                                    // distance du point à une ligne brisée
    var m = Infinity, i, ax, ay, bx, by, l2, t, dx, dy;
    for (i = 1; i < q.length; i++) {
      ax = q[i - 1][0]; ay = q[i - 1][1]; bx = q[i][0] - ax; by = q[i][1] - ay; l2 = bx * bx + by * by;
      t = l2 ? Math.max(0, Math.min(1, ((x - ax) * bx + (y - ay) * by) / l2)) : 0;
      dx = x - ax - bx * t; dy = y - ay - by * t; m = Math.min(m, Math.sqrt(dx * dx + dy * dy));
    }
    return m;
  }
  function piece(x, y) {
    if (dans(WC, x, y)) return 'toilettes';
    if (y < 440 && x > 495) return 'couloir';
    if (y > 838) return 'entrée';
    if (x < 612) return y < 625 ? 'salle, tables du fond' : 'salle, coin télé';
    if (dans(DERRIERE, x, y)) return 'derrière le bar';
    var dj = Math.sqrt((x - JUKE[0]) * (x - JUKE[0]) + (y - JUKE[1]) * (y - JUKE[1])), dc = loin(COMPTOIR, x, y);
    if (dj < 150 && dj <= dc) return 'devant le juke-box';
    if (dc < 125) return 'comptoir';
    return 'allée';
  }

  /* ---------- Ce qu'on observe dans le bodega ---------- */
  var VOIT = { juke: 'le bouton du juke-box', tele: 'la télécommande', parler: 'quelqu\'un à qui parler', biere: 'le patron (commander une bière)',
               boire: 'une bière à boire', archive: 'la porte des archives' };
  function pages(n) { return n + (n > 1 ? ' pages feuilletées' : ' page feuilletée'); }
  function cd(J) { var n = J.selection; return n ? 'CD ' + (n < 10 ? '0' : '') + n + (J.titre ? ' (' + J.titre + ')' : '') : 'un CD'; }
  function regarder() {
    var B = window.bodega, J = window.Jukebox;
    if (!B || !B.view) return;
    var maintenant = Date.now() / 1000, v = B.view(), k;
    if (!o) {
      var a = B.P(0, 0), b = B.P(1000, 0);
      o = { ox: a[0], oz: a[1], K: (b[0] - a[0]) / 1000, x0: v.x, z0: v.z, parti: reprise, cand: '', depuis: 0, vus: {}, pt: 0, px: 1e9, py: 0, pa: 0,
            jb: J ? J.state : 'room', col: J ? J.column : 0, pages: 0, tiroir: J ? J.drawerOpen : false, ecoute: 0,
            tele: B.tele.etat(), assisA: 0, tv: null, volT: 0,
            sert: false, boit: false, bieres: 0, bu: B.SKILL.bu, skill: B.SKILL.pipi, jet: false, jetT: 0,
            arrose: { patron: 0, danois: 0, juke: 0 }, mouille: false, vivant: B.JUKE.vivant, arch: false };
    }
    ici[0] = (v.x - o.ox) / o.K; ici[1] = (v.z - o.oz) / o.K;

    // La pièce : on ne la note qu'après y être resté une demi-seconde (pas de va-et-vient sur un seuil)
    var p = piece(ici[0], ici[1]);
    if (!lieu) { lieu = p; noter('arrivée', reprise ? 'de retour dans le bodega' : (tactile ? 'sur téléphone' : 'sur ordinateur') + ', écran ' + innerWidth + ' × ' + innerHeight + (visite.ami ? ', invité : ' + visite.ami : ''), reprise ? 'retour au bodega' : '▸ ' + p); }
    if (p !== lieu) {
      if (p !== o.cand) { o.cand = p; o.depuis = maintenant; }
      else if (maintenant - o.depuis > 0.5) { lieu = p; noter('va', p, '▸ ' + p); }
    } else o.cand = '';
    if (!o.parti && (v.x - o.x0) * (v.x - o.x0) + (v.z - o.z0) * (v.z - o.z0) > 0.09) { o.parti = true; noter('marche', 'premiers pas'); }

    // Le trajet : temps, x, y du croquis, cap en degrés
    if (maintenant - o.pt >= R.pas) {
      var cap = ((Math.round(-v.yaw * 180 / Math.PI) % 360) + 360) % 360;
      if (Math.abs(ici[0] - o.px) + Math.abs(ici[1] - o.py) > 12 || Math.abs(cap - o.pa) > 20) {
        o.pt = maintenant; o.px = ici[0]; o.py = ici[1]; o.pa = cap;
        if (points.length < 4000) points.push(temps() + ',' + Math.round(ici[0]) + ',' + Math.round(ici[1]) + ',' + cap);
      }
    }

    // Ce que le bouton propose : la première fois seulement (« il a vu la télécommande »)
    k = B.use();
    if (k && !o.vus[k]) { o.vus[k] = true; noter('voit', VOIT[k] || k); }

    // Juke-box
    if (J) {
      var st = J.state;
      if (st === 'browse' && J.column !== o.col) o.pages++;
      o.col = J.column;
      if (st !== o.jb) {
        if (o.jb === 'room' && st === 'approach') { o.pages = 0; noter('juke-box', 'l\'ouvre', 'ouvre le juke-box'); }
        else if (st === 'seek' || (st === 'load' && o.jb === 'browse')) { noter('juke-box', 'choisit le ' + cd(J) + (o.pages ? ', après ' + pages(o.pages) : ''), cd(J).replace(/ \(.*/, '')); o.pages = 0; }
        else if (st === 'play') o.ecoute = maintenant;
        else if (st === 'eject') noter('juke-box', 'éjecte le CD' + (o.ecoute ? ' après ' + Math.round(maintenant - o.ecoute) + ' s d\'écoute' : ''));
        else if (st === 'leave') { noter('juke-box', 'le quitte' + (o.pages ? ' (' + pages(o.pages) + ')' : ''), 'quitte le juke-box'); o.pages = 0; }
        o.jb = st;
      }
      if (J.drawerOpen && !o.tiroir) noter('juke-box', 'le tiroir du meuble s\'ouvre', 'tiroir ouvert');
      o.tiroir = J.drawerOpen;
    }

    // Télé
    var te = B.tele.etat();
    if (te !== o.tele) {
      if (te === 'vers') { o.assisA = maintenant; o.tv = null; noter('télé', 'prend la télécommande', 'télé'); }
      else if (te === 'retour') noter('télé', 'repose la télécommande après ' + Math.round(maintenant - o.assisA) + ' s', 'quitte la télé');
      o.tele = te;
    }
    if (te === 'assis' && B.tele.TELE && B.tele.TELE.etat) {
      var tv = B.tele.TELE.etat();
      if (o.tv) {
        if (tv.power !== o.tv.power) noter('télé', tv.power ? 'la rallume' : 'l\'éteint');
        else if (tv.chaine !== o.tv.chaine) noter('télé', 'chaîne ' + tv.chaine + (tv.nom ? ' (' + tv.nom + ')' : ''), 'chaîne ' + tv.chaine);
        if (tv.muted !== o.tv.muted) noter('télé', tv.muted ? 'coupe le son' : 'remet le son');
        if (tv.volume !== o.tv.volume) o.volT = maintenant;
        else if (o.volT && maintenant - o.volT > 1.2) { o.volT = 0; noter('télé', 'volume à ' + Math.round(tv.volume * 100) + ' %'); }
      }
      o.tv = tv;
    }

    // Le patron, la bière
    var sert = !!(B.barman && B.barman.sert());
    if (sert && !o.sert) noter('patron', 'pose une bière sur le comptoir');
    o.sert = sert;
    if (B.BOIRE.actif && !o.boit) { o.bieres++; noter('bière', 'boit' + (o.bieres > 1 ? ' (la ' + o.bieres + 'e)' : ''), 'boit une bière'); }
    o.boit = B.BOIRE.actif;
    if (B.SKILL.bu && !o.bu) noter('panneau', '« GO PIPI » s\'affiche');
    o.bu = B.SKILL.bu;

    // Le pipi
    if (B.SKILL.pipi && !o.skill) noter('pipi', 'débloqué, sur les carreaux des toilettes', 'pipi débloqué');
    o.skill = B.SKILL.pipi;
    var jet = !!(B.pipi && B.pipi.ouvert());
    if (jet && !o.jet) { o.jetT = maintenant; noter('pipi', 'commence', 'pipi'); }
    if (!jet && o.jet) noter('pipi', 'fin, ' + (Math.round((maintenant - o.jetT) * 10) / 10 + ' s').replace('.', ','));
    o.jet = jet;
    function cible(nom, touche, texte) {                      // une cible arrosée : notée une fois, puis de nouveau après 4 s au sec
      if (touche) { if (maintenant - o.arrose[nom] > 4) noter('pipi', texte, texte); o.arrose[nom] = maintenant; }
    }
    cible('patron', B.barman && B.barman.arrose > 0, 'arrose le patron');
    cible('danois', B.assis && B.assis.arrose > 0, 'arrose le Danois');
    cible('juke', B.JUKE.vivant && B.BOOM.touche > 0, 'arrose le juke-box');
    var mouille = !!(B.pipi && B.pipi.mouille() > 0.05);
    if (mouille && !o.mouille) noter('pipi', 'se fait pipi dessus', 'se fait pipi dessus');
    o.mouille = mouille;
    if (!B.JUKE.vivant && o.vivant) noter('juke-box', 'explose', 'le juke-box explose');
    o.vivant = B.JUKE.vivant;

    // Les archives
    if (B.ARCH && B.ARCH.actif && !o.arch) noter('archives', 'pousse la porte', 'entre aux archives');
    o.arch = !!(B.ARCH && B.ARCH.actif);
  }

  // Parler à quelqu'un : on lit ce que le bouton propose au moment où la touche E (ou le bouton) est pressée
  function parle() {
    var B = window.bodega, k, v;
    if (!actif || !B || !B.use) return;
    try {
      if ((window.Jukebox && window.Jukebox.state !== 'room') || B.tele.etat() !== 'salle') return;   // le juke-box ou la télé ont la main
      k = B.use(); if (k !== 'parler' && k !== 'biere') return;
      v = B.pnjVise(); if (!v) return;
      var patron = v[0] === B.barman;
      noter(patron ? 'patron' : 'Danois', k === 'biere' ? 'commande une bière' : 'lui parle', k === 'biere' ? 'commande une bière' : patron ? 'parle au patron' : 'parle au Danois');
    } catch (e) {}
  }

  /* ---------- Branchement ---------- */
  function tour() {
    if (!actif) return;
    try { regarder(); fautes = 0; } catch (e) { if (++fautes > 20) actif = false; }   // jamais d'erreur qui gêne le bodega
  }
  function brancherBar() {
    setInterval(tour, 100);
    window.addEventListener('keydown', function (e) { if ((e.code === 'KeyE' || e.code === 'Enter') && !e.repeat) parle(); }, true);
    var use = document.getElementById('use');
    if (use) use.addEventListener('click', parle, true);
    [['hSpotify', 'Spotify'], ['hDeezer', 'Deezer'], ['hInstagram', 'Instagram']].forEach(function (l) {
      var el = document.getElementById(l[0]);
      if (el) el.addEventListener('click', function () { var J = window.Jukebox; noter('juke-box', 'ouvre le lien ' + l[1] + (J && J.selection ? ' du ' + cd(J) : ''), 'lien ' + l[1]); });
    });
  }
  function brancherArchives() {
    noter('archives', 'la page s\'ouvre');
    Array.prototype.forEach.call(document.querySelectorAll('details'), function (d) {
      d.addEventListener('toggle', function () { if (d.open) { var s = d.querySelector('summary'); noter('archives', 'ouvre l\'étagère « ' + (s ? s.textContent.trim() : '?') + ' »', 'étagère ' + (s ? s.textContent.trim() : '')); } });
    });
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      if (a.id === 'retour') noter('archives', 'retourne au bodega');
      else noter('archives', 'ouvre « ' + a.textContent.trim().slice(0, 60) + ' »', 'archive : ' + a.textContent.trim().slice(0, 30));
      envoyer(true);
    }, true);
  }
  var parti = 0;
  document.addEventListener('visibilitychange', function () {
    if (!actif) return;
    if (document.visibilityState === 'hidden') { parti = Date.now(); envoyer(true); }
    else if (parti) { if (Date.now() - parti > 1500) noter('page', 'absent ' + Math.round((Date.now() - parti) / 1000) + ' s (autre onglet, ou écran éteint)', 'absent'); parti = 0; }
  });
  window.addEventListener('pagehide', function () { envoyer(true); });
  setInterval(function () { envoyer(false); }, R.envoi * 1000);

  function demarrer() {
    if (voir && !voir.parentNode) document.body.appendChild(voir);
    if (bar) brancherBar(); else if (actif) brancherArchives();
    avertir(); peindre();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();

  window.TRACE = {
    journal: function () { return tout.map(ligne); },         // dans la console : TRACE.journal().join('\n')
    brut: function () { return tout.slice(); },
    etat: function () { return { visite: visite.s, ami: visite.ami, actif: actif, envoi: !!ADRESSE && visite.ok, attente: file.length, points: points.length, lots: attente.length, lieu: lieu }; },
    refuser: refuser, envoyer: function () { envoyer(false); }
  };
})();
