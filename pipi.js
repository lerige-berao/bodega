/* pipi.js : le jet de pipi du joueur, en style réaliste (Three.js r128, sans dépendance de plus).

   Le jet part de la « zone pipi », sous la caméra, et va là où le joueur regarde : il passe par le point visé, au centre de l'image,
   jusqu'à 2 m devant, ou avant si le regard s'arrête sur le sol, un mur ou un meuble. Il prend la force qu'il faut pour y arriver :
   la force de base en visant à ses pieds, de plus en plus à mesure qu'on relève les yeux.
   Au début du jet, le regard se baisse tout seul vers le sol pour qu'on le voie ; ensuite on regarde où on veut.
   C'est un filet fin et translucide qui se défait en gouttelettes, éclabousse, et laisse une flaque sombre qui grandit
   là où on vise puis s'évapore. On peut dessiner par terre en tournant.
   Plus on lève les yeux, plus le jet se redresse et monte en puissance. Regard vers le ciel : il part à la verticale
   et retombe sur le joueur, qui se retrouve avec une flaque aux pieds.
   Les obstacles ont une hauteur : le jet passe par-dessus une table ou un comptoir et peut retomber dessus.

   Branchement (3 lignes) :
     var pipi = PIPI.creer({ THREE: THREE, scene: scene, camera: camera, colliders: sol.colliders });
     pipi.clavier();                    // R maintenu = pipi
     pipi.maj(dt, moi);                 // dans frame(), après le déplacement du joueur, avant renderer.render

   moi = le joueur de sol.js, ou n'importe quel objet { x, z, yaw, pitch } (dans le bodega : sa position et son regard).
   Le regard baissé au début du jet est écrit dans pitch de cet objet. Pour l'empêcher : PIPI.creer({ ..., baisser: 0 }).

   Sans clavier :
     pipi.ouvrir();  pipi.fermer();     // le jet monte en pression, puis retombe en quelques gouttes
     pipi.ouvert();  pipi.mouille();    // jet en cours ? ; à quel point on s'est arrosé, de 0 à 1
     pipi.nettoyer();                   // efface les flaques

   Réglages de creer :
     hauteur 0.78 (m, d'où part le jet)   avance 0.12 (m devant le joueur)
     force 2.7 (m/s, la force de base, quand on vise près de ses pieds)   forceHaut 5.4 (m/s, la force la plus grande)
     portee 2 (m, distance le long du regard où le jet croise le centre de l'image, quand rien n'arrête le regard avant)
     yeux (m, hauteur des yeux ; par défaut celle de la caméra)
     baisser 0.62 (radians dont le regard se baisse au début du jet ; 0 = jamais)
     pitchMax 1.25 (le regard le plus haut possible, en radians : à 85 % de cette valeur le jet part déjà à la verticale)
     seche 15 (s avant que les flaques s'évaporent)   sol 0 (hauteur du sol)
     colliders (facultatif : les segments de murs et de meubles { ax, az, bx, bz, pad, h }, le jet s'y écrase ;
                h = hauteur de l'obstacle en mètres, absent pour un mur qui monte jusqu'au plafond)
     surSoi (facultatif : fonction appelée quand le joueur commence à se faire pipi dessus)
     impact (facultatif : fonction (obstacle, x, y, z) appelée à chaque goutte qui s'écrase sur un obstacle de colliders ;
             obstacle = le segment touché, tel qu'il est dans la liste. Sert à savoir sur quoi, ou sur qui, on fait pipi)
*/
var PIPI = (function () {
  'use strict';
  var G = 9.81, NJ = 280, NE = 160, NF = 64;                        // gouttes du jet, éclats, flaques
  var R = {
    debit: 130,            // gouttes émises par seconde
    tremble: 0.012,        // flottement de la visée, en radians
    jusqua: 0.2,           // âge (s) où le filet se défait en gouttelettes
    filet: 0.010,          // largeur du filet (m), deux fois plus fin au bout
    goutte: 0.017,         // taille des gouttelettes (m)
    eclat: 0.010, eclats: 1.6, vitesse: 0.8, vie: 0.26,             // éclats à l'impact : taille, nombre, vitesse, durée
    flaque: 0.34           // rayon maximal d'une flaque (m)
  };

  function creer(opt) {
    opt = opt || {};
    var T3 = opt.THREE || window.THREE, scene = opt.scene, cam = opt.camera, colliders = opt.colliders || null;
    var HAUT = opt.hauteur === undefined ? 0.78 : opt.hauteur, AVANCE = opt.avance === undefined ? 0.12 : opt.avance;
    var FORCE = opt.force || 2.7, FORCE_HAUT = opt.forceHaut || 5.4, BAISSER = opt.baisser === undefined ? 0.62 : opt.baisser, SECHE = opt.seche === undefined ? 15 : opt.seche, SOL = opt.sol || 0;
    var PITCH_MAX = opt.pitchMax || 1.25, PORTEE = opt.portee || 2, YEUX = opt.yeux || 0;
    var groupe = new T3.Group(); groupe.name = 'pipi'; scene.add(groupe);

    /* ---------- État : gouttes du jet (anneau, dans l'ordre d'émission), éclats, flaques ---------- */
    var px = new Float32Array(NJ), py = new Float32Array(NJ), pz = new Float32Array(NJ);
    var vx = new Float32Array(NJ), vy = new Float32Array(NJ), vz = new Float32Array(NJ);
    var age = new Float32Array(NJ), pose = new Float32Array(NJ), etat = new Uint8Array(NJ), coupe = new Uint8Array(NJ), tete = 0;
    var ex = new Float32Array(NE), ey = new Float32Array(NE), ez = new Float32Array(NE);
    var eu = new Float32Array(NE), ev = new Float32Array(NE), ew = new Float32Array(NE);
    var ea = new Float32Array(NE), el = new Float32Array(NE), queue = 0;
    var fx = new Float32Array(NF), fz = new Float32Array(NF), fr = new Float32Array(NF), fv = new Float32Array(NF);
    var frepos = new Float32Array(NF), fne = new Float32Array(NF), naissances = 0;
    var ouvert = false, aFermer = false, duree = 0, pression = 0, reste = 0, serie = true, temps = 0, regard = 0;
    var ox = 0, oy = HAUT, oz = 0, jx = 0, jz = 0, mouille = 0, arrose = 0;
    var tir = { haut: 0, vit: FORCE, d: 0, y: 0 };                 // le dernier tir : pente, force, point visé (distance devant le joueur, hauteur)

    /* ---------- Objets 3D ---------- */
    function pastille(fn) {                                         // disque blanc, dont fn(a) donne l'opacité du bord (a = 0) au centre (a = 1)
      var c = document.createElement('canvas'); c.width = c.height = 32;
      var g = c.getContext('2d'), d = g.createImageData(32, 32);
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
        var a = Math.max(0, 1 - Math.sqrt((x - 15.5) * (x - 15.5) + (y - 15.5) * (y - 15.5)) / 16), i = (y * 32 + x) * 4;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; d.data[i + 3] = 255 * Math.min(1, fn(a));
      }
      g.putImageData(d, 0, 0);
      var t = new T3.CanvasTexture(c);
      t.magFilter = T3.LinearFilter; t.minFilter = T3.LinearFilter; t.generateMipmaps = false;
      return t;
    }
    var douce = pastille(function (a) { return a * a * 3.2; });      // goutte : fondue jusqu'au centre
    var nappe = pastille(function (a) { return a / 0.2; });          // flaque : pleine, avec seulement le bord fondu
    // Gouttelettes et éclats : une pastille face caméra, répétée
    var gouttes = new T3.InstancedMesh(new T3.PlaneGeometry(1, 1),
      new T3.MeshBasicMaterial({ map: douce, color: 0xece09a, transparent: true, opacity: 0.8, depthWrite: false, side: T3.DoubleSide }), NJ + NE);
    gouttes.frustumCulled = false; groupe.add(gouttes);
    // Filet : deux bandes tendues le long du jet (le corps translucide, puis un reflet clair), recalculées à chaque image
    var bandes = [{ l: R.filet, couleur: 0xe9db86, opacite: 0.78, dz: 0, cote: 0 }, { l: R.filet * 0.3, couleur: 0xfffbe2, opacite: 0.6, dz: 0.003, cote: 0.002 }];
    bandes.forEach(function (B, rang) {
      var g = new T3.BufferGeometry(), p = new T3.BufferAttribute(new Float32Array((NJ + 1) * 18), 3);
      p.setUsage(T3.DynamicDrawUsage);
      g.setAttribute('position', p); g.setDrawRange(0, 0);
      B.mesh = new T3.Mesh(g, new T3.MeshBasicMaterial({ color: B.couleur, transparent: true, opacity: B.opacite, depthWrite: false, side: T3.DoubleSide }));
      B.mesh.frustumCulled = false; B.mesh.renderOrder = rang; groupe.add(B.mesh);
    });
    // Flaques : une tache sombre et mouillée, et un voile jaune par-dessus pour qu'elle se lise aussi sur la moquette foncée
    var couches = [{ couleur: 0x241c05, opacite: 0.45, k: 1 }, { couleur: 0xcdb84a, opacite: 0.36, k: 0.94 }];
    couches.forEach(function (c, rang) {
      var g = new T3.PlaneGeometry(2, 2); g.rotateX(-Math.PI / 2);
      c.mesh = new T3.InstancedMesh(g, new T3.MeshBasicMaterial({ map: nappe, color: c.couleur, transparent: true, opacity: c.opacite, depthWrite: false,
        side: T3.DoubleSide, polygonOffset: true, polygonOffsetFactor: -8 - rang, polygonOffsetUnits: -8 - rang }), NF);
      c.mesh.frustumCulled = false; c.mesh.renderOrder = -10 + rang; c.y = SOL + 0.014 + rang * 0.002; groupe.add(c.mesh);
    });

    /* ---------- Éclats et flaques ---------- */
    function eclabousser(x, y, z, bx, bz) {
      var n = Math.floor(R.eclats) + (Math.random() < R.eclats % 1 ? 1 : 0);
      for (var k = 0; k < n; k++) {
        var i = queue; queue = (queue + 1) % NE;
        var a = Math.random() * Math.PI * 2, h = R.vitesse * (0.15 + Math.random() * 0.4);
        ex[i] = x; ey[i] = y + 0.01; ez[i] = z;
        eu[i] = Math.cos(a) * h + bx; ev[i] = R.vitesse * (0.5 + Math.random() * 0.6); ew[i] = Math.sin(a) * h + bz;
        ea[i] = 0; el[i] = R.vie * (0.7 + Math.random() * 0.6);
      }
    }
    function arroser(x, z) {
      var b = -1, bd = Infinity, i, d;
      for (i = 0; i < NF; i++) {
        if (fr[i] <= 0) continue;
        d = Math.sqrt((x - fx[i]) * (x - fx[i]) + (z - fz[i]) * (z - fz[i]));
        if (d < Math.max(0.07, fr[i] * 0.75) && d < bd) { bd = d; b = i; }
      }
      if (b < 0) {                                                  // nouvelle flaque : une place libre, sinon la plus ancienne
        var vieux = Infinity;
        for (i = 0; i < NF; i++) { if (fr[i] <= 0) { b = i; break; } if (fne[i] < vieux) { vieux = fne[i]; b = i; } }
        fx[b] = x; fz[b] = z; fv[b] = 0; fne[b] = ++naissances;
      }
      fv[b] += 110 / R.debit;
      fr[b] = Math.min(R.flaque, 0.011 * Math.sqrt(fv[b]));
      fx[b] += (x - fx[b]) * 0.02; fz[b] += (z - fz[b]) * 0.02; frepos[b] = 0;
    }
    // Les obstacles sont interrogés des milliers de fois par image : on range d'abord leur emprise (un rectangle chacun),
    // refaite à chaque image parce que des obstacles peuvent bouger, pour écarter presque tous les segments d'un simple test.
    var boites = null, nb = 0;
    function ranger() {
      nb = colliders.length;
      if (!boites || boites.length < nb * 4) boites = new Float32Array(nb * 4 + 64);
      for (var i = 0; i < nb; i++) {
        var c = colliders[i], m = c.pad + 0.015;
        boites[i * 4] = Math.min(c.ax, c.bx) - m; boites[i * 4 + 1] = Math.max(c.ax, c.bx) + m;
        boites[i * 4 + 2] = Math.min(c.az, c.bz) - m; boites[i * 4 + 3] = Math.max(c.az, c.bz) + m;
      }
    }
    var touche = -1;                                                // rang du dernier obstacle touché
    function heurte(x, z, y) {                                      // le point est-il dans un mur, ou dans un meuble plus haut que lui ?
      for (var i = 0; i < nb; i++) {
        if (x < boites[i * 4] || x > boites[i * 4 + 1] || z < boites[i * 4 + 2] || z > boites[i * 4 + 3]) continue;
        var c = colliders[i];
        if (c.h !== undefined && y > c.h) continue;
        var sx = c.bx - c.ax, sz = c.bz - c.az, l2 = sx * sx + sz * sz;
        var t = l2 > 0 ? ((x - c.ax) * sx + (z - c.az) * sz) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        var dx = x - (c.ax + sx * t), dz = z - (c.az + sz * t);
        if (dx * dx + dz * dz < (c.pad + 0.015) * (c.pad + 0.015)) { touche = i; return true; }
      }
      return false;
    }

    /* ---------- Visée ---------- */
    // Le point visé est sur la ligne du regard : à PORTEE mètres, ou avant si le regard s'arrête sur le sol, un mur ou un meuble.
    // Le jet part avec la force qu'il faut pour passer par ce point, entre FORCE et FORCE_HAUT, en tir tendu.
    // Si le point reste hors d'atteinte même à pleine force, on le rapproche le long du regard.
    // Si un obstacle barre le tir tendu (un comptoir devant soi), on essaie le tir en cloche, puis un peu plus de force.
    function libre(haut, v, yaw, dmax) {                           // ce tir arrive-t-il au point visé sans rien toucher en route ?
      var vx = v * Math.cos(haut), vy = v * Math.sin(haut), sx = -Math.sin(yaw), sz = -Math.cos(yaw), d, t, y;
      if (vx < 0.05) return true;
      for (d = 0.02; d < dmax - 0.04; d += 0.02) {                  // avec 4 cm de marge au-dessus des meubles : le jet tremble un peu
        t = d / vx; y = HAUT + vy * t - 0.5 * G * t * t;
        if (y <= SOL || heurte(ox + sx * d, oz + sz * d, y - 0.04)) return false;
      }
      return true;
    }
    function viser(yaw, pitch) {
      var E = YEUX || (cam ? cam.position.y : 1.6), cp = Math.cos(pitch), sp = Math.sin(pitch);
      var s = PORTEE, k, d = 0.05, h = 0, vmin = 0;
      if (sp < 0) s = Math.min(s, (E - SOL) / -sp);
      if (colliders) {
        var ux = -Math.sin(yaw) * cp, uz = -Math.cos(yaw) * cp;
        for (k = 0.12; k < s; k += 0.06) if (heurte(jx + ux * k, jz + uz * k, E + sp * k)) { s = Math.max(0.25, k - 0.04); break; }
      }
      function mesurer(q) {                                         // la plus petite force qui atteint le point à q mètres sur le regard
        d = Math.max(0.05, q * cp - AVANCE); h = E + q * sp - HAUT;
        vmin = Math.sqrt(G * (h + Math.sqrt(h * h + d * d)));
        return vmin;
      }
      if (mesurer(s) > FORCE_HAUT * 0.97) {                         // hors d'atteinte : le point le plus loin qu'on atteint encore
        var pres = 0.3, loin = s;
        for (k = 0; k < 12; k++) { if (mesurer((pres + loin) / 2) > FORCE_HAUT * 0.97) loin = (pres + loin) / 2; else pres = (pres + loin) / 2; }
        mesurer(s = pres);
      }
      var v = Math.max(FORCE, Math.min(FORCE_HAUT, vmin * 1.04)), essai, v2, disc, a, trouve = false;
      for (essai = 0; essai < 4; essai++) {
        v2 = v * v; disc = v2 * v2 - G * (G * d * d + 2 * h * v2);
        a = Math.atan(disc > 0 ? (v2 - Math.sqrt(disc)) / (G * d) : v2 / (G * d));          // tir tendu
        if (!essai) { tir.haut = a; tir.vit = v; }                  // à défaut de mieux : le premier, qui s'écrasera sur l'obstacle
        if (!colliders || libre(a, v, yaw, d)) trouve = true;
        else if (disc > 0) { a = Math.atan((v2 + Math.sqrt(disc)) / (G * d)); trouve = libre(a, v, yaw, d); }   // tir en cloche
        if (trouve) { tir.haut = a; tir.vit = v; break; }
        if (v >= FORCE_HAUT) break;
        v = Math.min(FORCE_HAUT, v * 1.12);
      }
      tir.d = d + AVANCE; tir.y = h + HAUT;
      return tir;
    }

    /* ---------- Simulation ---------- */
    function simuler(dt, p) {
      var i, k;
      temps += dt;
      if (colliders) ranger();
      if (ouvert) { duree += dt; if (aFermer && duree >= 0.5) ouvert = false; }
      pression = ouvert ? Math.min(1, pression + dt / 0.25) : Math.max(0, pression - dt / 0.4);
      if (p) {
        jx = p.pos ? p.pos.x : p.x; jz = p.pos ? p.pos.z : p.z;
        if (regard > 0 && BAISSER && p.pitch !== undefined) {       // au début du jet, on baisse les yeux pour le voir
          regard -= dt;
          if (p.pitch > -BAISSER) p.pitch += (-BAISSER - p.pitch) * Math.min(1, dt * 9);
        }
        var yaw = p.yaw || 0, pitch = p.pitch || 0;
        ox = jx - Math.sin(yaw) * AVANCE; oy = HAUT; oz = jz - Math.cos(yaw) * AVANCE;
        if (pression > 0.02) {
          // Le jet va là où on regarde (voir viser). Regard vers le ciel : il finit de se redresser ; à 85 % du regard le plus haut
          // il est vertical, à pleine force, et au-delà il penche un peu vers le joueur, sur qui il retombe.
          var flotte = Math.sin(temps * 3.1) + 0.5 * Math.sin(temps * 7.3), u = pitch / PITCH_MAX / 0.85, monte = Math.max(0, Math.min(1, u));
          var cap = yaw + flotte * R.tremble * (1 - monte);
          viser(yaw, pitch);
          var haut = tir.haut, force = tir.vit;
          if (u > 0.75) {
            var ciel = Math.min(1, (u - 0.75) / 0.25); ciel = ciel * ciel * (3 - 2 * ciel);
            haut += ((u < 1 ? Math.PI / 2 : Math.PI / 2 + (u - 1) / 0.176 * 0.04) - haut) * ciel;
            force += (FORCE_HAUT - force) * ciel;
          }
          haut = Math.min(Math.PI / 2 + 0.05, haut + Math.cos(temps * 4.3) * R.tremble * 0.6 * (1 - monte));
          var vit = force * (0.3 + 0.7 * pression);
          var dx = -Math.sin(cap) * Math.cos(haut), dy = Math.sin(haut), dz = -Math.cos(cap) * Math.cos(haut);
          reste += R.debit * dt;
          var n = Math.floor(reste); reste -= n;
          for (k = 0; k < n; k++) {
            var tau = dt * (n - k - 0.5) / n, w = vit * (0.97 + Math.random() * 0.06);   // la plus ancienne d'abord
            i = tete; tete = (tete + 1) % NJ;
            vx[i] = dx * w; vy[i] = dy * w - G * tau; vz[i] = dz * w;
            px[i] = ox + dx * w * tau; py[i] = oy + dy * w * tau - 0.5 * G * tau * tau; pz[i] = oz + dz * w * tau;
            age[i] = tau; etat[i] = 1; coupe[i] = serie ? 1 : 0; serie = false;
          }
        } else { serie = true; reste = 0; }
      }
      var touches = 0;
      for (i = 0; i < NJ; i++) {
        if (etat[i] === 2) { pose[i] -= dt; if (pose[i] <= 0) etat[i] = 0; continue; }
        if (!etat[i]) continue;
        age[i] += dt; vy[i] -= G * dt;
        // Avance par petits pas de 3 cm au plus : un jet rapide ne traverse pas un mur mince, même quand l'image est lente.
        var mx = vx[i] * dt, my = vy[i] * dt, mz = vz[i] * dt;
        var pas = Math.min(10, Math.max(1, Math.ceil(Math.sqrt(mx * mx + my * my + mz * mz) / 0.03))), q;
        for (q = 0; q < pas && etat[i] === 1; q++) {
          var nx = px[i] + mx / pas, ny = py[i] + my / pas, nz = pz[i] + mz / pas;
          if (ny <= SOL) {                                          // touche le sol : éclats, flaque, et le filet s'y accroche un instant
            var f = py[i] > ny ? (py[i] - SOL) / (py[i] - ny) : 1;
            px[i] += (nx - px[i]) * f; pz[i] += (nz - pz[i]) * f; py[i] = SOL + 0.004;
            etat[i] = 2; pose[i] = 0.05;
            eclabousser(px[i], SOL, pz[i], vx[i] * 0.12, vz[i] * 0.12);
            arroser(px[i], pz[i]);
          } else if (p && vy[i] < 0 && age[i] > 0.3 && ny < 1.78 && ny > 0.3 && (nx - jx) * (nx - jx) + (nz - jz) * (nz - jz) < 0.058) {
            etat[i] = 0; touches++;                                 // retombe sur le joueur
            if (Math.random() < 0.3) eclabousser(nx, ny, nz, 0, 0);
            if (Math.random() < 0.25) arroser(jx + (Math.random() - 0.5) * 0.3, jz + (Math.random() - 0.5) * 0.3);
          } else if (colliders && heurte(nx, nz, ny)) {             // s'écrase sur un mur, ou sur un meuble assez haut
            etat[i] = 0;
            eclabousser(px[i], py[i], pz[i], -vx[i] * 0.25, -vz[i] * 0.25);
            if (opt.impact) opt.impact(colliders[touche], px[i], py[i], pz[i]);
          } else { px[i] = nx; py[i] = ny; pz[i] = nz; }
        }
        if (age[i] > 3) etat[i] = 0;
      }
      if (touches) {
        if (arrose <= 0 && opt.surSoi) opt.surSoi(api);
        arrose = 1;
        mouille = Math.min(1, mouille + touches * 0.02);
      } else { arrose -= dt; mouille = Math.max(0, mouille - dt * 0.22); }
      for (i = 0; i < NE; i++) {
        if (el[i] <= 0) continue;
        ea[i] += dt; ev[i] -= G * dt;
        ex[i] += eu[i] * dt; ey[i] += ev[i] * dt; ez[i] += ew[i] * dt;
        if (ea[i] > el[i] || ey[i] < SOL) el[i] = 0;
      }
      for (i = 0; i < NF; i++) {
        if (fr[i] <= 0) continue;
        frepos[i] += dt;
        if (frepos[i] > SECHE) { fr[i] -= dt * 0.015; if (fr[i] < 0.008) fr[i] = 0; }
      }
    }

    /* ---------- Dessin ---------- */
    var pion = new T3.Object3D(), ZERO = new T3.Matrix4().makeScale(0, 0, 0);
    var cx = new Float32Array(NJ + 1), cy = new Float32Array(NJ + 1), cz = new Float32Array(NJ + 1);
    var ca = new Float32Array(NJ + 1), cb = new Uint8Array(NJ + 1), bord = new Float32Array((NJ + 1) * 6);

    function dessinerGouttes() {
      var i;
      pion.quaternion.copy(cam.quaternion);
      for (i = 0; i < NJ; i++) {
        if (etat[i] !== 1 || age[i] < R.jusqua) { gouttes.setMatrixAt(i, ZERO); continue; }
        pion.position.set(px[i], py[i], pz[i]);
        pion.scale.setScalar(R.goutte); pion.updateMatrix(); gouttes.setMatrixAt(i, pion.matrix);
      }
      for (i = 0; i < NE; i++) {
        if (el[i] <= 0) { gouttes.setMatrixAt(NJ + i, ZERO); continue; }
        pion.position.set(ex[i], ey[i], ez[i]);
        pion.scale.setScalar(R.eclat * (1 - 0.5 * ea[i] / el[i])); pion.updateMatrix(); gouttes.setMatrixAt(NJ + i, pion.matrix);
      }
      gouttes.instanceMatrix.needsUpdate = true;
    }

    function dessinerFilet() {
      // 1. La chaîne des points du filet, de la plus ancienne goutte à la zone pipi
      var n = 0, rupture = true, k, i, j;
      for (k = 0; k < NJ; k++) {
        i = (tete + k) % NJ;
        if (!etat[i] || age[i] > R.jusqua) { rupture = true; continue; }
        cx[n] = px[i]; cy[n] = py[i]; cz[n] = pz[i]; ca[n] = age[i];
        cb[n] = rupture || coupe[i] ? 1 : 0; rupture = false; n++;
      }
      if (pression > 0.02 && n && !rupture && !serie) { cx[n] = ox; cy[n] = oy; cz[n] = oz; ca[n] = 0; cb[n] = 0; n++; }
      for (j = 1; j < n; j++) {
        var ex0 = cx[j] - cx[j - 1], ey0 = cy[j] - cy[j - 1], ez0 = cz[j] - cz[j - 1];
        if (ex0 * ex0 + ey0 * ey0 + ez0 * ez0 > 0.12) cb[j] = 1;
      }
      // 2. Chaque bande : deux bords de part et d'autre de la chaîne, tournés vers la caméra
      var C = cam.position;
      bandes.forEach(function (B) {
        var pos = B.mesh.geometry.attributes.position, P = pos.array, v = 0;
        for (j = 0; j < n; j++) {
          var a = j > 0 && !cb[j] ? j - 1 : j, b = j < n - 1 && !cb[j + 1] ? j + 1 : j;
          var tx = cx[b] - cx[a], ty = cy[b] - cy[a], tz = cz[b] - cz[a];
          var ux = C.x - cx[j], uy = C.y - cy[j], uz = C.z - cz[j], ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
          ux /= ul; uy /= ul; uz /= ul;
          var sx = ty * uz - tz * uy, sy = tz * ux - tx * uz, sz = tx * uy - ty * ux, sl = Math.sqrt(sx * sx + sy * sy + sz * sz);
          if (sl < 1e-6) { sx = 1; sy = 0; sz = 0; sl = 1; }
          sx /= sl; sy /= sl; sz /= sl;
          var w = B.l / 2 * (1 - 0.5 * Math.min(1, ca[j] / R.jusqua));
          var mx = cx[j] + sx * B.cote + ux * B.dz, my = cy[j] + sy * B.cote + uy * B.dz, mz = cz[j] + sz * B.cote + uz * B.dz;
          bord[j * 6] = mx + sx * w; bord[j * 6 + 1] = my + sy * w; bord[j * 6 + 2] = mz + sz * w;
          bord[j * 6 + 3] = mx - sx * w; bord[j * 6 + 4] = my - sy * w; bord[j * 6 + 5] = mz - sz * w;
        }
        function sommet(j, cote) { P[v * 3] = bord[j * 6 + cote * 3]; P[v * 3 + 1] = bord[j * 6 + cote * 3 + 1]; P[v * 3 + 2] = bord[j * 6 + cote * 3 + 2]; v++; }
        for (j = 1; j < n; j++) {
          if (cb[j]) continue;
          sommet(j - 1, 0); sommet(j - 1, 1); sommet(j, 0);
          sommet(j - 1, 1); sommet(j, 1); sommet(j, 0);
        }
        B.mesh.geometry.setDrawRange(0, v);
        pos.needsUpdate = true;
      });
    }

    function dessinerFlaques() {
      pion.quaternion.set(0, 0, 0, 1);
      couches.forEach(function (c) {
        for (var i = 0; i < NF; i++) {
          if (fr[i] <= 0) { c.mesh.setMatrixAt(i, ZERO); continue; }
          pion.position.set(fx[i], c.y, fz[i]);
          pion.scale.set(fr[i] * c.k, 1, fr[i] * c.k); pion.updateMatrix(); c.mesh.setMatrixAt(i, pion.matrix);
        }
        c.mesh.instanceMatrix.needsUpdate = true;
      });
    }

    var api = {
      groupe: groupe, reglages: R,
      ouvrir: function () { if (!ouvert) { ouvert = true; duree = 0; regard = 0.5; } aFermer = false; return api; },
      // Le jet dure au moins une demi-seconde, même sur un appui bref.
      fermer: function () { if (ouvert) { if (duree >= 0.5) ouvert = false; else aFermer = true; } return api; },
      ouvert: function () { return ouvert; },
      mouille: function () { return mouille; },
      tir: function () { return tir; },                             // pour les réglages : pente (rad), force (m/s) et point visé du dernier tir
      nettoyer: function () { for (var i = 0; i < NF; i++) fr[i] = 0; return api; },
      // R maintenu = pipi.
      clavier: function () {
        window.addEventListener('keydown', function (e) { if (e.code === 'KeyR' && !e.repeat) api.ouvrir(); });
        window.addEventListener('keyup', function (e) { if (e.code === 'KeyR') api.fermer(); });
        window.addEventListener('blur', function () { api.fermer(); });
        return api;
      },
      maj: function (dt, joueur) {
        simuler(dt, joueur);
        dessinerGouttes(); dessinerFilet(); dessinerFlaques();
      }
    };
    return api;
  }

  return { creer: creer, reglages: R };
})();
