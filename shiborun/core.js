/* しぼるん：検索条件 → Google検索URL の変換と、日本語の文章 → 検索条件 の簡易変換 */
(function (root) {
  "use strict";

  // 除外リストの初期値（lists.json が読めなかったときに使う）
  var DEFAULT_LISTS = {
    qa: ["chiebukuro.yahoo.co.jp", "oshiete.goo.ne.jp", "okwave.jp", "quora.com"],
    matome: ["togetter.com", "posfie.com", "my-best.com"],
    sns: ["x.com", "twitter.com", "instagram.com", "tiktok.com", "facebook.com", "threads.com"],
    video: ["youtube.com", "nicovideo.jp"]
  };

  var SOURCES = {
    official: { label: "公式サイトのみ", sites: [] },
    gov: { label: "政府・自治体のみ", sites: ["go.jp", "lg.jp"] },
    ac: { label: "大学・研究機関のみ", sites: ["ac.jp"] }
  };

  var EXCLUDES = {
    qa: "Q&Aサイト",
    matome: "まとめ・ランキング",
    sns: "SNS",
    video: "動画サイト"
  };

  var FILETYPES = {
    pdf: "PDF",
    pptx: "スライド",
    xlsx: "表（Excel）",
    docx: "Word文書"
  };

  var PERIODS = {
    d: "24時間以内",
    w: "1週間以内",
    m: "1か月以内",
    y: "1年以内",
    custom: "日付を指定"
  };

  var WORD_LIMIT = 32;

  function blankState() {
    return {
      q: "", exact: "", intitle: "", notWords: "",
      source: null,
      official: { name: "", sites: [] },
      ex: { qa: false, matome: false, sns: false, video: false },
      ft: null,
      period: null, after: "", before: "",
      web: true, ja: false, nfpr: false
    };
  }

  function splitTerms(s) {
    return String(s || "").split(/[,、，\n]/).map(function (t) { return t.trim(); }).filter(Boolean);
  }

  function includeSites(s) {
    if (s.source === "official") return s.official.sites.slice();
    if (s.source && SOURCES[s.source]) return SOURCES[s.source].sites.slice();
    return [];
  }

  function buildQuery(s, lists) {
    lists = lists || DEFAULT_LISTS;
    var p = [];
    if (s.q.trim()) p.push(s.q.trim().replace(/\s+/g, " "));
    splitTerms(s.exact).forEach(function (t) { p.push('"' + t.replace(/"/g, "") + '"'); });
    var it = s.intitle.trim().replace(/"/g, "");
    if (it) p.push(/\s/.test(it) ? 'intitle:"' + it + '"' : "intitle:" + it);
    splitTerms(s.notWords).forEach(function (t) { p.push("-" + t.replace(/\s+/g, "")); });

    var inc = includeSites(s);
    if (inc.length === 1) p.push("site:" + inc[0]);
    else if (inc.length > 1) p.push("(" + inc.map(function (d) { return "site:" + d; }).join(" OR ") + ")");

    // 対象サイトを絞っているときは、除外は意味がないので付けない（語数の節約）
    if (!inc.length) {
      Object.keys(EXCLUDES).forEach(function (k) {
        if (s.ex[k]) (lists[k] || []).forEach(function (d) { p.push("-site:" + d); });
      });
    }
    if (s.ft) p.push("filetype:" + s.ft);
    if (s.period === "custom") {
      if (s.after) p.push("after:" + s.after);
      if (s.before) p.push("before:" + s.before);
    }
    return p.join(" ");
  }

  function countWords(query) {
    return query ? query.split(/\s+/).filter(function (t) { return t && t !== "OR" && t !== "(" && t !== ")"; }).length : 0;
  }

  function buildUrl(s, lists) {
    var q = buildQuery(s, lists);
    var params = [["q", q], ["hl", "ja"]];
    if (s.period && s.period !== "custom") params.push(["tbs", "qdr:" + s.period]);
    if (s.web) params.push(["udm", "14"]);
    if (s.ja) params.push(["lr", "lang_ja"]);
    if (s.nfpr) params.push(["nfpr", "1"]);
    return "https://www.google.com/search?" + params.map(function (kv) {
      return kv[0] + "=" + encodeURIComponent(kv[1]);
    }).join("&");
  }

  // 条件を日本語の一文にする（プレビュー用）
  function summarize(s) {
    var parts = [];
    var inc = includeSites(s);
    if (s.source === "official") {
      parts.push(inc.length ? (s.official.name || "") + "の公式サイト（" + inc.join("・") + "）の中から" : "公式サイトの中から（対象がまだ決まっていません）");
    } else if (s.source) {
      parts.push(SOURCES[s.source].label.replace("のみ", "") + "のサイトの中から");
    }
    if (s.ft) parts.push(FILETYPES[s.ft] + "だけ");
    if (s.period && s.period !== "custom") parts.push(PERIODS[s.period]);
    if (s.period === "custom") {
      if (s.after && s.before) parts.push(s.after + "〜" + s.before + "の間");
      else if (s.after) parts.push(s.after + "以降");
      else if (s.before) parts.push(s.before + "より前");
    }
    if (!inc.length) {
      var exs = Object.keys(EXCLUDES).filter(function (k) { return s.ex[k]; }).map(function (k) { return EXCLUDES[k]; });
      if (exs.length) parts.push(exs.join("・") + "を除外");
    }
    if (s.exact.trim()) parts.push("「" + splitTerms(s.exact).join("」「") + "」を必ず含む");
    if (s.intitle.trim()) parts.push("タイトルに「" + s.intitle.trim() + "」");
    if (s.notWords.trim()) parts.push("「" + splitTerms(s.notWords).join("」「") + "」を含まない");
    var head = s.q.trim() ? "「" + s.q.trim() + "」を検索" : "";
    if (!head && !parts.length) return "キーワードを入れるか、下の条件を選んでください。";
    if (!parts.length) return head + "します。";
    return (head || "この条件で検索") + "：" + parts.join("、");
  }

  /* ---------- 日本語の文章 → 検索条件（簡易版・ルールベース） ---------- */

  var ORG_RE = /([一-龥々ァ-ヶーA-Za-zＡ-Ｚａ-ｚ0-9]{1,20}?(?:省|庁|府|県|都|道|市|区|町|村|大学|大学院|高校|機構|協会|学会|財団|銀行|新聞|放送|研究所|博物館|美術館))(?=$|[^一-龥々ァ-ヶー])/;

  function toHalfWidth(t) {
    return t.replace(/[０-９Ａ-Ｚａ-ｚ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/　/g, " ");
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function parseNatural(text, now) {
    now = now || new Date();
    var y = now.getFullYear();
    var t = toHalfWidth(String(text || "")).trim();
    var r = { q: "", source: null, orgName: "", ex: {}, ft: null, period: null, after: "", before: "", hits: [] };
    var rest = t;
    // 見つけた部分を取り除く。直後の助詞（「の」「を」など）も一緒に取る
    function cut(str) {
      var i = rest.indexOf(str);
      if (i < 0) return;
      rest = rest.slice(0, i) + " " + rest.slice(i + str.length).replace(/^(の|を|が|は|で|に|と|や|へ|も)/, "");
    }
    function take(re) { var m = rest.match(re); if (m) cut(m[0]); return m; }

    // 期間
    var m;
    if ((m = take(/(\d{4})年(?:度)?(?:以降|から|より後|より新しい)/))) { r.period = "custom"; r.after = m[1] + "-01-01"; }
    else if ((m = take(/(\d{4})年(?:度)?(?:まで|以前|より前|より古い)/))) { r.period = "custom"; r.before = (+m[1] + 1) + "-01-01"; }
    else if ((m = take(/(去年|昨年)(?:以降|から)/))) { r.period = "custom"; r.after = (y - 1) + "-01-01"; }
    else if ((m = take(/(去年|昨年)(?:の)?/))) { r.period = "custom"; r.after = (y - 1) + "-01-01"; r.before = y + "-01-01"; }
    else if ((m = take(/今年(?:の)?/))) { r.period = "custom"; r.after = y + "-01-01"; }
    else if ((m = take(/(今日|きょう|24時間|1日以内)(?:の)?/))) r.period = "d";
    else if ((m = take(/(今週|1週間|一週間)(?:以内)?(?:の)?/))) r.period = "w";
    else if ((m = take(/(今月|1か月|1ヶ月|1カ月|一か月|一ヶ月|ひと月)(?:以内)?(?:の)?/))) r.period = "m";
    else if ((m = take(/(最近|直近|最新|ここ1年|1年以内)(?:の)?/))) r.period = "y";
    if (r.period) r.hits.push("期間");

    // 除外（「〜なし」「〜を除いて」など）
    var NEG = "(?:は|を)?(?:なし|無し|抜き|除外|除いて|除く|以外|いらない|不要|見たくない)";
    if (take(new RegExp("(知恵袋|Q&A|QA|質問サイト|教えてgoo)" + NEG, "i"))) { r.ex.qa = true; r.hits.push("Q&A除外"); }
    if (take(new RegExp("(まとめ|ランキング|アフィリエイト|アフィ)(?:サイト)?" + NEG))) { r.ex.matome = true; r.hits.push("まとめ除外"); }
    if (take(new RegExp("(SNS|ツイッター|Twitter|インスタ|TikTok|ティックトック)" + NEG, "i"))) { r.ex.sns = true; r.hits.push("SNS除外"); }
    if (take(new RegExp("(動画|YouTube|ユーチューブ)" + NEG, "i"))) { r.ex.video = true; r.hits.push("動画除外"); }

    // 形式
    if (take(/PDF(?:で|の|が)?/i)) r.ft = "pdf";
    else if (take(/(スライド|パワポ|パワーポイント|PowerPoint)(?:で|の|が)?/i)) r.ft = "pptx";
    else if (take(/(エクセル|Excel|表計算)(?:で|の|が)?/i)) r.ft = "xlsx";
    else if (take(/(ワード|Word文書)(?:で|の|が)?/i)) r.ft = "docx";
    else if (take(/(資料|報告書|白書)(?:で|の|が|を)?/)) r.ft = "pdf";
    if (r.ft) r.hits.push("形式");

    // 情報源
    if (take(/公式(?:サイト|ページ|HP)?(?:で|の|から)?/i)) r.source = "official";
    var gov = !!take(/(政府|省庁|官公庁|役所|自治体|行政)(?:の|が|で|から)?/);
    var org = rest.match(ORG_RE);
    if (org) { r.orgName = org[1]; cut(org[1]); r.source = "official"; }
    else if (!r.source && gov) r.source = "gov";
    else if (!r.source && take(/(学術|研究機関|大学の研究)(?:の|が|で|から)?/)) r.source = "ac";
    if (r.source) r.hits.push("情報源");

    // 残りをキーワードにする
    rest = rest
      .replace(/(を|が|の)?(見たい|知りたい|調べたい|読みたい|探したい|探して(?:いる|る)?|ほしい|欲しい|教えて(?:ください)?|ください|について|に関して|に関する|関連の?|のこと|とか|など)/g, " ")
      .replace(/[、。,.!?！？「」『』()（）]/g, " ")
      .replace(/([^ぁ-ん\s])(の|を|が|は|で|に|と|や|へ|も)(?=[^ぁ-ん\s]|\s|$)/g, "$1 ")
      .split(/\s+/)
      .map(function (w) { return w.replace(/^(の|を|が|は|で|に|と|や|へ|も)(?=[^ぁ-ん])/, ""); })
      .filter(function (w) { return w && !/^[ぁ-ん]{1,3}$/.test(w); })
      .join(" ");
    r.q = rest.trim();
    return r;
  }

  var api = {
    DEFAULT_LISTS: DEFAULT_LISTS, SOURCES: SOURCES, EXCLUDES: EXCLUDES, FILETYPES: FILETYPES, PERIODS: PERIODS,
    WORD_LIMIT: WORD_LIMIT, blankState: blankState, buildQuery: buildQuery, buildUrl: buildUrl,
    countWords: countWords, summarize: summarize, parseNatural: parseNatural, pad: pad
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Shiborun = api;
})(this);
