/* chat.js : le chat du bar, en bas à droite. Il passe par le relais des fantômes (fantomes.js → FANTOMES.chat).

   Ce qu'on voit :
     - Ordinateur : un petit panneau en bas à droite, les derniers messages au-dessus d'une ligne de saisie.
       T (ou un clic sur la ligne) pour écrire, Entrée pour envoyer, Échap pour revenir au bar sans rien envoyer.
       Pendant qu'on écrit, les touches ne font plus marcher dans le bar ; la souris est rendue.
     - Téléphone : une bulle « chat » en bas à droite (avec le nombre de messages non lus) ; un toucher ouvre le panneau, la croix
       le referme.
     - Au-dessus de la tête de celui qui parle, une bulle avec son message (fantomes.js s'en charge).
     - Un clic sur un nom le masque (sur cette page seulement : ses messages et ses bulles disparaissent) ; un autre clic le remet.
   Le chat n'apparaît que quand on est connecté au relais. Pas d'historique : on ne voit que les messages arrivés depuis qu'on est là.
   Le contenu du chat n'est jamais noté dans le journal de visite (trace.js ne le voit pas).

   Modération (pour Léo) : ouvrir la page avec #admin à la fin de l'adresse (berao.fr/#admin). Une ligne « admin key » apparaît
   en bas du panneau : y taper la clé (le secret ADMIN du relais). Ensuite chaque message porte un bouton « kick » (expulser son
   auteur), et l'en-tête un bouton pour fermer / rouvrir le chat pour tout le monde. La clé reste dans cet onglet seulement.

   Réglage : CONTACT, une adresse pour signaler un message (affichée dans le panneau). Vide : pas de ligne « report ». */
