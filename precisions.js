/**
 * ETA Oillic – précisions demandées par certaines prestations (collecte des algues, épandage de boues, rotations)
 * Version 1.3 – 2026-11-17 : rotations — le chauffeur n'indique que le nombre de rotations ; les pesées (une par
 *   rotation, ticket de la bascule) sont saisies par le bureau dans la Gestion (option pesees) ;
 *   1.2 – 2026-11-16 : précision « rotations » et client par défaut des prestations ;
 *   1.1 – 2026-11-13 : précision « boues » (station de provenance, preneur, parcelles et volume) ; 1.0 – 2026-11-03
 *
 * Prestations → « Précisions » : plage (plages du client, cases à cocher), remorques (preneurs et nombre
 * de remorques chez chacun), preneur (preneurs sans nombre). Le bloc n'apparaît que si une prestation du bon
 * (ou de la mission) le demande. Noms des preneurs libres, ceux déjà saisis sont proposés.
 * Boues : station choisie parmi celles du client (client proposé d'office : Paramètres → « Client boues »),
 *   preneur choisi dans la liste (Paramètres → « Preneurs boues ») ; sur le bon, parcelles avec volume (m³ ou t)
 *   — preneur = SARL : parcelles du référentiel et surface obligatoire ; sinon nom libre, surface facultative.
 *   Le volume total est proposé comme quantité des prestations « boues » qui ne sont pas à l'heure (ex. épandeur, t).
 * Rotations (1.3) : mission = nombre de rotations demandées (facultatif) ; bon (téléphone, saisie au planning) =
 *   nombre de rotations faites, la quantité des prestations « rotations » non horaires reste vide (« pesées au
 *   bureau ») ; Gestion (option pesees: true) = une ligne par rotation avec sa pesée (t = m³), le total est proposé
 *   comme quantité. quantiteLibre(code) dit si une quantité vide est admise pour cette prestation.
 * Client par défaut (1.2) : une prestation qui a un client par défaut (Prestations → « Client par défaut ») le
 *   propose dès qu'elle est choisie, si aucun client ne l'est encore (comme « Client boues » pour les boues).
 * Utilisé par index.html (téléphone), bureau.html (mission et saisie de bon) et gestion.html (correction).
 *
 * Precisions.monter(conteneur, {
 *   mode: 'bon' | 'mission'        (mission : rien d'obligatoire, preneurs sans nombre de remorques)
 *   clients(), prestations(), preneurs()   : listes ({ code, plages }, { code, precisions, variantes }, noms)
 *   cadre                         : élément à masquer quand rien n'est demandé (par défaut le conteneur)
 *   bouton                        : classe du bouton « Ajouter un preneur »
 *   preneursBoues(), codeSarl(), parcellesSarl(), clientBoues() : listes et codes pour les boues
 *   choisirClient(code)           : place le client proposé (boues, client par défaut d'une prestation) si aucun client n'est choisi
 *   lignes()                      : conteneur des lignes de prestations (quantité proposée = volume total)
 * }) → { maj(client, codes), lire(), remplir(v), verifier(), besoins() }
 */
