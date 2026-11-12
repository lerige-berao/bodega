/* pnj.js : PNJ plats en calques, pour le bodega (Three.js r128, sans dépendance de plus).

   Un PNJ = des PNG transparents empilés, dans l'ordre du croquis :
     tete.png · tshirt.png · pantalon.png · chaussure.png (une seule chaussure, bout à droite ; elle est dupliquée en miroir)
     semelle.png, pour la pose assise : le dessous d'une chaussure, pointe en haut ; dupliqué en miroir lui aussi
     main.png et paume.png, facultatifs : UNE main, doigts vers le bas, vue de dos puis vue de paume (voir « Mains » plus bas)
   Le corps est fait de trois morceaux plats articulés (le bas, le torse, la tête), chacun avec sa petite texture basse
   définition : trois appels de dessin, plus un par main.

   Le dos : tete-dos.png, tshirt-dos.png, pantalon-dos.png, facultatifs. Avec eux le PNJ a un verso, comme une carte :
   le plan montre la face d'un côté et le dos de l'autre. Sans eux, le verso est la face en miroir.
     PNJ.creer({ ..., teteDos: 'tete-dos.png', tshirtDos: 'tshirt-dos.png', pantalonDos: 'pantalon-dos.png' });
   Trois façons de le présenter au joueur :
     face: 'camera'                  il se tourne toujours vers le joueur, on ne voit que sa face (réglage par défaut)
     face: 'camera', regard: 0       il regarde dans une direction (angle en radians, 0 = vers +z) ; le plan reste tourné vers
                                     le joueur mais montre la face ou le dos selon que le joueur est devant ou derrière lui.
                                     Quand il marche, il regarde où il va : on le voit de dos quand il s'éloigne.
     face: 1.57                      carton fixe : un vrai recto verso planté dans le décor
     leo.regarder(0);  leo.regarder(P(700, 800));    // change la direction du regard : un angle, ou un point à regarder

   Attitudes au comptoir : il se tourne vers le comptoir (son regard) et prend la pose, sur place.
     leo.attitude('appuye');   // les deux mains posées sur le comptoir, t-shirt penché vers l'avant, tête droite
     leo.attitude('hanche');   // une main sur le comptoir, l'autre sur la hanche, tête un peu penchée
     leo.attitude('verre');    // le barman : une main tient un verre, l'autre l'essuie avec un chiffon qui mousse
     leo.attitude(null);       // il relâche tout
     leo.attitude('appuye', { hauteur: 1.06, distance: 0.3 });   // dessus du comptoir (1,06 m dans le bodega) et distance jusqu'à son bord
     leo.attitude('appuye', { direction: 1.57 });                // angle vers lequel il se tourne : là où est le comptoir
     PNJ.creer({ ..., regard: 0, attitude: 'verre' });           // ou dès la création
   S'il marche, il lâche le comptoir et reprend la pose à l'arrivée (donne-lui alors son regard avec regarder()).

   Servir une bière : il se penche, plonge la main sous le comptoir, en ressort une bouteille et la pose sur le comptoir.
     leo.servir();                                            // une fois ; il reprend ensuite son attitude
     leo.servir({ hauteur: 1.06, distance: 0.3, direction: 0 }, function (pnj, bouteille) { ... });   // prévenu quand elle est posée
     leo.bouteilles();                                        // les bouteilles posées (THREE.Group), 3 au plus : la plus vieille disparaît
   La bouteille est celle de l'atelier « Modèle 3D style PS1 » si la page la fournit à l'init :
     PNJ.init({ ..., bouteille: function () { return MODELES.creer(THREE, 'bouteille'); } });
   Sans cela, une bouteille simple en trois cylindres la remplace.

   Deux poses :
     debout : tête, t-shirt, pantalon entier, chaussures de profil
     assis  : tête, t-shirt, pantalon raccourci (on ne garde que le haut), semelles face au joueur ; le bas du PNJ est posé au bord du siège
              (vu de dos : pas de semelles, les jambes partent de l'autre côté)

   Branchement dans le bodega (3 lignes) :
     PNJ.init({ THREE: THREE, scene: scene, camera: camera, colliders: colliders, dossier: 'pnj/' });
     var leo = PNJ.creer({ tete: 'tete.png', tshirt: 'tshirt.png', pantalon: 'pantalon.png', chaussure: 'chaussure.png',
                           semelle: 'semelle.png', pos: P(700, 800) });
     PNJ.maj(dt);                       // dans frame(), avant renderer.render

   Ensuite :
     leo.habiller({ tshirt: 'autre-tshirt.png' });   // change un ou plusieurs calques
     leo.placer(3.2, 1.5);  leo.placer(P(640, 700)); // téléporte (mètres, ou pixels du croquis via P)
     leo.marcher(4, 2);                              // y va à pied, en ligne droite
     leo.ronde([P(600, 700), P(700, 820)], 3);       // fait des allers-retours, 3 s de pause à chaque point
     leo.asseoir();  leo.asseoir(0.47);              // s'assoit là où il est (hauteur d'assise en mètres, 0.47 par défaut)
     leo.lever();                                    // se remet debout ; marcher() et ronde() le lèvent tout seuls
     PNJ.creer({ ..., pose: 'assis', siege: 0.47 }); // ou directement assis à la création
     leo.arreter();  leo.retirer();

   Lui parler : quand le joueur est à portée, il marmonne comme un Danois bourré (son fabriqué sur place, aucun fichier).
     var qui = PNJ.proche();            // le PNJ à portée du joueur, ou null : sert à afficher « E · lui parler »
     PNJ.parler();                      // fait parler ce PNJ ; à appeler depuis un clic, un toucher ou une touche (E)
     leo.parler();  leo.parle();        // ou un PNJ précis ; parle() dit s'il est en train de marmonner
     PNJ.creer({ ..., portee: 1.6, voix: { hauteur: 95, ivresse: 0.9 } });   // voix plus grave, plus bourrée

   Mains : deux mains plates qui flottent de chaque côté du t-shirt, sans bras. Chacune a deux faces, comme une carte :
   le dos de la main côté joueur, la paume de l'autre côté. Elles flottent, se balancent quand il marche, et se
   retournent en s'agitant quand il parle. La main de gauche est l'image telle quelle, celle de droite son miroir.
     PNJ.creer({ ..., main: 'main.png', paume: 'paume.png' });                // sans « main », pas de mains
     PNJ.creer({ ..., main: 'main.png', mains: { taille: 0.16, angle: 0.6 } });   // plus grosses, plus écartées ; sans paume, le dos sert des deux côtés
     leo.habiller({ main: 'gant.png', paume: 'gant-paume.png' });

   Avec un vrai enregistrement : à chaque fois qu'on lui parle, il dit une phrase de l'audio, jamais deux fois la même de suite.
     PNJ.creer({ ..., voix: { fichier: 'voix.mp3' } });                       // phrases repérées toutes seules, aux silences
     PNJ.creer({ ..., voix: { fichier: 'voix.mp3', phrases: [[5.9, 8.1], [8.6, 11.2]] } });   // ou découpe imposée, en secondes
     leo.regler({ voix: { fichier: unFichier } });                            // fichier = nom, URL, File/Blob ou ArrayBuffer
   Tant que l'audio n'est pas chargé (ou s'il n'y en a pas), il garde son marmonnement fabriqué.
*/
var PNJ = (function () {
  'use strict';

  var T3 = null, scene = null, camera = null, colliders = null, dossier = '';
  var tous = [], images = {}, GEO = null, GEO_MAIN = null, fabriqueBouteille = null, horloge = 0, audio = null, bruit = null, banques = [];
  var CALQUES = ['tete', 'tshirt', 'pantalon', 'chaussure', 'semelle', 'main', 'paume', 'teteDos', 'tshirtDos', 'pantalonDos'];
  var FORME = { tete: 1, tshirt: 1.1, pantalon: 0.52, chaussure: 1.8, semelle: 0.4 }; // largeur / hauteur, si l'image manque
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  var DEFAUT = {
    taille: 1.75,          // hauteur totale, en mètres
    grain: 150,            // pixels de texture par mètre : plus bas = plus PS1, plus haut = plus net
    couleurs: 32,          // niveaux par canal (32 = les 15 bits de la PS1) ; 0 = couleurs intactes
    teinte: 0xd8c6a4,      // voile de couleur, pour fondre le PNJ dans la lumière jaune du bar
    face: 'camera',        // 'camera' = se tourne toujours vers le joueur ; un angle en radians = carton fixe
    regard: null,          // avec face 'camera' : direction dans laquelle il regarde (radians) ; null = il montre toujours sa face
    solide: true,          // le joueur ne peut pas le traverser
    rayon: 0.18,           // encombrement au sol, en mètres
    vitesse: 0.8,          // marche, en m/s
    vie: true,             // léger balancement quand il ne marche pas
    // Hauteur de chaque calque, en parts de la silhouette, et ce qui passe sous le calque du dessus.
    proportions: { tete: 0.27, tshirt: 0.36, pantalon: 0.43, chaussure: 0.085 },
    recouvrement: { col: 0.03, ceinture: 0.04, cheville: 0.045 },
    ecart: 0.25,           // position de chaque pied, en part de la largeur du pantalon
    portee: 1.6,           // distance, en mètres, en dessous de laquelle le joueur peut lui parler
    voix: {
      hauteur: 105,        // note de base, en Hz : 85 = très grave, 130 = voix claire
      timbre: 1,           // taille de la bouche : < 1 = plus caverneux, > 1 = plus nasillard
      ivresse: 0.7,        // 0 = à jeun (net, rapide), 1 = cuit (lent, pâteux, hoquets)
      volume: 1,
      fichier: null,       // un enregistrement à faire parler à la place du marmonnement (voir l'en-tête)
      phrases: null,       // sa découpe en phrases, [[début, fin], ...] en secondes ; sinon repérée aux silences
      vitesse: 1           // vitesse de lecture de l'enregistrement : 0.9 = plus lent et plus grave
    },
    mains: {
      taille: 0.15,        // longueur d'une main, dans la même unité que les proportions
      ecart: 0.95,         // où elles flottent : 1 = à l'aplomb du bord du t-shirt (manches comprises), plus = plus loin du corps
      hauteur: 0.75,       // poignet au-dessus du bas du t-shirt, en longueurs de main
      angle: 0.4,          // doigts tournés vers l'extérieur, en radians
      flotte: true         // elles bougent toutes seules ; false = immobiles (sauf marche et parole)
    },
    attitude: null,        // null, 'appuye', 'hanche' ou 'verre' (voir l'en-tête)
    comptoir: { hauteur: 1.06, distance: 0.3 },   // dessus du comptoir, et distance entre lui et le bord du comptoir, en mètres ; direction : facultatif
    pose: 'debout',        // 'debout' ou 'assis'
    siege: 0.47,           // pose assise : hauteur de l'assise, en mètres (bancs et chaises du bodega : 0.47)
    assis: {
      coupe: 0.22,         // part du pantalon qu'on garde, en partant de la ceinture : 0.22 = juste le bassin
      semelle: 0.17,       // hauteur d'une semelle, dans la même unité que les proportions
      angle: 0.16,         // pieds en canard : inclinaison de chaque semelle, en radians
      depasse: 0.03,       // ce dont les semelles descendent sous le pantalon coupé
      avance: 0.2,         // le plan est avancé d'autant vers le joueur (mètres) : les pieds passent devant le siège
      descend: 0.08        // et descendu d'autant sous l'assise (mètres) : les semelles mordent sur le bord du siège
    }
  };

  function simple(x) { return !!x && Object.prototype.toString.call(x) === '[object Object]'; }
  function fusion(a, b) {
    var o = {}, k;
    for (k in a) o[k] = a[k];
    for (k in b) if (b[k] !== undefined) {
      o[k] = (simple(a[k]) && simple(b[k])) ? fusion(a[k], b[k]) : b[k];   // on ne fond que les objets de réglages, pas les tableaux ni les fichiers
    }
    return o;
  }
  function toile(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }

  /* ---------- Images : chargées une fois, rognées au plus près du dessin ---------- */
  function rogner(img) {
    var w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
    if (!w0 || !h0) return null;
    var k = Math.min(1, 640 / Math.max(w0, h0));
    var c = toile(w0 * k, h0 * k), g = c.getContext('2d');
    g.drawImage(img, 0, 0, c.width, c.height);
    var d;
    try { d = g.getImageData(0, 0, c.width, c.height).data; } catch (e) { return { c: c, w: c.width, h: c.height }; }
    var x0 = c.width, y0 = c.height, x1 = -1, y1 = -1, x, y;
    for (y = 0; y < c.height; y++) for (x = 0; x < c.width; x++) {
      if (d[(y * c.width + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return null;                                            // image entièrement transparente
    var r = toile(x1 - x0 + 1, y1 - y0 + 1);
    r.getContext('2d').drawImage(c, -x0, -y0);
    return { c: r, w: r.width, h: r.height };
  }
  function charger(src, suite) {
    if (!src) { suite(null); return; }
    if (typeof src !== 'string') { suite(rogner(src)); return; }        // <img> ou <canvas> déjà prêt
    var url = /^(data:|blob:|https?:|\/)/.test(src) ? src : dossier + src;
    var e = images[url];
    if (e) { if (e.pret) suite(e.calque); else e.attente.push(suite); return; }
    e = images[url] = { pret: false, calque: null, attente: [suite] };
    var img = new Image();
    function fin() { e.pret = true; e.attente.splice(0).forEach(function (f) { f(e.calque); }); }
    img.onload = function () { e.calque = rogner(img); fin(); };
    img.onerror = function () { if (window.console) console.warn('PNJ : image introuvable : ' + url); fin(); };
    img.src = url;
  }
  // Réduction par moitiés successives : un trait de crayon fin reste lisible au lieu de disparaître.
  function reduire(c, w) {
    while (c.width > w * 2) {
      var m = toile(c.width / 2, c.height / 2), g = m.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.drawImage(c, 0, 0, m.width, m.height);
      c = m;
    }
    return c;
  }

  // Finition PS1 d'une toile : bords francs (tout ou rien) et couleurs réduites avec trame.
  function finir(c, n) {
    var g = c.getContext('2d'), img;
    try { img = g.getImageData(0, 0, c.width, c.height); } catch (e) { return; }
    var d = img.data, pas = n > 1 ? 255 / (n - 1) : 0, i, x, y, j, v, t;
    for (y = 0; y < c.height; y++) for (x = 0; x < c.width; x++) {
      i = (y * c.width + x) * 4;
      if (d[i + 3] < 128) { d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; continue; }
      d[i + 3] = 255;
      if (!pas) continue;
      t = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5;
      for (j = 0; j < 3; j++) {
        v = Math.round((d[i + j] + t * pas) / pas) * pas;
        d[i + j] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
    g.putImageData(img, 0, 0);
  }
  // Les deux faces d'une main dans une seule toile : le dos à gauche, la paume à droite (sans paume : le dos en miroir).
  // Rend { c, l, h } : largeur et hauteur d'UNE face, en mètres. hauteur = longueur de la main, en mètres.
  function composerMain(dos, paume, hauteur, o) {
    var h = Math.max(4, Math.round(hauteur * o.grain));
    var lD = Math.max(2, Math.round(h * dos.w / dos.h)), lP = paume ? Math.max(2, Math.round(h * paume.w / paume.h)) : lD;
    var l = Math.max(lD, lP) + 2; l += l % 2;
    var c = toile(l * 2, h), g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.drawImage(reduire(dos.c, lD), Math.round((l - lD) / 2), 0, lD, h);
    if (paume) g.drawImage(reduire(paume.c, lP), l + Math.round((l - lP) / 2), 0, lP, h);
    else { g.save(); g.translate(2 * l - Math.round((l - lD) / 2), 0); g.scale(-1, 1); g.drawImage(reduire(dos.c, lD), 0, 0, lD, h); g.restore(); }
    finir(c, o.couleurs);
    return { c: c, l: l / o.grain, h: h / o.grain };
  }

  /* ---------- Assemblage des quatre calques dans une seule toile ---------- */
  // calques = { tete, tshirt, pantalon, chaussure } (objets rendus par charger, ou null).
  // Rend { c: canvas, l: largeur en mètres, h: hauteur en mètres }.
  // vue : 'face' (par défaut) ou 'dos'.
  function composer(calques, o, vue) {
    o = fusion(DEFAUT, o || {});
    var dos = vue === 'dos';
    if (dos) calques = { tete: calques.teteDos || calques.tete, tshirt: calques.tshirtDos || calques.tshirt,
                         pantalon: calques.pantalonDos || calques.pantalon, chaussure: calques.chaussure, semelle: calques.semelle };
    var p = o.proportions, r = o.recouvrement, A = o.assis, assis = o.pose === 'assis';
    var parts = p.tete + p.tshirt + p.pantalon + p.chaussure - r.col - r.ceinture - r.cheville;
    var px = o.taille / parts * o.grain;                                // pixels pour une part de 1 : la même échelle debout et assis
    var H = {}, L = {}, Y = {};
    function mesurer(nom, part) {
      H[nom] = Math.max(2, Math.round(part * px));
      L[nom] = Math.max(2, Math.round(H[nom] * (calques[nom] ? calques[nom].w / calques[nom].h : FORME[nom])));
    }
    mesurer('tete', p.tete); mesurer('tshirt', p.tshirt); mesurer('pantalon', p.pantalon);
    mesurer('chaussure', p.chaussure); mesurer('semelle', A.semelle);
    Y.tete = 0;
    Y.tshirt = H.tete - Math.round(r.col * px);
    Y.pantalon = Y.tshirt + H.tshirt - Math.round(r.ceinture * px);
    var pied, W, bas, marge = 0, court = Math.max(2, Math.round(H.pantalon * A.coupe));
    if (assis) {
      pied = Math.round(L.pantalon * o.ecart);                           // du milieu du corps au milieu d'une semelle
      marge = Math.ceil(Math.abs(Math.sin(A.angle)) * H.semelle / 2) + 1; // place prise par l'inclinaison
      bas = Y.pantalon + court + Math.round(A.depasse * px);
      Y.semelle = bas - H.semelle;
      W = Math.max(L.tete, L.tshirt, L.pantalon, 2 * (pied + marge) + L.semelle) + 2;
      bas += marge;
    } else {
      Y.chaussure = Y.pantalon + H.pantalon - Math.round(r.cheville * px);
      pied = Math.round(L.pantalon * o.ecart + L.chaussure * 0.16);      // du milieu du corps au milieu d'une chaussure
      W = Math.max(L.tete, L.tshirt, L.pantalon, 2 * pied + L.chaussure) + 2;
      bas = Y.chaussure + H.chaussure;
    }
    W += W % 2;
    var cx = W / 2, ourletY = Y.tshirt + H.tshirt;

    // Pose un calque centré en x. v = { miroir, angle (autour de son centre), coupe (part gardée depuis le haut) }.
    function poser(g, nom, x, v) {
      v = v || {};
      var q = calques[nom], l = L[nom], h = v.coupe ? Math.max(2, Math.round(H[nom] * v.coupe)) : H[nom];
      g.save();
      g.translate(Math.round(x), Y[nom] + h / 2);
      if (v.angle) g.rotate(v.angle);
      if (v.miroir) g.scale(-1, 1);
      if (!q) { g.fillStyle = '#c2187a'; g.fillRect(-l / 2, -h / 2, l, h); }   // calque manquant : bloc rose
      else {
        var s = reduire(q.c, l);
        g.drawImage(s, 0, 0, s.width, s.height * (v.coupe || 1), -Math.round(l / 2), -h / 2, l, h);
      }
      g.restore();
    }
    // Le bas : jambes et pieds. Assis, le pantalon ne dépasse pas au-dessus de l'ourlet du t-shirt, les semelles si.
    function peindreBas(g) {
      if (assis) {
        g.save(); g.beginPath(); g.rect(0, ourletY, W, bas); g.clip();
        poser(g, 'pantalon', cx, { coupe: A.coupe });
        g.restore();
        if (!dos) {                                                     // de dos, les pieds sont de l'autre côté : on ne les voit pas
          poser(g, 'semelle', cx - pied, { miroir: true, angle: -A.angle });
          poser(g, 'semelle', cx + pied, { angle: A.angle });
        }
      } else {
        poser(g, 'pantalon', cx);
        poser(g, 'chaussure', cx - pied, { miroir: true });
        poser(g, 'chaussure', cx + pied);
      }
    }
    function peindreTorse(g) { poser(g, 'tshirt', cx); }
    function peindreTete(g) { poser(g, 'tete', cx); }
    // Un morceau sur sa propre toile. y = hauteur de son bord bas au-dessus des pieds, en mètres.
    function morceau(largeur, y0, y1, peindre) {
      var w = largeur + 2; w += w % 2;
      var m = toile(w, y1 - y0), g = m.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.translate(Math.round(w / 2 - cx), -y0);
      peindre(g);
      finir(m, o.couleurs);
      return { c: m, l: w / o.grain, h: (y1 - y0) / o.grain, y: (bas - y1) / o.grain };
    }
    var hautBas = assis ? Math.min(ourletY, Y.semelle - marge) : Y.pantalon;
    var parties = {
      bas: morceau(assis ? Math.max(L.pantalon, 2 * (pied + marge) + L.semelle) : Math.max(L.pantalon, 2 * pied + L.chaussure), hautBas, bas, peindreBas),
      torse: morceau(L.tshirt, Y.tshirt, ourletY, peindreTorse),
      tete: morceau(L.tete, 0, H.tete, peindreTete)
    };
    // La silhouette entière sur une seule toile, pour un aperçu 2D : du fond vers le devant.
    var c = toile(W, bas), g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    if (assis) { peindreTorse(g); peindreBas(g); } else { peindreBas(g); peindreTorse(g); }
    peindreTete(g);
    finir(c, o.couleurs);
    // ourlet et demiTshirt : où accrocher les mains, en mètres depuis le bas et depuis l'axe du corps
    return { c: c, parties: parties, l: c.width / o.grain, h: c.height / o.grain, part: px / o.grain,
             ourlet: (bas - ourletY) / o.grain, demiTshirt: L.tshirt / 2 / o.grain };
  }

  // Le corps en trois morceaux articulés (bas, torse, tete). Chaque morceau a sa toile : la face à gauche, le dos à droite
  // (sans calque de dos : la face en miroir), alignés par le bas, là où le morceau pivote.
  function composerCorps(calques, o) {
    var f = composer(calques, o, 'face'), d = null, P = {}, grain = f.c.width / f.l;
    if (calques.teteDos || calques.tshirtDos || calques.pantalonDos) d = composer(calques, o, 'dos');
    ['bas', 'torse', 'tete'].forEach(function (nom) {
      var a = f.parties[nom], b = d ? d.parties[nom].c : null;
      var l = Math.max(a.c.width, b ? b.width : 0), h = Math.max(a.c.height, b ? b.height : 0);
      var c = toile(l * 2, h), g = c.getContext('2d');
      g.drawImage(a.c, Math.round((l - a.c.width) / 2), h - a.c.height);
      if (b) g.drawImage(b, l + Math.round((l - b.width) / 2), h - b.height);
      else { g.save(); g.translate(2 * l - Math.round((l - a.c.width) / 2), h - a.c.height); g.scale(-1, 1); g.drawImage(a.c, 0, 0); g.restore(); }
      P[nom] = { c: c, l: l / grain, h: h / grain, y: a.y };
    });
    return { parties: P, c: f.c, l: f.l, h: f.h, part: f.part, ourlet: f.ourlet, demiTshirt: f.demiTshirt };
  }

  /* ---------- Voix : un marmonnement de Danois bourré, fabriqué par le navigateur ----------
     Rien n'est dit : c'est une suite de syllabes inventées avec ce qui fait sonner le danois.
       - beaucoup de voyelles arrondies (ø, å, æ) et de e avalés
       - des consonnes molles qui ne ferment jamais la bouche (le d mou, le r de gorge)
       - le stød : la voix qui craque au milieu d'une syllabe
       - une mélodie plate : syllabe accentuée grave, la suivante plus haute
     Et ce qui fait sonner bourré : lent, pâteux (la bouche glisse d'un son à l'autre), la note qui flotte,
     des « ååårh » qui traînent, un hoquet de temps en temps. */
  var VOYELLES = [             // [formant 1, 2, 3 en Hz, poids]
    [400, 1500, 2300, 16],     // ø
    [640, 1750, 2500, 14],     // æ
    [500, 1400, 2500, 18],     // e avalé
    [520, 900, 2500, 12],      // å
    [420, 780, 2400, 8],       // o
    [400, 2050, 2700, 7],      // e
    [300, 750, 2300, 5],       // u
    [280, 1800, 2200, 5],      // y
    [700, 1150, 2500, 9],      // a sombre
    [520, 1450, 2400, 6]       // ö ouvert
  ];
  var CONSONNES = [            // [genre, formants, poids]
    ['mou', 350, 1300, 2400, 20],   // d mou
    ['mou', 480, 1050, 2300, 18],   // r de gorge
    ['mou', 330, 800, 2300, 8],     // w
    ['mou', 280, 2100, 2800, 7],    // j
    ['mou', 360, 1250, 2700, 8],    // l
    ['nez', 250, 1100, 2300, 9],    // n
    ['nez', 250, 900, 2200, 7],     // m
    ['coup', 0, 0, 0, 9],           // b, d, g avalés
    ['souffle', 0, 0, 0, 7],        // s, sj
    ['', 0, 0, 0, 7]                // pas de consonne
  ];
  function hasard(graine) {    // tirage reproductible : une même graine redonne la même phrase
    var a = (graine | 0) + 0x9e3779b9;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function contexte() {
    try {
      if (!audio) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; audio = new AC(); }
      if (audio.state === 'suspended') audio.resume();
      return audio;
    } catch (e) { return null; }
  }
  // Programme une phrase sur le contexte audio et rend { debut, duree, syllabes: [[instant, durée], ...] }.
  function voix(ctx, sortie, reglages) {
    var v = fusion(DEFAUT.voix, reglages || {}), alea = hasard(v.graine || 0);
    var iv = Math.max(0, Math.min(1, v.ivresse)), f0 = v.hauteur, k = v.timbre;
    var debut = ctx.currentTime + 0.06, t = debut, syllabes = [];
    var glisse = 0.028 + 0.035 * iv;                                    // lenteur de la bouche : plus c'est grand, plus c'est pâteux
    function tirer(liste) {
      var somme = 0, i, x;
      for (i = 0; i < liste.length; i++) somme += liste[i][liste[i].length - 1];
      x = alea() * somme;
      for (i = 0; i < liste.length; i++) { x -= liste[i][liste[i].length - 1]; if (x <= 0) return liste[i]; }
      return liste[0];
    }

    // Les cordes vocales (deux dents de scie légèrement désaccordées : voix rauque) et un peu de souffle
    if (!bruit || bruit.sampleRate !== ctx.sampleRate) {
      bruit = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = bruit.getChannelData(0), g = hasard(7), i;
      for (i = 0; i < d.length; i++) d[i] = g() * 2 - 1;
    }
    var corde = ctx.createOscillator(), corde2 = ctx.createOscillator(), tremble = ctx.createOscillator();
    corde.type = corde2.type = 'sawtooth';
    var gorge = ctx.createGain(), fin2 = ctx.createGain(), flotte = ctx.createGain(), flotte2 = ctx.createGain();
    gorge.gain.value = 0.5; fin2.gain.value = 0.55;
    corde.connect(gorge); corde2.connect(fin2); fin2.connect(gorge);
    tremble.frequency.value = 3.6 + alea() * 1.8;                       // la note qui flotte
    flotte.gain.value = flotte2.gain.value = f0 * (0.008 + 0.022 * iv);
    tremble.connect(flotte); flotte.connect(corde.frequency);
    tremble.connect(flotte2); flotte2.connect(corde2.frequency);
    var air = ctx.createBufferSource(); air.buffer = bruit; air.loop = true;
    var rauque = ctx.createGain(); rauque.gain.value = 0.05 + 0.05 * iv;
    air.connect(rauque); rauque.connect(gorge);

    // La bouche : trois résonances qui glissent d'un son à l'autre, plus le coffre
    var souffleur = ctx.createGain(); souffleur.gain.setValueAtTime(0, ctx.currentTime);
    var bouche = [[7, 1], [9, 0.8], [10, 0.45]].map(function (r) {
      var f = ctx.createBiquadFilter(), n = ctx.createGain();
      f.type = 'bandpass'; f.Q.value = r[0]; n.gain.value = r[1];
      gorge.connect(f); f.connect(n); n.connect(souffleur);
      return f;
    });
    var coffre = ctx.createBiquadFilter(), coffreN = ctx.createGain();
    coffre.type = 'lowpass'; coffre.frequency.value = 300; coffreN.gain.value = 0.3;
    gorge.connect(coffre); coffre.connect(coffreN); coffreN.connect(souffleur);
    var voile = ctx.createBiquadFilter(); voile.type = 'lowpass'; voile.frequency.value = 3300;
    var niveau = ctx.createGain(); niveau.gain.value = 2.6 * v.volume;
    var garde = ctx.createDynamicsCompressor();
    souffleur.connect(voile); voile.connect(niveau); niveau.connect(garde); garde.connect(sortie);
    // Les s et les petits coups de langue : du souffle filtré, à part
    var sifflet = ctx.createBiquadFilter(), siffle = ctx.createGain();
    sifflet.type = 'bandpass'; sifflet.Q.value = 1.6; sifflet.frequency.value = 3500;
    siffle.gain.setValueAtTime(0, ctx.currentTime);
    air.connect(sifflet); sifflet.connect(siffle); siffle.connect(niveau);

    function forme(f, quand, lent) {
      for (var j = 0; j < 3; j++) bouche[j].frequency.setTargetAtTime(f[j] * k, quand, lent || glisse);
    }
    function note(hz, quand, lent) {
      corde.frequency.setTargetAtTime(hz, quand, lent);
      corde2.frequency.setTargetAtTime(hz * 1.007, quand, lent);
    }
    function force(n, quand, lent) { souffleur.gain.setTargetAtTime(n, quand, lent); }
    var repos = [500, 1400, 2500];
    for (var j = 0; j < 3; j++) bouche[j].frequency.setValueAtTime(repos[j] * k, ctx.currentTime);
    corde.frequency.setValueAtTime(f0, ctx.currentTime); corde2.frequency.setValueAtTime(f0 * 1.007, ctx.currentTime);

    function hoquet() {
      note(f0 * 2.4, t, 0.006); forme([450, 1600, 2600], t, 0.01);
      force(0.9, t, 0.006); force(0, t + 0.055, 0.008);
      note(f0, t + 0.09, 0.02);
      t += 0.16 + alea() * 0.2;
    }
    function syllabe(accent, pente, longue, derniere) {
      var c = tirer(CONSONNES), genre = c[0], dc;
      if (genre === 'mou' || genre === 'nez') {
        dc = 0.05 + alea() * 0.04 + 0.03 * iv;
        forme([c[1], c[2], c[3]], t); force(genre === 'nez' ? 0.3 : 0.42, t, 0.02);
        t += dc;
      } else if (genre === 'coup') {
        dc = 0.045 + alea() * 0.03;
        force(0.02, t, 0.008); t += dc;
        sifflet.frequency.setValueAtTime(1500 + alea() * 1500, t);
        siffle.gain.setTargetAtTime(0.1, t, 0.002); siffle.gain.setTargetAtTime(0, t + 0.012, 0.006);
      } else if (genre === 'souffle') {
        dc = 0.08 + alea() * 0.07 + 0.06 * iv;                          // bourré, le s devient « chhh »
        sifflet.frequency.setValueAtTime(alea() < 0.5 + 0.3 * iv ? 2500 : 3900, t);
        force(0.04, t, 0.012);
        siffle.gain.setTargetAtTime(0.085, t, 0.015); siffle.gain.setTargetAtTime(0, t + dc, 0.015);
        t += dc;
      }
      var V = tirer(VOYELLES);
      var d = longue ? 0.42 + alea() * 0.45 : (0.14 + alea() * 0.11) * (1 + 0.55 * iv);
      var hz = f0 * pente * (accent ? 0.93 : 1.1) * (1 + (alea() - 0.5) * (0.05 + 0.1 * iv));
      forme(V, t); note(hz, t, 0.04);
      force((accent ? 1 : 0.72) * (0.85 + alea() * 0.3), t, 0.022);
      syllabes.push([t - debut, d]);
      if (longue) {                                                     // « ååårh » : ça monte, puis ça retombe
        if (alea() < 0.55) { note(hz * (1.18 + alea() * 0.25), t + d * 0.2, d * 0.18); note(hz * 0.82, t + d * 0.62, d * 0.2); }
        else note(hz * 0.8, t + d * 0.3, d * 0.4);
      } else if (accent && alea() < 0.38) {                             // stød : la voix craque
        var ts = t + d * 0.55;
        note(hz * 0.52, ts, 0.012); force(0.28, ts, 0.014);
        note(hz * 0.9, ts + 0.065, 0.02); force(0.6, ts + 0.065, 0.02);
      }
      if (alea() < 0.32) forme(alea() < 0.5 ? [350, 1300, 2400] : (alea() < 0.5 ? [330, 800, 2300] : [280, 2100, 2800]), t + d * 0.6);
      t += d;
      if (derniere) force(0, t, 0.05 + 0.05 * iv);
    }

    var groupes = 1 + (alea() < 0.65 ? 1 : 0) + (alea() < 0.25 ? 1 : 0), gI, sI;
    for (gI = 0; gI < groupes; gI++) {
      var nb = 2 + Math.floor(alea() * 4), depart = alea() < 0.3;        // parfois il démarre par un long « øøøh »
      for (sI = 0; sI < nb; sI++) {
        var pente = 1.08 - 0.2 * (sI / nb) - 0.04 * gI;
        var longue = (sI === 0 && depart) || (sI === nb - 1 && alea() < 0.3 + 0.3 * iv) || alea() < 0.06;
        syllabe(sI % 2 === (depart ? 1 : 0), pente, longue, sI === nb - 1);
      }
      t += 0.1 + alea() * 0.22 * (1 + iv);
      if (gI < groupes - 1 && alea() < 0.4 * iv) hoquet();
    }
    if (alea() < 0.3) {                                                 // le petit « ikk' ? » de fin de phrase
      forme([330, 2100, 2800], t, 0.015); note(f0 * 1.28, t, 0.015);
      force(0.8, t, 0.012); syllabes.push([t - debut, 0.09]);
      t += 0.09; force(0, t, 0.006);
      siffle.gain.setTargetAtTime(0.07, t + 0.03, 0.002); siffle.gain.setTargetAtTime(0, t + 0.04, 0.006);
      t += 0.1;
    } else if (alea() < 0.35 * iv) hoquet();

    var arret = t + 0.4;
    corde.start(debut - 0.02); corde2.start(debut - 0.02); tremble.start(debut - 0.02); air.start(debut - 0.02);
    corde.stop(arret); corde2.stop(arret); tremble.stop(arret); air.stop(arret);
    corde.onended = function () { try { garde.disconnect(); } catch (e) {} };
    return { debut: debut, duree: arret - debut, syllabes: syllabes };
  }

  /* ---------- Voix enregistrée : un audio découpé en phrases ---------- */
  // Repère les phrases aux silences. d = échantillons mono, sr = fréquence. Rend [[début, fin], ...] en secondes.
  function decouper(d, sr) {
    var pas = Math.round(sr * 0.01), fen = Math.round(sr * 0.025), n = Math.floor((d.length - fen) / pas), db = new Float32Array(Math.max(0, n)), i, j, s;
    for (i = 0; i < n; i++) {
      s = 0;
      for (j = i * pas; j < i * pas + fen; j++) s += d[j] * d[j];
      db[i] = 10 * Math.log10(s / fen + 1e-10);
    }
    if (n < 50) return [];
    var tri = Array.prototype.slice.call(db).sort(function (a, b) { return a - b; });
    var fond = tri[Math.floor(n * 0.1)], fort = tri[Math.floor(n * 0.9)], seuil = fond + 0.42 * (fort - fond);
    // Zones au-dessus du seuil ; un trou de moins de 0,28 s ne coupe pas une phrase.
    var zones = [], a = -1, dernier = -1e9;
    for (i = 0; i < n; i++) {
      if (db[i] > seuil) { if (a < 0) { if (zones.length && i - dernier < 28) a = zones.pop()[0]; else a = i; } dernier = i; }
      else if (a >= 0 && i - dernier >= 28) { zones.push([a, dernier + 1]); a = -1; }
    }
    if (a >= 0) zones.push([a, dernier + 1]);
    // Une zone de plus de 5 s est recoupée à son creux le plus profond.
    function recouper(z, vers) {
      if (z[1] - z[0] <= 500) { vers.push(z); return; }
      var m0 = z[0] + Math.round((z[1] - z[0]) * 0.25), m1 = z[1] - Math.round((z[1] - z[0]) * 0.25), ou = m0, bas = Infinity, x, q, moy;
      for (x = m0; x < m1; x++) {
        moy = 0; for (q = x - 6; q <= x + 6; q++) moy += db[q]; moy /= 13;
        if (moy < bas) { bas = moy; ou = x; }
      }
      recouper([z[0], ou], vers); recouper([ou, z[1]], vers);
    }
    var fines = []; zones.forEach(function (z) { recouper(z, fines); });
    var phrases = [];
    fines.forEach(function (z) {
      var len = z[1] - z[0]; if (len < 55) return;                      // moins de 0,55 s : un bruit, pas une phrase
      var m = 0, v = 0, x; for (x = z[0]; x < z[1]; x++) m += db[x]; m /= len;
      for (x = z[0]; x < z[1]; x++) v += (db[x] - m) * (db[x] - m);
      if (Math.sqrt(v / len) < 3.2) return;                            // niveau trop régulier : de la musique, pas une voix
      phrases.push([Math.max(0, z[0] * 0.01 - 0.05), Math.min(d.length / sr, z[1] * 0.01 + 0.14)]);
    });
    for (i = 0; i + 1 < phrases.length; i++) {                           // deux phrases collées (zone recoupée) : aucune ne déborde sur l'autre
      if (phrases[i][1] > phrases[i + 1][0]) phrases[i][1] = phrases[i + 1][0] = phrases[i + 1][0] + 0.05;
    }
    return phrases;
  }
  // Charge un enregistrement une fois pour toutes et le range en phrases prêtes à jouer (mono, 22 kHz : léger pour un téléphone).
  function banque(fichier, phrases, suite) {
    var i, b;
    for (i = 0; i < banques.length; i++) if (banques[i].fichier === fichier && banques[i].decoupe === phrases) { b = banques[i]; break; }
    if (b) { if (b.pret) suite(b); else b.attente.push(suite); return; }
    b = { fichier: fichier, decoupe: phrases, pret: false, erreur: null, phrases: [], temps: [], attente: [suite] };
    banques.push(b);
    function fin(erreur) {
      b.pret = true; b.erreur = erreur || null;
      if (erreur && window.console) console.warn('PNJ : audio illisible : ' + erreur);
      b.attente.splice(0).forEach(function (f) { f(b); });
    }
    function decoder(octets) {
      var OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OC) { fin('ce navigateur ne sait pas décoder l\'audio'); return; }
      var hors = new OC(1, 1, 22050);
      hors.decodeAudioData(octets, function (buf) {
        var sr = buf.sampleRate, mono = new Float32Array(buf.length), c, d, x;
        for (c = 0; c < buf.numberOfChannels; c++) { d = buf.getChannelData(c); for (x = 0; x < d.length; x++) mono[x] += d[x] / buf.numberOfChannels; }
        var liste = (phrases && phrases.length) ? phrases : decouper(mono, sr);
        liste.forEach(function (p) {
          var a = Math.max(0, Math.round(p[0] * sr)), z = Math.min(mono.length, Math.round(p[1] * sr)); if (z - a < sr * 0.1) return;
          var morceau = hors.createBuffer(1, z - a, sr), m = morceau.getChannelData(0), fondu = Math.round(sr * 0.015), pasE = Math.round(sr * 0.03), env = [], max = 1e-6, e, y;
          m.set(mono.subarray(a, z));
          for (x = 0; x < fondu; x++) { m[x] *= x / fondu; m[m.length - 1 - x] *= x / fondu; }
          for (x = 0; x + pasE <= m.length; x += pasE) { e = 0; for (y = x; y < x + pasE; y++) e += m[y] * m[y]; e = Math.sqrt(e / pasE); env.push(e); if (e > max) max = e; }
          b.phrases.push({ son: morceau, duree: morceau.duration, env: env.map(function (q) { return Math.min(1, q / max * 1.4); }) });
          b.temps.push([a / sr, z / sr]);
        });
        fin(b.phrases.length ? null : 'aucune phrase trouvée');
      }, function () { fin('format non reconnu'); });
    }
    try {
      if (typeof fichier === 'string') {
        var url = /^(data:|blob:|https?:|\/)/.test(fichier) ? fichier : dossier + fichier;
        fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(decoder, function () { fin('introuvable : ' + url); });
      } else if (fichier instanceof ArrayBuffer) decoder(fichier.slice(0));
      else if (fichier && fichier.arrayBuffer) fichier.arrayBuffer().then(decoder, function () { fin('lecture impossible'); });
      else fin('fichier audio non reconnu');
    } catch (e) { fin(String(e)); }
  }

  // Le verre, le chiffon et la mousse du barman : trois petits volumes à facettes, éclairés par les lampes de la scène.
  function accessoires(parent) {
    var g = new T3.Group();
    var verreM = new T3.MeshLambertMaterial({ color: 0xcfe9e2, transparent: true, opacity: 0.55, side: T3.DoubleSide });
    var verre = new T3.Group(), paroi = new T3.Mesh(new T3.CylinderGeometry(0.04, 0.029, 0.13, 7, 1, true), verreM);
    var fond = new T3.Mesh(new T3.CylinderGeometry(0.029, 0.029, 0.01, 7), verreM);
    fond.position.y = -0.06; verre.add(paroi); verre.add(fond);
    // Chiffon : une grille 3 x 3 froissée à la main, en triangles séparés pour garder les facettes
    var pts = [[-0.08, 0.07, 0.01], [0, 0.075, -0.02], [0.08, 0.065, 0.015], [-0.085, 0, -0.015], [0.005, 0.005, 0.03], [0.08, -0.005, -0.01],
               [-0.07, -0.07, 0.02], [0.01, -0.08, -0.02], [0.075, -0.065, 0.012]], tri = [], i, j;
    [[0, 3, 1], [1, 3, 4], [1, 4, 2], [2, 4, 5], [3, 6, 4], [4, 6, 7], [4, 7, 5], [5, 7, 8]].forEach(function (t) {
      for (j = 0; j < 3; j++) tri.push(pts[t[j]][0], pts[t[j]][1], pts[t[j]][2]);
    });
    var geoC = new T3.BufferGeometry();
    geoC.setAttribute('position', new T3.Float32BufferAttribute(tri, 3));
    geoC.computeVertexNormals();
    var chiffon = new T3.Mesh(geoC, new T3.MeshLambertMaterial({ color: 0xf4eede, side: T3.DoubleSide }));
    var mousse = new T3.MeshLambertMaterial({ color: 0xffffff }), geoB = new T3.IcosahedronGeometry(0.02, 0), bulles = [];
    for (i = 0; i < 7; i++) { var b = new T3.Mesh(geoB, mousse); g.add(b); bulles.push(b); }
    g.add(verre); g.add(chiffon); parent.add(g);
    return { groupe: g, verre: verre, chiffon: chiffon, bulles: bulles };
  }

  // La bouteille qu'il sert : celle fournie par la page, sinon trois cylindres bruns et une étiquette.
  function bouteille() {
    var b = null;
    try { b = fabriqueBouteille ? fabriqueBouteille() : null; } catch (e) { b = null; }
    if (b) return b;
    b = new T3.Group();
    var verre = new T3.MeshLambertMaterial({ color: 0x5a3414 }), papier = new T3.MeshLambertMaterial({ color: 0xe6dcc0 });
    [[0.029, 0.029, 0.13, 0.065, verre], [0.0295, 0.0295, 0.05, 0.07, papier], [0.012, 0.029, 0.04, 0.15, verre], [0.012, 0.012, 0.06, 0.2, verre]].forEach(function (c) {
      var m = new T3.Mesh(new T3.CylinderGeometry(c[0], c[1], c[2], 7), c[4]); m.position.y = c[3]; b.add(m);
    });
    return b;
  }
  // Valeur d'une suite de clés [instant, a, b, c, ...] à l'instant t, avec un départ et une arrivée en douceur entre deux clés.
  function cle(cles, t) {
    var i = 0, a, b, k, r = [], j;
    while (i < cles.length - 2 && t > cles[i + 1][0]) i++;
    a = cles[i]; b = cles[i + 1];
    k = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0]))); k = k * k * (3 - 2 * k);
    for (j = 1; j < a.length; j++) r.push(a[j] + (b[j] - a[j]) * k);
    return r;
  }

  /* ---------- Un PNJ ---------- */
  function texture(c) {
    var t = new T3.CanvasTexture(c);
    t.magFilter = T3.NearestFilter; t.minFilter = T3.NearestFilter; t.generateMipmaps = false;
    return t;
  }
  function point(a, b) { return (a && a.length) ? [a[0], a[1]] : [a, b]; }

  function creer(opt) {
    if (!T3) throw new Error('PNJ.init({ THREE, scene, camera }) doit être appelé avant PNJ.creer');
    var o = fusion(DEFAUT, opt || {});
    var vet = { tete: o.tete, tshirt: o.tshirt, pantalon: o.pantalon, chaussure: o.chaussure, semelle: o.semelle, main: o.main, paume: o.paume,
                teteDos: o.teteDos, tshirtDos: o.tshirtDos, pantalonDos: o.pantalonDos };
    var groupe = new T3.Group(), corps = new T3.Group(), morceaux = {}, repos = null;
    ['bas', 'torse', 'tete'].forEach(function (nom) {                  // recto verso par la géométrie ; apparaissent dès que les images sont là
      var m = new T3.Mesh(GEO, new T3.MeshBasicMaterial({ map: texture(toile(2, 2)), alphaTest: 0.5, side: T3.FrontSide, color: o.teinte }));
      m.visible = false; corps.add(m); morceaux[nom] = m;
    });
    groupe.add(corps); scene.add(groupe);
    // Deux mains à deux faces : une seule matière, la main de droite est le miroir de celle de gauche.
    var matMain = new T3.MeshBasicMaterial({ map: texture(toile(2, 2)), alphaTest: 0.5, side: T3.FrontSide, color: o.teinte });
    var mains = [-1, 1].map(function (cote) {
      var m = new T3.Mesh(GEO_MAIN, matMain);
      m.rotation.order = 'ZYX';                                         // le demi-tour se fait autour de l'axe de la main, pas du corps
      m.visible = false; groupe.add(m);
      return { plan: m, cote: cote, phase: cote * 1.3 + tous.length * 0.9 };
    });
    var attache = null;                                                 // où flottent les mains au repos (mètres), ou null s'il n'en a pas
    var depart = point(o.pos !== undefined ? o.pos : o.x || 0, o.z || 0);
    var col = (o.solide && colliders) ? { ax: 0, az: 0, bx: 0, bz: 0, pad: o.rayon } : null;
    if (col) colliders.push(col);
    var etat = { cible: null, file: null, rang: 0, pause: 0, attente: 0, pas: 0, graine: tous.length * 1.7, tirage: 0, fin: null, socle: 0, geste: 0, sens: 1, cote: 1, att: 0, attNom: o.attitude || null, verrou: 0, props: null, service: null, servies: [], nbServies: 0, regard: (typeof o.regard === 'number') ? o.regard : null, voix: null, replique: 0, numero: tous.length, banque: null, sac: [], derniere: -1 };

    function poserEn(x, z) {
      groupe.position.set(x, 0, z);
      if (col) { col.ax = col.bx = x; col.az = col.bz = z; }
    }
    function tisser() {                                                 // (re)fabrique la texture à partir des quatre calques
      var tirage = ++etat.tirage, calques = {}, reste = CALQUES.length;
      CALQUES.forEach(function (nom) {
        charger(vet[nom], function (q) {
          calques[nom] = q;
          if (--reste || tirage !== etat.tirage) return;
          var r = composerCorps(calques, o);
          ['bas', 'torse', 'tete'].forEach(function (nom) {
            var m = morceaux[nom], q = r.parties[nom], ancienne = m.material.map;
            m.material.map = texture(q.c); ancienne.dispose();
            m.scale.set(q.l, q.h, 1); m.visible = true;
          });
          repos = { bas: r.parties.bas.y, torse: r.parties.torse.y, cou: r.parties.tete.y - r.parties.torse.y, ourlet: r.ourlet, demi: r.demiTshirt };
          etat.socle = o.pose === 'assis' ? o.siege - o.assis.descend : 0;   // assis : le bas du corps est posé au bord de l'assise
          corps.position.y = etat.socle;
          pnj.largeur = r.l; pnj.hauteur = r.h; pnj.toile = r.c;
          if (calques.main) {                                           // les mains : même grain, même finition que le corps
            var M = o.mains, rm = composerMain(calques.main, calques.paume, M.taille * r.part, o), vieille = matMain.map;
            matMain.map = texture(rm.c); vieille.dispose();
            attache = { l: rm.l, h: rm.h, x: r.demiTshirt * M.ecart + rm.l * 0.2, y: r.ourlet + rm.h * M.hauteur };
            pnj.toileMains = rm.c;
          } else { attache = null; pnj.toileMains = null; }
          mains.forEach(function (m) { m.plan.visible = !!attache; if (attache) m.plan.scale.set(-m.cote * attache.l, attache.h, 1); });   // à gauche l'image telle quelle, à droite son miroir
          if (pnj.pret) pnj.pret(pnj);
        });
      });
    }

    function accorder() {                                               // charge l'enregistrement de sa voix, s'il en a un
      var f = o.voix.fichier, ph = o.voix.phrases;
      etat.banque = null; etat.sac = [];
      if (f) banque(f, ph, function (b) { if (o.voix.fichier === f && o.voix.phrases === ph && !b.erreur) etat.banque = b; if (pnj.voixPrete) pnj.voixPrete(pnj, b); });
    }
    var pnj = {
      groupe: groupe, corps: corps, morceaux: morceaux, options: o, tenue: vet, largeur: 0, hauteur: 0, toile: null, pret: o.pret || null, voixPrete: o.voixPrete || null,
      // Change un ou plusieurs calques : { tshirt: 'rouge.png' }. Accepte un nom de fichier, une URL, un <img> ou un <canvas>.
      habiller: function (v) { for (var k in v) if (k in vet) vet[k] = v[k]; tisser(); return pnj; },
      // Modifie des réglages (taille, proportions, grain, teinte, face...) et refait la texture.
      regler: function (v) {
        o = pnj.options = fusion(o, v);
        for (var nm in morceaux) morceaux[nm].material.color.set(o.teinte);
        matMain.color.set(o.teinte);
        if (col) col.pad = o.rayon;
        if (v.voix && ('fichier' in v.voix || 'phrases' in v.voix)) accorder();
        if ('regard' in v) etat.regard = (typeof o.regard === 'number') ? o.regard : null;
        if ('attitude' in v) pnj.attitude(o.attitude);
        tisser(); return pnj;
      },
      placer: function (x, z) { var q = point(x, z); etat.cible = etat.file = null; poserEn(q[0], q[1]); return pnj; },
      marcher: function (x, z, fin) {
        var q = point(x, z); if (o.pose === 'assis') pnj.lever();
        etat.file = null; etat.cible = q; etat.fin = typeof z === 'function' ? z : fin || null; return pnj;
      },
      ronde: function (points, pause) {
        if (o.pose === 'assis') pnj.lever();
        etat.file = points.map(function (q) { return point(q); }); etat.rang = 0; etat.pause = pause || 0; etat.attente = 0;
        etat.cible = etat.file[0]; etat.fin = null; return pnj;
      },
      arreter: function () { etat.cible = etat.file = null; return pnj; },
      // Tourne son regard : un angle en radians (0 = vers +z), ou un point (x, z) à regarder. Sans effet en carton fixe.
      regarder: function (x, z) {
        if (x && x.length) { z = x[1]; x = x[0]; }
        etat.regard = o.regard = (z === undefined) ? x : Math.atan2(x - groupe.position.x, z - groupe.position.z);
        return pnj;
      },
      deDos: function () { return etat.cote < 0; },                     // le joueur voit-il son dos en ce moment ?
      // Va chercher une bouteille sous le comptoir et la pose dessus, une fois. comptoir = { hauteur, distance, direction }, facultatif.
      // fin(pnj, bouteille) est appelée quand la bouteille est posée.
      servir: function (comptoir, fin) {
        if (typeof comptoir === 'function') { fin = comptoir; comptoir = null; }
        if (etat.service) return pnj;                                   // un service à la fois
        if (comptoir) o.comptoir = fusion(o.comptoir, comptoir);
        if (!o.attitude) etat.verrou = typeof etat.regard === 'number' ? etat.regard : typeof o.face === 'number' ? o.face : groupe.rotation.y;
        if (comptoir && typeof comptoir.direction === 'number') {
          etat.verrou = comptoir.direction;
          if (typeof etat.regard === 'number') etat.regard = o.regard = comptoir.direction;
        }
        var h = o.comptoir.hauteur, d = o.comptoir.distance, x = 0.2 - 0.13 * (etat.nbServies % 3);   // trois places côte à côte sur le comptoir
        var b = bouteille(); b.visible = false; groupe.add(b);
        etat.service = { t: 0, duree: 3.9, pose: 3.4, prise: 1.1, objet: b, fin: fin || null, lachee: false, place: etat.nbServies % 3,
          // [instant, x, y, z du cul de la bouteille (repère du PNJ), penchement du torse]
          cles: [[0.0, x, h + 0.10, d - 0.10, 0.15],
                 [0.8, x, 0.50, d + 0.08, 0.5],        // la main plonge sous le comptoir
                 [1.1, x, 0.50, d + 0.08, 0.5],        // elle attrape la bouteille
                 [1.4, x, 0.52, d - 0.10, 0.45],       // la ressort de son côté
                 [2.1, x, h + 0.14, d - 0.08, 0.2],    // la lève au-dessus du comptoir
                 [2.7, x, h + 0.10, d + 0.16, 0.3],    // l'avance vers le client
                 [3.1, x, h + 0.004, d + 0.16, 0.32],  // la pose
                 [3.9, x, h + 0.004, d + 0.16, 0.3]] };
        etat.nbServies++;
        return pnj;
      },
      sert: function () { return !!etat.service; },
      bouteilles: function () { return etat.servies.map(function (q) { return q.objet; }); },
      // Prend une attitude au comptoir : 'appuye', 'hanche', 'verre', ou null pour tout relâcher. comptoir = { hauteur, distance }, facultatif.
      attitude: function (nom, comptoir) {
        if (comptoir) o.comptoir = fusion(o.comptoir, comptoir);
        o.attitude = nom || null;
        if (nom) {
          etat.attNom = nom;
          etat.verrou = typeof etat.regard === 'number' ? etat.regard : typeof o.face === 'number' ? o.face : groupe.rotation.y;   // il garde la direction qu'il avait
          if (comptoir && typeof comptoir.direction === 'number') {     // ... sauf si on lui dit où est le comptoir
            etat.verrou = comptoir.direction;
            if (typeof etat.regard === 'number') etat.regard = o.regard = comptoir.direction;
          }
        }
        return pnj;
      },
      // S'assoit sur place, à la South Park : pantalon raccourci et semelles face au joueur. siege = hauteur de l'assise.
      asseoir: function (siege) {
        etat.cible = etat.file = null; o.pose = 'assis';
        if (siege !== undefined) o.siege = siege;
        tisser(); return pnj;
      },
      lever: function () { o.pose = 'debout'; tisser(); return pnj; },
      assis: function () { return o.pose === 'assis'; },
      // Il marmonne une phrase (jamais deux fois la même). À appeler depuis un clic, un toucher ou une touche.
      parler: function () {
        var ctx = contexte();
        if (!ctx || pnj.parle()) return pnj;
        var loin = camera ? Math.sqrt(Math.pow(camera.position.x - groupe.position.x, 2) + Math.pow(camera.position.z - groupe.position.z, 2)) : 0;
        if (etat.banque) {                                              // une phrase de l'enregistrement, tirée d'un sac qu'on vide avant de le remplir
          var nbP = etat.banque.phrases.length, k, x, tmp;
          if (!etat.sac.length) {
            for (k = 0; k < nbP; k++) etat.sac.push(k);
            for (k = nbP - 1; k > 0; k--) { x = Math.floor(Math.random() * (k + 1)); tmp = etat.sac[k]; etat.sac[k] = etat.sac[x]; etat.sac[x] = tmp; }
            if (nbP > 1 && etat.sac[nbP - 1] === etat.derniere) { etat.sac[nbP - 1] = etat.sac[0]; etat.sac[0] = etat.derniere; }
          }
          var rang = etat.sac.pop(), ph = etat.banque.phrases[rang], src = ctx.createBufferSource(), vol = ctx.createGain(), quand = ctx.currentTime + 0.05;
          var allure = Math.max(0.5, Math.min(2, o.voix.vitesse));
          src.buffer = ph.son; src.playbackRate.value = allure;
          vol.gain.value = o.voix.volume * Math.min(1, 1.6 / (0.6 + loin));
          src.connect(vol); vol.connect(ctx.destination); src.start(quand);
          src.onended = function () { try { vol.disconnect(); } catch (e) {} };
          etat.derniere = rang;
          etat.voix = { debut: quand, fin: quand + ph.duree / allure, env: ph.env, allure: allure, rang: rang };
          return pnj;
        }
        var r = voix(ctx, ctx.destination, fusion(o.voix, {
          graine: etat.numero * 7919 + (++etat.replique) * 104729,
          hauteur: o.voix.hauteur * (1 + ((etat.numero * 37) % 7 - 3) * 0.03),   // chaque PNJ a sa note à lui
          volume: o.voix.volume * Math.min(1, 1.6 / (0.6 + loin))                // plus faible de loin
        }));
        etat.voix = { debut: r.debut, fin: r.debut + r.duree, syllabes: r.syllabes };
        return pnj;
      },
      parle: function () { return !!(etat.voix && audio && audio.currentTime < etat.voix.fin); },
      // Sa voix enregistrée : { phrases: nombre de phrases, numero: celle qu'il est en train de dire (à partir de 1, 0 sinon), temps: [[début, fin], ...] }, ou null.
      voixEnregistree: function () {
        return etat.banque ? { phrases: etat.banque.phrases.length, numero: pnj.parle() && etat.voix.env ? etat.voix.rang + 1 : 0, temps: etat.banque.temps } : null;
      },
      position: function () { return [groupe.position.x, groupe.position.z]; },
      enMarche: function () { return !!etat.cible; },
      retirer: function () {
        scene.remove(groupe); matMain.map.dispose(); matMain.dispose();
        etat.servies.forEach(function (q) { scene.remove(q.objet); });
        for (var nm in morceaux) { morceaux[nm].material.map.dispose(); morceaux[nm].material.dispose(); }
        var i = tous.indexOf(pnj); if (i >= 0) tous.splice(i, 1);
        if (col) { i = colliders.indexOf(col); if (i >= 0) colliders.splice(i, 1); }
      },
      _maj: function (dt) {
        var gp = groupe.position;
        if (etat.attente > 0) { etat.attente -= dt; if (etat.attente <= 0 && etat.file) etat.cible = etat.file[etat.rang]; }
        if (etat.cible) {
          var dx = etat.cible[0] - gp.x, dz = etat.cible[1] - gp.z, d = Math.sqrt(dx * dx + dz * dz), pas = o.vitesse * dt;
          if (d <= pas || d < 1e-6) {                                   // arrivé (ou déjà sur place : jamais de division par zéro)
            poserEn(etat.cible[0], etat.cible[1]);
            etat.cible = null;
            if (etat.file) {
              etat.rang = (etat.rang + 1) % etat.file.length;
              if (etat.pause > 0) etat.attente = etat.pause; else etat.cible = etat.file[etat.rang];
            } else if (etat.fin) { var f = etat.fin; etat.fin = null; f(pnj); }
          } else {
            poserEn(gp.x + dx / d * pas, gp.z + dz / d * pas);
            if (etat.regard !== null) etat.regard = o.regard = Math.atan2(dx, dz);   // il regarde où il va
          }
        }
        if (etat.cible) {                                               // dandinement de marionnette en papier
          etat.pas += dt * 9;
          corps.rotation.z = Math.sin(etat.pas) * 0.07;
          corps.position.y = etat.socle + Math.abs(Math.sin(etat.pas)) * 0.03;
        } else {
          etat.pas = 0;
          corps.rotation.z = o.vie ? Math.sin(horloge * 1.1 + etat.graine) * 0.012 : 0;
          corps.position.y = etat.socle;
        }
        // Attitude au comptoir : jouée sur place, tourné vers son regard. w = 0 (libre) à 1 (en pose), en douceur.
        var enPose = (!!o.attitude || !!etat.service) && !etat.cible, nomA = etat.attNom;
        etat.att += ((o.attitude && !etat.cible ? 1 : 0) - etat.att) * Math.min(1, dt * 6);
        var w = etat.att * etat.att * (3 - 2 * etat.att);
        // Orientation. sens = 1 : il montre sa face au joueur ; -1 : le corps est retourné, le joueur voit le dos.
        var vers = camera ? Math.atan2(camera.position.x - gp.x, camera.position.z - gp.z) : 0;
        if (enPose) { groupe.rotation.y = typeof etat.regard === 'number' ? etat.regard : etat.verrou; etat.sens = 1; }
        else if (o.face === 'camera') {
          if (etat.regard === null) etat.sens = 1;
          else {
            var devant = Math.cos(vers - etat.regard);                  // > 0 : le joueur est devant lui
            if (devant > 0.06) etat.sens = 1; else if (devant < -0.06) etat.sens = -1;   // petite marge : pas de clignotement pile de profil
          }
          groupe.rotation.y = etat.sens > 0 ? vers : vers + Math.PI;
        } else { groupe.rotation.y = o.face; etat.sens = 1; }
        var cote = etat.cote = Math.cos(vers - groupe.rotation.y) >= 0 ? 1 : -1;   // 1 : le joueur est du côté de la face ; -1 : du côté du dos
        var assis = o.pose === 'assis';
        corps.position.z = (assis && cote > 0) ? o.assis.avance : 0;    // assis vu de face : les pieds passent devant le siège

        var ouvre = 0;                                                  // il parle : il tangue et rebondit à chaque syllabe
        if (etat.voix) {
          if (!pnj.parle()) etat.voix = null;
          else {
            var ta = audio.currentTime - etat.voix.debut, sy = etat.voix.syllabes || [], i;
            if (etat.voix.env) ouvre = etat.voix.env[Math.floor(Math.max(0, ta) * etat.voix.allure / 0.03)] || 0;
            for (i = 0; i < sy.length; i++) if (ta >= sy[i][0] && ta < sy[i][0] + sy[i][1]) { ouvre = Math.sin(Math.PI * (ta - sy[i][0]) / sy[i][1]); break; }
            if (!etat.cible) corps.rotation.z += Math.sin(horloge * 3.1 + etat.graine) * 0.035 * (1 - 0.7 * w);
          }
        }
        corps.scale.y = 1 + 0.045 * ouvre;

        // Les trois morceaux. Le torse penche autour de l'ourlet, la tête suit le haut du torse et s'incline autour du cou.
        var T = horloge, penche = 0, incline = 0;
        if (nomA === 'appuye') penche = 0.34;
        else if (nomA === 'hanche') { penche = 0.1; incline = 0.2; }
        else if (nomA === 'verre') { penche = 0.1; incline = 0.07 + 0.03 * Math.sin(T * 1.9); }
        penche *= w; incline *= w;
        // Service : ws = 0 à 1, poids du geste ; B = où est le cul de la bouteille à cet instant.
        var S = etat.service, ws = 0, B = null;
        if (S) {
          if (!etat.cible) S.t += dt;
          ws = Math.max(0, Math.min(1, S.t / 0.3, (S.duree - S.t) / 0.45)); ws = ws * ws * (3 - 2 * ws);
          B = cle(S.cles, S.t);
          penche += (B[3] - penche) * ws; incline *= 1 - ws;
        }
        if (repos) {
          var fin = 0.004 * cote;                                       // un cheveu d'écart, pour que chaque morceau passe devant le précédent
          morceaux.bas.position.set(0, repos.bas, assis ? fin : -fin);
          morceaux.torse.position.set(0, repos.torse, 0);
          morceaux.torse.rotation.x = penche;
          morceaux.tete.position.set(0, repos.torse + repos.cou * Math.cos(penche), repos.cou * Math.sin(penche) + 2 * fin);
          morceaux.tete.rotation.z = incline;
        }

        // Le verre du barman : au niveau du ventre, un peu devant lui. Le chiffon et la mousse suivent la main qui frotte.
        var H0 = o.comptoir.hauteur + 0.006, D0 = o.comptoir.distance, frotte = T * 7;
        var V = repos ? { x: 0.05, y: Math.max(etat.socle + repos.ourlet + 0.24, o.comptoir.hauteur + 0.15), z: corps.position.z + 0.2 } : null;   // au-dessus du comptoir, pour qu'on le voie côté client
        if (attache) {                                                  // les mains : elles flottent, balancent à la marche, s'agitent quand il parle, se posent en attitude
          var M = o.mains, saut = corps.position.y;
          etat.geste += ((etat.voix ? 1 : 0) - etat.geste) * Math.min(1, dt * 5);
          var ge = etat.geste * (1 - w), tourne = ge * ge * (3 - 2 * ge);
          mains.forEach(function (m) {
            var c = m.cote, q = m.plan, f = M.flotte ? 1 : 0;
            // au repos : de chaque côté du t-shirt
            var x = attache.x + f * Math.sin(T * 1.1 + m.phase) * 0.008, y = attache.y + f * Math.sin(T * 1.7 + m.phase) * 0.014, rz = M.angle + f * Math.sin(T * 1.3 + m.phase) * 0.05;
            if (etat.cible) { var b = Math.sin(etat.pas * 0.5 + (c > 0 ? 0 : Math.PI)); y += b * 0.04; rz += b * 0.3; }
            y += ge * (0.1 + 0.05 * Math.sin(T * 6.3 + m.phase) + 0.05 * ouvre);   // il parle : les mains montent et battent la mesure
            x += ge * 0.05; rz += ge * (0.35 + 0.3 * Math.sin(T * 4.1 + m.phase));
            var px = c * x, py = saut + y, pz = corps.position.z + cote * 0.03, rX = 0, rY = c * tourne * Math.PI, rZ = c * rz;
            // en attitude : la cible de cette main, dans le repère du PNJ (x à droite, y en haut, z devant lui)
            var leve = 0.7, yPose = H0 + attache.h * Math.sin(leve);   // posée sur le comptoir du bout des doigts, poignet relevé : on la voit côté client
            var a = null, aPlat = [c * 0.25, yPose, D0 + 0.04, -Math.PI / 2 + leve, c * 0.3, 0];   // doigts vers l'avant, un peu ouverts
            if (nomA === 'appuye') a = aPlat;
            else if (nomA === 'hanche') a = c < 0 ? [-0.24, yPose, D0 + 0.05, -Math.PI / 2 + leve, -0.25, 0]
                                                 : [repos.demi * 0.75, Math.max(etat.socle + repos.ourlet + attache.h * 0.75, H0 + 0.17), corps.position.z + cote * 0.1, 0, 0, -0.9];   // sur la hanche, doigts vers l'intérieur ; jamais sous le comptoir, sinon on ne la voit pas
            else if (nomA === 'verre' && V) a = c > 0 ? [V.x + 0.17, V.y - 0.03, V.z - 0.025, 0, Math.PI, -Math.PI / 2 + 0.12]                       // paume ouverte derrière le verre : elle le tient
                                                     : [V.x - 0.2 + 0.028 * Math.cos(frotte), V.y + 0.1 + 0.022 * Math.sin(frotte), V.z + 0.05, 0, 0, 1.1 + 0.12 * Math.sin(frotte)];   // l'autre frotte en rond
            if (a && w > 0.001) {
              px += (a[0] - px) * w; py += (a[1] - py) * w; pz += (a[2] - pz) * w;
              rX += (a[3] - rX) * w; rY += (a[4] - rY) * w; rZ += (a[5] - rZ) * w;
            }
            if (S) {                                                    // service : une main tient la bouteille dans sa paume, l'autre reste posée sur le comptoir
              var s = c > 0 ? [B[0] + 0.17, B[1] + 0.09, B[2] - 0.025, 0, Math.PI, -Math.PI / 2 + 0.12] : [-0.24, yPose, D0 + 0.05, -Math.PI / 2 + leve, -0.25, 0];
              px += (s[0] - px) * ws; py += (s[1] - py) * ws; pz += (s[2] - pz) * ws;
              rX += (s[3] - rX) * ws; rY += (s[4] - rY) * ws; rZ += (s[5] - rZ) * ws;
            }
            q.position.set(px, py, pz);
            q.rotation.set(rX, rY, rZ);                                 // ordre ZYX : à plat (x), puis demi-tour autour de l'axe de la main (y), puis orientation des doigts (z)
            m.bout = [px + Math.sin(rZ) * attache.h * 0.8, py - Math.cos(rZ) * attache.h * 0.8, pz];   // le bout des doigts, pour y accrocher le chiffon
          });
        }
        if (S) {                                                        // la bouteille : dans sa main, puis laissée sur le comptoir
          var ob = S.objet;
          if (!S.lachee) {
            ob.visible = S.t >= S.prise;
            ob.position.set(B[0], B[1], B[2]);
            ob.rotation.z = 0.1 * Math.max(0, Math.min(1, (3.0 - S.t) / 0.4));   // un peu penchée tant qu'il la porte
            if (S.t >= S.pose) {                                        // posée : elle quitte le PNJ et reste là où elle est, dans la scène
              var ry = groupe.rotation.y, co = Math.cos(ry), si = Math.sin(ry);
              groupe.remove(ob); scene.add(ob);
              ob.position.set(gp.x + B[0] * co + B[2] * si, B[1], gp.z - B[0] * si + B[2] * co);
              ob.rotation.set(0, ry, 0);
              S.lachee = true;
              etat.servies = etat.servies.filter(function (q) { if (q.place === S.place) { scene.remove(q.objet); return false; } return true; });   // une place, une bouteille
              etat.servies.push({ objet: ob, place: S.place });
              if (S.fin) S.fin(pnj, ob);
            }
          }
          if (S.t >= S.duree) etat.service = null;
        }
        // Verre, chiffon et mousse : en volume, façon PS1. Ils n'existent que pour un PNJ qui a déjà essuyé un verre.
        var wv = w * (1 - ws), montrer = nomA === 'verre' && wv > 0.02 && V;   // pendant un service, il a posé son verre
        if (montrer && !etat.props) etat.props = accessoires(groupe);
        if (etat.props) {
          var P = etat.props; P.groupe.visible = !!montrer;
          if (montrer) {
            var b0 = attache ? mains[0].bout : [V.x - 0.02, V.y + 0.05, V.z + 0.05];
            P.verre.scale.set(wv, wv, wv); P.chiffon.scale.set(wv, wv, wv);   // ils apparaissent en grossissant
            P.verre.position.set(V.x, V.y, V.z); P.verre.rotation.z = 0.22 + 0.04 * Math.sin(frotte);
            P.chiffon.position.set(b0[0], b0[1], V.z + 0.035); P.chiffon.rotation.z = frotte * 0.25; P.chiffon.rotation.x = 0.3 * Math.sin(frotte);
            P.bulles.forEach(function (bu, k) {                         // la mousse : des bulles qui gonflent, montent et éclatent
              var ph = (T * 0.55 + k / P.bulles.length) % 1, g = 0.5 + 0.9 * Math.sin(ph * Math.PI);
              bu.position.set(b0[0] + 0.035 * Math.sin(k * 2.4 + T * 1.3), b0[1] + 0.01 + ph * 0.07, V.z + 0.05 + 0.015 * Math.cos(k * 1.7));
              bu.scale.set(g * wv, g * wv, g * wv);
            });
          }
        }
      }
    };
    poserEn(depart[0], depart[1]);
    tous.push(pnj);
    tisser();
    accorder();
    if (o.attitude) pnj.attitude(o.attitude);
    return pnj;
  }

  return {
    // { THREE, scene, camera, colliders (facultatif : la liste de segments du bodega), dossier (où sont les PNG), audio et bouteille (facultatifs) }
    init: function (c) {
      T3 = c.THREE || window.THREE; scene = c.scene; camera = c.camera || null;
      fabriqueBouteille = c.bouteille || null;                         // facultatif : fabrique la bouteille que le PNJ sert
      if (c.audio) audio = c.audio;                                     // facultatif : un AudioContext déjà ouvert par la page
      colliders = c.colliders || null; dossier = c.dossier || '';
      // Le corps : deux carrés dos à dos, origine aux pieds. Devant, la moitié gauche de la toile (la face) ; derrière, la moitié droite (le dos).
      GEO = new T3.BufferGeometry();
      GEO.setAttribute('position', new T3.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0, -0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
      GEO.setAttribute('uv', new T3.Float32BufferAttribute([0, 0, 0.5, 0, 0.5, 1, 0, 1, 1, 0, 0.5, 0, 0.5, 1, 1, 1], 2));
      GEO.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]);
      // Une main : deux carrés dos à dos, origine au poignet. Devant, la moitié gauche de la toile (le dos) ; derrière, la moitié droite (la paume).
      GEO_MAIN = new T3.BufferGeometry();
      GEO_MAIN.setAttribute('position', new T3.Float32BufferAttribute([-0.5, -1, 0, 0.5, -1, 0, 0.5, 0, 0, -0.5, 0, 0, -0.5, -1, 0, 0.5, -1, 0, 0.5, 0, 0, -0.5, 0, 0], 3));
      GEO_MAIN.setAttribute('uv', new T3.Float32BufferAttribute([0, 0, 0.5, 0, 0.5, 1, 0, 1, 1, 0, 0.5, 0, 0.5, 1, 1, 1], 2));
      GEO_MAIN.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]);
    },
    creer: creer,
    maj: function (dt) {
      if (!(dt > 0)) dt = 0;                                            // un pas de temps nul, négatif ou invalide ne fait rien bouger
      horloge += dt; for (var i = 0; i < tous.length; i++) tous[i]._maj(dt);
    },
    // Le PNJ le plus proche du joueur parmi ceux qui sont à portée, ou null.
    proche: function () {
      if (!camera) return null;
      var qui = null, mieux = Infinity;
      for (var i = 0; i < tous.length; i++) {
        var gp = tous[i].groupe.position, dx = camera.position.x - gp.x, dz = camera.position.z - gp.z, d = Math.sqrt(dx * dx + dz * dz);
        if (d <= tous[i].options.portee && d < mieux) { mieux = d; qui = tous[i]; }
      }
      return qui;
    },
    // Fait parler le PNJ à portée ; rend ce PNJ, ou null s'il n'y a personne.
    parler: function () { var qui = this.proche(); if (qui) qui.parler(); return qui; },
    decouper: decouper,    // exposé : repère les phrases d'un signal mono aux silences
    voix: voix,            // exposé pour essayer une voix sans PNJ : PNJ.voix(contexteAudio, sortie, { graine: 3 })
    tous: tous,
    defaut: DEFAUT,
    charger: charger,      // exposés pour fabriquer un aperçu 2D sans scène 3D
    composer: composer,
    composerCorps: composerCorps,
    composerMain: composerMain
  };
})();
