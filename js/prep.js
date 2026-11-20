/* Offline BI - 데이터 준비(Prep): 원본 구조 변환 흐름
   데이터 원본마다 원본 표(raw)와 변환 단계(steps)를 보관하고, 단계를 차례로 적용해 분석용 표를 만듭니다.
   데이터 교체·행 추가(유니온) 시에도 같은 단계가 자동으로 다시 적용됩니다. */
(function () {
  'use strict';
  const BI = window.BI, D = BI.Data;
  const P = (BI.Prep = {});

  const ne = (v) => v != null && v !== '';
  const cellStr = (v) => (v == null ? '' : v instanceof Date ? BI.fmtDate(v.getTime(), true) : String(v).trim());
  const isNumLike = (v) => { if (typeof v === 'number') return isFinite(v); const n = D.parseNumber(v); return n != null && !isNaN(n); };

  /* 원본 값 정규화: Date → 문자열 (JSON 저장 시 시간대 문제 방지) */
  P.normalize = function (aoa) {
    return aoa.map((r) => (r ? r.map((v) => (v === undefined ? null : v instanceof Date ? BI.fmtDate(v.getTime(), true) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : v)) : null)).filter((r) => r && r.some(ne));
  };

  /* 제목 행 / 머리글 행 수 자동 감지 */
  P.detect = function (aoa) {
    const rows = aoa.filter((r) => r && r.some(ne)).slice(0, 80);
    if (rows.length < 3) return { skip: 0, headerRows: 1 };
    const width = Math.max(...rows.map((r) => r.length));
    let skip = 0;
    // 값이 하나뿐인 맨 위 행 = 표 제목/설명 → 건너뛰기
    while (skip < rows.length - 2 && width >= 3 && rows[skip].filter(ne).length <= 1) skip++;
    const rs = rows.slice(skip);
    // 숫자 열 판단은 아래쪽 행으로 (작은 표는 절반 지점부터 — 맨 아래 주석 행 한 줄만 보고 판단하지 않도록)
    const tail = rs.slice(Math.min(6, Math.floor(rs.length / 2)));
    const numCols = [];
    for (let c = 0; c < width; c++) {
      let n = 0, num = 0;
      tail.forEach((r) => { if (ne(r[c])) { n++; if (isNumLike(r[c])) num++; } });
      if (n && num / n >= 0.6) numCols.push(c);
    }
    if (!numCols.length) return { skip, headerRows: 1 };
    for (let i = 0; i < Math.min(6, rs.length - 1); i++) {
      const vals = numCols.map((c) => rs[i][c]).filter(ne);
      const nums = vals.filter(isNumLike);
      const sameRepeat = nums.length > 2 && new Set(nums.map(String)).size === 1;
      if (nums.length >= numCols.length * 0.5 && !sameRepeat) return { skip, headerRows: Math.max(1, i) };
    }
    return { skip, headerRows: 1 };
  };

  P.newSource = function (t) {
    const raw = P.normalize(t.aoa);
    const det = P.detect(raw);
    return { raw, text: t.text || null, delim: t.delim || 'auto', _parsedDelim: t.delim || 'auto', skip: det.skip, headerRows: det.headerRows, headerSep: ' | ', unions: [], steps: [] };
  };

  /* 원본 → 기본 표 (건너뛰기, 머리글 합치기) */
  function baseTable(aoa, src, limit) {
    let rows = aoa.filter((r) => r && r.some(ne)).slice(src.skip || 0);
    const hr = Math.max(0, src.headerRows == null ? 1 : +src.headerRows);
    if (limit) rows = rows.slice(0, limit + hr);
    const width = Math.max(0, ...rows.slice(0, 1000).map((r) => r.length));
    const head = rows.slice(0, hr).map((r) => { const a = []; for (let c = 0; c < width; c++) a[c] = cellStr(r[c]); return a; });
    // 위쪽 머리글 행의 빈 칸은 왼쪽 값으로 채움 (가로 병합 머리글)
    head.forEach((r, k) => { if (k < hr - 1) for (let c = 1; c < width; c++) if (r[c] === '') r[c] = r[c - 1]; });
    const sep = src.headerSep || ' | ';
    const names = [], parts = [], used = {};
    for (let c = 0; c < width; c++) {
      const ps = [];
      head.forEach((r) => { const v = r[c]; if (v !== '' && ps[ps.length - 1] !== v) ps.push(v); });
      let nm = ps.join(sep).replace(/\s+/g, ' ') || '열' + (c + 1);
      const b = nm;
      let i = 2;
      while (used[nm]) nm = b + ' (' + i++ + ')';
      used[nm] = 1;
      names.push(nm);
      parts.push(ps);
    }
    const body = rows.slice(hr).map((r) => { const a = new Array(width); for (let c = 0; c < width; c++) a[c] = ne(r[c]) ? r[c] : null; return a; });
    return { cols: names, rows: body, types: {}, parts };
  }

  function sourceAoa(src) {
    if (src.text && src.delim && src._parsedDelim !== src.delim) {
      src.raw = P.normalize(D.parseCSV(src.text, src.delim));
      src._parsedDelim = src.delim;
    }
    return src.raw;
  }

  const conv = (v, type) => {
    if (!ne(v)) return null;
    if (type === 'number') { const n = D.parseNumber(v); return n == null || isNaN(n) ? null : n; }
    if (type === 'date') { const n = D.parseDate(v, true); return n == null || isNaN(n) ? null : BI.fmtDate(n, true); }
    if (type === 'string') return String(v);
    return v;
  };
  const colType = (T, i) => T.types[T.cols[i]] || D.inferType(T.rows.map((r) => r[i]), T.cols[i]);

  function idx(T, name) {
    const i = T.cols.indexOf(name);
    if (i < 0) throw new Error('"' + name + '" 열이 없습니다');
    return i;
  }
  function uniqueName(T, nm, except) {
    let n = nm, i = 2;
    while (T.cols.some((c, k) => c === n && k !== except)) n = nm + ' (' + i++ + ')';
    return n;
  }
  const toNum = (v) => { if (typeof v === 'number') return v; const n = D.parseNumber(v); return n == null || isNaN(n) ? null : n; };

  const AGG = {
    SUM: (a) => { const n = a.map(toNum).filter((x) => x != null); return n.length ? n.reduce((s, x) => s + x, 0) : null; },
    AVG: (a) => { const n = a.map(toNum).filter((x) => x != null); return n.length ? n.reduce((s, x) => s + x, 0) / n.length : null; },
    COUNT: (a) => a.filter(ne).length,
    COUNTD: (a) => new Set(a.filter(ne).map(String)).size,
    MIN: (a) => { const n = a.map(toNum).filter((x) => x != null); return n.length ? Math.min(...n) : null; },
    MAX: (a) => { const n = a.map(toNum).filter((x) => x != null); return n.length ? Math.max(...n) : null; },
    FIRST: (a) => { const v = a.find(ne); return v === undefined ? null : v; },
  };
  P.AGG_NAMES = { SUM: '합계', AVG: '평균', COUNT: '개수', COUNTD: '고유 개수', MIN: '최소', MAX: '최대', FIRST: '첫 값' };

  P.CLEAN_OPS = [
    ['trim', '앞뒤 공백 제거'],
    ['paren', '괄호 안 내용 제거 — 예) 총인구 (명) → 총인구'],
    ['digits', '숫자만 남기기'],
    ['nodigits', '숫자 제거'],
    ['upper', '대문자로'],
    ['lower', '소문자로'],
    ['replace', '찾아 바꾸기'],
    ['tonull', '특정 값을 Null로 (예: -, …, x)'],
    ['prefix', '앞에 붙이기'],
    ['suffix', '뒤에 붙이기'],
  ];
  const CLEAN = {
    trim: (s) => s.replace(/\s+/g, ' ').trim(),
    paren: (s) => s.replace(/\s*[(（[［][^)）\]］]*[)）\]］]/g, '').trim(),
    digits: (s) => s.replace(/[^0-9.\-]/g, ''),
    nodigits: (s) => s.replace(/[0-9]/g, '').trim(),
    upper: (s) => s.toUpperCase(),
    lower: (s) => s.toLowerCase(),
  };

  /* 단계 적용 */
  function apply(T, st) {
    switch (st.t) {
      case 'rename': {
        const i = idx(T, st.col);
        const to = uniqueName(T, st.to, i);
        if (T.types[st.col]) { T.types[to] = T.types[st.col]; delete T.types[st.col]; }
        T.cols[i] = to;
        return;
      }
      case 'remove': {
        const rm = new Set(st.cols.map((c) => idx(T, c)));
        const keep = T.cols.map((_, i) => i).filter((i) => !rm.has(i));
        st.cols.forEach((c) => delete T.types[c]);
        T.cols = keep.map((i) => T.cols[i]);
        T.rows = T.rows.map((r) => keep.map((i) => r[i]));
        return;
      }
      case 'type': {
        const i = idx(T, st.col);
        if (st.to === 'auto') { delete T.types[st.col]; return; }
        T.types[st.col] = st.to;
        T.rows.forEach((r) => (r[i] = conv(r[i], st.to)));
        return;
      }
      case 'unpivot': {
        const pv = st.cols.map((c) => idx(T, c));
        const pset = new Set(pv);
        const keep = T.cols.map((_, i) => i).filter((i) => !pset.has(i));
        const names = st.names && st.names.length ? st.names : ['항목'];
        const sep = st.sep || ' | ';
        const nameVals = pv.map((i) => {
          if (names.length === 1) return [T.cols[i]];
          const ps = T.cols[i].split(sep);
          while (ps.length < names.length) ps.unshift(ps[0]);
          if (ps.length > names.length) ps.splice(names.length - 1, ps.length, ps.slice(names.length - 1).join(sep));
          return ps;
        });
        const out = [];
        T.rows.forEach((r) => {
          const base = keep.map((i) => r[i]);
          pv.forEach((i, k) => {
            const v = r[i];
            if (st.dropNull !== false && !ne(v)) return;
            out.push(base.concat(nameVals[k], [v]));
          });
        });
        const kc = keep.map((i) => T.cols[i]);
        const all = kc.slice();
        const nm = (n) => { let x = n, j = 2; while (all.includes(x)) x = n + ' (' + j++ + ')'; all.push(x); return x; };
        names.forEach(nm);
        nm(st.value || '값');
        st.cols.forEach((c) => delete T.types[c]);
        T.cols = all;
        T.rows = out;
        return;
      }
      case 'pivot': {
        const ki = idx(T, st.key), vi = idx(T, st.value);
        const others = T.cols.map((_, i) => i).filter((i) => i !== ki && i !== vi);
        const keys = [], kset = new Set(), groups = new Map();
        T.rows.forEach((r) => {
          const k = cellStr(r[ki]) || '(Null)';
          if (!kset.has(k)) { kset.add(k); keys.push(k); }
          const gk = others.map((i) => cellStr(r[i])).join('\u0001');
          let g = groups.get(gk);
          if (!g) groups.set(gk, (g = { base: others.map((i) => r[i]), vals: {} }));
          (g.vals[k] = g.vals[k] || []).push(r[vi]);
        });
        const fn = AGG[st.agg || 'SUM'];
        delete T.types[st.key]; delete T.types[st.value];
        const oc = others.map((i) => T.cols[i]);
        T.cols = oc.concat(keys.map((k) => (oc.includes(k) ? k + ' (2)' : k)));
        T.rows = Array.from(groups.values()).map((g) => g.base.concat(keys.map((k) => (g.vals[k] ? fn(g.vals[k]) : null))));
        return;
      }
      case 'split': {
        const i = idx(T, st.col);
        const n = Math.max(2, st.names.length);
        const sep = st.sep;
        const parts = T.rows.map((r) => {
          if (!ne(r[i])) return new Array(n).fill(null);
          let ps;
          if (st.mode === 'regex') { try { ps = String(r[i]).split(new RegExp(sep)); } catch (e) { throw new Error('정규식 오류'); } }
          else ps = String(r[i]).split(sep);
          if (ps.length > n) ps = ps.slice(0, n - 1).concat([ps.slice(n - 1).join(st.mode === 'regex' ? '' : sep)]);
          while (ps.length < n) ps.push(null);
          return ps.map((x) => (x == null ? null : x.trim() === '' ? null : x.trim()));
        });
        const newNames = st.names.map((nm) => uniqueName(T, nm));
        const at = st.keep ? i + 1 : i;
        T.cols.splice(at, st.keep ? 0 : 1, ...newNames);
        T.rows.forEach((r, k) => r.splice(at, st.keep ? 0 : 1, ...parts[k]));
        if (!st.keep) delete T.types[st.col];
        return;
      }
      case 'clean': {
        const ids = st.cols.map((c) => idx(T, c));
        let f;
        if (st.op === 'replace') f = (s) => s.split(st.find || '').join(st.repl || '');
        else if (st.op === 'tonull') { const set = new Set(String(st.find || '').split(',').map((x) => x.trim())); f = (s) => (set.has(s.trim()) ? null : s); }
        else if (st.op === 'prefix') f = (s) => (st.find || '') + s;
        else if (st.op === 'suffix') f = (s) => s + (st.find || '');
        else f = CLEAN[st.op];
        if (!f) throw new Error('알 수 없는 정리 방식');
        T.rows.forEach((r) => ids.forEach((i) => {
          if (!ne(r[i])) return;
          const v = f(String(r[i]));
          r[i] = v === '' ? null : v;
        }));
        return;
      }
      case 'filter': {
        const i = idx(T, st.col);
        if (st.mode === 'notnull') { T.rows = T.rows.filter((r) => ne(r[i])); return; }
        if (st.mode === 'cond') {
          const tv = st.value;
          const tn = toNum(tv);
          const test = (v) => {
            const s = cellStr(v);
            switch (st.op) {
              case 'contains': return s.includes(tv);
              case 'notcontains': return !s.includes(tv);
              case 'starts': return s.startsWith(tv);
              case 'ends': return s.endsWith(tv);
            }
            const vn = toNum(v);
            const both = vn != null && tn != null;
            const a = both ? vn : s, b = both ? tn : String(tv);
            switch (st.op) {
              case '=': return a === b;
              case '!=': return a !== b;
              case '>': return both && a > b;
              case '>=': return both && a >= b;
              case '<': return both && a < b;
              case '<=': return both && a <= b;
            }
            return true;
          };
          T.rows = T.rows.filter((r) => test(r[i]));
          return;
        }
        const set = new Set((st.values || []).map((v) => (v == null ? '\u0000' : String(v))));
        const keep = st.mode === 'keep';
        T.rows = T.rows.filter((r) => { const has = set.has(ne(r[i]) ? cellStr(r[i]) : '\u0000'); return keep ? has : !has; });
        return;
      }
      case 'filldown': {
        const ids = st.cols.map((c) => idx(T, c));
        const last = ids.map(() => null);
        T.rows.forEach((r) => ids.forEach((i, k) => { if (ne(r[i])) last[k] = r[i]; else r[i] = last[k]; }));
        return;
      }
      case 'calc': {
        const tmp = { fields: T.cols.map((n, i) => ({ id: 'c' + i, name: n, type: colType(T, i) })), rows: [] };
        tmp.rows = T.rows.map((r) => { const o = {}; tmp.fields.forEach((f, i) => (o[f.id] = D.convert(r[i], f.type))); return o; });
        const c = BI.Calc.compile(st.expr, tmp);
        const nm = uniqueName(T, st.name);
        T.cols.push(nm);
        tmp.rows.forEach((o, k) => {
          let v;
          try { v = c.fn(o); } catch (e) { v = null; }
          if (typeof v === 'number' && !isFinite(v)) v = null;
          if (v != null && c.type === 'date') v = BI.fmtDate(v, true);
          if (typeof v === 'boolean') v = v ? 'TRUE' : 'FALSE';
          T.rows[k].push(v === undefined ? null : v);
        });
        if (c.type === 'number' || c.type === 'date' || c.type === 'string') T.types[nm] = c.type;
        return;
      }
      case 'aggregate': {
        const gi = st.groups.map((c) => idx(T, c));
        const ai = st.aggs.map((a) => idx(T, a.col));
        const groups = new Map();
        T.rows.forEach((r) => {
          const k = gi.map((i) => cellStr(r[i])).join('\u0001');
          let g = groups.get(k);
          if (!g) groups.set(k, (g = { base: gi.map((i) => r[i]), vals: ai.map(() => []) }));
          ai.forEach((i, j) => g.vals[j].push(r[i]));
        });
        const names = st.groups.slice();
        st.aggs.forEach((a) => { let nm = a.as || (a.fn === 'SUM' ? a.col : P.AGG_NAMES[a.fn] + '(' + a.col + ')'); const b = nm; let j = 2; while (names.includes(nm)) nm = b + ' (' + j++ + ')'; names.push(nm); });
        T.rows = Array.from(groups.values()).map((g) => g.base.concat(st.aggs.map((a, j) => AGG[a.fn](g.vals[j]))));
        const nt = {};
        st.groups.forEach((c) => { if (T.types[c]) nt[c] = T.types[c]; });
        T.types = nt;
        T.cols = names;
        return;
      }
      case 'dedupe': {
        const seen = new Set();
        T.rows = T.rows.filter((r) => { const k = r.map(cellStr).join('\u0001'); if (seen.has(k)) return false; seen.add(k); return true; });
        return;
      }
      case 'transpose': {
        if (!T.cols.length) return;
        const used = {};
        const heads = T.rows.map((r, k) => { let n = cellStr(r[0]) || '행' + (k + 1); const b = n; let j = 2; while (used[n]) n = b + ' (' + j++ + ')'; used[n] = 1; return n; });
        const first = st.first || '항목';
        const newCols = [heads.includes(first) ? first + ' (열)' : first].concat(heads);
        const newRows = T.cols.slice(1).map((c, j) => [c].concat(T.rows.map((r) => r[j + 1])));
        T.cols = newCols;
        T.rows = newRows;
        T.types = {};
        return;
      }
    }
    throw new Error('알 수 없는 단계');
  }

  /* 흐름 실행: upto 단계까지 (undefined = 전체) */
  P.run = function (src, upto, opts) {
    opts = opts || {};
    const limit = opts.limit || 0;
    const T = baseTable(sourceAoa(src), src, limit);
    Object.assign(T.types, src.baseTypes || {});
    (src.unions || []).forEach((u) => {
      const U = baseTable(u, src, limit);
      const map = U.cols.map((c) => {
        let i = T.cols.indexOf(c);
        if (i < 0) { T.cols.push(c); T.rows.forEach((r) => r.push(null)); i = T.cols.length - 1; }
        return i;
      });
      U.rows.forEach((r) => { const a = new Array(T.cols.length).fill(null); map.forEach((i, k) => (a[i] = r[k])); T.rows.push(a); });
    });
    const steps = src.steps || [];
    const n = upto == null ? steps.length : Math.min(upto, steps.length);
    const errors = {};
    for (let k = 0; k < n; k++) {
      if (steps[k].off) continue;
      // 단계 실패 시 이전 상태로 되돌리고 건너뜀
      const snap = { cols: T.cols.slice(), rows: T.rows.map((r) => r.slice()), types: Object.assign({}, T.types) };
      try { apply(T, steps[k]); }
      catch (e) { errors[k] = e.message; Object.assign(T, snap); }
    }
    return { table: T, errors };
  };

  P.toAoa = (T) => [T.cols.slice()].concat(T.rows);

  /* 새 데이터 원본 생성 */
  P.createDataSource = function (name, t) {
    const src = P.newSource(t);
    const ds = { id: BI.uid('ds'), name, fields: [], rows: [], prep: src };
    P.rebuild(ds);
    return ds;
  };

  /* 기존 데이터 원본에 흐름이 없으면 현재 값으로 만듦 */
  P.ensure = function (ds) {
    if (ds.prep) return ds.prep;
    const fs = ds.fields.filter((f) => !f.calc);
    const aoa = [fs.map((f) => f.name)].concat(ds.rows.map((r) => fs.map((f) => { const v = r[f.id]; return v == null ? null : f.type === 'date' ? BI.fmtDate(v, true) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : v; })));
    ds.prep = { raw: aoa, text: null, delim: 'auto', skip: 0, headerRows: 1, headerSep: ' | ', unions: [], steps: [] };
    const types = {};
    fs.forEach((f) => (types[f.name] = f.type));
    ds.prep.baseTypes = types;
    return ds.prep;
  };

  /* 흐름을 다시 실행해 필드/행 갱신 (같은 이름의 필드는 ID 유지 → 시트 구성 보존) */
  P.rebuild = function (ds) {
    const src = ds.prep;
    const res = P.run(src);
    const nd = D.buildDataSource(ds.name, P.toAoa(res.table), { types: res.table.types });
    const old = {};
    ds.fields.filter((f) => !f.calc).forEach((f) => (old[f.name] = f));
    const idmap = {};
    nd.fields.forEach((f) => {
      const o = old[f.name];
      const nid = o ? o.id : f.id;
      idmap[f.id] = nid;
      f.id = nid;
      if (o && o.type === f.type) { f.role = o.role; if (o.defAgg) f.defAgg = o.defAgg; }
    });
    const ids = Object.entries(idmap);
    ds.rows = nd.rows.map((r) => { const o = {}; for (const [a, b] of ids) o[b] = r[a]; return o; });
    const calcs = ds.fields.filter((f) => f.calc);
    const names = new Set(nd.fields.map((f) => f.name));
    calcs.forEach((f) => { if (names.has(f.name)) f.name = f.name + ' (계산)'; });
    ds.fields = nd.fields.concat(calcs);
    D.applyCalcs(ds);
    return res.errors;
  };

  /* 필드 이름/유형 변경을 흐름에도 기록 */
  P.record = function (ds, step) {
    if (ds && ds.prep) ds.prep.steps.push(step);
  };

  /* 추천 변환: 가로로 넓은 통계표(여러 숫자 열) → 세로형(항목, 값) */
  P.suggest = function (src) {
    const T = P.run(src, 0, { limit: 300 }).table;
    if (T.rows.length < 1 || T.cols.length < 3) return null;
    const numCols = [], textCols = [];
    T.cols.forEach((c, i) => {
      let n = 0, num = 0;
      T.rows.forEach((r) => { if (ne(r[i])) { n++; if (isNumLike(r[i]) || r[i] === '-') num++; } });
      if (n && num / n >= 0.8) numCols.push(i); else textCols.push(i);
    });
    if (!textCols.length || numCols.length < 3) return null;
    const sep = src.headerSep || ' | ';
    const names = +src.headerRows > 1 ? P.guessNames(numCols.map((i) => T.cols[i]), sep) : ['항목'];
    const steps = [{ t: 'unpivot', cols: numCols.map((i) => T.cols[i]), names, sep, value: '값', dropNull: true }];
    return { steps, numCols: numCols.length, textCols: textCols.map((i) => T.cols[i]) };
  };

  /* 피벗 해제할 열 이름들을 구분자로 나눴을 때 각 단계의 이름 추정 (연도/시점/항목) */
  P.guessNames = function (colNames, sep) {
    const lv = colNames.map((c) => c.split(sep));
    const L = Math.max(...lv.map((x) => x.length));
    if (!(L > 1 && lv.every((x) => x.length === L))) return ['항목'];
    const names = [];
    for (let k = 0; k < L; k++) {
      const vals = lv.map((x) => x[k]);
      let nm = vals.every((v) => /^\d{4}$/.test(v)) ? '연도' : vals.every((v) => /^\d{4}\s*(년|\.|-|\/)?\s*(\d{1,2}\s*(월|분기)?|[1-4]\s*분기|Q[1-4]|[1-2]\s*반기)?$/i.test(v)) ? '시점' : '항목';
      const b = nm;
      let j = 2;
      while (names.includes(nm)) nm = b + j++;
      names.push(nm);
    }
    return names;
  };
  P.isNumericCol = function (T, i) {
    let n = 0, num = 0;
    for (const r of T.rows) { if (ne(r[i])) { n++; if (isNumLike(r[i]) || r[i] === '-') num++; } if (n >= 500) break; }
    return n > 0 && num / n >= 0.8;
  };
  P.colType = (T, i) => colType(T, i);
  P.cellStr = cellStr;

  /* 단계 설명 */
  P.describe = function (st) {
    const q = (s) => '"' + s + '"';
    const list = (a) => (a.length <= 2 ? a.map(q).join(', ') : q(a[0]) + ' 외 ' + (a.length - 1) + '개');
    switch (st.t) {
      case 'rename': return ['이름 변경', q(st.col) + ' → ' + q(st.to)];
      case 'remove': return ['열 제거', list(st.cols)];
      case 'type': return ['유형 변경', q(st.col) + ' → ' + ({ auto: '자동', string: '문자열', number: '숫자', date: '날짜' }[st.to] || st.to)];
      case 'unpivot': return ['피벗 해제 (열 → 행)', st.cols.length + '개 열 → ' + st.names.map(q).join(', ') + ', ' + q(st.value || '값')];
      case 'pivot': return ['피벗 (행 → 열)', q(st.key) + ' 값을 열로, ' + P.AGG_NAMES[st.agg || 'SUM'] + '(' + st.value + ')'];
      case 'split': return ['열 분할', q(st.col) + ' 을(를) ' + q(st.sep) + ' 기준 ' + st.names.length + '개로'];
      case 'clean': return ['값 정리', list(st.cols) + ' · ' + (P.CLEAN_OPS.find((o) => o[0] === st.op) || ['', st.op])[1].split(' — ')[0] + (st.op === 'replace' ? ' ' + q(st.find) + '→' + q(st.repl || '') : st.op === 'tonull' ? ' ' + q(st.find) : '')];
      case 'filter': {
        const m = { keep: '값 유지', exclude: '값 제외', notnull: 'Null 제외', cond: '조건' }[st.mode];
        return ['행 필터', q(st.col) + ' · ' + m + (st.mode === 'cond' ? ' ' + st.op + ' ' + st.value : st.values ? ' (' + st.values.length + '개)' : '')];
      }
      case 'filldown': return ['아래로 채우기', list(st.cols)];
      case 'calc': return ['계산 열 추가', q(st.name) + ' = ' + st.expr];
      case 'aggregate': return ['그룹 · 집계', (st.groups.length ? list(st.groups) + ' 기준 ' : '') + st.aggs.map((a) => P.AGG_NAMES[a.fn] + '(' + a.col + ')').join(', ')];
      case 'dedupe': return ['중복 행 제거', '모든 열이 같은 행'];
      case 'transpose': return ['행 ↔ 열 바꾸기', '첫 열을 머리글로'];
    }
    return [st.t, ''];
  };
})();
