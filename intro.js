/* intro.js : la page d'entrée du bar, avant d'entrer. Ordinateur et téléphone ont le même dessin :

   le tag BERAO dans son cadre bleu de sélection (comme dans le logiciel de dessin), la bande sur le canapé, et une fenêtre de
   terminal, qu'on peut déplacer en la tirant par sa barre de titre :
       Copyright (C) Berao. All rights reserved.
       ACAB

       enter your pseudo > |
   Le curseur clignote déjà après « enter your pseudo > ». On tape son pseudo (20 caractères au plus), Entrée, et l'écran passe
   au noir en fondu ; on apparaît dans le bodega. Entrée sans pseudo : le terminal repose la question, comme un vrai.

   Écran plus large que haut (ordinateur, téléphone couché) : le tag et la bande à gauche, le terminal à droite.
   Écran plus haut que large (téléphone debout) : de haut en bas le tag, le terminal, la bande.

   La frappe : à l'ordinateur on tape directement, sans cliquer. Au téléphone, un toucher n'importe où ouvre le clavier de
   l'écran (un vrai champ de saisie, invisible, posé sur la ligne du pseudo) ; la touche Entrée / OK du clavier fait entrer.

   Ce fichier ne touche à rien dans le bodega : il pose l'entrée par-dessus pendant que la salle se charge derrière, retient
   toutes les touches du clavier tant qu'on est dehors (le pseudo se tape sans faire marcher le joueur), puis s'enlève.

   Images (dossier intro/) : tag.webp et bande.webp, sur fond blanc.

   Adresses utiles :  #bar  passe l'entrée ;  #intro-mobile  et  #intro-pc  forcent la frappe du téléphone ou de l'ordinateur
   (pour les essais). L'entrée ne revient pas au retour des archives.
   Pour les autres scripts : window.BodegaIntro.etat vaut 'facade', 'entre' ou 'absente' ; .pseudo est le pseudo tapé ('' sinon) ;
   .par vaut 'terminal' ; l'évènement « bodega-entree » part sur window au moment où le visiteur entre. Le pseudo est aussi
   gardé dans le navigateur (localStorage « berao-pseudo »). */
