/**
 * ETA Oillic – bloc « Traitement phytosanitaire » des bons (page chauffeur, planning, gestion)
 * Version 1.2 – 2026-10-26
 *
 * Informations du registre (arrêté du 24 décembre 2025, annexes I et II) et du référentiel d'agrément :
 * matériel (pulvérisateur ou semoir à microgranulés), culture, production bio, horaires,
 * une ou plusieurs parcelles (nom, surface, position GPS relevée sur place ou choisie sur la carte),
 * quantité totale de bouillie (pulvérisateur), produits avec QUANTITÉ TOTALE (dose/ha calculée),
 * n° AMM (peut être complété plus tard au bureau), stade BBCH (liste céréales), cible, rentrée anticipée.
 *
 * Utilisation :
 *   var bloc = Phyto.monter(conteneur, { bouton: 'secondaire', gps: true });
 *     bloc.remplir(objet | null) ; bloc.lire() → objet ; bloc.verifier() → '' ou message bloquant ;
 *     bloc.manques() → ce qui reste à compléter au bureau (AMM, position) ; bloc.proposerSurface(ha) ;
 *     bloc.utiliserParcelles(liste | null) : parcelles saisies ailleurs (bloc SARL) au lieu des siennes.
 *   var liste = Phyto.parcelles(conteneur, { bouton, gps, codes: function () { return [{code, libelle}] } });
 *     liste parcelles réutilisable : nom libre ou code de parcelle SARL, surface, position (si affichée).
 * Carte : photos aériennes IGN (Géoplateforme, service gratuit sans clé), Leaflet chargé à la demande.
 */
