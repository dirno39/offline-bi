/* Offline BI - 공통 유틸리티 */
(function () {
  'use strict';
  const BI = (window.BI = window.BI || {});

  let _uid = Date.now() % 100000;
  BI.uid = (p) => (p || 'id') + (++_uid).toString(36) + Math.random().toString(36).slice(2, 6);

  BI.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  BI.debounce = (fn, ms) => {
    let t;
    return function () {
      clearTimeout(t);
      const a = arguments;
      t = setTimeout(() => fn.apply(this, a), ms);
    };
  };

  BI.clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

  /* ---------- 숫자 포맷 ---------- */
  const nfCache = {};
  const nf = (min, max) => {
    const k = min + '_' + max;
    return nfCache[k] || (nfCache[k] = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: min, maximumFractionDigits: max }));
  };

  BI.NUM_FORMATS = [
    ['auto', '자동'],
    ['int', '정수 (1,234)'],
    ['dec1', '소수 1자리'],
    ['dec2', '소수 2자리'],
    ['pct', '백분율 (%)'],
    ['krw', '통화 (₩)'],
    ['usd', '통화 ($)'],
    ['k', '천 단위 (K)'],
    ['m', '백만 단위 (M)'],
    ['man', '만 단위'],
    ['eok', '억 단위'],
    ['compact', '간략 (만/억)'],
  ];

  BI.formatNumber = function (v, fmt) {
    if (v == null || v === '' || (typeof v === 'number' && !isFinite(v))) return '';
    if (typeof v !== 'number') return String(v);
    switch (fmt) {
      case 'int': return nf(0, 0).format(v);
      case 'dec1': return nf(1, 1).format(v);
      case 'dec2': return nf(2, 2).format(v);
      case 'pct': return nf(0, 1).format(v * 100) + '%';
      case 'krw': return '₩' + nf(0, 0).format(v);
      case 'usd': return '$' + nf(0, 2).format(v);
      case 'k': return nf(0, 1).format(v / 1e3) + 'K';
      case 'm': return nf(0, 2).format(v / 1e6) + 'M';
      case 'man': return nf(0, 1).format(v / 1e4) + '만';
      case 'eok': return nf(0, 2).format(v / 1e8) + '억';
      case 'compact': return BI.compact(v);
      default: {
        const a = Math.abs(v);
        if (Number.isInteger(v)) return nf(0, 0).format(v);
        if (a >= 100) return nf(0, 1).format(v);
        if (a >= 1) return nf(0, 2).format(v);
        return nf(0, 4).format(v);
      }
    }
  };

  BI.compact = function (v) {
    if (v == null || !isFinite(v)) return '';
    const a = Math.abs(v);
    if (a >= 1e12) return nf(0, 1).format(v / 1e12) + '조';
    if (a >= 1e8) return nf(0, 1).format(v / 1e8) + '억';
    if (a >= 1e4) return nf(0, 1).format(v / 1e4) + '만';
    if (Number.isInteger(v)) return nf(0, 0).format(v);
    return nf(0, 2).format(v);
  };

  BI.axisFormatter = (fmt) => (v) => {
    if (v === 0) return '0';
    if (fmt === 'pct') return BI.formatNumber(v, 'pct');
    if (fmt === 'auto' || !fmt || fmt === 'int' || fmt === 'dec1' || fmt === 'dec2') return BI.compact(v);
    return BI.formatNumber(v, fmt);
  };

  /* ---------- 날짜 ---------- */
  const p2 = (n) => (n < 10 ? '0' : '') + n;
  BI.fmtDate = function (ms, withTime) {
    if (ms == null || isNaN(ms)) return '';
    const d = new Date(ms);
    let s = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
    if (withTime && (d.getHours() || d.getMinutes() || d.getSeconds())) s += ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + (d.getSeconds() ? ':' + p2(d.getSeconds()) : '');
    return s;
  };
  BI.dateInputValue = (ms) => (ms == null ? '' : BI.fmtDate(ms));
  BI.parseDateInput = (s, endOfDay) => {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    return endOfDay ? new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999).getTime() : new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  };

  /* ---------- 정렬 ---------- */
  const collator = new Intl.Collator('ko-KR', { numeric: true, sensitivity: 'base' });
  BI.cmp = function (a, b) {
    if (a === b) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'boolean' && typeof b === 'boolean') return a ? 1 : -1;
    return collator.compare(String(a), String(b));
  };

  /* ---------- 아이콘 (SVG, 1.6px 선) ---------- */
  const ico = (d, sz) => '<svg viewBox="0 0 16 16" width="' + (sz || 14) + '" height="' + (sz || 14) + '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  BI.ICON = {
    chev: ico('<path d="M5 6.5l3 3 3-3"/>'),
    chevR: ico('<path d="M6.5 5l3 3-3 3"/>', 12),
    x: ico('<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>'),
    xl: ico('<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>', 18),
    check: ico('<path d="M3.5 8.5l3 3 6-7"/>'),
    more: '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="8" cy="3.5" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="8" cy="12.5" r="1.3"/></svg>',
    filter: ico('<path d="M2.5 3.5h11l-4.2 5v4l-2.6 1.2V8.5z"/>'),
    globe: ico('<circle cx="8" cy="8" r="5.8"/><path d="M2.2 8h11.6M8 2.2c1.7 1.8 2.4 3.7 2.4 5.8S9.7 12 8 13.8C6.3 12 5.6 10.1 5.6 8S6.3 4 8 2.2z"/>', 13),
    edit: ico('<path d="M10.5 2.8l2.7 2.7L6 12.7l-3.3.6.6-3.3z"/>'),
    plus: ico('<path d="M8 3v10M3 8h10"/>', 16),
    shield: ico('<path d="M8 1.8l5 2v3.8c0 3.1-2.1 5.6-5 6.6-2.9-1-5-3.5-5-6.6V3.8z"/><path d="M5.8 8l1.6 1.6 3-3.2"/>', 15),
  };

  /* ---------- 색상 ---------- */
  BI.PALETTES = {
    default: ['#3563e9', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948', '#86a6f4', '#f4a27f', '#7fd3b4', '#f5c866', '#f2b3cb', '#5db85d', '#a79ceb', '#ee9493'],
    classic: ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac', '#2f6497', '#d4a017', '#8cd17d', '#86bcb6', '#d37295', '#a0cbe8'],
    bright: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'],
    blue: ['#08306b', '#08519c', '#2171b5', '#4292c6', '#6baed6', '#9ecae1', '#c6dbef', '#3d5a80', '#98c1d9', '#293241'],
    warm: ['#9e0142', '#d53e4f', '#f46d43', '#fdae61', '#fee08b', '#e6ab02', '#a6761d', '#b35806', '#e08214', '#fdb863'],
    pastel: ['#8dd3c7', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5', '#bc80bd', '#ccebc5', '#ffed6f'],
    corporate: ['#1b3a5c', '#2e86ab', '#a23b72', '#f18f01', '#c73e1d', '#3b1f2b', '#6c757d', '#44af69', '#f8333c', '#2b9eb3'],
    mono: ['#212529', '#495057', '#6c757d', '#868e96', '#adb5bd', '#343a40', '#5c636a', '#7a8086', '#9aa0a6', '#c0c4c8'],
  };
  BI.PALETTE_NAMES = { default: '기본', classic: '클래식', bright: '선명', blue: '블루', warm: '따뜻한', pastel: '파스텔', corporate: '비즈니스', mono: '모노' };
  BI.SEQ = {
    blue: ['#e3ebfd', '#1c45b8'],
    green: ['#e5f5e0', '#006d2c'],
    orange: ['#fee6ce', '#a63603'],
    red: ['#fee0d2', '#a50f15'],
    purple: ['#efedf5', '#54278f'],
    diverge: ['#d1343e', '#f2f3f5', '#3563e9'],
  };
  BI.SEQ_NAMES = { blue: '파랑', green: '초록', orange: '주황', red: '빨강', purple: '보라', diverge: '발산(빨강-파랑)' };

  const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgb2hex = (r) => '#' + r.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
  BI.mix = (a, b, t) => {
    const A = hex2rgb(a), B = hex2rgb(b);
    return rgb2hex([0, 1, 2].map((i) => A[i] + (B[i] - A[i]) * t));
  };
  BI.colorScale = function (min, max, seq) {
    const stops = BI.SEQ[seq] || BI.SEQ.blue;
    const span = max - min || 1;
    return function (v) {
      if (v == null || isNaN(v)) return '#ccc';
      let t = Math.max(0, Math.min(1, (v - min) / span));
      if (stops.length === 3) {
        if (min < 0 && max > 0) {
          const m = Math.max(-min, max);
          t = (v + m) / (2 * m);
        }
        return t < 0.5 ? BI.mix(stops[0], stops[1], t * 2) : BI.mix(stops[1], stops[2], (t - 0.5) * 2);
      }
      return BI.mix(stops[0], stops[1], t);
    };
  };
  BI.textColorFor = (hex) => {
    const [r, g, b] = hex2rgb(hex);
    return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? '#222' : '#fff';
  };

  /* ---------- DOM ---------- */
  BI.$ = (sel, root) => (root || document).querySelector(sel);
  BI.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  BI.h = function (html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  BI.download = function (filename, data, mime) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
  };
  BI.downloadDataURL = function (filename, url) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  BI.toast = function (msg, kind) {
    let box = BI.$('#toastBox');
    if (!box) {
      box = BI.h('<div id="toastBox"></div>');
      document.body.appendChild(box);
    }
    const t = BI.h('<div class="toast ' + (kind || '') + '">' + BI.esc(msg) + '</div>');
    box.appendChild(t);
    setTimeout(() => t.classList.add('hide'), 2600);
    setTimeout(() => t.remove(), 3000);
  };

  /* 모달 */
  BI.modal = function (opts) {
    const ov = BI.h(
      '<div class="modal-ov"><div class="modal ' + (opts.cls || '') + '" style="' + (opts.width ? 'width:' + opts.width + 'px' : '') + '">' +
        '<div class="modal-hd"><span>' + BI.esc(opts.title || '') + '</span><button class="x" title="닫기">' + BI.ICON.xl + '</button></div>' +
        '<div class="modal-bd"></div><div class="modal-ft"></div></div></div>'
    );
    const bd = BI.$('.modal-bd', ov), ft = BI.$('.modal-ft', ov);
    if (typeof opts.body === 'string') bd.innerHTML = opts.body;
    else if (opts.body) bd.appendChild(opts.body);
    const close = () => {
      ov.remove();
      document.removeEventListener('keydown', onKey);
      opts.onClose && opts.onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter' && opts.enterSubmits !== false && e.target.tagName !== 'TEXTAREA') {
        const p = (opts.buttons || []).find((b) => b.primary);
        if (p) {
          e.preventDefault();
          if (p.onClick(bd) !== false) close();
        }
      }
    };
    (opts.buttons || [{ text: '닫기' }]).forEach((b) => {
      const btn = BI.h('<button class="btn ' + (b.primary ? 'primary' : '') + (b.danger ? ' danger' : '') + '">' + BI.esc(b.text) + '</button>');
      btn.onclick = () => {
        if (!b.onClick || b.onClick(bd) !== false) close();
      };
      if (b.left) btn.style.marginRight = 'auto';
      ft.appendChild(btn);
    });
    BI.$('.x', ov).onclick = close;
    ov.addEventListener('mousedown', (e) => {
      if (e.target === ov) close();
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
    const f = BI.$('input,select,textarea', bd);
    if (f && opts.autofocus !== false) setTimeout(() => f.focus(), 30);
    return { el: ov, body: bd, close };
  };

  BI.prompt = function (title, value, cb) {
    BI.modal({
      title,
      width: 380,
      body: '<input class="inp" style="width:100%" value="' + BI.esc(value || '') + '">',
      buttons: [
        { text: '취소' },
        { text: '확인', primary: true, onClick: (bd) => { const v = BI.$('input', bd).value.trim(); if (!v) return false; cb(v); } },
      ],
    });
  };
  BI.confirm = function (msg, cb) {
    BI.modal({ title: '확인', width: 380, body: '<p>' + BI.esc(msg) + '</p>', buttons: [{ text: '취소' }, { text: '확인', primary: true, onClick: () => { cb(); } }] });
  };

  /* 컨텍스트 메뉴: items = [{text, onClick, checked, disabled, sub:[...], sep:true}] */
  BI.menu = function (x, y, items) {
    BI.closeMenus();
    const build = (list, px, py, level) => {
      const m = BI.h('<div class="ctx-menu" data-level="' + level + '"></div>');
      list.forEach((it) => {
        if (it.sep) return m.appendChild(BI.h('<div class="ctx-sep"></div>'));
        if (it.header) return m.appendChild(BI.h('<div class="ctx-header">' + BI.esc(it.header) + '</div>'));
        const row = BI.h(
          '<div class="ctx-item' + (it.disabled ? ' disabled' : '') + '">' +
            '<span class="ck">' + (it.checked ? BI.ICON.check : '') + '</span><span class="tx">' + BI.esc(it.text) + '</span>' +
            (it.sub ? '<span class="ar">' + BI.ICON.chevR + '</span>' : '') + '</div>'
        );
        if (it.sub) {
          row.addEventListener('mouseenter', () => {
            BI.$$('.ctx-menu', document).forEach((mm) => { if (+mm.dataset.level > level) mm.remove(); });
            const r = row.getBoundingClientRect();
            build(it.sub, r.right - 2, r.top - 4, level + 1);
          });
        } else {
          row.addEventListener('mouseenter', () => {
            BI.$$('.ctx-menu', document).forEach((mm) => { if (+mm.dataset.level > level) mm.remove(); });
          });
          if (!it.disabled)
            row.addEventListener('click', (e) => {
              e.stopPropagation();
              BI.closeMenus();
              it.onClick && it.onClick();
            });
        }
        m.appendChild(row);
      });
      document.body.appendChild(m);
      const r = m.getBoundingClientRect();
      if (px + r.width > innerWidth) px = Math.max(4, (level ? px - r.width * 2 + 4 : innerWidth - r.width - 4));
      if (py + r.height > innerHeight) py = Math.max(4, innerHeight - r.height - 4);
      m.style.left = px + 'px';
      m.style.top = py + 'px';
      return m;
    };
    build(items, x, y, 0);
    setTimeout(() => document.addEventListener('mousedown', BI._menuOutside, true), 0);
  };
  BI._menuOutside = function (e) {
    if (!e.target.closest('.ctx-menu')) BI.closeMenus();
  };
  BI.closeMenus = function () {
    BI.$$('.ctx-menu').forEach((m) => m.remove());
    document.removeEventListener('mousedown', BI._menuOutside, true);
  };

  /* 통계 */
  BI.quantile = function (sorted, q) {
    if (!sorted.length) return null;
    const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  };
  BI.niceCeil = function (v) {
    if (!v || v <= 0) return 100;
    const e = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / e;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
  };
})();
