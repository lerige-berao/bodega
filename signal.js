/* signal.js : des panneaux en papier qui tombent en haut de l'écran (aucune dépendance, pas besoin de Three.js).

   Les panneaux sont tes dessins au crayon, découpés dans la photo du cahier avec leur papier :
     signal/new-skill.webp   l'éclair « NEW SKILL UNLOCKED »
     signal/go-pipi.webp     le cadre « GO PIPI », découpé au ras des pointillés et laissé de biais comme sur le dessin

   Branchement :
     var signaux = SIGNAL.creer({ ecran: stage });          // stage = l'élément qui contient le canvas (position relative ou absolue)
     signaux.montrer('new-skill', 3.2);                     // tombe du haut, reste 3,2 s, repart
     signaux.montrer('go-pipi');                            // sans durée : reste jusqu'à signaux.cacher('go-pipi')
     signaux.montrer('new-skill', 3.2, function () { signaux.montrer('go-pipi'); });   // l'un après l'autre
     signaux.visible('go-pipi');                            // vrai tant qu'il est à l'écran

   Ajouter un panneau : SIGNAL.creer({ ecran: stage, panneaux: { 'mon-panneau': { image: 'mon-panneau.webp', largeur: 300, fixe: false } } });
   Réglages de creer : dossier 'signal/' (où sont les images), haut 10 (px depuis le haut de l'écran).
   Un panneau « fixe » (go-pipi) ne bouge pas du tout : il apparaît et disparaît sur place, sans tomber ni se balancer.
*/
var SIGNAL = (function () {
  'use strict';
  var PANNEAUX = {
    'new-skill': { image: 'new-skill.webp', largeur: 440, alt: 'New skill unlocked' },
    'go-pipi': { image: 'go-pipi.webp', largeur: 250, alt: 'Go pipi', fixe: true }
  };
  var CSS = [
    '.sig-boite{position:absolute;left:0;right:0;top:10px;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;z-index:5}',
    '.sig{display:none;max-width:78%}',
    '.sig img{display:block;width:100%;height:auto;filter:drop-shadow(0 4px 0 rgba(0,0,0,.45));transform-origin:50% -30%;animation:sig-balance 2.6s ease-in-out infinite alternate}',
    '.sig.fixe img{animation:none}',
    '.sig.fixe.la{animation:sig-fondu .15s linear both}',
    '.sig.fixe.part{animation:sig-efface .15s linear both}',
    '.sig.la{display:block;animation:sig-entre .6s cubic-bezier(.2,1.5,.4,1) both}',
    '.sig.part{display:block;animation:sig-sort .35s ease-in both}',
    '@keyframes sig-entre{from{transform:translateY(-170%) rotate(-8deg)}to{transform:none}}',
    '@keyframes sig-sort{from{transform:none}to{transform:translateY(-190%) rotate(6deg)}}',
    '@keyframes sig-balance{from{transform:rotate(-1.6deg)}to{transform:rotate(1.6deg)}}',
    '@keyframes sig-fondu{from{opacity:0}to{opacity:1}}',
    '@keyframes sig-efface{from{opacity:1}to{opacity:0}}',
    '@media (prefers-reduced-motion:reduce){.sig.la,.sig.part,.sig.fixe.la,.sig.fixe.part,.sig img{animation:none}.sig.part,.sig.fixe.part{display:none}}'
  ].join('\n');

  function creer(opt) {
    opt = opt || {};
    var ecran = opt.ecran || document.body, dossier = opt.dossier === undefined ? 'signal/' : opt.dossier, panneaux = {}, k;
    for (k in PANNEAUX) panneaux[k] = PANNEAUX[k];
    for (k in (opt.panneaux || {})) panneaux[k] = opt.panneaux[k];
    if (!document.getElementById('sig-style')) {
      var st = document.createElement('style'); st.id = 'sig-style'; st.textContent = CSS; document.head.appendChild(st);
    }
    var boite = document.createElement('div'); boite.className = 'sig-boite';
    if (opt.haut !== undefined) boite.style.top = opt.haut + 'px';
    ecran.appendChild(boite);
    var etats = {};
    Object.keys(panneaux).forEach(function (nom) {                  // images chargées d'avance : le panneau tombe sans attendre
      var p = panneaux[nom], d = document.createElement('div'), img = document.createElement('img');
      d.className = 'sig' + (p.fixe ? ' fixe' : ''); d.style.width = (p.largeur || 300) + 'px';
      img.src = /^(data:|blob:|https?:|\/)/.test(p.image) ? p.image : dossier + p.image; img.alt = p.alt || nom; img.draggable = false;
      d.appendChild(img); boite.appendChild(d);
      d.addEventListener('animationend', function (e) { if (e.target === d && d.classList.contains('part')) d.classList.remove('part'); });
      etats[nom] = { el: d, minuterie: 0, visible: false };
    });

    function cacher(nom) {
      var s = etats[nom]; if (!s) return api;
      clearTimeout(s.minuterie);
      if (s.visible) { s.visible = false; s.el.classList.remove('la'); s.el.classList.add('part'); }
      return api;
    }
    // duree en secondes (absente = reste affiché). suite() est appelée quand le panneau repart de lui-même.
    function montrer(nom, duree, suite) {
      var s = etats[nom]; if (!s) return api;
      clearTimeout(s.minuterie);
      s.el.classList.remove('part', 'la');
      void s.el.offsetWidth;                                        // relance l'animation d'entrée si le panneau était déjà là
      s.el.classList.add('la'); s.visible = true;
      if (duree) s.minuterie = setTimeout(function () { cacher(nom); if (suite) suite(); }, duree * 1000);
      return api;
    }
    var api = {
      boite: boite, montrer: montrer, cacher: cacher,
      visible: function (nom) { return !!(etats[nom] && etats[nom].visible); },
      toutCacher: function () { Object.keys(etats).forEach(cacher); return api; }
    };
    return api;
  }
  return { creer: creer, panneaux: PANNEAUX };
})();
