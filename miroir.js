/* miroir.js : le miroir des toilettes. On s'y voit.

   Le visiteur n'a pas de corps : on lui en donne un, que seul le miroir voit (le calque 1 de three.js : la caméra du joueur ne
   regarde que le calque 0). C'est un PNJ comme les fantômes, avec la tenue commune et la tête que les autres voient sur son
   fantôme (celle que le relais lui a donnée) ; sans relais, une tête tirée au hasard et gardée dans ce navigateur.
   Il se tient là où est le joueur, tourné comme lui ; il boit quand le joueur boit (le jet de pipi, lui, est déjà dans la salle).

   Le reflet : une deuxième caméra, symétrique de celle du joueur par rapport au plan du miroir, dont le cadre passe exactement par
   les quatre coins de la glace (projection décentrée) et dont le plan proche est la glace elle-même (rien de ce qui est derrière
   le mur ne se voit). Elle dessine dans une petite image (96 x 128 pixels, sans lissage : un miroir PS1), posée sur la glace.

   Pour rester fluide : rien n'est calculé tant qu'on n'est pas devant le miroir (à moins de 2,6 m, la glace à l'écran) ; sur
   téléphone, une image sur deux ; la caméra du reflet ne voit qu'à 4,5 m. À la moindre erreur, la glace grise revient et le bar
   continue. */
