/* Offline BI - 데이터 로딩 / 타입 추론 / 샘플 데이터 */
(function () {
  'use strict';
  const BI = window.BI;
  const D = (BI.Data = {});

  D.COUNT_FIELD = { id: '__count', name: '레코드 수', type: 'number', role: 'measure', virtual: true };

  /* ---------- 파일 읽기 ---------- */
  D.readFile = function (file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsArrayBuffer(file);
    });
  };

  D.decodeText = function (buf) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
    } catch (e) {
      try {
        return new TextDecoder('euc-kr').decode(buf);
      } catch (e2) {
        return new TextDecoder('utf-8').decode(buf);
      }
    }
  };

  /* 파일 → 테이블 목록 [{name, aoa}] */
  D.parseFile = async function (file) {
    const name = file.name;
    const ext = (name.split('.').pop() || '').toLowerCase();
    const buf = await D.readFile(file);
    if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
      const text = D.decodeText(buf);
      return [{ name: name.replace(/\.[^.]+$/, ''), aoa: D.parseCSV(text, ext === 'tsv' ? '\t' : null) }];
    }
    if (ext === 'json') {
      const text = D.decodeText(buf);
      let j = JSON.parse(text);
      if (!Array.isArray(j)) {
        const k = Object.keys(j).find((k) => Array.isArray(j[k]));
        if (!k) throw new Error('JSON 배열을 찾을 수 없습니다.');
        j = j[k];
      }
      const cols = [];
      j.forEach((o) => Object.keys(o || {}).forEach((k) => { if (!cols.includes(k)) cols.push(k); }));
      return [{ name: name.replace(/\.[^.]+$/, ''), aoa: [cols].concat(j.map((o) => cols.map((c) => (o || {})[c]))) }];
    }
    if (typeof XLSX === 'undefined') throw new Error('엑셀 라이브러리를 불러오지 못했습니다.');
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: false, cellNF: true, cellText: false });
    return wb.SheetNames.map((sn) => ({ name: sn, aoa: D.sheetToAoa(wb.Sheets[sn]) })).filter((t) => t.aoa.length > 0);
  };

  D.sheetToAoa = function (ws) {
    if (!ws || !ws['!ref']) return [];
    const range = XLSX.utils.decode_range(ws['!ref']);
    const out = [];
    for (let R = range.s.r; R <= range.e.r; R++) {
      const row = [];
      let any = false;
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        let v = null;
        if (cell) {
          if (cell.t === 'n') {
            const fmt = cell.z;
            if (fmt && typeof fmt === 'string' && XLSX.SSF.is_date(fmt)) {
              const pd = XLSX.SSF.parse_date_code(cell.v);
              v = pd ? new Date(pd.y, pd.m - 1, pd.d, pd.H, pd.M, Math.round(pd.S)) : cell.v;
            } else v = cell.v;
          } else if (cell.t === 'd') v = cell.v instanceof Date ? cell.v : new Date(cell.v);
          else if (cell.t === 'b') v = cell.v ? 'TRUE' : 'FALSE';
          else if (cell.t === 'e') v = null;
          else v = cell.v;
        }
        if (v !== null && v !== '' && v !== undefined) any = true;
        row.push(v);
      }
      out.push(any ? row : null);
    }
    // 병합 셀(머리글) 처리: 병합 범위 값 채우기
    (ws['!merges'] || []).forEach((m) => {
      const base = out[m.s.r - range.s.r];
      if (!base) return;
      const v = base[m.s.c - range.s.c];
      for (let r = m.s.r; r <= m.e.r; r++) {
        const row = out[r - range.s.r];
        if (!row) continue;
        for (let c = m.s.c; c <= m.e.c; c++) if (row[c - range.s.c] == null) row[c - range.s.c] = v;
      }
    });
    return out.filter((r) => r);
  };

  /* ---------- CSV 파서 ---------- */
  D.detectDelimiter = function (text) {
    const line = text.slice(0, 5000).split(/\r?\n/).slice(0, 5).join('\n');
    const cands = [',', '\t', ';', '|'];
    let best = ',', bestN = 0;
    cands.forEach((d) => {
      let n = 0, q = false;
      for (const ch of line) {
        if (ch === '"') q = !q;
        else if (!q && ch === d) n++;
      }
      if (n > bestN) { best = d; bestN = n; }
    });
    return best;
  };

  D.parseCSV = function (text, delim) {
    delim = delim || D.detectDelimiter(text);
    const rows = [];
    let row = [], f = '', i = 0, q = false;
    const n = text.length;
    while (i < n) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { f += '"'; i += 2; continue; }
          q = false; i++; continue;
        }
        f += c; i++; continue;
      }
      if (c === '"' && f === '') { q = true; i++; continue; }
      if (c === delim) { row.push(f); f = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') {
        row.push(f); f = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = []; i++; continue;
      }
      f += c; i++;
    }
    if (f !== '' || row.length) { row.push(f); if (row.length > 1 || row[0] !== '') rows.push(row); }
    return rows;
  };

  /* ---------- 값 파싱 ---------- */
  const NUM_RE = /^[+-]?(?:[₩$€¥£]\s?)?(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?(?:[eE][+-]?\d+)?\s?(?:%|원)?$/;
  D.parseNumber = function (v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (v instanceof Date) return null;
    let s = String(v).trim();
    if (s === '' || s === '-') return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (!NUM_RE.test(s) || !/\d/.test(s)) return NaN;
    if (/^[+-]?0\d+$/.test(s)) return NaN; // 앞자리 0 → 코드값
    const pct = /%$/.test(s);
    s = s.replace(/[₩$€¥£,%원\s]/g, '');
    let n = parseFloat(s);
    if (isNaN(n)) return NaN;
    if (pct) n = n / 100;
    return neg ? -n : n;
  };

  const DATE_RES = [
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\.?(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?(?:Z|[+-]\d{2}:?\d{2})?$/,
    /^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  ];
  D.parseDate = function (v, allowCompact) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? NaN : v.getTime();
    if (typeof v === 'number') {
      if (allowCompact && v >= 19000101 && v <= 21001231) v = String(v);
      else return NaN;
    }
    const s = String(v).trim();
    for (const re of DATE_RES) {
      const m = re.exec(s);
      if (m) {
        const y = +m[1], mo = +m[2], d = +m[3];
        if (mo < 1 || mo > 12 || d < 1 || d > 31) return NaN;
        return new Date(y, mo - 1, d, +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
      }
    }
    let m = /^(\d{4})[-/.](\d{1,2})$/.exec(s) || /^(\d{4})\s*년\s*(\d{1,2})\s*월$/.exec(s);
    if (m && +m[2] >= 1 && +m[2] <= 12) return new Date(+m[1], +m[2] - 1, 1).getTime();
    if (allowCompact) {
      m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
      if (m && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    }
    return NaN;
  };

  D.convert = function (v, type, allowCompact) {
    if (v == null || v === '') return null;
    if (type === 'number') {
      const n = D.parseNumber(v);
      return n == null || isNaN(n) ? null : n;
    }
    if (type === 'date') {
      const n = D.parseDate(v, true);
      return n == null || isNaN(n) ? null : n;
    }
    if (type === 'bool') {
      if (typeof v === 'boolean') return v;
      const s = String(v).toLowerCase();
      return s === 'true' || s === '1' || s === 'y' || s === '참' ? true : s === 'false' || s === '0' || s === 'n' || s === '거짓' ? false : null;
    }
    if (v instanceof Date) return BI.fmtDate(v.getTime(), true);
    if (typeof v === 'number' && type === 'string') return String(v);
    return String(v);
  };

  const DIM_NAME_RE = /(^id$|_id$|\bid\b|코드|code|번호|no\.?$|^no$|우편|zip|연도|year|^년$|년도|^월$|month|전화|phone|사번|학번|key$)/i;
  const DATE_NAME_RE = /(일자|날짜|date|dt$|_dt|일시|기준일|년월)/i;

  D.inferType = function (values, name) {
    let n = 0, num = 0, date = 0, compactDate = 0;
    const lim = Math.min(values.length, 3000);
    const step = values.length > lim ? values.length / lim : 1;
    for (let k = 0; k < values.length && n < lim; k += step) {
      const v = values[Math.floor(k)];
      if (v == null || v === '') continue;
      n++;
      if (v instanceof Date) { date++; continue; }
      const pn = D.parseNumber(v);
      if (pn != null && !isNaN(pn)) {
        num++;
        if (/^\d{8}$/.test(String(v))) compactDate += isNaN(D.parseDate(v, true)) ? 0 : 1;
        continue;
      }
      const pd = D.parseDate(v, false);
      if (pd != null && !isNaN(pd)) date++;
    }
    if (n === 0) return 'string';
    if (date === n) return 'date';
    if (num === n) {
      if (compactDate === n && DATE_NAME_RE.test(name || '')) return 'date';
      return 'number';
    }
    if (num + date === n && date > 0 && DATE_NAME_RE.test(name || '')) return 'date';
    return 'string';
  };

  D.defaultRole = function (type, name) {
    if (type === 'number' && !DIM_NAME_RE.test(name || '')) return 'measure';
    return 'dimension';
  };

  /* aoa(첫 행=머리글) → 데이터 원본 */
  D.buildDataSource = function (name, aoa, opts) {
    opts = opts || {};
    let hi = 0;
    while (hi < aoa.length && !(aoa[hi] || []).some((v) => v != null && v !== '')) hi++;
    const header = (aoa[hi] || []).slice();
    const body = aoa.slice(hi + 1);
    const width = Math.max(header.length, ...body.slice(0, 200).map((r) => r.length));
    const used = {};
    const fields = [];
    for (let c = 0; c < width; c++) {
      let nm = header[c] == null || header[c] === '' ? '열' + (c + 1) : header[c] instanceof Date ? BI.fmtDate(header[c].getTime()) : String(header[c]).trim().replace(/\s+/g, ' ');
      let base = nm, i = 2;
      while (used[nm]) nm = base + ' (' + i++ + ')';
      used[nm] = 1;
      const col = body.map((r) => (r ? r[c] : null));
      const type = D.inferType(col, nm);
      fields.push({ id: 'f' + c + '_' + Math.random().toString(36).slice(2, 6), name: nm, type, role: D.defaultRole(type, nm), _c: c });
    }
    // 비어 있는 열 제거
    const keep = fields.filter((f) => body.some((r) => r && r[f._c] != null && r[f._c] !== ''));
    const rows = new Array(body.length);
    for (let r = 0; r < body.length; r++) {
      const src = body[r] || [];
      const o = {};
      for (const f of keep) o[f.id] = D.convert(src[f._c], f.type);
      rows[r] = o;
    }
    keep.forEach((f) => delete f._c);
    const ds = { id: BI.uid('ds'), name, fields: keep, rows, rawTypes: {} };
    return ds;
  };

  /* 필드 데이터 유형 변경 (원본 값 보존을 위해 문자열 경유) */
  D.changeType = function (ds, field, type) {
    const old = field.type;
    if (old === type) return;
    for (const r of ds.rows) {
      let v = r[field.id];
      if (old === 'date' && v != null) v = BI.fmtDate(v, true);
      r[field.id] = D.convert(v, type);
    }
    field.type = type;
    if (type === 'number' && field.role === 'dimension' && !DIM_NAME_RE.test(field.name)) field.role = 'measure';
    if (type !== 'number' && field.role === 'measure') field.role = 'dimension';
  };

  /* 다른 데이터 원본의 행 추가(유니온) - 이름 기준 매칭 */
  D.unionRows = function (ds, newDs) {
    const map = {};
    newDs.fields.forEach((f) => (map[f.name] = f));
    newDs.rows.forEach((r) => {
      const o = {};
      ds.fields.forEach((f) => {
        if (f.calc) return;
        const nf = map[f.name];
        o[f.id] = nf ? D.convert(nf.type === 'date' && r[nf.id] != null ? new Date(r[nf.id]) : r[nf.id], f.type) : null;
      });
      ds.rows.push(o);
    });
  };

  /* 데이터 교체 - 필드 이름 기준 매칭, 기존 필드 ID 유지 */
  D.replaceRows = function (ds, newDs) {
    const map = {};
    newDs.fields.forEach((f) => (map[f.name] = f));
    const missing = ds.fields.filter((f) => !f.calc && !map[f.name]).map((f) => f.name);
    ds.rows = [];
    D.unionRows(ds, newDs);
    // 새로 생긴 필드 추가
    const known = new Set(ds.fields.map((f) => f.name));
    newDs.fields.forEach((nf) => {
      if (known.has(nf.name)) return;
      const f = { id: nf.id, name: nf.name, type: nf.type, role: nf.role };
      ds.fields.push(f);
      ds.rows.forEach((r, i) => (r[f.id] = newDs.rows[i][nf.id]));
    });
    return missing;
  };

  /* 조인 */
  D.join = function (left, right, lk, rk, how, name) {
    const fields = [];
    const lmap = {}, rmap = {};
    const used = new Set();
    left.fields.forEach((f) => {
      const nf = { id: BI.uid('f'), name: f.name, type: f.type, role: f.role };
      used.add(nf.name);
      lmap[f.id] = nf.id;
      fields.push(nf);
    });
    right.fields.forEach((f) => {
      let nm = f.name;
      if (used.has(nm)) nm = nm + ' (' + right.name + ')';
      const nf = { id: BI.uid('f'), name: nm, type: f.type, role: f.role };
      used.add(nm);
      rmap[f.id] = nf.id;
      fields.push(nf);
    });
    const idx = new Map();
    right.rows.forEach((r) => {
      const k = r[rk] == null ? null : String(r[rk]);
      if (k == null) return;
      if (!idx.has(k)) idx.set(k, []);
      idx.get(k).push(r);
    });
    const rows = [];
    const matchedRight = new Set();
    const mk = (l, r) => {
      const o = {};
      if (l) for (const id in lmap) o[lmap[id]] = l[id] == null ? null : l[id];
      else for (const id in lmap) o[lmap[id]] = null;
      if (r) for (const id in rmap) o[rmap[id]] = r[id] == null ? null : r[id];
      else for (const id in rmap) o[rmap[id]] = null;
      return o;
    };
    left.rows.forEach((l) => {
      const k = l[lk] == null ? null : String(l[lk]);
      const m = k == null ? null : idx.get(k);
      if (m) m.forEach((r) => { rows.push(mk(l, r)); matchedRight.add(r); });
      else if (how === 'left' || how === 'full') rows.push(mk(l, null));
    });
    if (how === 'full') right.rows.forEach((r) => { if (!matchedRight.has(r)) rows.push(mk(null, r)); });
    return { id: BI.uid('ds'), name: name || left.name + ' + ' + right.name, fields: fields.filter((f) => !f.calc), rows };
  };

  /* 계산 필드 재계산 */
  D.applyCalcs = function (ds) {
    const errors = [];
    ds.fields.forEach((f) => {
      if (!f.calc) return;
      try {
        const c = BI.Calc.compile(f.calc, ds, f.id);
        f.type = c.type === 'any' ? f.type || 'string' : c.type;
        for (const r of ds.rows) {
          let v;
          try { v = c.fn(r); } catch (e) { v = null; }
          if (typeof v === 'number' && !isFinite(v)) v = null;
          if (v === undefined) v = null;
          r[f.id] = v;
        }
        f.error = null;
      } catch (e) {
        f.error = e.message;
        errors.push(f.name + ': ' + e.message);
        for (const r of ds.rows) r[f.id] = null;
      }
    });
    return errors;
  };

  D.fieldById = function (ds, id) {
    if (id === '__count') return D.COUNT_FIELD;
    return ds && ds.fields.find((f) => f.id === id);
  };

  /* ---------- 샘플 데이터 (가상의 사무용품 유통사 매출) ---------- */
  D.sampleDataSource = function () {
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const regions = {
      수도권: ['서울', '경기', '인천'],
      영남: ['부산', '대구', '울산', '경남', '경북'],
      호남: ['광주', '전남', '전북'],
      충청: ['대전', '세종', '충남', '충북'],
      강원: ['강원'],
      제주: ['제주'],
    };
    const regionW = [['수도권', 0.45], ['영남', 0.22], ['호남', 0.11], ['충청', 0.13], ['강원', 0.05], ['제주', 0.04]];
    const cats = {
      가구: [['의자', 180000], ['책상', 320000], ['책장', 210000], ['수납장', 150000], ['소파', 450000]],
      사무용품: [['필기구', 8000], ['용지', 25000], ['바인더', 12000], ['라벨', 9000], ['파일', 6000], ['문구세트', 30000]],
      전자기기: [['모니터', 280000], ['노트북', 1350000], ['프린터', 390000], ['키보드', 65000], ['복합기', 820000], ['헤드셋', 95000]],
    };
    const segs = [['개인', 0.5], ['기업', 0.32], ['공공', 0.18]];
    const ships = [['일반배송', 0.6], ['빠른배송', 0.25], ['당일배송', 0.1], ['방문수령', 0.05]];
    const channels = ['온라인몰', '오프라인 매장', '대리점', 'B2B 영업'];
    const wpick = (arr) => {
      let r = rnd(), acc = 0;
      for (const [v, w] of arr) { acc += w; if (r <= acc) return v; }
      return arr[arr.length - 1][0];
    };
    const F = (id, name, type, role) => ({ id, name, type, role });
    const fields = [
      F('order_id', '주문번호', 'string', 'dimension'),
      F('order_date', '주문일자', 'date', 'dimension'),
      F('ship_date', '배송일자', 'date', 'dimension'),
      F('ship_mode', '배송형태', 'string', 'dimension'),
      F('segment', '고객세그먼트', 'string', 'dimension'),
      F('channel', '판매채널', 'string', 'dimension'),
      F('region', '권역', 'string', 'dimension'),
      F('city', '시도', 'string', 'dimension'),
      F('category', '카테고리', 'string', 'dimension'),
      F('subcat', '하위카테고리', 'string', 'dimension'),
      F('sales', '매출', 'number', 'measure'),
      F('qty', '수량', 'number', 'measure'),
      F('discount', '할인율', 'number', 'measure'),
      F('profit', '이익', 'number', 'measure'),
      F('target', '목표매출', 'number', 'measure'),
    ];
    const rows = [];
    const start = new Date(2022, 0, 1).getTime();
    const days = 365 * 3;
    for (let i = 0; i < 6000; i++) {
      let dayOff = Math.floor(Math.pow(rnd(), 0.85) * days);
      const od = new Date(start + dayOff * 86400000);
      const mon = od.getMonth();
      if ((mon === 1 || mon === 6) && rnd() < 0.3) dayOff = Math.min(days - 1, dayOff + 30);
      const odate = new Date(od.getFullYear(), od.getMonth(), od.getDate()).getTime();
      const ship = wpick(ships);
      const lead = ship === '당일배송' ? 0 : ship === '빠른배송' ? 1 + Math.floor(rnd() * 2) : ship === '방문수령' ? Math.floor(rnd() * 3) : 2 + Math.floor(rnd() * 4);
      const region = wpick(regionW);
      const cat = wpick([['가구', 0.25], ['사무용품', 0.45], ['전자기기', 0.3]]);
      const [sub, price] = pick(cats[cat]);
      const qty = 1 + Math.floor(Math.pow(rnd(), 2) * (cat === '사무용품' ? 20 : 6));
      const seg = wpick(segs);
      let disc = rnd() < 0.55 ? 0 : pick([0.05, 0.1, 0.15, 0.2, 0.3, 0.4]);
      if (seg === '공공') disc = Math.min(disc, 0.1);
      const unit = price * (0.85 + rnd() * 0.3);
      const growth = 1 + (od.getFullYear() - 2022) * 0.12;
      const sales = Math.round((unit * qty * (1 - disc) * growth) / 10) * 10;
      const margin = (cat === '전자기기' ? 0.14 : cat === '가구' ? 0.09 : 0.22) - disc * 1.1 + (rnd() - 0.5) * 0.12;
      const profit = Math.round((sales * margin) / 10) * 10;
      rows.push({
        order_id: 'ORD-' + (od.getFullYear() % 100) + String(100000 + i).slice(1),
        order_date: odate,
        ship_date: odate + lead * 86400000,
        ship_mode: ship,
        segment: seg,
        channel: seg === '기업' && rnd() < 0.5 ? 'B2B 영업' : pick(channels),
        region,
        city: pick(regions[region]),
        category: cat,
        subcat: sub,
        sales,
        qty,
        discount: disc,
        profit,
        target: Math.round((sales * (0.85 + rnd() * 0.35)) / 100) * 100,
      });
    }
    rows.sort((a, b) => a.order_date - b.order_date);
    return { id: BI.uid('ds'), name: '샘플_매출데이터', fields, rows };
  };
})();
