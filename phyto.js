/**
 * ETA Oillic – bloc « Traitement phytosanitaire » des bons (page chauffeur, planning, gestion)
 * Version 1.5 – 2026-11-05 : prescription partielle acceptée dans la mission (verifierPrescription(…, partielle)) ; 1.4 – 2026-11-03 : matériel proposé (incorporation au semis) ; 1.3 : fiche chantier (avant application / validation / après application / informations client),
 *   catalogue des produits, météo MET Norway
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
    + '.ph-section{border:1px solid var(--trait);border-radius:10px;padding:8px 12px 12px;margin:0 0 12px}'
    + '.ph-section-titre{font-weight:700;font-size:1.08em;margin:2px 0 8px;color:var(--vert)}'
    + '.ph-section-titre small{font-weight:400;color:var(--doux);font-size:.85em}'
    + '.ph-client{background:var(--ambre-pale)}'
    + '.ph-grille-3{grid-template-columns:1fr 1fr 1fr}'
    + '.ph-choix{display:flex;gap:6px 16px;align-items:center;flex-wrap:wrap;margin:10px 0 6px;font-weight:700}'
    + '.ph-choix label{display:flex;align-items:center;gap:6px;font-weight:400;margin:0}'
    + '.ph-choix input{width:22px;height:22px;margin:0}'
    + '.ph-validation{border-top:2px solid var(--vert);margin-top:12px;padding-top:6px}'
    + '.ph-valider-avant{width:100%;margin-top:8px}'
    + '.ph-q{border-top:1px dashed var(--trait);padding-top:8px;margin-top:6px}'
    + '.ph-titre .secondaire,.ph-titre .lien-btn{font-size:.9em}'
    + '@media (max-width:420px){.ph-grille,.ph-grille-3{grid-template-columns:1fr}}';

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

  // ------------------------------------------------------------ Météo (MET Norway, prévision au point de la parcelle)
  /**
   * Conditions à l'heure actuelle au point donné : { vent (km/h), direction, hygro (%), temperature (°C), source }.
   * Service public norvégien (api.met.no, données CC BY 4.0, usage commercial autorisé) : requête simple depuis la page.
   */
  function meteoActuelle(lat, lon) {
    var url = 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=' + Number(lat).toFixed(4) + '&lon=' + Number(lon).toFixed(4);
    return fetch(url).catch(function () { throw new Error('Météo indisponible : vérifiez la connexion.'); })
      .then(function (r) { if (!r.ok) throw new Error('Météo indisponible (code ' + r.status + ').'); return r.json(); })
      .then(function (j) {
        var l = (j.properties && j.properties.timeseries) || [], maintenant = Date.now(), best = null;
        l.forEach(function (x) { var dt = Math.abs(new Date(x.time).getTime() - maintenant); if (!best || dt < best.dt) best = { dt: dt, x: x }; });
        if (!best) throw new Error('Météo indisponible pour ce lieu.');
        var d = best.x.data.instant.details, h = new Date(best.x.time);
        var dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
        return {
          vent: Math.round(d.wind_speed * 3.6), direction: d.wind_from_direction == null ? '' : dirs[Math.round(d.wind_from_direction / 45) % 8],
          hygro: Math.round(d.relative_humidity), temperature: Math.round(d.air_temperature * 10) / 10,
          source: 'Estimation MET Norway (CC BY 4.0) pour ' + String(h.getHours()).padStart(2, '0') + ' h, relevée le '
            + new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        };
      });
  }

  // ------------------------------------------------------------ Bloc « Traitement phytosanitaire » (fiche chantier)
  var CATEGORIES = ['Herbicide', 'Fongicide', 'Insecticide', 'Régulateur', 'Molluscicide'];
  var TRANSMIS = ['Le client', 'L\'ETA'], REMPLISSAGE = ['Au champ', 'Chez le client', 'À l\'ETA'];
  var EVPP = ['Gestion par le client', 'Reprise par l\'ETA'], UNITES_DOSE = ['L/ha', 'mL/ha', 'kg/ha', 'g/ha'];
  var VENT_MAX = 19; // km/h : au-delà de 3 Beaufort, application interdite (arrêté du 4 mai 2017)

  /**
   * o.mode : 'complet' (bon : avant + après application) ou 'prescription' (mission : avant application seulement)
   * o.etapes : téléphone — l'après-application n'apparaît qu'une fois la prescription validée (o.surValiderAvant)
   * o.catalogue() : produits connus [{amm, nom, categorie, doseHomologuee, uniteDose, dar, dre, znt}]
   * o.date() : date du bon 'aaaa-mm-jj' (météo en ligne seulement pour le jour même)
   */
  function monter(conteneur, o) {
    o = o || {};
    injecterCss();
    var id = 'ph' + (++n);
    var bt = o.bouton || 'secondaire';
    var prescription = o.mode === 'prescription';
    var radios = function (nom, liste) {
      return liste.map(function (v) { return '<label><input type="radio" name="' + id + '-' + nom + '" value="' + esc(v) + '"> ' + esc(v) + '</label>'; }).join('');
    };
    var sel = function (cl, liste) { return '<select class="' + cl + '">' + liste.map(function (v) { return '<option>' + esc(v) + '</option>'; }).join('') + '</select>'; };
    conteneur.innerHTML =
        '<datalist id="' + id + '-cat"></datalist>'
      + '<div class="ph-section ph-avant"><div class="ph-section-titre">Avant application<small class="ph-avant-etat"></small></div>'
      + '<div class="ph-grille">'
      + '<label class="ph-large">Matériel d\'application<select class="ph-materiel ph-v">' + options(MATERIELS, 'pulverisateur') + '</select></label>'
      + '<label>Culture<select class="ph-culture-liste ph-v"><option value="">Choisir la culture</option>'
      + CULTURES.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '<option value="autre">Autre culture</option></select></label>'
      + '<label class="ph-culture-autre-l" hidden>Nom de la culture<input type="text" class="ph-culture-autre ph-v" maxlength="100" autocomplete="off" placeholder="ex. colza, féverole"></label>'
      + '<label class="ph-bbch-l">Stade de la culture (BBCH)<select class="ph-bbch-liste ph-v"></select></label>'
      + '<label class="ph-bbch-autre-l" hidden>Code BBCH (2 chiffres)<input type="text" inputmode="numeric" maxlength="2" class="ph-bbch-autre ph-v"></label>'
      + '<label>Catégorie<select class="ph-categorie ph-v"><option value="">Choisir</option>'
      + CATEGORIES.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '<option value="autre">Autre</option></select></label>'
      + '<label class="ph-categorie-autre-l" hidden>Autre catégorie<input type="text" class="ph-categorie-autre ph-v" maxlength="60"></label>'
      + '<label class="ph-large">Cible <span class="ph-note">(parasite, mauvaise herbe, maladie…)</span><input type="text" class="ph-cible ph-v" maxlength="150"></label>'
      + '</div>'
      + '<div class="ph-bio" role="radiogroup" aria-label="Production biologique">Production biologique (AB) :'
      + '<label><input type="radio" class="ph-v" name="' + id + '-bio" value="non"> Non</label>'
      + '<label><input type="radio" class="ph-v" name="' + id + '-bio" value="oui"> Oui</label></div>'
      + '<div class="ph-bloc-parcelles"><div class="ph-titre"><span>Lieu – parcelles concernées</span></div><div class="ph-parcelles"></div></div>'
      + '<p class="ph-note ph-parcelles-ext" hidden>Parcelles : celles indiquées dans le bloc SARL (surface et position de chacune).</p>'
      + '<div class="ph-grille">'
      + '<label>Surface à traiter (ha)<input type="text" inputmode="decimal" class="ph-surface-prevue ph-v" autocomplete="off"></label>'
      + '<label>Spécificités <span class="ph-note">(cours d\'eau, fossé…)</span><input type="text" class="ph-specificites ph-v" maxlength="200"></label>'
      + '</div>'
      + '<div class="ph-titre"><span>Produits à utiliser</span><small>doses par hectare, délais de l\'étiquette</small></div>'
      + '<div class="ph-produits"></div>'
      + '<button type="button" class="' + bt + ' ph-ajout-produit">Ajouter un produit</button>'
      + '<div class="ph-grille" style="margin-top:12px">'
      + '<label>Produit transmis par' + sel('ph-transmis ph-v', TRANSMIS) + '</label>'
      + '<label>Lieu de remplissage' + sel('ph-remplissage ph-v', REMPLISSAGE) + '</label>'
      + '<label>Destination des EVPP' + sel('ph-evpp ph-v', EVPP) + '</label>'
      + '</div>'
      + '<div class="ph-validation">'
      + '<div class="ph-choix" role="radiogroup">Consignes conformes avant application :' + radios('conforme', ['Oui', 'Non']) + '</div>'
      + '<label class="ph-demarches-l" hidden>Non-conformité : démarches prises<textarea class="ph-demarches" maxlength="300" rows="2"></textarea></label>'
      + '<button type="button" class="principal ph-valider-avant" hidden>Valider et démarrer le chantier</button>'
      + '</div></div>'

      + '<div class="ph-section ph-apres"><div class="ph-section-titre">Après application</div>'
      + '<div class="ph-grille">'
      + '<label>Heure de début<input type="time" class="ph-debut"></label>'
      + '<label>Heure de fin<input type="time" class="ph-fin"></label>'
      + '</div>'
      + '<div class="ph-titre"><span>Conditions d\'application</span><button type="button" class="' + bt + ' ph-meteo">Météo actuelle</button></div>'
      + '<div class="ph-grille ph-grille-3">'
      + '<label>Vent (km/h)<input type="text" inputmode="decimal" class="ph-vent" autocomplete="off"></label>'
      + '<label>Direction<input type="text" class="ph-vent-dir" maxlength="20" autocomplete="off" placeholder="ex. SO"></label>'
      + '<label>Hygrométrie (%)<input type="text" inputmode="decimal" class="ph-hygro" autocomplete="off"></label>'
      + '<label>Température (°C)<input type="text" inputmode="decimal" class="ph-temp" autocomplete="off"></label>'
      + '</div><span class="ph-calcul ph-meteo-info"></span>'
      + '<div class="ph-choix" role="radiogroup">Consignes d\'exécution respectées :' + radios('consignes', ['En totalité', 'Partiellement']) + '</div>'
      + '<div class="ph-choix" role="radiogroup">Parcelles traitées = parcelles concernées :' + radios('pconf', ['Oui', 'Non']) + '</div>'
      + '<label class="ph-precisions-l" hidden>Si non, préciser<input type="text" class="ph-precisions" maxlength="300"></label>'
      + '<span class="ph-calcul ph-surface-traitee"></span>'
      + '<div class="ph-bouillie-bloc"><label>Quantité totale de bouillie épandue (L)<input type="text" inputmode="decimal" class="ph-bouillie" autocomplete="off"></label>'
      + '<span class="ph-calcul ph-bouillie-ha"></span></div>'
      + '<div class="ph-titre"><span>Produits utilisés</span><small>quantité totale ; la dose par hectare est calculée</small></div>'
      + '<div class="ph-quantites"></div>'
      + '<button type="button" class="' + bt + ' ph-ajout-non-prevu" hidden>Ajouter un produit non prévu</button>'
      + '<div class="ph-choix" role="radiogroup">Réglementation respectée (transport, application, remplissage…) :' + radios('regl', ['Oui', 'Non']) + '</div>'
      + '<label class="ph-problemes-l">Problèmes rencontrés et mesures prises <span class="ph-note ph-problemes-note">(si besoin)</span><textarea class="ph-problemes" maxlength="500" rows="2"></textarea></label>'
      + '<label>Autres informations sur le chantier réalisé<textarea class="ph-autres" maxlength="500" rows="2"></textarea></label>'
      + '</div>'

      + '<div class="ph-section ph-client"><div class="ph-section-titre">Informations client</div>'
      + '<div class="ph-grille">'
      + '<label>Délai de rentrée (heures)<input type="text" inputmode="decimal" class="ph-delai-rentree" autocomplete="off"></label>'
      + '<label>Délai avant récolte (jours)<input type="text" inputmode="decimal" class="ph-dar" autocomplete="off"></label>'
      + '<label class="ph-large">Zones non traitées<input type="text" class="ph-znt" maxlength="200" autocomplete="off"></label>'
      + '<label class="ph-large">Rentrée anticipée <span class="ph-note">(moment, motif, protections)</span><input type="text" class="ph-rentree" maxlength="200"></label>'
      + '<label class="ph-large">Autres informations pour le client<input type="text" class="ph-infos-client" maxlength="300"></label>'
      + '</div><p class="ph-note">Laissés vides, les délais et la ZNT sont repris des produits (valeur la plus contraignante).</p></div>';

    var q = function (c) { return conteneur.querySelector(c); };
    var qa = function (c) { return Array.prototype.slice.call(conteneur.querySelectorAll(c)); };
    var radio = function (nom) { var r = conteneur.querySelector('input[name="' + id + '-' + nom + '"]:checked'); return r ? r.value : ''; };
    var cocher = function (nom, v) { qa('input[name="' + id + '-' + nom + '"]').forEach(function (r) { r.checked = r.value === v; }); };
    var propres = parcelles(q('.ph-parcelles'), { bouton: bt, gps: o.gps, surChangement: function () { majCalculs(); } });
    var externes = null; // parcelles du bloc SARL, le cas échéant
    function liste() { return externes || propres; }
    var valide = null; // validation avant démarrage enregistrée : { valideAvantLe, conforme, demarches }

    if (prescription) { q('.ph-apres').hidden = true; q('.ph-client').hidden = true; q('.ph-validation').hidden = true; }

    function catalogue() { return (o.catalogue && o.catalogue()) || []; }
    function majCatalogue() {
      q('#' + id + '-cat').innerHTML = catalogue().map(function (c) { return '<option value="' + esc(c.nom) + '">' + esc(c.amm) + '</option>'; }).join('');
    }

    function maxProduits(cle) {
      var m = -1;
      qa('.ph-produit').forEach(function (d) {
        var v = nombre(d.querySelector('.ph-p-' + cle).value);
        var qte = d._q ? nombre(d._q.querySelector('.ph-qte').value) : 1;
        if (!isNaN(v) && (prescription || !(qte === 0)) && v > m) m = v;
      });
      return m;
    }
    function majCalculs() {
      var st = liste().surfaceTotale();
      q('.ph-bouillie-bloc').hidden = q('.ph-materiel').value === 'semoir';
      var b = nombre(q('.ph-bouillie').value);
      q('.ph-bouillie-ha').textContent = b > 0 && st > 0 ? 'soit ' + fr(arrondi(b / st, 1)) + ' L/ha' : '';
      q('.ph-surface-prevue').placeholder = st > 0 ? fr(st) + ' (somme des parcelles)' : '';
      q('.ph-surface-traitee').textContent = st > 0 ? 'Surface traitée : ' + fr(st) + ' ha (somme des parcelles)' : '';
      qa('.ph-produit').forEach(function (d) {
        var qr = d._q; if (!qr) return;
        var nom = d.querySelector('.ph-nom').value.trim();
        qr.querySelector('.ph-q-nom').textContent = (nom || 'Produit sans nom') + (d.getAttribute('data-prevu') === 'Non' ? ' (non prévu)' : '');
        var qte = nombre(qr.querySelector('.ph-qte').value), u = qr.querySelector('.ph-unite').value;
        var dr = nombre(d.querySelector('.ph-p-doseR').value), dh = nombre(d.querySelector('.ph-p-doseH').value);
        var ud = d.querySelector('.ph-p-unite').value, dose = qte > 0 && st > 0 ? arrondi(qte / st, 3) : NaN;
        var t = !isNaN(dose) ? 'soit ' + fr(dose) + ' ' + u + '/ha' : '';
        if (!isNaN(dose) && !isNaN(dh) && ud === u + '/ha' && dose > dh * 1.001) t += ' – au-dessus de la dose homologuée (' + fr(dh) + ' ' + ud + ')';
        else if (!isNaN(dose) && !isNaN(dr) && ud === u + '/ha') t += ' (recommandé : ' + fr(dr) + ' ' + ud + ')';
        var c = qr.querySelector('.ph-dose'); c.textContent = t; c.classList.toggle('ph-alerte', / au-dessus /.test(t));
      });
      var np = qa('.ph-produit').length;
      qa('.ph-retirer-produit').forEach(function (x) { x.hidden = np <= 1 || (verrouille() && x.closest('.ph-produit').getAttribute('data-prevu') === 'Oui'); });
      q('.ph-ajout-produit').hidden = np >= MAX_PRODUITS || verrouille();
      q('.ph-ajout-non-prevu').hidden = np >= MAX_PRODUITS || !verrouille();
      var dre = maxProduits('dre'), dar = maxProduits('dar'), znt = maxProduits('znt');
      q('.ph-delai-rentree').placeholder = dre >= 0 ? 'auto : ' + fr(dre) : '';
      q('.ph-dar').placeholder = dar >= 0 ? 'auto : ' + fr(dar) : '';
      q('.ph-znt').placeholder = znt > 0 ? 'auto : ZNT ' + fr(znt) + ' m' : '';
      q('.ph-demarches-l').hidden = radio('conforme') !== 'Non';
      q('.ph-precisions-l').hidden = radio('pconf') !== 'Non';
      var probleme = radio('consignes') === 'Partiellement' || radio('regl') === 'Non';
      q('.ph-problemes-note').textContent = probleme ? '(obligatoire)' : '(si besoin)';
      var vent = nombre(q('.ph-vent').value);
      var mi = q('.ph-meteo-info');
      if (vent > VENT_MAX) { mi.textContent = '⚠ Vent au-delà de ' + VENT_MAX + ' km/h (3 Beaufort) : application interdite.'; mi.classList.add('ph-alerte'); }
      else { mi.textContent = q('.ph-meteo').getAttribute('data-source') || ''; mi.classList.remove('ph-alerte'); }
    }

    // ---- Culture, stade, catégorie
    function culture() { var v = q('.ph-culture-liste').value; return v === 'autre' ? q('.ph-culture-autre').value.trim() : v; }
    function majStades(choisi) {
      var c = q('.ph-culture-liste').value, l = BBCH[c] || [];
      var s = q('.ph-bbch-liste');
      s.innerHTML = '<option value="">Non précisé</option>'
        + l.map(function (b) { return '<option value="' + b[0] + '">' + b[0] + ' – ' + esc(b[1]) + '</option>'; }).join('')
        + '<option value="autre">' + (l.length ? 'Autre code' : 'Saisir un code') + '</option>';
      q('.ph-culture-autre-l').hidden = c !== 'autre';
      q('.ph-bbch-l').hidden = !c;
      var connu = l.some(function (b) { return b[0] === choisi; });
      s.value = !choisi ? '' : connu ? choisi : 'autre';
      q('.ph-bbch-autre').value = choisi && !connu ? choisi : '';
      q('.ph-bbch-autre-l').hidden = s.value !== 'autre';
    }
    q('.ph-culture-liste').onchange = function () { majStades(''); };
    q('.ph-materiel').addEventListener('change', function () { q('.ph-materiel').setAttribute('data-touche', '1'); });
    q('.ph-bbch-liste').onchange = function () { q('.ph-bbch-autre-l').hidden = q('.ph-bbch-liste').value !== 'autre'; };
    function lireBbch() { var v = q('.ph-bbch-liste').value; return v === 'autre' ? q('.ph-bbch-autre').value.trim() : v; }
    function categorie() { var v = q('.ph-categorie').value; return v === 'autre' ? q('.ph-categorie-autre').value.trim() : v; }
    function poserCategorie(c) {
      var connue = CATEGORIES.indexOf(c) >= 0;
      q('.ph-categorie').value = !c ? '' : connue ? c : 'autre';
      q('.ph-categorie-autre').value = c && !connue ? c : '';
      q('.ph-categorie-autre-l').hidden = q('.ph-categorie').value !== 'autre';
    }
    q('.ph-categorie').onchange = function () { q('.ph-categorie-autre-l').hidden = q('.ph-categorie').value !== 'autre'; };

    // ---- Produits : prescription (avant) + quantité utilisée (après), liés deux à deux
    function ajouterProduit(x, prevu) {
      x = x || {};
      var d = document.createElement('div');
      d.className = 'ph-item ph-produit';
      d.setAttribute('data-prevu', prevu === 'Non' || x.prevu === 'Non' ? 'Non' : 'Oui');
      d.innerHTML = '<div class="ph-item-tete"><span class="ph-p-titre">Produit</span><button type="button" class="ph-retirer ph-retirer-produit">Retirer</button></div>'
        + '<div class="ph-grille"><label class="ph-large">Nom commercial complet<input type="text" class="ph-nom ph-pv" maxlength="120" autocomplete="off" list="' + id + '-cat"></label>'
        + '<label>N° AMM <span class="ph-note">(7 chiffres)</span><input type="text" inputmode="numeric" maxlength="7" class="ph-amm ph-pv" autocomplete="off"></label>'
        + '<label>Unité des doses' + sel('ph-p-unite ph-pv', UNITES_DOSE) + '</label>'
        + '<label>Dose homologuée /ha<input type="text" inputmode="decimal" class="ph-p-doseH ph-pv" autocomplete="off"></label>'
        + '<label>Dose recommandée /ha<input type="text" inputmode="decimal" class="ph-p-doseR ph-pv" autocomplete="off"></label>'
        + '</div><div class="ph-grille ph-grille-3">'
        + '<label>DAR (jours)<input type="text" inputmode="decimal" class="ph-p-dar ph-pv" autocomplete="off"></label>'
        + '<label>DRE (heures)<input type="text" inputmode="decimal" class="ph-p-dre ph-pv" autocomplete="off"></label>'
        + '<label>ZNT (m)<input type="text" inputmode="decimal" class="ph-p-znt ph-pv" autocomplete="off"></label>'
        + '</div>';
      if (d.getAttribute('data-prevu') === 'Non') d.querySelector('.ph-p-titre').textContent = 'Produit non prévu';
      var champs = { '.ph-nom': x.nom, '.ph-amm': x.amm, '.ph-p-doseH': fr(x.doseHomologuee), '.ph-p-doseR': fr(x.doseRecommandee),
        '.ph-p-dar': fr(x.dar), '.ph-p-dre': fr(x.dre), '.ph-p-znt': fr(x.znt) };
      Object.keys(champs).forEach(function (k) { d.querySelector(k).value = champs[k] == null ? '' : champs[k]; });
      d.querySelector('.ph-p-unite').value = x.uniteDose || 'L/ha';
      if (!prescription) {
        var r = document.createElement('div');
        r.className = 'ph-q';
        r.innerHTML = '<b class="ph-q-nom"></b><label>Quantité totale utilisée<span class="ph-paire"><input type="text" inputmode="decimal" class="ph-qte" autocomplete="off">'
          + '<select class="ph-unite">' + UNITES.map(function (u) { return '<option>' + u + '</option>'; }).join('') + '</select></span></label>'
          + '<span class="ph-calcul ph-dose"></span>';
        r.querySelector('.ph-qte').value = fr(x.quantite);
        r.querySelector('.ph-unite').value = x.unite || (x.uniteDose ? x.uniteDose.split('/')[0] : 'L');
        d._q = r;
        q('.ph-quantites').appendChild(r);
      }
      q('.ph-produits').appendChild(d);
      if (verrouille() && d.getAttribute('data-prevu') === 'Oui') d.querySelectorAll('.ph-pv').forEach(function (c) { c.disabled = true; });
      majCalculs();
      return d;
    }
    function retirerProduit(d) { if (d._q) d._q.remove(); d.remove(); majCalculs(); }
    function depuisCatalogue(d, par) {
      var nom = d.querySelector('.ph-nom').value.trim().toLowerCase(), amm = d.querySelector('.ph-amm').value.trim();
      var c = catalogue().filter(function (x) { return par === 'amm' ? x.amm === amm : x.nom.toLowerCase() === nom; })[0];
      if (!c) return;
      var poser = function (sel, v) { var i = d.querySelector(sel); if (i.value === '' && v !== '' && v != null) i.value = fr(v); };
      poser('.ph-nom', c.nom); poser('.ph-amm', c.amm); poser('.ph-p-doseH', c.doseHomologuee);
      poser('.ph-p-dar', c.dar); poser('.ph-p-dre', c.dre); poser('.ph-p-znt', c.znt);
      if (c.uniteDose) d.querySelector('.ph-p-unite').value = c.uniteDose;
      if (!categorie() && c.categorie) poserCategorie(c.categorie);
      if (d._q && !d._q.querySelector('.ph-qte').value && c.uniteDose) d._q.querySelector('.ph-unite').value = c.uniteDose.split('/')[0];
      majCalculs();
    }
    q('.ph-produits').addEventListener('click', function (e) {
      if (e.target.classList.contains('ph-retirer-produit')) retirerProduit(e.target.closest('.ph-produit'));
    });
    q('.ph-produits').addEventListener('change', function (e) {
      var d = e.target.closest('.ph-produit'); if (!d) return;
      if (e.target.classList.contains('ph-nom')) depuisCatalogue(d, 'nom');
      if (e.target.classList.contains('ph-amm')) depuisCatalogue(d, 'amm');
    });
    q('.ph-ajout-produit').onclick = function () { ajouterProduit({}, 'Oui'); };
    q('.ph-ajout-non-prevu').onclick = function () {
      var d = ajouterProduit({}, 'Non');
      d.scrollIntoView({ block: 'center' });
    };
    conteneur.addEventListener('input', majCalculs);
    conteneur.addEventListener('change', majCalculs);

    // ---- Météo
    function poserMeteo(m, ecraser) {
      [['.ph-vent', m.vent], ['.ph-vent-dir', m.direction], ['.ph-hygro', m.hygro], ['.ph-temp', m.temperature]].forEach(function (x) {
        var i = q(x[0]); if (ecraser || i.value === '') i.value = fr(x[1]);
      });
      q('.ph-meteo').setAttribute('data-source', m.source);
      majCalculs();
    }
    function position() {
      var p = liste().lire().filter(function (x) { return x.lat !== '' && x.lon !== ''; })[0];
      if (p) return Promise.resolve({ lat: Number(p.lat), lon: Number(p.lon) });
      if (!o.gps || !navigator.geolocation) return Promise.reject(new Error('Placez d\'abord une parcelle (GPS ou carte) pour la météo.'));
      return new Promise(function (ok, ko) {
        navigator.geolocation.getCurrentPosition(function (x) { ok({ lat: x.coords.latitude, lon: x.coords.longitude }); },
          function () { ko(new Error('Position indisponible : placez une parcelle pour la météo.')); }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
      });
    }
    function chercherMeteo(ecraser) {
      var jour = o.date ? o.date() : '', auj = new Date(), iso = auj.getFullYear() + '-' + String(auj.getMonth() + 1).padStart(2, '0') + '-' + String(auj.getDate()).padStart(2, '0');
      var info = q('.ph-meteo-info');
      if (jour && jour !== iso) { if (ecraser) { info.textContent = 'Météo en ligne seulement pour le jour même : saisissez les conditions relevées.'; } return Promise.resolve(); }
      info.textContent = 'Recherche de la météo…';
      return position().then(function (p) { return meteoActuelle(p.lat, p.lon); })
        .then(function (m) { poserMeteo(m, ecraser); })
        .catch(function (e) { info.textContent = e.message; info.classList.add('ph-alerte'); });
    }
    q('.ph-meteo').onclick = function () { chercherMeteo(true); };

    // ---- Validation avant démarrage (téléphone)
    function verrouille() { return !!(o.etapes && valide); }
    function appliquerEtat() {
      var etapes = !!o.etapes && !prescription;
      q('.ph-valider-avant').hidden = !etapes || !!valide;
      if (etapes) { q('.ph-apres').hidden = !valide; q('.ph-client').hidden = !valide; }
      var bloque = verrouille();
      qa('.ph-v').forEach(function (c) { c.disabled = bloque; });
      qa('input[name="' + id + '-conforme"]').forEach(function (r) { r.disabled = bloque; });
      q('.ph-demarches').disabled = bloque;
      qa('.ph-produit').forEach(function (d) {
        var prevu = d.getAttribute('data-prevu') === 'Oui';
        d.querySelectorAll('.ph-pv').forEach(function (c) { c.disabled = bloque && prevu; });
      });
      q('.ph-avant-etat').textContent = valide && valide.valideAvantLe
        ? ' – validée le ' + valide.valideAvantLe.slice(8, 10) + '/' + valide.valideAvantLe.slice(5, 7) + ' à ' + valide.valideAvantLe.slice(11, 16)
          + (valide.conforme === 'Non' ? ' (non conforme : ' + valide.demarches + ')' : '') : '';
      majCalculs();
    }
    q('.ph-valider-avant').onclick = function () {
      var err = bloc.verifierPrescription(true);
      if (err) { if (o.surErreur) o.surErreur(err); return; }
      var bouton = q('.ph-valider-avant');
      bouton.disabled = true; bouton.textContent = 'Validation…';
      Promise.resolve(o.surValiderAvant({ phyto: bloc.lirePrescription(), conforme: radio('conforme'), demarches: q('.ph-demarches').value.trim() }))
        .then(function (info) {
          bouton.disabled = false; bouton.textContent = 'Valider et démarrer le chantier';
          if (!info) return;
          bloc.marquerValide(info);
          chercherMeteo(false);
          q('.ph-apres').scrollIntoView({ block: 'start' });
        })
        .catch(function (e) { bouton.disabled = false; bouton.textContent = 'Valider et démarrer le chantier'; if (o.surErreur) o.surErreur(e.message); });
    };

    function num(v) { return String(v).trim(); }
    var bloc = {
      remplir: function (x) {
        x = x || {};
        valide = x.valideAvantLe ? { valideAvantLe: x.valideAvantLe, conforme: x.conforme, demarches: x.demarches } : null;
        q('.ph-materiel').value = x.materiel || 'pulverisateur';
        var c = x.culture || '', connue = CULTURES.indexOf(c) >= 0;
        q('.ph-culture-liste').value = !c ? '' : connue ? c : 'autre';
        q('.ph-culture-autre').value = c && !connue ? c : '';
        majStades(x.bbch || '');
        poserCategorie(x.categorie || '');
        qa('input[name="' + id + '-bio"]').forEach(function (r) { r.checked = r.value === x.bio; });
        q('.ph-cible').value = x.cible || '';
        q('.ph-surface-prevue').value = fr(x.surfaceATraiter);
        q('.ph-specificites').value = x.specificites || '';
        q('.ph-transmis').value = x.transmisPar || TRANSMIS[0];
        q('.ph-remplissage').value = x.remplissage || REMPLISSAGE[0];
        q('.ph-evpp').value = x.evpp || EVPP[0];
        cocher('conforme', x.conforme || ''); q('.ph-demarches').value = x.demarches || '';
        q('.ph-debut').value = x.debut || ''; q('.ph-fin').value = x.fin || '';
        q('.ph-vent').value = fr(x.vent); q('.ph-vent-dir').value = x.ventDirection || '';
        q('.ph-hygro').value = fr(x.hygro); q('.ph-temp').value = fr(x.temperature);
        q('.ph-meteo').setAttribute('data-source', x.meteoSource || '');
        cocher('consignes', x.consignes || ''); cocher('pconf', x.parcellesConformes || ''); cocher('regl', x.reglementation || '');
        q('.ph-precisions').value = x.precisionsParcelles || '';
        q('.ph-bouillie').value = fr(x.bouillie);
        q('.ph-problemes').value = x.problemes || ''; q('.ph-autres').value = x.autresInfos || '';
        q('.ph-delai-rentree').value = fr(x.delaiRentree); q('.ph-dar').value = fr(x.dar);
        q('.ph-znt').value = x.zonesNonTraitees || ''; q('.ph-rentree').value = x.rentree || ''; q('.ph-infos-client').value = x.infosClient || '';
        propres.remplir(x.parcelles); // même si les parcelles viennent d'ailleurs : prêtes si le bon change de client
        q('.ph-produits').innerHTML = ''; q('.ph-quantites').innerHTML = '';
        majCatalogue();
        (x.produits && x.produits.length ? x.produits : [{}]).forEach(function (p) { ajouterProduit(p, p.prevu); });
        appliquerEtat();
      },
      /** Partie « avant application » : prescription d'une mission ou validée par le chauffeur. */
      lirePrescription: function () {
        return {
          materiel: q('.ph-materiel').value, culture: culture(), bbch: lireBbch(), bio: radio('bio'),
          categorie: categorie(), cible: q('.ph-cible').value.trim(), specificites: q('.ph-specificites').value.trim(),
          surfaceATraiter: num(q('.ph-surface-prevue').value), parcelles: liste().lire(),
          transmisPar: q('.ph-transmis').value, remplissage: q('.ph-remplissage').value, evpp: q('.ph-evpp').value,
          produits: qa('.ph-produit').map(function (d) {
            return { nom: d.querySelector('.ph-nom').value.trim(), amm: d.querySelector('.ph-amm').value.replace(/\s/g, ''),
              prevu: d.getAttribute('data-prevu'), uniteDose: d.querySelector('.ph-p-unite').value,
              doseHomologuee: num(d.querySelector('.ph-p-doseH').value), doseRecommandee: num(d.querySelector('.ph-p-doseR').value),
              dar: num(d.querySelector('.ph-p-dar').value), dre: num(d.querySelector('.ph-p-dre').value), znt: num(d.querySelector('.ph-p-znt').value) };
          }).filter(function (p) { return p.nom || p.amm; })
        };
      },
      lire: function () {
        var x = bloc.lirePrescription(), semoir = q('.ph-materiel').value === 'semoir';
        x.produits = qa('.ph-produit').map(function (d) {
          return { nom: d.querySelector('.ph-nom').value.trim(), amm: d.querySelector('.ph-amm').value.replace(/\s/g, ''),
            prevu: d.getAttribute('data-prevu'), uniteDose: d.querySelector('.ph-p-unite').value,
            doseHomologuee: num(d.querySelector('.ph-p-doseH').value), doseRecommandee: num(d.querySelector('.ph-p-doseR').value),
            dar: num(d.querySelector('.ph-p-dar').value), dre: num(d.querySelector('.ph-p-dre').value), znt: num(d.querySelector('.ph-p-znt').value),
            quantite: d._q ? num(d._q.querySelector('.ph-qte').value) : '', unite: d._q ? d._q.querySelector('.ph-unite').value : '' };
        }).filter(function (p) { return p.nom || p.amm || p.quantite; });
        return Object.assign(x, {
          conforme: radio('conforme'), demarches: q('.ph-demarches').value.trim(),
          debut: q('.ph-debut').value, fin: q('.ph-fin').value, bouillie: semoir ? '' : num(q('.ph-bouillie').value),
          vent: num(q('.ph-vent').value), ventDirection: q('.ph-vent-dir').value.trim(), hygro: num(q('.ph-hygro').value),
          temperature: num(q('.ph-temp').value), meteoSource: q('.ph-meteo').getAttribute('data-source') || '',
          consignes: radio('consignes'), parcellesConformes: radio('pconf'), precisionsParcelles: q('.ph-precisions').value.trim(),
          reglementation: radio('regl'), problemes: q('.ph-problemes').value.trim(), autresInfos: q('.ph-autres').value.trim(),
          delaiRentree: num(q('.ph-delai-rentree').value), dar: num(q('.ph-dar').value), zonesNonTraitees: q('.ph-znt').value.trim(),
          rentree: q('.ph-rentree').value.trim(), infosClient: q('.ph-infos-client').value.trim()
        });
      },
      /**
       * Contrôles de la prescription ; avecValidation : réponse « conforme » exigée (téléphone) ;
       * partielle : mission préparée au bureau, seules les valeurs saisies sont contrôlées (le chauffeur complète).
       */
      verifierPrescription: function (avecValidation, partielle) {
        var x = bloc.lirePrescription();
        if (!partielle) {
          if (!q('.ph-culture-liste').value) return 'Prescription : choisissez la culture.';
          if (!x.culture) return 'Prescription : indiquez le nom de la culture.';
          if (!x.bio) return 'Prescription : production biologique, oui ou non ?';
          if (!x.produits.length) return 'Prescription : indiquez au moins un produit à utiliser.';
        }
        for (var j = 0; j < x.produits.length; j++) {
          var p = x.produits[j], t = 'Produit ' + (j + 1) + ' : ';
          if (!p.nom) return t + 'indiquez le nom commercial complet.';
          if (p.amm && !/^\d{7}$/.test(p.amm)) return t + 'le n° AMM compte 7 chiffres (ou laissez vide).';
          var champs = [['doseHomologuee', 'dose homologuée'], ['doseRecommandee', 'dose recommandée'], ['dar', 'DAR'], ['dre', 'DRE'], ['znt', 'ZNT']];
          for (var k = 0; k < champs.length; k++) if (p[champs[k][0]] !== '' && !(nombre(p[champs[k][0]]) >= 0)) return t + champs[k][1] + ' : nombre invalide.';
        }
        if (x.bbch && !/^\d{2}$/.test(x.bbch)) return 'Stade BBCH : 2 chiffres.';
        if (x.surfaceATraiter !== '' && !(nombre(x.surfaceATraiter) > 0)) return 'Surface à traiter : nombre invalide.';
        if (avecValidation) {
          if (!radio('conforme')) return 'Consignes conformes avant application : oui ou non ?';
          if (radio('conforme') === 'Non' && !q('.ph-demarches').value.trim()) return 'Non conforme : indiquez les démarches prises.';
        }
        return '';
      },
      /** Contrôles bloquants du bon complet (ce qui ne peut pas attendre le bureau). */
      verifier: function () {
        var x = bloc.lire();
        if (o.etapes && !valide) return 'Validez d\'abord la prescription : « Valider et démarrer le chantier ».';
        var ep = bloc.verifierPrescription(!o.etapes); if (ep) return ep;
        if (!x.debut || !x.fin) return 'Traitement phyto : indiquez les heures de début et de fin.';
        if (x.vent === '' || !(nombre(x.vent) >= 0)) return 'Conditions d\'application : indiquez le vent (km/h).';
        if (x.temperature === '' || isNaN(nombre(x.temperature))) return 'Conditions d\'application : indiquez la température (°C).';
        if (x.hygro !== '' && !(nombre(x.hygro) >= 0 && nombre(x.hygro) <= 100)) return 'Hygrométrie : entre 0 et 100 %.';
        if (!x.consignes) return 'Consignes d\'exécution respectées : en totalité ou partiellement ?';
        if (!x.parcellesConformes) return 'Parcelles traitées = parcelles concernées : oui ou non ?';
        if (x.parcellesConformes === 'Non' && !x.precisionsParcelles) return 'Parcelles : précisez l\'écart.';
        var ep2 = liste().verifier(true); if (ep2) return ep2;
        if (x.materiel !== 'semoir' && !(nombre(x.bouillie) > 0)) return 'Indiquez la quantité totale de bouillie (L).';
        var utilise = false;
        for (var j = 0; j < x.produits.length; j++) {
          var p = x.produits[j], t = 'Produit ' + (j + 1) + (p.nom ? ' (' + p.nom + ')' : '') + ' : ';
          if (p.quantite === '' && p.prevu === 'Oui') continue; // prévu mais non utilisé
          if (!(nombre(p.quantite) >= 0)) return t + 'quantité totale utilisée invalide.';
          if (p.prevu === 'Non' && !(nombre(p.quantite) > 0)) return t + 'indiquez la quantité utilisée.';
          if (nombre(p.quantite) > 0) utilise = true;
        }
        if (!utilise) return 'Indiquez la quantité utilisée d\'au moins un produit.';
        if (!x.reglementation) return 'Réglementation respectée : oui ou non ?';
        if ((x.consignes === 'Partiellement' || x.reglementation === 'Non') && !x.problemes) return 'Décrivez le problème rencontré et les mesures prises.';
        var nums = [['delaiRentree', 'Délai de rentrée'], ['dar', 'Délai avant récolte']];
        for (var k = 0; k < nums.length; k++) if (x[nums[k][0]] !== '' && !(nombre(x[nums[k][0]]) >= 0)) return nums[k][1] + ' : nombre invalide.';
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
      marquerValide: function (info) { valide = info; cocher('conforme', info.conforme); q('.ph-demarches').value = info.demarches || ''; appliquerEtat(); },
      estValide: function () { return !!valide; },
      chercherMeteo: chercherMeteo,
      proposerSurface: function (ha) { liste().proposerSurface(ha); },
      /** Matériel proposé (ex. semoir pour une incorporation au semis), tant que l'utilisateur ne l'a pas choisi. */
      proposerMateriel: function (m) {
        var s = q('.ph-materiel');
        if (verrouille() || s.getAttribute('data-touche') || !MATERIELS.some(function (x) { return x[0] === m; }) || s.value === m) return;
        s.value = m; majCalculs();
      },
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

  window.Phyto = { monter: monter, parcelles: parcelles, meteoActuelle: meteoActuelle, UNITES: UNITES, CULTURES: CULTURES, BBCH: BBCH, choisirSurCarte: choisirSurCarte };
})();
