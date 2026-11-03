/**
 * ETA Oillic – précisions demandées par certaines prestations (collecte des algues)
 * Version 1.0 – 2026-11-03
 *
 * Prestations → « Précisions » : plage (plages du client, cases à cocher), remorques (preneurs et nombre
 * de remorques chez chacun), preneur (preneurs sans nombre). Le bloc n'apparaît que si une prestation du bon
 * (ou de la mission) le demande. Noms des preneurs libres, ceux déjà saisis sont proposés.
 * Utilisé par index.html (téléphone), bureau.html (mission et saisie de bon) et gestion.html (correction).
 *
 * Precisions.monter(conteneur, {
 *   mode: 'bon' | 'mission'        (mission : rien d'obligatoire, preneurs sans nombre de remorques)
 *   clients(), prestations(), preneurs()   : listes ({ code, plages }, { code, precisions, variantes }, noms)
 *   cadre                         : élément à masquer quand rien n'est demandé (par défaut le conteneur)
 *   bouton                        : classe du bouton « Ajouter un preneur »
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
      + '@media (max-width:520px){.pr-preneur.avec{grid-template-columns:1fr auto}.pr-preneur.avec .pr-nb{grid-column:1}}';
    document.head.appendChild(s);
  }

  function monter(el, o) {
    css();
    o = o || {};
    var mission = o.mode === 'mission';
    var id = 'pr-liste-' + (++n);
    var cadre = o.cadre || el;
    var besoin = { plage: false, remorques: false, preneur: false };
    var client = null;
    var plagesCochees = [];          // plages choisies (gardées quand la liste est redessinée)
    var preneurs = [];               // [{ nom, remorques }]

    function lireEcran() {
      var cases = el.querySelectorAll('.pr-plage');
      if (cases.length || el.querySelector('.pr-plages')) {
        plagesCochees = Array.prototype.filter.call(cases, function (c) { return c.checked; }).map(function (c) { return c.value; });
      }
      var lignes = el.querySelectorAll('.pr-preneur');
      if (el.querySelector('.pr-preneurs')) {
        preneurs = Array.prototype.map.call(lignes, function (d) {
          var r = d.querySelector('.pr-r');
          return { nom: d.querySelector('.pr-nom').value.trim(), remorques: r ? r.value.trim() : '' };
        });
      }
    }
    function plagesClient() { return (client && client.plages) || []; }

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
      el.innerHTML = h;
      cadre.hidden = !h;
      var lignes = el.querySelectorAll('.pr-preneur');
      Array.prototype.forEach.call(lignes, function (d) { d.querySelector('.pr-retirer').hidden = lignes.length === 1; });
    }

    el.addEventListener('click', function (e) {
      if (e.target.classList.contains('pr-ajout')) {
        lireEcran(); preneurs.push({ nom: '', remorques: '' }); dessiner();
        var l = el.querySelectorAll('.pr-nom'); l[l.length - 1].focus();
      } else if (e.target.classList.contains('pr-retirer')) {
        e.target.closest('.pr-preneur').remove(); lireEcran(); dessiner();
      }
    });

    return {
      /** Client et codes des prestations choisies (lignes, variantes, options) : redessine le bloc si besoin. */
      maj: function (codeClient, codes) {
        lireEcran();
        var cl = ((o.clients && o.clients()) || []).filter(function (c) { return c.code === codeClient; })[0] || null;
        var ps = (o.prestations && o.prestations()) || [], b = { plage: false, remorques: false, preneur: false };
        (codes || []).forEach(function (c) {
          ps.forEach(function (p) {
            if (p.code === c || (p.variantes || []).indexOf(c) >= 0) (p.precisions || []).forEach(function (k) { b[k] = true; });
          });
        });
        // Client changé : les plages cochées qui ne sont pas les siennes sont retirées
        if (cl !== client && client) plagesCochees = plagesCochees.filter(function (p) { return ((cl && cl.plages) || []).indexOf(p) >= 0; });
        if (b.plage === besoin.plage && b.remorques === besoin.remorques && b.preneur === besoin.preneur && cl === client) return;
        besoin = b; client = cl;
        dessiner();
      },
      /** { plages: [...], preneurs: [{ nom, remorques }] } (preneurs : noms seuls pour une mission). */
      lire: function () {
        lireEcran();
        var r = { plages: besoin.plage ? plagesCochees.slice() : [], preneurs: [] };
        if (besoin.remorques || besoin.preneur) {
          r.preneurs = preneurs.filter(function (x) { return x.nom || x.remorques; })
            .map(function (x) { return mission ? x.nom : { nom: x.nom, remorques: besoin.remorques ? x.remorques : '' }; });
        }
        return r;
      },
      /** v = { plages: [...], preneurs: [{ nom, remorques }] ou [noms] } ; null pour vider. */
      remplir: function (v) {
        v = v || {};
        plagesCochees = (v.plages || []).slice();
        preneurs = (v.preneurs || []).map(function (x) { return typeof x === 'string' ? { nom: x, remorques: '' } : { nom: x.nom || '', remorques: x.remorques === '' || x.remorques == null ? '' : String(x.remorques) }; });
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
        return '';
      },
      besoins: function () { return { plage: besoin.plage, remorques: besoin.remorques, preneur: besoin.preneur }; }
    };
  }

  /** Texte court pour les listes : « Penvins, Kerfontaine – Dupont (3 remorques), Martin (1 remorque) ». */
  function resume(plages, preneurs) {
    var p = (preneurs || []).map(function (x) {
      if (typeof x === 'string') return x;
      return x.nom + (x.remorques ? ' (' + x.remorques + ' remorque' + (x.remorques > 1 ? 's' : '') + ')' : '');
    });
    return [(plages || []).join(', '), p.length ? 'preneur' + (p.length > 1 ? 's' : '') + ' : ' + p.join(', ') : ''].filter(Boolean).join(' – ');
  }

  window.Precisions = { monter: monter, resume: resume };
})();
