/* 管理后台逻辑 */
(function () {
  "use strict";

  var S = window.Store;
  S.initSeed();

  var products = [];
  var meta = S.getMeta();
  var state = { page: 1, pageSize: 15, q: "", cat: "" };
  var editingId = "";
  var toastTimer = null;

  function $(id) { return document.getElementById(id); }

  function toast(msg) {
    var el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2400);
  }

  function load() {
    products = S.getProducts().map(S.normalizeProduct);
    meta = S.getMeta();
  }

  function save() {
    var ok = S.setProducts(products);
    if (!ok) {
      toast("保存失败：浏览器存储空间不足，建议减少图片或改用图片链接");
      return false;
    }
    return true;
  }

  /* ---------- 统计 ---------- */
  function renderStats() {
    $("statTotal").textContent = products.length;
    var cats = {}, brands = {};
    products.forEach(function (p) {
      cats[p.category] = 1;
      if (p.brand) brands[p.brand] = 1;
    });
    $("statCat").textContent = Object.keys(cats).length;
    $("statBrand").textContent = Object.keys(brands).length;
    $("statNoImg").textContent = products.filter(function (p) { return !p.images.length; }).length;
  }

  function renderStorage() {
    var bytes = S.bytesOfLocalStorage();
    var pct = Math.min(100, bytes / (5 * 1024 * 1024) * 100);
    $("storageText").textContent = S.formatBytes(bytes) + " / 约 5 MB";
    $("storageBar").style.width = pct.toFixed(1) + "%";
    $("storageBar").style.background = pct > 80
      ? "linear-gradient(90deg,#d9534f,#a3281a)"
      : "linear-gradient(90deg,#e8a33d,#c0432a)";
  }

  /* ---------- 列表 ---------- */
  function filtered() {
    var q = state.q.trim().toLowerCase();
    return products.filter(function (p) {
      if (state.cat && p.category !== state.cat) return false;
      if (!q) return true;
      return [p.name, p.brand, p.category, p.spec, p.barcode].join(" ").toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return b.updatedAt - a.updatedAt; });
  }

  function thumb(p) {
    if (p.images && p.images[0]) {
      return '<div class="cell-thumb"><img src="' + S.escapeHtml(p.images[0]) + '" alt=""></div>';
    }
    var c = S.paletteFor(p.category);
    return '<div class="cell-thumb" style="background:linear-gradient(145deg,' + c[0] + "," + c[1] + ')">' +
      S.escapeHtml((p.name || "产").slice(0, 1)) + "</div>";
  }

  function renderTable() {
    var list = filtered();
    var totalPages = Math.max(1, Math.ceil(list.length / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;
    var start = (state.page - 1) * state.pageSize;
    var rows = list.slice(start, start + state.pageSize);

    $("prodBody").innerHTML = rows.length ? rows.map(function (p) {
      return "<tr>" +
        "<td>" + thumb(p) + "</td>" +
        '<td><div class="cell-name">' + S.escapeHtml(p.name) +
          "<small>更新 " + S.formatDate(p.updatedAt) + "</small></div></td>" +
        "<td>" + S.escapeHtml(p.brand || "—") + "</td>" +
        "<td>" + S.escapeHtml(p.category) + "</td>" +
        "<td>" + S.escapeHtml(p.spec || "—") + "</td>" +
        "<td>" + S.escapeHtml(p.barcode || "—") + "</td>" +
        '<td style="color:' + (p.featured ? "#c0432a" : "#a0958b") + '">' + (p.featured ? "★ 精选" : "—") + "</td>" +
        '<td><div class="row-actions">' +
          '<button class="mini-btn" data-edit="' + S.escapeHtml(p.id) + '">编辑</button>' +
          '<button class="mini-btn danger" data-del="' + S.escapeHtml(p.id) + '">删除</button>' +
        "</div></td></tr>";
    }).join("") : '<tr><td colspan="8" style="text-align:center;color:#91847a;padding:28px">' +
      (products.length ? "没有匹配的产品" : "还没有产品，点「新增」或「导入 CSV」开始录入") + "</td></tr>";

    $("pager").innerHTML = "<span>共 " + list.length + " 条 · 第 " + state.page + " / " + totalPages + " 页</span>" +
      '<button data-page="prev" ' + (state.page <= 1 ? "disabled" : "") + ">上一页</button>" +
      '<button data-page="next" ' + (state.page >= totalPages ? "disabled" : "") + ">下一页</button>";
    renderStorage();
  }

  function renderCatFilter() {
    var cats = {};
    products.forEach(function (p) { cats[p.category] = (cats[p.category] || 0) + 1; });
    var keys = Object.keys(cats).sort();
    $("prodCat").innerHTML = '<option value="">全部分类</option>' + keys.map(function (k) {
      return '<option value="' + S.escapeHtml(k) + '"' + (state.cat === k ? " selected" : "") + ">" +
        S.escapeHtml(k) + "（" + cats[k] + "）</option>";
    }).join("");
    $("catOptions").innerHTML = keys.map(function (k) {
      return '<option value="' + S.escapeHtml(k) + '"></option>';
    }).join("");
    var brands = {};
    products.forEach(function (p) { if (p.brand) brands[p.brand] = 1; });
    $("brandOptions").innerHTML = Object.keys(brands).sort().map(function (b) {
      return '<option value="' + S.escapeHtml(b) + '"></option>';
    }).join("");
  }

  /* ---------- 表单 ---------- */
  function openModal(p) {
    editingId = p ? p.id : "";
    $("modalTitle").textContent = p ? "编辑产品" : "新增产品";
    $("fName").value = p ? p.name : "";
    $("fBrand").value = p ? p.brand : "";
    $("fCategory").value = p ? p.category : (state.cat || "");
    $("fSpec").value = p ? p.spec : "";
    $("fUnit").value = p ? p.unit : "";
    $("fBarcode").value = p ? p.barcode : "";
    $("fTags").value = p ? (p.tags || []).join(",") : "";
    $("fDesc").value = p ? p.desc : "";
    $("fImages").value = p ? (p.images || []).join("|") : "";
    $("fFeatured").checked = !!(p && p.featured);
    $("imgHint").textContent = p && p.images.length ? "已有 " + p.images.length + " 张图片" : "未选图片时使用分类色块占位";
    $("modalMask").classList.add("show");
    setTimeout(function () { $("fName").focus(); }, 60);
  }

  function closeModal() {
    $("modalMask").classList.remove("show");
    editingId = "";
  }

  function saveProduct() {
    var name = $("fName").value.trim();
    var wasEditing = !!editingId;
    if (!name) { toast("请填写产品名称"); $("fName").focus(); return; }
    var data = S.normalizeProduct({
      id: editingId || S.uid(),
      name: name,
      brand: $("fBrand").value,
      category: $("fCategory").value,
      spec: $("fSpec").value,
      unit: $("fUnit").value,
      barcode: $("fBarcode").value,
      tags: $("fTags").value,
      desc: $("fDesc").value,
      images: $("fImages").value,
      featured: $("fFeatured").checked,
      updatedAt: Date.now()
    });
    if (editingId) {
      var idx = products.findIndex(function (p) { return p.id === editingId; });
      if (idx >= 0) products[idx] = data; else products.unshift(data);
    } else {
      products.unshift(data);
    }
    if (!save()) return;
    closeModal();
    renderCatFilter();
    renderStats();
    renderTable();
    toast(wasEditing ? "已保存修改：" + name : "已新增：" + name);
  }

  /* ---------- 图片压缩 ---------- */
  function compressImage(file, maxSide, quality) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("读取图片失败")); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("图片格式不支持")); };
        img.onload = function () {
          var w = img.width, h = img.height;
          if (Math.max(w, h) > maxSide) {
            var ratio = maxSide / Math.max(w, h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          var canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", quality || 0.72));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- 导入导出 ---------- */
  var HEADER_MAP = {
    "产品名称": "name", "名称": "name", "品名": "name", "产品名": "name",
    "品牌": "brand",
    "分类": "category", "品类": "category",
    "规格": "spec", "规格型号": "spec",
    "单位": "unit",
    "条码": "barcode", "条形码": "barcode",
    "卖点": "tags", "卖点标签": "tags", "标签": "tags",
    "描述": "desc", "产品介绍": "desc", "介绍": "desc",
    "图片": "images", "图片URL": "images", "图片地址": "images", "图片链接": "images",
    "精选": "featured", "是否精选": "featured"
  };

  function normalizeHeader(h) {
    return String(h || "").replace(/\s|　/g, "").trim();
  }

  function importCSV(text) {
    var rows = S.parseCSV(text);
    if (rows.length < 2) { toast("CSV 里没有可导入的数据"); return; }
    var headers = rows[0].map(function (h) {
      var key = normalizeHeader(h);
      return HEADER_MAP[key] || HEADER_MAP[key.replace(/（.*?）/g, "")] || "";
    });
    if (headers.indexOf("name") < 0) {
      toast("没识别到「产品名称」列，请用下载的模板表头");
      return;
    }
    var added = 0, updated = 0, skipped = 0;
    rows.slice(1).forEach(function (row) {
      var obj = {};
      headers.forEach(function (key, i) {
        if (key) obj[key] = (row[i] || "").trim();
      });
      if (!obj.name) { skipped++; return; }
      var data = S.normalizeProduct(Object.assign({}, obj, { updatedAt: Date.now() }));
      var idx = -1;
      if (data.barcode) {
        idx = products.findIndex(function (p) { return p.barcode && p.barcode === data.barcode; });
      }
      if (idx < 0) {
        idx = products.findIndex(function (p) {
          return p.name === data.name && (p.spec || "") === (data.spec || "");
        });
      }
      if (idx >= 0) {
        data.id = products[idx].id;
        data.createdAt = products[idx].createdAt;
        products[idx] = data;
        updated++;
      } else {
        products.unshift(data);
        added++;
      }
    });
    if (!save()) return;
    renderCatFilter();
    renderStats();
    renderTable();
    toast("导入完成：新增 " + added + " 条，更新 " + updated + " 条" + (skipped ? "，跳过 " + skipped + " 条" : ""));
  }

  function exportCSV() {
    var header = ["产品名称", "品牌", "分类", "规格", "单位", "条码", "卖点", "描述", "图片", "是否精选"];
    var rows = [header];
    products.forEach(function (p) {
      rows.push([p.name, p.brand, p.category, p.spec, p.unit, p.barcode,
        (p.tags || []).join("|"), p.desc, (p.images || []).join("|"), p.featured ? "是" : "否"]);
    });
    S.download("产品数据_" + new Date().toISOString().slice(0, 10) + ".csv", "\uFEFF" + S.toCSV(rows), "text/csv;charset=utf-8");
    toast("已导出 " + products.length + " 条产品");
  }

  function templateCSV() {
    var rows = [
      ["产品名称", "品牌", "分类", "规格", "单位", "条码", "卖点", "描述", "图片", "是否精选"],
      ["一品鲜酱油 500ml", "东古", "调味品", "500ml × 12瓶/箱", "箱", "6901234567890", "生抽,酿造", "天然酿造，适合家庭与餐饮", "https://img.example.com/1.jpg|https://img.example.com/2.jpg", "是"],
      ["水果硬糖 散装", "乐惠", "糖果", "500g/袋", "袋", "6901234567891", "多口味,散装", "多种水果风味，适合散称零售", "", "否"]
    ];
    S.download("产品导入模板.csv", "\uFEFF" + S.toCSV(rows), "text/csv;charset=utf-8");
  }

  function exportJSON() {
    S.download("产品数据_" + new Date().toISOString().slice(0, 10) + ".json",
      JSON.stringify({ meta: meta, products: products }, null, 2), "application/json");
    toast("已导出 JSON（可交给开发方做正式部署）");
  }

  function exportMiniProgram() {
    var content = "// 产品数据（由产品管理后台导出，覆盖小程序 data/products.js 后重新上传）\n" +
      "module.exports = " + JSON.stringify({ shop: meta, products: products }, null, 2) + ";\n";
    S.download("products.js", content, "application/javascript;charset=utf-8");
    toast("已导出 products.js（" + products.length + " 条），替换小程序 data/products.js 后重新上传");
  }

  /* ---------- 店铺信息 ---------- */
  function fillMeta() {
    $("mShop").value = meta.shopName || "";
    $("mSlogan").value = meta.slogan || "";
    $("mPhone").value = meta.phone || "";
    $("mWechat").value = meta.wechat || "";
    $("mAddress").value = meta.address || "";
    $("mHours").value = meta.hours || "";
    $("mQr").value = meta.qrcode || "";
    $("mIntro").value = meta.intro || "";
  }

  function saveMeta() {
    var m = {
      shopName: $("mShop").value.trim(),
      slogan: $("mSlogan").value.trim(),
      phone: $("mPhone").value.trim(),
      wechat: $("mWechat").value.trim(),
      address: $("mAddress").value.trim(),
      hours: $("mHours").value.trim(),
      qrcode: $("mQr").value.trim(),
      intro: $("mIntro").value.trim()
    };
    if (!m.shopName) { toast("请填写店铺名称"); $("mShop").focus(); return; }
    if (!S.setMeta(m)) { toast("保存失败，存储空间可能不足"); return; }
    meta = m;
    toast("店铺信息已保存");
  }

  /* ---------- 留言 ---------- */
  function renderMessages() {
    var list = S.getMessages();
    $("msgList").innerHTML = list.length ? list.map(function (m) {
      return '<div class="msg-item"><div class="top"><span>' + S.escapeHtml(m.name) + " · " +
        S.escapeHtml(m.phone) + '</span><small>' + S.formatDate(m.at) + "</small></div>" +
        (m.product ? '<div class="body" style="color:#c0432a;font-size:12px">咨询产品：' + S.escapeHtml(m.product) + "</div>" : "") +
        (m.note ? '<div class="body">' + S.escapeHtml(m.note) + "</div>" : "") +
        '<div style="margin-top:8px"><button class="mini-btn danger" data-delmsg="' + S.escapeHtml(m.id) + '">删除</button></div></div>';
    }).join("") : '<p style="color:#91847a;font-size:13px;padding:8px 0">还没有客户留言</p>';
  }

  /* ---------- 事件 ---------- */
  $("prodSearch").addEventListener("input", function (e) {
    state.q = e.target.value;
    state.page = 1;
    renderTable();
  });
  $("prodCat").addEventListener("change", function (e) {
    state.cat = e.target.value;
    state.page = 1;
    renderTable();
  });
  $("pager").addEventListener("click", function (e) {
    var b = e.target.closest("[data-page]");
    if (!b || b.disabled) return;
    if (b.getAttribute("data-page") === "prev") state.page--;
    else state.page++;
    renderTable();
  });
  $("prodBody").addEventListener("click", function (e) {
    var edit = e.target.closest("[data-edit]");
    var del = e.target.closest("[data-del]");
    if (edit) {
      var p = products.filter(function (x) { return x.id === edit.getAttribute("data-edit"); })[0];
      if (p) openModal(p);
      return;
    }
    if (del) {
      var id = del.getAttribute("data-del");
      var target = products.filter(function (x) { return x.id === id; })[0];
      if (!target) return;
      if (!confirm("确定删除「" + target.name + "」吗？删除后不可恢复。")) return;
      products = products.filter(function (x) { return x.id !== id; });
      if (!save()) return;
      renderCatFilter();
      renderStats();
      renderTable();
      toast("已删除");
    }
  });

  ["btnAdd", "btnAdd2"].forEach(function (id) {
    $(id).addEventListener("click", function () { openModal(null); });
  });
  $("btnCancel").addEventListener("click", closeModal);
  $("btnSave").addEventListener("click", saveProduct);
  $("modalMask").addEventListener("click", function (e) {
    if (e.target === $("modalMask")) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeModal(); }
  });

  $("btnImport").addEventListener("click", function () { $("fileInput").click(); });
  $("fileInput").addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) { toast("目前只支持 CSV，Excel 请先另存为 CSV"); e.target.value = ""; return; }
    S.readTextFile(file).then(function (text) {
      importCSV(text);
      e.target.value = "";
    }).catch(function (err) {
      toast(err.message || "文件读取失败");
      e.target.value = "";
    });
  });
  $("btnTemplate").addEventListener("click", templateCSV);
  $("btnExportCsv").addEventListener("click", exportCSV);
  $("btnExportJson").addEventListener("click", exportJSON);
  $("btnExportMini").addEventListener("click", exportMiniProgram);
  $("btnClear").addEventListener("click", function () {
    if (!products.length) { toast("当前没有产品"); return; }
    if (!confirm("将清空全部 " + products.length + " 条产品，且无法恢复（建议先导出 CSV 备份）。确定继续？")) return;
    products = [];
    if (!save()) return;
    renderCatFilter();
    renderStats();
    renderTable();
    toast("已清空，可点「恢复产品表」重新载入 991 条产品数据");
  });
  $("btnRestore").addEventListener("click", function () {
    if (!window.SEED_PRODUCTS) return;
    if (products.length && !confirm("恢复会覆盖当前 " + products.length + " 条产品，确定继续？")) return;
    products = window.SEED_PRODUCTS.map(S.normalizeProduct);
    if (!save()) return;
    renderCatFilter();
    renderStats();
    renderTable();
    toast("已恢复产品表（" + window.SEED_PRODUCTS.length + " 条）");
  });

  $("btnSaveMeta").addEventListener("click", saveMeta);
  $("btnQrUpload").addEventListener("click", function () {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", function () {
      var f = input.files && input.files[0];
      if (!f) return;
      compressImage(f, 480, 0.8).then(function (dataUrl) {
        $("mQr").value = dataUrl;
        toast("二维码已载入，记得点「保存店铺信息」");
      }).catch(function (err) { toast(err.message); });
    });
    input.click();
  });

  $("btnImgUpload").addEventListener("click", function () { $("imgFile").click(); });
  $("imgFile").addEventListener("change", function (e) {
    var files = Array.prototype.slice.call(e.target.files || []);
    if (!files.length) return;
    Promise.all(files.slice(0, 3).map(function (f) { return compressImage(f, 720, 0.72); }))
      .then(function (urls) {
        var cur = $("fImages").value.trim();
        $("fImages").value = (cur ? cur + "|" : "") + urls.join("|");
        $("imgHint").textContent = "已载入 " + urls.length + " 张压缩图片（约 " +
          Math.round(urls.join("").length / 1024) + " KB，建议批量时改用图片链接）";
        e.target.value = "";
      })
      .catch(function (err) { toast(err.message); e.target.value = ""; });
  });

  $("btnExportMsg").addEventListener("click", function () {
    var list = S.getMessages();
    if (!list.length) { toast("还没有留言"); return; }
    var rows = [["时间", "称呼", "电话", "咨询产品", "留言内容"]];
    list.forEach(function (m) {
      rows.push([S.formatDate(m.at), m.name, m.phone, m.product || "", m.note || ""]);
    });
    S.download("客户留言_" + new Date().toISOString().slice(0, 10) + ".csv", "\uFEFF" + S.toCSV(rows), "text/csv;charset=utf-8");
  });
  $("btnClearMsg").addEventListener("click", function () {
    var list = S.getMessages();
    if (!list.length) { toast("还没有留言"); return; }
    if (!confirm("将清空 " + list.length + " 条留言，确定继续？")) return;
    S.setMessages([]);
    renderMessages();
    toast("留言已清空");
  });
  $("msgList").addEventListener("click", function (e) {
    var b = e.target.closest("[data-delmsg]");
    if (!b) return;
    var id = b.getAttribute("data-delmsg");
    S.setMessages(S.getMessages().filter(function (m) { return m.id !== id; }));
    renderMessages();
    toast("已删除该条留言");
  });

  /* ---------- 初始化 ---------- */
  load();
  fillMeta();
  renderStats();
  renderCatFilter();
  renderTable();
  renderMessages();
})();
