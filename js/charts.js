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

  CH.FONT = '"Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic","맑은 고딕","Segoe UI",sans-serif';
  // 앱 디자인 토큰과 맞춘 ECharts 테마 (축/격자는 뒤로 물러나고 데이터가 앞에 서도록)
  CH.THEME = 'obi';
  (function () {
    const axisCommon = {
      axisLine: { lineStyle: { color: '#d5dae1' } },
      axisTick: { lineStyle: { color: '#d5dae1' } },
      axisLabel: { color: '#6b7684' },
      splitLine: { lineStyle: { color: '#eef1f4' } },
      splitArea: { areaStyle: { color: ['rgba(245,247,249,.6)', 'rgba(255,255,255,0)'] } },
      nameTextStyle: { color: '#6b7684' },
    };
    echarts.registerTheme(CH.THEME, {
      textStyle: { fontFamily: CH.FONT, color: '#4e5968' },
      title: { textStyle: { color: '#191f28' }, subtextStyle: { color: '#6b7684' } },
      legend: { textStyle: { color: '#4e5968' }, itemGap: 14, pageIconColor: '#3563e9', pageIconInactiveColor: '#c3cad2', pageTextStyle: { color: '#6b7684' } },
      categoryAxis: axisCommon,
      valueAxis: axisCommon,
      timeAxis: axisCommon,
      logAxis: axisCommon,
      line: { symbol: 'circle', symbolSize: 5, lineStyle: { width: 2.25 } },
      bar: { itemStyle: { borderRadius: 2 } },
      pie: { itemStyle: { borderColor: '#fff', borderWidth: 2 } },
      scatter: { itemStyle: { borderColor: '#fff', borderWidth: 1 } },
      markLine: { lineStyle: { color: '#9aa3ad' } },
    });
  })();

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
    Q.sortResult(res, ctx.ds, ctx.rows);
    // 테이블 계산은 차트 종류와 관계없이 선반 기준 같은 방향으로 계산
    Q.applyTableCalcs(res, { col: sp.D.col, row: sp.D.row }, ctx.ds);
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
        backgroundColor: '#ffffff',
        borderColor: '#e2e6eb',
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: '#191f28', fontSize: 12, fontFamily: CH.FONT },
        extraCssText: 'box-shadow:0 12px 32px rgba(25,31,40,.14),0 2px 8px rgba(25,31,40,.08);border-radius:10px;',
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
    return { type: 'scroll', top: 0, left: 'center', textStyle: { fontSize: 11.5 }, icon: 'circle', itemWidth: 8, itemHeight: 8, itemGap: 16 };
  }

  function sel(ctx, r) {
    if (!r) return null;
    return ctx.sp.dims.map((p, j) => ({ f: p.f, dp: p.dp || null, key: r.d[j], label: Q.pillLabel(p, ctx.ds) + ' = ' + ctx.kl(j, r.d[j]) }));
  }

  /* 범주축 레이블: 가로 막대는 막대 하나에 글자 한 줄이 들어가면 모두 표시(하나 건너 하나 생략 없음),
     세로는 폭이 모자랄 때만 회전하고, 긴 이름은 말줄임 */
  function catLabelPolicy(ctx, labels, horizontal, visible) {
    const box = ctx.opts.box || { w: 800, h: 500 };
    const fs = 11;
    const n = Math.max(1, visible || labels.length);
    const maxCh = horizontal ? 16 : 14;
    const cut = (v) => { v = String(v); return v.length > maxCh + 2 ? v.slice(0, maxCh) + '…' : v; };
    const lw = Math.min(140, labels.slice(0, 300).reduce((a, l) => Math.max(a, textW(cut(l), fs)), 0));
    const o = { fontSize: fs, hideOverlap: true, formatter: cut };
    if (horizontal) {
      o.interval = (box.h - 70) / n >= fs + 1 ? 0 : 'auto';
    } else {
      const slot = (box.w - 90) / n;
      o.rotate = lw + 8 > slot ? (slot < fs * 1.6 ? 90 : 40) : 0;
      o.interval = o.rotate ? (slot >= fs + 2 ? 0 : 'auto') : 0;
      if (o.rotate) o.width = 110, o.overflow = 'truncate';
    }
    return o;
  }

  const stype0 = (t) => (['line', 'area', 'stackarea', 'dualline'].includes(t) ? 'line' : 'bar');

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

    let cats = Q.combos(res, catD, ctx.ds);
    // 날짜 축: Null 날짜는 축 범주로 그리지 않고, 연속 날짜는 빈 기간을 채워 간격이 왜곡되지 않게
    const dateJ = catD.filter((j) => Q.isTimeline(sp.dims[j], ctx.ds));
    if (dateJ.length) {
      const pos = dateJ.map((j) => catD.indexOf(j));
      const nullCats = cats.filter((c) => pos.some((k) => c.keys[k] == null));
      if (nullCats.length) {
        const fid = sp.dims[dateJ[0]].f;
        ctx.nullExcluded = ctx.rows.reduce((a, r) => a + (r[fid] == null ? 1 : 0), 0);
        cats = cats.filter((c) => !nullCats.includes(c));
      }
      const dp = catD.length === 1 && sp.dims[catD[0]].dp;
      if (dp && ['year', 'quarter', 'month', 'week', 'day'].includes(dp) && cats.length > 1 && !sp.dims[catD[0]].sort) {
        const have = new Map(cats.map((c) => [c.keys[0], c]));
        const ks = cats.map((c) => c.keys[0]).sort((a, b) => a - b);
        const full = [];
        for (let k = ks[0]; k != null && k <= ks[ks.length - 1] && full.length <= 20000; k = Q.nextDateKey(dp, k)) {
          full.push(k);
        }
        if (full.length <= 20000 && full.length > cats.length) {
          cats = full.map((k) => have.get(k) || { key: 'number:' + k, keys: [k], o: [0], label: Q.keyLabel(sp.dims[catD[0]], ctx.ds, k), filled: true });
          ctx.filledPeriods = full.length - have.size;
        }
      }
    }
    const catIdx = new Map(cats.map((c, i) => [c.key, i]));
    const colors = colorD >= 0 ? Q.combos(res, [colorD], ctx.ds) : [null];
    const isLineish = type === 'line' || type === 'area' || type === 'stackarea' || type === 'dualline';
    // Tableau처럼 색상 차원이 있는 막대는 기본적으로 누적
    const stacked = type === 'stackbar' || type === 'stackhbar' || type === 'pct100' || type === 'stackarea' || ((type === 'bar' || type === 'hbar' || type === 'auto-bar') && colorD >= 0);
    const colorMeas = sp.M.color;
    const labelM = sp.M.label;

    const series = [];
    const legendNames = [];
    // 마크 레이블: 자동 형식이면 짧게 (345,379,670 → 3.5억)
    const lblFmt = (mi, v) => (ctx.fmt(mi) === 'auto' && typeof v === 'number' && Math.abs(v) >= 1e4 ? BI.compact(v) : ctx.fv(mi, v));
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
          name, type: stype, data, _vi: vi,
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
            color: stacked ? '#fff' : undefined,
            formatter: (p) => (p.data && p.data._lbl != null ? p.data._lbl : lblFmt(mi, p.data ? p.data.value : p.value)),
          };
        }
        if (showLbl) s.labelLayout = { hideOverlap: true };
        series.push(s);
      });
    });

    // 누적 막대 안쪽 레이블: 범주마다 값이 하나뿐이면(색상 = 축 차원) 바깥에, 조각이 글자보다 작으면 숨김
    if (stacked && stype0(type) === 'bar' && series.some((s) => s.label)) {
      const single = cats.every((_, i) => series.filter((s) => s.data[i] && s.data[i].value != null).length <= 1);
      const box = ctx.opts.box || { w: 800, h: 500 };
      const tot = cats.map((_, i) => series.reduce((a, s) => a + (s.data[i] && typeof s.data[i].value === 'number' ? Math.abs(s.data[i].value) : 0), 0));
      const maxTot = type === 'pct100' ? 1 : Math.max(...tot, 0) || 1;
      const span = (horizontal ? box.w - 240 : box.h - 130) / Math.max(1, valM.length > 1 && ctx.o.measurePanels !== false ? valM.length : 1);
      series.forEach((s) => {
        if (!s.label) return;
        if (single) { s.label.position = horizontal ? 'right' : 'top'; s.label.color = undefined; return; }
        const f0 = s.label.formatter;
        s.label.formatter = (p) => {
          const txt = f0(p);
          const v = Math.abs(p.value) * (type === 'pct100' ? 1 : 1);
          const px = (v / maxTot) * span;
          return px >= (horizontal ? CH.textW(txt, 11) + 8 : 15) ? txt : '';
        };
      });
    }

    // 100% 누적
    if (type === 'pct100') {
      const tot = cats.map((_, i) => series.reduce((a, s) => a + (s.data[i] && typeof s.data[i].value === 'number' ? Math.abs(s.data[i].value) : 0), 0));
      series.forEach((s) => {
        s.data = s.data.map((d, i) => (d ? Object.assign({}, d, { raw: d.value, value: tot[i] ? d.value / tot[i] : 0 }) : null));
        if (s.label) s.label.formatter = (p) => (p.value >= 0.04 ? BI.formatNumber(p.value, 'pct') : '');
      });
    }

    const opt = baseOption(ctx);
    const catAxis = {
      type: 'category',
      data: cats.map((c) => c.label),
      axisLabel: catLabelPolicy(ctx, cats.map((c) => c.label), horizontal, cats.length > 40 && !horizontal ? 40 : horizontal && cats.length > 30 ? 30 : cats.length),
      axisTick: { alignWithLabel: true },
      name: catD.map((j) => ctx.dl(j)).join(' · '),
      nameLocation: 'middle',
      nameGap: horizontal ? 0 : 0,
      nameTextStyle: { color: 'transparent' },
    };
    if (horizontal) catAxis.inverse = true;
    const fmt0 = type === 'pct100' ? 'pct' : ctx.fmt(valM[0]);
    const valAxis = (name, fmt, pos) => ({
      type: 'value', name, nameLocation: 'middle', nameGap: horizontal ? 28 : 52, nameTextStyle: { color: '#6b7684', fontSize: 11 },
      axisLabel: { fontSize: 11, formatter: BI.axisFormatter(fmt) },
      splitLine: { lineStyle: { color: '#eef1f4' } },
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
    // 확대 구간 기본값: 전체 기간 (예전처럼 앞쪽 40개만 보이지 않게)
    if (cats.length > 40 && !horizontal && type !== 'pareto') opt.dataZoom = [{ type: 'inside', xAxisIndex: 0, start: 0, end: 100 }, { type: 'slider', height: 14, bottom: 4, start: 0, end: 100 }];
    if (cats.length > 40 && !horizontal) opt.grid.bottom = 28;
    if (cats.length > 30 && horizontal) opt.dataZoom = [{ type: 'inside', yAxisIndex: 0, start: 0, end: Math.min(100, Math.round((30 / cats.length) * 100)) }, { type: 'slider', yAxisIndex: 0, width: 12, right: 2 }];
    if (cscale) opt.visualMap = undefined;
    // 같은 선반에 측정값이 여럿이면 측정값마다 패널(축)을 나눔 (Tableau의 측정값별 축처럼) — 서식에서 끌 수 있음
    const split = valM.length > 1 && !['combo', 'dualline', 'pct100'].includes(type) && ctx.o.measurePanels !== false;
    if (split) {
      const n = valM.length;
      // 패널 배치는 칸 크기(px) 기준: 패널 사이 간격을 일정하게 두어 위 패널의 축 레이블과 겹치지 않게
      const box = ctx.opts.box || { w: 900, h: 520 };
      const top0 = showLegend && ctx.o.legend ? 34 : 14;
      const GAP = horizontal ? 18 : 22;
      const grids = [], cA = [], vA = [];
      const cl = catAxis.axisLabel;
      const catLw = Math.min(140, cats.slice(0, 300).reduce((a, c) => Math.max(a, textW(cl.formatter ? cl.formatter(c.label) : c.label, cl.fontSize || 11)), 0));
      const catLh = cl.rotate ? Math.min(110, catLw) * Math.sin(cl.rotate * Math.PI / 180) + 14 : 18;
      valM.forEach((mi, i) => {
        if (horizontal) {
          const avail = box.w - 24 - catLw - 12;
          const pw = Math.max(60, (avail - GAP * (n - 1)) / n);
          const x = 12 + (i ? catLw + 8 + i * (pw + GAP) : 0);
          grids.push({ left: x, width: i ? pw : pw + catLw + 8, top: top0, bottom: 34, containLabel: true });
        } else {
          const bottomPad = catLh + (opt.dataZoom ? 26 : 6);
          const ph = Math.max(50, (box.h - top0 - bottomPad - GAP * (n - 1)) / n);
          grids.push({ left: 34, right: 24, top: top0 + i * (ph + GAP), height: ph - (i === n - 1 ? 0 : 0), containLabel: true });
        }
        const ca = Object.assign({}, catAxis, { gridIndex: i, axisLabel: Object.assign({}, catAxis.axisLabel) });
        if (horizontal ? i > 0 : i < n - 1) ca.axisLabel.show = false;
        cA.push(ca);
        const va = valAxis(ctx.ml(mi), ctx.fmt(mi));
        va.gridIndex = i;
        va.splitNumber = horizontal ? 3 : Math.max(2, Math.min(4, Math.round(((box.h - top0) / n) / 45)));
        vA.push(va);
      });
      opt.grid = grids;
      opt.xAxis = horizontal ? vA : cA;
      opt.yAxis = horizontal ? cA : vA;
      series.forEach((s) => { s.xAxisIndex = s._vi; s.yAxisIndex = s._vi; });
      if (opt.dataZoom) opt.dataZoom.forEach((z) => { if (horizontal) z.yAxisIndex = cA.map((_, i) => i); else z.xAxisIndex = cA.map((_, i) => i); });
      ctx.measurePanels = n;
    }
    series.forEach((s) => delete s._vi);
    // 참조선: 평균 / 중앙값 / 상수(목표) — 값 표시. 측정값별 패널이면 패널마다
    if (ctx.o.refLine && series.length) {
      const kind = ctx.o.refKind || 'avg';
      const cv = +ctx.o.refConst;
      const KN = { avg: '평균', median: '중앙값', const: String(ctx.o.refName || '').trim() || '목표' };
      if (!(kind === 'const' && !isFinite(cv))) {
        const seen = new Set();
        series.forEach((s, si) => {
          const vi = split ? s.xAxisIndex : 0;
          if (seen.has(vi) || (!split && si > 0)) return;
          seen.add(vi);
          const mi = valM[vi] != null ? valM[vi] : valM[0];
          const d = kind === 'const' ? (horizontal ? { xAxis: cv } : { yAxis: cv }) : { type: kind === 'median' ? 'median' : 'average' };
          s.markLine = { symbol: 'none', silent: true, lineStyle: { type: 'dashed', color: '#d1343e' }, label: { position: 'insideEndTop', formatter: (p) => KN[kind] + ' ' + ctx.fv(mi, p.value), fontSize: 10 }, data: [d] };
        });
      }
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
    opt.xAxis = { type: 'category', data: arr.map((x) => x.label), axisLabel: catLabelPolicy(ctx, arr.map((x) => x.label), false) };
    opt.yAxis = [
      { type: 'value', axisLabel: { formatter: BI.axisFormatter(ctx.fmt(mi)), fontSize: 11 }, splitLine: { lineStyle: { color: '#eef1f4' } } },
      { type: 'value', max: 1, min: 0, axisLabel: { formatter: (v) => Math.round(v * 100) + '%', fontSize: 11 }, splitLine: { show: false } },
    ];
    opt.series = [
      { name: ctx.ml(mi), type: 'bar', data: arr.map((x) => ({ value: x.v, _r: x.ri })), barMaxWidth: 50, label: { show: ctx.o.labels, position: 'top', fontSize: 10, formatter: (p) => (ctx.fmt(mi) === 'auto' && Math.abs(p.value) >= 1e4 ? BI.compact(p.value) : ctx.fv(mi, p.value)) }, labelLayout: { hideOverlap: true } },
      { name: '누적 비율', type: 'line', yAxisIndex: 1, data: cum, symbolSize: 5, itemStyle: { color: '#eb6834' }, markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: '#999' }, data: [{ yAxis: 0.8 }], label: { formatter: '80%' } } },
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
    const labels = cats.map((c) => c.label).concat([String(ctx.o.wfTotalName || '').trim() || '합계']);
    const totalColor = BI.koreanColors() ? BI.cssVar('--ink2', '#4e5968') : BI.cssVar('--accent', '#3563e9');
    const upC = BI.upColor(), downC = BI.downColor();
    const opt = baseOption(ctx);
    opt.tooltip.trigger = 'axis';
    opt.tooltip.formatter = (ps) => {
      const i = ps[0].dataIndex;
      const v = i < vals.length ? vals[i] : run;
      return '<div class="tip"><b>' + BI.esc(labels[i]) + '</b><div><span class="tk">' + (i < vals.length ? '변동' : '합계') + '</span><b>' + ctx.fv(mi, v) + '</b></div>' + (i < vals.length ? '<div><span class="tk">누계</span><b>' + ctx.fv(mi, vals.slice(0, i + 1).reduce((a, b) => a + b, 0)) + '</b></div>' : '') + '</div>';
    };
    opt.grid = { left: 20, right: 20, top: 20, bottom: 12, containLabel: true };
    opt.xAxis = { type: 'category', data: labels, axisLabel: { fontSize: 11, hideOverlap: true, rotate: labels.length > 12 ? 35 : 0 } };
    opt.yAxis = { type: 'value', axisLabel: { formatter: BI.axisFormatter(ctx.fmt(mi)), fontSize: 11 }, splitLine: { lineStyle: { color: '#eef1f4' } } };
    const lbl = (p) => (p.value === '-' ? '' : ctx.fv(mi, p.value));
    opt.series = [
      { type: 'bar', stack: 'w', silent: true, itemStyle: { color: 'transparent' }, data: base },
      { name: '증가', type: 'bar', stack: 'w', barMaxWidth: 60, data: pos.map((v, i) => ({ value: v, itemStyle: { color: i === labels.length - 1 ? totalColor : upC } })), label: { show: ctx.o.labels, position: 'top', fontSize: 10, formatter: lbl } },
      { name: '감소', type: 'bar', stack: 'w', barMaxWidth: 60, data: neg.map((v, i) => ({ value: v, itemStyle: { color: i === labels.length - 1 ? totalColor : downC } })), label: { show: ctx.o.labels, position: 'bottom', fontSize: 10, formatter: (p) => (p.value === '-' ? '' : '-' + ctx.fv(mi, p.value)) } },
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
      // 레이블이 있으면 반지름을 줄여 바깥 레이블이 칸 밖으로 잘리지 않게
      radius: type === 'donut' ? (lblShow ? ['38%', '62%'] : ['42%', '70%']) : [0, lblShow ? '62%' : '70%'],
      center: [opt.legend.show === false ? '50%' : '44%', '52%'],
      data,
      avoidLabelOverlap: true,
      minShowLabelAngle: 2,
      itemStyle: { borderColor: '#fff', borderWidth: 1 },
      label: { show: lblShow, formatter: (p) => p.name + '\n' + (ctx.o.labels ? ctx.fv(mi, p.value) + ' ' : '') + '(' + BI.formatNumber(p.percent / 100, 'pct') + ')', fontSize: 11, lineHeight: 15, overflow: 'none', bleedMargin: 4 },
      labelLine: { length: 10, length2: 10 },
      labelLayout: { hideOverlap: true },
      emphasis: { scale: true, scaleSize: 6 },
    }];
    if (type === 'donut' && ctx.o.donutCenter !== false) {
      // 도넛과 같은 중심을 쓰는 투명 시리즈의 'center' 레이블 → 범례 위치·창 크기와 관계없이 정확히 가운데
      opt.series.push({
        type: 'pie', name: '__center', radius: [0, opt.series[0].radius[0]], center: opt.series[0].center, silent: true, tooltip: { show: false },
        itemStyle: { color: 'rgba(0,0,0,0)' }, emphasis: { disabled: true }, labelLine: { show: false },
        data: [{ value: 1, name: '' }],
        label: {
          show: true, position: 'center', offset: [+ctx.o.centerDx || 0, +ctx.o.centerDy || 0],
          formatter: () => '{v|' + ctx.fv(mi, tot) + '}\n{s|' + ctx.ml(mi) + '}',
          rich: { v: { fontSize: 20, fontWeight: 800, color: '#191f28', lineHeight: 28 }, s: { fontSize: 11, color: '#6b7684', lineHeight: 16 } },
        },
      });
      if (opt.legend.show !== false) opt.legend.data = data.map((d) => d.name);
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
    const deep = order.length > 1;
    // 상위 항목마다 팔레트 색을 직접 지정 → 하위는 같은 색 계열, 상위 이름 띠(upperLabel)는 진한 같은 색 위 흰 글자
    const clean = (n, depth, path, ci) => {
      const o = { name: n.name, value: n.value, _r: n._r };
      const p2 = path.concat(n.name);
      if (!scale) {
        const c = ctx.palette[ci % ctx.palette.length];
        if (depth === 1) o.itemStyle = { color: c, borderColor: BI.mix(c, '#000000', 0.18) };
        else if (type === 'sunburst') o.itemStyle = { color: BI.mix(c, '#ffffff', Math.min(0.5, 0.2 * (depth - 1))) };
        if (type === 'sunburst') o.label = { color: BI.textColorFor(o.itemStyle.color) };
      }
      if (n.children.length) o.children = n.children.map((c) => clean(c, depth + 1, p2, ci));
      if (scale && n._c != null) o.itemStyle = { color: scale(n._c) };
      if (!o.children && ctx.res.rows[n._r]) o._tip = tipHtml(ctx, ctx.res.rows[n._r]);
      // 같은 이름(서울/중구 · 부산/중구)도 구분되게 경로 전체를 표시
      else o._tip = '<div class="tip"><b>' + p2.map(BI.esc).join(' › ') + '</b><div><span class="tk">' + BI.esc(ctx.ml(mi)) + '</span><b>' + ctx.fv(mi, n.value) + '</b></div><div><span class="tk">비율</span><b>' + BI.formatNumber(n.value / (totAll || 1), 'pct') + '</b></div></div>';
      return o;
    };
    const totAll = root.children.reduce((a, c) => a + (c.value || 0), 0);
    const data = root.children.sort((a, b) => b.value - a.value).map((c, i) => clean(c, 1, [], i));
    const opt = baseOption(ctx);
    const vfmt = (v) => { const f = ctx.fmt(mi); return f === 'auto' || f === 'int' ? BI.compact(v) : ctx.fv(mi, v); };
    if (type === 'treemap') {
      const levels = [
        { itemStyle: { borderWidth: 0, gapWidth: deep ? 3 : 2 }, upperLabel: { show: false } },
      ];
      for (let i = 1; i < order.length; i++) {
        const lv = { itemStyle: { borderWidth: deep && i < order.length - 1 ? 2 : 0, gapWidth: 1, borderColorSaturation: i > 1 ? 0.55 : undefined }, colorSaturation: i > 1 ? [0.35, 0.6] : undefined };
        if (i === 1) Object.assign(lv.itemStyle, { borderWidth: 3, gapWidth: 1 });
        if (i < order.length) lv.upperLabel = { show: true };
        levels.push(lv);
      }
      levels.push({ itemStyle: { borderColor: '#fff', borderWidth: 0, gapWidth: 1 }, colorSaturation: deep ? [0.35, 0.6] : undefined });
      opt.series = [{
        type: 'treemap', data, roam: false, nodeClick: false, breadcrumb: { show: false }, top: 2, left: 2, right: 2, bottom: 2,
        leafDepth: null, levels, visibleMin: 10, sort: 'desc',
        itemStyle: { borderColor: '#fff' },
        upperLabel: { show: deep, height: 22, fontSize: 11.5, fontWeight: 650, color: '#fff', padding: [0, 6], overflow: 'truncate',
          formatter: (p) => p.name + '  ' + vfmt(p.value) },
        label: {
          show: true, overflow: 'truncate', fontSize: 11, color: '#fff', lineHeight: 15,
          formatter: (p) => '{n|' + p.name + '}\n{v|' + vfmt(p.value) + '}',
          textShadowColor: 'rgba(0,0,0,.28)', textShadowBlur: 3,
          rich: { n: { fontSize: 11.5, fontWeight: 600, color: '#fff', textShadowColor: 'rgba(0,0,0,.28)', textShadowBlur: 3 }, v: { fontSize: 10.5, color: 'rgba(255,255,255,.9)', textShadowColor: 'rgba(0,0,0,.28)', textShadowBlur: 3 } },
        },
      }];
    } else {
      opt.series = [{
        type: 'sunburst', data, radius: ['8%', '92%'], sort: null, itemStyle: { borderColor: '#fff', borderWidth: 1 },
        label: { rotate: 'radial', fontSize: 10.5, minAngle: 7, overflow: 'truncate', color: '#fff' },
        levels: [{}].concat(order.map((_, i) => ({ label: i === 0 && order.length > 1 ? { rotate: 'tangential', fontWeight: 650, fontSize: 11 } : {} }))),
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
        labelLayout: { hideOverlap: true },
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
        series.push({ name: '추세선', type: 'line', symbol: 'none', silent: true, lineStyle: { type: 'dashed', color: BI.cssVar('--ink2', '#4e5968'), width: 1.5 }, data: [[x0, a + b * x0], [x1, a + b * x1]], tooltip: { show: false }, z: 1 });
        ctx.trendR2 = r2;
      }
    }
    const opt = baseOption(ctx);
    opt.legend = legendOpt(ctx, groups.length > 1);
    if (groups.length > 1) opt.legend.data = groups.map((g) => g.label); // 추세선은 범례에서 제외
    opt.grid = { left: 20, right: 24, top: (groups.length > 1 && ctx.o.legend ? 36 : 20) + (ctx.trendR2 != null ? 14 : 0), bottom: 20, containLabel: true };
    if (ctx.trendR2 != null) opt.graphic = [{ type: 'text', right: 24, top: groups.length > 1 && ctx.o.legend ? 30 : 6, silent: true, style: { text: '- - 추세선 (선형)  R² = ' + ctx.trendR2.toFixed(3), fill: BI.cssVar('--muted', '#6b7684'), font: '11px ' + CH.FONT } }];
    const ax = (mi, nameGap) => ({ type: 'value', scale: true, name: ctx.ml(mi), nameLocation: 'middle', nameGap, nameTextStyle: { color: '#6b7684', fontSize: 11 }, axisLabel: { formatter: BI.axisFormatter(ctx.fmt(mi)), fontSize: 11 }, splitLine: { lineStyle: { color: '#eef1f4' } } });
    opt.xAxis = ax(xm, 26);
    opt.yAxis = ax(ym, 52);
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
    const stops = BI.seqStops(ctx.o.seq);
    opt.grid = { left: 20, right: 20, top: 10, bottom: 50, containLabel: true };
    const box = ctx.opts.box || { w: 800, h: 500 };
    const xl = catLabelPolicy(ctx, xs.map((c) => c.label), false);
    const yl = catLabelPolicy(ctx, ys.map((c) => c.label), true);
    opt.xAxis = { type: 'category', data: xs.map((c) => c.label), splitArea: { show: true }, axisLabel: xl };
    opt.yAxis = { type: 'category', data: ys.map((c) => c.label), inverse: true, splitArea: { show: true }, axisLabel: yl };
    // 셀 크기 추정: 값 글자가 셀에 들어갈 때만 표시
    const ylw = ys.slice(0, 200).reduce((a, c) => Math.max(a, textW(c.label, 11)), 0);
    const cellW = (box.w - Math.min(140, ylw) - 60) / Math.max(1, xs.length);
    const cellH = (box.h - 110 - (xl.rotate ? 50 : 0)) / Math.max(1, ys.length);
    // 셀 값은 짧게 (자동 형식이면 만·억)
    const cf = (v) => { const f = ctx.fmt(vm); return f === 'auto' || f === 'int' ? BI.compact(v) : ctx.fv(vm, v); };
    const sampleW = textW(cf(mx), 10) + 6;
    const fitLbl = cellW >= sampleW && cellH >= 14;
    opt.visualMap = { min: isFinite(mn) ? mn : 0, max: isFinite(mx) ? mx : 1, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 140, itemWidth: 12, inRange: { color: stops }, textStyle: { fontSize: 10 }, formatter: (v) => BI.axisFormatter(ctx.fmt(vm))(v) };
    opt.series = [{ type: 'heatmap', data, label: { show: ctx.o.labels || (fitLbl && xs.length * ys.length <= 400), fontSize: 10, formatter: (p) => cf(p.value[2]) }, labelLayout: { hideOverlap: true }, itemStyle: { borderColor: '#fff', borderWidth: 1 }, emphasis: { itemStyle: { borderColor: '#333', borderWidth: 1 } } }];
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
    let w = (mx - mn) / nb || 1;
    // 구간 크기 지정: 경계를 구간 크기의 배수로 맞춤 (예: 1,000만 단위)
    const bs = +ctx.o.binSize;
    if (bs > 0 && (mx - mn) / bs <= 1000) { w = bs; mn = Math.floor(mn / bs) * bs; nb = Math.max(1, Math.floor((mx - mn) / bs) + 1); }
    const cnt = new Array(nb).fill(0);
    vals.forEach((v) => { cnt[Math.min(nb - 1, Math.floor((v - mn) / w))]++; });
    const f = BI.Data.fieldById(ctx.ds, id);
    const hf = Q.measureFormat(Object.assign({}, mp, { agg: 'SUM', tc: null }), ctx.ds, ctx.o.numFmt);
    // 구간 경계는 모두 같은 단위로 (예: 0.4억 ~ 0.5억, 9,000만과 1.2억이 섞이지 않게)
    const uf = BI.unitFormatter(Math.max(Math.abs(mn), Math.abs(mn + nb * w)), w);
    const hfmt = (v) => (hf === 'auto' || hf === 'compact' ? uf(v) : BI.formatNumber(v, hf));
    const labels = cnt.map((_, i) => hfmt(mn + i * w) + ' ~ ' + hfmt(mn + (i + 1) * w));
    const opt = baseOption(ctx);
    opt.tooltip.formatter = (p) => '<div class="tip"><b>' + BI.esc((f ? f.name : '') + ' ' + labels[p.dataIndex]) + '</b><div><span class="tk">빈도</span><b>' + BI.formatNumber(p.value) + '</b></div><div><span class="tk">비율</span><b>' + BI.formatNumber(p.value / vals.length, 'pct') + '</b></div></div>';
    opt.grid = { left: 20, right: 20, top: 20, bottom: 30, containLabel: true };
    opt.xAxis = { type: 'category', data: labels, name: f ? f.name : '', nameLocation: 'middle', nameGap: 40, axisLabel: { fontSize: 10, rotate: 30, hideOverlap: true } };
    opt.yAxis = { type: 'value', name: '빈도', axisLabel: { fontSize: 11 }, splitLine: { lineStyle: { color: '#eef1f4' } } };
    opt.series = [{ type: 'bar', data: cnt, barCategoryGap: '2%', itemStyle: { color: ctx.palette[0] }, label: { show: ctx.o.labels, position: 'top', fontSize: 10 } }];
    return { option: opt };
  }

  /* ---------- 상자 수염 그림 ---------- */
  function boxplot(ctx) {
    const sp = ctx.sp;
    const mp = sp.rowMeas[0] || sp.colMeas[0] || sp.meas[0];
    if (!mp) return { empty: '상자 수염 그림에는 측정값 1개가 필요합니다.' };
    // 색상 차원은 X축 범주가 아니라 상자 색(시리즈)으로 구분
    const colorDim = sp.color && !sp.color.agg ? sp.color : null;
    const catDims = sp.colDims.concat(sp.rowDims, colorDim ? [colorDim] : []);
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
    const nx = colorDim ? catDims.length - 1 : catDims.length;
    const xLabel = (g) => g.keys.slice(0, nx).map((k, i) => Q.keyLabel(catDims[i], ctx.ds, k)).join(' · ') || (BI.Data.fieldById(ctx.ds, mp.f) || {}).name;
    const labels = Array.from(new Set(arr.map(xLabel)));
    const colorKeys = colorDim ? Array.from(new Set(arr.map((g) => g.keys[nx]))).sort(BI.cmp) : [null];
    const stat = (vals) => {
      const s = vals.slice().sort((a, b) => a - b);
      if (!s.length) return { box: [], out: [] };
      const q1 = BI.quantile(s, 0.25), q2 = BI.quantile(s, 0.5), q3 = BI.quantile(s, 0.75), iqr = q3 - q1;
      const lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
      const inner = s.filter((v) => v >= lo && v <= hi);
      return { box: [inner[0], q1, q2, q3, inner[inner.length - 1]], out: s.filter((v) => v < lo || v > hi), n: s.length };
    };
    const fmt = Q.measureFormat(Object.assign({}, mp, { agg: 'SUM' }), ctx.ds, ctx.o.numFmt);
    const series = [], counts = {};
    colorKeys.forEach((ck, ci) => {
      const boxes = labels.map(() => []), outl = [];
      arr.forEach((g) => {
        if (colorDim && BI.cmp(g.keys[nx], ck) !== 0) return;
        const xi = labels.indexOf(xLabel(g));
        const st = stat(g.v);
        boxes[xi] = st.box;
        counts[ci + ':' + xi] = st.n || 0;
        st.out.forEach((v) => outl.push([xi, v]));
      });
      const col = ctx.palette[ci % ctx.palette.length];
      const nm = colorDim ? Q.keyLabel(colorDim, ctx.ds, ck) : '';
      // 상자와 이상치는 같은 색 계열 (이상치 = 같은 색, 반투명)
      series.push({ name: nm, type: 'boxplot', data: boxes, _ci: ci, boxWidth: [7, 48], itemStyle: { color: BI.mix(col, '#ffffff', 0.78), borderColor: col, borderWidth: 1.5 } });
      series.push({ name: nm, type: 'scatter', data: outl, symbolSize: 5, itemStyle: { color: col, opacity: 0.45 }, z: 1 });
    });
    const opt = baseOption(ctx);
    opt.tooltip.formatter = (p) => {
      if (p.seriesType === 'boxplot') {
        const d = p.data.slice(-5);
        return '<div class="tip"><b>' + BI.esc(p.name) + (p.seriesName ? ' · ' + BI.esc(p.seriesName) : '') + '</b>' + ['최소(수염)', '1사분위', '중앙값', '3사분위', '최대(수염)'].map((n, i) => '<div><span class="tk">' + n + '</span><b>' + BI.formatNumber(d[i], fmt) + '</b></div>').join('') + '<div><span class="tk">개수</span><b>' + (counts[(series[p.seriesIndex]._ci || 0) + ':' + p.dataIndex] || 0) + '</b></div></div>';
      }
      return '<div class="tip">이상치: <b>' + BI.formatNumber(p.data[1], fmt) + '</b></div>';
    };
    opt.legend = legendOpt(ctx, !!colorDim);
    if (colorDim) opt.legend.data = series.filter((s) => s.type === 'boxplot').map((s) => s.name);
    opt.grid = { left: 20, right: 20, top: colorDim && ctx.o.legend ? 36 : 20, bottom: 20, containLabel: true };
    opt.xAxis = { type: 'category', data: labels, axisLabel: { fontSize: 11, rotate: labels.length > 10 ? 30 : 0, hideOverlap: true } };
    opt.yAxis = { type: 'value', scale: true, name: (BI.Data.fieldById(ctx.ds, mp.f) || {}).name, axisLabel: { formatter: BI.axisFormatter(fmt), fontSize: 11 }, splitLine: { lineStyle: { color: '#eef1f4' } } };
    opt.series = series;
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

  /* ---------- 게이지 ----------
     바늘 대신 진행 호 + 가운데 큰 숫자. 목표가 있으면 달성률이 주 정보, 값/목표는 보조 줄.
     큰 값은 억·만으로 줄이고, 글자 크기는 칸 크기에 맞춤 (작은 대시보드 칸에서도 눈금과 겹치지 않게) */
  function gauge(ctx) {
    const sp = ctx.sp;
    const meas = sp.meas.length ? sp.meas : [{ f: '__count', agg: 'SUM' }];
    const res = Q.aggregate(ctx.ds, ctx.rows, [], meas);
    ctx.res = res;
    const r = res.rows[0] || { m: [] };
    const v = r.m[0] || 0;
    const target = meas.length > 1 ? r.m[1] : null;
    // 자동 최대값: 값·목표의 1.1배를 눈금 단위로 올림 (605 → 700)
    const top = Math.max(target || 0, v) * (target ? 1.1 : 1.25);
    const stp = niceStep(top / 10);
    const max = +ctx.o.gaugeMax || (top > 0 ? Math.ceil(top / stp) * stp : 100);
    const short = (mi, x) => { const f = ctx.fmt(mi); return f === 'auto' || f === 'int' || f === 'compact' ? BI.compact(x) : ctx.fv(mi, x); };
    const box = ctx.opts.box || { w: 600, h: 400 };
    // 호의 지름 ≈ min(폭, 높이×1.6)
    const S = Math.max(120, Math.min(box.w, box.h * 1.6));
    const big = Math.round(Math.max(18, Math.min(44, S * 0.105)));
    const small = Math.round(Math.max(10.5, Math.min(14, S * 0.034)));
    const W = Math.round(Math.max(10, Math.min(22, S * 0.05)));
    const opt = baseOption(ctx);
    const pct = target ? v / target : null;
    const prog = target && BI.cssVar ? (pct >= 1 ? BI.cssVar('--std-up', '#12a46e') : ctx.palette[0]) : ctx.palette[0];
    const name = Q.pillLabel(meas[0], ctx.ds);
    const center = ['50%', '62%'];
    opt.series = [{
      type: 'gauge', min: 0, max, radius: '92%', center, startAngle: 200, endAngle: -20, splitNumber: 4,
      progress: { show: true, width: W, roundCap: false, itemStyle: { color: prog } },
      axisLine: { lineStyle: { width: W, color: [[1, BI.cssVar('--line2', '#edf0f3')]] } },
      axisTick: { show: false }, splitLine: { show: false },
      axisLabel: { show: S >= 380, distance: W + 6, fontSize: 10, color: BI.cssVar('--faint', '#9aa3ad'), formatter: (x) => (x === 0 || x === max ? short(0, x) : '') },
      pointer: { show: false }, anchor: { show: false },
      title: { show: S >= 300, offsetCenter: [0, target ? '34%' : '26%'], fontSize: small, color: BI.cssVar('--muted', '#6b7684'), overflow: 'truncate', width: S * 0.7 },
      detail: {
        valueAnimation: false, offsetCenter: [0, '-4%'], color: BI.cssVar('--text', '#191f28'), fontFamily: CH.FONT,
        formatter: () => (target ? '{b|' + BI.formatNumber(pct, 'pct') + '}\n{s|' + short(0, v) + ' / 목표 ' + short(1, target) + '}' : '{b|' + short(0, v) + '}'),
        rich: { b: { fontSize: big, fontWeight: 800, lineHeight: Math.round(big * 1.2), color: target ? prog : BI.cssVar('--text', '#191f28') }, s: { fontSize: small, color: BI.cssVar('--ink2', '#4e5968'), lineHeight: Math.round(small * 1.6) } },
      },
      data: [{ value: Math.min(v, max), name: target ? name + ' 달성률' : name }],
    }];
    if (target) {
      // 목표 위치 표시 (호 바깥쪽 짧은 막대)
      opt.series.push({
        type: 'gauge', min: 0, max, radius: '92%', center, startAngle: 200, endAngle: -20, silent: true,
        axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, progress: { show: false }, detail: { show: false }, title: { show: false }, anchor: { show: false },
        pointer: { icon: 'rect', width: 3, length: W + 8, offsetCenter: [0, '-' + Math.round((1 - (W + 4) / (0.46 * Math.min(box.w, box.h))) * 100) + '%'], itemStyle: { color: BI.cssVar('--text', '#191f28') } },
        data: [{ value: Math.min(target, max), name: '목표' }],
      });
    }
    opt.tooltip.formatter = () => '<div class="tip"><div><span class="tk">' + BI.esc(name) + '</span><b>' + ctx.fv(0, v) + '</b></div>' + (target ? '<div><span class="tk">' + BI.esc(Q.pillLabel(meas[1], ctx.ds)) + '</span><b>' + ctx.fv(1, target) + '</b></div><div><span class="tk">달성률</span><b>' + BI.formatNumber(v / target, 'pct') + '</b></div>' : '') + '</div>';
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
    // 목표 구간·실적 막대·목표선이 모두 범주 가운데에 오도록 구간은 숨은 보조 범주축에 그림
    const box = ctx.opts.box || { w: 600, h: 400 };
    const catH = Math.max(8, (box.h - 90) / Math.max(1, cats.length));
    const tickH = Math.round(Math.max(10, Math.min(40, catH * 0.56)));
    opt.grid = { left: 20, right: 56, top: 36, bottom: 12, containLabel: true };
    const cat = { type: 'category', data: cats.map((c) => c.label), inverse: true, axisLabel: { fontSize: 11 }, axisTick: { show: false } };
    opt.yAxis = [cat, Object.assign({}, cat, { show: false })];
    opt.xAxis = { type: 'value', axisLabel: { formatter: BI.axisFormatter(ctx.fmt(am)), fontSize: 11 }, splitLine: { lineStyle: { color: BI.cssVar('--line2', '#edf0f3') } } };
    const okC = BI.cssVar('--std-up', '#12a46e');
    opt.series = [
      { name: '목표 구간', type: 'bar', yAxisIndex: 1, data: T.map((t, i) => ({ value: Math.max(t * 1.2, A[i]) })), barWidth: '64%', itemStyle: { color: BI.cssVar('--line2', '#edf0f3'), borderRadius: 2 }, silent: true, z: 1,
        // 달성률은 구간 오른쪽 끝에 (실적 막대·목표선과 겹치지 않게)
        label: { show: true, position: 'right', distance: 6, fontSize: 11, fontWeight: 600, color: BI.cssVar('--ink2', '#4e5968'), formatter: (p) => (T[p.dataIndex] ? BI.formatNumber(A[p.dataIndex] / T[p.dataIndex], 'pct') : '') } },
      { name: ctx.ml(am), type: 'bar', data: A.map((v, i) => ({ value: v, _r: RI[i], itemStyle: { color: T[i] && v >= T[i] ? okC : ctx.palette[0] } })), barWidth: '26%', z: 3 },
      { name: ctx.ml(tm), type: 'scatter', data: T.map((t, i) => ({ value: t, _r: RI[i] })), symbol: 'rect', symbolSize: [3, tickH], itemStyle: { color: BI.cssVar('--text', '#191f28') }, z: 4 },
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
    opt.visualMap = { min: mn, max: mx, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 140, itemWidth: 12, inRange: { color: BI.seqStops(ctx.o.seq || 'green') }, textStyle: { fontSize: 10 }, formatter: (v) => BI.axisFormatter(fmt)(v) };
    opt.calendar = years.map((y, i) => ({ range: String(y), top: 30 + i * 150, left: 50, right: 20, cellSize: ['auto', 15], yearLabel: { fontSize: 13 }, dayLabel: { nameMap: ['일', '월', '화', '수', '목', '금', '토'], fontSize: 10 }, monthLabel: { nameMap: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'], fontSize: 10 }, itemStyle: { borderColor: '#fff', borderWidth: 2 }, splitLine: { lineStyle: { color: '#999', width: 1 } } }));
    opt.series = years.map((y, i) => ({ type: 'heatmap', coordinateSystem: 'calendar', calendarIndex: i, data: data.filter((d) => d[0].startsWith(String(y))) }));
    return { option: opt, minHeight: 60 + years.length * 150 };
  }

  /* ---------- 테이블 (HTML) ---------- */
  // 표 머리글 정렬 표시 (mi == null 이면 이름순 정렬 표시)
  function sortMark(p, mi) {
    if (!p || !p.sort) return '';
    let dir = null;
    if (mi == null && (p.sort === 'asc' || p.sort === 'desc')) dir = p.sort;
    if (mi != null && (p.sort === 'mdesc' || p.sort === 'masc') && (p.sortBy || 0) === mi) dir = p.sort === 'masc' ? 'asc' : 'desc';
    if (!dir) return '';
    return '<span class="sort-mk"><svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (dir === 'asc' ? '<path d="M8 13V3M4 7l4-4 4 4"/>' : '<path d="M8 3v10M4 9l4 4 4-4"/>') + '</svg></span>';
  }

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
    const rCombos = Q.combos(res, rowD, ctx.ds);
    const cCombos = Q.combos(res, colD, ctx.ds);
    const cell = new Map();
    res.rows.forEach((r, ri) => cell.set(Q.comboKey(r, rowD) + '\u0002' + Q.comboKey(r, colD), ri));
    const hm = highlight ? (sp.M.color >= 0 ? sp.M.color : mOrder[0]) : -1;
    let scale = null, legend = '';
    if (hm >= 0) {
      let mn = Infinity, mx = -Infinity;
      res.rows.forEach((r) => { const v = r.m[hm]; if (typeof v === 'number') { mn = Math.min(mn, v); mx = Math.max(mx, v); } });
      scale = BI.colorScale(mn, mx, ctx.o.seq);
      // 색 범례 (작은 그라데이션 막대 + 최소·최대)
      if (isFinite(mn)) {
        const g = [0, 0.25, 0.5, 0.75, 1].map((t) => scale(mn + (mx - mn) * t)).join(',');
        legend = '<div class="hl-legend"><b>' + BI.esc(ctx.ml(hm)) + '</b><span>' + BI.esc(ctx.fv(hm, mn)) + '</span><i style="background:linear-gradient(90deg,' + g + ')"></i><span>' + BI.esc(ctx.fv(hm, mx)) + '</span></div>';
      }
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
      if (lvl === 0) rowD.forEach((j, li) => (h += '<th class="rh corner sortable" data-lvl="' + li + '" data-sortf="' + BI.esc(ctx.sp.dims[j].f) + '" rowspan="' + hdrRows + '">' + BI.esc(ctx.dl(j)) + sortMark(ctx.sp.dims[j], null) + '</th>'));
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
      if (!colD.length) { rowD.forEach((j, li) => (h += '<th class="rh corner sortable" data-lvl="' + li + '" data-sortf="' + BI.esc(ctx.sp.dims[j].f) + '">' + BI.esc(ctx.dl(j)) + sortMark(ctx.sp.dims[j], null) + '</th>')); if (!rowD.length) h += ''; }
      const rowShelf = (ctx.sp.D && ctx.sp.D.row && ctx.sp.D.row.length ? ctx.sp.D.row : rowD);
      const lastRow = !colD.length && rowShelf.length ? ctx.sp.dims[rowShelf[rowShelf.length - 1]] : null;
      cCombos.forEach(() => mOrder.forEach((mi) => (h += lastRow
        ? '<th class="mh sortable" data-sortf="' + BI.esc(lastRow.f) + '" data-sortm="' + mi + '">' + BI.esc(ctx.ml(mi)) + sortMark(lastRow, mi) + '</th>'
        : '<th class="mh">' + BI.esc(ctx.ml(mi)) + '</th>')));
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
        h += '<th class="rh" data-lvl="' + lvl + '"' + (span > 1 ? ' rowspan="' + span + '"' : '') + '>' + BI.esc(ctx.kl(j, rc.keys[lvl])) + '</th>';
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
      h += '<tr class="totrow"><th class="rh tot" data-lvl="0" colspan="' + Math.max(1, rowD.length) + '">총계</th>';
      cCombos.forEach((cc) => {
        const t = colTot.get(cc.keys.map((k) => typeof k + ':' + k).join('\u0001'));
        mOrder.forEach((mi) => (h += '<td class="tot">' + BI.esc(t ? ctx.fv(mi, t.m[mi]) : '') + '</td>'));
      });
      if (rowTot) mOrder.forEach((mi) => (h += '<td class="tot grand">' + BI.esc(grand ? ctx.fv(mi, grand.m[mi]) : '') + '</td>'));
      h += '</tr>';
    }
    h += '</tbody></table>';
    if (rCombos.length > LIMIT) h += '<div class="vt-note">처음 ' + LIMIT.toLocaleString() + '행만 표시합니다 (전체 ' + rCombos.length.toLocaleString() + '행). 필터를 사용해 범위를 줄이세요.</div>';
    return { html: '<div class="vt-wrap">' + legend + h + '</div>' };
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
          delta = '<div class="kpi-delta ' + (ch >= 0 ? 'up' : 'down') + '" style="color:' + (ch >= 0 ? BI.upColor() : BI.downColor()) + '">' + (ch >= 0 ? '▲ ' : '▼ ') + BI.formatNumber(Math.abs(ch), 'pct') + ' <span>직전 ' + BI.esc(Q.keyLabel(dd, ctx.ds, prev.d[0])) + ' 대비</span></div>';
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
    if (out.option) postStyle(out.option, ctx);
    out.ctx = ctx;
    out.type = type;
    out.fontScale = +ctx.o.fontScale || 1;
    return out;
  };

  /* 레이블 위치(자동/안쪽/바깥쪽)와 X·Y 미세 조정 */
  function labelTweak(opt, ctx) {
    const pos = ctx.o.labelPos || 'auto';
    const dx = +ctx.o.labelDx || 0, dy = +ctx.o.labelDy || 0;
    const y0 = [].concat(opt.yAxis || [])[0];
    const horizontal = !!(y0 && y0.type === 'category');
    [].concat(opt.series || []).forEach((s) => {
      if (!s || s.name === '__center' || !s.label || s.label.show === false) return;
      if (pos !== 'auto') {
        if (s.type === 'bar') s.label.position = pos === 'inside' ? 'inside' : horizontal ? 'right' : 'top';
        else if (s.type === 'pie') { s.label.position = pos === 'inside' ? 'inside' : 'outside'; if (pos === 'inside') s.label.color = '#fff'; }
        else if (s.type === 'line' || s.type === 'scatter') s.label.position = pos === 'inside' ? 'inside' : 'top';
        else if (s.type === 'funnel') s.label.position = pos === 'inside' ? 'inside' : 'right';
      }
      if (dx || dy) s.label.offset = [dx, dy];
      // 개별 레이블을 마우스로 끌어 옮길 수 있게 (내보내기 전 미세 조정용)
      if (['bar', 'pie', 'scatter', 'line', 'funnel'].includes(s.type)) s.labelLayout = Object.assign({}, s.labelLayout, { draggable: true });
    });
  }

  /* ---------- 축 이름·눈금 레이블 자리 맞춤 ----------
     ECharts의 containLabel은 축 이름(nameLocation: middle)을 계산에 넣지 않으므로
     눈금 레이블 폭/높이를 직접 재서 nameGap과 격자 여백을 정합니다. */
  const measureCtx = document.createElement('canvas').getContext('2d');
  const textW = (s, fs) => { measureCtx.font = fs + 'px ' + CH.FONT; return measureCtx.measureText(String(s == null ? '' : s)).width; };
  CH.textW = textW;
  const niceStep = (x) => { if (!(x > 0)) return 1; const e = Math.pow(10, Math.floor(Math.log10(x))), f = x / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 3 ? 3 : f <= 5 ? 5 : 10) * e; };
  // 축에 붙은 시리즈 값의 범위 (누적은 합산)
  function axisExtent(opt, which, ai) {
    let mn = Infinity, mx = -Infinity;
    const stacks = new Map();
    [].concat(opt.series || []).forEach((s) => {
      if (!s || !Array.isArray(s.data) || s.coordinateSystem === 'calendar') return;
      if ((s[which + 'AxisIndex'] || 0) !== ai) return;
      s.data.forEach((d, i) => {
        let v = d != null && typeof d === 'object' && !Array.isArray(d) ? d.value : d;
        if (Array.isArray(v)) v = v[which === 'x' ? 0 : 1];
        if (typeof v !== 'number' || !isFinite(v)) return;
        if (s.stack) {
          const key = s.stack + (v < 0 ? '-' : '+') + i;
          v = (stacks.get(key) || 0) + v;
          stacks.set(key, v);
        }
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      });
    });
    return isFinite(mn) ? [mn, mx] : null;
  }
  function valueLabelW(opt, ax, which, ai) {
    const fs = (ax.axisLabel && ax.axisLabel.fontSize) || 12;
    let f = ax.axisLabel && typeof ax.axisLabel.formatter === 'function' ? ax.axisLabel.formatter : (v) => BI.formatNumber(v);
    let ext = axisExtent(opt, which, ai);
    if (!ext) return fs * 2;
    let [mn, mx] = ext;
    if (!ax.scale) { mn = Math.min(0, mn); mx = Math.max(0, mx); }
    if (typeof ax.max === 'number') mx = ax.max;
    if (typeof ax.min === 'number') mn = ax.min;
    const step = niceStep((mx - mn) / 5 || Math.abs(mx) || 1);
    // 자동 형식이면 축 최대값 기준 단위 하나로
    if (ax.axisLabel && ax.axisLabel.formatter && ax.axisLabel.formatter.unitAuto) {
      ax.axisLabel.formatter = BI.unitFormatter(Math.max(Math.abs(Math.floor(mn / step) * step), Math.abs(Math.ceil(mx / step) * step)), step / 4);
      f = ax.axisLabel.formatter;
    }
    let w = 0;
    for (let t = Math.floor(mn / step) * step, n = 0; t <= Math.ceil(mx / step) * step + step / 2 && n < 30; t += step, n++) w = Math.max(w, textW(f(Math.round(t / step) * step, n), fs));
    return w;
  }
  function catLabelSize(ax) {
    const fs = (ax.axisLabel && ax.axisLabel.fontSize) || 12;
    const f = ax.axisLabel && typeof ax.axisLabel.formatter === 'function' ? ax.axisLabel.formatter : (v) => v;
    const data = (ax.data || []).map((d) => (d && typeof d === 'object' ? d.value : d));
    let w = 0;
    data.slice(0, 400).forEach((d) => { w = Math.max(w, textW(f(String(d)), fs)); });
    const rot = ((ax.axisLabel && ax.axisLabel.rotate) || 0) * Math.PI / 180;
    return { w, h: rot ? Math.sin(Math.abs(rot)) * w + Math.cos(rot) * fs : fs * 1.3, fs };
  }
  function fitAxes(opt, ctx) {
    if (!opt.xAxis || !opt.yAxis || opt.radar) return;
    const grids = [].concat(opt.grid || []);
    if (!grids.length) return;
    const xs = [].concat(opt.xAxis), ys = [].concat(opt.yAxis);
    const named = (ax) => ax && ax.show !== false && ax.name && !(ax.nameTextStyle && ax.nameTextStyle.color === 'transparent');
    const nfs = (ax) => (ax.nameTextStyle && ax.nameTextStyle.fontSize) || 11;
    const zoomH = [].concat(opt.dataZoom || []).some((z) => z && z.type === 'slider' && z.orient !== 'vertical' && z.yAxisIndex == null) ? 22 : 0;
    // 세로축 (왼쪽/오른쪽)
    ys.forEach((ax, ai) => {
      if (!ax || ax.show === false) return;
      const g = grids[ax.gridIndex || 0];
      if (!g) return;
      const lw = ax.axisLabel && ax.axisLabel.show === false ? 0 : ax.type === 'category' ? catLabelSize(ax).w : valueLabelW(opt, ax, 'y', ai);
      const side = ax.position === 'right' || (ax.position == null && ai > 0 && ys.length > 1 && (ys[0].gridIndex || 0) === (ax.gridIndex || 0)) ? 'right' : 'left';
      if (!named(ax)) return;
      ax.nameLocation = 'middle';
      ax.nameRotate = side === 'right' ? -90 : 90;
      ax.nameGap = Math.round(lw + 12);
      ax.nameTextStyle = Object.assign({ color: BI.cssVar('--muted', '#6b7684') }, ax.nameTextStyle, { width: undefined, overflow: undefined });
      // 축 이름이 패널 높이보다 길면 말줄임
      if (grids.length > 1 || typeof g.height === 'string') Object.assign(ax.nameTextStyle, { width: typeof g.height === 'number' ? Math.max(40, g.height - 4) : 140, overflow: 'truncate' });
      if (typeof g[side] !== 'string') g[side] = Math.max(Math.round(nfs(ax) * 1.3 + 8), 0);
    });
    // 가로축 (아래)
    xs.forEach((ax, ai) => {
      if (!ax || ax.show === false) return;
      if (ax.type === 'value') {
        // 좁은 칸에서는 눈금 수를 줄여 레이블이 붙지 않게
        const lw = valueLabelW(opt, ax, 'x', ai);
        const box = ctx.opts.box;
        const nx = new Set(xs.map((o) => o.gridIndex || 0)).size;
        if (box && ax.splitNumber == null) ax.splitNumber = Math.max(2, Math.min(5, Math.floor((box.w / nx - 90) / (lw + 26))));
        ax.axisLabel = Object.assign({}, ax.axisLabel, { hideOverlap: true });
      }
      const g = grids[ax.gridIndex || 0];
      if (!g) return;
      const lh = ax.axisLabel && ax.axisLabel.show === false ? 0 : ax.type === 'category' ? catLabelSize(ax).h : ((ax.axisLabel && ax.axisLabel.fontSize) || 12) * 1.3;
      const isLast = !xs.some((o, j) => j !== ai && (o.gridIndex || 0) === (ax.gridIndex || 0) && o.position !== 'top' && j > ai);
      if (!named(ax) || ax.position === 'top') { if (isLast && typeof g.bottom === 'number' && zoomH && g.bottom < zoomH + 6) g.bottom = zoomH + 6; return; }
      ax.nameLocation = 'middle';
      ax.nameGap = Math.round(lh + 10);
      ax.nameTextStyle = Object.assign({ color: BI.cssVar('--muted', '#6b7684') }, ax.nameTextStyle);
      if (typeof g.bottom !== 'string') g.bottom = Math.round(nfs(ax) * 1.3 + 6 + zoomH);
    });
  }
  CH.fitAxes = fitAxes;

  /* 서식 후처리: 글자 크기 배율, 범례 위치 */
  function postStyle(opt, ctx) {
    labelTweak(opt, ctx);
    const k = +ctx.o.fontScale || 1;
    if (k !== 1) {
      const seen = new Set();
      const walk = (o) => {
        if (!o || typeof o !== 'object' || seen.has(o)) return;
        seen.add(o);
        if (Array.isArray(o)) { o.forEach(walk); return; }
        Object.keys(o).forEach((key) => {
          const v = o[key];
          if (key === 'fontSize' && typeof v === 'number') o[key] = Math.round(v * k * 10) / 10;
          else if (key !== 'data' && v && typeof v === 'object') walk(v);
        });
      };
      walk(opt);
      opt.textStyle = Object.assign({}, opt.textStyle, { fontSize: Math.round(12 * k) });
      const ensure = (o, path) => { if (!o) return; [].concat(o).forEach((x) => { if (!x) return; x[path] = x[path] || {}; if (x[path].fontSize == null) x[path].fontSize = Math.round(12 * k); }); };
      ensure(opt.legend, 'textStyle');
      ensure(opt.xAxis, 'axisLabel'); ensure(opt.yAxis, 'axisLabel');
      if (opt.tooltip) opt.tooltip.textStyle = Object.assign({}, opt.tooltip.textStyle, { fontSize: Math.round(12 * k) });
    }
    fitAxes(opt, ctx);
    const pos = ctx.o.legendPos || 'top';
    const lg = opt.legend;
    if (pos !== 'top' && lg && !Array.isArray(lg) && lg.show !== false && lg.orient !== 'vertical') {
      const g = opt.grid && !Array.isArray(opt.grid) ? opt.grid : null;
      if (pos === 'bottom') {
        Object.assign(lg, { top: 'auto', bottom: 0, left: 'center' });
        if (g) { if (g.top >= 30) g.top = 18; g.bottom = (g.bottom || 0) + Math.round(26 * k); }
      } else if (pos === 'right') {
        Object.assign(lg, { orient: 'vertical', top: 'middle', left: 'auto', right: 4 });
        if (g) { if (g.top >= 30) g.top = 18; g.right = (g.right || 0) + Math.round(110 * k); }
      }
    }
  }

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

  /* 동작 필터의 원천 강조: conds([{f, dp, keys}])에 맞는 결과 행 번호 집합 (판단할 수 없으면 null) */
  CH.focusRows = function (out, conds) {
    const ctx = out && out.ctx;
    if (!ctx || !ctx.res || !ctx.res.rows || !conds || !conds.length) return null;
    const dims = ctx.res.dims || ctx.sp.dims || [];
    const idx = conds.map((c) => dims.findIndex((p) => p && p.f === c.f && (p.dp || null) === (c.dp || null)));
    if (idx.some((i) => i < 0)) return null;
    const set = new Set();
    ctx.res.rows.forEach((r, ri) => {
      if (conds.every((c, k) => c.keys.some((key) => r.d[idx[k]] === key || String(r.d[idx[k]]) === String(key)))) set.add(ri);
    });
    return set;
  };
  /* 선택된 마크만 진하게, 나머지는 흐리게 (막대·파이·산점도·히트맵 등 항목 단위 마크) */
  CH.applyFocus = function (out, conds) {
    const set = CH.focusRows(out, conds);
    if (!set || !out.option) return false;
    [].concat(out.option.series || []).forEach((s) => {
      if (!s || !Array.isArray(s.data) || s.type === 'line') return;
      s.data = s.data.map((d) => {
        if (!d || typeof d !== 'object' || Array.isArray(d) || d._r == null || set.has(d._r)) return d;
        return Object.assign({}, d, { itemStyle: Object.assign({}, d.itemStyle, { opacity: 0.28 }), label: Object.assign({}, d.label, { opacity: 0.45 }) });
      });
    });
    return true;
  };
})();