(function () {
  'use strict';
  var n = 0;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var cssFait = false;
  function css() {
    if (cssFait) return; cssFait = true;
    var s = document.createElement('style');
    s.textContent = '.pr-titre{font-weight:700;margin:4px 0 6px}'
      + '.pr-titre small{font-weight:400;color:var(--doux,#53636F)}'
      + '.pr-plages{display:flex;flex-wrap:wrap;gap:6px 8px;margin:0 0 10px}'
      + '.pr-plages label{display:flex;align-items:center;gap:8px;margin:0;font-weight:400;background:var(--vert-pale,#D5EBD5);border-radius:8px;padding:6px 12px;cursor:pointer}'
      + '.pr-plages label input{width:22px;height:22px;min-height:0;margin:0;flex:none}'
      + '.pr-vide{color:var(--rouge,#A8231B);font-weight:700;margin:0 0 10px}'
      + '.pr-preneur{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin-bottom:8px}'
      + '.pr-preneur.avec{grid-template-columns:1fr 150px auto}'
      + '.pr-preneur input{margin:0}'
      + '.pr-nb{display:flex;align-items:center;gap:6px}'
      + '.pr-nb input{max-width:80px}'
      + '.pr-retirer{background:none;border:0;color:var(--rouge,#A8231B);text-decoration:underline;padding:4px 2px;font-size:inherit;cursor:pointer}'
      + '.pr-boues{margin:0 0 8px}.pr-champ{display:block;margin:0 0 10px;font-weight:700}.pr-champ select{display:block;width:100%;margin-top:4px}'
      + '.pr-info{margin:0 0 8px;color:var(--doux,#53636F)}.pr-parc{margin-top:4px}'
      + '.pr-rot{display:flex;align-items:center;gap:8px;margin:0 0 8px}.pr-rot .pr-rot-n{min-width:90px}'
      + '.pr-rot input{max-width:110px;margin:0}.pr-rot-total{font-weight:700;margin:4px 0 10px}.pr-rot-total.ecart{color:var(--rouge,#A8231B)}'
      + '.pr-champ input{display:block;max-width:160px;margin-top:4px}.pr-note{font-size:.9em;opacity:.8;margin:6px 0 0}'
      + '@media (max-width:520px){.pr-preneur.avec{grid-template-columns:1fr auto}.pr-preneur.avec .pr-nb{grid-column:1}}';
    document.head.appendChild(s);
  }

  function monter(el, o) {
    css();
    o = o || {};
    var mission = o.mode === 'mission';
    var id = 'pr-liste-' + (++n);
    var cadre = o.cadre || el;
    var besoin = { plage: false, remorques: false, preneur: false, boues: false, rotations: false };
    var client = null;
    var plagesCochees = [];          // plages choisies (gardées quand la liste est redessinée)
    var preneurs = [];               // [{ nom, remorques }]
    var station = '', preneurBoues = ''; // boues : station de provenance, preneur (code client)
    var rotations = [];              // rotations du bon : pesées saisies (texte, Gestion)
    var nbRot = '';                  // nombre de rotations faites (téléphone, saisie au planning)
    var pesees = !!o.pesees;         // Gestion : une ligne par rotation avec sa pesée
    var rotDemandees = '';           // rotations demandées (mission ; sur le bon : rappel de la mission)
    var codesVus = [];               // prestations déjà vues (le client par défaut n'est proposé qu'à l'arrivée d'une prestation)
    var titreCadre = cadre !== el ? cadre.querySelector('legend, h4') : null, titreOrigine = titreCadre ? titreCadre.textContent : '';

    // Zone redessinée (plages, preneurs, station et preneur des boues) ; parcelles des boues gardées à part
    el.innerHTML = '<div class="pr-zone"></div><div class="pr-parc" hidden><div class="pr-titre">Parcelles et volume de boues épandu sur chacune</div>'
      + '<div class="pr-pc-sarl"></div><div class="pr-pc-libre"></div></div>';
    var zone = el.querySelector('.pr-zone'), boxParc = el.querySelector('.pr-parc');
    var listeSarl = null, listeLibre = null;
    if (!mission && window.Phyto && Phyto.parcelles) {
      listeSarl = Phyto.parcelles(el.querySelector('.pr-pc-sarl'), { bouton: o.bouton, positions: false, volume: true, surfaceRequise: true,
        codes: function () { return (o.parcellesSarl && o.parcellesSarl()) || []; }, surChangement: proposerQuantite });
      listeLibre = Phyto.parcelles(el.querySelector('.pr-pc-libre'), { bouton: o.bouton, positions: false, volume: true,
        surChangement: proposerQuantite });
    }
    function codeSarl() { return (o.codeSarl && o.codeSarl()) || ''; }
    function bouesSarl() { return !!preneurBoues && preneurBoues === codeSarl(); }
    function listeBoues() { return bouesSarl() ? listeSarl : listeLibre; }
    function majParc() {
      boxParc.hidden = !(besoin.boues && listeSarl);
      if (!listeSarl) return;
      el.querySelector('.pr-pc-sarl').hidden = !bouesSarl();
      el.querySelector('.pr-pc-libre').hidden = bouesSarl();
    }
    /** Volume total proposé comme quantité des prestations « boues » non horaires (vide, ou valeur déjà proposée). */
    function proposerQuantite() {
      var liste = listeBoues();
      if (!liste || !besoin.boues) return;
      proposerPour('boues', liste.volumeTotal());
    }
    function nombreTxt(x) { var v = Number(String(x).replace(/\s/g, '').replace(',', '.')); return String(x).trim() !== '' && isFinite(v) ? v : NaN; }
    function totalRotations() {
      return Math.round(rotations.reduce(function (t, x) { var v = nombreTxt(x); return t + (v > 0 ? v : 0); }, 0) * 100) / 100;
    }
    function nbRotations() { return rotations.filter(function (x) { return nombreTxt(x) > 0; }).length; }
    /** Total des rotations proposé comme quantité des prestations « rotations » non horaires (ex. m³). */
    function proposerRotations() {
      if (!besoin.rotations || mission) return;
      if (pesees) proposerPour('rotations', totalRotations());
      else marquerQuantites();
    }
    /** Prestation qui suit les rotations et n'est pas à l'heure : sa quantité vient des pesées du bureau. */
    function suitRotations(c) {
      var ps = (o.prestations && o.prestations()) || [];
      var p = ps.filter(function (x) { return x.code === c; })[0];
      var parent = ps.filter(function (x) { return (x.variantes || []).indexOf(c) >= 0; })[0];
      var avec = [p, parent].some(function (x) { return x && (x.precisions || []).indexOf('rotations') >= 0; });
      var u = (p || parent || {}).unite || '';
      return avec && !/^h(eures?)?$/i.test(String(u).trim());
    }
    /** Téléphone et planning : la quantité de ces prestations reste vide, avec l'indication « pesées au bureau ». */
    function marquerQuantites() {
      var cont = o.lignes && o.lignes();
      if (!cont) return;
      Array.prototype.forEach.call(cont.children, function (l) {
        if (!l._opt) return;
        var q = l.querySelector('.l-qte, .e-qte'), sel = l.querySelector('select');
        var c = l._opt.code() || (sel ? sel.value : '');
        if (!q) return;
        if (!q.hasAttribute('data-ph')) q.setAttribute('data-ph', q.placeholder || '');
        q.placeholder = c && besoin.rotations && suitRotations(c) ? 'pesées au bureau' : q.getAttribute('data-ph');
      });
    }
    function proposerPour(cle, total) {
      var cont = o.lignes && o.lignes();
      if (!cont) return;
      if (!(total > 0)) return;
      var ps = (o.prestations && o.prestations()) || [];
      Array.prototype.forEach.call(cont.children, function (l) {
        if (!l._opt) return;
        var sel = l.querySelector('select'), c = l._opt.code() || (sel ? sel.value : '');
        var p = ps.filter(function (x) { return x.code === c || (x.variantes || []).indexOf(c) >= 0; })[0];
        var q = l.querySelector('.l-qte, .e-qte');
        if (!p || !q || (p.precisions || []).indexOf(cle) < 0) return;
        var u = (ps.filter(function (x) { return x.code === c; })[0] || p).unite || '';
        if (/^h(eures?)?$/i.test(String(u).trim())) return;
        var k = '_q_' + cle;
        if (q.value.trim() !== '' && q.value.trim() !== l[k]) return;
        q.value = l[k] = String(total).replace('.', ',');
        q.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }

    function lireEcran() {
      var cases = zone.querySelectorAll('.pr-plage');
      if (cases.length || zone.querySelector('.pr-plages')) {
        plagesCochees = Array.prototype.filter.call(cases, function (c) { return c.checked; }).map(function (c) { return c.value; });
      }
      var lignes = zone.querySelectorAll('.pr-preneur');
      if (zone.querySelector('.pr-preneurs')) {
        preneurs = Array.prototype.map.call(lignes, function (d) {
          var r = d.querySelector('.pr-r');
          return { nom: d.querySelector('.pr-nom').value.trim(), remorques: r ? r.value.trim() : '' };
        });
      }
      var st = zone.querySelector('.pr-station'), pb = zone.querySelector('.pr-preneur-boues');
      if (st) station = st.value;
      if (pb) preneurBoues = pb.value;
      var nr = zone.querySelector('.pr-rot-nb');
      if (nr) nbRot = nr.value.trim();
      if (zone.querySelector('.pr-rotations')) {
        rotations = Array.prototype.map.call(zone.querySelectorAll('.pr-rot-v'), function (i) { return i.value.trim(); });
      }
      var rd = zone.querySelector('.pr-rot-dem');
      if (rd) rotDemandees = rd.value.trim();
    }
    /** Ligne « 2 rotations, 24 m³ (sur 6 demandées) » sous la liste des rotations. */
    function texteTotal() {
      var d = nombreTxt(rotDemandees);
      if (!pesees) {
        var k = nombreTxt(nbRot);
        return k > 0 && d > 0 ? k + ' faite' + (k > 1 ? 's' : '') + ' sur ' + d + ' demandée' + (d > 1 ? 's' : '') : '';
      }
      var n = nbRotations(), t = totalRotations();
      return n + ' rotation' + (n > 1 ? 's' : '') + ', ' + String(t).replace('.', ',') + ' m³'
        + (d > 0 ? ' (' + d + ' demandée' + (d > 1 ? 's' : '') + ')' : '');
    }
    function majTotal() {
      var el2 = zone.querySelector('.pr-rot-total'); if (!el2) return;
      var d = nombreTxt(rotDemandees), n = pesees ? nbRotations() : nombreTxt(nbRot), t = texteTotal();
      el2.textContent = t ? (pesees ? 'Total : ' : '') + t : '';
      el2.hidden = !t;
      el2.className = 'pr-rot-total' + (d > 0 && n > 0 && n !== d ? ' ecart' : '');
    }
    function plagesClient() { return (client && client.plages) || []; }
    function stationsClient() { return (client && client.stations) || []; }

    function dessiner() {
      var avecNombre = besoin.remorques && !mission;
      var h = '';
      if (besoin.plage) {
        var liste = plagesClient().slice();
        plagesCochees.forEach(function (p) { if (liste.indexOf(p) < 0) liste.push(p); }); // plage enregistrée hors liste
        h += '<div class="pr-titre">' + (mission ? 'Plage(s) prévue(s)' : 'Plage(s) concernée(s)') + (mission ? ' <small>(facultatif)</small>' : '') + '</div>';
        h += !client ? '<p class="pr-vide">Choisissez d\'abord le client.</p>'
          : !liste.length ? '<p class="pr-vide">Aucune plage enregistrée pour ce client (Gestion → Clients → Plages).</p>'
          : '<div class="pr-plages">' + liste.map(function (p) {
            return '<label><input type="checkbox" class="pr-plage" value="' + esc(p) + '"' + (plagesCochees.indexOf(p) >= 0 ? ' checked' : '') + '> ' + esc(p) + '</label>';
          }).join('') + '</div>';
      }
      if (besoin.remorques || besoin.preneur) {
        if (!preneurs.length) preneurs = [{ nom: '', remorques: '' }];
        h += '<div class="pr-preneurs"><div class="pr-titre">' + (besoin.remorques ? 'Preneurs des algues' + (avecNombre ? ' et nombre de remorques chez chacun' : '') : 'Preneur (chez qui le travail est fait)')
          + (mission ? ' <small>(facultatif)</small>' : '') + '</div>'
          + preneurs.map(function (x) {
            return '<div class="pr-preneur' + (avecNombre ? ' avec' : '') + '"><input type="text" class="pr-nom" maxlength="80" autocomplete="off" list="' + id + '" placeholder="Nom du preneur" aria-label="Nom du preneur" value="' + esc(x.nom) + '">'
              + (avecNombre ? '<span class="pr-nb"><input type="text" class="pr-r" inputmode="numeric" autocomplete="off" placeholder="Nb" aria-label="Nombre de remorques" value="' + esc(x.remorques) + '"> remorque(s)</span>' : '')
              + '<button type="button" class="pr-retirer">Retirer</button></div>';
          }).join('')
          + '<datalist id="' + id + '">' + ((o.preneurs && o.preneurs()) || []).map(function (p) { return '<option value="' + esc(p) + '">'; }).join('') + '</datalist>'
          + '<button type="button" class="' + esc(o.bouton || 'secondaire') + ' pr-ajout">Ajouter un preneur</button></div>';
      }
      if (besoin.boues) {
        var stations = stationsClient().slice();
        if (station && stations.indexOf(station) < 0) stations.push(station); // station enregistrée hors liste
        var pbs = ((o.preneursBoues && o.preneursBoues()) || []).slice();
        if (preneurBoues && !pbs.some(function (x) { return x.code === preneurBoues; })) pbs.push({ code: preneurBoues, nom: preneurBoues });
        h += '<div class="pr-boues">' + (mission ? '<p class="pr-info">Facultatif : repris sur le bon du chauffeur.</p>' : '')
          + (!client ? '<p class="pr-vide">Choisissez d\'abord le client.</p>'
            : !stations.length ? '<p class="pr-vide">Aucune station enregistrée pour ce client (Gestion → Clients → Stations).</p>'
            : '<label class="pr-champ">Station de provenance<select class="pr-station"><option value="">Choisir la station</option>'
              + stations.map(function (x) { return '<option value="' + esc(x) + '"' + (x === station ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></label>')
          + '<label class="pr-champ">Preneur des boues<select class="pr-preneur-boues"><option value="">Choisir le preneur</option>'
          + pbs.map(function (x) { return '<option value="' + esc(x.code) + '"' + (x.code === preneurBoues ? ' selected' : '') + '>' + esc(x.nom) + '</option>'; }).join('')
          + '</select></label>'
          + (!mission && bouesSarl() ? '<p class="pr-info">Parcelles de la SARL : le bon sera envoyé à l\'exploitation (Gestion → Trois Étangs).</p>' : '')
          + '</div>';
      }
      if (besoin.rotations) {
        if (mission) {
          h += '<div class="pr-rotations-m"><label class="pr-champ">Nombre de rotations demandées <small>(facultatif)</small>'
            + '<input type="text" class="pr-rot-dem" inputmode="numeric" autocomplete="off" maxlength="4" value="' + esc(rotDemandees) + '"></label></div>';
        } else if (!pesees) {
          var dm = nombreTxt(rotDemandees);
          h += '<div class="pr-rotations-nb"><label class="pr-champ">Nombre de rotations faites'
            + (dm > 0 ? ' <small>– ' + dm + ' demandée' + (dm > 1 ? 's' : '') + '</small>' : '')
            + '<input type="text" class="pr-rot-nb" inputmode="numeric" autocomplete="off" maxlength="3" value="' + esc(nbRot) + '"></label>'
            + '<p class="pr-rot-total"></p><p class="pr-note">Les pesées (tickets de la bascule) sont saisies au bureau : laissez la quantité vide.</p></div>';
        } else {
          if (!rotations.length) rotations = [''];
          var d = nombreTxt(rotDemandees);
          h += '<div class="pr-rotations"><div class="pr-titre">Pesée de chaque rotation (t = m³)'
            + (d > 0 ? ' <small>– ' + d + ' rotation' + (d > 1 ? 's' : '') + ' demandée' + (d > 1 ? 's' : '') + '</small>' : '') + '</div>'
            + rotations.map(function (v, i) {
              return '<div class="pr-rot"><span class="pr-rot-n">Rotation ' + (i + 1) + '</span>'
                + '<input type="text" class="pr-rot-v" inputmode="decimal" autocomplete="off" placeholder="t" aria-label="Pesée de la rotation ' + (i + 1) + ' en tonnes" value="' + esc(v) + '"> t'
                + '<button type="button" class="pr-retirer pr-rot-retirer"' + (rotations.length === 1 ? ' hidden' : '') + '>Retirer</button></div>';
            }).join('')
            + '<p class="pr-rot-total"></p>'
            + '<button type="button" class="' + esc(o.bouton || 'secondaire') + ' pr-rot-ajout">Ajouter une rotation</button></div>';
        }
      }
      zone.innerHTML = h;
      cadre.hidden = !h;
      majTotal();
      if (!pesees && !mission) marquerQuantites(); // pose ou retire l'indication « pesées au bureau »
      // Titre du cadre (legend ou h4) : « Épandage de boues » / « Rotations » quand seule cette précision est demandée
      var seul = !besoin.plage && !besoin.remorques && !besoin.preneur;
      if (titreCadre) titreCadre.textContent = seul && besoin.boues && !besoin.rotations ? 'Épandage de boues'
        : seul && besoin.rotations && !besoin.boues ? 'Rotations' : titreOrigine;
      majParc();
      var lignes = zone.querySelectorAll('.pr-preneur');
      Array.prototype.forEach.call(lignes, function (d) { d.querySelector('.pr-retirer').hidden = lignes.length === 1; });
    }

    zone.addEventListener('click', function (e) {
      if (e.target.classList.contains('pr-ajout')) {
        lireEcran(); preneurs.push({ nom: '', remorques: '' }); dessiner();
        var l = zone.querySelectorAll('.pr-nom'); l[l.length - 1].focus();
      } else if (e.target.classList.contains('pr-rot-ajout')) {
        lireEcran();
        rotations.push(''); // une pesée par ticket
        dessiner(); proposerRotations();
        var r = zone.querySelectorAll('.pr-rot-v'); r[r.length - 1].focus(); r[r.length - 1].select();
        signaler();
      } else if (e.target.classList.contains('pr-rot-retirer')) {
        e.target.closest('.pr-rot').remove(); lireEcran(); dessiner(); proposerRotations(); signaler();
      } else if (e.target.classList.contains('pr-retirer')) {
        e.target.closest('.pr-preneur').remove(); lireEcran(); dessiner();
      }
    });
    zone.addEventListener('input', function (e) {
      if (e.target.classList.contains('pr-rot-v') || e.target.classList.contains('pr-rot-dem') || e.target.classList.contains('pr-rot-nb')) { lireEcran(); majTotal(); proposerRotations(); }
    });
    /** Le formulaire de la page est prévenu d'une modification faite par un bouton (saisie en cours). */
    function signaler() { try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (x) {} }
    /** Client proposé pour une prestation : son client par défaut, sinon le client des boues (s'il est dans la liste). */
    function clientPropose(c, ps) {
      var cls = (o.clients && o.clients()) || [];
      var existe = function (k) { return !!k && cls.some(function (x) { return x.code === k && x.actif !== false; }); };
      var p = ps.filter(function (x) { return x.code === c; })[0];
      var parent = ps.filter(function (x) { return (x.variantes || []).indexOf(c) >= 0; })[0];
      var d = (p && p.clientDefaut) || (parent && parent.clientDefaut) || '';
      if (existe(d)) return d;
      var boues = [p, parent].some(function (x) { return x && (x.precisions || []).indexOf('boues') >= 0; });
      var cb = boues && o.clientBoues ? o.clientBoues() : '';
      return existe(cb) ? cb : '';
    }
    zone.addEventListener('change', function (e) {
      if (e.target.classList.contains('pr-preneur-boues')) { lireEcran(); dessiner(); proposerQuantite(); }
    });

    return {
      /** Client et codes des prestations choisies (lignes, variantes, options) : redessine le bloc si besoin. */
      maj: function (codeClient, codes) {
        lireEcran();
        var cl = ((o.clients && o.clients()) || []).filter(function (c) { return c.code === codeClient; })[0] || null;
        var ps = (o.prestations && o.prestations()) || [], b = { plage: false, remorques: false, preneur: false, boues: false, rotations: false };
        (codes || []).forEach(function (c) {
          ps.forEach(function (p) {
            if (p.code === c || (p.variantes || []).indexOf(c) >= 0) (p.precisions || []).forEach(function (k) { b[k] = true; });
          });
        });
        // Client proposé d'office (client par défaut de la prestation, ou SAUR pour les boues) quand une prestation
        // vient d'être choisie et qu'aucun client ne l'est encore
        var nouveaux = (codes || []).filter(function (c) { return c && codesVus.indexOf(c) < 0; });
        codesVus = (codes || []).slice();
        var proposer = '';
        if (!codeClient && o.choisirClient) nouveaux.some(function (c) { proposer = clientPropose(c, ps); return !!proposer; });
        // Client changé : les plages cochées et la station qui ne sont pas les siennes sont retirées
        if (cl !== client && client) {
          plagesCochees = plagesCochees.filter(function (p) { return ((cl && cl.plages) || []).indexOf(p) >= 0; });
          if (station && ((cl && cl.stations) || []).indexOf(station) < 0) station = '';
        }
        if (b.plage === besoin.plage && b.remorques === besoin.remorques && b.preneur === besoin.preneur && b.boues === besoin.boues
          && b.rotations === besoin.rotations && cl === client) {
          if (proposer) o.choisirClient(proposer);
          return;
        }
        besoin = b; client = cl;
        dessiner();
        if (b.boues) proposerQuantite();
        if (b.rotations) proposerRotations();
        if (proposer) o.choisirClient(proposer);
      },
      /**
       * { plages: [...], preneurs: [{ nom, remorques }], boues: { station, preneur, parcelles }, rotations: [volumes], rotationsDemandees }
       * (mission : preneurs = noms seuls ; boues sans parcelles ; rotations demandées seulement).
       */
      lire: function () {
        lireEcran();
        var r = { plages: besoin.plage ? plagesCochees.slice() : [], preneurs: [], boues: { station: '', preneur: '', parcelles: [] },
          rotations: [], nombreRotations: '', rotationsDemandees: '' };
        if (besoin.rotations) {
          if (mission) r.rotationsDemandees = rotDemandees;
          else if (pesees) {
            r.rotations = rotations.filter(function (x) { return x !== ''; });
            r.nombreRotations = String(rotations.length); // lignes sans pesée : le nombre de rotations est gardé
          } else r.nombreRotations = nbRot;
        }
        if (besoin.remorques || besoin.preneur) {
          r.preneurs = preneurs.filter(function (x) { return x.nom || x.remorques; })
            .map(function (x) { return mission ? x.nom : { nom: x.nom, remorques: besoin.remorques ? x.remorques : '' }; });
        }
        if (besoin.boues) {
          r.boues.station = station; r.boues.preneur = preneurBoues;
          if (!mission && listeBoues()) r.boues.parcelles = listeBoues().lire();
        }
        return r;
      },
      /**
       * v = { plages: [...], preneurs: [{ nom, remorques }] ou [noms], station, preneurBoues, parcellesBoues: [{ code, nom, surface, volume }],
       *   rotations: [volumes], rotationsDemandees } ; null pour vider.
       */
      remplir: function (v) {
        v = v || {};
        plagesCochees = (v.plages || []).slice();
        preneurs = (v.preneurs || []).map(function (x) { return typeof x === 'string' ? { nom: x, remorques: '' } : { nom: x.nom || '', remorques: x.remorques === '' || x.remorques == null ? '' : String(x.remorques) }; });
        station = v.station || ''; preneurBoues = v.preneurBoues || '';
        rotations = (v.rotations || []).map(function (x) { return String(x).replace('.', ','); });
        nbRot = v.nombreRotations === '' || v.nombreRotations == null ? (rotations.length ? String(rotations.length) : '') : String(v.nombreRotations);
        // Gestion : pas encore de pesées → une ligne vide par rotation faite
        if (pesees && !rotations.length && Number(nbRot) > 0) { for (var z = 0; z < Number(nbRot) && z < 100; z++) rotations.push(''); }
        rotDemandees = v.rotationsDemandees === '' || v.rotationsDemandees == null ? '' : String(v.rotationsDemandees);
        codesVus = [];
        client = null; // le client est redonné par maj() : rien n'est filtré d'après le client précédent
        if (listeSarl) {
          var pc = v.parcellesBoues && v.parcellesBoues.length ? v.parcellesBoues : null;
          listeSarl.remplir(bouesSarl() ? pc : null);
          listeLibre.remplir(bouesSarl() ? null : pc);
        }
        dessiner();
      },
      /** Message d'erreur ou '' (bon seulement : rien n'est obligatoire dans une mission). */
      verifier: function () {
        if (mission) return '';
        var r = this.lire();
        if (besoin.plage && !r.plages.length) return plagesClient().length ? 'Indiquez la ou les plages concernées.' : 'Aucune plage n\'est enregistrée pour ce client : complétez sa fiche (Gestion → Clients → Plages).';
        if (besoin.remorques || besoin.preneur) {
          if (!r.preneurs.length) return besoin.remorques ? 'Indiquez le ou les preneurs des algues et le nombre de remorques chez chacun.' : 'Indiquez le preneur.';
          var vus = {};
          for (var i = 0; i < r.preneurs.length; i++) {
            var x = r.preneurs[i];
            if (!x.nom) return 'Preneur ' + (i + 1) + ' : indiquez son nom.';
            if (vus[x.nom.toLowerCase()]) return 'Preneur « ' + x.nom + ' » indiqué deux fois.';
            vus[x.nom.toLowerCase()] = true;
            if (besoin.remorques && !/^\d+$/.test(x.remorques) || besoin.remorques && Number(x.remorques) < 1) return 'Preneur « ' + x.nom + ' » : indiquez le nombre de remorques.';
          }
        }
        if (besoin.boues) {
          if (!r.boues.station) return stationsClient().length ? 'Boues : choisissez la station de provenance.' : 'Aucune station n\'est enregistrée pour ce client : complétez sa fiche (Gestion → Clients → Stations).';
          if (!r.boues.preneur) return 'Boues : choisissez le preneur.';
          var e = listeBoues() ? listeBoues().verifier(bouesSarl()) : '';
          if (e) return 'Boues – ' + e.charAt(0).toLowerCase() + e.slice(1);
        }
        if (besoin.rotations && !mission) {
          if (!pesees) {
            var k = nombreTxt(nbRot);
            if (!(k >= 1 && k <= 100 && Math.round(k) === k)) return 'Rotations : indiquez le nombre de rotations faites.';
          } else if (r.rotations.length) { // pesées : toutes ou aucune
            for (var j = 0; j < rotations.length; j++) {
              if (!(nombreTxt(rotations[j]) > 0)) return 'Rotation ' + (j + 1) + ' : indiquez la pesée (t), ou retirez la ligne.';
            }
          }
        }
        return '';
      },
      /** Quantité vide admise pour cette prestation : elle suit les rotations et les pesées ne sont pas encore saisies. */
      quantiteLibre: function (code) {
        if (!besoin.rotations || mission || !code || !suitRotations(code)) return false;
        return !pesees || !rotations.some(function (x) { return nombreTxt(x) > 0; });
      },
      besoins: function () { return { plage: besoin.plage, remorques: besoin.remorques, preneur: besoin.preneur, boues: besoin.boues, rotations: besoin.rotations }; },
      /** Liste des parcelles SARL chargée après coup : rafraîchit les choix. */
      rafraichirCodes: function () { if (listeSarl) listeSarl.rafraichirCodes(); }
    };
  }

  /**
   * Texte court pour les listes : « Penvins, Kerfontaine – Dupont (3 remorques), Martin (1 remorque) » ;
   * boues = { station, preneurNom, volume } : « boues Theix – Le Saindo → Launay Didier, 54 m³ » ;
   * rot = { demandees, volumes, nombre } : « 6 rotations demandées » (mission), « 3 rotations, 36 m³ » (bon pesé)
   * ou « 4 rotations, pesées à saisir » (bon pas encore pesé).
   */
  function resume(plages, preneurs, boues, rot) {
    var p = (preneurs || []).map(function (x) {
      if (typeof x === 'string') return x;
      return x.nom + (x.remorques ? ' (' + x.remorques + ' remorque' + (x.remorques > 1 ? 's' : '') + ')' : '');
    });
    var b = boues && (boues.station || boues.preneurNom) ? 'boues ' + [boues.station, boues.preneurNom ? '→ ' + boues.preneurNom : ''].filter(Boolean).join(' ')
      + (boues.volume !== '' && boues.volume != null ? ', ' + String(boues.volume).replace('.', ',') + ' m³' : '') : '';
    var r = '';
    if (rot && (rot.volumes || []).length) {
      var t = Math.round(rot.volumes.reduce(function (s, x) { return s + Number(x); }, 0) * 100) / 100;
      r = rot.volumes.length + ' rotation' + (rot.volumes.length > 1 ? 's' : '') + ', ' + String(t).replace('.', ',') + ' m³'
        + (rot.demandees ? ' (' + rot.demandees + ' demandée' + (rot.demandees > 1 ? 's' : '') + ')' : '');
    } else if (rot && Number(rot.nombre) > 0) {
      r = rot.nombre + ' rotation' + (rot.nombre > 1 ? 's' : '') + ', pesées à saisir';
    } else if (rot && rot.demandees) {
      r = rot.demandees + ' rotation' + (rot.demandees > 1 ? 's' : '') + ' demandée' + (rot.demandees > 1 ? 's' : '');
    }
    return [(plages || []).join(', '), p.length ? 'preneur' + (p.length > 1 ? 's' : '') + ' : ' + p.join(', ') : '', b, r].filter(Boolean).join(' – ');
  }

  window.Precisions = { monter: monter, resume: resume };
})();
