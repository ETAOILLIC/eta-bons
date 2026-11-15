/**
 * ETA Oillic – précisions demandées par certaines prestations (collecte des algues, épandage de boues)
 * Version 1.1 – 2026-11-13 : précision « boues » (station de provenance, preneur, parcelles et volume) ; 1.0 – 2026-11-03
 *
 * Prestations → « Précisions » : plage (plages du client, cases à cocher), remorques (preneurs et nombre
 * de remorques chez chacun), preneur (preneurs sans nombre). Le bloc n'apparaît que si une prestation du bon
 * (ou de la mission) le demande. Noms des preneurs libres, ceux déjà saisis sont proposés.
 * Boues : station choisie parmi celles du client (client proposé d'office : Paramètres → « Client boues »),
 *   preneur choisi dans la liste (Paramètres → « Preneurs boues ») ; sur le bon, parcelles avec volume (m³ ou t)
 *   — preneur = SARL : parcelles du référentiel et surface obligatoire ; sinon nom libre, surface facultative.
 *   Le volume total est proposé comme quantité des prestations « boues » qui ne sont pas à l'heure (ex. épandeur, t).
 * Utilisé par index.html (téléphone), bureau.html (mission et saisie de bon) et gestion.html (correction).
 *
 * Precisions.monter(conteneur, {
 *   mode: 'bon' | 'mission'        (mission : rien d'obligatoire, preneurs sans nombre de remorques)
 *   clients(), prestations(), preneurs()   : listes ({ code, plages }, { code, precisions, variantes }, noms)
 *   cadre                         : élément à masquer quand rien n'est demandé (par défaut le conteneur)
 *   bouton                        : classe du bouton « Ajouter un preneur »
 *   preneursBoues(), codeSarl(), parcellesSarl(), clientBoues() : listes et codes pour les boues
 *   choisirClient(code)           : place le client proposé pour les boues (si aucun client n'est choisi)
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
      + '@media (max-width:520px){.pr-preneur.avec{grid-template-columns:1fr auto}.pr-preneur.avec .pr-nb{grid-column:1}}';
    document.head.appendChild(s);
  }

  function monter(el, o) {
    css();
    o = o || {};
    var mission = o.mode === 'mission';
    var id = 'pr-liste-' + (++n);
    var cadre = o.cadre || el;
    var besoin = { plage: false, remorques: false, preneur: false, boues: false };
    var client = null;
    var plagesCochees = [];          // plages choisies (gardées quand la liste est redessinée)
    var preneurs = [];               // [{ nom, remorques }]
    var station = '', preneurBoues = ''; // boues : station de provenance, preneur (code client)
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
      var cont = o.lignes && o.lignes(), liste = listeBoues();
      if (!cont || !liste || !besoin.boues) return;
      var total = liste.volumeTotal();
      if (!(total > 0)) return;
      var ps = (o.prestations && o.prestations()) || [];
      Array.prototype.forEach.call(cont.children, function (l) {
        if (!l._opt) return;
        var sel = l.querySelector('select'), c = l._opt.code() || (sel ? sel.value : '');
        var p = ps.filter(function (x) { return x.code === c || (x.variantes || []).indexOf(c) >= 0; })[0];
        var q = l.querySelector('.l-qte, .e-qte');
        if (!p || !q || (p.precisions || []).indexOf('boues') < 0) return;
        var u = (ps.filter(function (x) { return x.code === c; })[0] || p).unite || '';
        if (/^h(eures?)?$/i.test(String(u).trim())) return;
        if (q.value.trim() !== '' && q.value.trim() !== l._qBoues) return;
        q.value = l._qBoues = String(total).replace('.', ',');
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
      zone.innerHTML = h;
      cadre.hidden = !h;
      // Titre du cadre (legend ou h4) : « Épandage de boues » quand seules les boues sont demandées
      if (titreCadre) titreCadre.textContent = besoin.boues && !besoin.plage && !besoin.remorques && !besoin.preneur ? 'Épandage de boues' : titreOrigine;
      majParc();
      var lignes = zone.querySelectorAll('.pr-preneur');
      Array.prototype.forEach.call(lignes, function (d) { d.querySelector('.pr-retirer').hidden = lignes.length === 1; });
    }

    zone.addEventListener('click', function (e) {
      if (e.target.classList.contains('pr-ajout')) {
        lireEcran(); preneurs.push({ nom: '', remorques: '' }); dessiner();
        var l = zone.querySelectorAll('.pr-nom'); l[l.length - 1].focus();
      } else if (e.target.classList.contains('pr-retirer')) {
        e.target.closest('.pr-preneur').remove(); lireEcran(); dessiner();
      }
    });
    zone.addEventListener('change', function (e) {
      if (e.target.classList.contains('pr-preneur-boues')) { lireEcran(); dessiner(); proposerQuantite(); }
    });

    return {
      /** Client et codes des prestations choisies (lignes, variantes, options) : redessine le bloc si besoin. */
      maj: function (codeClient, codes) {
        lireEcran();
        var cl = ((o.clients && o.clients()) || []).filter(function (c) { return c.code === codeClient; })[0] || null;
        var ps = (o.prestations && o.prestations()) || [], b = { plage: false, remorques: false, preneur: false, boues: false };
        (codes || []).forEach(function (c) {
          ps.forEach(function (p) {
            if (p.code === c || (p.variantes || []).indexOf(c) >= 0) (p.precisions || []).forEach(function (k) { b[k] = true; });
          });
        });
        // Boues : client proposé d'office (SAUR) quand aucun client n'est encore choisi
        var proposer = b.boues && !besoin.boues && !codeClient && o.choisirClient && o.clientBoues && o.clientBoues();
        // Client changé : les plages cochées et la station qui ne sont pas les siennes sont retirées
        if (cl !== client && client) {
          plagesCochees = plagesCochees.filter(function (p) { return ((cl && cl.plages) || []).indexOf(p) >= 0; });
          if (station && ((cl && cl.stations) || []).indexOf(station) < 0) station = '';
        }
        if (b.plage === besoin.plage && b.remorques === besoin.remorques && b.preneur === besoin.preneur && b.boues === besoin.boues && cl === client) return;
        besoin = b; client = cl;
        dessiner();
        if (b.boues) proposerQuantite();
        if (proposer) o.choisirClient(o.clientBoues());
      },
      /**
       * { plages: [...], preneurs: [{ nom, remorques }], boues: { station, preneur, parcelles } }
       * (mission : preneurs = noms seuls ; boues sans parcelles).
       */
      lire: function () {
        lireEcran();
        var r = { plages: besoin.plage ? plagesCochees.slice() : [], preneurs: [], boues: { station: '', preneur: '', parcelles: [] } };
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
       * v = { plages: [...], preneurs: [{ nom, remorques }] ou [noms], station, preneurBoues, parcellesBoues: [{ code, nom, surface, volume }] } ;
       * null pour vider.
       */
      remplir: function (v) {
        v = v || {};
        plagesCochees = (v.plages || []).slice();
        preneurs = (v.preneurs || []).map(function (x) { return typeof x === 'string' ? { nom: x, remorques: '' } : { nom: x.nom || '', remorques: x.remorques === '' || x.remorques == null ? '' : String(x.remorques) }; });
        station = v.station || ''; preneurBoues = v.preneurBoues || '';
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
        return '';
      },
      besoins: function () { return { plage: besoin.plage, remorques: besoin.remorques, preneur: besoin.preneur, boues: besoin.boues }; },
      /** Liste des parcelles SARL chargée après coup : rafraîchit les choix. */
      rafraichirCodes: function () { if (listeSarl) listeSarl.rafraichirCodes(); }
    };
  }

  /**
   * Texte court pour les listes : « Penvins, Kerfontaine – Dupont (3 remorques), Martin (1 remorque) » ;
   * boues = { station, preneurNom, volume } : « boues Theix – Le Saindo → Launay Didier, 54 m³ ».
   */
  function resume(plages, preneurs, boues) {
    var p = (preneurs || []).map(function (x) {
      if (typeof x === 'string') return x;
      return x.nom + (x.remorques ? ' (' + x.remorques + ' remorque' + (x.remorques > 1 ? 's' : '') + ')' : '');
    });
    var b = boues && (boues.station || boues.preneurNom) ? 'boues ' + [boues.station, boues.preneurNom ? '→ ' + boues.preneurNom : ''].filter(Boolean).join(' ')
      + (boues.volume !== '' && boues.volume != null ? ', ' + String(boues.volume).replace('.', ',') + ' m³' : '') : '';
    return [(plages || []).join(', '), p.length ? 'preneur' + (p.length > 1 ? 's' : '') + ' : ' + p.join(', ') : '', b].filter(Boolean).join(' – ');
  }

  window.Precisions = { monter: monter, resume: resume };
})();
