/* Offline BI - 질의 엔진: 필터 / 그룹화 / 집계 / 정렬 / 테이블 계산 */
(function () {
  'use strict';
  const BI = window.BI;
  const Q = (BI.Query = {});

  Q.AGGS = [
    ['SUM', '합계'], ['AVG', '평균'], ['MEDIAN', '중앙값'], ['COUNT', '개수'], ['COUNTD', '고유 개수'],
    ['MIN', '최소값'], ['MAX', '최대값'], ['STDEV', '표준편차'], ['VAR', '분산'], ['FIRST', '첫 값'], ['LAST', '마지막 값'],
  ];
  Q.AGG_NAME = Object.assign(Object.fromEntries(Q.AGGS), { AGG: '집계', ATTR: '고유 값' });

  Q.DATE_PARTS = [
    ['year', '연도', true], ['quarter', '분기 (연-분기)', true], ['month', '월 (연-월)', true], ['week', '주 (시작일)', true],
    ['day', '일 (날짜)', true], ['exact', '정확한 날짜', true],
    ['qtr', '분기 (불연속)', false], ['mon', '월 (불연속)', false], ['wday', '요일', false], ['dom', '일 (불연속)', false], ['hour', '시간대', false],
  ];
  const DP_SHORT = { year: '연도', quarter: '분기', month: '월', week: '주', day: '일', exact: '날짜', qtr: '분기#', mon: '월#', wday: '요일', dom: '일#', hour: '시간' };
  Q.TC = [['', '없음'], ['running', '누계'], ['ytd', '연간 누계 (YTD)'], ['pct', '구성비 (%)'], ['diff', '차이'], ['pctdiff', '증감률 (%)'], ['yoy', '전년 동기 대비 증감률 (%)'], ['pctfirst', '첫 값 대비 (%)'], ['rank', '순위'], ['movavg', '이동 평균']];
  Q.TC_NAME = Object.fromEntries(Q.TC);
  Q.TC_DIRS = [['auto', '자동'], ['across', '표 (옆으로)'], ['down', '표 (아래로)'], ['table', '표 전체']];
  /* 테이블 계산 설명 (이름 뒤에 붙임) */
  Q.tcDesc = function (p) {
    if (!p || !p.tc) return '';
    const n = +p.tcN || 0;
    if (p.tc === 'movavg') return '이동 평균(' + (n || 3) + ')';
    if ((p.tc === 'diff' || p.tc === 'pctdiff') && n > 1) return (p.tc === 'diff' ? '차이' : '증감률') + '(' + n + '칸 전 대비)';
    if (p.tc === 'running' && p.tcRestart === 'year') return '연간 누계';
    return (Q.TC_NAME[p.tc] || p.tc).replace(/ \(.*\)$/, '');
  };

  Q.isMeasure = (p) => !!(p && p.agg);
  Q.field = (ds, id) => BI.Data.fieldById(ds, id);

  Q.pillLabel = function (p, ds) {
    const f = Q.field(ds, p.f);
    const nm = f ? f.name : '(삭제된 필드)';
    if (p.agg) {
      const tc = p.tc ? ' · ' + Q.tcDesc(p) : '';
      if (p.alias) return p.alias + tc;
      if (p.f === '__count') return nm + tc;
      if (f && f.aggCalc) return nm + tc;
      return Q.AGG_NAME[p.agg] + '(' + nm + ')' + tc;
    }
    if (f && f.type === 'date' && p.dp) return DP_SHORT[p.dp].replace('#', '') + '(' + nm + ')';
    return nm;
  };
  Q.pillShort = function (p, ds) {
    const f = Q.field(ds, p.f);
    return f ? f.name : '?';
  };
  Q.pillKey = (p) => (p.agg ? p.agg + ':' : 'D:') + p.f + ':' + (p.dp || '') + ':' + (p.tc ? p.tc + '/' + (p.tcDir || '') + '/' + (p.tcDims || []).join(',') + '/' + (p.tcN || '') + '/' + (p.tcRestart || '') : '');

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
  /* 연속 날짜 키의 다음 기간 (빈 기간 채우기용) */
  Q.nextDateKey = function (dp, k) {
    switch (dp) {
      case 'year': return k + 1;
      case 'quarter': { const y = Math.floor(k / 10), q = k % 10; return q >= 4 ? (y + 1) * 10 + 1 : k + 1; }
      case 'month': { const y = Math.floor(k / 100), m = k % 100; return m >= 12 ? (y + 1) * 100 + 1 : k + 1; }
      case 'week': { const d = new Date(k); d.setDate(d.getDate() + 7); return d.getTime(); }
      case 'day': { const d = new Date(k); d.setDate(d.getDate() + 1); return d.getTime(); }
    }
    return null;
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
      case 'MIN': case 'MAX': case 'FIRST': case 'LAST': return { v: null };
      case 'ATTR': return { v: undefined };
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
      case 'FIRST': if (acc.v == null) acc.v = v; return;
      case 'LAST': acc.v = v; return;
      case 'ATTR': if (acc.v === undefined) acc.v = v; else if (acc.v !== v) acc.v = '*'; return;
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
      case 'MIN': case 'MAX': case 'FIRST': case 'LAST': return acc.v;
      case 'ATTR': return acc.v === undefined ? null : acc.v;
      case 'MEDIAN': if (!acc.a.length) return null; acc.a.sort((a, b) => a - b); return BI.quantile(acc.a, 0.5);
      case 'STDEV': return acc.n > 1 ? Math.sqrt(acc.m2 / (acc.n - 1)) : null;
      case 'VAR': return acc.n > 1 ? acc.m2 / (acc.n - 1) : null;
    }
    return null;
  }
  Q.makeAcc = makeAcc; Q.addAcc = addAcc; Q.finAcc = finAcc;
  Q.valFn = (p) => (p.f === '__count' ? () => 1 : (r) => r[p.f]);

  /* 집계 계산 필드(SUM([a])/SUM([b]) 등) 컴파일 캐시: 행 배열·수식이 같으면 재사용 */
  const aggCache = new WeakMap();
  Q.aggCalcOf = function (ds, f) {
    if (!f || !f.aggCalc || !f.calc) return null;
    let m = aggCache.get(ds.rows);
    if (!m) aggCache.set(ds.rows, (m = new Map()));
    const key = f.id + '\u0001' + f.calc;
    let c = m.get(key);
    if (!c) {
      try { c = BI.Calc.compile(f.calc, ds, f.id); } catch (e) { c = { error: e.message }; }
      m.set(key, c);
    }
    return c.error || !c.isAgg ? null : c;
  };
  // 측정값 하나를 그룹별로 누적하는 도구 (일반 집계 / 집계 계산 필드 공통)
  function measAcc(ds, p) {
    const f = Q.field(ds, p.f);
    const c = f && f.aggCalc ? Q.aggCalcOf(ds, f) : null;
    if (c) {
      const subs = c.aggs;
      return {
        make: () => subs.map((a) => makeAcc(a.agg)),
        add: (acc, r) => { for (let j = 0; j < subs.length; j++) { let v; try { v = subs[j].fn(r); } catch (e) { v = null; } addAcc(acc[j], subs[j].agg, v); } },
        fin: (acc) => { let v; try { v = c.fn({ __a: acc.map((a, j) => finAcc(a, subs[j].agg)) }); } catch (e) { v = null; } return typeof v === 'number' && !isFinite(v) ? null : v === undefined ? null : v; },
      };
    }
    if (f && f.aggCalc) return { make: () => null, add: () => {}, fin: () => null };
    const agg = p.agg || 'SUM', vf = Q.valFn(p);
    return { make: () => makeAcc(agg), add: (acc, r) => addAcc(acc, agg, vf(r)), fin: (acc) => finAcc(acc, agg) };
  }
  Q.measAcc = measAcc;

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
      let from = flt.from == null ? null : flt.from, to = flt.to == null ? null : flt.to;
      if (flt.rel) { const rr = Q.relativeRange(flt, ds); if (rr) { from = rr[0]; to = rr[1]; } }
      // nulls: 'include'(기간과 관계없이 Null 포함) / 'exclude'(Null 제외) / 기본: 기간을 정하면 Null 제외
      const nulls = flt.nulls || 'auto';
      if (from == null && to == null && nulls !== 'exclude') return null;
      const id = flt.f;
      const keepNull = nulls === 'include';
      return (r) => { const v = r[id]; if (v == null) return keepNull; return (from == null || v >= from) && (to == null || v <= to); };
    }
    return null;
  };

  /* 상대 기간 (매번 데이터의 마지막 날짜 기준으로 계산): rel = {unit:'day'|'month'|'year', n} 또는 {unit:'ytd'|'qtd'|'ly'} */
  Q.relativeRange = function (flt, ds) {
    const rel = flt.rel;
    if (!rel) return null;
    let mx = null;
    for (const r of ds.rows) { const v = r[flt.f]; if (v != null && (mx == null || v > mx)) mx = v; }
    if (mx == null) return null;
    const DP = BI.Calc.DP, end = new Date(mx);
    const eod = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).getTime();
    const n = Math.max(1, +rel.n || 1);
    switch (rel.unit) {
      case 'day': return [DP.add('day', -(n - 1), DP.trunc('day', mx)), eod];
      case 'week': return [DP.add('day', -(7 * n - 1), DP.trunc('day', mx)), eod];
      case 'month': return [DP.add('month', -n, DP.trunc('day', mx)) + 86400000, eod];
      case 'year': return [DP.add('year', -n, DP.trunc('day', mx)) + 86400000, eod];
      case 'ytd': return [new Date(end.getFullYear(), 0, 1).getTime(), eod];
      case 'qtd': return [DP.trunc('quarter', mx), eod];
      case 'mtd': return [DP.trunc('month', mx), eod];
      case 'ly': return [new Date(end.getFullYear() - 1, 0, 1).getTime(), new Date(end.getFullYear() - 1, 11, 31, 23, 59, 59, 999).getTime()];
    }
    return null;
  };
  Q.relLabel = function (rel) {
    if (!rel) return '';
    const n = +rel.n || 1;
    return { day: '최근 ' + n + '일', week: '최근 ' + n + '주', month: '최근 ' + n + '개월', year: '최근 ' + n + '년', ytd: '올해 (YTD)', qtd: '이번 분기', mtd: '이번 달', ly: '작년' }[rel.unit] || '';
  };

  /* 상위 N 필터 → 목록 필터로 변환 */
  Q.topFilterFn = function (flt, ds, rows) {
    if (!flt.n) return null;
    const kf = Q.keyFn({ f: flt.f, dp: flt.dp }, ds);
    const by = flt.by || { f: '__count', agg: 'SUM' };
    const ma = measAcc(ds, by);
    const m = new Map();
    for (const r of rows) {
      const k = kf(r);
      let a = m.get(k);
      if (!a) m.set(k, (a = ma.make()));
      ma.add(a, r);
    }
    const arr = Array.from(m.entries()).map(([k, a]) => [k, ma.fin(a)]);
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
    const ma = meas.map((p) => measAcc(ds, p));
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
        g = { d: keys, a: ma.map((x) => x.make()) };
        groups.set(key, g);
      }
      for (let j = 0; j < nm; j++) ma[j].add(g.a[j], r);
    }
    const out = [];
    groups.forEach((g) => out.push({ d: g.d, m: g.a.map((a, j) => ma[j].fin(a)) }));
    return { dims, meas, rows: out };
  };

  /* 정렬: 각 차원의 순위 맵 생성 후 사전식 정렬 */
  Q.sortResult = function (res, ds, rows) {
    const order = res.dims.map((p, j) => {
      const vals = new Map();
      // 다른 필드 기준 정렬: 이 차원별로 지정 측정값을 따로 집계
      let byField = null;
      if (p.sort === 'field' && p.sortField && rows) {
        const sf = p.sortField;
        const r2 = Q.aggregate(ds, rows, [Object.assign({}, p, { sort: null })], [{ f: sf.f, agg: sf.agg || 'SUM' }]);
        byField = new Map(r2.rows.map((x) => [typeof x.d[0] + ':' + x.d[0], x.m[0]]));
      }
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
      if (p.sort === 'manual' && Array.isArray(p.sortList)) {
        const pos = new Map(p.sortList.map((k, i) => [typeof k + ':' + k, i]));
        const big = p.sortList.length;
        arr.sort((a, b) => { const x = pos.has(typeof a.k + ':' + a.k) ? pos.get(typeof a.k + ':' + a.k) : big, y = pos.has(typeof b.k + ':' + b.k) ? pos.get(typeof b.k + ':' + b.k) : big; return x - y || BI.cmp(a.k, b.k); });
      } else if (byField) {
        const dir = p.sortField.dir === 'asc' ? 1 : -1;
        const v = (x) => { const y = byField.get(typeof x.k + ':' + x.k); return typeof y === 'number' ? y : null; };
        arr.sort((a, b) => { const x = v(a), y = v(b); if (x == null && y == null) return BI.cmp(a.k, b.k); if (x == null) return 1; if (y == null) return -1; return (x - y) * dir || BI.cmp(a.k, b.k); });
      } else if (p.sort === 'mdesc') arr.sort((a, b) => b.t - a.t);
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

  /* 테이블 계산
     shelf: { col:[차원 인덱스], row:[차원 인덱스] } — 열/행 선반에 놓인 차원 위치.
     계산 방향(p.tcDir): auto(열 차원 → 없으면 행 차원 → 없으면 전체) / across(열) / down(행) / table(전체) / dims(p.tcDims 필드 기준)
     방향에 들어가지 않은 차원은 파티션(구간)이 되어 구간마다 따로 계산합니다. 차트 종류와 관계없이 같은 규칙입니다. */
  Q.tcAlong = function (p, res, shelf) {
    const all = res.dims.map((_, j) => j);
    const col = (shelf && shelf.col) || [], row = (shelf && shelf.row) || [];
    switch (p.tcDir) {
      case 'across': return col.slice();
      case 'down': return row.slice();
      case 'table': return all;
      case 'dims': {
        const ids = p.tcDims || [];
        return all.filter((j) => { const d = res.dims[j]; return ids.includes(d.f + (d.dp ? '@' + d.dp : '')) || ids.includes(d.f); });
      }
    }
    if (col.length) return col.slice();
    if (row.length) return row.slice();
    return all;
  };
  const yearOfKey = (pd, k) => {
    if (k == null) return null;
    switch (pd) {
      case 'year': return k;
      case 'quarter': return Math.floor(k / 10);
      case 'month': return Math.floor(k / 100);
      case 'week': case 'day': case 'exact': return new Date(k).getFullYear();
    }
    return null;
  };
  // 1년 전 같은 기간의 키
  const prevYearKey = (pd, k) => {
    if (k == null) return null;
    switch (pd) {
      case 'year': return k - 1;
      case 'quarter': return k - 10;
      case 'month': return k - 100;
      case 'week': return k - 52 * 7 * 86400000;
      case 'day': case 'exact': { const d = new Date(k); d.setFullYear(d.getFullYear() - 1); return d.getTime(); }
    }
    return null;
  };
  const DATE_DP = ['year', 'quarter', 'month', 'week', 'day', 'exact'];
  Q.applyTableCalcs = function (res, shelf, ds) {
    if (Array.isArray(shelf)) shelf = { col: shelf, row: [] };
    res.meas.forEach((p, mi) => {
      if (!p.tc) return;
      const along = Q.tcAlong(p, res, shelf);
      const aset = new Set(along);
      const part = res.dims.map((_, j) => j).filter((j) => !aset.has(j));
      // 연도별 다시 시작: 방향 안의 날짜 차원에서 연도를 구해 파티션에 추가
      const restart = p.tc === 'ytd' || p.tcRestart === 'year';
      const dateDim = along.find((j) => ds ? Q.isTimeline(res.dims[j], ds) : DATE_DP.includes(res.dims[j].dp));
      if (p.tc === 'yoy') {
        // 전년 동기: 모든 차원 키가 같고 날짜 차원만 1년 전인 값과 비교
        let dj = dateDim;
        if (dj == null) dj = res.dims.findIndex((d) => ds ? Q.isTimeline(d, ds) : DATE_DP.includes(d.dp));
        if (dj == null || dj < 0) {
          // 날짜 차원이 없으면 방향의 바로 앞 칸과 비교
          return applyGroups(res, mi, along, part, Object.assign({}, p, { tc: 'pctdiff' }), false, null);
        }
        const pd = res.dims[dj].dp;
        const idx = new Map();
        const keyOf = (r, kj) => r.d.map((k, j) => (j === dj ? kj : k)).map((k) => typeof k + ':' + k).join('\u0001');
        res.rows.forEach((r) => idx.set(keyOf(r, r.d[dj]), r.m[mi]));
        const out = res.rows.map((r) => {
          const v = r.m[mi];
          const pk = prevYearKey(pd, r.d[dj]);
          const pv = pk == null ? undefined : idx.get(keyOf(r, pk));
          return v == null || pv == null || !pv ? null : (v - pv) / Math.abs(pv);
        });
        res.rows.forEach((r, i) => (r.m[mi] = out[i]));
        return;
      }
      applyGroups(res, mi, along, part, p, restart, dateDim);
    });
  };
  function applyGroups(res, mi, along, part, p, restart, dateDim) {
    const groups = new Map();
    res.rows.forEach((r) => {
      let k = Q.comboKey(r, part);
      if (restart && dateDim != null) k += '\u0003' + yearOfKey(res.dims[dateDim].dp, r.d[dateDim]);
      let g = groups.get(k);
      if (!g) groups.set(k, (g = []));
      g.push(r);
    });
    const n = Math.max(1, Math.round(+p.tcN || 0) || (p.tc === 'movavg' ? 3 : 1));
    groups.forEach((list) => {
      // 방향 차원 순서대로 정렬 (정렬 순위 _o 기준)
      if (along.length && list[0] && list[0]._o) list = list.slice().sort((a, b) => { for (const j of along) { const d = a._o[j] - b._o[j]; if (d) return d; } return 0; });
      const vals = list.map((r) => r.m[mi]);
      let out;
      switch (p.tc) {
        case 'running': case 'ytd': { let s = 0, any = false; out = vals.map((v) => { if (v != null) { s += v; any = true; } return any ? s : null; }); break; }
        case 'pct': { const t = vals.reduce((a, v) => a + (v || 0), 0); out = vals.map((v) => (v == null || !t ? null : v / t)); break; }
        case 'diff': out = vals.map((v, i) => (i < n || v == null || vals[i - n] == null ? null : v - vals[i - n])); break;
        case 'pctdiff': out = vals.map((v, i) => (i < n || v == null || !vals[i - n] ? null : (v - vals[i - n]) / Math.abs(vals[i - n]))); break;
        case 'pctfirst': { const f0 = vals.find((v) => v != null); out = vals.map((v) => (v == null || !f0 ? null : v / f0)); break; }
        case 'rank': { const s = vals.filter((v) => v != null).sort((a, b) => b - a); out = vals.map((v) => (v == null ? null : s.indexOf(v) + 1)); break; }
        case 'movavg': out = vals.map((v, i) => { const w = vals.slice(Math.max(0, i - n + 1), i + 1).filter((x) => x != null); return w.length ? w.reduce((a, b) => a + b, 0) / w.length : null; }); break;
        default: out = vals;
      }
      list.forEach((r, i) => (r.m[mi] = out[i]));
    });
  }

  /* 측정값 서식 결정 */
  Q.measureFormat = function (p, ds, sheetFmt) {
    if (p.tc === 'pct' || p.tc === 'pctdiff' || p.tc === 'yoy' || p.tc === 'pctfirst') return p.fmt && /^pct/.test(p.fmt) ? p.fmt : 'pct';
    if (p.tc === 'rank') return 'int';
    const f = Q.field(ds, p.f);
    if (f && f.type === 'date' && (p.agg === 'MIN' || p.agg === 'MAX' || p.agg === 'FIRST' || p.agg === 'LAST')) return 'date';
    // 원본 입력 단위(천원/백만원/억원): 필 → 필드 순으로 적용, 억·조 같은 금액 단위 형식에서 환산
    const unit = +(p.unit || (f && f.unit) || 0);
    const withUnit = (fmt) => (unit > 1 && p.agg !== 'COUNT' && p.agg !== 'COUNTD' && p.f !== '__count' ? fmt + '@' + unit : fmt);
    if (p.fmt) return withUnit(p.fmt);
    if (sheetFmt && sheetFmt !== 'auto') return withUnit(sheetFmt);
    if (f && /율|률|비율|rate|ratio|pct|percent|%/i.test(f.name) && (f.aggCalc || p.agg === 'AVG' || p.agg === 'MEDIAN' || p.agg === 'MIN' || p.agg === 'MAX')) return 'pct';
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
