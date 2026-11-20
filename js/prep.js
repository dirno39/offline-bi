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

  /* 원본 값 정규화: Date → 문자열 (JSON 저장 시 시간대 문제 방지), 빈 행·구분선(-----) 행 제거 */
  const RULE_RE = /^[-=_─━]{3,}$/;
  P.normalize = function (aoa) {
    return aoa.map((r) => (r ? r.map((v) => (v === undefined ? null : v instanceof Date ? BI.fmtDate(v.getTime(), true) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : v)) : null))
      .filter((r) => r && r.some(ne) && !r.filter(ne).every((v) => typeof v === 'string' && RULE_RE.test(v.trim())));
  };

  /* 맨 아래 주석·출처 행 ("자료: …", "주: 1) …", "※ …") 개수 */
  const NOTE_RE = /^\s*(※|\*\s|(자료|주|출처|비고|참고|source|notes?)\s*\d*\s*[:：)])/i;
  P.detectFooter = function (rows) {
    rows = rows.filter((r) => r && r.some(ne));
    const width = Math.max(0, ...rows.slice(0, 50).map((r) => r.length));
    // 아래에서부터 주석 줄 또는 값 하나짜리 글자 줄(주석의 이어지는 줄 "2. …")을 훑고, 그중 가장 위의 주석 시작 줄까지 제외
    let top = -1;
    for (let k = rows.length - 1; k >= 1 && rows.length - k <= 12; k--) {
      const vals = rows[k].filter(ne);
      const first = String(vals[0] == null ? '' : vals[0]);
      if (NOTE_RE.test(first) && vals.length <= 2) { top = k; continue; }
      if (vals.length === 1 && typeof vals[0] === 'string' && !isNumLike(vals[0]) && width >= 3) continue;
      break;
    }
    return width >= 2 && top > 0 ? rows.length - top : 0;
  };

  /* 제목 행 / 머리글 행 수 / 맨 아래 주석 행 / 머리글 없음 자동 감지 */
  const isYear = (v) => { const n = typeof v === 'number' ? v : /^\s*\d{4}\s*$/.test(String(v)) ? +v : NaN; return Number.isInteger(n) && n >= 1900 && n <= 2100; };
  P.detect = function (aoa) {
    const all = aoa.filter((r) => r && r.some(ne));
    const footer = P.detectFooter(all);
    const rows = all.slice(0, Math.max(0, all.length - footer)).slice(0, 80);
    if (rows.length < 3) return { skip: 0, headerRows: 1, footer };
    const width = Math.max(...rows.map((r) => r.length));
    let skip = 0;
    // 값이 하나뿐이거나(병합 제목 포함) 같은 글자만 반복되는 맨 위 행 = 표 제목/설명 → 건너뛰기
    const titleLike = (r) => { const v = r.filter(ne); if (v.length <= 1) return true; return v.every((x) => x === v[0]) && typeof v[0] === 'string' && !isNumLike(v[0]); };
    while (skip < rows.length - 2 && width >= 3 && titleLike(rows[skip])) skip++;
    const rs = rows.slice(skip);
    // 숫자 열 판단은 아래쪽 행으로 (작은 표는 절반 지점부터)
    const tail = rs.slice(Math.min(6, Math.floor(rs.length / 2)));
    const numCols = [];
    for (let c = 0; c < width; c++) {
      let n = 0, num = 0;
      tail.forEach((r) => { if (ne(r[c])) { n++; if (isNumLike(r[c])) num++; } });
      if (n && num / n >= 0.6) numCols.push(c);
    }
    if (!numCols.length) return { skip, headerRows: 1, footer };
    for (let i = 0; i < Math.min(8, rs.length - 1); i++) {
      const vals = numCols.map((c) => rs[i][c]).filter(ne);
      const nums = vals.filter(isNumLike);
      const sameRepeat = nums.length > 2 && new Set(nums.map(String)).size === 1;
      // KOSIS 반복 머리글: 연도가 칸마다 반복되는 행 (2023, 2023, …, 2024, 2024, …)
      const yearRepeat = nums.length > 2 && nums.every(isYear) && new Set(nums.map(String)).size <= nums.length / 2;
      if (nums.length >= numCols.length * 0.5 && !sameRepeat && !yearRepeat) {
        // 첫 행부터 데이터처럼 보이면(연도 머리글이 아닌 숫자) 머리글 없는 파일
        if (i === 0 && nums.length >= numCols.length * 0.8 && !nums.every(isYear)) return { skip, headerRows: 0, footer, noHeader: true };
        return { skip, headerRows: Math.max(1, i), footer };
      }
    }
    return { skip, headerRows: 1, footer };
  };

  P.newSource = function (t) {
    const raw = P.normalize(t.aoa);
    const det = P.detect(raw);
    return { raw, text: t.text || null, delim: t.delim || 'auto', _parsedDelim: t.delim || 'auto', skip: det.skip, headerRows: det.headerRows, footer: det.footer || 0, footerAuto: true, noHeader: !!det.noHeader, headerSep: ' | ', unions: [], steps: [] };
  };
  /* 구분자를 바꾼 뒤 건너뛸 행·머리글 행·주석 행 다시 감지 */
  P.redetect = function (src) {
    const det = P.detect(sourceAoa(src));
    Object.assign(src, { skip: det.skip, headerRows: det.headerRows, footer: det.footer || 0, footerAuto: true, noHeader: !!det.noHeader });
    return det;
  };

  /* 원본 → 기본 표 (건너뛰기, 머리글 합치기) */
  function baseTable(aoa, src, limit) {
    let rows = aoa.filter((r) => r && r.some(ne));
    // 맨 아래 주석 행 제외 (자동이면 표마다 다시 감지 — 유니온 파일마다 주석 줄 수가 달라도 됨)
    const foot = src.footerAuto ? P.detectFooter(rows) : Math.max(0, +src.footer || 0);
    if (foot) rows = rows.slice(0, Math.max(0, rows.length - foot));
    rows = rows.slice(src.skip || 0);
    const hr = Math.max(0, src.headerRows == null ? 1 : +src.headerRows);
    if (limit) rows = rows.slice(0, limit + hr);
    const width = Math.max(0, ...rows.slice(0, 1000).map((r) => r.length));
    const head = rows.slice(0, hr).map((r) => { const a = []; for (let c = 0; c < width; c++) a[c] = cellStr(r[c]); return a; });
    // 위쪽 머리글 행의 빈 칸은 왼쪽 값으로 채움 (가로 병합 머리글)
    head.forEach((r, k) => { if (k < hr - 1) for (let c = 1; c < width; c++) if (r[c] === '') r[c] = r[c - 1]; });
    const sep = src.headerSep || ' | ';
    const names = [], parts = [], used = {};
    const bodySample = rows.slice(hr, hr + 200);
    for (let c = 0; c < width; c++) {
      let ps = [];
      // 숫자(값) 열은 머리글 단계별 값을 그대로 보존 ("2023 | 계 | 계" → 3단계).
      // 아래 단계가 비어 있으면 세로 병합으로 보고 위 값을 이어 씀. 글자(차원) 열은 같은 값 반복을 하나로.
      let n = 0, num = 0;
      if (hr > 1) bodySample.forEach((r) => { const v = r && r[c]; if (ne(v)) { n++; if (isNumLike(v) || v === '-') num++; } });
      const valueCol = hr > 1 && n > 0 && num / n >= 0.6;
      if (valueCol) {
        head.forEach((r, k) => { let v = r[c]; if (v === '' && k > 0) v = ps[k - 1]; ps.push(v); });
        if (ps.every((v) => v === '')) ps = [];
      } else head.forEach((r) => { const v = r[c]; if (v !== '' && ps[ps.length - 1] !== v) ps.push(v); });
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

  /* 피벗 해제 대상 열 결정
     mode 'list'(기본, 예전 형식) = st.cols 고정 목록
     mode 'except' = st.keep 에 적은 열을 뺀 나머지 전부 (새로 생긴 열도 자동 포함)
     mode 'numeric' = 숫자 열 전부 (st.keep 에 적은 열은 제외) */
  P.unpivotCols = function (T, st) {
    const mode = st.mode || 'list';
    if (mode === 'list') return (st.cols || []).slice();
    const keep = new Set(st.keep || []);
    const miss = (st.keep || []).filter((c) => !T.cols.includes(c));
    if (miss.length) throw new Error('유지할 열이 없습니다: ' + miss.join(', '));
    if (mode === 'except') return T.cols.filter((c) => !keep.has(c));
    return T.cols.filter((c, i) => !keep.has(c) && P.isNumericCol(T, i));
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
        let fails = 0;
        T.rows.forEach((r) => { const v = r[i]; r[i] = conv(v, st.to); if (r[i] == null && ne(v) && !(typeof v === 'string' && D.isNullToken(v))) fails++; });
        if (fails) (T.fails = T.fails || {})[st.col] = (T.fails[st.col] || 0) + fails;
        return;
      }
      case 'unpivot': {
        const pv = P.unpivotCols(T, st).map((c) => idx(T, c));
        if (!pv.length) throw new Error('행으로 내릴 열이 없습니다');
        const pset = new Set(pv);
        const keep = T.cols.map((_, i) => i).filter((i) => !pset.has(i));
        const names = st.names && st.names.length ? st.names : ['항목'];
        const sep = st.sep || ' | ';
        const nameVals = pv.map((i) => {
          if (names.length === 1) return [T.cols[i]];
          const ps = T.cols[i].replace(/ \(\d+\)$/, '').split(sep);
          // 단계 수가 다르면 조용히 채우지 않고 오류로 알림
          if (ps.length !== names.length) throw new Error('"' + T.cols[i] + '" 열 이름은 "' + sep.trim() + '" 기준 ' + ps.length + '단계인데 이름 열은 ' + names.length + '개(' + names.join(', ') + ')예요. 이름 열 개수를 맞추거나 나누기를 끄세요');
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
        pv.forEach((i) => delete T.types[T.cols[i]]);
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
    // 유니온 원본 파일명 열 (옵션): 어느 파일에서 온 행인지 표시
    let fc = -1;
    if (src.fileCol) {
      const nm = uniqueName(T, '원본 파일');
      T.cols.push(nm); fc = T.cols.length - 1;
      T.rows.forEach((r) => r.push(src.sourceName || '원본'));
    }
    (src.unions || []).forEach((u, ui) => {
      const U = baseTable(u, src, limit);
      if (fc >= 0) { U.cols.push(T.cols[fc]); U.rows.forEach((r) => r.push((src.unionNames || [])[ui] || '추가 ' + (ui + 1))); }
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

  /* 원본 열 구성 비교 (교체·유니온 전 경고용): 단계 적용 전 기본 표의 열 이름 기준 */
  P.baseCols = function (src, aoa) {
    const s = Object.assign({}, src, { raw: aoa || src.raw, unions: [], steps: [] });
    if (aoa) s.text = null;
    return baseTable(aoa || sourceAoa(src), s, 5).cols;
  };
  P.compareCols = function (oldCols, newCols, steps) {
    const o = new Set(oldCols), n = new Set(newCols);
    const added = newCols.filter((c) => !o.has(c)), removed = oldCols.filter((c) => !n.has(c));
    // 고정 목록 피벗 해제 단계는 새 열을 내리지 못함
    const fixed = (steps || []).some((st) => !st.off && st.t === 'unpivot' && (st.mode || 'list') === 'list');
    return { added, removed, fixedUnpivot: fixed && added.length > 0 };
  };
  P.diffMessage = function (d) {
    const L = (a) => (a.length <= 3 ? a.join(', ') : a.slice(0, 3).join(', ') + ' 외 ' + (a.length - 3) + '개');
    const parts = [];
    if (d.added.length) parts.push('새 열 ' + d.added.length + '개(' + L(d.added) + ')');
    if (d.removed.length) parts.push('없어진 열 ' + d.removed.length + '개(' + L(d.removed) + ')');
    let msg = parts.length ? '열 구성이 달라요: ' + parts.join(', ') : '';
    if (d.fixedUnpivot) msg += ' · 피벗 해제 단계가 고정 열 목록이라 새 열은 행으로 내려가지 않았어요. 데이터 정리에서 피벗 해제를 "선택하지 않은 열 외 전부"로 바꿔 주세요.';
    return msg;
  };

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
    // 유형 변환에 실패해 Null이 된 값 수 (화면 안내용, 저장하지 않음)
    const fails = Object.assign({}, res.table.fails || {});
    Object.entries(nd.convFails || {}).forEach(([k, v]) => { fails[k] = Math.max(fails[k] || 0, v); });
    Object.defineProperty(ds, 'convFails', { value: fails, writable: true, configurable: true, enumerable: false });
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
    if (!ds || !ds.prep) return;
    const steps = ds.prep.steps;
    // 같은 열의 유형을 연달아 바꾸면 앞 단계를 대체 (변환 실패로 Null이 된 값이 다음 변환에 이어지지 않도록 원본에서 다시 변환)
    const last = steps[steps.length - 1];
    if (step.t === 'type' && last && last.t === 'type' && last.col === step.col) steps.pop();
    steps.push(step);
  };

  /* 추천 변환: 가로로 넓은 통계표(여러 숫자 열) → 세로형(항목, 값) */
  /* 열 이름이 시점(연도·월·분기)처럼 보이는지: 2023, 2024년, 2024. 01, 2024.05 p), 1월, 2024 Q1 … */
  const TIME_RE = /^\s*((19|20)\d{2}\s*(년|\.|-|\/)?\s*(\d{1,2}\s*(월|분기)?|[1-4]\s*분기|Q[1-4]|[12]\s*반기|H[12])?|\d{1,2}\s*월|[1-4]\s*분기|Q[1-4])\s*(\(?[pe]\)|잠정|추정)?\s*$/i;
  P.isTimeName = (c, sep) => String(c).split(sep || ' | ').some((x) => TIME_RE.test(x));
  const STAT_NULLS = '-, x, X, …, ..., ., *';
  /* 추천 변환: 가로로 넓은 통계표(시점이 열로 펼쳐졌거나 여러 줄 머리글) → 세로형(항목, 값)
     열 이름이 시점 형태가 아니고 머리글이 한 줄인 평범한 표(주문 로그 등)는 추천하지 않음 */
  P.suggest = function (src) {
    const T = P.run(src, 0, { limit: 300 }).table;
    if (T.rows.length < 1 || T.cols.length < 3) return null;
    const numCols = [], textCols = [];
    let symbols = false;
    T.cols.forEach((c, i) => {
      let n = 0, num = 0;
      T.rows.forEach((r) => { if (ne(r[i])) { n++; if (isNumLike(r[i])) num++; else if (typeof r[i] === 'string' && D.isNullToken(r[i])) { num++; symbols = true; } } });
      if (n && num / n >= 0.8) numCols.push(i); else textCols.push(i);
    });
    if (!textCols.length || numCols.length < 3) return null;
    const sep = src.headerSep || ' | ';
    const timeCols = numCols.filter((i) => P.isTimeName(T.cols[i], sep)).length;
    const multi = +src.headerRows > 1;
    if (!multi && timeCols < Math.max(3, numCols.length * 0.6)) return null;
    const names = multi ? P.guessNames(numCols.map((i) => T.cols[i]), sep) : [timeCols >= numCols.length * 0.6 ? '시점' : '항목'];
    // 교체·유니온 때 새 시점 열도 함께 내려가도록 "유지할 열 외 전부" 규칙으로 저장
    const steps = [{ t: 'unpivot', mode: 'except', keep: textCols.map((i) => T.cols[i]), cols: numCols.map((i) => T.cols[i]), names, sep, value: '값', dropNull: true }];
    // 통계 기호('-', 'x', '…')는 Null로, 값은 숫자로
    if (symbols) steps.push({ t: 'clean', cols: ['값'], op: 'tonull', find: STAT_NULLS });
    steps.push({ t: 'type', col: '값', to: 'number' });
    return { steps, numCols: numCols.length, textCols: textCols.map((i) => T.cols[i]), names, symbols };
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
      case 'unpivot': {
        const what = st.mode === 'except' ? list(st.keep || []) + ' 외 모든 열' : st.mode === 'numeric' ? '숫자 열 전부' + ((st.keep || []).length ? ' (' + list(st.keep) + ' 제외)' : '') : (st.cols || []).length + '개 열 (고정 목록)';
        return ['피벗 해제 (열 → 행)', what + ' → ' + (st.names || ['항목']).map(q).join(', ') + ', ' + q(st.value || '값')];
      }
      case 'pivot': return ['피벗 (행 → 열)', q(st.key) + ' 값을 열로, ' + P.AGG_NAMES[st.agg || 'SUM'] + '(' + st.value + ')'];
      case 'split': return ['열 분할', q(st.col) + ' 을(를) ' + q(st.sep) + ' 기준 ' + st.names.length + '개로'];
      case 'clean': return ['값 정리', list(st.cols) + ' · ' + (P.CLEAN_OPS.find((o) => o[0] === st.op) || ['', st.op])[1].split(' — ')[0] + (st.op === 'replace' ? ' ' + q(st.find) + '→' + q(st.repl || '') : st.op === 'tonull' ? ' ' + q(st.find) : '')];
      case 'filter': {
        const m = { keep: '값 유지', exclude: '값 제외', notnull: 'Null 제외', cond: '조건' }[st.mode];
        const OPS = { '=': '=', '!=': '≠', '>': '>', '>=': '≥', '<': '<', '<=': '≤', contains: '포함', notcontains: '포함하지 않음', starts: '로 시작', ends: '로 끝남' };
        const cond = st.mode === 'cond' ? (/^[a-z]/.test(st.op) ? ' ' + q(st.value) + ' ' + (OPS[st.op] || st.op) : ' ' + (OPS[st.op] || st.op) + ' ' + q(st.value)) : '';
        return ['행 필터', q(st.col) + ' · ' + m + (st.mode === 'cond' ? cond : st.values ? ' (' + st.values.length + '개)' : '')];
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
