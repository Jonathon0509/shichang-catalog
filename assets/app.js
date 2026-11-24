/* 客户端逻辑：路由、首页、列表、详情、联系 */
(function () {
  "use strict";

  var S = window.Store;
  S.initSeed();

  var view = document.getElementById("view");
  var topbar = document.getElementById("topbar");
  var tabbar = document.getElementById("tabbar");
  var sheet = document.getElementById("sheet");
  var sheetMask = document.getElementById("sheetMask");
  var toastEl = document.getElementById("toast");

  var products = [];
  var meta = S.getMeta();
  var state = { q: "", cat: "", brand: "", sort: "default", currentId: "", fromHash: "#/list", limit: 40 };
  var toastTimer = null;

  var I = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20.5 20.5l-3.9-3.9"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3.5 10.5L12 3.2l8.5 7.3"/><path d="M5.6 9.4V20.8h12.8V9.4"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="7.2" height="7.2" rx="1.8"/><rect x="13.3" y="3.5" width="7.2" height="7.2" rx="1.8"/><rect x="3.5" y="13.3" width="7.2" height="7.2" rx="1.8"/><rect x="13.3" y="13.3" width="7.2" height="7.2" rx="1.8"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6.6 3.8h2.9l1.4 3.9-2 1.4a12.4 12.4 0 005.9 5.9l1.4-2 3.9 1.4v2.9c0 1.2-1 2.1-2.2 2.1A16.7 16.7 0 014.5 6c0-1.2 1-2.2 2.1-2.2z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M20.5 12.4c0 3.9-3.8 7.1-8.5 7.1-1 0-1.9-.1-2.7-.4L4.5 20.8l1.1-3.7A6.9 6.9 0 013.5 12.4C3.5 8.5 7.3 5.3 12 5.3s8.5 3.2 8.5 7.1z"/></svg>'
  };

  /* ---------------- 工具 ---------------- */
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2200);
  }

  function go(hash) {
    if (location.hash === hash) {
      route();
    } else {
      location.hash = hash;
    }
  }

  function parseHash() {
    var raw = (location.hash || "").replace(/^#/, "") || "/home";
    var qi = raw.indexOf("?");
    var path = qi >= 0 ? raw.slice(0, qi) : raw;
    var query = {};
    if (qi >= 0) {
      raw.slice(qi + 1).split("&").forEach(function (kv) {
        if (!kv) return;
        var i = kv.indexOf("=");
        var k = i >= 0 ? kv.slice(0, i) : kv;
        var v = i >= 0 ? kv.slice(i + 1) : "";
        try {
          query[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
        } catch (e) {
          query[k] = v;
        }
      });
    }
    return { path: path, query: query };
  }

  function queryString(obj) {
    var parts = [];
    Object.keys(obj).forEach(function (k) {
      if (obj[k] !== "" && obj[k] !== undefined && obj[k] !== null) {
        parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]));
      }
    });
    return parts.length ? "?" + parts.join("&") : "";
  }

  function phoneLink() {
    var digits = (meta.phone || "").replace(/[^\d+]/g, "");
    return digits ? "tel:" + digits : "";
  }

  function copyText(text, label) {
    if (!text) { toast("尚未设置" + (label || "")); return; }
    function ok() { toast("已复制：" + text); }
    function legacy() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var done = false;
      try { done = document.execCommand("copy"); } catch (e) { done = false; }
      document.body.removeChild(ta);
      return done;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, function () {
        if (legacy()) ok(); else toast("复制失败，请长按文字手动复制");
      });
    } else if (legacy()) {
      ok();
    } else {
      toast("复制失败，请长按文字手动复制");
    }
  }

  /* ---------------- 视图片段 ---------------- */
  function placeholder(p, glyphSize) {
    var c = S.paletteFor(p.category);
    var glyph = (p.name || "产").replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, "").slice(0, 2) || "产";
    return '<div class="pimg" style="background:linear-gradient(145deg,' + c[0] + ',' + c[1] + ')">' +
      '<span class="glyph" style="font-size:' + (glyphSize || 40) + 'px">' + S.escapeHtml(glyph) + "</span>" +
      '<span class="cat-label">' + S.escapeHtml(p.category) + "</span>" +
      (p.featured ? '<span class="pick">精选</span>' : "") +
      "</div>";
  }

  function productCard(p) {
    var img = p.images && p.images[0]
      ? '<div class="pimg"><img src="' + S.escapeHtml(p.images[0]) + '" alt="' + S.escapeHtml(p.name) + '" loading="lazy">' +
        (p.featured ? '<span class="pick">精选</span>' : "") + "</div>"
      : placeholder(p, 40);
    return '<button class="pcard" data-act="product" data-id="' + S.escapeHtml(p.id) + '">' +
      img +
      '<div class="pbody">' +
        '<div class="pname">' + S.escapeHtml(p.name) + "</div>" +
        '<div class="pmeta">' + S.escapeHtml(p.brand || "未标注品牌") + " · " + S.escapeHtml(p.category) + "</div>" +
        (p.spec ? '<div class="pspec">' + S.escapeHtml(p.spec) + "</div>" : "") +
        '<div class="plink">查看详情 ›</div>' +
      "</div></button>";
  }

  function catList() {
    var map = {};
    products.forEach(function (p) {
      map[p.category] = (map[p.category] || 0) + 1;
    });
    return Object.keys(map).map(function (k) { return { name: k, count: map[k] }; })
      .sort(function (a, b) { return b.count - a.count; });
  }

  // 厂家官方标志（已统一处理为白底方形图，放 img/brands/）
  var BRAND_LOGOS = {
    "单山": "img/brands/单山.jpg",
    "千禾": "img/brands/千禾.jpg",
    "味好美": "img/brands/味好美.jpg",
    "李锦记": "img/brands/李锦记.jpg",
    "凤球唛": "img/brands/凤球唛.jpg",
    "东古": "img/brands/东古.jpg",
    "海天": "img/brands/海天.jpg",
    "上海梅林": "img/brands/上海梅林.jpg",
    "恒谊": "img/brands/恒谊.jpg"
  };

  // 分类代表图：挑每个分类里最有辨识度的一款做缩略图
  var CAT_PICK = {
    "酱油醋类": "p6928312916007",
    "复合调料": "p6930777200027",
    "酱菜": "p6940250300960",
    "普粉": "p6926375920467",
    "午餐肉": "p6902131110020",
    "芝麻/花椒油": "p6905113000500",
    "鸡精": "p6974237941891",
    "下饭菜": "p6901754040936"
  };

  function catImage(name, products) {
    var pick = CAT_PICK[name];
    var i, p;
    if (pick) {
      for (i = 0; i < products.length; i++) {
        p = products[i];
        if (p.id === pick && p.images && p.images[0]) return p.images[0];
      }
    }
    for (i = 0; i < products.length; i++) {
      p = products[i];
      if (p.category === name && p.images && p.images[0]) return p.images[0];
    }
    return "";
  }

  function brandList() {
    var map = {};
    products.forEach(function (p) {
      if (!p.brand) return;
      if (!map[p.brand]) map[p.brand] = { name: p.brand, count: 0, logo: BRAND_LOGOS[p.brand] || "", img: "" };
      map[p.brand].count += 1;
      if (!map[p.brand].img && p.images && p.images[0]) map[p.brand].img = p.images[0];
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.count - a.count; });
  }

  function setChrome(opts) {
    var back = opts.back
      ? '<button class="back" data-act="back" data-to="' + S.escapeHtml(opts.back) + '" aria-label="返回">‹</button>'
      : "";
    var right = opts.right || "";
    topbar.innerHTML = back + '<div class="title">' + S.escapeHtml(opts.title) + "</div>" + right;
    topbar.classList.toggle("scrolled", window.scrollY > 8);
    tabbar.style.display = opts.tabs ? "flex" : "none";
    tabbar.innerHTML = opts.tabs
      ? '<button class="tab ' + (opts.active === "home" ? "active" : "") + '" data-act="tab" data-to="#/home">' + I.home + "<span>首页</span></button>" +
        '<button class="tab ' + (opts.active === "list" ? "active" : "") + '" data-act="tab" data-to="#/list">' + I.grid + "<span>全部产品</span></button>" +
        '<button class="tab ' + (opts.active === "contact" ? "active" : "") + '" data-act="tab" data-to="#/contact">' + I.chat + "<span>联系我们</span></button>"
      : "";
    document.body.style.paddingBottom = opts.tabs ? "58px" : "0";
  }

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    document.body.classList.remove("list-mode");
    document.documentElement.classList.remove("list-mode");
    setChrome({
      title: meta.shopName || "产品中心",
      tabs: true,
      active: "home",
      right: '<a class="action" href="admin.html">管理</a>'
    });

    var cats = catList();
    var brands = brandList();
    var featured = products.filter(function (p) { return p.featured; })
      .sort(function (a, b) { return b.updatedAt - a.updatedAt; })
      .slice(0, 8);
    if (!featured.length) {
      featured = products.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; }).slice(0, 8);
    }

    var catHtml = cats.slice(0, 7).map(function (c) {
      var pal = S.paletteFor(c.name);
      var ci = catImage(c.name, products);
      var icon = ci
        ? '<div class="cat-icon cat-img"><img src="' + S.escapeHtml(ci) + '" loading="lazy" alt=""></div>'
        : '<div class="cat-icon" style="background:linear-gradient(145deg,' + pal[0] + ',' + pal[1] + ')">' +
          S.escapeHtml(c.name.slice(0, 1)) + "</div>";
      return '<button class="cat-item" data-act="cat" data-name="' + S.escapeHtml(c.name) + '">' +
        icon +
        '<div class="cat-name">' + S.escapeHtml(c.name) + "</div>" +
        '<div class="cat-count">' + c.count + " 款</div></button>";
    }).join("");

    catHtml += '<button class="cat-item" data-act="tab" data-to="#/list">' +
      '<div class="cat-icon" style="background:linear-gradient(145deg,#8a7a6b,#5c4d41)">' +
      '<span style="font-size:19px">⋯</span></div>' +
      '<div class="cat-name">全部分类</div><div class="cat-count">' + products.length + " 款</div></button>";

    var brandHtml = brands.slice(0, 12).map(function (b) {
      var pal = S.paletteFor(b.name);
      var logo = (b.logo || b.img)
        ? '<img class="brand-logo" src="' + S.escapeHtml(b.logo || b.img) + '" loading="lazy" alt="">'
        : '<span class="brand-logo ph" style="background:linear-gradient(145deg,' + pal[0] + ',' + pal[1] + ')">' +
          S.escapeHtml(b.name.slice(0, 1)) + "</span>";
      return '<button class="brand-pill" data-act="brand" data-name="' + S.escapeHtml(b.name) + '">' +
        logo + "<strong>" + S.escapeHtml(b.name) + "</strong><span>" + b.count + " 款产品</span></button>";
    }).join("");

    view.innerHTML =
      '<section class="hero">' +
        '<img class="hero-logo" src="img/logo_scmc.jpg" alt="">' +
        '<div class="eyebrow">PRODUCT CATALOG</div>' +
        "<h1>" + S.escapeHtml(meta.shopName || "产品中心") + "</h1>" +
        "<p>" + S.escapeHtml(meta.slogan || "产品齐全 · 欢迎来电咨询") + "</p>" +
        '<div class="hero-tags"><span>' + products.length + " 款在册产品</span><span>整箱起批</span><span>支持寄样</span></div>" +
      "</section>" +
      '<div class="search-wrap">' +
        '<button class="searchbar" data-act="tab" data-to="#/list" style="width:100%">' + I.search +
        '<span style="flex:1;text-align:left;font-size:14px;color:#b3a69b">搜索产品名称、规格、条码</span></button>' +
      "</div>" +
      '<section class="section"><div class="section-head"><h2>产品分类</h2>' +
        '<button class="more" data-act="tab" data-to="#/list">全部 ›</button></div>' +
        '<div class="cat-grid">' + catHtml + "</div></section>" +
      (brandHtml ? '<section class="section"><div class="section-head"><h2>合作品牌</h2></div>' +
        '<div class="brand-scroll">' + brandHtml + "</div></section>" : "") +
      '<section class="section"><div class="section-head"><h2>精选产品</h2>' +
        '<button class="more" data-act="tab" data-to="#/list">查看全部 ›</button></div>' +
        '<div class="product-grid">' + featured.map(productCard).join("") + "</div></section>" +
      '<section class="section" style="padding-bottom:24px">' +
        '<div class="notice" style="margin-top:14px;background:#f3ece3;border-color:#e7dbcc;color:#7c6a58">' +
        "本页仅用于产品展示，具体价格、库存与起订量请来电或留言咨询。</div>" +
      "</section>";

    window.scrollTo(0, 0);
  }

  /* ---------------- 列表 ---------------- */
  function filtered() {
    var q = (state.q || "").trim().toLowerCase();
    var list = products.filter(function (p) {
      if (state.cat && p.category !== state.cat) return false;
      if (state.brand && p.brand !== state.brand) return false;
      if (!q) return true;
      var hay = [p.name, p.brand, p.category, p.spec, p.unit, p.barcode, (p.tags || []).join(" ")].join(" ").toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    if (state.sort === "name") {
      list.sort(function (a, b) { return a.name.localeCompare(b.name, "zh"); });
    } else if (state.sort === "new") {
      list.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    } else {
      list.sort(function (a, b) {
        return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.updatedAt - a.updatedAt;
      });
    }
    return list;
  }

  var SORT_LABELS = { "default": "默认排序", "name": "名称排序", "new": "最近更新" };

  function productRow(p) {
    var thumb;
    if (p.images && p.images[0]) {
      thumb = '<div class="row-thumb"><img src="' + S.escapeHtml(p.images[0]) + '" alt="' + S.escapeHtml(p.name) + '" loading="lazy">' +
        (p.featured ? '<span class="pick">精选</span>' : "") + "</div>";
    } else {
      var c = S.paletteFor(p.category);
      var glyph = (p.name || "产").replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, "").slice(0, 2) || "产";
      thumb = '<div class="row-thumb" style="background:linear-gradient(145deg,' + c[0] + "," + c[1] + ')">' +
        '<span class="glyph">' + S.escapeHtml(glyph) + "</span>" +
        (p.featured ? '<span class="pick">精选</span>' : "") + "</div>";
    }
    return '<button class="row-card" data-act="product" data-id="' + S.escapeHtml(p.id) + '">' +
      thumb +
      '<div class="row-info">' +
        '<div class="row-name">' + S.escapeHtml(p.name) + "</div>" +
        '<div class="row-meta">' + S.escapeHtml(p.brand || "未标注品牌") + " · " + S.escapeHtml(p.category) + "</div>" +
        (p.spec ? '<div class="row-spec">' + S.escapeHtml(p.spec) + "</div>" : "") +
      "</div>" +
      '<span class="row-arrow">›</span>' +
      "</button>";
  }

  function sideItem(name, count, active, kind) {
    return '<button class="side-item' + (active ? " active" : "") + '" data-act="chip" data-kind="' + (kind || "cat") + '" data-name="' +
      S.escapeHtml(name) + '"><span class="side-name">' + S.escapeHtml(name || "全部产品") +
      '</span><span class="side-count">' + count + "</span></button>";
  }

  function chipsRow(kind, items, current) {
    var all = '<button class="chip ' + (current ? "" : "active") + '" data-act="chip" data-kind="' + kind + '" data-name="">全部</button>';
    return all + items.map(function (it) {
      return '<button class="chip ' + (current === it.name ? "active" : "") + '" data-act="chip" data-kind="' + kind + '" data-name="' +
        S.escapeHtml(it.name) + '">' + S.escapeHtml(it.name) + " " + it.count + "</button>";
    }).join("");
  }

  function renderList() {
    document.body.classList.add("list-mode");
    document.documentElement.classList.add("list-mode");
    var cats = catList();
    var brands = brandList();
    setChrome({
      title: state.brand || "全部产品",
      tabs: true,
      active: "list",
      back: "#/home"
    });

    // 左边栏 = 品牌，上方 = 分类
    var sideHtml = sideItem("", products.length, !state.brand, "brand") +
      brands.map(function (b) { return sideItem(b.name, b.count, state.brand === b.name, "brand"); }).join("");

    var catOptions = '<option value="">全部分类</option>' + cats.map(function (c) {
      return '<option value="' + S.escapeHtml(c.name) + '"' + (state.cat === c.name ? " selected" : "") +
        ">" + S.escapeHtml(c.name) + "（" + c.count + "）</option>";
    }).join("");

    view.innerHTML =
      '<div class="po-layout">' +
        '<aside class="po-side" id="catSide">' + sideHtml + "</aside>" +
        '<section class="po-main">' +
          '<div class="po-tools">' +
            '<div class="searchbar">' + I.search +
              '<input id="qInput" type="search" placeholder="搜索名称、品牌、规格、条码" value="' + S.escapeHtml(state.q) + '" autocomplete="off">' +
            "</div>" +
            '<div class="po-tool-row">' +
              '<select id="catSel" class="brand-select" aria-label="分类筛选">' + catOptions + "</select>" +
              '<button class="sort-btn" data-act="sort" id="sortBtn">' + SORT_LABELS[state.sort] + " ⇅</button>" +
            "</div>" +
            '<div class="result-line"><span id="resultCount"></span></div>' +
          "</div>" +
          '<div class="po-rows" id="listGrid"></div>' +
        "</section>" +
      "</div>";

    refreshList();
    window.scrollTo(0, 0);
    var mainPane = document.querySelector(".po-main");
    if (mainPane) mainPane.scrollTop = 0;
  }

  function refreshList() {
    var grid = document.getElementById("listGrid");
    var count = document.getElementById("resultCount");
    if (!grid) return;
    var list = filtered();
    var shown = list.slice(0, state.limit);
    grid.innerHTML = list.length
      ? shown.map(productRow).join("")
      : '<div class="empty"><div class="big">🔍</div><h3>没有找到相关产品</h3>' +
        "<p>试试更换关键词，或清空筛选条件重新查看</p>" +
        '<button class="chip active" style="margin-top:14px" data-act="reset">清空筛选</button></div>';

    var parent = grid.parentElement;
    var more = parent.querySelector(".load-more");
    if (more) more.remove();
    if (list.length > shown.length) {
      var btn = document.createElement("button");
      btn.className = "load-more";
      btn.setAttribute("data-act", "loadmore");
      btn.textContent = "加载更多（还有 " + (list.length - shown.length) + " 款）";
      parent.appendChild(btn);
    }

    if (count) {
      count.textContent = (state.brand || "全部产品") + (state.cat ? " · " + state.cat : "") + " · 共 " + list.length + " 款" +
        (list.length > shown.length ? "，已显示 " + shown.length : "");
    }
    var sortBtn = document.getElementById("sortBtn");
    if (sortBtn) sortBtn.innerHTML = SORT_LABELS[state.sort] + " ⇅";

    var side = document.getElementById("catSide");
    if (side) {
      Array.prototype.forEach.call(side.querySelectorAll(".side-item"), function (el) {
        el.classList.toggle("active", (el.getAttribute("data-name") || "") === (state.brand || ""));
      });
    }
    var catSel = document.getElementById("catSel");
    if (catSel) catSel.value = state.cat || "";
  }

  /* ---------------- 详情 ---------------- */
  function renderDetail(id) {
    document.body.classList.remove("list-mode");
    document.documentElement.classList.remove("list-mode");
    var p = products.filter(function (x) { return x.id === id; })[0];
    setChrome({ title: "产品详情", tabs: false, back: state.fromHash || "#/list" });

    if (!p) {
      view.innerHTML = '<div class="empty" style="padding-top:80px"><div class="big">📄</div>' +
        "<h3>产品不存在或已删除</h3><p>可能已被管理后台移除</p>" +
        '<button class="chip active" style="margin-top:16px" data-act="tab" data-to="#/list">返回产品列表</button></div>';
      return;
    }
    state.currentId = p.id;

    var slides;
    if (p.images && p.images.length) {
      slides = p.images.map(function (src) {
        return '<div class="slide"><img src="' + S.escapeHtml(src) + '" alt="' + S.escapeHtml(p.name) + '"></div>';
      }).join("");
    } else {
      var c = S.paletteFor(p.category);
      slides = '<div class="slide" style="background:linear-gradient(145deg,' + c[0] + "," + c[1] + ')">' +
        '<span class="glyph">' + S.escapeHtml((p.name || "产").slice(0, 2)) + "</span>" +
        '<span class="cat-label">' + S.escapeHtml(p.category) + "</span></div>";
    }
    var dots = (p.images && p.images.length > 1)
      ? '<div class="dots">' + p.images.map(function (_, i) {
          return '<span class="dot' + (i === 0 ? " active" : "") + '"></span>';
        }).join("") + "</div>"
      : "";

    var paramRows = [
      ["规格", p.spec],
      ["单位", p.unit],
      ["条码", p.barcode],
      ["品类", p.category],
      ["品牌", p.brand]
    ].filter(function (r) { return r[1]; }).map(function (r) {
      return '<div class="param-row"><dt>' + r[0] + "</dt><dd>" + S.escapeHtml(r[1]) + "</dd></div>";
    }).join("");

    var tagHtml = [p.brand, p.category].filter(Boolean).map(function (t) {
      return '<span class="tag">' + S.escapeHtml(t) + "</span>";
    }).join("") + (p.tags || []).map(function (t) {
      return '<span class="tag neutral">' + S.escapeHtml(t) + "</span>";
    }).join("");

    var reco = products.filter(function (x) {
      return x.id !== p.id && (x.category === p.category || x.brand === p.brand);
    }).slice(0, 10);

    view.innerHTML =
      '<div class="detail-hero"><div class="carousel" id="carousel">' + slides + "</div>" + dots + "</div>" +
      '<div class="detail-main">' +
        '<h1 class="detail-title">' + S.escapeHtml(p.name) + "</h1>" +
        '<div class="detail-tags">' + tagHtml + "</div>" +
        (paramRows ? '<dl class="panel"><div class="panel-title">产品参数</div>' + paramRows + "</dl>" : "") +
        (p.desc ? '<div class="panel desc-panel"><div class="panel-title">产品介绍</div>' +
          '<div class="desc-text">' + S.escapeHtml(p.desc) + "</div></div>" : "") +
        (reco.length ? '<div class="reco"><div class="section-head"><h2>相关产品</h2></div>' +
          '<div class="reco-scroll">' + reco.map(function (r) {
            return '<button class="pcard reco-card" data-act="product" data-id="' + S.escapeHtml(r.id) + '">' +
              (r.images && r.images[0]
                ? '<div class="pimg"><img src="' + S.escapeHtml(r.images[0]) + '" loading="lazy" alt=""></div>'
                : placeholder(r, 26)) +
              '<div class="pbody" style="padding:0"><div class="pname" style="margin-top:6px">' + S.escapeHtml(r.name) +
              '</div><div class="pmeta">' + S.escapeHtml(r.brand || r.category) + "</div></div></button>";
          }).join("") + "</div></div>" : "") +
        '<div class="disclaimer">图片仅供参考，包装与规格以到货实物为准；价格请微信或电话询价。</div>' +
        '<div class="detail-space"></div>' +
      "</div>" +
      '<div class="bottom-bar">' +
        (phoneLink()
          ? '<a class="bb-ghost" href="' + phoneLink() + '">' + I.phone + "<span>电话咨询</span></a>"
          : '<button class="bb-ghost" data-act="call">' + I.phone + "<span>电话咨询</span></button>") +
        '<button class="bb-main" data-act="inquire" data-id="' + S.escapeHtml(p.id) + '">' + I.chat + "<span>微信询价</span></button>" +
      "</div>";

    var carousel = document.getElementById("carousel");
    if (carousel && p.images && p.images.length > 1) {
      carousel.addEventListener("scroll", function () {
        var idx = Math.round(carousel.scrollLeft / carousel.clientWidth);
        var dotsEl = document.querySelector(".dots");
        if (!dotsEl) return;
        Array.prototype.forEach.call(dotsEl.children, function (d, i) {
          d.className = "dot" + (i === idx ? " active" : "");
        });
      });
    }
    window.scrollTo(0, 0);
  }

  /* ---------------- 联系我们 ---------------- */
  function renderContact() {
    document.body.classList.remove("list-mode");
    document.documentElement.classList.remove("list-mode");
    setChrome({ title: "联系我们", tabs: true, active: "contact", back: "#/home" });

    view.innerHTML =
      '<div class="contact-hero"><div class="contact-card">' +
        "<h2>" + S.escapeHtml(meta.shopName) + "</h2>" +
        "<p>" + S.escapeHtml(meta.intro || meta.slogan) + "</p>" +
        '<div class="contact-btns">' +
          (phoneLink()
            ? '<a class="cb solid" href="' + phoneLink() + '">' + I.phone + "<span>立即拨号</span></a>"
            : '<button class="cb solid" data-act="call">' + I.phone + "<span>立即拨号</span></button>") +
          '<button class="cb" data-act="copy" data-value="' + S.escapeHtml(meta.wechat) + '" data-label="微信号">' + I.chat + "<span>复制微信</span></button>" +
        "</div></div></div>" +

      '<section class="section"><div class="info-list">' +
        '<button class="info-item" data-act="copy" data-value="' + S.escapeHtml(meta.phone) + '" data-label="电话">' +
          '<span class="ico">☎</span><span class="txt">' + S.escapeHtml(meta.phone || "未填写") +
          "<small>联系电话 · 点击复制</small></span><span class=\"copy\">复制</span></button>" +
        '<button class="info-item" data-act="copy" data-value="' + S.escapeHtml(meta.wechat) + '" data-label="微信号">' +
          '<span class="ico">💬</span><span class="txt">' + S.escapeHtml(meta.wechat || "未填写") +
          "<small>微信号 · 点击复制</small></span><span class=\"copy\">复制</span></button>" +
        '<button class="info-item" data-act="copy" data-value="' + S.escapeHtml(meta.address) + '" data-label="地址">' +
          '<span class="ico">📍</span><span class="txt">' + S.escapeHtml(meta.address || "未填写") +
          "<small>门店地址 · 点击复制</small></span><span class=\"copy\">复制</span></button>" +
        '<button class="info-item" data-act="map">' +
          '<span class="ico">🧭</span><span class="txt">打开地图导航<small>在高德地图中查看门店位置</small></span>' +
          '<span class="copy">查看</span></button>' +
        '<div class="info-item"><span class="ico">🕘</span><span class="txt">' + S.escapeHtml(meta.hours || "未填写") +
          "<small>营业时间</small></span></div>" +
      "</div></section>" +

      '<section class="section">' +
        '<div class="qr-box"><div class="qr-img">' +
          (meta.qrcode
            ? '<img src="' + S.escapeHtml(meta.qrcode) + '" alt="微信二维码">'
            : '<div class="ph">二维码<br>可在后台设置</div>') +
        "</div>" +
        '<div class="qr-txt"><h3>长按或扫码加微信</h3>' +
        "<p>添加时请备注「产品咨询」，方便我们快速对接你的需求。</p></div></div></section>" +

      '<section class="section" style="padding-bottom:24px">' +
        '<div class="section-head"><h2>询价与要货</h2></div>' +
        '<div class="form-card">' +
          '<div class="field"><label>微信号（微信与电话同号）</label>' +
            '<div class="inq-wx">' + S.escapeHtml(meta.wechat || meta.phone || "") + "</div></div>" +
          '<button class="submit-btn" data-act="copy" data-value="' + S.escapeHtml(meta.wechat || meta.phone || "") + '" data-label="微信号">复制微信号</button>' +
          '<div class="field hint" style="margin:10px 0 0">加微信请备注「产品咨询」，写清要的产品和数量，我们把价格、起订量与库存直接发你。</div>' +
        "</div></section>";

    window.scrollTo(0, 0);
  }

  /* ---------------- 留言 ---------------- */
  function submitMessage(nameEl, phoneEl, noteEl, productName, productId) {
    var name = (nameEl.value || "").trim();
    var phone = (phoneEl.value || "").trim();
    var note = (noteEl.value || "").trim();
    if (!name) { toast("请填写称呼"); nameEl.focus(); return false; }
    if (!/^[\d\-+() ]{6,20}$/.test(phone)) { toast("请填写有效的联系电话"); phoneEl.focus(); return false; }
    var ok = S.addMessage({
      id: S.uid(),
      name: name,
      phone: phone,
      note: note,
      product: productName || "",
      productId: productId || "",
      at: Date.now()
    });
    if (!ok) { toast("保存失败，浏览器存储空间可能已满"); return false; }
    toast("已提交，我们会尽快联系你");
    nameEl.value = "";
    phoneEl.value = "";
    noteEl.value = "";
    return true;
  }

  function openInquiry(id) {
    var p = products.filter(function (x) { return x.id === id; })[0] || {};
    var wx = meta.wechat || meta.phone || "";
    var tip = p.name
      ? "加微信时备注：" + p.name + (p.spec ? "（" + p.spec + "）" : "")
      : "加微信时备注「产品咨询」";
    sheet.innerHTML =
      '<div class="sheet-head"><h3>微信询价</h3>' +
        '<button class="close" data-act="close-sheet" aria-label="关闭">×</button></div>' +
      '<div class="form-card" style="box-shadow:none;padding:0;background:transparent">' +
        (p.name
          ? '<div class="field"><label>咨询产品</label><div class="inq-prod">' +
            S.escapeHtml(p.name) + (p.spec ? " · " + S.escapeHtml(p.spec) : "") + "</div></div>"
          : "") +
        '<div class="field"><label>微信号（微信与电话同号）</label>' +
          '<div class="inq-wx">' + S.escapeHtml(wx) + "</div></div>" +
        '<div class="inq-btns">' +
          '<button class="submit-btn" data-act="copy" data-value="' + S.escapeHtml(wx) + '" data-label="微信号">复制微信号</button>' +
          (phoneLink() ? '<a class="submit-btn" href="' + phoneLink() + '">直接拨号</a>' : "") +
        "</div>" +
        '<div class="field hint" style="margin:10px 0 0">' + S.escapeHtml(tip) + "，价格、起订量和库存我直接发你。</div>" +
      "</div>";
    sheetMask.classList.add("show");
    sheet.classList.add("show");
    sheet.setAttribute("aria-hidden", "false");
  }

  function closeSheet() {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    sheet.setAttribute("aria-hidden", "true");
    sheetMask.classList.remove("show");
    sheet.classList.remove("show");
  }

  /* ---------------- 路由 ---------------- */
  function route() {
    var r = parseHash();
    products = S.getProducts().map(S.normalizeProduct);
    meta = S.getMeta();

    if (r.path.indexOf("/detail/") === 0) {
      renderDetail(decodeURIComponent(r.path.slice(8)));
      return;
    }
    if (r.path === "/list") {
      state.q = r.query.q || "";
      state.cat = r.query.cat || "";
      state.brand = r.query.brand || "";
      renderList();
      return;
    }
    if (r.path === "/contact") {
      renderContact();
      return;
    }
    renderHome();
  }

  /* ---------------- 事件 ---------------- */
  document.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
    if (!el) return;
    var act = el.getAttribute("data-act");

    if (act === "tab") {
      var to = el.getAttribute("data-to");
      if (el.closest(".hero-tags")) return;
      go(to);
      return;
    }
    if (act === "back") {
      var backTo = el.getAttribute("data-to") || "#/home";
      go(backTo);
      return;
    }
    if (act === "cat") {
      state.cat = el.getAttribute("data-name");
      state.brand = "";
      state.q = "";
      go("#/list" + queryString({ cat: state.cat }));
      return;
    }
    if (act === "brand") {
      state.brand = el.getAttribute("data-name");
      state.cat = "";
      state.q = "";
      go("#/list" + queryString({ brand: state.brand }));
      return;
    }
    if (act === "product") {
      state.fromHash = location.hash || "#/list";
      go("#/detail/" + encodeURIComponent(el.getAttribute("data-id")));
      return;
    }
    if (act === "chip") {
      var kind = el.getAttribute("data-kind");
      var name = el.getAttribute("data-name");
      if (kind === "cat") state.cat = name;
      if (kind === "brand") state.brand = name;
      state.limit = 40;
      refreshList();
      history.replaceState(null, "", "#/list" + queryString({ cat: state.cat, brand: state.brand, q: state.q }));
      window.scrollTo(0, 0);
      return;
    }
    if (act === "loadmore") {
      state.limit += 40;
      refreshList();
      return;
    }
    if (act === "reset") {
      state.q = ""; state.cat = ""; state.brand = ""; state.limit = 40;
      var qi = document.getElementById("qInput");
      if (qi) qi.value = "";
      history.replaceState(null, "", "#/list");
      refreshList();
      return;
    }
    if (act === "sort") {
      state.sort = state.sort === "default" ? "name" : state.sort === "name" ? "new" : "default";
      state.limit = 40;
      refreshList();
      return;
    }
    if (act === "inquire") {
      openInquiry(el.getAttribute("data-id"));
      return;
    }
    if (act === "close-sheet") {
      closeSheet();
      return;
    }
    if (act === "call") {
      if (phoneLink()) location.href = phoneLink();
      else toast("尚未设置联系电话，请在管理后台填写");
      return;
    }
    if (act === "copy") {
      copyText(el.getAttribute("data-value"), el.getAttribute("data-label"));
      return;
    }
    if (act === "map") {
      if (!meta.address) { toast("尚未设置门店地址"); return; }
      window.open("https://uri.amap.com/search?keyword=" + encodeURIComponent(meta.shopName + " " + meta.address) + "&src=product-catalog", "_blank");
      return;
    }
  });

  document.addEventListener("input", function (e) {
    if (e.target && e.target.id === "qInput") {
      state.q = e.target.value;
      state.limit = 40;
      refreshList();
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target && (e.target.id === "catSel" || e.target.id === "brandSel")) {
      if (e.target.id === "catSel") state.cat = e.target.value;
      else state.brand = e.target.value;
      state.limit = 40;
      refreshList();
      history.replaceState(null, "", "#/list" + queryString({ cat: state.cat, brand: state.brand, q: state.q }));
      window.scrollTo(0, 0);
    }
  });

  sheetMask.addEventListener("click", closeSheet);
  window.addEventListener("scroll", function () {
    topbar.classList.toggle("scrolled", window.scrollY > 8);
  });
  window.addEventListener("hashchange", route);

  route();
})();
