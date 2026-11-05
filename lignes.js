/**
 * ETA Oillic – options et variantes des prestations
 * Version 1.2 – 2026-11-05 : quantités en heures saisies en heures et minutes (duree)
 *
 * Options (colonne « Options » de l'onglet Prestations) : suppléments facturés comme un article EBP à part
 *   (ex. broyage de la paille du big baller). Case à cocher sous la prestation ; cochée, elle ajoute une ligne
 *   au bon, même unité, quantité = celle de la prestation par défaut (modifiable, jamais supérieure).
 *   Une option peut être un traitement phyto (ex. incorporation d'insecticide au semis).
 * Variantes (colonne « Variantes ») : la prestation n'est qu'un choix (ex. Broyeur) ; le chauffeur choisit
 *   la variante (Broyeur 3 m / 4 m), seul l'article de la variante part sur le bon.
 * Options et variantes ne sont pas proposées seules dans les listes de prestations.
 * Durées (v1.2) : pour une unité en heures, la quantité se saisit en heures et minutes ; le champ d'origine,
 *   masqué, garde la valeur en heures décimales arrondies au centième (2 h 30 → 2,5 ; 2 h 10 → 2,17), comme dans EBP.
 * Utilisé par index.html (téléphone), bureau.html (saisie) et gestion.html (correction).
 */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function nombre(s) { s = String(s).replace(/\s/g, '').replace(',', '.'); var v = Number(s); return s !== '' && isFinite(v) ? v : NaN; }
  function fr(n) { return isNaN(n) || n === '' || n == null ? '' : String(Math.round(n * 1000) / 1000).replace('.', ','); }
  var cssFait = false;
  function css() {
    if (cssFait) return; cssFait = true;
    var s = document.createElement('style');
    s.textContent = '.lo-options{grid-column:1/-1;display:grid;gap:6px;margin:2px 0 4px}'
      + '.lo-var{display:flex;align-items:center;gap:10px;font-weight:700}'
      + '.lo-var select{flex:1;margin:0}'
      + '.lo-opt{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-items:center;background:var(--vert-pale,#E4F1E4);border-radius:8px;padding:6px 10px}'
      + '.lo-opt>label{display:flex;align-items:center;gap:8px;font-weight:700;margin:0;grid-column:1/-1}'
      + '.lo-opt>label input{width:22px;height:22px;min-height:0;margin:0;flex:none}'
      + '.lo-qte{grid-column:1/-1;display:flex;align-items:center;gap:8px}'
      + '.lo-qte input{max-width:130px;margin:0}'
      + '.lo-qte small{color:var(--doux,#53636F)}'
      + '.lo-duree{display:flex;align-items:center;gap:6px;flex:1 1 auto;min-width:0}'
      + '.lo-duree input{display:block;flex:1 1 0;min-width:2.6em;width:auto;margin:0;text-align:right}'
      + '.lo-duree b{font-weight:700;flex:none}';
    document.head.appendChild(s);
  }

  /** Unité en heures (h, heure, heures). */
  function enHeures(u) { return /^h(eures?)?$/i.test(String(u || '').trim()); }
  /** 2,5 → « 2 h 30 » ; '' si vide. */
  function hm(v) {
    var n = typeof v === 'number' ? v : nombre(v);
    if (isNaN(n) || v === '' || v == null) return '';
    var t = Math.round(n * 60), h = Math.floor(t / 60), m = t % 60;
    return h + '\u00a0h\u00a0' + String(m).padStart(2, '0'); // espaces insécables : « 2 h 30 » jamais coupé
  }
  /**
   * Saisie en heures et minutes d'un champ de quantité (ou d'heures de travail) : deux cases à côté du champ,
   * qui est masqué et reçoit la valeur en heures décimales (événement « input »).
   * Renvoie { mode(enHeures), maj() } : maj() relit le champ après une modification faite par le programme.
   */
  function duree(input) {
    css();
    var box = document.createElement('span');
    box.className = 'lo-duree'; box.hidden = true;
    box.innerHTML = '<input type="text" class="lo-h" inputmode="numeric" autocomplete="off" aria-label="Heures" placeholder="0"><b>h</b>'
      + '<input type="text" class="lo-m" inputmode="numeric" autocomplete="off" aria-label="Minutes" placeholder="00"><b>min</b>';
    input.insertAdjacentElement('afterend', box);
    var h = box.querySelector('.lo-h'), m = box.querySelector('.lo-m'), actif = false;
    function depuisDecimal() {
      var v = nombre(input.value);
      if (isNaN(v)) { h.value = ''; m.value = ''; return; }
      var t = Math.round(v * 60);
      h.value = String(Math.floor(t / 60)); m.value = String(t % 60).padStart(2, '0');
    }
    function versDecimal() {
      var hs = h.value.trim(), ms = m.value.trim();
      if (!hs && !ms) input.value = '';
      else {
        var hv = hs ? nombre(hs) : 0, mv = ms ? nombre(ms) : 0;
        input.value = isNaN(hv) || isNaN(mv) || hv < 0 || mv < 0 ? '?' : fr(Math.round((hv + mv / 60) * 100) / 100);
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    h.addEventListener('input', versDecimal);
    m.addEventListener('input', versDecimal);
    return {
      mode: function (oui) { actif = !!oui; box.hidden = !actif; input.hidden = actif; if (actif) depuisDecimal(); },
      maj: function () { if (actif) depuisDecimal(); }
    };
  }

  /** Codes rattachés à une autre prestation active (options et variantes). */
  function codesRattaches(prestations) {
    var r = {};
    prestations.forEach(function (p) {
      if (p.actif === false) return;
      (p.options || []).concat(p.variantes || []).forEach(function (c) { r[c] = true; });
    });
    return r;
  }
  /** Prestations proposables seules (sans options ni variantes, sauf la valeur déjà choisie). */
  function principales(prestations, garder) {
    var o = codesRattaches(prestations);
    return prestations.filter(function (p) { return !o[p.code] || p.code === garder; });
  }
  function parCode(prestations) { var r = {}; prestations.forEach(function (p) { r[p.code] = p; }); return r; }
  /** Prestation « choix » dont ce code est une variante. */
  function groupeDe(code, prestations) {
    return prestations.filter(function (p) { return (p.variantes || []).indexOf(code) >= 0; })[0] || null;
  }
  /** Lignes d'un bon regroupées : [{ code (prestation ou choix), variante, quantite, options: [{ code, quantite }] }]. */
  function grouper(lignes, prestations) {
    var par = parCode(prestations), opt = {}, r = [];
    prestations.forEach(function (p) { (p.options || []).forEach(function (c) { opt[c] = true; }); });
    (lignes || []).forEach(function (l) {
      var parent = null;
      if (opt[l.code]) for (var i = r.length - 1; i >= 0; i--) {
        var p = par[r[i].variante || r[i].code];
        if (p && (p.options || []).indexOf(l.code) >= 0) { parent = r[i]; break; }
      }
      if (parent) { parent.options.push({ code: l.code, quantite: l.quantite }); return; }
      var g = groupeDe(l.code, prestations);
      r.push({ code: g ? g.code : l.code, variante: g ? l.code : '', quantite: l.quantite, options: [] });
    });
    return r;
  }

  /**
   * Attache variantes et options à une ligne de prestation.
   * o.prestations() : liste des prestations ({ code, libelle, unite, phyto, options, variantes }) ;
   * o.select, o.qte : champs de la ligne ; o.conteneur : où afficher la variante et les options.
   */
  function attacher(o) {
    css();
    var etat = {};      // code option → { coche, quantite, manuel }
    var variante = '';  // code de la variante choisie
    function trouver(c) { return o.prestations().filter(function (p) { return p.code === c; })[0]; }
    function choix() { var p = trouver(o.select.value); return p && (p.variantes || []).length ? p : null; }
    /** Prestation réellement facturée (la variante choisie, ou la prestation). */
    function effective() { var g = choix(); return g ? (variante ? trouver(variante) : null) : trouver(o.select.value); }
    function dessiner() {
      var g = choix(), h = '';
      if (g) {
        if (g.variantes.indexOf(variante) < 0) variante = '';
        h += '<label class="lo-var">Choisir :<select class="lo-variante" aria-label="Variante de ' + esc(g.libelle) + '"><option value="">—</option>'
          + g.variantes.map(function (c) { var x = trouver(c); return x ? '<option value="' + esc(c) + '"' + (c === variante ? ' selected' : '') + '>' + esc(x.libelle) + '</option>' : ''; }).join('')
          + '</select></label>';
      } else variante = '';
      var p = effective();
      h += ((p && p.options) || []).map(function (c) {
        var x = trouver(c);
        if (!x) return '';
        var e = etat[c] || {};
        return '<div class="lo-opt" data-option="' + esc(c) + '"><label><input type="checkbox" class="lo-coche"' + (e.coche ? ' checked' : '') + '> Option : ' + esc(x.libelle) + '</label>'
          + '<div class="lo-qte"' + (e.coche ? '' : ' hidden') + '><input type="text" inputmode="decimal" autocomplete="off" class="lo-q" aria-label="Quantité de l\'option" value="' + esc(e.quantite || '') + '">'
          + (enHeures(x.unite) ? '' : '<b>' + esc(x.unite) + '</b>') + '<small>au plus la quantité de la prestation</small></div></div>';
      }).join('');
      o.conteneur.innerHTML = h;
      o.conteneur.hidden = !h;
      // Options en heures : saisie en heures et minutes
      Array.prototype.forEach.call(o.conteneur.querySelectorAll('.lo-opt'), function (d) {
        var x = trouver(d.getAttribute('data-option'));
        if (x && enHeures(x.unite)) { d._duree = duree(d.querySelector('.lo-q')); d._duree.mode(true); }
      });
    }
    function lireEtat() {
      var v = o.conteneur.querySelector('.lo-variante'); if (v) variante = v.value;
      Array.prototype.forEach.call(o.conteneur.querySelectorAll('.lo-opt'), function (d) {
        var c = d.getAttribute('data-option'), e = etat[c] = etat[c] || {};
        e.coche = d.querySelector('.lo-coche').checked;
        e.quantite = d.querySelector('.lo-q').value.trim();
      });
    }
    function synchro(d, e) { if (e.coche && !e.manuel) { e.quantite = o.qte.value.trim(); d.querySelector('.lo-q').value = e.quantite; if (d._duree) d._duree.maj(); } }
    o.conteneur.addEventListener('change', function (ev) {
      if (ev.target.classList.contains('lo-variante')) { lireEtat(); dessiner(); return; }
      if (!ev.target.classList.contains('lo-coche')) return;
      var d = ev.target.closest('.lo-opt'), c = d.getAttribute('data-option');
      var e = etat[c] = etat[c] || {};
      e.coche = ev.target.checked;
      d.querySelector('.lo-qte').hidden = !e.coche;
      synchro(d, e);
    });
    o.conteneur.addEventListener('input', function (ev) {
      if (!ev.target.classList.contains('lo-q')) return; // cases heures/minutes : la valeur arrive par le champ de l'option
      var c = ev.target.closest('.lo-opt').getAttribute('data-option');
      var e = etat[c] = etat[c] || {};
      e.quantite = ev.target.value.trim(); e.manuel = e.quantite !== o.qte.value.trim();
    });
    // Quantité de la prestation modifiée : les options cochées non retouchées suivent
    o.qte.addEventListener('input', function () {
      Array.prototype.forEach.call(o.conteneur.querySelectorAll('.lo-opt'), function (d) { synchro(d, etat[d.getAttribute('data-option')] || {}); });
    });
    o.select.addEventListener('change', function () { lireEtat(); dessiner(); });
    dessiner();
    return {
      /** Code facturé pour la ligne : la variante choisie (vide si pas encore choisie), sinon la prestation. */
      code: function () { lireEtat(); var g = choix(); return g ? variante : o.select.value; },
      /** Lignes des options cochées, à placer juste après la ligne de la prestation. */
      lire: function () {
        lireEtat();
        var p = effective();
        return ((p && p.options) || []).filter(function (c) { return etat[c] && etat[c].coche; })
          .map(function (c) { return { code: c, quantite: etat[c].quantite, optionDe: p.code }; });
      },
      /** Ligne d'un bon existant : variante choisie et options cochées. */
      remplir: function (options, v) {
        variante = v || '';
        etat = {};
        (options || []).forEach(function (x) {
          var q = x.quantite === '' || x.quantite == null ? '' : (fr(nombre(x.quantite)) || String(x.quantite));
          etat[x.code] = { coche: true, quantite: q, manuel: q !== '' && nombre(q) !== nombre(o.qte.value) };
        });
        dessiner();
      },
      /** Traitement phyto de la ligne : { code, quantite, unite, parOption } ou null. */
      phyto: function () {
        lireEtat();
        var p = effective();
        if (!p) return null;
        if (p.phyto) return { code: p.code, quantite: o.qte.value.trim(), unite: p.unite, parOption: false };
        var c = (p.options || []).filter(function (c) { var x = trouver(c); return x && x.phyto && etat[c] && etat[c].coche; })[0];
        return c ? { code: c, quantite: etat[c].quantite, unite: trouver(c).unite, parOption: true } : null;
      },
      /** Coche l'option phyto (mission dont la prescription a déjà été préparée ou validée). */
      cocherPhyto: function () {
        var p = effective(); if (!p || p.phyto) return;
        (p.options || []).forEach(function (c) { var x = trouver(c); if (x && x.phyto) etat[c] = { coche: true, quantite: o.qte.value.trim(), manuel: false }; });
        dessiner();
      },
      /** Message d'erreur ou '' ; n : numéro de la ligne (messages). */
      verifier: function (n) {
        var g = choix();
        if (g && !variante) return 'Prestation ' + n + ' (' + g.libelle + ') : choisissez ' + g.variantes.map(function (c) { var x = trouver(c); return x ? x.libelle : c; }).join(' ou ') + '.';
        var q = nombre(o.qte.value), l = this.lire();
        for (var i = 0; i < l.length; i++) {
          var x = trouver(l[i].code) || { libelle: l[i].code };
          var qo = nombre(l[i].quantite);
          if (!(qo > 0)) return 'Prestation ' + n + ', option « ' + x.libelle + ' » : indiquez la quantité.';
          if (q > 0 && qo > q + 1e-9) return 'Prestation ' + n + ', option « ' + x.libelle + ' » : la quantité ne peut pas dépasser celle de la prestation (' + (enHeures(x.unite) ? hm(q) : fr(q)) + ').';
        }
        return '';
      },
      redessiner: function () { lireEtat(); dessiner(); }
    };
  }

  window.LignesOptions = { attacher: attacher, grouper: grouper, principales: principales, groupeDe: groupeDe, codesRattaches: codesRattaches,
    duree: duree, enHeures: enHeures, hm: hm };
})();
