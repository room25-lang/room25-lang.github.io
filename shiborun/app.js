/* しぼるん：画面の動き */
(function () {
  "use strict";
  var S = window.Shiborun;
  var state = S.blankState();
  var lists = S.DEFAULT_LISTS;
  var STORE = "shiborun-v1";
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- 保存（端末の中だけ） ---------- */
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE)) || { fav: [], hist: [] }; }
    catch (e) { return { fav: [], hist: [] }; }
  }
  function save(d) { try { localStorage.setItem(STORE, JSON.stringify(d)); } catch (e) {} }
  var saved = load();

  /* ---------- チップ ---------- */
  function chipGroup(el, items, isOn, onTap) {
    el.innerHTML = "";
    Object.keys(items).forEach(function (k) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.dataset.k = k;
      b.textContent = typeof items[k] === "string" ? items[k] : items[k].label;
      b.addEventListener("click", function () { onTap(k); render(); });
      el.appendChild(b);
    });
    el._isOn = isOn;
  }
  function refreshChips(el) {
    Array.prototype.forEach.call(el.children, function (b) { b.setAttribute("aria-pressed", el._isOn(b.dataset.k) ? "true" : "false"); });
  }

  chipGroup($("g-source"), S.SOURCES, function (k) { return state.source === k; }, function (k) {
    state.source = state.source === k ? null : k;
    if (state.source === "official" && !$("orgName").value) $("orgName").value = state.official.name || firstWord(state.q);
  });
  chipGroup($("g-ex"), S.EXCLUDES, function (k) { return state.ex[k]; }, function (k) { state.ex[k] = !state.ex[k]; });
  chipGroup($("g-ft"), S.FILETYPES, function (k) { return state.ft === k; }, function (k) { state.ft = state.ft === k ? null : k; });
  chipGroup($("g-period"), S.PERIODS, function (k) { return state.period === k; }, function (k) { state.period = state.period === k ? null : k; });

  function firstWord(q) { return String(q || "").trim().split(/\s+/)[0] || ""; }

  /* ---------- 画面の更新 ---------- */
  function render() {
    ["g-source", "g-ex", "g-ft", "g-period"].forEach(function (id) { refreshChips($(id)); });
    $("officialBox").hidden = state.source !== "official";
    $("customBox").hidden = state.period !== "custom";
    var hasInc = state.source && (state.source !== "official" || state.official.sites.length);
    $("g-ex").style.opacity = hasInc ? ".45" : "1";
    $("exNote").hidden = !hasInc;

    var query = S.buildQuery(state, lists);
    $("summary").textContent = S.summarize(state);
    $("rawQuery").textContent = query || "（まだ空です）";
    var n = S.countWords(query);
    $("wordWarn").hidden = n <= S.WORD_LIMIT;
    $("wordWarn").textContent = "検索ワードが約" + n + "語あります。Googleは32語くらいまでしか使わないので、条件を減らしてください。";
    var ok = query.trim().length > 0;
    $("go").href = ok ? S.buildUrl(state, lists) : "https://www.google.com/";
    $("go").setAttribute("aria-disabled", ok ? "false" : "true");
    renderSaved();
  }

  function bindText(id, key) {
    $(id).addEventListener("input", function () { state[key] = $(id).value; render(); });
  }
  bindText("q", "q"); bindText("exact", "exact"); bindText("intitle", "intitle"); bindText("notWords", "notWords");
  ["web", "ja", "nfpr"].forEach(function (id) { $(id).addEventListener("change", function () { state[id] = $(id).checked; render(); }); });
  ["after", "before"].forEach(function (id) { $(id).addEventListener("change", function () { state[id] = $(id).value; render(); }); });

  function syncInputs() {
    $("q").value = state.q; $("exact").value = state.exact; $("intitle").value = state.intitle; $("notWords").value = state.notWords;
    $("web").checked = state.web; $("ja").checked = state.ja; $("nfpr").checked = state.nfpr;
    $("after").value = state.after; $("before").value = state.before;
    $("orgName").value = state.official.name || "";
  }

  /* ---------- 文章から条件を作る ---------- */
  $("auto").addEventListener("click", function () {
    var text = $("q").value.trim();
    if (!text) { showAuto("先に、調べたいことを文章で入れてください。"); return; }
    var r = S.parseNatural(text);
    var keep = { web: state.web, ja: state.ja, nfpr: state.nfpr };
    state = S.blankState();
    state.web = keep.web; state.ja = keep.ja; state.nfpr = keep.nfpr;
    state.q = r.q; state.source = r.source; state.ft = r.ft;
    state.period = r.period; state.after = r.after; state.before = r.before;
    Object.keys(r.ex).forEach(function (k) { state.ex[k] = true; });
    syncInputs();
    if (r.orgName) { $("orgName").value = r.orgName; findOfficial(r.orgName, true); }
    showAuto(r.hits.length ? "条件を作りました。違うところはチップを押して直せます。" : "条件になる言葉が見つからなかったので、キーワードだけにしました。");
    render();
  });
  function showAuto(t) { $("autoMsg").hidden = false; $("autoMsg").textContent = t; }

  $("reset").addEventListener("click", function () {
    state = S.blankState(); syncInputs();
    $("officialList").innerHTML = ""; $("officialMsg").textContent = ""; $("autoMsg").hidden = true;
    render();
  });

  /* ---------- 公式サイト判定（Wikidata） ---------- */
  var WD = "https://www.wikidata.org/w/api.php?format=json&origin=*&";
  var cache = {};

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
  }

  function findOfficial(name, autoPick) {
    name = String(name || "").trim();
    if (!name) { $("officialMsg").textContent = "名前を入れてください。"; return; }
    $("officialMsg").textContent = "「" + name + "」の公式サイトを探しています…";
    $("officialList").innerHTML = "";
    var p = cache[name] ? Promise.resolve(cache[name]) : lookup(name).then(function (c) { cache[name] = c; return c; });
    p.then(function (cands) {
      var withSite = cands.filter(function (c) { return c.sites.length; });
      if (!cands.length) { $("officialMsg").textContent = "見つかりませんでした。下からドメインを直接入力できます。"; return; }
      $("officialMsg").textContent = withSite.length ? "どれのことですか？" : "候補はありましたが、公式サイトが登録されていませんでした。ドメインを直接入力してください。";
      cands.forEach(function (c) {
        var li = document.createElement("li"), b = document.createElement("button");
        b.type = "button";
        b.disabled = !c.sites.length;
        b.setAttribute("aria-pressed", state.official.sites.join() === c.sites.join() && c.sites.length ? "true" : "false");
        var t = document.createElement("span"); t.textContent = c.label + (c.sites.length ? "　→ " + c.sites.join("・") : "　（公式サイト未登録）");
        var d = document.createElement("small"); d.textContent = c.desc || "";
        b.appendChild(t); b.appendChild(d);
        b.addEventListener("click", function () { pick(c.label, c.sites); });
        li.appendChild(b); $("officialList").appendChild(li);
      });
      // 自動変換から来て、候補が1つだけならそのまま使う
      if (autoPick && withSite.length === 1) pick(withSite[0].label, withSite[0].sites);
    }).catch(function () {
      $("officialMsg").textContent = "通信できませんでした。少し待ってもう一度試すか、ドメインを直接入力してください。";
    });
  }

  function pick(label, sites) {
    state.source = "official";
    state.official = { name: label, sites: sites.slice(0, 3) };
    Array.prototype.forEach.call($("officialList").querySelectorAll("button"), function (b) {
      b.setAttribute("aria-pressed", b.textContent.indexOf("→ " + sites.join("・")) >= 0 ? "true" : "false");
    });
    $("officialMsg").textContent = label + "の公式サイト（" + state.official.sites.join("・") + "）にしぼりました。";
    render();
  }

  function lookup(name) {
    return fetch(WD + "action=wbsearchentities&type=item&limit=7&language=ja&uselang=ja&search=" + encodeURIComponent(name))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var hits = (j.search || []);
        if (!hits.length) return [];
        var ids = hits.map(function (h) { return h.id; }).join("|");
        return fetch(WD + "action=wbgetentities&props=claims&ids=" + ids)
          .then(function (r) { return r.json(); })
          .then(function (e) {
            return hits.map(function (h) {
              var claims = (e.entities && e.entities[h.id] && e.entities[h.id].claims && e.entities[h.id].claims.P856) || [];
              // 日本語版のURL（言語の指定が日本語）を先に並べる
              claims = claims.slice().sort(function (a, b) { return isJa(b) - isJa(a); });
              var sites = [];
              claims.forEach(function (c) {
                var v = c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value;
                var host = v && hostOf(v);
                if (host && sites.indexOf(host) < 0) sites.push(host);
              });
              return { label: h.label || name, desc: h.description || "", sites: sites.slice(0, 3) };
            });
          });
      });
  }
  function isJa(c) {
    var q = c.qualifiers && c.qualifiers.P407;
    return q && q.some(function (x) { return x.datavalue && x.datavalue.value && x.datavalue.value.id === "Q5287"; }) ? 1 : 0;
  }

  $("findOfficial").addEventListener("click", function () { findOfficial($("orgName").value); });
  $("orgName").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); findOfficial($("orgName").value); } });
  $("useManual").addEventListener("click", function () {
    var v = $("manualDomain").value.trim();
    var host = /^https?:\/\//.test(v) ? hostOf(v) : v.replace(/^www\./, "").replace(/\/.*$/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) { $("officialMsg").textContent = "ドメインの形になっていません（例：example.co.jp）。"; return; }
    pick($("orgName").value.trim() || host, [host]);
  });

  /* ---------- 検索・保存・履歴 ---------- */
  function snapshot() { return JSON.parse(JSON.stringify(state)); }

  $("go").addEventListener("click", function (e) {
    if ($("go").getAttribute("aria-disabled") === "true") { e.preventDefault(); $("q").focus(); return; }
    saved.hist = [{ label: S.summarize(state), state: snapshot() }].concat(saved.hist.filter(function (h) {
      return JSON.stringify(h.state) !== JSON.stringify(state);
    })).slice(0, 10);
    save(saved); renderSaved();
  });

  $("fav").addEventListener("click", function () {
    if (!S.buildQuery(state, lists).trim()) return;
    saved.fav = [{ label: S.summarize(state), state: snapshot() }].concat(saved.fav).slice(0, 30);
    save(saved); render();
    $("fav").textContent = "★ 保存しました";
    setTimeout(function () { $("fav").textContent = "☆ 保存"; }, 1500);
  });

  function renderSaved() {
    var any = saved.fav.length || saved.hist.length;
    $("savedCard").hidden = !any;
    fill($("favList"), saved.fav, "fav");
    fill($("histList"), saved.hist, "hist");
  }
  function fill(ul, arr, key) {
    ul.innerHTML = "";
    if (!arr.length) { var e = document.createElement("li"); e.className = "msg"; e.textContent = "まだありません"; ul.appendChild(e); return; }
    arr.forEach(function (it, i) {
      var li = document.createElement("li");
      var u = document.createElement("button"); u.type = "button"; u.className = "use"; u.textContent = it.label;
      u.addEventListener("click", function () {
        state = Object.assign(S.blankState(), JSON.parse(JSON.stringify(it.state)));
        syncInputs(); render(); window.scrollTo({ top: 0, behavior: "smooth" });
      });
      var d = document.createElement("button"); d.type = "button"; d.className = "del"; d.textContent = "×"; d.title = "消す";
      d.addEventListener("click", function () { saved[key].splice(i, 1); save(saved); renderSaved(); });
      li.appendChild(u); li.appendChild(d); ul.appendChild(li);
    });
  }

  /* ---------- 除外リストの読み込み ---------- */
  fetch("lists.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (j) {
    var ok = {}; Object.keys(S.EXCLUDES).forEach(function (k) { ok[k] = Array.isArray(j[k]) ? j[k] : S.DEFAULT_LISTS[k]; });
    lists = ok; render();
  }).catch(function () {});

  syncInputs();
  render();
})();