(function () {
  'use strict';

  /* ---------- Faut-il montrer l'entrée ? ---------- */
  var retour = null;
  try { retour = JSON.parse(sessionStorage.getItem('bodega-retour') || 'null'); } catch (e) {}
  var passe = /(^|[#&])bar($|&)/.test(location.hash) || !!(retour && retour.lieu === 'archives');
  var t0 = Date.now();
  var INTRO = window.BodegaIntro = {
    etat: passe ? 'absente' : 'facade',
    pseudo: '',
    par: '',
    duree: function () { return (INTRO.fin || Date.now()) - t0; }   // millisecondes passées devant l'entrée
  };
  if (passe || !document.body) return;

  /* ---------- Clavier physique (ordinateur) ou clavier de l'écran (téléphone, tablette) ? ---------- */
  var force = /(^|[#&])intro-(pc|mobile)($|&)/.exec(location.hash);
  var PC = force ? force[2] === 'pc' : !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);

  /* ---------- Réglages ---------- */
  var FOND = '#ffffff', NOIR = '#14110d';                  // le blanc de la page ; le noir du bodega
  var PSEUDO_MAX = 20;                                     // longueur maximale du pseudo
  var TEXTE = ['Copyright (C) Berao. All rights reserved.', 'ACAB', ''];
  var INVITE = 'enter your pseudo > ';
  // Les deux mises en page, en pixels de la maquette (ensuite mises à l'échelle de l'écran, d'un bloc).
  //   tag : 548 x 227, avec son cadre bleu de sélection ; bande : 548 x 407 ; terminal : barre de titre de 50 px, puis l'écran.
  var MISES = {
    cote: { W: 1167, H: 641, tag: [0, 0], bande: [0, 234], term: [587, 22, 580, 461] },   // plus large que haut
    pile: { W: 548, H: 974, tag: [0, 0], bande: [0, 567], term: [0, 247, 548, 300] }      // plus haut que large
  };

  var src = document.currentScript && document.currentScript.src;
  var base = src ? src.replace(/[^\/]*$/, '') + 'intro-' : 'intro-';
  var calme = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- La page ---------- */
  var mono = '"Cascadia Mono","Cascadia Code",Consolas,"SF Mono",Menlo,"DejaVu Sans Mono","Liberation Mono",monospace';
  var ui = '"Segoe UI Variable Text","Segoe UI",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif';
  var css = document.createElement('style');
  css.textContent =
    '#bi{position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:' + FOND + ';isolation:isolate;' +
      'touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}' +
    '#bi *{box-sizing:border-box}' +
    '#bi .scene{position:absolute;inset:0}' +
    '#bi .noir{position:absolute;inset:0;background:' + NOIR + ';opacity:0;pointer-events:none}' +
    '#bi .attente{position:absolute;left:0;right:0;top:50%;margin:-0.6em 0 0;text-align:center;color:#a89c84;opacity:0;transition:opacity .4s;' +
      'font:12px ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;pointer-events:none}' +
    '#bi .pc{position:absolute;left:0;top:0;transform-origin:0 0}' +
    '#bi .pc img{position:absolute;display:block;pointer-events:none;-webkit-user-drag:none}' +
    '#bi .tag{width:548px;height:227px;object-fit:contain}' +
    '#bi .bande{width:548px;height:407px;object-fit:contain}' +
    '#bi .selection{position:absolute;width:549px;height:227px;border:1px solid #4f80ff;pointer-events:none}' +
    '#bi .selection i{position:absolute;width:6px;height:6px;margin:-3px 0 0 -3px;background:#fff;border:1px solid #4f80ff}' +
    /* la fenêtre : barre de titre gris foncé, onglet et écran noirs, texte gris clair */
    '#bi .term{position:absolute;background:#0c0c0c;border-radius:8px;overflow:hidden;' +
      'border:1px solid #3c3c3c;box-shadow:0 18px 50px rgba(0,0,0,.34),0 4px 14px rgba(0,0,0,.2);cursor:text}' +
    '#bi .barre{position:relative;height:50px;background:#2e2e2e;font:14px/1 ' + ui + ';color:#fff;touch-action:none;cursor:default}' +
    '#bi .onglet{position:absolute;left:10px;top:12px;width:258px;height:38px;background:#0c0c0c;border-radius:8px 8px 0 0;display:flex;align-items:center}' +
    '#bi .ico{margin-left:14px;width:18px;height:16px;border-radius:3px;background:#3a3a3a;color:#fff;font:bold 9px/16px ' + mono + ';text-align:center;letter-spacing:-.5px}' +
    '#bi .titre{margin-left:11px;flex:1;white-space:nowrap;overflow:hidden}' +
    '#bi .fx{position:relative;width:12px;height:12px;margin-right:18px;opacity:.85}' +
    '#bi .fx:before,#bi .fx:after,#bi .ferme:before,#bi .ferme:after{content:"";position:absolute;left:50%;top:50%;width:14px;height:1px;background:#fff}' +
    '#bi .fx:before,#bi .ferme:before{transform:translate(-50%,-50%) rotate(45deg)}#bi .fx:after,#bi .ferme:after{transform:translate(-50%,-50%) rotate(-45deg)}' +
    '#bi .plus{position:absolute;left:286px;top:23px;width:14px;height:14px}' +
    '#bi .plus:before,#bi .plus:after{content:"";position:absolute;left:0;top:6.5px;width:14px;height:1px;background:#fff}#bi .plus:after{transform:rotate(90deg)}' +
    '#bi .sep{position:absolute;left:315px;top:18px;width:1px;height:24px;background:#555}' +
    '#bi .chev{position:absolute;left:329px;top:22px;width:8px;height:8px;border-right:1px solid #fff;border-bottom:1px solid #fff;transform:rotate(45deg)}' +
    '#bi .ctrl{position:absolute;right:0;top:0;height:50px;display:flex}' +
    '#bi .ctrl span{position:relative;width:58px;height:50px}' +
    '#bi .reduit:before{content:"";position:absolute;left:24px;top:24px;width:10px;height:1px;background:#fff}' +
    '#bi .agrandit:before{content:"";position:absolute;left:24px;top:19px;width:10px;height:10px;border:1px solid #fff}' +
    '#bi .ferme:before,#bi .ferme:after{width:15px}' +
    '#bi .ecran{padding:8px 10px 0 10px;font:20px/23px ' + mono + ';color:#cccccc;white-space:pre;overflow:hidden}' +
    '#bi .ecran div{height:23px}' +
    /* le curseur : une barre, comme Windows Terminal ; il reste allumé pendant qu'on tape, puis reprend son clignotement */
    '#bi .curseur{display:inline-block;width:2px;height:21px;margin-left:1px;vertical-align:-4px;background:#cccccc;animation:bi-clic 1.06s steps(1,end) infinite}' +
    '#bi .curseur.tape{animation:none}' +
    '@keyframes bi-clic{0%{opacity:1}50%{opacity:0}}' +
    '#bi.part .curseur{animation:none;opacity:0}' +
    /* téléphone : le vrai champ de saisie, invisible, posé sur la ligne du pseudo (16 px : l'iPhone ne zoome pas dessus) */
    '#bi form{position:absolute;margin:0;left:0;top:0;width:10px;height:10px;overflow:hidden;opacity:0;pointer-events:none}' +
    '#bi .champ{position:absolute;left:0;top:0;width:100%;height:100%;padding:0;border:0;outline:0;font-size:16px;background:transparent;color:transparent;caret-color:transparent}' +
    '#bi .lu{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}' +
    '@media (prefers-reduced-motion:reduce){#bi .curseur{animation:none}}';
  document.head.appendChild(css);

  var racine = document.createElement('div');
  racine.id = 'bi';
  racine.innerHTML =
    '<div class="scene"><div class="pc">' +
      '<img class="tag" alt="BERAO" src="' + base + 'tag.webp">' +
      '<div class="selection" aria-hidden="true">' +
        '<i style="left:-.5px;top:-.5px"></i><i style="left:50%;top:-.5px"></i><i style="left:100%;top:-.5px"></i>' +
        '<i style="left:-.5px;top:50%"></i><i style="left:100%;top:50%"></i>' +
        '<i style="left:-.5px;top:100%"></i><i style="left:50%;top:100%"></i><i style="left:100%;top:100%"></i>' +
      '</div>' +
      '<img class="bande" alt="" src="' + base + 'bande.webp">' +
      '<div class="term" aria-label="Enter your pseudo, then press Enter">' +
        '<div class="barre" aria-hidden="true">' +
          '<div class="onglet"><span class="ico">&gt;_</span><span class="titre">BERAO</span><span class="fx"></span></div>' +
          '<span class="plus"></span><span class="sep"></span><span class="chev"></span>' +
          '<div class="ctrl"><span class="reduit"></span><span class="agrandit"></span><span class="ferme"></span></div>' +
        '</div>' +
        '<div class="ecran"></div>' +
      '</div>' +
    '</div>' +
    '<form autocomplete="off" novalidate><input class="champ" type="text" name="pseudo" aria-label="Enter your pseudo" ' +
      'autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go" maxlength="' + PSEUDO_MAX + '"></form>' +
    '<p class="lu" aria-live="polite"></p></div>' +
    '<div class="noir"></div><p class="attente" role="status"></p>';
  document.body.appendChild(racine);
  var scene = racine.querySelector('.scene'), pc = racine.querySelector('.pc'), noir = racine.querySelector('.noir'),
      attente = racine.querySelector('.attente'), tag = racine.querySelector('.tag'), selection = racine.querySelector('.selection'),
      bande = racine.querySelector('.bande'), term = racine.querySelector('.term'), barre = racine.querySelector('.barre'),
      ecran = racine.querySelector('.ecran'), form = racine.querySelector('form'), champ = racine.querySelector('.champ'),
      lu = racine.querySelector('.lu');
  if (PC) form.parentNode.removeChild(form);

  /* ---------- Le reste de la page attend dehors ---------- */
  // Tant qu'on est dehors, le bodega ne reçoit aucune touche (ce script est chargé avant lui : il écoute le premier),
  // ni clic, ni tabulation : on ne marche pas dans la salle à l'aveugle, et le pseudo se tape sans rien déclencher.
  // (Au téléphone, la touche arrive quand même dans le champ de saisie : arrêter un évènement n'empêche pas la lettre de s'écrire.)
  var dehors = true;
  function touches(e) {
    if (!dehors) return;
    e.stopImmediatePropagation();
    if (e.type === 'keydown' && PC) clavier(e);
  }
  window.addEventListener('keydown', touches, true);
  window.addEventListener('keyup', touches, true);
  function figer(oui) {
    var k = document.body.children, i;
    for (i = 0; i < k.length; i++) {
      if (k[i] === racine || /^(SCRIPT|STYLE|LINK|META|TITLE)$/.test(k[i].tagName)) continue;
      if (oui) { if (!k[i].hasAttribute('inert')) { k[i].setAttribute('inert', ''); k[i].setAttribute('data-bi-inert', ''); } }
      else if (k[i].hasAttribute('data-bi-inert')) { k[i].removeAttribute('inert'); k[i].removeAttribute('data-bi-inert'); }
    }
  }
  var pret = document.readyState === 'complete';
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { if (dehors) figer(true); });
  else figer(true);
  window.addEventListener('load', function () { pret = true; if (dehors) figer(true); });

  /* ---------- Le terminal ---------- */
  var lignes = TEXTE.slice(), saisie = '', reveil = 0, MAXL = 17;
  var ligneInvite = document.createElement('div'), tape = document.createElement('span'), curseur = document.createElement('span');
  curseur.className = 'curseur';
  function dessiner() {
    ecran.textContent = '';
    var debut = Math.max(0, lignes.length - (MAXL - 1)), i, d;
    for (i = debut; i < lignes.length; i++) { d = document.createElement('div'); d.textContent = lignes[i]; ecran.appendChild(d); }
    ligneInvite.textContent = INVITE; tape.textContent = saisie;
    ligneInvite.appendChild(tape); ligneInvite.appendChild(curseur); ecran.appendChild(ligneInvite);
  }
  function allume() {                                      // pendant la frappe, le curseur reste allumé
    curseur.classList.add('tape'); clearTimeout(reveil);
    reveil = setTimeout(function () { curseur.classList.remove('tape'); }, 600);
  }
  function nettoie(t) { return Array.from(String(t).replace(/[\u0000-\u001f\u007f-\u009f]/g, '')).slice(0, PSEUDO_MAX).join(''); }
  function ajoute(t) {
    t = String(t).replace(/[\u0000-\u001f\u007f-\u009f]/g, '');
    var place = PSEUDO_MAX - Array.from(saisie).length;
    if (place <= 0 || !t) return;
    saisie += Array.from(t).slice(0, place).join('');
    tape.textContent = saisie; allume();
  }
  function valide() {
    if (parti) return;
    var p = saisie.trim();
    lignes.push(INVITE + saisie); saisie = '';
    if (!PC) champ.value = '';
    if (!p) { dessiner(); allume(); placerChamp(); return; }  // rien de tapé : le terminal repose la question
    INTRO.pseudo = p;
    try { localStorage.setItem('berao-pseudo', p); } catch (e) {}
    lu.textContent = 'Welcome, ' + p;
    dessiner(); ligneInvite.textContent = ''; ligneInvite.appendChild(curseur);   // le curseur descend d'une ligne, puis le noir
    if (!PC) champ.blur();                                 // le clavier de l'écran se range
    setTimeout(function () { entre('terminal'); }, 140);
  }

  // Ordinateur : on lit les touches directement (elles n'atteignent jamais le bodega).
  function clavier(e) {
    if (parti) { e.preventDefault(); return; }
    var k = e.key;
    if (k === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); if (!e.repeat) valide(); return; }
    if (k === 'Backspace') { e.preventDefault(); var a = Array.from(saisie); a.pop(); saisie = a.join(''); tape.textContent = saisie; allume(); return; }
    if (k === 'Escape') { e.preventDefault(); saisie = ''; tape.textContent = ''; allume(); return; }
    if (e.metaKey || (e.ctrlKey && !e.altKey)) return;     // raccourcis du navigateur (Ctrl+V : voir « coller »). AltGr = Ctrl+Alt : on le garde.
    if (k && Array.from(k).length === 1) { e.preventDefault(); ajoute(k); }
  }
  function coller(e) {
    if (!dehors || parti || !PC) return;
    var t = (e.clipboardData || window.clipboardData);
    t = t && t.getData('text');
    if (t) { e.preventDefault(); ajoute(String(t).split(/\r?\n/)[0]); }
  }
  window.addEventListener('paste', coller, true);

  // Téléphone : un vrai champ de saisie, invisible ; ce qu'on y tape s'affiche dans le terminal. Un toucher ouvre le clavier.
  if (!PC) {
    champ.addEventListener('input', function () {
      var v = nettoie(champ.value.split(/\r?\n/)[0]);
      if (v !== champ.value) champ.value = v;
      saisie = v; tape.textContent = saisie; allume();
      try { champ.setSelectionRange(v.length, v.length); } catch (e) {}
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); valide(); });
    racine.addEventListener('click', function () {
      if (vientDeTirer) { vientDeTirer = false; return; }
      if (!parti) { placerChamp(); champ.focus({ preventScroll: true }); }
    });
  }
  dessiner();

  /* ---------- Mise en page, et la fenêtre qu'on déplace ---------- */
  // La fenêtre se déplace en la tirant par sa barre de titre, comme une vraie. Elle reste toujours rattrapable : la barre de
  // titre ne sort jamais de l'écran par le haut ni par le bas, et il en reste au moins 120 px visibles en largeur.
  var M = null, nom = '', E = null, F = { x: 0, y: 0 };    // la mise en page ; son nom ; l'échelle et le décalage ; la place de la fenêtre
  function placer() {
    if (E) {
      var tw = M.term[2];
      F.x = Math.min(Math.max(F.x, (120 - tw * E.k - E.x) / E.k), (E.vw - 120 - E.x) / E.k);
      F.y = Math.min(Math.max(F.y, -E.y / E.k), (E.vh - 50 * E.k - E.y) / E.k);
    }
    term.style.left = F.x.toFixed(2) + 'px'; term.style.top = F.y.toFixed(2) + 'px';
    placerChamp();
  }
  function placerChamp() {                                 // le champ invisible suit la ligne du pseudo (le téléphone y amène son clavier)
    if (PC || !E) return;
    var n = ecran.childNodes.length - 1;
    var x = E.x + (F.x + 10) * E.k, y = E.y + (F.y + 50 + 8 + n * 23) * E.k;
    form.style.left = x.toFixed(1) + 'px'; form.style.top = y.toFixed(1) + 'px';
    form.style.width = Math.max(40, (M.term[2] - 20) * E.k).toFixed(1) + 'px'; form.style.height = Math.max(20, 23 * E.k).toFixed(1) + 'px';
  }
  var tire = null;
  barre.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || parti) return;
    e.preventDefault();
    tire = { id: e.pointerId, sx: e.clientX, sy: e.clientY, fx: F.x, fy: F.y, bouge: false };
    try { barre.setPointerCapture(e.pointerId); } catch (er) {}
  });
  barre.addEventListener('pointermove', function (e) {
    if (!tire || e.pointerId !== tire.id || !E) return;
    if (Math.abs(e.clientX - tire.sx) + Math.abs(e.clientY - tire.sy) > 3) tire.bouge = true;
    F.x = tire.fx + (e.clientX - tire.sx) / E.k; F.y = tire.fy + (e.clientY - tire.sy) / E.k;
    placer();
  });
  var vientDeTirer = false;                               // au téléphone : une fenêtre qu'on vient de déplacer n'ouvre pas le clavier
  function lache(e) { if (tire && e.pointerId === tire.id) { vientDeTirer = tire.bouge; tire = null; } }
  barre.addEventListener('pointerup', lache);
  barre.addEventListener('pointercancel', lache);
  barre.addEventListener('lostpointercapture', lache);

  var dernier = { vw: 0, vh: 0 };
  function poser() {
    var vw = racine.clientWidth || window.innerWidth, vh = racine.clientHeight || window.innerHeight;
    // Au téléphone, le clavier de l'écran peut rétrécir la page : on garde alors la mise en page d'avant, sans tout faire sauter.
    if (!PC && document.activeElement === champ && vw === dernier.vw && vh < dernier.vh) { E.vh = vh; placer(); return; }
    dernier = { vw: vw, vh: vh };
    var n = vw >= vh ? 'cote' : 'pile';
    if (n !== nom) {                                       // nouvelle mise en page (ou première) : tout se place, la fenêtre revient à sa place
      nom = n; M = MISES[n];
      pc.style.width = M.W + 'px'; pc.style.height = M.H + 'px';
      tag.style.left = M.tag[0] + 'px'; tag.style.top = M.tag[1] + 'px';
      selection.style.left = M.tag[0] + 'px'; selection.style.top = (M.tag[1] + 1) + 'px';
      bande.style.left = M.bande[0] + 'px'; bande.style.top = M.bande[1] + 'px';
      term.style.width = M.term[2] + 'px'; term.style.height = M.term[3] + 'px';
      ecran.style.height = (M.term[3] - 50) + 'px';
      MAXL = Math.max(4, Math.floor((M.term[3] - 50 - 8) / 23));
      F = { x: M.term[0], y: M.term[1] };
      dessiner();
    }
    var m = Math.max(12, Math.min(vw, vh) * 0.05);
    var k = Math.max(0.2, Math.min(1.5, (vw - 2 * m) / M.W, (vh - 2 * m) / M.H));
    var x = (vw - M.W * k) / 2, y = (vh - M.H * k) / 2;
    pc.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + k.toFixed(4) + ')';
    E = { k: k, x: x, y: y, vw: vw, vh: vh };
    placer();
  }
  window.addEventListener('resize', poser);

  /* ---------- Entrer : fondu au noir, puis le noir se lève sur le bodega ---------- */
  var parti = false;
  function entre(par) {
    if (parti) return; parti = true;
    INTRO.par = par || ''; INTRO.fin = Date.now();
    racine.classList.add('part');
    var T = calme ? 380 : 700;
    noir.style.transition = 'opacity ' + T + 'ms ease-in-out';
    void racine.offsetWidth;                               // la transition part de l'état actuel
    noir.style.opacity = '1';
    setTimeout(dansLeNoir, T + 40);
  }
  function dansLeNoir() {
    scene.style.display = 'none';
    racine.style.background = NOIR;
    var depuis = Date.now(), dit = false;
    (function guetter() {
      var charge = pret && (window.bodega || document.getElementById('fail') && !document.getElementById('fail').hidden);
      if (charge || Date.now() - depuis > 9000) { requestAnimationFrame(function () { requestAnimationFrame(lever); }); return; }
      if (!dit && Date.now() - depuis > 500) { dit = true; attente.textContent = 'Loading the bar…'; attente.style.opacity = '1'; }
      setTimeout(guetter, 80);
    })();
  }
  function lever() {
    dehors = false; figer(false);
    INTRO.etat = 'entre';
    window.removeEventListener('keydown', touches, true); window.removeEventListener('keyup', touches, true);
    window.removeEventListener('resize', poser);
    window.removeEventListener('paste', coller, true);
    try { window.dispatchEvent(new Event('bodega-entree')); } catch (e) {}
    attente.style.opacity = '0';
    racine.style.pointerEvents = 'none';
    racine.style.transition = 'opacity ' + (calme ? 300 : 750) + 'ms ease-out';
    racine.style.opacity = '0';
    setTimeout(function () { if (racine.parentNode) racine.parentNode.removeChild(racine); if (css.parentNode) css.parentNode.removeChild(css); }, calme ? 340 : 800);
  }

  poser();
})();
