/* Offline BI - 차트 종류 정의 및 ECharts 옵션 생성 */
(function () {
  'use strict';
  const BI = window.BI;
  const Q = BI.Query;
  const CH = (BI.Charts = {});

  const S = (p) => '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  const R = (x, y, w, h, c) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + (c || 'currentColor') + '" stroke="none"/>';

  /* id, 이름, 필요(차원/측정값 최소), 아이콘, 설명 */
  CH.TYPES = [
    { id: 'auto', name: '자동', d: 0, m: 0, icon: S('<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/>'), hint: '필드 구성에 맞춰 자동으로 차트를 선택합니다' },
    { id: 'table', name: '텍스트 테이블', d: 1, m: 0, icon: S('<rect x="3" y="4" width="18" height="16"/><path d="M3 9h18M3 14h18M9 4v16"/>'), hint: '차원 1개 이상, 측정값 0개 이상' },
    { id: 'hltable', name: '하이라이트 테이블', d: 1, m: 1, icon: S(R(3, 4, 6, 5, '#9ecae1') + R(9, 4, 6, 5, '#3182bd') + R(15, 4, 6, 5, '#c6dbef') + R(3, 9, 6, 5, '#6baed6') + R(9, 9, 6, 5, '#deebf7') + R(15, 9, 6, 5, '#08519c') + R(3, 14, 6, 6, '#c6dbef') + R(9, 14, 6, 6, '#6baed6') + R(15, 14, 6, 6, '#9ecae1')), hint: '차원 1개 이상, 측정값 1개' },
    { id: 'heatmap', name: '히트맵', d: 2, m: 1, icon: S(R(3, 3, 4, 4, '#fdd0a2') + R(8, 3, 4, 4, '#e6550d') + R(13, 3, 4, 4, '#fdae6b') + R(18, 3, 3, 4, '#a63603') + R(3, 8, 4, 4, '#a63603') + R(8, 8, 4, 4, '#fdd0a2') + R(13, 8, 4, 4, '#e6550d') + R(18, 8, 3, 4, '#fdae6b') + R(3, 13, 4, 4, '#fdae6b') + R(8, 13, 4, 4, '#a63603') + R(13, 13, 4, 4, '#fdd0a2') + R(18, 13, 3, 4, '#e6550d') + R(3, 18, 4, 3, '#e6550d') + R(8, 18, 4, 3, '#fdae6b') + R(13, 18, 4, 3, '#a63603') + R(18, 18, 3, 3, '#fdd0a2')), hint: '차원 2개(열/행), 측정값 1개' },
    { id: 'bar', name: '세로 막대', d: 0, m: 1, icon: S(R(4, 12, 4, 8) + R(10, 6, 4, 14) + R(16, 9, 4, 11)), hint: '차원 0개 이상, 측정값 1개 이상' },
    { id: 'hbar', name: '가로 막대', d: 0, m: 1, icon: S(R(4, 4, 12, 4) + R(4, 10, 16, 4) + R(4, 16, 8, 4)), hint: '차원 0개 이상, 측정값 1개 이상' },
    { id: 'groupbar', name: '묶은 막대 (그룹)', d: 1, m: 1, icon: S(R(3, 10, 3, 10, '#4e79a7') + R(6, 6, 3, 14, '#f28e2b') + R(11, 12, 3, 8, '#4e79a7') + R(14, 8, 3, 12, '#f28e2b') + R(19, 14, 2, 6, '#4e79a7')), hint: '차원 2개(축+색상), 측정값 1개 이상 - 색상별 막대를 나란히 표시' },
    { id: 'stackbar', name: '누적 세로 막대', d: 1, m: 1, icon: S(R(4, 12, 4, 4, '#4e79a7') + R(4, 16, 4, 4, '#f28e2b') + R(10, 5, 4, 8, '#4e79a7') + R(10, 13, 4, 7, '#f28e2b') + R(16, 9, 4, 6, '#4e79a7') + R(16, 15, 4, 5, '#f28e2b')), hint: '차원 2개(축+색상), 측정값 1개' },
    { id: 'stackhbar', name: '누적 가로 막대', d: 1, m: 1, icon: S(R(4, 4, 7, 4, '#4e79a7') + R(11, 4, 5, 4, '#f28e2b') + R(4, 10, 9, 4, '#4e79a7') + R(13, 10, 7, 4, '#f28e2b') + R(4, 16, 4, 4, '#4e79a7') + R(8, 16, 4, 4, '#f28e2b')), hint: '차원 2개(축+색상), 측정값 1개' },
    { id: 'pct100', name: '100% 누적 막대', d: 1, m: 1, icon: S(R(4, 4, 4, 8, '#4e79a7') + R(4, 12, 4, 8, '#f28e2b') + R(10, 4, 4, 5, '#4e79a7') + R(10, 9, 4, 11, '#f28e2b') + R(16, 4, 4, 11, '#4e79a7') + R(16, 15, 4, 5, '#f28e2b')), hint: '차원 2개(축+색상), 측정값 1개' },
    { id: 'line', name: '라인', d: 1, m: 1, icon: S('<path d="M3 17l5-6 4 3 4-7 5 4"/>'), hint: '날짜/차원 1개, 측정값 1개 이상' },
    { id: 'area', name: '영역', d: 1, m: 1, icon: S('<path d="M3 18l5-7 4 3 4-6 5 4v6H3z" fill="currentColor" fill-opacity=".35"/>'), hint: '날짜/차원 1개, 측정값 1개 이상' },
    { id: 'stackarea', name: '누적 영역', d: 1, m: 1, icon: S('<path d="M3 20l5-5 4 2 4-4 5 2v5z" fill="#f28e2b" stroke="none"/><path d="M3 15l5-6 4 3 4-6 5 3v6l-5-2-4 4-4-2-5 5z" fill="#4e79a7" stroke="none"/>'), hint: '날짜/차원 2개(축+색상), 측정값 1개' },
    { id: 'combo', name: '콤보 (막대+라인)', d: 1, m: 2, icon: S(R(4, 12, 4, 8, '#9ecae1') + R(10, 9, 4, 11, '#9ecae1') + R(16, 13, 4, 7, '#9ecae1') + '<path d="M3 9l6-4 6 5 6-6" stroke="#e15759"/>'), hint: '차원 1개, 측정값 2개 이상 (첫번째=막대, 나머지=라인 보조축)' },
    { id: 'dualline', name: '이중 축 라인', d: 1, m: 2, icon: S('<path d="M3 16l5-5 4 3 4-6 5 3" stroke="#4e79a7"/><path d="M3 8l5 3 4-1 4 5 5-2" stroke="#e15759"/>'), hint: '차원 1개, 측정값 2개 (두번째 측정값 보조축)' },
    { id: 'pie', name: '파이', d: 1, m: 1, icon: S('<circle cx="12" cy="12" r="8"/><path d="M12 4v8l6 5.5" />' + '<path d="M12 12V4a8 8 0 0 1 8 8z" fill="currentColor"/>'), hint: '차원 1개, 측정값 1개' },
    { id: 'donut', name: '도넛', d: 1, m: 1, icon: S('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 4a8 8 0 0 1 8 8h-4a4 4 0 0 0-4-4z" fill="currentColor"/>'), hint: '차원 1개, 측정값 1개' },
    { id: 'treemap', name: '트리맵', d: 1, m: 1, icon: S(R(3, 3, 10, 11, '#4e79a7') + R(13, 3, 8, 6, '#f28e2b') + R(13, 9, 8, 5, '#e15759') + R(3, 14, 6, 7, '#76b7b2') + R(9, 14, 12, 7, '#59a14f')), hint: '차원 1개 이상, 측정값 1개' },
    { id: 'sunburst', name: '선버스트', d: 1, m: 1, icon: S('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 3v4M21 12h-4M12 17v4M5.6 5.6l3 3"/>'), hint: '차원 2개 이상(계층), 측정값 1개' },
    { id: 'scatter', name: '분산형 (산점도)', d: 0, m: 2, icon: S('<circle cx="6" cy="16" r="1.6" fill="currentColor"/><circle cx="9" cy="11" r="1.6" fill="currentColor"/><circle cx="13" cy="14" r="1.6" fill="currentColor"/><circle cx="16" cy="8" r="1.6" fill="currentColor"/><circle cx="19" cy="5" r="1.6" fill="currentColor"/><path d="M3 3v18h18"/>'), hint: '측정값 2개 (열=X, 행=Y), 세부정보 차원' },
    { id: 'bubble', name: '버블', d: 1, m: 3, icon: S('<circle cx="8" cy="14" r="4" fill="#4e79a7" stroke="none" fill-opacity=".8"/><circle cx="16" cy="9" r="5" fill="#f28e2b" stroke="none" fill-opacity=".8"/><circle cx="17" cy="18" r="2.5" fill="#59a14f" stroke="none"/>'), hint: '측정값 3개 (X, Y, 크기), 차원 1개' },
    { id: 'histogram', name: '히스토그램', d: 0, m: 1, icon: S(R(3, 15, 3, 5) + R(6, 10, 3, 10) + R(9, 5, 3, 15) + R(12, 8, 3, 12) + R(15, 13, 3, 7) + R(18, 17, 3, 3)), hint: '측정값 1개 (행 단위 값 분포)' },
    { id: 'boxplot', name: '상자 수염 그림', d: 0, m: 1, icon: S('<path d="M7 3v4M7 17v4M17 6v3M17 15v3"/><rect x="4" y="7" width="6" height="10"/><path d="M4 12h6"/><rect x="14" y="9" width="6" height="6"/><path d="M14 11h6"/>'), hint: '측정값 1개, 차원 0개 이상 (행 단위 분포)' },
    { id: 'waterfall', name: '폭포 (워터폴)', d: 1, m: 1, icon: S(R(3, 6, 3, 14, '#4e79a7') + R(7, 6, 3, 5, '#59a14f') + R(11, 4, 3, 2, '#59a14f') + R(15, 4, 3, 7, '#e15759') + R(19, 11, 2, 9, '#4e79a7')), hint: '차원 1개, 측정값 1개' },
    { id: 'funnel', name: '퍼널', d: 1, m: 1, icon: S('<path d="M3 4h18l-3 5H6zM6.5 10h11l-2.5 5h-6zM9.5 16h5l-1.5 4h-2z" fill="currentColor" stroke="none"/>'), hint: '차원 1개, 측정값 1개' },
    { id: 'pareto', name: '파레토', d: 1, m: 1, icon: S(R(3, 6, 4, 14, '#9ecae1') + R(8, 10, 4, 10, '#9ecae1') + R(13, 14, 4, 6, '#9ecae1') + R(18, 17, 3, 3, '#9ecae1') + '<path d="M5 10l5-4 5-2 5-1" stroke="#e15759"/>'), hint: '차원 1개, 측정값 1개 (누적 비율 포함)' },
    { id: 'bullet', name: '불릿 (목표 대비)', d: 1, m: 2, icon: S(R(3, 5, 18, 5, '#dde3ea') + R(3, 6.5, 12, 2) + '<path d="M17 4v7" stroke="#e15759" stroke-width="2"/>' + R(3, 14, 18, 5, '#dde3ea') + R(3, 15.5, 16, 2) + '<path d="M14 13v7" stroke="#e15759" stroke-width="2"/>'), hint: '차원 1개, 측정값 2개 (실적, 목표)' },
    { id: 'radar', name: '레이더', d: 1, m: 1, icon: S('<path d="M12 3l8.5 6.2-3.2 10H6.7L3.5 9.2z"/><path d="M12 7l5 3.5-2 5.5H9l-2-5.5z" fill="currentColor" fill-opacity=".4"/>'), hint: '차원 1개(축 항목), 측정값 1개 이상' },
    { id: 'gauge', name: '게이지', d: 0, m: 1, icon: S('<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-6"/><circle cx="12" cy="17" r="1.3" fill="currentColor"/>'), hint: '측정값 1개 (두번째 측정값=목표)' },
    { id: 'kpi', name: 'KPI 카드', d: 0, m: 1, icon: S('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6 10h5M6 14h8"/><path d="M15 13l2-2 2 1" stroke="#59a14f"/>'), hint: '측정값 1개 이상 (날짜 차원이 있으면 추세/증감 표시)' },
    { id: 'sankey', name: '생키', d: 2, m: 1, icon: S(R(3, 4, 2, 7) + R(3, 13, 2, 7) + R(19, 3, 2, 5) + R(19, 10, 2, 11) + '<path d="M5 7c7 0 7-2 14-2M5 9c7 0 7 4 14 4M5 16c7 0 7 2 14 2" stroke-opacity=".6"/>'), hint: '차원 2개 이상(흐름), 측정값 1개' },
    { id: 'calendar', name: '달력 히트맵', d: 1, m: 1, icon: S('<rect x="3" y="5" width="18" height="15" rx="1"/><path d="M3 9h18M8 3v4M16 3v4"/>' + R(5, 11, 3, 3, '#3182bd') + R(10, 11, 3, 3, '#9ecae1') + R(15, 15, 3, 3, '#08519c') + R(5, 15, 3, 3, '#c6dbef')), hint: '날짜 차원 1개(일 단위), 측정값 1개' },
  ];
  CH.byId = Object.fromEntries(CH.TYPES.map((t) => [t.id, t]));

  CH.FONT = '"Malgun Gothic","맑은 고딕","Apple SD Gothic Neo","Noto Sans KR","Segoe UI",sans-serif';

  /* ---------- 시트 구성 분석 ---------- */
  CH.spec = function (sheet, ds) {
    const sh = sheet.shelves;
    const isM = Q.isMeasure;
    const sp = {
      colDims: sh.columns.filter((p) => !isM(p)),
      colMeas: sh.columns.filter(isM),
      rowDims: sh.rows.filter((p) => !isM(p)),
      rowMeas: sh.rows.filter(isM),
      color: sh.color, size: sh.size, label: sh.label,
      detail: sh.detail || [], tooltip: sh.tooltip || [],
    };
    // 질의용 차원/측정값 목록과 인덱스
    const dims = [], meas = [];
    const di = (p) => { dims.push(p); return dims.length - 1; };
    const mi = (p) => { const k = Q.pillKey(p); const e = meas.findIndex((x) => Q.pillKey(x) === k); if (e >= 0) return e; meas.push(p); return meas.length - 1; };
    sp.D = { col: sp.colDims.map(di), row: sp.rowDims.map(di), color: -1, detail: [], label: -1, size: -1, tooltip: [] };
    sp.M = { col: sp.colMeas.map(mi), row: sp.rowMeas.map(mi), color: -1, size: -1, label: -1, tooltip: [] };
    ['color', 'size', 'label'].forEach((s) => {
      const p = sh[s];
      if (!p) return;
      if (isM(p)) sp.M[s] = mi(p);
      else sp.D[s] = di(p);
    });
    sp.detail.forEach((p) => (isM(p) ? sp.M.tooltip.push(mi(p)) : sp.D.detail.push(di(p))));
    sp.tooltip.forEach((p) => (isM(p) ? sp.M.tooltip.push(mi(p)) : sp.D.tooltip.push(di(p))));
    sp.dims = dims;
    sp.meas = meas;
    sp.nDims = dims.length;
    sp.nMeas = meas.length;
    return sp;
  };

  /* 자동 차트 선택 (Tableau 자동 마크 유사) */
  CH.autoType = function (sp, ds) {
    const cm = sp.colMeas.length, rm = sp.rowMeas.length;
    const cd = sp.colDims.length, rd = sp.rowDims.length;
    if (!sp.nDims && !sp.nMeas) return null;
    if (cm && rm) return 'scatter';
    if (!cm && !rm) {
      if (sp.M.color >= 0 && (cd || rd)) return cd && rd ? 'heatmap' : 'hltable';
      return 'table';
    }
    const catDims = rm ? sp.colDims : sp.rowDims;
    if (catDims.length && Q.isTimeline(catDims[catDims.length - 1], ds) && rm) return 'line';
    if (rm && rd && !cd) return 'table';
    if (cm && cd && !rd) return 'table';
    return rm ? 'bar' : 'hbar';
  };

  CH.fits = function (t, sp) {
    const def = CH.byId[t];
    if (!def) return false;
    if (t === 'auto') return true;
    if (t === 'scatter') return sp.nMeas >= 2;
    if (t === 'heatmap') return sp.nDims >= 2 && sp.nMeas >= 1;
    if (t === 'calendar') return sp.dims.some((p) => p && BI.App && BI.App.fieldType(p.f) === 'date') && sp.nMeas >= 1;
    return sp.nDims >= def.d && sp.nMeas >= def.m;
  };

  /* ---------- 공통 렌더 컨텍스트 ---------- */
  function makeCtx(sheet, ds, rows, opts) {
    const sp = CH.spec(sheet, ds);
    const o = Object.assign({ labels: false, legend: true, numFmt: 'auto', palette: 'default', seq: 'blue', smooth: false, totals: false, bins: 0, trend: false, gaugeMax: '' }, sheet.options || {});
    const ctx = { sheet, ds, rows, sp, o, opts: opts || {} };
    ctx.palette = BI.PALETTES[o.palette] || BI.PALETTES.default;
    ctx.fmt = (mi) => Q.measureFormat(sp.meas[mi], ds, o.numFmt);
    ctx.fv = (mi, v) => Q.fmtMeasure(v, ctx.fmt(mi));
    ctx.ml = (mi) => Q.pillLabel(sp.meas[mi], ds);
    ctx.dl = (di) => Q.pillLabel(sp.dims[di], ds);
    ctx.kl = (di, k) => Q.keyLabel(sp.dims[di], ds, k);
    return ctx;
  }

  function runQuery(ctx, extraMeas) {
    const sp = ctx.sp;
    const meas = sp.meas.slice();
    if (extraMeas) extraMeas.forEach((p) => meas.push(p));
    if (!meas.length) meas.push({ f: '__count', agg: 'SUM' });
    if (!sp.meas.length) sp.meas = meas;
    const res = Q.aggregate(ctx.ds, ctx.rows, sp.dims, meas);
    Q.sortResult(res, ctx.ds);
    ctx.res = res;
    return res;
  }

  /* 툴팁 HTML */
  function tipHtml(ctx, r, extra) {
    if (!r) return '';
    const sp = ctx.sp;
    let h = '<div class="tip">';
    sp.dims.forEach((p, j) => {
      h += '<div><span class="tk">' + BI.esc(ctx.dl(j)) + '</span><b>' + BI.esc(ctx.kl(j, r.d[j])) + '</b></div>';
    });
    const seen = new Set();
    ctx.res.meas.forEach((p, i) => {
      const k = Q.pillKey(p);
      if (seen.has(k)) return;
      seen.add(k);
      h += '<div><span class="tk">' + BI.esc(Q.pillLabel(p, ctx.ds)) + '</span><b>' + BI.esc(ctx.fv(i, r.m[i])) + '</b></div>';
    });
    if (extra) h += extra;
    return h + '</div>';
  }

  function baseOption(ctx) {
    return {
      animationDuration: 350,
      animationDurationUpdate: 300,
      color: ctx.palette,
      textStyle: { fontFamily: CH.FONT },
      tooltip: {
        trigger: 'item',
        confine: true,
        appendToBody: false,
        backgroundColor: 'rgba(255,255,255,.97)',
        borderColor: '#c9d1da',
        textStyle: { color: '#222', fontSize: 12 },
        extraCssText: 'box-shadow:0 2px 10px rgba(0,0,0,.15);border-radius:4px;',
        formatter: (p) => {
          if (p.data && p.data._tip) return p.data._tip;
          if (p.data && p.data._r != null) return tipHtml(ctx, ctx.res.rows[p.data._r]);
          return BI.esc(p.name || '') + (p.value != null ? ': ' + BI.esc(String(p.value)) : '');
        },
      },
      toolbox: ctx.opts.toolbox === false ? undefined : { show: false },
    };
  }

  function legendOpt(ctx, show) {
    if (!ctx.o.legend || !show) return { show: false };
    return { type: 'scroll', top: 0, left: 'center', textStyle: { fontSize: 11 }, itemWidth: 14, itemHeight: 10 };
  }

  function sel(ctx, r) {
    if (!r) return null;
    return ctx.sp.dims.map((p, j) => ({ f: p.f, dp: p.dp || null, key: r.d[j], label: Q.pillLabel(p, ctx.ds) + ' = ' + ctx.kl(j, r.d[j]) }));
  }

  /* ---------- 데카르트 차트 (막대/라인/영역/콤보) ---------- */
  function cartesian(ctx, type) {
    const sp = ctx.sp;
    let horizontal = type === 'hbar' || type === 'stackhbar';
    if (type === 'auto-bar') horizontal = !sp.rowMeas.length && !!sp.colMeas.length;
    if ((type === 'bar' || type === 'groupbar' || type === 'stackbar' || type === 'pct100') && !sp.rowMeas.length && sp.colMeas.length && !sp.colDims.length && sp.rowDims.length) horizontal = true;
    if (type === 'pct100' && !sp.rowMeas.length && sp.colMeas.length) horizontal = true;
    let valM = horizontal ? sp.M.col.slice() : sp.M.row.slice();
    if (!valM.length) valM = (horizontal ? sp.M.row : sp.M.col).slice();
    if (!valM.length) ['label', 'size', 'color'].forEach((s) => { if (!valM.length && sp.M[s] >= 0) valM = [sp.M[s]]; });
    const res = runQuery(ctx);
    if (!valM.length) valM = [0];
    let catD = horizontal ? sp.D.row.concat(sp.D.col) : sp.D.col.concat(sp.D.row);
    const colorD = sp.D.color;
    // 보조 차원 (세부정보/레이블 차원)은 카테고리에 포함
    sp.D.detail.concat(sp.D.label >= 0 ? [sp.D.label] : []).concat(sp.D.tooltip).forEach((j) => catD.push(j));
    if (type === 'pareto' || type === 'waterfall') catD = catD.slice();

    Q.applyTableCalcs(res, catD);
    const cats = Q.combos(res, catD, ctx.ds);
    const catIdx = new Map(cats.map((c, i) => [c.key, i]));
    const colors = colorD >= 0 ? Q.combos(res, [colorD], ctx.ds) : [null];
    const isLineish = type === 'line' || type === 'area' || type === 'stackarea' || type === 'dualline';
    // Tableau처럼 색상 차원이 있는 막대는 기본적으로 누적
    const stacked = type === 'stackbar' || type === 'stackhbar' || type === 'pct100' || type === 'stackarea' || ((type === 'bar' || type === 'hbar' || type === 'auto-bar') && colorD >= 0);
    const colorMeas = sp.M.color;
    const labelM = sp.M.label;

    const series = [];
    const legendNames = [];
    let colorMin = Infinity, colorMax = -Infinity;
    if (colorMeas >= 0) res.rows.forEach((r) => { const v = r.m[colorMeas]; if (typeof v === 'number') { colorMin = Math.min(colorMin, v); colorMax = Math.max(colorMax, v); } });
    const cscale = colorMeas >= 0 ? BI.colorScale(colorMin, colorMax, ctx.o.seq) : null;

    valM.forEach((mi, vi) => {
      colors.forEach((cc, ci) => {
        const data = cats.map(() => null);
        res.rows.forEach((r, ri) => {
          if (cc && Q.comboKey(r, [colorD]) !== cc.key) return;
          const idx = catIdx.get(Q.comboKey(r, catD));
          if (idx == null) return;
          const v = r.m[mi];
          const item = { value: v, _r: ri };
          if (cscale) item.itemStyle = { color: cscale(r.m[colorMeas]) };
          if (labelM >= 0 && labelM !== mi) item._lbl = ctx.fv(labelM, r.m[labelM]);
          if (data[idx] && typeof data[idx].value === 'number' && typeof v === 'number') data[idx].value += v;
          else data[idx] = item;
        });
        let name = ctx.ml(mi);
        if (cc) name = valM.length > 1 ? cc.label + ' · ' + name : cc.label;
        legendNames.push(name);
        let stype = isLineish ? 'line' : 'bar';
        let yAxisIndex = 0;
        if (type === 'combo' && vi > 0) { stype = 'line'; yAxisIndex = 1; }
        if (type === 'dualline' && vi > 0) yAxisIndex = 1;
        const s = {
          name, type: stype, data,
          emphasis: { focus: 'series' },
          barMaxWidth: 60,
        };
        if (horizontal) s.xAxisIndex = yAxisIndex; else s.yAxisIndex = yAxisIndex;
        if (stacked) s.stack = 'S' + (type === 'stackarea' ? '' : vi);
        if (type === 'area' || type === 'stackarea') s.areaStyle = { opacity: type === 'area' ? 0.25 : 0.75 };
        if (stype === 'line') {
          s.smooth = !!ctx.o.smooth;
          s.symbolSize = cats.length > 60 ? 0 : 6;
          s.showSymbol = cats.length <= 60;
          s.connectNulls = true;
          if (cscale) s.lineStyle = { color: '#888' };
        }
        const showLbl = ctx.o.labels || labelM >= 0;
        if (showLbl) {
          s.label = {
            show: true,
            position: stacked ? 'inside' : horizontal ? 'right' : 'top',
            fontSize: 11,
            formatter: (p) => (p.data && p.data._lbl != null ? p.data._lbl : ctx.fv(mi, p.data ? p.data.value : p.value)),
          };
        }
        series.push(s);
      });
    });

    // 100% 누적
    if (type === 'pct100') {
      const tot = cats.map((_, i) => series.reduce((a, s) => a + (s.data[i] && typeof s.data[i].value === 'number' ? Math.abs(s.data[i].value) : 0), 0));
      series.forEach((s) => {
        s.data = s.data.map((d, i) => (d ? Object.assign({}, d, { raw: d.value, value: tot[i] ? d.value / tot[i] : 0 }) : null));
        if (s.label) s.label.formatter = (p) => BI.formatNumber(p.value, 'pct');
      });
    }

    const opt = baseOption(ctx);
    const catAxis = {
      type: 'category',
      data: cats.map((c) => c.label),
      axisLabel: { fontSize: 11, hideOverlap: true, interval: 'auto', rotate: !horizontal && cats.length > 12 && cats.some((c) => c.label.length > 4) ? 35 : 0, formatter: (v) => (v.length > 22 ? v.slice(0, 21) + '…' : v) },
      axisTick: { alignWithLabel: true },
      name: catD.map((j) => ctx.dl(j)).join(' · '),
      nameLocation: 'middle',
      nameGap: horizontal ? 0 : 0,
      nameTextStyle: { color: 'transparent' },
    };
    if (horizontal) catAxis.inverse = true;
    const fmt0 = type === 'pct100' ? 'pct' : ctx.fmt(valM[0]);
    const valAxis = (name, fmt, pos) => ({
      type: 'value', name, nameLocation: 'middle', nameGap: horizontal ? 28 : 52, nameTextStyle: { color: '#555', fontSize: 11 },
      axisLabel: { fontSize: 11, formatter: BI.axisFormatter(fmt) },
      splitLine: { lineStyle: { color: '#eceff3' } },
      position: pos,
      max: type === 'pct100' ? 1 : undefined,
      scale: ctx.o.zeroBase === false,
    });
    const v1 = valAxis(valM.length === 1 || type === 'combo' || type === 'dualline' ? ctx.ml(valM[0]) : '', fmt0);
    const axes = [v1];
    if ((type === 'combo' || type === 'dualline') && valM.length > 1) {
      const a2 = valAxis(ctx.ml(valM[1]), ctx.fmt(valM[1]));
      a2.splitLine = { show: false };
      axes.push(a2);
    }
    const showLegend = series.length > 1;
    opt.legend = legendOpt(ctx, showLegend);
    opt.grid = { left: 12, right: axes.length > 1 ? 24 : 24, top: showLegend && ctx.o.legend ? 36 : 18, bottom: 12, containLabel: true };
    if (!horizontal) opt.grid.left = 34;
    opt.xAxis = horizontal ? axes : catAxis;
    opt.yAxis = horizontal ? catAxis : axes;
    opt.series = series;
    if (cats.length > 40 && !horizontal && type !== 'pareto') opt.dataZoom = [{ type: 'inside', xAxisIndex: 0, start: 0, end: Math.min(100, Math.round((40 / cats.length) * 100)) }, { type: 'slider', height: 14, bottom: 4 }];
    if (cats.length > 40 && !horizontal) opt.grid.bottom = 28;
    if (cats.length > 30 && horizontal) opt.dataZoom = [{ type: 'inside', yAxisIndex: 0, start: 0, end: Math.min(100, Math.round((30 / cats.length) * 100)) }, { type: 'slider', yAxisIndex: 0, width: 12, right: 2 }];
    if (cscale) opt.visualMap = undefined;
    // 참조선 (평균)
    if (ctx.o.refLine && series.length) {
      series[0].markLine = { symbol: 'none', silent: true, lineStyle: { type: 'dashed', color: '#d62728' }, label: { formatter: (p) => '평균 ' + ctx.fv(valM[0], p.value), fontSize: 10 }, data: [{ type: 'average' }] };
    }
    return { option: opt };
  }

  /* ---------- 파레토 ---------- */
  function pareto(ctx) {
    const sp = ctx.sp;
    const res = runQuery(ctx);
    const catD = sp.dims.map((_, j) => j).filter((j) => j !== sp.D.color);
    const mi = sp.M.row[0] != null ? sp.M.row[0] : sp.M.col[0] != null ? sp.M.col[0] : 0;
    const m = new Map();
    res.rows.forEach((r, ri) => {
      const k = Q.comboKey(r, catD);
      if (!m.has(k)) m.set(k, { label: catD.map((j) => ctx.kl(j, r.d[j])).join(' · '), v: 0, ri });
      m.get(k).v += r.m[mi] || 0;
    });
    const arr = Array.from(m.values()).sort((a, b) => b.v - a.v);
    const tot = arr.reduce((a, x) => a + x.v, 0);
    let c = 0;
    const cum = arr.map((x) => (c += x.v) / (tot || 1));
    const opt = baseOption(ctx);
    opt.tooltip.trigger = 'axis';
    opt.tooltip.formatter = (ps) => {
      const i = ps[0].dataIndex;
      return '<div class="tip"><b>' + BI.esc(arr[i].label) + '</b><div><span class="tk">' + BI.esc(ctx.ml(mi)) + '</span><b>' + ctx.fv(mi, arr[i].v) + '</b></div><div><span class="tk">누적 비율</span><b>' + BI.formatNumber(cum[i], 'pct') + '</b></div></div>';
    };
    opt.legend = legendOpt(ctx, true);
    opt.grid = { left: 20, right: 30, top: 36, bottom: 12, containLabel: true };
    opt.xAxis = { type: 'category', data: arr.map((x) => x.label), axisLabel: { fontSize: 11, hideOverlap: true, rotate: arr.length > 10 ? 35 : 0 } };
    opt.yAxis = [
      { type: 'value', axisLabel: { formatter: BI.axisFormatter(ctx.fmt(mi)), fontSize: 11 }, splitLine: { lineStyle: { color: '#eceff3' } } },
      { type: 'value', max: 1, min: 0, axisLabel: { formatter: (v) => Math.round(v * 100) + '%', fontSize: 11 }, splitLine: { show: false } },
    ];
    opt.series = [
      { name: ctx.ml(mi), type: 'bar', data: arr.map((x) => ({ value: x.v, _r: x.ri })), barMaxWidth: 50, label: { show: ctx.o.labels, position: 'top', fontSize: 10, formatter: (p) => ctx.fv(mi, p.value) } },
      { name: '누적 비율', type: 'line', yAxisIndex: 1, data: cum, symbolSize: 5, itemStyle: { color: '#e15759' }, markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: '#999' }, data: [{ yAxis: 0.8 }], label: { formatter: '80%' } } },
    ];
    return { option: opt };
  }

  /* ---------- 폭포 ---------- */
  function waterfall(ctx) {
    const sp = ctx.sp;
    const res = runQuery(ctx);
    const mi = sp.M.row[0] != null ? sp.M.row[0] : sp.M.col[0] != null ? sp.M.col[0] : 0;
    const catD = sp.dims.map((_, j) => j);
    const cats = Q.combos(res, catD, ctx.ds);
    const vals = cats.map((c) => res.rows.filter((r) => Q.comboKey(r, catD) === c.key).reduce((a, r) => a + (r.m[mi] || 0), 0));
    let run = 0;
    const base = [], pos = [], neg = [];
    vals.forEach((v) => {
      const start = run;
      run += v;
      base.push(Math.min(start, run));
      pos.push(v >= 0 ? v : '-');
      neg.push(v < 0 ? -v : '-');
    });
    base.push(0); pos.push(run >= 0 ? run : '-'); neg.push(run < 0 ? -run : '-');
    const labels = cats.map((c) => c.label).concat(['합계']);
    const opt = baseOption(ctx);
    opt.tooltip.trigger = 'axis';
    opt.tooltip.formatter = (ps) => {
      const i = ps[0].dataIndex;
      const v = i < vals.length ? vals[i] : run;
      return '<div class="tip"><b>' + BI.esc(labels[i]) + '</b><div><span class="tk">' + (i < vals.length ? '변동' : '합계') + '</span><b>' + ctx.fv(mi, v) + '</b></div>' + (i < vals.length ? '<div><span class="tk">누계</span><b>' + ctx.fv(mi, vals.slice(0, i + 1).reduce((a, b) => a + b, 0)) + '</b></div>' : '') + '</div>';
    };
    opt.grid = { left: 20, right: 20, top: 20, bottom: 12, containLabel: true };
    opt.xAxis = { type: 'category', data: labels, axisLabel: { fontSize: 11, hideOverlap: true, rotate: labels.length > 12 ? 35 : 0 } };
    opt.yAxis = { type: 'value', axisLabel: { formatter: BI.axisFormatter(ctx.fmt(mi)), fontSize: 11 }, splitLine: { lineStyle: { color: '#eceff3' } } };
    const lbl = (p) => (p.value === '-' ? '' : ctx.fv(mi, p.value));
    opt.series = [
      { type: 'bar', stack: 'w', silent: true, itemStyle: { color: 'transparent' }, data: base },
      { name: '증가', type: 'bar', stack: 'w', barMaxWidth: 60, data: pos.map((v, i) => ({ value: v, itemStyle: { color: i === labels.length - 1 ? '#4e79a7' : '#59a14f' } })), label: { show: ctx.o.labels, position: 'top', fontSize: 10, formatter: lbl } },
      { name: '감소', type: 'bar', stack: 'w', barMaxWidth: 60, data: neg.map((v, i) => ({ value: v, itemStyle: { color: i === labels.length - 1 ? '#4e79a7' : '#e15759' } })), label: { show: ctx.o.labels, position: 'bottom', fontSize: 10, formatter: (p) => (p.value === '-' ? '' : '-' + ctx.fv(mi, p.value)) } },
    ];
    return { option: opt };
  }

  /* ---------- 파이/도넛/퍼널 ---------- */
  function pieLike(ctx, type) {
    const sp = ctx.sp;
    const res = runQuery(ctx);
    const mi = sp.M.size >= 0 ? sp.M.size : sp.M.row[0] != null ? sp.M.row[0] : sp.M.col[0] != null ? sp.M.col[0] : sp.M.label >= 0 ? sp.M.label : 0;
    const catD = sp.D.color >= 0 ? [sp.D.color].concat(sp.dims.map((_, j) => j).filter((j) => j !== sp.D.color)) : sp.dims.map((_, j) => j);
    const m = new Map();
    res.rows.forEach((r, ri) => {
      const k = Q.comboKey(r, catD);
      if (!m.has(k)) m.set(k, { name: catD.map((j) => ctx.kl(j, r.d[j])).join(' · '), value: 0, _r: ri });
      m.get(k).value += r.m[mi] || 0;
    });
    let data = Array.from(m.values());
    if (type === 'funnel') data.sort((a, b) => b.value - a.value);
    const opt = baseOption(ctx);
    const tot = data.reduce((a, d) => a + (d.value || 0), 0);
    opt.tooltip.formatter = (p) => {
      const r = res.rows[p.data._r];
      return tipHtml(ctx, r, '<div><span class="tk">비율</span><b>' + BI.formatNumber(p.value / (tot || 1), 'pct') + '</b></div>');
    };
    opt.legend = Object.assign(legendOpt(ctx, data.length > 1 && data.length <= 40), { type: 'scroll', orient: 'vertical', left: 'right', top: 'middle' });
    if (type === 'funnel') {
      opt.legend = legendOpt(ctx, data.length > 1);
      opt.series = [{
        type: 'funnel', left: '10%', width: '70%', top: 36, bottom: 10, sort: 'descending', gap: 2, data,
        label: { show: true, position: 'inside', formatter: (p) => p.name + '\n' + ctx.fv(mi, p.value), fontSize: 11 },
        emphasis: { label: { fontSize: 13 } },
      }];
      return { option: opt };
    }
    const lblShow = ctx.o.labels || data.length <= 12;
    opt.series = [{
      type: 'pie',
      radius: type === 'donut' ? ['42%', '70%'] : [0, '70%'],
      center: [opt.legend.show === false ? '50%' : '42%', '52%'],
      data,
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#fff', borderWidth: 1 },
      label: { show: lblShow, formatter: (p) => p.name + '\n' + (ctx.o.labels ? ctx.fv(mi, p.value) + ' ' : '') + '(' + BI.formatNumber(p.percent / 100, 'pct') + ')', fontSize: 11 },
      emphasis: { scale: true, scaleSize: 6 },
    }];
    if (type === 'donut') {
      opt.title = { text: ctx.fv(mi, tot), subtext: ctx.ml(mi), left: opt.legend.show === false ? 'center' : '42%', top: '45%', textAlign: 'center', textStyle: { fontSize: 18, fontWeight: 'bold', color: '#333' }, subtextStyle: { fontSize: 11 } };
      if (opt.legend.show === false) opt.title.left = 'center';
    }
    return { option: opt };
  }

  /* ---------- 트리맵 / 선버스트 ---------- */
  function hierarchy(ctx, type) {
    const sp = ctx.sp;
    const res = runQuery(ctx);
    const mi = sp.M.size >= 0 ? sp.M.size : sp.M.row[0] != null ? sp.M.row[0] : sp.M.col[0] != null ? sp.M.col[0] : sp.M.label >= 0 ? sp.M.label : 0;
    const order = sp.D.col.concat(sp.D.row, sp.D.color >= 0 ? [sp.D.color] : [], sp.D.detail, sp.D.label >= 0 ? [sp.D.label] : [], sp.D.tooltip);
    const cm = sp.M.color;
    const root = { children: [], map: new Map() };
    let cmin = Infinity, cmax = -Infinity;
    res.rows.forEach((r, ri) => {
      let node = root;
      order.forEach((j, lvl) => {
        const name = ctx.kl(j, r.d[j]);
        if (!node.map) node.map = new Map();
        let ch = node.map.get(name);
        if (!ch) { ch = { name, value: 0, children: [], map: new Map(), _r: ri }; node.map.set(name, ch); node.children.push(ch); }
        ch.value += r.m[mi] || 0;
        if (lvl === order.length - 1 && cm >= 0) { ch._c = r.m[cm]; if (typeof ch._c === 'number') { cmin = Math.min(cmin, ch._c); cmax = Math.max(cmax, ch._c); } }
        node = ch;
      });
    });
    const scale = cm >= 0 ? BI.colorScale(cmin, cmax, ctx.o.seq) : null;
    const clean = (n, depth) => {
      const o = { name: n.name, value: n.value, _r: n._r };
      if (n.children.length) o.children = n.children.map((c) => clean(c, depth + 1));
      if (scale && n._c != null) o.itemStyle = { color: scale(n._c) };
      if (!o.children && ctx.res.rows[n._r]) o._tip = tipHtml(ctx, ctx.res.rows[n._r]);
      else o._tip = '<div class="tip"><b>' + BI.esc(n.name) + '</b><div><span class="tk">' + BI.esc(ctx.ml(mi)) + '</span><b>' + ctx.fv(mi, n.value) + '</b></div></div>';
      return o;
    };
    const data = root.children.map((c) => clean(c, 1));
    const opt = baseOption(ctx);
    if (type === 'treemap') {
      const levels = [{ itemStyle: { borderColor: '#fff', borderWidth: 2, gapWidth: 2 } }];
      for (let i = 1; i < order.length; i++) levels.push({ itemStyle: { borderColor: '#fff', borderWidth: 1, gapWidth: 1 }, colorSaturation: [0.35, 0.6] });
      opt.series = [{
        type: 'treemap', data, roam: false, nodeClick: false, breadcrumb: { show: false }, top: 4, left: 4, right: 4, bottom: 4,
        leafDepth: null, levels,
        upperLabel: order.length > 1 ? { show: true, height: 18, fontSize: 11, color: '#fff' } : undefined,
        label: { show: true, formatter: (p) => p.name + (ctx.o.labels ? '\n' + ctx.fv(mi, p.value) : ''), fontSize: 11, overflow: 'truncate' },
      }];
    } else {
      opt.series = [{
        type: 'sunburst', data, radius: ['8%', '92%'], sort: null, itemStyle: { borderColor: '#fff', borderWidth: 1 },
        label: { rotate: 'radial', fontSize: 10, minAngle: 8 },
        emphasis: { focus: 'ancestor' },
      }];
    }
    return { option: opt };
  }

  /* ---------- 산점도 / 버블 ---------- */
  function scatter(ctx, type) {
    const sp = ctx.sp;
    const res = runQuery(ctx);
    let xm = sp.M.col[0], ym = sp.M.row[0];
    const all = sp.meas.map((_, i) => i);
    if (xm == null) xm = all.find((i) => i !== ym && i !== sp.M.size && i !== sp.M.color);
    if (ym == null) ym = all.find((i) => i !== xm && i !== sp.M.size && i !== sp.M.color);
    if (xm == null || ym == null) return { empty: '분산형 차트에는 측정값 2개가 필요합니다. 열과 행에 측정값을 하나씩 놓으세요.' };
    let sm = sp.M.size;
    if (type === 'bubble' && sm < 0) sm = all.find((i) => i !== xm && i !== ym);
    if (sm == null) sm = -1;
    const cd = sp.D.color, cm = sp.M.color;
    const groups = cd >= 0 ? Q.combos(res, [cd], ctx.ds) : [null];
    let smax = 0, cmin = Infinity, cmax = -Infinity;
    res.rows.forEach((r) => {
      if (sm >= 0) smax = Math.max(smax, Math.abs(r.m[sm] || 0));
      if (cm >= 0 && typeof r.m[cm] === 'number') { cmin = Math.min(cmin, r.m[cm]); cmax = Math.max(cmax, r.m[cm]); }
    });
    const scale = cm >= 0 ? BI.colorScale(cmin, cmax, ctx.o.seq) : null;
    const lblD = sp.D.label >= 0 ? sp.D.label : sp.D.detail.length ? sp.D.detail[0] : -1;
    const series = groups.map((g) => {
      const data = [];
      res.rows.forEach((r, ri) => {
        if (g && Q.comboKey(r, [cd]) !== g.key) return;
        if (r.m[xm] == null || r.m[ym] == null) return;
        const it = { value: [r.m[xm], r.m[ym]], _r: ri };
        if (sm >= 0) it.symbolSize = 6 + Math.sqrt(Math.abs(r.m[sm] || 0) / (smax || 1)) * 44;
        if (scale) it.itemStyle = { color: scale(r.m[cm]) };
        if (lblD >= 0) it._lbl = ctx.kl(lblD, r.d[lblD]);
        data.push(it);
      });
      return {
        name: g ? g.label : ctx.ml(ym), type: 'scatter', data,
        symbolSize: sm >= 0 ? undefined : data.length > 2000 ? 4 : 9,
        itemStyle: { opacity: sm >= 0 ? 0.7 : 0.8, borderColor: sm >= 0 ? '#fff' : undefined, borderWidth: sm >= 0 ? 1 : 0 },
        emphasis: { focus: 'series' },
        label: { show: ctx.o.labels || sp.D.label >= 0, position: 'right', fontSize: 10, formatter: (p) => p.data._lbl || '' },
        large: data.length > 5000,
      };
    });
    // 추세선 (선형 회귀)
    if (ctx.o.trend) {
      const pts = [];
      series.forEach((s) => s.data.forEach((d) => pts.push(d.value)));
      if (pts.length > 1) {
        const n = pts.length;
        let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
        pts.forEach(([x, y]) => { sx += x; sy += y; sxy += x * y; sxx += x * x; syy += y * y; });
        const b = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1), a = (sy - b * sx) / n;
        const r2 = Math.pow(n * sxy - sx * sy, 2) / (((n * sxx - sx * sx) * (n * syy - sy * sy)) || 1);
        const xs = pts.map((p) => p[0]);
        const x0 = Math.min(...xs), x1 = Math.max(...xs);
        series.push({ name: '추세선', type: 'line', symbol: 'none', silent: true, lineStyle: { type: 'dashed', color: '#555', width: 1.5 }, data: [[x0, a + b * x0], [x1, a + b * x1]], tooltip: { show: false },
          endLabel: { show: true, formatter: 'R² = ' + r2.toFixed(3), fontSize: 10, color: '#555' } });
      }
    }
    const opt = baseOption(ctx);
    opt.legend = legendOpt(ctx, groups.length > 1);
    opt.grid = { left: 20, right: 40, top: groups.length > 1 && ctx.o.legend ? 36 : 20, bottom: 20, containLabel: true };
    const ax = (mi, nameGap) => ({ type: 'value', scale: true, name: ctx.ml(mi), nameLocation: 'middle', nameGap, nameTextStyle: { color: '#555', fontSize: 11 }, axisLabel: { formatter: BI.axisFormatter(ctx.fmt(mi)), fontSize: 11 }, splitLine: { lineStyle: { color: '#eceff3' } } });
    opt.xAxis = ax(xm, 26);
    opt.yAxis = ax(ym, 52);
    opt.grid.bottom = 30;
    opt.grid.left = 30;
    opt.series = series;
    return { option: opt };
  }

  /* ---------- 히트맵 ---------- */
  function heatmap(ctx) {
    const sp = ctx.sp;
    const res = runQuery(ctx);
    let xD = sp.D.col, yD = sp.D.row;
    const rest = sp.dims.map((_, j) => j).filter((j) => !xD.includes(j) && !yD.includes(j));
    if (!xD.length && rest.length) xD = [rest.shift()];
    if (!yD.length && rest.length) yD = [rest.shift()];
    if (!yD.length && xD.length > 1) yD = [xD.pop()];
    const vm = sp.M.color >= 0 ? sp.M.color : sp.M.label >= 0 ? sp.M.label : 0;
    const xs = Q.combos(res, xD, ctx.ds), ys = Q.combos(res, yD, ctx.ds);
    const xi = new Map(xs.map((c, i) => [c.key, i])), yi = new Map(ys.map((c, i) => [c.key, i]));
    const cell = new Map();
    let mn = Infinity, mx = -Infinity;
    res.rows.forEach((r, ri) => {
      const x = xi.get(Q.comboKey(r, xD)), y = yi.get(Q.comboKey(r, yD));
      const k = x + ',' + y;
      const v = r.m[vm];
      if (cell.has(k)) cell.get(k).value[2] += v || 0;
      else cell.set(k, { value: [x, y, v], _r: ri });
    });
    const data = Array.from(cell.values());
    data.forEach((d) => { const v = d.value[2]; if (typeof v === 'number') { mn = Math.min(mn, v); mx = Math.max(mx, v); } });
    const opt = baseOption(ctx);
    const stops = BI.SEQ[ctx.o.seq] || BI.SEQ.blue;
    opt.grid = { left: 20, right: 20, top: 10, bottom: 50, containLabel: true };
    opt.xAxis = { type: 'category', data: xs.map((c) => c.label), splitArea: { show: true }, axisLabel: { fontSize: 11, rotate: xs.length > 10 ? 35 : 0, hideOverlap: true } };
    opt.yAxis = { type: 'category', data: ys.map((c) => c.label), inverse: true, splitArea: { show: true }, axisLabel: { fontSize: 11 } };
    opt.visualMap = { min: isFinite(mn) ? mn : 0, max: isFinite(mx) ? mx : 1, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 140, itemWidth: 12, inRange: { color: stops }, textStyle: { fontSize: 10 }, formatter: (v) => BI.axisFormatter(ctx.fmt(vm))(v) };
    opt.series = [{ type: 'heatmap', data, label: { show: ctx.o.labels || xs.length * ys.length <= 120, fontSize: 10, formatter: (p) => BI.compact(p.value[2]) }, itemStyle: { borderColor: '#fff', borderWidth: 1 }, emphasis: { itemStyle: { borderColor: '#333', borderWidth: 1 } } }];
    return { option: opt };
  }

  /* ---------- 히스토그램 ---------- */
  function histogram(ctx) {
    const sp = ctx.sp;
    const mp = sp.rowMeas[0] || sp.colMeas[0] || sp.meas[0];
    if (!mp) return { empty: '히스토그램에는 측정값 1개가 필요합니다.' };
    const id = mp.f;
    const vals = [];
    for (const r of ctx.rows) { const v = id === '__count' ? 1 : r[id]; if (typeof v === 'number') vals.push(v); }
    if (!vals.length) return { empty: '숫자 값이 없습니다.' };
    let mn = Infinity, mx = -Infinity;
    vals.forEach((v) => { if (v < mn) mn = v; if (v > mx) mx = v; });
    let nb = +ctx.o.bins || Math.min(50, Math.max(5, Math.ceil(Math.log2(vals.length) + 1)));
    const w = (mx - mn) / nb || 1;
    const cnt = new Array(nb).fill(0);
    vals.forEach((v) => { cnt[Math.min(nb - 1, Math.floor((v - mn) / w))]++; });
    const f = BI.Data.fieldById(ctx.ds, id);
    const labels = cnt.map((_, i) => BI.compact(mn + i * w) + ' ~ ' + BI.compact(mn + (i + 1) * w));
    const opt = baseOption(ctx);
    opt.tooltip.formatter = (p) => '<div class="tip"><b>' + BI.esc((f ? f.name : '') + ' ' + labels[p.dataIndex]) + '</b><div><span class="tk">빈도</span><b>' + BI.formatNumber(p.value) + '</b></div><div><span class="tk">비율</span><b>' + BI.formatNumber(p.value / vals.length, 'pct') + '</b></div></div>';
    opt.grid = { left: 20, right: 20, top: 20, bottom: 30, containLabel: true };
    opt.xAxis = { type: 'category', data: labels, name: f ? f.name : '', nameLocation: 'middle', nameGap: 40, axisLabel: { fontSize: 10, rotate: 30, hideOverlap: true } };
    opt.yAxis = { type: 'value', name: '빈도', axisLabel: { fontSize: 11 }, splitLine: { lineStyle: { color: '#eceff3' } } };
    opt.series = [{ type: 'bar', data: cnt, barCategoryGap: '2%', itemStyle: { color: ctx.palette[0] }, label: { show: ctx.o.labels, position: 'top', fontSize: 10 } }];
    return { option: opt };
  }

  /* ---------- 상자 수염 그림 ---------- */
  function boxplot(ctx) {
    const sp = ctx.sp;
    const mp = sp.rowMeas[0] || sp.colMeas[0] || sp.meas[0];
    if (!mp) return { empty: '상자 수염 그림에는 측정값 1개가 필요합니다.' };
    const catDims = sp.colDims.concat(sp.rowDims, sp.color && !sp.color.agg ? [sp.color] : []);
    const detail = sp.detail.filter((p) => !p.agg);
    const kfs = catDims.map((p) => Q.keyFn(p, ctx.ds));
    const groups = new Map();
    if (detail.length) {
      // 세부정보 수준에서 집계 후 분포
      const res = Q.aggregate(ctx.ds, ctx.rows, catDims.concat(detail), [mp]);
      res.rows.forEach((r) => {
        const keys = r.d.slice(0, catDims.length);
        const k = keys.map((x) => typeof x + ':' + x).join('|');
        if (!groups.has(k)) groups.set(k, { keys, v: [] });
        if (typeof r.m[0] === 'number') groups.get(k).v.push(r.m[0]);
      });
    } else {
      const vf = Q.valFn(mp);
      ctx.rows.forEach((r) => {
        const keys = kfs.map((f) => f(r));
        const k = keys.map((x) => typeof x + ':' + x).join('|');
        if (!groups.has(k)) groups.set(k, { keys, v: [] });
        const v = vf(r);
        if (typeof v === 'number') groups.get(k).v.push(v);
      });
    }
    const arr = Array.from(groups.values()).sort((a, b) => { for (let i = 0; i < a.keys.length; i++) { const c = BI.cmp(a.keys[i], b.keys[i]); if (c) return c; } return 0; });
    const labels = arr.map((g) => g.keys.map((k, i) => Q.keyLabel(catDims[i], ctx.ds, k)).join(' · ') || (BI.Data.fieldById(ctx.ds, mp.f) || {}).name);
    const boxes = [], outl = [];
    arr.forEach((g, gi) => {
      const s = g.v.sort((a, b) => a - b);
      if (!s.length) { boxes.push([]); return; }
      const q1 = BI.quantile(s, 0.25), q2 = BI.quantile(s, 0.5), q3 = BI.quantile(s, 0.75), iqr = q3 - q1;
      const lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
      const inner = s.filter((v) => v >= lo && v <= hi);
      boxes.push([inner[0], q1, q2, q3, inner[inner.length - 1]]);
      s.forEach((v) => { if (v < lo || v > hi) outl.push([gi, v]); });
    });
    const fmt = Q.measureFormat(Object.assign({}, mp, { agg: 'SUM' }), ctx.ds, ctx.o.numFmt);
    const opt = baseOption(ctx);
    opt.tooltip.formatter = (p) => {
      if (p.seriesType === 'boxplot') {
        const d = p.data.slice(-5);
        return '<div class="tip"><b>' + BI.esc(p.name) + '</b>' + ['최소(수염)', '1사분위', '중앙값', '3사분위', '최대(수염)'].map((n, i) => '<div><span class="tk">' + n + '</span><b>' + BI.formatNumber(d[i], fmt) + '</b></div>').join('') + '<div><span class="tk">개수</span><b>' + arr[p.dataIndex].v.length + '</b></div></div>';
      }
      return '<div class="tip">이상치: <b>' + BI.formatNumber(p.data[1], fmt) + '</b></div>';
    };
    opt.grid = { left: 20, right: 20, top: 20, bottom: 20, containLabel: true };
    opt.xAxis = { type: 'category', data: labels, axisLabel: { fontSize: 11, rotate: labels.length > 10 ? 30 : 0, hideOverlap: true } };
    opt.yAxis = { type: 'value', scale: true, name: (BI.Data.fieldById(ctx.ds, mp.f) || {}).name, axisLabel: { formatter: BI.axisFormatter(fmt), fontSize: 11 }, splitLine: { lineStyle: { color: '#eceff3' } } };
    opt.series = [
      { type: 'boxplot', data: boxes, itemStyle: { color: '#dbe7f3', borderColor: ctx.palette[0] } },
      { type: 'scatter', data: outl, symbolSize: 5, itemStyle: { color: ctx.palette[2], opacity: 0.6 } },
    ];
    return { option: opt };
  }

  /* ---------- 레이더 ---------- */
  function radar(ctx) {
    const sp = ctx.sp;
    const res = runQuery(ctx);
    const axD = sp.D.col.concat(sp.D.row);
    if (!axD.length) { const o = sp.dims.map((_, j) => j).filter((j) => j !== sp.D.color); if (o.length) axD.push(o[0]); }
    if (!axD.length) return { empty: '레이더 차트에는 축 항목으로 사용할 차원이 필요합니다.' };
    const ind = Q.combos(res, axD, ctx.ds).slice(0, 30);
    const ii = new Map(ind.map((c, i) => [c.key, i]));
    const valM = sp.M.row.concat(sp.M.col);
    if (!valM.length) valM.push(0);
    const groups = sp.D.color >= 0 ? Q.combos(res, [sp.D.color], ctx.ds) : [null];
    const series = [];
    valM.forEach((mi) => groups.forEach((g) => {
      const v = ind.map(() => 0);
      res.rows.forEach((r) => { if (g && Q.comboKey(r, [sp.D.color]) !== g.key) return; const i = ii.get(Q.comboKey(r, axD)); if (i != null) v[i] += r.m[mi] || 0; });
      series.push({ name: g ? g.label + (valM.length > 1 ? ' · ' + ctx.ml(mi) : '') : ctx.ml(mi), value: v, _mi: mi });
    }));
    const max = Math.max(...series.flatMap((s) => s.value), 0);
    const opt = baseOption(ctx);
    opt.legend = legendOpt(ctx, series.length > 1);
    opt.tooltip.formatter = (p) => '<div class="tip"><b>' + BI.esc(p.name) + '</b>' + ind.map((c, i) => '<div><span class="tk">' + BI.esc(c.label) + '</span><b>' + ctx.fv(p.data._mi, p.value[i]) + '</b></div>').join('') + '</div>';
    opt.radar = { indicator: ind.map((c) => ({ name: c.label, max: BI.niceCeil(max) })), radius: '65%', center: ['50%', '55%'], axisName: { color: '#444', fontSize: 11 }, splitArea: { areaStyle: { color: ['#fafbfc', '#f2f4f7'] } } };
    opt.series = [{ type: 'radar', data: series, areaStyle: { opacity: 0.15 }, symbolSize: 4 }];
    return { option: opt };
  }

  /* ---------- 게이지 ---------- */
  function gauge(ctx) {
    const sp = ctx.sp;
    const meas = sp.meas.length ? sp.meas : [{ f: '__count', agg: 'SUM' }];
    const res = Q.aggregate(ctx.ds, ctx.rows, [], meas);
    ctx.res = res;
    const r = res.rows[0] || { m: [] };
    const v = r.m[0] || 0;
    const target = meas.length > 1 ? r.m[1] : null;
    const max = +ctx.o.gaugeMax || (target ? BI.niceCeil(Math.max(target, v) * 1.1) : BI.niceCeil(v * 1.25));
    const opt = baseOption(ctx);
    opt.series = [{
      type: 'gauge', min: 0, max, radius: '88%', center: ['50%', '58%'], startAngle: 200, endAngle: -20,
      progress: { show: true, width: 18, itemStyle: { color: ctx.palette[0] } },
      axisLine: { lineStyle: { width: 18, color: [[1, '#e6ebf1']] } },
      axisTick: { show: false }, splitLine: { length: 8, lineStyle: { width: 1, color: '#999' } },
      axisLabel: { distance: 22, fontSize: 10, formatter: (x) => BI.compact(x) },
      pointer: { show: true, width: 4, length: '60%' }, anchor: { show: true, size: 10, itemStyle: { color: '#555' } },
      title: { offsetCenter: [0, '72%'], fontSize: 12, color: '#666' },
      detail: { valueAnimation: true, offsetCenter: [0, '40%'], fontSize: 24, fontWeight: 'bold', color: '#222', formatter: (x) => ctx.fv(0, x) + (target ? '\n{t|목표 대비 ' + BI.formatNumber(x / target, 'pct') + '}' : ''), rich: { t: { fontSize: 12, color: '#666', padding: [6, 0, 0, 0] } } },
      data: [{ value: v, name: Q.pillLabel(meas[0], ctx.ds) }],
      markPoint: undefined,
    }];
    if (target) {
      opt.series.push({
        type: 'gauge', min: 0, max, radius: '88%', center: ['50%', '58%'], startAngle: 200, endAngle: -20,
        axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, progress: { show: false }, detail: { show: false }, title: { show: false },
        pointer: { icon: 'rect', width: 3, length: '18%', offsetCenter: [0, '-78%'], itemStyle: { color: '#e15759' } },
        data: [{ value: target, name: '목표' }],
      });
    }
    opt.tooltip.formatter = () => '<div class="tip"><div><span class="tk">' + BI.esc(Q.pillLabel(meas[0], ctx.ds)) + '</span><b>' + ctx.fv(0, v) + '</b></div>' + (target ? '<div><span class="tk">' + BI.esc(Q.pillLabel(meas[1], ctx.ds)) + '</span><b>' + ctx.fv(1, target) + '</b></div><div><span class="tk">달성률</span><b>' + BI.formatNumber(v / target, 'pct') + '</b></div>' : '') + '</div>';
    return { option: opt };
  }

  /* ---------- 불릿 ---------- */
  function bullet(ctx) {
    const sp = ctx.sp;
    const res = runQuery(ctx);
    const valM = sp.M.col.length ? sp.M.col : sp.M.row;
    const all = sp.meas.map((_, i) => i);
    const am = valM[0] != null ? valM[0] : 0;
    const tm = valM[1] != null ? valM[1] : all.find((i) => i !== am);
    if (tm == null) return { empty: '불릿 차트에는 측정값 2개(실적, 목표)가 필요합니다.' };
    const catD = sp.dims.map((_, j) => j);
    const cats = Q.combos(res, catD, ctx.ds);
    const ci = new Map(cats.map((c, i) => [c.key, i]));
    const A = cats.map(() => 0), T = cats.map(() => 0), RI = cats.map(() => null);
    res.rows.forEach((r, ri) => { const i = ci.get(Q.comboKey(r, catD)); A[i] += r.m[am] || 0; T[i] += r.m[tm] || 0; RI[i] = ri; });
    const opt = baseOption(ctx);
    opt.legend = legendOpt(ctx, true);
    opt.grid = { left: 20, right: 40, top: 36, bottom: 10, containLabel: true };
    opt.yAxis = { type: 'category', data: cats.map((c) => c.label), inverse: true, axisLabel: { fontSize: 11 } };
    opt.xAxis = { type: 'value', axisLabel: { formatter: BI.axisFormatter(ctx.fmt(am)), fontSize: 11 }, splitLine: { lineStyle: { color: '#eceff3' } } };
    opt.series = [
      { name: '목표 구간', type: 'bar', data: T.map((t) => t * 1.2), barWidth: '70%', itemStyle: { color: '#e9edf2' }, silent: true, barGap: '-100%', z: 1 },
      { name: ctx.ml(am), type: 'bar', data: A.map((v, i) => ({ value: v, _r: RI[i], itemStyle: { color: v >= T[i] ? '#59a14f' : ctx.palette[0] } })), barWidth: '32%', z: 3,
        label: { show: true, position: 'right', fontSize: 10, formatter: (p) => BI.formatNumber(T[p.dataIndex] ? p.value / T[p.dataIndex] : 0, 'pct') } },
      { name: ctx.ml(tm), type: 'scatter', data: T.map((t, i) => ({ value: t, _r: RI[i] })), symbol: 'rect', symbolSize: [4, 26], itemStyle: { color: '#c0392b' }, z: 4 },
    ];
    return { option: opt };
  }

  /* ---------- 생키 ---------- */
  function sankey(ctx) {
    const sp = ctx.sp;
    const res = runQuery(ctx);
    const order = sp.D.col.concat(sp.D.row, sp.D.color >= 0 ? [sp.D.color] : [], sp.D.detail);
    if (order.length < 2) return { empty: '생키 차트에는 차원이 2개 이상 필요합니다 (예: 열에 출발, 행에 도착 차원).' };
    const mi = sp.M.size >= 0 ? sp.M.size : sp.M.row[0] != null ? sp.M.row[0] : sp.M.col[0] != null ? sp.M.col[0] : 0;
    const nodes = new Map(), links = new Map();
    res.rows.forEach((r) => {
      const v = r.m[mi] || 0;
      if (v <= 0) return;
      for (let l = 0; l < order.length; l++) {
        const nm = ctx.kl(order[l], r.d[order[l]]) + '​'.repeat(l);
        nodes.set(nm, l);
        if (l > 0) {
          const src = ctx.kl(order[l - 1], r.d[order[l - 1]]) + '​'.repeat(l - 1);
          const k = src + '\u0001' + nm;
          links.set(k, (links.get(k) || 0) + v);
        }
      }
    });
    const opt = baseOption(ctx);
    opt.tooltip.formatter = (p) => p.dataType === 'edge' ? '<div class="tip">' + BI.esc(p.data.source) + ' → ' + BI.esc(p.data.target) + '<br><b>' + ctx.fv(mi, p.data.value) + '</b></div>' : '<div class="tip"><b>' + BI.esc(p.name) + '</b><br>' + ctx.fv(mi, p.value) + '</div>';
    opt.series = [{
      type: 'sankey', left: 10, right: 90, top: 10, bottom: 10, nodeGap: 8, emphasis: { focus: 'adjacency' },
      data: Array.from(nodes.keys()).map((n) => ({ name: n })),
      links: Array.from(links.entries()).map(([k, v]) => { const [s, t] = k.split('\u0001'); return { source: s, target: t, value: v }; }),
      lineStyle: { color: 'gradient', opacity: 0.35, curveness: 0.5 },
      label: { fontSize: 11 },
    }];
    return { option: opt };
  }

  /* ---------- 달력 히트맵 ---------- */
  function calendar(ctx) {
    const sp = ctx.sp;
    const dp = sp.dims.find((p) => BI.Data.fieldById(ctx.ds, p.f) && BI.Data.fieldById(ctx.ds, p.f).type === 'date');
    if (!dp) return { empty: '달력 히트맵에는 날짜 차원이 필요합니다.' };
    const mp = sp.meas[0] || { f: '__count', agg: 'SUM' };
    const res = Q.aggregate(ctx.ds, ctx.rows, [{ f: dp.f, dp: 'day' }], [mp]);
    ctx.res = { dims: [{ f: dp.f, dp: 'day' }], meas: [mp], rows: res.rows };
    const data = res.rows.filter((r) => r.d[0] != null).map((r) => [BI.fmtDate(r.d[0]), r.m[0]]);
    if (!data.length) return { empty: '날짜 값이 없습니다.' };
    const years = Array.from(new Set(data.map((d) => +d[0].slice(0, 4)))).sort().slice(-4);
    let mn = Infinity, mx = -Infinity;
    data.forEach((d) => { if (typeof d[1] === 'number') { mn = Math.min(mn, d[1]); mx = Math.max(mx, d[1]); } });
    const opt = baseOption(ctx);
    const fmt = Q.measureFormat(mp, ctx.ds, ctx.o.numFmt);
    opt.tooltip.formatter = (p) => '<div class="tip"><b>' + p.value[0] + '</b><div><span class="tk">' + BI.esc(Q.pillLabel(mp, ctx.ds)) + '</span><b>' + Q.fmtMeasure(p.value[1], fmt) + '</b></div></div>';
    opt.visualMap = { min: mn, max: mx, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 140, itemWidth: 12, inRange: { color: BI.SEQ[ctx.o.seq] || BI.SEQ.green }, textStyle: { fontSize: 10 }, formatter: (v) => BI.compact(v) };
    opt.calendar = years.map((y, i) => ({ range: String(y), top: 30 + i * 150, left: 50, right: 20, cellSize: ['auto', 15], yearLabel: { fontSize: 13 }, dayLabel: { nameMap: ['일', '월', '화', '수', '목', '금', '토'], fontSize: 10 }, monthLabel: { nameMap: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'], fontSize: 10 }, itemStyle: { borderColor: '#fff', borderWidth: 2 }, splitLine: { lineStyle: { color: '#999', width: 1 } } }));
    opt.series = years.map((y, i) => ({ type: 'heatmap', coordinateSystem: 'calendar', calendarIndex: i, data: data.filter((d) => d[0].startsWith(String(y))) }));
    return { option: opt, minHeight: 60 + years.length * 150 };
  }

  /* ---------- 테이블 (HTML) ---------- */
  function table(ctx, highlight) {
    const sp = ctx.sp;
    const res = runQuery(ctx);
    const rowD = sp.D.row.concat(sp.D.color >= 0 ? [sp.D.color] : [], sp.D.detail, sp.D.label >= 0 ? [sp.D.label] : [], sp.D.tooltip);
    const colD = sp.D.col.slice();
    // 측정값 순서: 열 → 행 → 레이블/색상/크기 → 툴팁
    const mOrder = [];
    const addM = (i) => { if (i >= 0 && !mOrder.includes(i)) mOrder.push(i); };
    sp.M.col.forEach(addM); sp.M.row.forEach(addM); addM(sp.M.label); addM(sp.M.color); addM(sp.M.size); sp.M.tooltip.forEach(addM);
    if (!mOrder.length) mOrder.push(0);
    Q.applyTableCalcs(res, rowD);
    const rCombos = Q.combos(res, rowD, ctx.ds);
    const cCombos = Q.combos(res, colD, ctx.ds);
    const cell = new Map();
    res.rows.forEach((r, ri) => cell.set(Q.comboKey(r, rowD) + '\u0002' + Q.comboKey(r, colD), ri));
    const hm = highlight ? (sp.M.color >= 0 ? sp.M.color : mOrder[0]) : -1;
    let scale = null;
    if (hm >= 0) {
      let mn = Infinity, mx = -Infinity;
      res.rows.forEach((r) => { const v = r.m[hm]; if (typeof v === 'number') { mn = Math.min(mn, v); mx = Math.max(mx, v); } });
      scale = BI.colorScale(mn, mx, ctx.o.seq);
    }
    // 합계
    let rowTot = null, colTot = null, grand = null;
    if (ctx.o.totals) {
      const meas = res.meas;
      const agg = (dims) => { const x = Q.aggregate(ctx.ds, ctx.rows, dims, meas.map((p) => Object.assign({}, p, { tc: null }))); const m = new Map(); x.rows.forEach((r) => m.set(r.d.map((k) => typeof k + ':' + k).join('\u0001'), r)); return m; };
      if (colD.length) rowTot = agg(rowD.map((j) => sp.dims[j]));
      if (rowD.length) colTot = agg(colD.map((j) => sp.dims[j]));
      grand = Q.aggregate(ctx.ds, ctx.rows, [], meas.map((p) => Object.assign({}, p, { tc: null }))).rows[0];
    }
    const LIMIT = 5000;
    const nm = mOrder.length;
    const multiM = nm > 1;
    let h = '<table class="vt' + (highlight ? ' hl' : '') + '"><thead>';
    const hdrRows = Math.max(1, colD.length + (multiM ? 1 : 0));
    // 열 머리글
    for (let lvl = 0; lvl < colD.length; lvl++) {
      h += '<tr>';
      if (lvl === 0) rowD.forEach((j) => (h += '<th class="rh corner" rowspan="' + hdrRows + '">' + BI.esc(ctx.dl(j)) + '</th>'));
      if (lvl === 0 && !rowD.length) h += '<th class="corner" rowspan="' + hdrRows + '"></th>';
      let i = 0;
      while (i < cCombos.length) {
        let span = 1;
        const pre = (c) => c.keys.slice(0, lvl + 1).map(String).join('\u0001');
        while (i + span < cCombos.length && pre(cCombos[i + span]) === pre(cCombos[i])) span++;
        h += '<th colspan="' + span * nm + '">' + BI.esc(ctx.kl(colD[lvl], cCombos[i].keys[lvl])) + '</th>';
        i += span;
      }
      if (rowTot && lvl === 0) h += '<th class="tot" rowspan="' + colD.length + '" colspan="' + nm + '">총계</th>';
      h += '</tr>';
    }
    if (multiM || !colD.length) {
      h += '<tr>';
      if (!colD.length) { rowD.forEach((j) => (h += '<th class="rh corner">' + BI.esc(ctx.dl(j)) + '</th>')); if (!rowD.length) h += ''; }
      cCombos.forEach(() => mOrder.forEach((mi) => (h += '<th class="mh">' + BI.esc(ctx.ml(mi)) + '</th>')));
      if (rowTot) mOrder.forEach((mi) => (h += '<th class="mh tot">' + BI.esc(ctx.ml(mi)) + '</th>'));
      h += '</tr>';
    }
    h += '</thead><tbody>';
    const rlist = rCombos.slice(0, LIMIT);
    const spans = rowD.map(() => 0);
    rlist.forEach((rc, ri) => {
      h += '<tr>';
      rowD.forEach((j, lvl) => {
        if (spans[lvl] > 0) { spans[lvl]--; return; }
        const pre = (c) => c.keys.slice(0, lvl + 1).map((k) => typeof k + ':' + k).join('\u0001');
        let span = 1;
        if (lvl < rowD.length - 1) while (ri + span < rlist.length && pre(rlist[ri + span]) === pre(rc)) span++;
        spans[lvl] = span - 1;
        h += '<th class="rh"' + (span > 1 ? ' rowspan="' + span + '"' : '') + '>' + BI.esc(ctx.kl(j, rc.keys[lvl])) + '</th>';
      });
      cCombos.forEach((cc) => {
        const idx = cell.get(rc.key + '\u0002' + cc.key);
        const r = idx != null ? res.rows[idx] : null;
        mOrder.forEach((mi) => {
          const v = r ? r.m[mi] : null;
          let st = '';
          if (scale && mi === hm && typeof v === 'number') { const bg = scale(v); st = ' style="background:' + bg + ';color:' + BI.textColorFor(bg) + '"'; }
          h += '<td' + st + (r ? ' data-r="' + idx + '"' : '') + '>' + BI.esc(r ? ctx.fv(mi, v) : '') + '</td>';
        });
      });
      if (rowTot) {
        const t = rowTot.get(rc.keys.map((k) => typeof k + ':' + k).join('\u0001'));
        mOrder.forEach((mi) => (h += '<td class="tot">' + BI.esc(t ? ctx.fv(mi, t.m[mi]) : '') + '</td>'));
      }
      h += '</tr>';
    });
    if (colTot) {
      h += '<tr class="totrow"><th class="rh tot" colspan="' + Math.max(1, rowD.length) + '">총계</th>';
      cCombos.forEach((cc) => {
        const t = colTot.get(cc.keys.map((k) => typeof k + ':' + k).join('\u0001'));
        mOrder.forEach((mi) => (h += '<td class="tot">' + BI.esc(t ? ctx.fv(mi, t.m[mi]) : '') + '</td>'));
      });
      if (rowTot) mOrder.forEach((mi) => (h += '<td class="tot grand">' + BI.esc(grand ? ctx.fv(mi, grand.m[mi]) : '') + '</td>'));
      h += '</tr>';
    }
    h += '</tbody></table>';
    if (rCombos.length > LIMIT) h += '<div class="vt-note">처음 ' + LIMIT.toLocaleString() + '행만 표시합니다 (전체 ' + rCombos.length.toLocaleString() + '행). 필터를 사용해 범위를 줄이세요.</div>';
    return { html: '<div class="vt-wrap">' + h + '</div>' };
  }

  /* ---------- KPI 카드 ---------- */
  function kpi(ctx) {
    const sp = ctx.sp;
    const meas = sp.meas.length ? sp.meas : [{ f: '__count', agg: 'SUM' }];
    const tot = Q.aggregate(ctx.ds, ctx.rows, [], meas.map((p) => Object.assign({}, p, { tc: null }))).rows[0] || { m: [] };
    ctx.res = { dims: [], meas, rows: [tot] };
    const dd = sp.dims.find((p) => Q.isTimeline(p, ctx.ds));
    let trend = null;
    if (dd) {
      const r = Q.aggregate(ctx.ds, ctx.rows, [dd], meas.map((p) => Object.assign({}, p, { tc: null })));
      r.rows.sort((a, b) => BI.cmp(a.d[0], b.d[0]));
      trend = r.rows;
    }
    let h = '<div class="kpi-wrap">';
    meas.forEach((p, i) => {
      const fmt = Q.measureFormat(p, ctx.ds, ctx.o.numFmt);
      let delta = '', spark = '';
      let val = tot.m[i];
      if (trend && trend.length) {
        const vals = trend.map((r) => r.m[i]).filter((v) => typeof v === 'number');
        const last = trend[trend.length - 1], prev = trend[trend.length - 2];
        if (ctx.o.kpiLatest !== false) val = last.m[i];
        if (prev && typeof prev.m[i] === 'number' && prev.m[i] !== 0 && typeof last.m[i] === 'number') {
          const ch = (last.m[i] - prev.m[i]) / Math.abs(prev.m[i]);
          delta = '<div class="kpi-delta ' + (ch >= 0 ? 'up' : 'down') + '">' + (ch >= 0 ? '▲ ' : '▼ ') + BI.formatNumber(Math.abs(ch), 'pct') + ' <span>직전 ' + BI.esc(Q.keyLabel(dd, ctx.ds, prev.d[0])) + ' 대비</span></div>';
        }
        if (vals.length > 1) {
          const mn = Math.min(...vals), mx = Math.max(...vals), W = 200, H = 40;
          const pts = vals.map((v, k) => (k / (vals.length - 1)) * W + ',' + (H - 3 - ((v - mn) / (mx - mn || 1)) * (H - 6))).join(' ');
          spark = '<svg class="kpi-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><polyline points="' + pts + '" fill="none" stroke="' + ctx.palette[i % ctx.palette.length] + '" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>';
        }
      }
      h += '<div class="kpi-card"><div class="kpi-title">' + BI.esc(Q.pillLabel(p, ctx.ds)) + (trend && ctx.o.kpiLatest !== false ? ' <small>(' + BI.esc(Q.keyLabel(dd, ctx.ds, trend[trend.length - 1].d[0])) + ')</small>' : '') + '</div><div class="kpi-value" style="color:' + ctx.palette[i % ctx.palette.length] + '">' + BI.esc(Q.fmtMeasure(val, fmt)) + '</div>' + delta + spark + '</div>';
    });
    return { html: h + '</div>' };
  }

  /* ---------- 빌드 진입점 ---------- */
  CH.build = function (sheet, ds, rows, opts) {
    const ctx = makeCtx(sheet, ds, rows, opts);
    const sp = ctx.sp;
    if (!sp.nDims && !sp.nMeas) return { empty: true, ctx };
    let type = sheet.chartType || 'auto';
    if (type === 'auto') type = CH.autoType(sp, ds) || 'table';
    ctx.type = type;
    let out;
    try {
      switch (type) {
        case 'table': out = table(ctx, false); break;
        case 'hltable': out = table(ctx, true); break;
        case 'heatmap': out = sp.nDims >= 1 ? heatmap(ctx) : table(ctx, true); break;
        case 'bar': case 'hbar': case 'groupbar': case 'stackbar': case 'stackhbar': case 'pct100': case 'line': case 'area': case 'stackarea': case 'combo': case 'dualline':
          out = cartesian(ctx, type); break;
        case 'pareto': out = pareto(ctx); break;
        case 'waterfall': out = waterfall(ctx); break;
        case 'pie': case 'donut': case 'funnel': out = pieLike(ctx, type); break;
        case 'treemap': case 'sunburst': out = sp.nDims ? hierarchy(ctx, type) : { empty: '차원이 1개 이상 필요합니다.' }; break;
        case 'scatter': case 'bubble': out = scatter(ctx, type); break;
        case 'histogram': out = histogram(ctx); break;
        case 'boxplot': out = boxplot(ctx); break;
        case 'radar': out = radar(ctx); break;
        case 'gauge': out = gauge(ctx); break;
        case 'bullet': out = bullet(ctx); break;
        case 'sankey': out = sankey(ctx); break;
        case 'calendar': out = calendar(ctx); break;
        case 'kpi': out = kpi(ctx); break;
        default: out = cartesian(ctx, 'bar');
      }
    } catch (e) {
      console.error(e);
      out = { empty: '차트를 그리는 중 오류가 발생했습니다: ' + e.message };
    }
    out.ctx = ctx;
    out.type = type;
    return out;
  };

  /* 클릭된 항목 → 선택 조건 */
  CH.selectionFor = function (out, params) {
    const ctx = out.ctx;
    if (!ctx || !ctx.res || !params || !params.data) return null;
    const ri = params.data._r;
    if (ri == null) return null;
    return sel(ctx, ctx.res.rows[ri]);
  };
  CH.selectionForRow = function (out, ri) {
    const ctx = out.ctx;
    if (!ctx || !ctx.res) return null;
    return sel(ctx, ctx.res.rows[ri]);
  };
  CH.tipHtml = tipHtml;
})();