(function () {
  'use strict';
  var R = { largeur: 96, hauteur: 128, portee: 2.6, loin: 4.5, recul: 0.12, teinte: 0xdfe6e4 };
  var coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  var B = null, M = null, T = null, rt = null, cam = null, glace = null, matGrise = null, matReflet = null;
  var C = null;                                            // la glace : centre, normale (vers la salle), repère vr / vu, coins, taille
  var moi = null, teteMoi = -1, buvait = false, panne = false, image = 0, actif = false, rendus = 0;

  function v3(x, y, z) { return [x, y, z]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

  // La glace, une fois : sa taille, ses coins dans la salle, et ses coordonnées de texture recalculées pour coller au reflet.
  function mesurer() {
    var g = glace.geometry, p = g.attributes.position, i, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (i = 0; i < p.count; i++) { x0 = Math.min(x0, p.array[i * 3]); x1 = Math.max(x1, p.array[i * 3]); y0 = Math.min(y0, p.array[i * 3 + 1]); y1 = Math.max(y1, p.array[i * 3 + 1]); }
    var ry = glace.rotation.y, c = Math.cos(ry), s = Math.sin(ry), o = [glace.position.x, glace.position.y, glace.position.z];
    function monde(x, y) { return [o[0] + x * c, o[1] + y, o[2] - x * s]; }     // la glace est posée droite, tournée autour de la verticale
    var n = norm([s, 0, c]);                                                     // sa face, vers la salle
    var vu = [0, 1, 0], vn = [-n[0], -n[1], -n[2]], vr = norm(cross(vu, vn));    // repère de la caméra du reflet (derrière la glace, regardant la salle)
    var coins = [monde(x0, y0), monde(x1, y0), monde(x0, y1), monde(x1, y1)];
    var pa = coins[0]; coins.forEach(function (q) { if (dot(sub(q, pa), vr) < -1e-6 || dot(sub(q, pa), vu) < -1e-6) pa = q; });
    var L = 0, H = 0; coins.forEach(function (q) { L = Math.max(L, dot(sub(q, pa), vr)); H = Math.max(H, dot(sub(q, pa), vu)); });
    C = { o: o, n: n, vr: vr, vu: vu, vn: vn, pa: pa, L: L, H: H, coins: coins };
    var uv = g.attributes.uv;
    for (i = 0; i < p.count; i++) {
      var w = monde(p.array[i * 3], p.array[i * 3 + 1]), d = sub(w, pa);
      uv.array[i * 2] = dot(d, vr) / L; uv.array[i * 2 + 1] = dot(d, vu) / H;
    }
    uv.needsUpdate = true; p.needsUpdate = true;
  }

  function init() {
    B = window.bodega; M = B.miroir; T = window.THREE; glace = M.glace;
    matGrise = glace.material;
    rt = new T.WebGLRenderTarget(R.largeur, R.hauteur, { minFilter: T.NearestFilter, magFilter: T.NearestFilter, generateMipmaps: false, depthBuffer: true });
    matReflet = new T.MeshBasicMaterial({ map: rt.texture, color: R.teinte, fog: false });
    cam = new T.PerspectiveCamera(60, R.largeur / R.hauteur, 0.05, R.loin);
    cam.matrixAutoUpdate = false; cam.layers.enable(1);
    mesurer();
  }

  // Le corps du joueur : un PNJ (tenue commune, sa tête), sur le calque 1. Refait si sa tête change (connexion au relais).
  function maTete() {
    var F = window.FANTOMES, r = F && F.reseau ? F.reseau() : null, n = F && F.tetes ? F.tetes.length : 28, t;
    if (r && r.id && typeof r.tete === 'number') return ((r.tete % n) + n) % n;
    try { t = parseInt(localStorage.getItem('berao-tete'), 10); } catch (e) { t = NaN; }
    if (!(t >= 0 && t < n)) { t = Math.floor(Math.random() * n); try { localStorage.setItem('berao-tete', String(t)); } catch (e) {} }
    return t;
  }
  function corps(x, z, cap) {
    var t = maTete(), TT = window.FANTOMES && window.FANTOMES.tetes;
    if (moi && t === teteMoi) return moi;
    if (moi) { moi.retirer(); moi = null; }
    if (!TT || !TT[t]) return null;
    var q = TT[t];
    moi = B.pnj({ pos: [x, z], face: cap, solide: false, portee: 0, tete: q[0] + '.png', teteDos: q[0] + '-dos.png', cou: q[1], enfonce: q[2], grosseur: q[3] });
    teteMoi = t; buvait = false;
    return moi;
  }
  function auCalque1(o) { o.traverse(function (m) { if (m.layers) m.layers.set(1); }); }

  // Le miroir est-il à l'écran ? (un des quatre coins dans le champ de la caméra du joueur, avec une marge)
  function aLEcran(oeil, v) {
    var cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), cp = Math.cos(v.pitch || 0), sp = Math.sin(v.pitch || 0);
    var f = [-sy * cp, sp, -cy * cp], r = [cy, 0, -sy], u = cross(r, f);
    var tv = Math.tan(M.camera.fov * Math.PI / 360) * 1.15, th = tv * (M.camera.aspect || 1);
    return C.coins.some(function (q) {
      var d = sub(q, oeil), z = dot(d, f);
      return z > 0.02 && Math.abs(dot(d, r) / z) < th && Math.abs(dot(d, u) / z) < tv;
    });
  }

  function eteindre() {
    if (glace.material !== matGrise) glace.material = matGrise;
    if (moi) moi.groupe.visible = false;
    actif = false;
  }

  function maj(dt) {
    if (panne) return;
    try { avancer(dt); }
    catch (e) {
      panne = true; try { eteindre(); } catch (e2) {}
      if (window.console) console.warn('miroir.js arrêté : ' + (e && e.message));
    }
  }
  function avancer(dt) {
    if (!B) { if (!(window.bodega && window.bodega.miroir && window.bodega.miroir.glace && window.THREE && window.THREE.WebGLRenderTarget && window.bodega.pnj)) return; init(); }
    var v = B.view(), oeil = [M.camera.position.x, M.camera.position.y, M.camera.position.z];
    var d = dot(sub(oeil, C.o), C.n), dx = oeil[0] - C.o[0], dz = oeil[2] - C.o[2];
    var devant = d > 0.05 && Math.sqrt(dx * dx + dz * dz) < R.portee && !(B.tele && B.tele.etat && B.tele.etat() !== 'salle') && aLEcran(oeil, v);
    if (!devant) { eteindre(); return; }
    // le corps : un pas derrière les yeux, tourné comme le joueur ; caché s'il est assis
    var cap = v.yaw + Math.PI, fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw);
    var assis = B.siege && B.siege.rang && B.siege.rang() >= 0;
    var n = corps(v.x - fx * R.recul, v.z - fz * R.recul, cap);
    if (n) {
      n.placer(v.x - fx * R.recul, v.z - fz * R.recul); n.options.face = cap;
      n.groupe.visible = !assis;
      var boit = !!(B.BOIRE && B.BOIRE.actif);
      if (boit && !buvait && n.boire) n.boire(6.1);
      buvait = boit;
      auCalque1(n.groupe);                                             // après la bouteille : rien de lui ne passe dans la vue du joueur
    }
    actif = true;
    image++;
    if (coarse && (image & 1) && glace.material === matReflet) return;   // téléphone : une image sur deux
    // la caméra du reflet : symétrique de l'œil par rapport à la glace, son cadre passe par les coins de la glace
    var pe = [oeil[0] - 2 * d * C.n[0], oeil[1] - 2 * d * C.n[1], oeil[2] - 2 * d * C.n[2]];
    var va = sub(C.pa, pe), proche = -dot(va, C.vn);                     // distance de l'œil symétrique à la glace
    var l = dot(C.vr, va), r = l + C.L, b = dot(C.vu, va), t = b + C.H, f = proche + R.loin, p = proche;
    var vr = C.vr, vu = C.vu, vn = C.vn;
    var monde = [vr[0], vr[1], vr[2], 0, vu[0], vu[1], vu[2], 0, vn[0], vn[1], vn[2], 0, pe[0], pe[1], pe[2], 1];
    var inverse = [vr[0], vu[0], vn[0], 0, vr[1], vu[1], vn[1], 0, vr[2], vu[2], vn[2], 0, -dot(vr, pe), -dot(vu, pe), -dot(vn, pe), 1];
    var proj = [2 * p / (r - l), 0, 0, 0, 0, 2 * p / (t - b), 0, 0, (r + l) / (r - l), (t + b) / (t - b), -(f + p) / (f - p), -1, 0, 0, -2 * f * p / (f - p), 0];
    cam.matrix.fromArray(monde); cam.matrixWorld.fromArray(monde); cam.matrixWorldInverse.fromArray(inverse);
    cam.projectionMatrix.fromArray(proj);
    if (cam.projectionMatrixInverse && cam.projectionMatrixInverse.copy) { cam.projectionMatrixInverse.copy(cam.projectionMatrix); if (cam.projectionMatrixInverse.invert) cam.projectionMatrixInverse.invert(); }
    cam.position.set(pe[0], pe[1], pe[2]); cam.near = p; cam.far = f;
    // on dessine : sans la glace elle-même (elle ne peut pas se lire en s'écrivant), sans ce que porte la caméra du joueur
    // (ses mains en photo, la télécommande, la bouteille qu'il boit)
    var portes = (M.camera.children || []).map(function (o) { var w = o.visible; o.visible = false; return [o, w]; });
    glace.visible = false;
    var R0 = M.renderer, avant = R0.getRenderTarget ? R0.getRenderTarget() : null;
    R0.setRenderTarget(rt); R0.render(M.scene, cam); R0.setRenderTarget(avant);
    glace.visible = true;
    portes.forEach(function (q) { q[0].visible = q[1]; });
    if (glace.material !== matReflet) glace.material = matReflet;
    rendus++;
  }

  window.MIROIR = {
    maj: maj,
    reglages: R,
    // pour les essais
    etat: function () { return { actif: actif, panne: panne, rendus: rendus, tete: teteMoi, corps: !!moi, visible: !!(moi && moi.groupe.visible), reflet: !!glace && glace.material === matReflet }; },
    corps: function () { return moi; },
    camera: function () { return cam; }
  };
})();