(function () {
  'use strict';
  var CONTACT = '';                                        // ex. 'contact@berao.fr' : pour signaler un message
  var GARDE = 40;                                          // messages gardés dans le panneau, au plus
  var VUS_ORDI = 7;                                        // messages visibles d'un coup sur ordinateur (on fait défiler pour les autres)
  var EFFACE = 25;                                         // secondes : un message s'estompe tant qu'on n'écrit pas (ordinateur)
  var MOTS = { vite: 'Wait a moment before sending again.', double: 'You just said that.', ferme: 'The chat is closed.',
               'pas-la': 'Walk into the bar first.', cle: 'Wrong admin key.', vide: '' };

  var PC = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  var stage = document.getElementById('stage');
  if (!stage) return;

  var css = document.createElement('style');
  css.textContent =
    '#chat { position: absolute; z-index: 7; right: max(16px, env(safe-area-inset-right, 0px)); bottom: 12px; width: min(300px, calc(100% - 32px));' +
    '  font: 12px/1.45 var(--mono, ui-monospace, Menlo, Consolas, monospace); color: var(--fg, #efe6d2); user-select: text; -webkit-user-select: text; cursor: auto; }' +
    '#chat[hidden], #chatBtn[hidden] { display: none; }' +
    '#chat .fil { max-height: calc(' + VUS_ORDI + ' * 1.45em + 12px); overflow-y: auto; padding: 4px 8px; display: flex; flex-direction: column; gap: 1px;' +
    '  scrollbar-width: thin; overscroll-behavior: contain; }' +
    '#chat .fil:empty { display: none; }' +
    '#chat .ligne { overflow-wrap: anywhere; text-shadow: 0 1px 0 rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.7); transition: opacity 1.2s; }' +
    '#chat .ligne.vieux { opacity: 0.32; }' +
    '#chat.actif .ligne.vieux, #chat:hover .ligne.vieux { opacity: 1; }' +
    '#chat .nom { font: inherit; color: var(--amber, #e0a83a); background: none; border: 0; padding: 0; cursor: pointer; text-shadow: inherit; }' +
    '#chat .nom.moi { color: #f4ead2; cursor: default; }' +
    '#chat .nom:hover:not(.moi) { text-decoration: underline; }' +
    '#chat .sys { color: var(--muted, #9c927e); font-style: italic; }' +
    '#chat .kick { font: inherit; font-size: 10px; margin-left: 6px; padding: 0 4px; color: #e2553d; background: rgba(20,17,13,0.8); border: 1px solid #e2553d; cursor: pointer; }' +
    '#chat .saisie { display: flex; align-items: center; gap: 6px; margin-top: 4px; padding: 5px 8px; background: var(--panel, rgba(20,17,13,0.72)); border: 1px solid var(--line, rgba(239,230,210,0.28)); }' +
    '#chat.actif .saisie { border-color: var(--amber, #e0a83a); }' +
    '#chat input { flex: 1; min-width: 0; font: inherit; color: inherit; background: none; border: 0; outline: none; padding: 2px 0; }' +
    '#chat input::placeholder { color: var(--muted, #9c927e); opacity: 1; }' +
    '#chat input:disabled { cursor: not-allowed; }' +
    '#chat .compte { color: var(--muted, #9c927e); font-size: 10px; font-variant-numeric: tabular-nums; }' +
    '#chat .tete { display: none; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 8px; background: var(--panel, rgba(20,17,13,0.72));' +
    '  border: 1px solid var(--line, rgba(239,230,210,0.28)); border-bottom: 0; text-transform: uppercase; letter-spacing: 0.06em; }' +
    '#chat .tete b { color: var(--amber, #e0a83a); font-weight: 700; }' +
    '#chat .tete button, #chat .admin button { font: inherit; color: var(--amber, #e0a83a); background: none; border: 1px solid var(--line, rgba(239,230,210,0.28)); padding: 2px 8px; cursor: pointer; min-height: 28px; }' +
    '#chat .admin { display: flex; gap: 6px; margin-top: 4px; padding: 5px 8px; background: var(--panel, rgba(20,17,13,0.72)); border: 1px dashed #e2553d; }' +
    '#chat .admin input { color: #e2553d; }' +
    '#chat .signaler { margin-top: 3px; color: var(--muted, #9c927e); font-size: 10px; text-align: right; }' +
    '#chatBtn { position: absolute; z-index: 4; right: max(20px, env(safe-area-inset-right, 0px)); bottom: max(88px, calc(env(safe-area-inset-bottom, 0px) + 76px));' +
    '  min-width: 52px; min-height: 44px; padding: 0 10px; font: 700 12px var(--mono, ui-monospace, monospace); letter-spacing: 0.06em; text-transform: uppercase;' +
    '  color: var(--fg, #efe6d2); background: var(--panel, rgba(20,17,13,0.72)); border: 1px solid var(--line, rgba(239,230,210,0.28)); }' +
    '#chatBtn .non-lus { display: inline-block; min-width: 16px; margin-left: 6px; padding: 0 3px; color: #17100b; background: var(--amber, #e0a83a); }' +
    '#chatBtn .non-lus:empty { display: none; }' +
    // téléphone : le panneau ouvert prend le bas de l'écran, avec un en-tête et une croix
    '#chat.tel { left: max(12px, env(safe-area-inset-left, 0px)); right: max(12px, env(safe-area-inset-right, 0px)); width: auto; bottom: max(12px, env(safe-area-inset-bottom, 0px)); }' +
    '#chat.tel .tete { display: flex; }' +
    '#chat.tel .tete, #chat.tel .fil, #chat.tel .saisie { background: #14110d; }' +
    '#chat.tel .fil { max-height: 34vh; min-height: 3em; border: 1px solid var(--line, rgba(239,230,210,0.28)); border-top: 0; }' +
    '#chat.tel .fil:empty { display: flex; }' +
    '#chat.tel .ligne.vieux { opacity: 1; }' +
    '#chat.tel input { font-size: 16px; }' +                // 16 px : l'iPhone ne zoome pas sur le champ
    '#chat .tete .fermer-chat { min-width: 44px; min-height: 36px; }' +
    '#chat:not(.tel) .fermer-chat { display: none; }' +
    // pas de chat devant la télé, le juke-box, un tableau, ni en entrant aux archives
    '#stage.tele #chat, #stage.playing #chat, #stage.archive #chat, #stage.toile #chat,' +
    '#stage.tele #chatBtn, #stage.playing #chatBtn, #stage.archive #chatBtn, #stage.toile #chatBtn { visibility: hidden; }';
  document.head.appendChild(css);

  var boite = document.createElement('div');
  boite.id = 'chat'; boite.hidden = true; boite.setAttribute('role', 'region'); boite.setAttribute('aria-label', 'Chat');
  boite.innerHTML =
    '<div class="tete"><b>Chat</b><span><button type="button" class="ferme-pour-tous" hidden></button> <button type="button" class="fermer-chat" aria-label="Close the chat">✕</button></span></div>' +
    '<div class="fil" aria-live="polite"></div>' +
    '<form class="saisie" autocomplete="off"><input type="text" maxlength="200" enterkeyhint="send" aria-label="Message">' +
    '<span class="compte" aria-hidden="true"></span></form>' +
    '<form class="admin" hidden autocomplete="off"><input type="password" placeholder="admin key" aria-label="Admin key"><button type="submit">OK</button></form>' +
    '<div class="signaler" hidden></div>';
  stage.appendChild(boite);
  var bouton = document.createElement('button');
  bouton.id = 'chatBtn'; bouton.type = 'button'; bouton.hidden = true; bouton.setAttribute('aria-label', 'Open the chat');
  bouton.innerHTML = 'Chat<span class="non-lus"></span>';
  stage.appendChild(bouton);

  var fil = boite.querySelector('.fil'), form = boite.querySelector('.saisie'), champ = form.querySelector('input'), compte = form.querySelector('.compte');
  var formAdmin = boite.querySelector('.admin'), champAdmin = formAdmin.querySelector('input'), pourTous = boite.querySelector('.ferme-pour-tous');
  var nonLus = bouton.querySelector('.non-lus'), signaler = boite.querySelector('.signaler');
  if (CONTACT) { signaler.hidden = false; signaler.textContent = 'Report a message: ' + CONTACT; }

  // Rien de ce qui se passe dans le chat n'atteint le bar : ni les touches (on n'y marche pas en écrivant), ni les clics (on n'y
  // tourne pas la tête), ni la molette.
  ['keydown', 'keyup', 'keypress'].forEach(function (t) { boite.addEventListener(t, function (e) { e.stopPropagation(); }); });
  ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'wheel', 'click', 'dblclick'].forEach(function (t) {
    boite.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true });
    bouton.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true });
  });

  var F = null, ouvertTel = false, admin = { voulu: /(^|[#&])admin($|&)/.test(location.hash), cle: '', ok: false, chat: true }, lus = 0;
  try { admin.cle = sessionStorage.getItem('berao-admin') || ''; if (admin.cle) admin.voulu = true; } catch (e) {}

  /* ---------- Afficher ---------- */
  function ligneSys(texte) {
    if (!texte) return;
    var d = document.createElement('div'); d.className = 'ligne sys'; d.textContent = texte;
    ajouter(d);
  }
  function ajouter(d) {
    d.dataset.t = String(Date.now());
    fil.appendChild(d);
    while (fil.children.length > GARDE) fil.removeChild(fil.firstChild);
    fil.scrollTop = fil.scrollHeight;
  }
  function ligneMessage(m) {
    var d = document.createElement('div'); d.className = 'ligne'; d.dataset.id = m.id;
    var n = document.createElement('button'); n.type = 'button'; n.className = 'nom' + (m.moi ? ' moi' : ''); n.textContent = m.nom;
    n.title = m.moi ? '' : 'Click to mute / unmute';
    if (!m.moi) n.addEventListener('click', function () { basculerMuet(m.id, m.nom); });
    d.appendChild(n); d.appendChild(document.createTextNode(': ' + m.txt));
    if (admin.ok && !m.moi) {
      var k = document.createElement('button'); k.type = 'button'; k.className = 'kick'; k.textContent = 'kick';
      k.addEventListener('click', function () { if (F) F.chat.admin(admin.cle, 'expulser', m.id); ligneSys(m.nom + ' was kicked.'); });
      d.appendChild(k);
    }
    if (F && F.chat.estMuet(m.id)) d.hidden = true;
    ajouter(d);
  }
  function basculerMuet(id, nom) {
    if (!F) return;
    var oui = !F.chat.estMuet(id);
    F.chat.muet(id, oui);
    [].forEach.call(fil.querySelectorAll('.ligne'), function (l) { if (l.dataset.id === id) l.hidden = oui; });
    ligneSys(oui ? nom + ' is muted for you on this page.' : nom + ' is unmuted.');
  }
  function vieillir() {                                    // ordinateur : les vieux messages s'estompent tant qu'on n'écrit pas
    var t = Date.now();
    [].forEach.call(fil.children, function (l) { l.classList.toggle('vieux', t - Number(l.dataset.t || 0) > EFFACE * 1000); });
  }
  function placeholder() {
    if (!F) return;
    if (F.chat.expulse()) { champ.placeholder = 'You were removed from the bar.'; champ.disabled = true; return; }
    if (!F.chat.ouvert()) { champ.placeholder = 'The chat is closed.'; champ.disabled = true; return; }
    champ.disabled = false;
    champ.placeholder = PC ? (ecrit() ? 'Enter to send · Esc to cancel' : 'Press T to talk') : 'Say something…';
  }
  function majCompte() { var n = Array.from(champ.value).length; compte.textContent = n > 100 ? String(140 - n) : ''; }

  /* ---------- Écrire ---------- */
  function ecrit() { return document.activeElement === champ; }
  var MARCHE = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyQ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyR'];
  function lacherTouches() {                               // les touches tenues au moment d'ouvrir le chat : le bar les croit relâchées
    MARCHE.forEach(function (c) { try { window.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: '' })); } catch (e) {} });
  }
  function ecrire() {
    if (boite.hidden || champ.disabled) return;
    lacherTouches();
    if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
    champ.focus();
  }
  champ.addEventListener('focus', function () { boite.classList.add('actif'); placeholder(); });
  champ.addEventListener('blur', function () { boite.classList.remove('actif'); placeholder(); });
  champ.addEventListener('input', majCompte);
  champ.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); champ.value = ''; majCompte(); champ.blur(); }
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = champ.value;
    if (t.trim() && F && F.chat.envoyer(t)) { champ.value = ''; majCompte(); }
    if (PC) champ.blur();                                  // ordinateur : on revient au bar ; téléphone : on peut continuer
  });
  // T, depuis le bar : écrire (pas devant la télé, le juke-box ou un tableau, ni avec Ctrl ou Cmd)
  document.addEventListener('keydown', function (e) {
    if (e.code !== 'KeyT' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || ecrit() || boite.hidden || !PC) return;
    var a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    if (/\b(tele|playing|archive|toile)\b/.test(stage.className)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    ecrire();
  }, true);

  /* ---------- Téléphone : la bulle « chat » ouvre le panneau ---------- */
  function montrerTel(oui) {
    ouvertTel = oui;
    boite.hidden = !oui; bouton.hidden = oui;
    if (oui) { lus = 0; nonLus.textContent = ''; fil.scrollTop = fil.scrollHeight; }
    else champ.blur();
  }
  bouton.addEventListener('click', function () { montrerTel(true); });
  boite.querySelector('.fermer-chat').addEventListener('click', function () { montrerTel(false); });

  /* ---------- Modération ---------- */
  formAdmin.addEventListener('submit', function (e) {
    e.preventDefault();
    admin.cle = champAdmin.value; champAdmin.value = '';
    if (F && admin.cle) F.chat.admin(admin.cle, 'etat');
  });
  pourTous.addEventListener('click', function () { if (F && admin.ok) F.chat.admin(admin.cle, admin.chat ? 'fermer' : 'ouvrir'); });
  function majAdmin() {
    formAdmin.hidden = !admin.voulu || admin.ok;
    pourTous.hidden = !admin.ok;
    pourTous.textContent = admin.chat ? 'Close chat for all' : 'Open chat for all';
    if (admin.ok) boite.querySelector('.tete').style.display = 'flex';
  }

  /* ---------- Ce qui arrive du relais ---------- */
  function recevoir(m) {
    if (m.t === 'm') {
      if (F.chat.estMuet(m.id)) return;
      ligneMessage(m);
      if (!PC && !ouvertTel && !m.moi) { lus++; nonLus.textContent = lus > 9 ? '9+' : String(lus); }
    } else if (m.t === 'refus') {
      if (m.pourquoi === 'cle') { admin.ok = false; admin.cle = ''; try { sessionStorage.removeItem('berao-admin'); } catch (e) {} majAdmin(); }
      ligneSys(MOTS[m.pourquoi] !== undefined ? MOTS[m.pourquoi] : '');
    } else if (m.t === 'chat') {
      admin.chat = m.ouvert; majAdmin(); placeholder();
      ligneSys(m.ouvert ? 'The chat is open.' : 'The chat was closed by the bar.');
    } else if (m.t === 'admin') {
      var nouveau = !admin.ok;
      admin.ok = true; admin.chat = m.chat; try { sessionStorage.setItem('berao-admin', admin.cle); } catch (e) {}
      majAdmin(); if (nouveau) ligneSys('Admin mode: click “kick” next to a message to remove its author.');
    } else if (m.t === 'expulse') { ligneSys('You were removed from the bar.'); placeholder(); }
  }

  /* ---------- On se branche sur les fantômes ---------- */
  var etaitPret = false;
  function surveiller() {
    if (!F) {
      if (!(window.FANTOMES && window.FANTOMES.chat)) return;
      F = window.FANTOMES; F.chat.ecouter(recevoir);
    }
    var pret = F.chat.pret(), montrer = pret || F.chat.expulse();
    if (PC) { boite.hidden = !montrer; bouton.hidden = true; }
    else if (!montrer) { boite.hidden = true; bouton.hidden = true; ouvertTel = false; }
    else { boite.classList.add('tel'); boite.hidden = !ouvertTel; bouton.hidden = ouvertTel; }
    if (pret && !etaitPret) {
      placeholder();
      if (admin.voulu && admin.cle && !admin.ok) F.chat.admin(admin.cle, 'etat');   // la clé gardée dans cet onglet
      majAdmin();
    }
    etaitPret = pret;
    if (PC) vieillir();
  }
  majAdmin(); placeholder();
  setInterval(surveiller, 400); surveiller();
  window.BodegaChat = { ecrire: ecrire, ouvrir: function () { if (!PC) montrerTel(true); else ecrire(); }, fermer: function () { if (!PC) montrerTel(false); else champ.blur(); } };
})();