(function () {
  var UNITES = ['L', 'mL', 'kg', 'g'];
  var MATERIELS = [['pulverisateur', 'Pulvérisateur'], ['semoir', 'Semoir (microgranulés au semis)']];
  var CULTURES = ['Interculture', 'Blé', 'Orge', 'Triticale', 'Maïs', 'Tournesol', 'Pois']; // + « Autre » (saisie libre)
  var CEREALES = [ // BBCH céréales (blé, orge, triticale) – même liste que Phyto.gs
    ['00', 'Semence sèche'], ['09', 'Levée : le coléoptile perce le sol'], ['10', 'Sortie de la 1re feuille'],
    ['11', '1re feuille étalée'], ['12', '2 feuilles étalées'], ['13', '3 feuilles étalées'],
    ['21', 'Début tallage : 1 talle'], ['22', '2 talles'], ['23', '3 talles'], ['25', '5 talles'], ['29', 'Fin tallage'],
    ['30', 'Épi 1 cm (début montaison)'], ['31', '1 nœud'], ['32', '2 nœuds'], ['33', '3 nœuds'],
    ['37', 'Apparition de la dernière feuille'], ['39', 'Ligule de la dernière feuille visible'],
    ['41', 'Début gonflement'], ['45', 'Gonflement'], ['47', 'Gaine de la dernière feuille entrouverte'],
    ['49', 'Premières barbes visibles'], ['51', 'Début épiaison'], ['55', 'Mi-épiaison'], ['59', 'Fin épiaison'],
    ['61', 'Début floraison'], ['65', 'Pleine floraison'], ['69', 'Fin floraison'],
    ['71', 'Grain aqueux'], ['73', 'Début laiteux'], ['75', 'Grain laiteux'], ['77', 'Fin laiteux'],
    ['83', 'Début pâteux'], ['85', 'Pâteux mou'], ['87', 'Pâteux dur'], ['89', 'Maturité complète'], ['92', 'Grain dur, sur-maturité']
  ];
  var BBCH = { // par culture – mêmes listes que Phyto.gs
    'Blé': CEREALES, 'Orge': CEREALES, 'Triticale': CEREALES,
    'Maïs': [['00', 'Semence sèche'], ['09', 'Levée : le coléoptile perce le sol'], ['10', '1re feuille sortie du coléoptile'],
      ['11', '1 feuille étalée'], ['12', '2 feuilles étalées'], ['13', '3 feuilles étalées'], ['14', '4 feuilles étalées'],
      ['15', '5 feuilles étalées'], ['16', '6 feuilles étalées'], ['17', '7 feuilles étalées'], ['18', '8 feuilles étalées'],
      ['19', '9 feuilles étalées ou plus'], ['30', 'Début élongation de la tige'], ['31', '1 nœud'], ['32', '2 nœuds'],
      ['33', '3 nœuds'], ['39', '9 nœuds ou plus'], ['51', 'Début sortie de la panicule'], ['55', 'Mi-sortie de la panicule'],
      ['59', 'Panicule entièrement sortie'], ['61', 'Début floraison mâle'], ['63', 'Début émission du pollen'],
      ['65', 'Floraison femelle : soies visibles'], ['67', 'Soies en dessèchement'], ['69', 'Fin floraison'],
      ['71', 'Grain aqueux'], ['73', 'Début laiteux'], ['75', 'Grain laiteux'], ['83', 'Début pâteux'],
      ['85', 'Grain pâteux'], ['87', 'Maturité physiologique (point noir)'], ['89', 'Maturité complète']],
    'Tournesol': [['00', 'Semence sèche'], ['09', 'Levée'], ['10', 'Cotylédons étalés'], ['12', '2 feuilles étalées'],
      ['14', '4 feuilles étalées'], ['16', '6 feuilles étalées'], ['18', '8 feuilles étalées'], ['19', '9 feuilles étalées ou plus'],
      ['30', 'Début élongation de la tige'], ['51', 'Bouton floral visible (stade étoile)'], ['53', 'Bouton séparé des jeunes feuilles'],
      ['55', 'Bouton nettement séparé des feuilles'], ['59', 'Fleurs ligulées visibles, capitule fermé'], ['61', 'Début floraison'],
      ['63', 'Floraison : 30 % des fleurons'], ['65', 'Pleine floraison'], ['69', 'Fin floraison'], ['71', 'Début formation des graines'],
      ['75', 'Dos du capitule vert-jaune'], ['81', 'Début maturation : dos du capitule jaune'], ['85', 'Bractées brunes'],
      ['89', 'Maturité complète']],
    'Pois': [['00', 'Semence sèche'], ['09', 'Levée'], ['10', '1re paire de feuilles écailleuses'], ['11', '1re feuille étalée'],
      ['12', '2 feuilles étalées'], ['13', '3 feuilles étalées'], ['14', '4 feuilles étalées'], ['15', '5 feuilles étalées'],
      ['16', '6 feuilles étalées'], ['19', '9 feuilles étalées ou plus'], ['30', 'Début élongation de la tige'],
      ['51', 'Boutons floraux visibles hors des feuilles'], ['55', 'Premiers boutons floraux séparés'], ['59', 'Premiers pétales visibles'],
      ['61', 'Début floraison'], ['65', 'Pleine floraison'], ['69', 'Fin floraison'], ['71', '10 % des gousses à taille finale'],
      ['75', '50 % des gousses à taille finale'], ['79', 'Gousses à taille finale, grains formés'], ['81', 'Début maturation'],
      ['85', 'Gousses sèches, grains durs'], ['89', 'Maturité complète']]
  };
  var MAX_PRODUITS = 6, MAX_PARCELLES = 30;
  var LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
  var TUILES = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM'
    + '&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&LAYER=';
  var CENTRE = [47.68, -2.85]; // Morbihan, si aucune position connue
  var n = 0;

  var CSS = '.ph-grille{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}'
    + '.ph-large{grid-column:1/-1}'
    + '.ph-bio{display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin:0 0 14px;font-weight:700}'
    + '.ph-bio label{display:flex;align-items:center;gap:6px;font-weight:400;margin:0}'
    + '.ph-bio input{width:22px;height:22px;margin:0}'
    + '.ph-titre{font-weight:700;margin:14px 0 4px;display:flex;justify-content:space-between;gap:8px;align-items:baseline}'
    + '.ph-titre small{font-weight:400;color:var(--doux)}'
    + '.ph-item{border-top:1px dashed var(--trait);padding-top:10px;margin-top:6px}'
    + '.ph-item-tete{display:flex;justify-content:space-between;align-items:center;font-weight:700;margin-bottom:4px}'
    + '.ph-retirer{background:none;border:0;color:var(--rouge);font-weight:700;text-decoration:underline;padding:6px 4px;cursor:pointer}'
    + '.ph-boutons-pos{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 4px}'
    + '.ph-pos{display:block;margin:4px 0 10px;font-size:.93em}'
    + '.ph-alerte{color:var(--rouge);font-weight:700}'
    + '.ph-calcul{display:block;margin:2px 0 10px;font-size:.93em;color:var(--doux)}'
    + '.ph-pos-masque .ph-boutons-pos,.ph-pos-masque .ph-pos{display:none}'
    + '.ph-plus{margin-top:12px}.ph-plus summary{cursor:pointer;font-weight:700;padding:6px 0}'
    + '.ph-note{color:var(--doux);font-size:.9em;font-weight:400}'
    + '.ph-paire{display:flex;gap:8px;align-items:stretch}.ph-paire input{flex:1 1 auto;min-width:0;width:auto!important}.ph-paire select{flex:none;width:auto!important}'
    + '.ph-carte-fond{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center}'
    + '.ph-carte-fen{background:var(--surface);color:var(--encre);border-radius:12px;width:min(900px,96vw);height:min(720px,92vh);display:flex;flex-direction:column;overflow:hidden}'
    + '.ph-carte-tete{display:flex;gap:8px;align-items:center;padding:10px;flex-wrap:wrap}'
    + '.ph-carte-tete input{flex:1;min-width:140px;padding:8px;border:1px solid var(--trait);border-radius:8px;font:inherit}'
    + '.ph-carte-tete button,.ph-carte-pied button{padding:8px 14px;border-radius:8px;border:1px solid var(--trait);background:var(--surface);color:var(--encre);font:inherit;font-weight:700;cursor:pointer}'
    + '.ph-carte-tete .ph-res{flex-basis:100%;display:flex;flex-direction:column}'
    + '.ph-carte-tete .ph-res button{text-align:left;border:0;border-bottom:1px solid var(--trait);border-radius:0;font-weight:400}'
    + '.ph-carte-zone{flex:1;min-height:200px}'
    + '.ph-carte-pied{display:flex;gap:8px;align-items:center;padding:10px;flex-wrap:wrap}'
    + '.ph-carte-pied .ph-ok{background:var(--vert);color:var(--sur-vert,#fff);border-color:var(--vert)}'
    + '.ph-carte-pied span{flex:1;font-size:.93em}'
    + '@media (max-width:420px){.ph-grille{grid-template-columns:1fr}}';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nombre(t) {
    var v = String(t == null ? '' : t).trim().replace(/\s/g, '').replace(',', '.');
    return v === '' || isNaN(Number(v)) ? NaN : Number(v);
  }
  function fr(x) { return x === '' || x == null || (typeof x === 'number' && isNaN(x)) ? '' : String(x).replace('.', ','); }
  function arrondi(x, d) { var k = Math.pow(10, d); return Math.round(x * k) / k; }
  function injecterCss() {
    if (document.getElementById('phyto-css')) return;
    var s = document.createElement('style'); s.id = 'phyto-css'; s.textContent = CSS;
    document.head.appendChild(s);
  }
  function options(liste, choisi) {
    return liste.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (x[0] === choisi ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('');
  }

  // ------------------------------------------------------------ Carte (Leaflet + photos aériennes IGN)
  var chargementLeaflet = null;
  function chargerLeaflet() {
    if (window.L) return Promise.resolve();
    if (chargementLeaflet) return chargementLeaflet;
    chargementLeaflet = new Promise(function (ok, ko) {
      var c = document.createElement('link'); c.rel = 'stylesheet'; c.href = LEAFLET + 'leaflet.min.css'; document.head.appendChild(c);
      var s = document.createElement('script'); s.src = LEAFLET + 'leaflet.min.js';
      s.onload = function () { ok(); };
      s.onerror = function () { chargementLeaflet = null; ko(new Error('Carte indisponible : vérifiez la connexion.')); };
      document.head.appendChild(s);
    });
    return chargementLeaflet;
  }

  /** Ouvre la carte ; renvoie une promesse {lat, lon} (ou null si annulé). */
  function choisirSurCarte(hote, depart, autres) {
    return chargerLeaflet().then(function () {
      return new Promise(function (fin) {
        var fond = document.createElement('div');
        fond.className = 'ph-carte-fond';
        fond.innerHTML = '<div class="ph-carte-fen" role="dialog" aria-label="Choisir la parcelle sur la carte">'
          + '<div class="ph-carte-tete"><input type="search" class="ph-cherche" placeholder="Commune ou lieu-dit (ex. Theix-Noyalo, Kerlann)">'
          + '<button type="button" class="ph-chercher">Chercher</button><div class="ph-res"></div></div>'
          + '<div class="ph-carte-zone"></div>'
          + '<div class="ph-carte-pied"><span class="ph-info">Cliquez au milieu de la parcelle traitée.</span>'
          + '<button type="button" class="ph-annuler">Annuler</button><button type="button" class="ph-ok" disabled>Valider cette position</button></div></div>';
        hote.appendChild(fond);
        var q = function (c) { return fond.querySelector(c); };
        var ortho = L.tileLayer(TUILES + 'ORTHOIMAGERY.ORTHOPHOTOS&FORMAT=image/jpeg', { maxZoom: 19, attribution: '© IGN' });
        var plan = L.tileLayer(TUILES + 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&FORMAT=image/png', { maxZoom: 19, attribution: '© IGN' });
        var carte = L.map(q('.ph-carte-zone'), { layers: [ortho] });
        L.control.layers({ 'Photos aériennes': ortho, 'Plan IGN': plan }).addTo(carte);
        (autres || []).forEach(function (a) {
          L.circleMarker([a.lat, a.lon], { radius: 6, color: '#F0A92B', weight: 2 }).addTo(carte).bindTooltip(esc(a.nom || 'Autre parcelle'));
        });
        var choix = null, marque = null;
        function placer(lat, lon) {
          choix = { lat: arrondi(lat, 5), lon: arrondi(lon, 5) };
          if (marque) marque.setLatLng([lat, lon]); else marque = L.marker([lat, lon]).addTo(carte);
          q('.ph-ok').disabled = false;
          q('.ph-info').textContent = 'Position : ' + fr(choix.lat) + ' ; ' + fr(choix.lon);
        }
        if (depart) { carte.setView([depart.lat, depart.lon], 16); placer(depart.lat, depart.lon); }
        else if (autres && autres.length) carte.setView([autres[0].lat, autres[0].lon], 15);
        else carte.setView(CENTRE, 11);
        setTimeout(function () { carte.invalidateSize(); }, 50);
        carte.on('click', function (e) { placer(e.latlng.lat, e.latlng.lng); });

        function chercher() {
          var t = q('.ph-cherche').value.trim(); if (!t) return;
          q('.ph-res').textContent = 'Recherche…';
          fetch('https://data.geopf.fr/geocodage/search?limit=5&q=' + encodeURIComponent(t))
            .then(function (r) { return r.json(); })
            .then(function (j) {
              var f = (j.features || []);
              q('.ph-res').innerHTML = f.length ? '' : 'Aucun résultat.';
              f.forEach(function (x) {
                var b = document.createElement('button'); b.type = 'button';
                b.textContent = x.properties.label + (x.properties.context ? ' (' + x.properties.context + ')' : '');
                b.onclick = function () {
                  carte.setView([x.geometry.coordinates[1], x.geometry.coordinates[0]], x.properties.type === 'municipality' ? 14 : 16);
                  q('.ph-res').innerHTML = '';
                };
                q('.ph-res').appendChild(b);
              });
            })
            .catch(function () { q('.ph-res').textContent = 'Recherche indisponible : déplacez la carte à la main.'; });
        }
        q('.ph-chercher').onclick = chercher;
        q('.ph-cherche').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); chercher(); } };
        function fermer(v) { carte.remove(); fond.remove(); fin(v); }
        q('.ph-annuler').onclick = function () { fermer(null); };
        q('.ph-ok').onclick = function () { fermer(choix); };
      });
    });
  }

  // ------------------------------------------------------------ Liste de parcelles (bloc phyto ou bloc SARL)
  function parcelles(conteneur, o) {
    o = o || {};
    injecterCss();
    var bt = o.bouton || 'secondaire', max = o.max || MAX_PARCELLES, avecPos = o.positions !== false;
    var hote = conteneur.closest('dialog') || document.body;
    conteneur.innerHTML = '<div class="ph-liste-parcelles"></div><button type="button" class="' + bt + ' ph-ajout-parcelle">Ajouter une parcelle</button>'
      + '<small class="ph-total ph-note" style="display:block;margin-top:6px"></small>';
    var zone = conteneur.querySelector('.ph-liste-parcelles');
    var qa = function (c) { return Array.prototype.slice.call(zone.querySelectorAll(c)); };
    var changement = function () { if (o.surChangement) o.surChangement(); };

    function surfaceTotale() {
      return arrondi(qa('.ph-parcelle').reduce(function (s, d) { var v = nombre(d.querySelector('.ph-surface').value); return s + (v > 0 ? v : 0); }, 0), 4);
    }
    function maj() {
      var l = qa('.ph-parcelle');
      l.forEach(function (d, i) {
        d.querySelector('.ph-num').textContent = l.length > 1 ? 'Parcelle ' + (i + 1) : 'Parcelle';
        d.querySelector('.ph-retirer-parcelle').hidden = l.length <= 1;
      });
      conteneur.querySelector('.ph-ajout-parcelle').hidden = l.length >= max;
      conteneur.querySelector('.ph-total').textContent = l.length > 1 ? 'Surface totale : ' + fr(surfaceTotale()) + ' ha'
        + (o.codes ? ' – quantités et heures réparties entre les parcelles au prorata des surfaces' : '') : '';
      conteneur.classList.toggle('ph-pos-masque', !avecPos);
    }
    function afficherPos(d) {
      var p = d._pos || {}, el = d.querySelector('.ph-pos');
      if (p.lat === undefined || p.lat === '' || p.lat === null) {
        el.className = 'ph-pos ph-alerte';
        el.textContent = 'Position non renseignée' + (o.gps ? ' : relevez-la sur la parcelle, ou le bureau la placera sur la carte.' : ' : placez-la sur la carte.');
        return;
      }
      var lien = 'https://www.openstreetmap.org/?mlat=' + p.lat + '&mlon=' + p.lon + '#map=17/' + p.lat + '/' + p.lon;
      var imprecis = p.precision !== '' && p.precision !== undefined && Number(p.precision) > 50;
      el.className = 'ph-pos' + (imprecis ? ' ph-alerte' : '');
      el.innerHTML = 'Position : ' + esc(fr(p.lat)) + ' ; ' + esc(fr(p.lon))
        + (p.origine === 'Carte' ? ' (placée sur la carte)' : p.precision !== '' && p.precision !== undefined ? ' (GPS, précision ' + esc(p.precision) + ' m' + (imprecis ? ' : à relever à nouveau' : '') + ')' : '')
        + ' – <a href="' + lien + '" target="_blank" rel="noopener">voir</a>';
    }
    function optionsCodes(choisi) {
      return '<option value="">Choisir la parcelle</option>' + (o.codes() || []).map(function (p) {
        return '<option value="' + esc(p.code) + '"' + (p.code === choisi ? ' selected' : '') + '>' + esc(p.libelle || p.code) + '</option>';
      }).join('');
    }
    function ajouter(x) {
      x = x || {};
      var d = document.createElement('div');
      d.className = 'ph-item ph-parcelle';
      d.innerHTML = '<div class="ph-item-tete"><span class="ph-num"></span><button type="button" class="ph-retirer ph-retirer-parcelle">Retirer</button></div>'
        + '<div class="ph-grille">'
        + (o.codes ? '<label>Parcelle (îlot PAC)<select class="ph-code">' + optionsCodes(x.code) + '</select></label>'
          : '<label>Nom de la parcelle<input type="text" class="ph-nom-parcelle" maxlength="80" autocomplete="off" placeholder="ex. Grand champ"></label>')
        + '<label>Surface (ha)<input type="text" inputmode="decimal" class="ph-surface" autocomplete="off"></label></div>'
        + '<div class="ph-boutons-pos">'
        + (o.gps ? '<button type="button" class="' + bt + ' ph-gps">Ma position</button>' : '')
        + '<button type="button" class="' + bt + ' ph-carte">Choisir sur la carte</button></div>'
        + '<span class="ph-pos"></span>';
      if (!o.codes) d.querySelector('.ph-nom-parcelle').value = x.nom || '';
      d.querySelector('.ph-surface').value = fr(x.surface);
      d._pos = { lat: x.lat === undefined || x.lat === null ? '' : x.lat, lon: x.lon === undefined || x.lon === null ? '' : x.lon,
        precision: x.precision === undefined ? '' : x.precision, origine: x.origine || '' };
      zone.appendChild(d);
      afficherPos(d); maj();
    }
    function nomDe(d) {
      if (!o.codes) return d.querySelector('.ph-nom-parcelle').value.trim();
      var s = d.querySelector('.ph-code'); return s.value ? s.options[s.selectedIndex].text : '';
    }
    function autresPositions(sauf) {
      return qa('.ph-parcelle').filter(function (d) { return d !== sauf && d._pos && d._pos.lat !== ''; })
        .map(function (d) { return { lat: Number(d._pos.lat), lon: Number(d._pos.lon), nom: nomDe(d) }; });
    }
    zone.addEventListener('click', function (e) {
      var d = e.target.closest('.ph-parcelle'); if (!d) return;
      if (e.target.classList.contains('ph-retirer-parcelle')) { d.remove(); maj(); changement(); return; }
      if (e.target.classList.contains('ph-carte')) {
        var dep = d._pos.lat !== '' ? { lat: Number(d._pos.lat), lon: Number(d._pos.lon) } : null;
        choisirSurCarte(hote, dep, autresPositions(d)).then(function (c) {
          if (!c) return;
          d._pos = { lat: c.lat, lon: c.lon, precision: '', origine: 'Carte' }; afficherPos(d); changement();
        }).catch(function (err) { var el = d.querySelector('.ph-pos'); el.className = 'ph-pos ph-alerte'; el.textContent = err.message; });
      }
      if (e.target.classList.contains('ph-gps')) {
        var b = e.target, el = d.querySelector('.ph-pos');
        if (!navigator.geolocation) { el.className = 'ph-pos ph-alerte'; el.textContent = 'Ce téléphone ne donne pas sa position.'; return; }
        b.disabled = true; b.textContent = 'Recherche…';
        navigator.geolocation.getCurrentPosition(function (p) {
          b.disabled = false; b.textContent = 'Ma position';
          d._pos = { lat: arrondi(p.coords.latitude, 5), lon: arrondi(p.coords.longitude, 5), precision: Math.round(p.coords.accuracy), origine: 'GPS' };
          afficherPos(d); changement();
        }, function (err) {
          b.disabled = false; b.textContent = 'Ma position';
          el.className = 'ph-pos ph-alerte';
          el.textContent = err.code === 1 ? 'Position refusée : autorisez la localisation dans les réglages du téléphone.'
            : 'Position introuvable : réessayez en extérieur, ou choisissez sur la carte.';
        }, { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 });
      }
    });
    zone.addEventListener('input', function () { maj(); changement(); });
    zone.addEventListener('change', function () { maj(); changement(); });
    conteneur.querySelector('.ph-ajout-parcelle').onclick = function () { ajouter(); changement(); };

    var liste = {
      remplir: function (l) {
        zone.innerHTML = '';
        (l && l.length ? l : [{}]).forEach(ajouter);
        maj();
      },
      /** Rafraîchit la liste des codes (référentiel chargé après coup) en gardant les choix. */
      rafraichirCodes: function () {
        if (!o.codes) return;
        qa('.ph-code').forEach(function (s) { var v = s.value; s.innerHTML = optionsCodes(v); s.value = v; });
      },
      lire: function () {
        return qa('.ph-parcelle').map(function (d) {
          return { code: o.codes ? d.querySelector('.ph-code').value : '', nom: nomDe(d),
            surface: d.querySelector('.ph-surface').value.trim(),
            lat: d._pos.lat === '' ? '' : String(d._pos.lat), lon: d._pos.lon === '' ? '' : String(d._pos.lon),
            precision: d._pos.precision, origine: d._pos.origine };
        });
      },
      /** surfaces : surfaces obligatoires (traitement phyto, ou plusieurs parcelles à répartir). */
      verifier: function (surfaces) {
        var l = liste.lire();
        for (var i = 0; i < l.length; i++) {
          var t = (l.length > 1 ? 'Parcelle ' + (i + 1) : 'Parcelle') + ' : ';
          if (o.codes && !l[i].code) return t + 'choisissez la parcelle.';
          if ((surfaces || l.length > 1) && !(nombre(l[i].surface) > 0)) return t + 'indiquez la surface (ha)' + (l.length > 1 ? ' pour répartir les quantités.' : '.');
          if (l[i].surface && !(nombre(l[i].surface) > 0)) return t + 'surface invalide.';
        }
        return '';
      },
      sansPosition: function () { return liste.lire().filter(function (p) { return p.lat === '' || p.lon === ''; }).length; },
      surfaceTotale: surfaceTotale,
      nombre: function () { return qa('.ph-parcelle').length; },
      afficherPositions: function (oui) { avecPos = !!oui; maj(); },
      limiter: function (n) { max = n || o.max || MAX_PARCELLES; qa('.ph-parcelle').slice(max).forEach(function (d) { d.remove(); }); maj(); },
      proposerSurface: function (ha) {
        var l = qa('.ph-parcelle');
        if (l.length === 1 && !l[0].querySelector('.ph-surface').value && ha > 0) { l[0].querySelector('.ph-surface').value = fr(ha); maj(); changement(); }
      }
    };
    liste.remplir(null);
    return liste;
  }

  // ------------------------------------------------------------ Bloc « Traitement phytosanitaire »
  function monter(conteneur, o) {
    o = o || {};
    injecterCss();
    var id = 'ph' + (++n);
    var bt = o.bouton || 'secondaire';
    conteneur.innerHTML =
        '<div class="ph-grille">'
      + '<label class="ph-large">Matériel utilisé<select class="ph-materiel">' + options(MATERIELS, 'pulverisateur') + '</select></label>'
      + '<label>Culture traitée<select class="ph-culture-liste"><option value="">Choisir la culture</option>'
      + CULTURES.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '<option value="autre">Autre culture</option></select></label>'
      + '<label class="ph-culture-autre-l" hidden>Nom de la culture<input type="text" class="ph-culture-autre" maxlength="100" autocomplete="off" placeholder="ex. colza, féverole"></label>'
      + '<label class="ph-bbch-l">Stade de la culture (BBCH)<select class="ph-bbch-liste"></select></label>'
      + '<label class="ph-bbch-autre-l" hidden>Code BBCH (2 chiffres)<input type="text" inputmode="numeric" maxlength="2" class="ph-bbch-autre"></label>'
      + '<label>Heure de début<input type="time" class="ph-debut"></label>'
      + '<label>Heure de fin<input type="time" class="ph-fin"></label>'
      + '</div>'
      + '<div class="ph-bio" role="radiogroup" aria-label="Production biologique">Production biologique (AB) :'
      + '<label><input type="radio" name="' + id + '-bio" value="non"> Non</label>'
      + '<label><input type="radio" name="' + id + '-bio" value="oui"> Oui</label></div>'
      + '<div class="ph-bloc-parcelles"><div class="ph-titre"><span>Parcelles traitées</span></div><div class="ph-parcelles"></div></div>'
      + '<p class="ph-note ph-parcelles-ext" hidden>Parcelles : celles indiquées dans le bloc SARL (surface et position de chacune).</p>'
      + '<div class="ph-bouillie-bloc"><div class="ph-titre"><span>Bouillie</span></div>'
      + '<label>Quantité totale de bouillie épandue (L)<input type="text" inputmode="decimal" class="ph-bouillie" autocomplete="off"></label>'
      + '<span class="ph-calcul ph-bouillie-ha"></span></div>'
      + '<div class="ph-titre"><span>Produits</span><small>quantité totale utilisée ; la dose par hectare est calculée</small></div>'
      + '<div class="ph-produits"></div>'
      + '<button type="button" class="' + bt + ' ph-ajout-produit">Ajouter un produit</button>'
      + '<details class="ph-plus"><summary>Cible, rentrée anticipée</summary>'
      + '<label>Cible <span class="ph-note">(facultatif)</span><input type="text" class="ph-cible" maxlength="100"></label>'
      + '<label>Rentrée anticipée sur la parcelle <span class="ph-note">(moment, motif, protections)</span><input type="text" class="ph-rentree" maxlength="200"></label>'
      + '</details>';

    var q = function (c) { return conteneur.querySelector(c); };
    var qa = function (c) { return Array.prototype.slice.call(conteneur.querySelectorAll(c)); };
    var propres = parcelles(q('.ph-parcelles'), { bouton: bt, gps: o.gps, surChangement: function () { majCalculs(); } });
    var externes = null; // parcelles du bloc SARL, le cas échéant
    function liste() { return externes || propres; }

    function majCalculs() {
      var st = liste().surfaceTotale();
      q('.ph-bouillie-bloc').hidden = q('.ph-materiel').value === 'semoir';
      var b = nombre(q('.ph-bouillie').value);
      q('.ph-bouillie-ha').textContent = b > 0 && st > 0 ? 'soit ' + fr(arrondi(b / st, 1)) + ' L/ha' : '';
      qa('.ph-produit').forEach(function (d) {
        var qte = nombre(d.querySelector('.ph-qte').value), u = d.querySelector('.ph-unite').value;
        d.querySelector('.ph-dose').textContent = qte > 0 && st > 0 ? 'soit ' + fr(arrondi(qte / st, 3)) + ' ' + u + '/ha' : '';
      });
      var np = qa('.ph-produit').length;
      qa('.ph-retirer-produit').forEach(function (x) { x.hidden = np <= 1; });
      q('.ph-ajout-produit').hidden = np >= MAX_PRODUITS;
    }

    // ---- Culture et stade : la liste BBCH dépend de la culture
    function culture() {
      var v = q('.ph-culture-liste').value;
      return v === 'autre' ? q('.ph-culture-autre').value.trim() : v;
    }
    function majStades(choisi) {
      var c = q('.ph-culture-liste').value, l = BBCH[c] || [];
      var sel = q('.ph-bbch-liste');
      sel.innerHTML = '<option value="">Non précisé</option>'
        + l.map(function (b) { return '<option value="' + b[0] + '">' + b[0] + ' – ' + esc(b[1]) + '</option>'; }).join('')
        + '<option value="autre">' + (l.length ? 'Autre code' : 'Saisir un code') + '</option>';
      q('.ph-culture-autre-l').hidden = c !== 'autre';
      q('.ph-bbch-l').hidden = !c;
      var connu = l.some(function (b) { return b[0] === choisi; });
      sel.value = !choisi ? '' : connu ? choisi : 'autre';
      q('.ph-bbch-autre').value = choisi && !connu ? choisi : '';
      q('.ph-bbch-autre-l').hidden = sel.value !== 'autre';
    }
    q('.ph-culture-liste').onchange = function () { majStades(''); };
    q('.ph-bbch-liste').onchange = function () { q('.ph-bbch-autre-l').hidden = q('.ph-bbch-liste').value !== 'autre'; };
    function lireBbch() {
      var v = q('.ph-bbch-liste').value;
      return v === 'autre' ? q('.ph-bbch-autre').value.trim() : v;
    }

    // ---- Produits
    function ajouterProduit(x) {
      x = x || {};
      var d = document.createElement('div');
      d.className = 'ph-item ph-produit';
      d.innerHTML = '<div class="ph-item-tete"><span>Produit</span><button type="button" class="ph-retirer ph-retirer-produit">Retirer</button></div>'
        + '<div class="ph-grille"><label class="ph-large">Nom commercial complet<input type="text" class="ph-nom" maxlength="120" autocomplete="off"></label>'
        + '<label>Quantité totale utilisée<span class="ph-paire"><input type="text" inputmode="decimal" class="ph-qte" autocomplete="off">'
        + '<select class="ph-unite">' + UNITES.map(function (u) { return '<option>' + u + '</option>'; }).join('') + '</select></span></label>'
        + '<label>N° AMM <span class="ph-note">(7 chiffres, peut être complété au bureau)</span><input type="text" inputmode="numeric" maxlength="7" class="ph-amm" autocomplete="off"></label>'
        + '</div><span class="ph-calcul ph-dose"></span>';
      d.querySelector('.ph-nom').value = x.nom || '';
      d.querySelector('.ph-amm').value = x.amm || '';
      d.querySelector('.ph-qte').value = fr(x.quantite);
      d.querySelector('.ph-unite').value = x.unite || 'L';
      q('.ph-produits').appendChild(d);
      majCalculs();
    }
    q('.ph-produits').addEventListener('click', function (e) {
      if (e.target.classList.contains('ph-retirer-produit')) { e.target.closest('.ph-produit').remove(); majCalculs(); }
    });
    q('.ph-ajout-produit').onclick = function () { ajouterProduit(); };
    conteneur.addEventListener('input', majCalculs);
    conteneur.addEventListener('change', majCalculs);

    var bloc = {
      remplir: function (x) {
        x = x || {};
        q('.ph-materiel').value = x.materiel || 'pulverisateur';
        var c = x.culture || '';
        var connue = CULTURES.indexOf(c) >= 0;
        q('.ph-culture-liste').value = !c ? '' : connue ? c : 'autre';
        q('.ph-culture-autre').value = c && !connue ? c : '';
        majStades(x.bbch || '');
        q('.ph-debut').value = x.debut || ''; q('.ph-fin').value = x.fin || '';
        qa('input[name="' + id + '-bio"]').forEach(function (r) { r.checked = r.value === x.bio; });
        q('.ph-bouillie').value = fr(x.bouillie);
        q('.ph-cible').value = x.cible || ''; q('.ph-rentree').value = x.rentree || '';
        q('.ph-plus').open = !!(x.cible || x.rentree);
        propres.remplir(x.parcelles); // même si les parcelles viennent d'ailleurs : prêtes si le bon change de client
        q('.ph-produits').innerHTML = '';
        (x.produits && x.produits.length ? x.produits : [{}]).forEach(ajouterProduit);
        majCalculs();
      },
      lire: function () {
        var bio = conteneur.querySelector('input[name="' + id + '-bio"]:checked');
        var semoir = q('.ph-materiel').value === 'semoir';
        return {
          materiel: q('.ph-materiel').value, culture: culture(),
          debut: q('.ph-debut').value, fin: q('.ph-fin').value, bio: bio ? bio.value : '',
          bouillie: semoir ? '' : q('.ph-bouillie').value.trim(),
          bbch: lireBbch(), cible: q('.ph-cible').value.trim(), rentree: q('.ph-rentree').value.trim(),
          parcelles: liste().lire(),
          produits: qa('.ph-produit').map(function (d) {
            return { nom: d.querySelector('.ph-nom').value.trim(), amm: d.querySelector('.ph-amm').value.replace(/\s/g, ''),
              quantite: d.querySelector('.ph-qte').value.trim(), unite: d.querySelector('.ph-unite').value };
          })
        };
      },
      /** Contrôles bloquants (ce qui ne peut pas attendre le bureau). */
      verifier: function () {
        var x = bloc.lire();
        if (!q('.ph-culture-liste').value) return 'Traitement phyto : choisissez la culture traitée.';
        if (!x.culture) return 'Traitement phyto : indiquez le nom de la culture.';
        if (!x.debut || !x.fin) return 'Traitement phyto : indiquez les heures de début et de fin.';
        if (!x.bio) return 'Traitement phyto : production biologique, oui ou non ?';
        var ep = liste().verifier(true); if (ep) return ep;
        if (x.materiel !== 'semoir' && !(nombre(x.bouillie) > 0)) return 'Traitement phyto : indiquez la quantité totale de bouillie (L).';
        for (var j = 0; j < x.produits.length; j++) {
          var p = x.produits[j], t = 'Produit ' + (j + 1) + ' : ';
          if (!p.nom) return t + 'indiquez le nom commercial complet.';
          if (!(nombre(p.quantite) > 0)) return t + 'indiquez la quantité totale utilisée.';
          if (p.amm && !/^\d{7}$/.test(p.amm)) return t + 'le n° AMM compte 7 chiffres (ou laissez vide pour le bureau).';
        }
        if (x.bbch && !/^\d{2}$/.test(x.bbch)) return 'Stade BBCH : 2 chiffres.';
        return '';
      },
      /** Informations qui pourront être complétées au bureau. */
      manques: function () {
        var x = bloc.lire(), m = [];
        var sansPos = liste().sansPosition();
        var sansAmm = x.produits.filter(function (p) { return !p.amm; }).length;
        if (sansPos) m.push(sansPos > 1 ? sansPos + ' positions de parcelle' : 'la position de la parcelle');
        if (sansAmm) m.push(sansAmm > 1 ? sansAmm + ' n° AMM' : 'le n° AMM');
        return m;
      },
      proposerSurface: function (ha) { liste().proposerSurface(ha); },
      /** Parcelles saisies ailleurs (bloc SARL) : le bloc phyto n'affiche plus les siennes. */
      utiliserParcelles: function (ext) {
        externes = ext || null;
        q('.ph-bloc-parcelles').hidden = !!externes;
        q('.ph-parcelles-ext').hidden = !externes;
        majCalculs();
      },
      recalculer: function () { majCalculs(); }
    };
    bloc.remplir(null);
    return bloc;
  }

  window.Phyto = { monter: monter, parcelles: parcelles, UNITES: UNITES, CULTURES: CULTURES, BBCH: BBCH, choisirSurCarte: choisirSurCarte };
})();
