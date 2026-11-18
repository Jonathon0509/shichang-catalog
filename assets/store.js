/* 公共数据层：本地存储、CSV 读写、格式化工具（客户端与管理后台共用） */
(function (global) {
  var KEYS = {
    products: "pc_products_v1",
    meta: "pc_meta_v1",
    messages: "pc_messages_v1",
    seeded: "pc_seeded_v2"
  };

  var FALLBACK_META = {
    shopName: "我的产品中心",
    slogan: "产品齐全 · 欢迎来电咨询",
    phone: "",
    wechat: "",
    address: "",
    hours: "",
    intro: "",
    qrcode: ""
  };

  var PALETTE = {
    "调味品": ["#C0432A", "#8C2A16"],
    "糖果": ["#E8A33D", "#C16A14"],
    "巧克力": ["#8A5730", "#513017"],
    "饼干糕点": ["#D98555", "#A65126"],
    "饮品冲调": ["#3F7A63", "#224E3D"],
    "休闲零食": ["#B85C64", "#7E333B"]
  };
  var DEFAULT_PALETTE = ["#6E7F94", "#3D4A5C"];

  /* 分类多时按名字散列到一组配色，保证相邻分类色块不撞色 */
  var PALETTE_LIST = [
    ["#C0432A", "#8C2A16"],
    ["#E8A33D", "#C16A14"],
    ["#8A5730", "#513017"],
    ["#D98555", "#A65126"],
    ["#3F7A63", "#224E3D"],
    ["#B85C64", "#7E333B"],
    ["#4A6E8A", "#26405A"],
    ["#A6522E", "#6E3018"],
    ["#7C6234", "#4A3818"],
    ["#8C4A6E", "#572B44"],
    ["#3E6B70", "#204446"],
    ["#6E7F94", "#3D4A5C"]
  ];

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function uid() {
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function initSeed() {
    var seeded = localStorage.getItem(KEYS.seeded);
    if (seeded) {
      if (!localStorage.getItem(KEYS.meta)) {
        writeJSON(KEYS.meta, global.SEED_META || FALLBACK_META);
      }
      return;
    }
    var existing = readJSON(KEYS.products, null);
    var legacySeed = localStorage.getItem("pc_seeded_v1");
    var isDemoSet = Array.isArray(existing) && existing.length && existing.length <= 30 &&
      existing.every(function (p) { return /^p0\d\d$/.test(String(p && p.id || "")); });

    var storedMeta = readJSON(KEYS.meta, null);
    var replaced = false;
    if (!Array.isArray(existing) || existing.length === 0 || (legacySeed && isDemoSet)) {
      writeJSON(KEYS.products, global.SEED_PRODUCTS || []);
      replaced = true;
    }
    var isDemoMeta = !storedMeta || !storedMeta.shopName ||
      String(storedMeta.shopName).indexOf("示例") === 0 ||
      String(storedMeta.shopName) === (FALLBACK_META.shopName);
    if (replaced || isDemoMeta) {
      writeJSON(KEYS.meta, global.SEED_META || FALLBACK_META);
    }
    if (!localStorage.getItem(KEYS.messages)) writeJSON(KEYS.messages, []);
    localStorage.setItem(KEYS.seeded, "1");
  }

  function getProducts() {
    var list = readJSON(KEYS.products, []);
    if (!Array.isArray(list)) return [];
    var imgMap = global.SEED_IMAGES || {};
    list.forEach(function (p) {
      if (p && (!p.images || !p.images.length) && imgMap[p.id]) {
        p.images = [imgMap[p.id]];
      }
    });
    return list;
  }

  function setProducts(list) {
    return writeJSON(KEYS.products, list || []);
  }

  function getMeta() {
    var meta = readJSON(KEYS.meta, FALLBACK_META);
    return Object.assign({}, FALLBACK_META, meta || {});
  }

  function setMeta(meta) {
    return writeJSON(KEYS.meta, meta || {});
  }

  function getMessages() {
    var list = readJSON(KEYS.messages, []);
    return Array.isArray(list) ? list : [];
  }

  function addMessage(msg) {
    var list = getMessages();
    list.unshift(msg);
    return writeJSON(KEYS.messages, list);
  }

  function setMessages(list) {
    return writeJSON(KEYS.messages, list || []);
  }

  function paletteFor(category) {
    if (PALETTE[category]) return PALETTE[category];
    var key = String(category || "");
    return PALETTE_LIST[hashOf(key) % PALETTE_LIST.length] || DEFAULT_PALETTE;
  }

  function hashOf(str) {
    var h = 0;
    for (var i = 0; i < (str || "").length; i++) {
      h = (h * 31 + str.charCodeAt(i)) % 100000;
    }
    return h;
  }

  function escapeHtml(str) {
    return String(str === undefined || str === null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeProduct(raw) {
    var p = raw || {};
    var images = p.images;
    if (typeof images === "string") {
      images = images.split("|").map(function (s) { return s.trim(); }).filter(Boolean);
    }
    if (!Array.isArray(images)) images = [];
    var tags = p.tags;
    if (typeof tags === "string") {
      tags = tags.split(/[|,，、\s]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    }
    if (!Array.isArray(tags)) tags = [];
    return {
      id: p.id || uid(),
      name: String(p.name || "").trim(),
      brand: String(p.brand || "").trim(),
      category: String(p.category || "").trim() || "未分类",
      spec: String(p.spec || "").trim(),
      unit: String(p.unit || "").trim(),
      barcode: String(p.barcode || "").trim(),
      tags: tags,
      desc: String(p.desc || "").trim(),
      images: images,
      featured: p.featured === true || p.featured === "是" || p.featured === "1",
      createdAt: p.createdAt || Date.now(),
      updatedAt: p.updatedAt || Date.now()
    };
  }

  /* ---- CSV ---- */
  function parseCSV(text) {
    text = String(text || "").replace(/^\uFEFF/, "");
    var rows = [], row = [], field = "", inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (inQuotes) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n") {
        row.push(field); rows.push(row); row = []; field = "";
      } else if (c === "\r") {
        /* 忽略 */
      } else {
        field += c;
      }
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) {
      return r.some(function (cell) { return String(cell).trim() !== ""; });
    });
  }

  function csvCell(value) {
    var s = value === undefined || value === null ? "" : String(value);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCSV(rows) {
    return rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n");
  }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  /* 读取用户选择的文件为文本，兼容 Excel 导出的 GBK 编码 CSV */
  function readTextFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("文件读取失败")); };
      reader.onload = function () {
        var buf = reader.result;
        var bytes = new Uint8Array(buf);
        var text = "";
        try {
          text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        } catch (err) {
          try {
            text = new TextDecoder("gbk").decode(bytes);
          } catch (e2) {
            text = new TextDecoder("utf-8").decode(bytes);
          }
        }
        resolve(text);
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function bytesOfLocalStorage() {
    var total = 0;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      total += (k || "").length + (localStorage.getItem(k) || "").length;
    }
    return total;
  }

  function formatBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / 1024 / 1024).toFixed(2) + " MB";
  }

  function formatDate(ts) {
    var d = new Date(ts || Date.now());
    function pad(n) { return n < 10 ? "0" + n : "" + n; }
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  global.Store = {
    KEYS: KEYS,
    FALLBACK_META: FALLBACK_META,
    initSeed: initSeed,
    getProducts: getProducts,
    setProducts: setProducts,
    getMeta: getMeta,
    setMeta: setMeta,
    getMessages: getMessages,
    addMessage: addMessage,
    setMessages: setMessages,
    normalizeProduct: normalizeProduct,
    paletteFor: paletteFor,
    hashOf: hashOf,
    uid: uid,
    escapeHtml: escapeHtml,
    parseCSV: parseCSV,
    toCSV: toCSV,
    download: download,
    readTextFile: readTextFile,
    bytesOfLocalStorage: bytesOfLocalStorage,
    formatBytes: formatBytes,
    formatDate: formatDate
  };
})(window);
