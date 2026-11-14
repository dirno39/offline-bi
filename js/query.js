/* Offline BI - 질의 엔진: 필터 / 그룹화 / 집계 / 정렬 / 테이블 계산 */
(function () {
  'use strict';
  const BI = window.BI;
  const Q = (BI.Query = {});

  Q.AGGS = [
    ['SUM', '합계'], ['AVG', '평균'], ['MEDIAN', '중앙값'], ['COUNT', '개수'], ['COUNTD', '고유 개수'],
    ['MIN', '최소값'], ['MAX', '최대값'], ['STDEV', '표준편차'], ['VAR', '분산'],
  ];
  Q.AGG_NAME = Object.fromEntries(Q.AGGS);

  Q.DATE_PARTS = [
    ['year', '연도', true], ['quarter', '분기 (연-분기)', true], ['month', '월 (연-월)', true], ['week', '주 (시작일)', true],
    ['day', '일 (날짜)', true], ['exact', '정확한 날짜', true],
    ['qtr', '분기 (불연속)', false], ['mon', '월 (불연속)', false], ['wday', '요일', false], ['dom', '일 (불연속)', false], ['hour', '시간대', false],
  ];
  const DP_SHORT = { year: '연도', quarter: '분기', month: '월', week: '주', day: '일', exact: '날짜', qtr: '분기#', mon: '월#', wday: '요일', dom: '일#', hour: '시간' };
  Q.TC = [['', '없음'], ['running', '누계'], ['pct', '구성비 (%)'], ['diff', '차이'], ['pctdiff', '증감률 (%)'], ['rank', '순위'], ['movavg', '이동 평균 (3)']];
  Q.TC_NAME = Object.fromEntries(Q.TC);

  Q.isMeasure = (p) => !!(p && p.agg);
  Q.field = (ds, id) => BI.Data.fieldById(ds, id);

  Q.pillLabel = function (p, ds) {
    const f = Q.field(ds, p.f);
    const nm = f ? f.name : '(삭제된 필드)';
    if (p.agg) {
      if (p.f === '__count') return nm + (p.tc ? ' △' : '');
      return Q.AGG_NAME[p.agg] + '(' + nm + ')' + (p.tc ? ' △' : '');
    }
    if (f && f.type === 'date' && p.dp) return DP_SHORT[p.dp].replace('#', '') + '(' + nm + ')';
    return nm;
  };
  Q.pillShort = function (p, ds) {
    const f = Q.field(ds, p.f);
    return f ? f.name : '?';
  };
  Q.pillKey = (p) => (p.agg ? p.agg + ':' : 'D:') + p.f + ':' + (p.dp || '') + ':' + (p.tc || '');

  /* ---------- 차원 값(키) 계산 ---------- */
  const p2 = (n) => (n < 10 ? '0' : '') + n;
  const WD = ['월', '화', '수', '목', '금', '토', '일'];
  Q.keyFn = function (p, ds) {
    const f = Q.field(ds, p.f);
    const id = p.f;
    if (!f) return () => null;
    if (f.type !== 'date' || !p.dp) return (r) => { const v = r[id]; return v === undefined ? null : v; };
    switch (p.dp) {
      case 'year': return (r) => { const v = r[id]; return v == null ? null : new Date(v).getFullYear(); };
      case 'quarter': return (r) => { const v = r[id]; if (v == null) return null; const d = new Date(v); return d.getFullYear() * 10 + Math.floor(d.getMonth() / 3) + 1; };
      case 'month': return (r) => { const v = r[id]; if (v == null) return null; const d = new Date(v); return d.getFullYear() * 100 + d.getMonth() + 1; };
      case 'week': return (r) => { const v = r[id]; return v == null ? null : BI.Calc.DP.trunc('week', v); };
      case 'day': return (r) => { const v = r[id]; return v == null ? null : BI.Calc.DP.trunc('day', v); };
      case 'exact': return (r) => { const v = r[id]; return v == null ? null : v; };
      case 'qtr': return (r) => { const v = r[id]; return v == null ? null : Math.floor(new Date(v).getMonth() / 3) + 1; };
      case 'mon': return (r) => { const v = r[id]; return v == null ? null : new Date(v).getMonth() + 1; };
      case 'wday': return (r) => { const v = r[id]; return v == null ? null : ((new Date(v).getDay() + 6) % 7) + 1; };
      case 'dom': return (r) => { const v = r[id]; return v == null ? null : new Date(v).getDate(); };
      case 'hour': return (r) => { const v = r[id]; return v == null ? null : new Date(v).getHours(); };
    }
    return (r) => r[id];
  };

  Q.keyLabel = function (p, ds, k) {
    if (k == null) return '(Null)';
    const f = Q.field(ds, p.f);
    if (typeof k === 'boolean') return k ? 'True' : 'False';
    if (f && f.type === 'date') {
      switch (p.dp) {
        case 'year': return String(k);
        case 'quarter': return Math.floor(k / 10) + ' Q' + (k % 10);
        case 'month': return Math.floor(k / 100) + '-' + p2(k % 100);
        case 'week': case 'day': return BI.fmtDate(k);
        case 'qtr': return k + '분기';
        case 'mon': return k + '월';
        case 'wday': return WD[k - 1];
        case 'dom': return k + '일';
        case 'hour': return k + '시';
        default: return BI.fmtDate(k, true);
      }
    }
    if (typeof k === 'number') return Number.isInteger(k) ? String(k) : BI.formatNumber(k);
    return String(k);
  };
  /* 연속형(시간축) 날짜 여부 */
  Q.isTimeline = function (p, ds) {
    const f = p && Q.field(ds, p.f);
    return !!(f && f.type === 'date' && p.dp && ['year', 'quarter', 'month', 'week', 'day', 'exact'].includes(p.dp));
  };

  /* ---------- 집계기 ---------- */
  function makeAcc(agg) {
    switch (agg) {
      case 'COUNTD': return { s: new Set() };
      case 'MEDIAN': return { a: [] };
      case 'STDEV': case 'VAR': return { n: 0, mean: 0, m2: 0 };
      case 'MIN': case 'MAX': return { v: null };
      default: return { s: 0, n: 0 };
    }
  }
  function addAcc(acc, agg, v) {
    if (v == null) return;
    switch (agg) {
      case 'SUM': case 'AVG':
        if (typeof v !== 'number') { if (typeof v === 'boolean') v = v ? 1 : 0; else return; }
        acc.s += v; acc.n++; return;
      case 'COUNT': acc.n++; return;
      case 'COUNTD': acc.s.add(v); return;
      case 'MIN': if (acc.v == null || v < acc.v) acc.v = v; return;
      case 'MAX': if (acc.v == null || v > acc.v) acc.v = v; return;
      case 'MEDIAN': if (typeof v === 'number') acc.a.push(v); return;
      case 'STDEV': case 'VAR': {
        if (typeof v !== 'number') return;
        acc.n++;
        const d = v - acc.mean;
        acc.mean += d / acc.n;
        acc.m2 += d * (v - acc.mean);
        return;
      }
    }
  }
  function finAcc(acc, agg) {
    switch (agg) {
      case 'SUM': return acc.n ? acc.s : null;
      case 'AVG': return acc.n ? acc.s / acc.n : null;
      case 'COUNT': return acc.n;
      case 'COUNTD': return acc.s.size;
      case 'MIN': case 'MAX': return acc.v;
      case 'MEDIAN': if (!acc.a.length) return null; acc.a.sort((a, b) => a - b); return BI.quantile(acc.a, 0.5);
      case 'STDEV': return acc.n > 1 ? Math.sqrt(acc.m2 / (acc.n - 1)) : null;
      case 'VAR': return acc.n > 1 ? acc.m2 / (acc.n - 1) : null;
    }
    return null;
  }
  Q.valFn = (p) => (p.f === '__count' ? () => 1 : (r) => r[p.f]);

  /* ---------- 필터 ---------- */
  Q.FILTER_TYPES = { list: '목록', range: '범위', date: '기간', top: '상위 N' };

  Q.filterFn = function (flt, ds) {
    const f = Q.field(ds, flt.f);
    if (!f) return null;
    if (flt.type === 'list') {
      if (!flt.values) return null;
      const kf = Q.keyFn({ f: flt.f, dp: flt.dp }, ds);
      const set = new Set(flt.values.map((v) => (v === null ? '\u0000' : typeof v + ':' + v)));
      const ex = !!flt.exclude;
      return (r) => {
        const k = kf(r);
        const has = set.has(k === null ? '\u0000' : typeof k + ':' + k);
        return ex ? !has : has;
      };
    }
    if (flt.type === 'range') {
      const mn = flt.min == null || flt.min === '' ? null : +flt.min, mx = flt.max == null || flt.max === '' ? null : +flt.max;
      if (mn == null && mx == null && !flt.excludeNull) return null;
      const id = flt.f;
      return (r) => {
        let v = r[id];
        if (v == null) return !flt.excludeNull && mn == null && mx == null;
        if (typeof v !== 'number') v = +v;
        return (mn == null || v >= mn) && (mx == null || v <= mx);
      };
    }
    if (flt.type === 'date') {
      const from = flt.from == null ? null : flt.from, to = flt.to == null ? null : flt.to;
      if (from == null && to == null) return null;
      const id = flt.f;
      return (r) => { const v = r[id]; if (v == null) return false; return (from == null || v >= from) && (to == null || v <= to); };
    }
    return null;
  };

  /* 상위 N 필터 → 목록 필터로 변환 */
  Q.topFilterFn = function (flt, ds, rows) {
    if (!flt.n) return null;
    const kf = Q.keyFn({ f: flt.f, dp: flt.dp }, ds);
    const by = flt.by || { f: '__count', agg: 'SUM' };
    const vf = Q.valFn(by);
    const m = new Map();
    for (const r of rows) {
      const k = kf(r);
      let a = m.get(k);
      if (!a) m.set(k, (a = makeAcc(by.agg)));
      addAcc(a, by.agg, vf(r));
    }
    const arr = Array.from(m.entries()).map(([k, a]) => [k, finAcc(a, by.agg)]);
    arr.sort((a, b) => (flt.dir === 'bottom' ? (a[1] ?? Infinity) - (b[1] ?? Infinity) : (b[1] ?? -Infinity) - (a[1] ?? -Infinity)));
    const keep = new Set(arr.slice(0, +flt.n).map((x) => x[0]));
    return (r) => keep.has(kf(r));
  };

  /* conds: [{f, dp, key}] 대시보드 동작 필터 */
  Q.applyFilters = function (ds, filters, conds) {
    let rows = ds.rows;
    const fns = [];
    (filters || []).forEach((flt) => {
      if (flt.type === 'top') return;
      const fn = Q.filterFn(flt, ds);
      if (fn) fns.push(fn);
    });
    (conds || []).forEach((c) => {
      if (!Q.field(ds, c.f)) return;
      const kf = Q.keyFn({ f: c.f, dp: c.dp }, ds);
      const set = new Set(c.keys.map((k) => typeof k + ':' + k));
      fns.push((r) => { const k = kf(r); return set.has(typeof k + ':' + k); });
    });
    if (fns.length) rows = rows.filter((r) => { for (const fn of fns) if (!fn(r)) return false; return true; });
    const tops = (filters || []).filter((f) => f.type === 'top' && f.n);
    tops.forEach((flt) => {
      const fn = Q.topFilterFn(flt, ds, rows);
      if (fn) rows = rows.filter(fn);
    });
    return rows;
  };

  /* ---------- 집계 실행 ---------- */
  /* dims, meas: 필 배열. 반환: {dims, meas, rows:[{d:[], m:[]}], order:[Map(key→rank)]} */
  Q.aggregate = function (ds, rows, dims, meas) {
    const kfs = dims.map((p) => Q.keyFn(p, ds));
    const vfs = meas.map((p) => Q.valFn(p));
    const aggs = meas.map((p) => p.agg);
    const groups = new Map();
    const nd = dims.length, nm = meas.length;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      let key;
      const keys = new Array(nd);
      if (nd === 0) key = '';
      else if (nd === 1) { keys[0] = kfs[0](r); key = typeof keys[0] + ':' + keys[0]; }
      else {
        key = '';
        for (let j = 0; j < nd; j++) { const k = kfs[j](r); keys[j] = k; key += typeof k + ':' + k + '\u0001'; }
      }
      let g = groups.get(key);
      if (!g) {
        g = { d: keys, a: aggs.map(makeAcc) };
        groups.set(key, g);
      }
      for (let j = 0; j < nm; j++) addAcc(g.a[j], aggs[j], vfs[j](r));
    }
    const out = [];
    groups.forEach((g) => out.push({ d: g.d, m: g.a.map((a, j) => finAcc(a, aggs[j])) }));
    return { dims, meas, rows: out };
  };

  /* 정렬: 각 차원의 순위 맵 생성 후 사전식 정렬 */
  Q.sortResult = function (res, ds) {
    const order = res.dims.map((p, j) => {
      const vals = new Map();
      for (const r of res.rows) {
        const k = r.d[j];
        const sk = typeof k + ':' + k;
        if (!vals.has(sk)) vals.set(sk, { k, t: 0 });
        if (p.sort === 'mdesc' || p.sort === 'masc') {
          const mi = p.sortBy != null && p.sortBy < res.meas.length ? p.sortBy : 0;
          const v = r.m[mi];
          if (typeof v === 'number') vals.get(sk).t += v;
        }
      }
      const arr = Array.from(vals.values());
      if (p.sort === 'mdesc') arr.sort((a, b) => b.t - a.t);
      else if (p.sort === 'masc') arr.sort((a, b) => a.t - b.t);
      else if (p.sort === 'desc') arr.sort((a, b) => BI.cmp(b.k, a.k));
      else arr.sort((a, b) => BI.cmp(a.k, b.k));
      const m = new Map();
      arr.forEach((x, i) => m.set(typeof x.k + ':' + x.k, i));
      return m;
    });
    res.order = order;
    const nd = res.dims.length;
    res.rows.forEach((r) => (r._o = r.d.map((k, j) => order[j].get(typeof k + ':' + k))));
    res.rows.sort((a, b) => {
      for (let j = 0; j < nd; j++) { const d = a._o[j] - b._o[j]; if (d) return d; }
      return 0;
    });
    return res;
  };

  /* 고유 조합(정렬됨) */
  Q.combos = function (res, idxs, ds) {
    const map = new Map();
    for (const r of res.rows) {
      const key = idxs.map((j) => typeof r.d[j] + ':' + r.d[j]).join('\u0001');
      if (!map.has(key)) map.set(key, { key, keys: idxs.map((j) => r.d[j]), o: idxs.map((j) => r._o ? r._o[j] : 0) });
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => { for (let i = 0; i < a.o.length; i++) { const d = a.o[i] - b.o[i]; if (d) return d; } return 0; });
    arr.forEach((c) => (c.label = c.keys.map((k, i) => Q.keyLabel(res.dims[idxs[i]], ds, k)).join(' · ')));
    return arr;
  };
  Q.comboKey = (r, idxs) => idxs.map((j) => typeof r.d[j] + ':' + r.d[j]).join('\u0001');

  /* 테이블 계산 */
  Q.applyTableCalcs = function (res, alongIdx) {
    const along = new Set(alongIdx);
    const part = res.dims.map((_, j) => j).filter((j) => !along.has(j));
    res.meas.forEach((p, mi) => {
      if (!p.tc) return;
      const groups = new Map();
      res.rows.forEach((r) => {
        const k = Q.comboKey(r, part);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
      });
      groups.forEach((list) => {
        const vals = list.map((r) => r.m[mi]);
        let out;
        switch (p.tc) {
          case 'running': { let s = 0; out = vals.map((v) => (v == null ? s : (s += v))); break; }
          case 'pct': { const t = vals.reduce((a, v) => a + (v || 0), 0); out = vals.map((v) => (v == null || !t ? null : v / t)); break; }
          case 'diff': out = vals.map((v, i) => (i === 0 || v == null || vals[i - 1] == null ? null : v - vals[i - 1])); break;
          case 'pctdiff': out = vals.map((v, i) => (i === 0 || v == null || !vals[i - 1] ? null : (v - vals[i - 1]) / Math.abs(vals[i - 1]))); break;
          case 'rank': { const s = vals.filter((v) => v != null).sort((a, b) => b - a); out = vals.map((v) => (v == null ? null : s.indexOf(v) + 1)); break; }
          case 'movavg': out = vals.map((v, i) => { const w = vals.slice(Math.max(0, i - 2), i + 1).filter((x) => x != null); return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null; }); break;
          default: out = vals;
        }
        list.forEach((r, i) => (r.m[mi] = out[i]));
      });
    });
  };

  /* 측정값 서식 결정 */
  Q.measureFormat = function (p, ds, sheetFmt) {
    if (p.tc === 'pct' || p.tc === 'pctdiff') return 'pct';
    if (p.tc === 'rank') return 'int';
    const f = Q.field(ds, p.f);
    if (f && f.type === 'date' && (p.agg === 'MIN' || p.agg === 'MAX')) return 'date';
    if (p.fmt) return p.fmt;
    if (sheetFmt && sheetFmt !== 'auto') return sheetFmt;
    if (f && /율|률|비율|rate|ratio|pct|percent|%/i.test(f.name) && (p.agg === 'AVG' || p.agg === 'MEDIAN' || p.agg === 'MIN' || p.agg === 'MAX')) return 'pct';
    return 'auto';
  };
  Q.fmtMeasure = function (v, fmt) {
    if (fmt === 'date') return BI.fmtDate(v);
    return BI.formatNumber(v, fmt);
  };

  /* 필드의 고유값 목록 (필터 UI용) */
  Q.uniqueValues = function (ds, fid, dp, limit) {
    const kf = Q.keyFn({ f: fid, dp }, ds);
    const m = new Map();
    for (const r of ds.rows) {
      const k = kf(r);
      const sk = typeof k + ':' + k;
      const e = m.get(sk);
      if (e) e.n++;
      else m.set(sk, { k, n: 1 });
    }
    const arr = Array.from(m.values()).sort((a, b) => BI.cmp(a.k, b.k));
    return limit ? arr.slice(0, limit) : arr;
  };
  Q.fieldRange = function (ds, fid) {
    let mn = null, mx = null;
    for (const r of ds.rows) {
      const v = r[fid];
      if (v == null || typeof v !== 'number') continue;
      if (mn == null || v < mn) mn = v;
      if (mx == null || v > mx) mx = v;
    }
    return [mn, mx];
  };
})();
