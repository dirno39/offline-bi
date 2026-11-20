/* Offline BI - 워크시트 화면: 데이터 패널, 선반, 마크, 표현 방식, 드래그 앤 드롭 */
(function () {
  'use strict';
  const BI = window.BI, App = BI.App, Q = BI.Query, D = BI.Data, CH = BI.Charts;

  const TYPE_ICON = {
    string: '<span class="fi t-s">Abc</span>',
    number: '<span class="fi t-n">#</span>',
    date: '<span class="fi t-d"><svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="12" height="11" rx="1"/><path d="M2 6.5h12M5 1.5v3M11 1.5v3"/></svg></span>',
    bool: '<span class="fi t-b">T|F</span>',
  };
  App.TYPE_ICON = TYPE_ICON;
  const SHELF_NAMES = { columns: '열', rows: '행', color: '색상', size: '크기', label: '레이블', detail: '세부정보', tooltip: '툴팁', filters: '필터' };
  const MULTI = { columns: 1, rows: 1, detail: 1, tooltip: 1 };

  App.currentDs = function () {
    const s = App.activeSheet();
    if (s) return App.ds(s.dsId);
    if (App.state.active.type === 'datasource') return App.ds(App.state.active.id) || App.state.datasources[0];
    return App.state.datasources[0];
  };

  /* ---------- 필 생성 ---------- */
  App.makePill = function (f) {
    const p = { id: BI.uid('p'), f: f.id, agg: null };
    if (f.aggCalc) { p.agg = 'AGG'; return p; }
    if (f.role === 'measure') p.agg = f.id === '__count' ? 'SUM' : f.type === 'number' ? f.defAgg || 'SUM' : 'COUNTD';
    else if (f.type === 'date') p.dp = 'year';
    return p;
  };
  const getPill = (sh, shelf, idx) => (MULTI[shelf] ? sh.shelves[shelf][idx] : sh.shelves[shelf]);
  const takePill = (sh, shelf, idx) => {
    if (MULTI[shelf]) return sh.shelves[shelf].splice(idx, 1)[0];
    const p = sh.shelves[shelf];
    sh.shelves[shelf] = null;
    return p;
  };
  const putPill = (sh, shelf, p, idx) => {
    if (MULTI[shelf]) {
      const arr = sh.shelves[shelf];
      if (idx == null || idx > arr.length) idx = arr.length;
      arr.splice(idx, 0, p);
    } else sh.shelves[shelf] = p;
  };

  App.autoAdd = function (sh, f) {
    App.mutate(() => {
      const sc = sh.shelves;
      const p = App.makePill(f);
      const hasM = (a) => a.some(Q.isMeasure), hasD = (a) => a.some((x) => !Q.isMeasure(x));
      if (p.agg) {
        if (hasM(sc.rows)) sc.rows.push(p);
        else if (hasM(sc.columns)) sc.columns.push(p);
        else if (hasD(sc.rows) && !hasD(sc.columns)) sc.columns.push(p);
        else sc.rows.push(p);
      } else if (f.type === 'date') {
        if (hasM(sc.columns)) sc.rows.push(p);
        else sc.columns.push(p);
      } else {
        if (hasM(sc.rows) && !hasM(sc.columns)) sc.columns.push(p);
        else sc.rows.push(p);
      }
    });
  };

  /* ---------- 레이아웃 ---------- */
  App.renderSheetMode = function (opts) {
    const sh = App.activeSheet();
    const main = BI.$('#main');
    if (!BI.$('.sheet-mode', main)) {
      main.innerHTML =
        '<div class="sheet-mode">' +
        '<aside class="pane data-pane" id="dataPane"></aside>' +
        '<aside class="pane cards-pane" id="cardsPane"></aside>' +
        '<section class="work">' +
        '<div class="shelves">' +
        '<div class="shelf-row"><label><svg viewBox="0 0 16 16" width="12" height="12"><path d="M2 3h3v10H2zM6.5 3h3v10h-3zM11 3h3v10h-3z" fill="currentColor"/></svg> 열</label><div class="shelf multi" data-shelf="columns"></div></div>' +
        '<div class="shelf-row"><label><svg viewBox="0 0 16 16" width="12" height="12"><path d="M3 2h10v3H3zM3 6.5h10v3H3zM3 11h10v3H3z" fill="currentColor"/></svg> 행</label><div class="shelf multi" data-shelf="rows"></div></div>' +
        '</div>' +
        '<div class="view-wrap"><div class="view-title" id="viewTitle"></div>' +
        '<div class="view" id="view" data-drop="view"><div class="chart-host"></div><div class="html-host"></div><div class="empty-host"></div></div>' +
        '<div class="statusbar" id="statusBar"></div></div>' +
        '</section>' +
        '<aside class="pane right-pane" id="rightPane"></aside>' +
        '</div>';
      bindSheetEvents(BI.$('.sheet-mode', main));
    }
    renderDataPane(sh);
    renderCards(sh);
    renderShelves(sh);
    App.renderSheetView(sh);
    renderRight(sh);
  };

  /* ---------- 데이터 패널 ---------- */
  function renderDataPane(sh) {
    const pane = BI.$('#dataPane');
    const ds = App.ds(sh.dsId);
    const q = (App.ui.fieldSearch || '').toLowerCase();
    let h = '<div class="pane-hd">데이터 <button class="ibtn" data-cmd="addData" title="데이터 추가">' + BI.ICON.plus + '</button></div>';
    h += '<div class="ds-sel"><select id="dsSelect">' + App.state.datasources.map((d) => '<option value="' + d.id + '"' + (d.id === sh.dsId ? ' selected' : '') + '>' + BI.esc(d.name) + '</option>').join('') + (App.state.datasources.length ? '' : '<option>(데이터 없음)</option>') + '</select></div>';
    if (!ds) {
      h += '<div class="pane-empty">데이터 원본을 추가하세요.<br><br><button class="btn primary" data-cmd="addData">파일 열기</button><br><br><button class="btn" data-cmd="sample">샘플 데이터</button></div>';
      pane.innerHTML = h;
      return;
    }
    h += '<div class="search"><input id="fieldSearch" placeholder="필드 검색" value="' + BI.esc(App.ui.fieldSearch || '') + '"></div>';
    const li = (f) => {
      if (q && !f.name.toLowerCase().includes(q)) return '';
      return '<li class="field ' + f.role + (f.error ? ' err' : '') + '" draggable="true" data-fid="' + f.id + '" title="' + BI.esc(f.name + (f.calc ? '\n= ' + f.calc : '') + (f.error ? '\n오류: ' + f.error : '')) + '">' + (TYPE_ICON[f.type] || TYPE_ICON.string) + '<span class="fn">' + BI.esc(f.name) + '</span>' + (f.calc ? '<span class="fc" title="계산된 필드">=</span>' : '') + '<span class="fm">' + BI.ICON.chev + '</span></li>';
    };
    const dims = ds.fields.filter((f) => f.role === 'dimension');
    const meas = ds.fields.filter((f) => f.role === 'measure');
    h += '<div class="flist-wrap">';
    h += '<div class="sec-hd">차원 <span class="cnt">' + dims.length + '</span><button class="ibtn sm" data-cmd="calc" title="계산된 필드 만들기">=+</button></div>';
    h += '<ul class="field-list" data-role="dimension">' + dims.map(li).join('') + '</ul>';
    h += '<div class="sec-hd">측정값 <span class="cnt">' + meas.length + '</span></div>';
    h += '<ul class="field-list" data-role="measure">' + meas.map(li).join('') + li(D.COUNT_FIELD) + '</ul>';
    h += '</div>';
    h += '<div class="pane-ft">' + ds.rows.length.toLocaleString() + '행 · ' + ds.fields.length + '개 필드</div>';
    pane.innerHTML = h;
  }

  /* ---------- 필 HTML ---------- */
  const pico = (d) => '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const PILL_ICON = {
    color: pico('<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5v11A5.5 5.5 0 0 0 8 2.5z" fill="currentColor"/>'),
    size: pico('<circle cx="5" cy="10.5" r="2"/><circle cx="10.5" cy="7" r="3.8"/>'),
    label: pico('<path d="M3.5 4h9M8 4v9"/>'),
    detail: '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true"><circle cx="4" cy="4" r="1.4"/><circle cx="12" cy="4" r="1.4"/><circle cx="4" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="8" cy="8" r="1.4"/></svg>',
    tooltip: pico('<path d="M2.5 3.5h11v7.5H7l-3 2.5v-2.5H2.5z"/>'),
  };
  function pillHtml(p, shelf, idx, ds) {
    const f = D.fieldById(ds, p.f);
    let cls = p.agg ? 'mea' : Q.isTimeline(p, ds) ? 'dim cont' : 'dim';
    if (!f) cls += ' bad';
    const sortIco = p.sort === 'asc' ? '↑' : p.sort === 'desc' ? '↓' : p.sort === 'mdesc' ? '⇣' : p.sort === 'masc' ? '⇡' : p.sort === 'manual' ? '≡' : p.sort === 'field' ? (p.sortField && p.sortField.dir === 'asc' ? '⇡' : '⇣') : '';
    const ico = PILL_ICON[shelf] || '';
    return '<div class="pill ' + cls + '" draggable="true" data-shelf="' + shelf + '" data-idx="' + idx + '" title="' + BI.esc(Q.pillLabel(p, ds)) + '">' +
      (ico ? '<span class="pi">' + ico + '</span>' : '') + '<span class="pt">' + BI.esc(Q.pillLabel(p, ds)) + '</span>' + (sortIco ? '<span class="ps">' + sortIco + '</span>' : '') + '<span class="pc">' + BI.ICON.chev + '</span></div>';
  }
  function filterPillHtml(flt, ds) {
    const f = D.fieldById(ds, flt.f);
    let nm = f ? f.name : '(삭제된 필드)';
    if (flt.dp && f && f.type === 'date' && flt.type === 'list') nm = Q.pillLabel({ f: flt.f, dp: flt.dp }, ds);
    let desc = '';
    if (flt.type === 'list') desc = flt.values == null ? '전체' : (flt.exclude ? '제외 ' : '') + flt.values.length + '개';
    else if (flt.type === 'range') desc = (flt.min != null && flt.min !== '' ? BI.compact(+flt.min) : '…') + ' ~ ' + (flt.max != null && flt.max !== '' ? BI.compact(+flt.max) : '…');
    else if (flt.type === 'date') desc = flt.rel ? Q.relLabel(flt.rel) : (flt.from ? BI.fmtDate(flt.from) : '…') + ' ~ ' + (flt.to ? BI.fmtDate(flt.to) : '…');
    else if (flt.type === 'top') desc = (flt.dir === 'bottom' ? '하위 ' : '상위 ') + flt.n;
    return '<div class="pill flt' + (flt.global ? ' global' : '') + (f ? '' : ' bad') + '" draggable="true" data-shelf="filters" data-flt="' + flt.id + '" title="' + BI.esc(nm + ': ' + desc + (flt.global ? '\n(모든 시트에 적용)' : '')) + '">' +
      (flt.global ? '<span class="pi">' + BI.ICON.globe + '</span>' : '') + '<span class="pt">' + BI.esc(nm) + '</span><span class="pd">' + BI.esc(desc) + '</span><span class="pc">' + BI.ICON.chev + '</span></div>';
  }

  /* ---------- 카드 (필터 / 마크 / 서식) ---------- */
  function renderCards(sh) {
    const pane = BI.$('#cardsPane');
    const ds = App.ds(sh.dsId);
    const flts = App.effectiveFilters(sh);
    let h = '<div class="card"><div class="card-hd">필터</div><div class="shelf vert" data-shelf="filters">' + (ds ? flts.map((f) => filterPillHtml(f, ds)).join('') : '') + '</div></div>';
    h += '<div class="card"><div class="card-hd">마크</div>';
    h += '<select class="sel full" id="markType">' + CH.TYPES.map((t) => '<option value="' + t.id + '"' + (sh.chartType === t.id ? ' selected' : '') + '>' + BI.esc(t.name) + '</option>').join('') + '</select>';
    const enc = [
      ['color', '<svg viewBox="0 0 16 16" width="14" height="14"><circle cx="5" cy="6" r="3" fill="#3563e9"/><circle cx="11" cy="6" r="3" fill="#eb6834"/><circle cx="8" cy="11" r="3" fill="#1baf7a"/></svg>'],
      ['size', '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="5" cy="10" r="2"/><circle cx="10.5" cy="7.5" r="4.5"/></svg>'],
      ['label', '<svg viewBox="0 0 16 16" width="14" height="14"><text x="3" y="13" font-size="12" font-weight="bold" fill="currentColor">T</text></svg>'],
      ['detail', '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><circle cx="4" cy="4" r="1.5"/><circle cx="12" cy="4" r="1.5"/><circle cx="4" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="8" cy="8" r="1.5"/></svg>'],
      ['tooltip', '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 3h12v8H7l-3 3v-3H2z"/></svg>'],
    ];
    h += '<div class="marks">';
    enc.forEach(([k, ico]) => {
      const v = sh.shelves[k];
      const pills = MULTI[k] ? v.map((p, i) => pillHtml(p, k, i, ds)).join('') : v ? pillHtml(v, k, 0, ds) : '';
      h += '<div class="mk-row"><div class="mk-lbl">' + ico + '<span>' + SHELF_NAMES[k] + '</span></div><div class="shelf mk' + (MULTI[k] ? ' multi' : ' single') + '" data-shelf="' + k + '">' + pills + '</div></div>';
    });
    h += '</div></div>';
    // 서식
    const o = sh.options;
    const type = sh.chartType === 'auto' && BI.$('#view') && BI.$('#view')._out ? BI.$('#view')._out.type : sh.chartType;
    const chk = (k, label) => '<label class="chk"><input type="checkbox" data-opt="' + k + '"' + (o[k] ? ' checked' : '') + '> ' + label + '</label>';
    h += '<div class="card"><div class="card-hd">서식</div><div class="opts">';
    h += chk('labels', '마크 레이블 표시') + chk('legend', '범례 표시') + chk('showTitle', '제목 표시');
    if (['table', 'hltable'].includes(type)) h += chk('totals', '총계 표시');
    if (['line', 'area', 'stackarea', 'dualline'].includes(type)) h += chk('smooth', '부드러운 선');
    if (['scatter', 'bubble'].includes(type)) h += chk('trend', '추세선 (선형)');
    if (['bar', 'hbar', 'line', 'area', 'groupbar', 'stackbar', 'stackhbar', 'combo', 'dualline'].includes(type)) {
      h += chk('refLine', '참조선');
      if (o.refLine) h += '<div class="opt-row"><span>참조선 종류</span><select data-opt="refKind">' + [['avg', '평균'], ['median', '중앙값'], ['const', '상수 (목표값)']].map(([k, n]) => '<option value="' + k + '"' + ((o.refKind || 'avg') === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
        (o.refKind === 'const' ? '<div class="opt-row"><span>값</span><input type="number" data-opt="refConst" value="' + (o.refConst ?? '') + '"></div><div class="opt-row"><span>이름</span><input data-opt="refName" value="' + BI.esc(o.refName || '') + '" placeholder="목표"></div>' : '');
    }
    if (['bar', 'hbar', 'line', 'area', 'groupbar', 'stackbar', 'stackhbar', 'stackarea'].includes(type)) h += '<label class="chk"><input type="checkbox" data-opt="measurePanels"' + (o.measurePanels !== false ? ' checked' : '') + '> 측정값별 축 나누기 (측정값이 여럿일 때)</label>';
    if (type === 'kpi') h += '<label class="chk"><input type="checkbox" data-opt="kpiLatest"' + (o.kpiLatest !== false ? ' checked' : '') + '> 마지막 기간 값 표시</label>';
    const fs = String(o.fontScale || 1);
    h += '<div class="opt-row"><span>글자 크기</span><div class="seg xs" role="group" aria-label="글자 크기">' + [['0.85', '작게', 11], ['1', '보통', 12.5], ['1.2', '크게', 14], ['1.45', '아주 크게', 16]].map(([v, n, px]) => '<button type="button" data-optset="fontScale" data-v="' + v + '" class="' + (fs === v ? 'on' : '') + '" title="' + n + '" style="font-size:' + px + 'px">가</button>').join('') + '</div></div>';
    if (o.legend !== false) h += '<div class="opt-row"><span>범례 위치</span><div class="seg xs" role="group" aria-label="범례 위치">' + [['top', '위'], ['right', '오른쪽'], ['bottom', '아래']].map(([v, n]) => '<button type="button" data-optset="legendPos" data-v="' + v + '" class="' + ((o.legendPos || 'top') === v ? 'on' : '') + '">' + n + '</button>').join('') + '</div></div>';
    // 텍스트 위치
    const segOpt = (key, cur, items) => '<div class="seg xs" role="group">' + items.map(([v, n]) => '<button type="button" data-optset="' + key + '" data-v="' + v + '" class="' + (cur === v ? 'on' : '') + '">' + n + '</button>').join('') + '</div>';
    const num = (key, title) => '<input type="number" class="nudge" data-opt="' + key + '" value="' + (+o[key] || 0) + '" step="2" min="-200" max="200" title="' + title + '">';
    h += '<div class="opt-sub">텍스트 위치</div>';
    if (o.showTitle !== false) h += '<div class="opt-row"><span>제목 정렬</span>' + segOpt('titleAlign', o.titleAlign || 'left', [['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']]) + '</div>';
    if (!['table', 'hltable', 'kpi', 'gauge', 'heatmap', 'calendar', 'sankey', 'boxplot', 'histogram', 'radar', 'treemap', 'sunburst'].includes(type)) {
      h += '<div class="opt-row"><span>레이블 위치</span>' + segOpt('labelPos', o.labelPos || 'auto', [['auto', '자동'], ['inside', '안쪽'], ['outside', '바깥쪽']]) + '</div>';
      h += '<div class="opt-row nr"><span>레이블 이동 (px)</span><span class="nudges">좌우' + num('labelDx', '가로 이동(px): + 오른쪽') + '상하' + num('labelDy', '세로 이동(px): + 아래') + '</span></div>';
    }
    if (type === 'donut') {
      h += '<label class="chk"><input type="checkbox" data-opt="donutCenter"' + (o.donutCenter !== false ? ' checked' : '') + '> 도넛 가운데 합계 표시</label>';
      if (o.donutCenter !== false) h += '<div class="opt-row nr"><span>가운데 글자 이동 (px)</span><span class="nudges">좌우' + num('centerDx', '가로 이동(px)') + '상하' + num('centerDy', '세로 이동(px): + 아래') + '</span></div>';
    }
    if (!['table', 'hltable', 'kpi'].includes(type)) h += '<div class="opt-hint">차트의 레이블은 마우스로 끌어 옮길 수도 있어요 (화면을 다시 그리면 원래 자리로).</div>';
    h += '<div class="opt-sub">값 · 색상</div>';
    h += '<div class="opt-row"><span>숫자 형식</span><select data-opt="numFmt">' + BI.NUM_FORMATS.map(([k, n]) => '<option value="' + k + '"' + (o.numFmt === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>';
    h += '<div class="opt-row"><span>색상 팔레트</span><select data-opt="palette">' + Object.keys(BI.PALETTES).map((k) => '<option value="' + k + '"' + (o.palette === k ? ' selected' : '') + '>' + BI.PALETTE_NAMES[k] + '</option>').join('') + '</select></div>';
    h += '<div class="opt-row"><span>연속 색상</span><select data-opt="seq">' + Object.keys(BI.SEQ).map((k) => '<option value="' + k + '"' + (o.seq === k ? ' selected' : '') + '>' + (k === 'diverge' && BI.koreanColors() ? '발산(파랑-빨강, 한국식)' : BI.SEQ_NAMES[k]) + '</option>').join('') + '</select></div>';
    if (type === 'histogram') h += '<div class="opt-row"><span>구간 수</span><input type="number" min="2" max="200" data-opt="bins" value="' + (o.bins || '') + '" placeholder="자동"></div><div class="opt-row"><span>구간 크기</span><input type="number" min="0" data-opt="binSize" value="' + (o.binSize || '') + '" placeholder="자동 (예: 10000000)"></div>';
    if (type === 'waterfall') h += '<div class="opt-row"><span>합계 막대 이름</span><input data-opt="wfTotalName" value="' + BI.esc(o.wfTotalName || '') + '" placeholder="합계"></div>';
    if (type === 'gauge') h += '<div class="opt-row"><span>최대값</span><input type="number" data-opt="gaugeMax" value="' + (o.gaugeMax || '') + '" placeholder="자동"></div>';
    h += '</div></div>';
    pane.innerHTML = h;
  }

  function renderShelves(sh) {
    const ds = App.ds(sh.dsId);
    ['columns', 'rows'].forEach((k) => {
      const el = BI.$('.shelf[data-shelf=' + k + ']');
      el.innerHTML = sh.shelves[k].map((p, i) => pillHtml(p, k, i, ds)).join('') || '<span class="ph">' + (k === 'columns' ? '열' : '행') + '에 필드를 놓으세요</span>';
    });
  }

  /* ---------- 뷰 ---------- */
  App.renderSheetView = function (sh) {
    sh = sh || App.activeSheet();
    if (!sh) return;
    const view = BI.$('#view');
    if (!view) return;
    const t = BI.$('#viewTitle');
    t.style.display = sh.options.showTitle === false ? 'none' : '';
    t.style.setProperty('--fs', +sh.options.fontScale || 1);
    t.style.textAlign = sh.options.titleAlign || 'left';
    t.innerHTML = '<span class="vt-text" title="더블클릭하여 제목 편집">' + BI.esc(sh.title || sh.name) + '</span>';
    const out = App.renderChartInto(view, sh, {
      onSelect: (sel, ev) => sheetSelectMenu(sh, sel, ev),
      emptyHtml: '<div class="drop-guide"><svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="#9aa7b4" stroke-width="2"><rect x="8" y="10" width="48" height="40" rx="3" stroke-dasharray="5 4"/><path d="M20 40V30M30 40V22M40 40V27"/></svg><p><b>필드를 여기로 끌어다 놓으세요</b></p><p class="muted">왼쪽 데이터 패널의 필드를 <b>열</b> / <b>행</b> 선반이나 이 영역으로 드래그하거나, 필드를 더블클릭하세요.</p></div>',
    });
    const sb = BI.$('#statusBar');
    if (out && sb) {
      const marks = out.ctx && out.ctx.res ? out.ctx.res.rows.length : 0;
      const dsr = App.ds(sh.dsId);
      sb.innerHTML = '<span>' + (out.rows ? out.rows.length.toLocaleString() : 0) + ' / ' + (dsr ? dsr.rows.length.toLocaleString() : 0) + '행</span><span>' + marks.toLocaleString() + '개 마크</span>' + (out.type ? '<span>' + BI.esc((CH.byId[out.type] || {}).name || '') + (sh.chartType === 'auto' ? ' (자동)' : '') + '</span>' : '') + (out.ctx && out.ctx.nullExcluded ? '<span class="warn-txt" title="날짜가 비어 있는 행은 축에 그리지 않았어요. 필터의 Null 옵션으로 조정할 수 있어요.">Null ' + out.ctx.nullExcluded.toLocaleString() + '건 제외</span>' : '') + '<span class="muted">' + Math.round(out.ms || 0) + 'ms</span><span class="grow"></span><span id="saveState" class="muted">' + BI.esc(App.ui.saveLabel || '') + '</span>';
    } else if (sb) sb.innerHTML = '';
    // 자동 모드일 때 서식 옵션이 달라질 수 있으므로 갱신
    if (sh.chartType === 'auto' && out && out.type !== App.ui.lastAutoType) {
      App.ui.lastAutoType = out.type;
      renderCards(sh);
    }
    return out;
  };

  function sheetSelectMenu(sh, sel, ev) {
    if (!sel || !sel.length || !ev) return;
    const x = ev.clientX || (ev.offsetX || 0), y = ev.clientY || (ev.offsetY || 0);
    const items = [{ header: sel.map((s) => s.label).join(', ').slice(0, 80) }];
    items.push({ text: '이 항목만 유지', onClick: () => keepExclude(sh, sel, false) });
    if (sel.length === 1) items.push({ text: '제외', onClick: () => keepExclude(sh, sel, true) });
    else items.push({ text: '제외', sub: sel.map((s) => ({ text: s.label, onClick: () => keepExclude(sh, [s], true) })) });
    BI.menu(x, y, items);
  }
  function keepExclude(sh, sel, exclude) {
    App.mutate(() => {
      sel.forEach((s) => {
        let f = sh.filters.find((x) => x.type === 'list' && x.f === s.f && (x.dp || null) === (s.dp || null));
        if (exclude) {
          if (f && f.exclude && f.values) f.values.push(s.key);
          else if (f && !f.exclude && f.values) f.values = f.values.filter((k) => k !== s.key);
          else sh.filters.push({ id: BI.uid('fl'), f: s.f, dp: s.dp, type: 'list', values: [s.key], exclude: true, card: false });
        } else {
          if (f) { f.values = [s.key]; f.exclude = false; }
          else sh.filters.push({ id: BI.uid('fl'), f: s.f, dp: s.dp, type: 'list', values: [s.key], exclude: false, card: false });
        }
      });
    });
  }

  /* ---------- 오른쪽 패널 (표현 방식 + 필터 카드) ---------- */
  function renderRight(sh) {
    const pane = BI.$('#rightPane');
    const ds = App.ds(sh.dsId);
    const cards = App.effectiveFilters(sh).filter((f) => f.card);
    if (!App.ui.showMe && !cards.length) { pane.style.display = 'none'; return; }
    pane.style.display = '';
    let h = '';
    if (App.ui.showMe) {
      const sp = ds ? CH.spec(sh, ds) : null;
      const out = BI.$('#view') && BI.$('#view')._out;
      const cur = sh.chartType;
      h += '<div class="card showme"><div class="card-hd">표현 방식 <button class="ibtn sm" data-cmd="showMe" title="닫기">' + BI.ICON.x + '</button></div><div class="sm-grid">';
      CH.TYPES.forEach((t) => {
        const fit = sp ? CH.fits(t.id, sp) : false;
        const on = cur === t.id || (cur === 'auto' && t.id === 'auto');
        const autoPicked = cur === 'auto' && out && out.type === t.id;
        h += '<button class="sm-btn' + (fit ? ' fit' : '') + (on ? ' on' : '') + (autoPicked ? ' auto-picked' : '') + '" data-ctype="' + t.id + '" title="' + BI.esc(t.name + '\n' + t.hint) + '">' + t.icon + '<span>' + BI.esc(t.name) + '</span></button>';
      });
      const def = CH.byId[cur] || CH.byId.auto;
      h += '</div><div class="sm-hint"><b>' + BI.esc(def.name) + '</b><br>' + BI.esc(def.hint) + '</div></div>';
    }
    h += '<div id="qfCards"></div>';
    pane.innerHTML = h;
    if (cards.length && ds) App.renderFilterCards(BI.$('#qfCards', pane), cards, ds, () => { App.renderSheetView(sh); renderCards(sh); });
  }

  /* ---------- 빠른 필터 카드 (시트/대시보드 공용) ---------- */
  App.findFilter = function (id) {
    for (const s of App.state.sheets) { const f = s.filters.find((x) => x.id === id); if (f) return { f, sheet: s }; }
    const g = App.state.globalFilters.find((x) => x.id === id);
    return g ? { f: g, sheet: null } : null;
  };
  App.lightCommit = function (fn, after) {
    const before = App.snap();
    fn();
    App.pushUndo(before);
    App.renderToolbar();
    after && after();
    App.autosave();
  };

  App.renderFilterCards = function (box, filters, ds, onChange) {
    box.innerHTML = '';
    filters.forEach((flt) => {
      const f = D.fieldById(ds, flt.f);
      if (!f) return;
      const nm = flt.type === 'list' && flt.dp ? Q.pillLabel({ f: flt.f, dp: flt.dp }, ds) : f.name;
      const card = BI.h('<div class="qf" data-flt="' + flt.id + '"><div class="qf-hd"><span>' + BI.esc(nm) + '</span>' + (flt.global ? '<span class="muted" title="모든 시트에 적용">' + BI.ICON.globe + '</span>' : '') + '<button class="ibtn sm qf-menu" title="필터 메뉴">' + BI.ICON.chev + '</button></div><div class="qf-bd"></div></div>');
      const bd = BI.$('.qf-bd', card);
      BI.$('.qf-menu', card).onclick = (e) => {
        const r = e.target.getBoundingClientRect();
        BI.menu(r.left, r.bottom, [
          { text: '필터 편집…', onClick: () => App.editFilter(App.activeSheet() || App.sheetForDs(ds.id), flt) },
          { text: '필터 초기화', onClick: () => App.mutate(() => resetFilter(flt)) },
          { text: '카드 숨기기', onClick: () => App.mutate(() => { flt.card = false; }) },
        ]);
      };
      const commit = (fn) => App.lightCommit(fn, onChange);
      if (flt.type === 'list') {
        const uv = Q.uniqueValues(ds, flt.f, flt.dp);
        const sk = (k) => typeof k + ':' + k;
        const isSel = (k) => { if (flt.values == null) return true; const has = flt.values.some((v) => sk(v) === sk(k)); return flt.exclude ? !has : has; };
        const many = uv.length > 8;
        bd.innerHTML = (many ? '<input class="qf-search" placeholder="검색">' : '') + '<div class="qf-list"></div>';
        const list = BI.$('.qf-list', bd);
        const draw = (q) => {
          const allOn = uv.every((u) => isSel(u.k));
          let hh = '<label class="chk all"><input type="checkbox" data-all="1"' + (allOn ? ' checked' : '') + '> (전체)</label>';
          let n = 0;
          uv.forEach((u, i) => {
            const lb = Q.keyLabel({ f: flt.f, dp: flt.dp }, ds, u.k);
            if (q && !lb.toLowerCase().includes(q)) return;
            if (n++ > 300) return;
            hh += '<label class="chk"><input type="checkbox" data-i="' + i + '"' + (isSel(u.k) ? ' checked' : '') + '> ' + BI.esc(lb) + '</label>';
          });
          list.innerHTML = hh;
        };
        draw('');
        if (many) BI.$('.qf-search', bd).oninput = (e) => draw(e.target.value.toLowerCase());
        list.onchange = (e) => {
          const cb = e.target;
          commit(() => {
            if (cb.dataset.all) { flt.values = cb.checked ? null : []; flt.exclude = false; }
            else {
              const k = uv[+cb.dataset.i].k;
              let sel = uv.filter((u) => isSel(u.k)).map((u) => u.k);
              if (cb.checked) sel.push(k); else sel = sel.filter((x) => sk(x) !== sk(k));
              flt.exclude = false;
              flt.values = sel.length === uv.length ? null : sel;
            }
          });
          draw(many ? BI.$('.qf-search', bd).value.toLowerCase() : '');
        };
      } else if (flt.type === 'range') {
        const [mn, mx] = Q.fieldRange(ds, flt.f);
        bd.innerHTML = '<div class="qf-range"><input type="number" data-k="min" placeholder="' + BI.esc(mn == null ? '' : BI.formatNumber(mn)) + '" value="' + (flt.min ?? '') + '"><span>~</span><input type="number" data-k="max" placeholder="' + BI.esc(mx == null ? '' : BI.formatNumber(mx)) + '" value="' + (flt.max ?? '') + '"></div>' +
          '<input type="range" class="qf-slider" min="' + (mn ?? 0) + '" max="' + (mx ?? 0) + '" step="any" value="' + (flt.min ?? mn ?? 0) + '" title="최소값">';
        const apply = () => commit(() => { const a = BI.$('[data-k=min]', bd).value, b = BI.$('[data-k=max]', bd).value; flt.min = a === '' ? null : +a; flt.max = b === '' ? null : +b; });
        BI.$$('input[type=number]', bd).forEach((i) => (i.onchange = apply));
        BI.$('.qf-slider', bd).oninput = BI.debounce((e) => { BI.$('[data-k=min]', bd).value = Math.round(+e.target.value * 100) / 100; apply(); }, 150);
      } else if (flt.type === 'date') {
        const rr = flt.rel ? Q.relativeRange(flt, ds) : null;
        bd.innerHTML = (flt.rel ? '<div class="muted">' + BI.esc(Q.relLabel(flt.rel)) + ' (데이터 마지막 날짜 기준)</div>' : '') + '<div class="qf-range"><input type="date" data-k="from" value="' + BI.dateInputValue(rr ? rr[0] : flt.from) + '"><span>~</span><input type="date" data-k="to" value="' + BI.dateInputValue(rr ? rr[1] : flt.to) + '"></div>';
        BI.$$('input', bd).forEach((i) => (i.onchange = () => commit(() => { flt.rel = null; flt.from = BI.parseDateInput(BI.$('[data-k=from]', bd).value); flt.to = BI.parseDateInput(BI.$('[data-k=to]', bd).value, true); })));
      } else if (flt.type === 'top') {
        bd.innerHTML = '<div class="qf-range"><select data-k="dir"><option value="top">상위</option><option value="bottom"' + (flt.dir === 'bottom' ? ' selected' : '') + '>하위</option></select><input type="number" min="1" data-k="n" value="' + (flt.n || 10) + '"></div>';
        BI.$$('input,select', bd).forEach((i) => (i.onchange = () => commit(() => { flt.n = +BI.$('[data-k=n]', bd).value || 10; flt.dir = BI.$('[data-k=dir]', bd).value; })));
      }
      box.appendChild(card);
    });
  };
  function resetFilter(flt) {
    if (flt.type === 'list') { flt.values = null; flt.exclude = false; }
    if (flt.type === 'range') { flt.min = null; flt.max = null; }
    if (flt.type === 'date') { flt.from = null; flt.to = null; flt.rel = null; }
  }
  App.sheetForDs = (dsId) => App.state.sheets.find((s) => s.dsId === dsId) || App.newSheet(dsId);

  /* ---------- 이벤트 ---------- */
  function bindSheetEvents(root) {
    root.addEventListener('change', (e) => {
      const sh = App.activeSheet();
      if (!sh) return;
      const t = e.target;
      if (t.id === 'dsSelect') {
        const id = t.value;
        const used = sh.shelves.columns.length + sh.shelves.rows.length + sh.filters.length + ['color', 'size', 'label'].filter((k) => sh.shelves[k]).length + sh.shelves.detail.length + sh.shelves.tooltip.length;
        // 같은 이름의 필드는 새 데이터 원본의 필드로 다시 연결, 없는 필드만 제거
        const from = App.ds(sh.dsId), to = App.ds(id);
        const remap = (q) => {
          if (!q) return null;
          if (q.f === '__count') return q;
          const of = from && D.fieldById(from, q.f);
          const nf = of && to && to.fields.find((x) => x.name === of.name);
          if (!nf) return null;
          q.f = nf.id;
          if (q.tcDims) q.tcDims = q.tcDims.map((k) => (k.split('@')[0] === of.id ? nf.id + k.slice(of.id.length) : k));
          if (q.sortField && q.sortField.f !== '__count') { const sf = from && D.fieldById(from, q.sortField.f); const nsf = sf && to.fields.find((x) => x.name === sf.name); if (nsf) q.sortField.f = nsf.id; else { delete q.sort; delete q.sortField; } }
          return q;
        };
        let lost = 0;
        const go = () => App.mutate(() => {
          const S = sh.shelves;
          ['columns', 'rows', 'detail', 'tooltip'].forEach((k) => { const a = S[k].map(remap); lost += a.filter((x) => !x).length; S[k] = a.filter(Boolean); });
          ['color', 'size', 'label'].forEach((k) => { if (S[k]) { const q = remap(S[k]); if (!q) lost++; S[k] = q; } });
          const fl = sh.filters.map(remap); lost += fl.filter((x) => !x).length; sh.filters = fl.filter(Boolean);
          sh.dsId = id;
        });
        const after = () => { go(); if (lost) BI.toast('새 데이터 원본에 같은 이름이 없는 필드 ' + lost + '개는 시트에서 뺐어요.', 'warn'); };
        if (used) BI.confirm('데이터 원본을 바꾸면 같은 이름의 필드는 새 원본의 필드로 다시 연결하고, 없는 필드는 시트에서 빼요. 계속할까요?', after);
        else after();
        if (used) t.value = sh.dsId;
        return;
      }
      if (t.id === 'markType') return App.mutate(() => { sh.chartType = t.value; });
      if (t.dataset.opt) {
        const k = t.dataset.opt;
        const v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? (t.value === '' ? '' : +t.value) : t.value;
        App.mutate(() => { sh.options[k] = v; });
      }
    });
    root.addEventListener('input', (e) => {
      if (e.target.id === 'fieldSearch') {
        App.ui.fieldSearch = e.target.value;
        const pos = e.target.selectionStart;
        renderDataPane(App.activeSheet());
        const inp = BI.$('#fieldSearch');
        inp.focus();
        inp.setSelectionRange(pos, pos);
      }
    });
    root.addEventListener('click', (e) => {
      const os = e.target.closest('[data-optset]');
      if (os) {
        const sh0 = App.activeSheet();
        const k = os.dataset.optset, v = os.dataset.v;
        if (sh0 && sh0.options[k] !== v) App.mutate(() => { sh0.options[k] = k === 'fontScale' ? +v : v; });
        return;
      }
      const sh = App.activeSheet();
      if (!sh) return;
      const ct = e.target.closest('[data-ctype]');
      if (ct) return App.mutate(() => { sh.chartType = ct.dataset.ctype; });
      const pill = e.target.closest('.pill');
      if (pill) {
        const r = pill.getBoundingClientRect();
        if (pill.dataset.flt) App.filterPillMenu(sh, pill.dataset.flt, r.left, r.bottom + 2);
        else App.pillMenu(sh, pill.dataset.shelf, +pill.dataset.idx, r.left, r.bottom + 2);
        return;
      }
      const fm = e.target.closest('.field .fm');
      if (fm) {
        const r = fm.getBoundingClientRect();
        App.fieldMenu(App.ds(sh.dsId), fm.closest('.field').dataset.fid, r.left, r.bottom);
      }
    });
    root.addEventListener('contextmenu', (e) => {
      const sh = App.activeSheet();
      if (!sh) return;
      const pill = e.target.closest('.pill');
      const fld = e.target.closest('.field');
      if (pill) {
        e.preventDefault();
        if (pill.dataset.flt) App.filterPillMenu(sh, pill.dataset.flt, e.clientX, e.clientY);
        else App.pillMenu(sh, pill.dataset.shelf, +pill.dataset.idx, e.clientX, e.clientY);
      } else if (fld) {
        e.preventDefault();
        App.fieldMenu(App.ds(sh.dsId), fld.dataset.fid, e.clientX, e.clientY);
      }
    });
    root.addEventListener('dblclick', (e) => {
      const sh = App.activeSheet();
      if (!sh) return;
      const fld = e.target.closest('.field');
      if (fld) {
        const f = D.fieldById(App.ds(sh.dsId), fld.dataset.fid);
        if (f) App.autoAdd(sh, f);
        return;
      }
      if (e.target.closest('#viewTitle')) BI.prompt('시트 제목', sh.title || sh.name, (v) => App.mutate(() => { sh.title = v; }));
    });
  }

  /* ---------- 필 메뉴 ---------- */
  App.pillMenu = function (sh, shelf, idx, x, y) {
    const p = getPill(sh, shelf, idx);
    if (!p) return;
    const ds = App.ds(sh.dsId);
    const f = D.fieldById(ds, p.f);
    const set = (fn) => () => App.mutate(() => fn(p));
    const items = [{ header: Q.pillLabel(p, ds) }];
    if (p.agg) {
      if (f && f.aggCalc) items.push({ text: '집계 (계산식에서 지정)', disabled: true });
      else items.push({ text: '측정값 집계', sub: Q.AGGS.map(([k, n]) => ({ text: n, checked: p.agg === k, onClick: set((q) => (q.agg = k)) })) });
      const curTc = p.tc === 'running' && p.tcRestart === 'year' ? 'ytd' : p.tc || '';
      items.push({ text: '빠른 테이블 계산', sub: Q.TC.map(([k, n]) => ({ text: n, checked: curTc === k, onClick: set((q) => App.setTableCalc(q, k)) })) });
      if (p.tc) {
        const sdims = sheetDims(sh, ds);
        const dir = p.tcDir || 'auto';
        items.push({ text: '다음을 사용하여 계산', sub: Q.TC_DIRS.map(([k, n]) => ({ text: n, checked: dir === k, onClick: set((q) => { q.tcDir = k; delete q.tcDims; }) }))
          .concat(sdims.length ? [{ sep: true }] : [], sdims.map((d) => ({ text: d.name + ' 기준', checked: dir === 'dims' && (p.tcDims || []).length === 1 && p.tcDims[0] === d.f, onClick: set((q) => { q.tcDir = 'dims'; q.tcDims = [d.f]; }) }))) });
        items.push({ text: '테이블 계산 편집…', onClick: () => App.editTableCalc(sh, p) });
      }
      items.push({ text: '숫자 형식', sub: [['', '시트 기본값']].concat(BI.NUM_FORMATS).map(([k, n]) => ({ text: n, checked: (p.fmt || '') === k, onClick: set((q) => (q.fmt = k || null)) })) });
      if (f && !f.virtual) items.push({ text: '입력 단위 (원본 값의 단위)', sub: [['', '필드 설정 따름'], ['1', '원 (배율 없음)'], ['1000', '천원'], ['1000000', '백만원'], ['100000000', '억원']].map(([k, n]) => ({ text: n, checked: String(p.unit || '') === k, onClick: set((q) => { if (k) q.unit = +k; else delete q.unit; }) })) });
      items.push({ text: '이름 바꾸기 (별칭)…', onClick: () => BI.prompt('표시 이름 (비우면 기본 이름)', p.alias || Q.pillLabel(Object.assign({}, p, { tc: null, alias: null }), ds), (v) => App.mutate(() => { if (v === Q.pillLabel(Object.assign({}, p, { tc: null, alias: null }), ds)) delete p.alias; else p.alias = v; })) });
      if (p.alias) items.push({ text: '별칭 지우기', onClick: set((q) => { delete q.alias; }) });
      if (f && !f.virtual && !f.aggCalc) items.push({ text: '차원으로 변환', onClick: set((q) => { q.agg = null; q.tc = null; q.dp = f.type === 'date' ? 'year' : null; }) });
    } else if (f) {
      if (f.type === 'date') {
        const cont = Q.DATE_PARTS.filter((d) => d[2]), disc = Q.DATE_PARTS.filter((d) => !d[2]);
        items.push({ text: '날짜 단위 (연속)', sub: cont.map(([k, n]) => ({ text: n, checked: p.dp === k, onClick: set((q) => (q.dp = k)) })) });
        items.push({ text: '날짜 부분 (불연속)', sub: disc.map(([k, n]) => ({ text: n, checked: p.dp === k, onClick: set((q) => (q.dp = k)) })) });
      }
      const ms = (sh.shelves.columns.concat(sh.shelves.rows).filter(Q.isMeasure));
      const clr = (q) => { delete q.sortBy; delete q.sortField; delete q.sortList; };
      items.push({ text: '정렬', sub: [
        { text: '정렬 안 함 (기본 순서)', checked: !p.sort, onClick: set((q) => { delete q.sort; clr(q); }) },
        { text: '오름차순 (가나다/작은값)', checked: p.sort === 'asc', onClick: set((q) => { clr(q); q.sort = 'asc'; }) },
        { text: '내림차순', checked: p.sort === 'desc', onClick: set((q) => { clr(q); q.sort = 'desc'; }) },
        { text: '측정값 기준 내림차순' + (ms[0] ? ' (' + Q.pillLabel(ms[0], ds) + ')' : ''), checked: p.sort === 'mdesc', onClick: set((q) => { clr(q); q.sort = 'mdesc'; }) },
        { text: '측정값 기준 오름차순', checked: p.sort === 'masc', onClick: set((q) => { clr(q); q.sort = 'masc'; }) },
        { sep: true },
        { text: '다른 필드 기준…' + (p.sort === 'field' && p.sortField ? ' (' + ((D.fieldById(ds, p.sortField.f) || {}).name || '') + ')' : ''), checked: p.sort === 'field', onClick: () => App.sortByFieldDialog(sh, p) },
        { text: '사용자 지정 순서…', checked: p.sort === 'manual', onClick: () => App.manualSortDialog(sh, p) },
      ] });
      items.push({ text: '측정값으로 변환', sub: [['COUNT', '개수'], ['COUNTD', '고유 개수']].concat(f.type === 'number' ? [['SUM', '합계'], ['AVG', '평균'], ['MIN', '최소값'], ['MAX', '최대값']] : f.type === 'date' ? [['MIN', '최소값(최초)'], ['MAX', '최대값(최근)']] : []).map(([k, n]) => ({ text: n, onClick: set((q) => { q.agg = k; q.dp = null; q.sort = null; }) })) });
    }
    items.push({ sep: true });
    if (shelf !== 'filters') items.push({ text: '필터…', onClick: () => App.editFilter(sh, null, { f: p.f, dp: p.dp, agg: p.agg }) });
    if (MULTI[shelf]) items.push({ text: '복제', onClick: () => App.mutate(() => sh.shelves[shelf].splice(idx + 1, 0, Object.assign(BI.clone(p), { id: BI.uid('p') }))) });
    items.push({ text: '제거', onClick: () => App.mutate(() => takePill(sh, shelf, idx)) });
    BI.menu(x, y, items);
  };

  App.filterPillMenu = function (sh, id, x, y) {
    const hit = App.findFilter(id);
    if (!hit) return;
    const flt = hit.f;
    BI.menu(x, y, [
      { text: '필터 편집…', onClick: () => App.editFilter(sh, flt) },
      { text: '필터 카드 표시', checked: !!flt.card, onClick: () => App.mutate(() => { flt.card = !flt.card; }) },
      { text: '모든 시트에 적용 (같은 데이터 원본)', checked: !!flt.global, onClick: () => App.mutate(() => toggleGlobal(sh, flt)) },
      { text: '필터 초기화', onClick: () => App.mutate(() => resetFilter(flt)) },
      { sep: true },
      { text: '제거', onClick: () => App.mutate(() => removeFilter(sh, id)) },
    ]);
  };
  function toggleGlobal(sh, flt) {
    if (flt.global) {
      App.state.globalFilters = App.state.globalFilters.filter((x) => x.id !== flt.id);
      flt.global = false;
      delete flt.dsId;
      sh.filters.push(flt);
    } else {
      sh.filters = sh.filters.filter((x) => x.id !== flt.id);
      flt.global = true;
      flt.dsId = sh.dsId;
      // 같은 필드의 다른 시트 필터 제거
      App.state.globalFilters.push(flt);
    }
  }
  function removeFilter(sh, id) {
    sh.filters = sh.filters.filter((x) => x.id !== id);
    App.state.globalFilters = App.state.globalFilters.filter((x) => x.id !== id);
  }

  /* 빠른 테이블 계산 지정 (ytd = 연도마다 다시 시작하는 누계) */
  App.setTableCalc = function (q, k) {
    q.tc = k || null;
    if (!k) { delete q.tcDir; delete q.tcDims; delete q.tcN; delete q.tcRestart; return; }
    if (k === 'ytd') { q.tc = 'running'; q.tcRestart = 'year'; }
    else if (k === 'running') delete q.tcRestart;
    if (!['movavg', 'diff', 'pctdiff'].includes(q.tc)) delete q.tcN;
  };
  /* 시트에 놓인 차원 필 목록 (계산 방향 선택용) */
  function sheetDims(sh, ds) {
    const S = sh.shelves, out = [], seen = new Set();
    S.columns.concat(S.rows, [S.color, S.size, S.label], S.detail || [], S.tooltip || []).forEach((q) => {
      const key = q && q.f + (q.dp ? '@' + q.dp : '');
      if (!q || q.agg || seen.has(key)) return;
      seen.add(key);
      out.push({ f: key, name: Q.pillLabel(q, ds) });
    });
    return out;
  }
  /* 테이블 계산 편집: 유형, 계산 방향(특정 차원), 기간 n, 연도별 다시 시작 */
  App.editTableCalc = function (sh, p) {
    const ds = App.ds(sh.dsId);
    const sdims = sheetDims(sh, ds);
    const cur = p.tc === 'running' && p.tcRestart === 'year' ? 'ytd' : p.tc || 'running';
    const dir = p.tcDir || 'auto';
    const body = BI.h('<div class="pd">' +
      '<div class="pd-grid"><label>계산 유형<select id="tcT">' + Q.TC.filter((t) => t[0]).map(([k, n]) => '<option value="' + k + '"' + (cur === k ? ' selected' : '') + '>' + BI.esc(n) + '</option>').join('') + '</select></label>' +
      '<label id="tcNL">기간 / n칸<input type="number" id="tcN" min="1" max="1000" value="' + (+p.tcN || '') + '" placeholder="기본"></label></div>' +
      '<div class="pd-row"><b>다음을 사용하여 계산</b></div><div class="pd-ops">' +
      Q.TC_DIRS.map(([k, n]) => '<label class="chk"><input type="radio" name="tcDir" value="' + k + '"' + (dir === k ? ' checked' : '') + '> ' + BI.esc(n) + (k === 'auto' ? ' <span class="muted">(열 차원 → 없으면 행 차원)</span>' : '') + '</label>').join('') +
      '<label class="chk"><input type="radio" name="tcDir" value="dims"' + (dir === 'dims' ? ' checked' : '') + '> 특정 차원</label></div>' +
      '<div class="pd-list" id="tcDims">' + (sdims.length ? sdims.map((d) => '<label class="chk"><input type="checkbox" value="' + BI.esc(d.f) + '"' + ((p.tcDims || []).includes(d.f) ? ' checked' : '') + '> ' + BI.esc(d.name) + '</label>').join('') : '<span class="muted">시트에 차원이 없어요</span>') + '</div>' +
      '<p class="muted">체크한 차원 방향으로 계산하고, 나머지 차원은 구간별로 따로 계산해요. 예) 열=월, 색상=연도에서 <b>연도</b>만 체크하면 같은 월끼리 전년과 비교해요.</p>' +
      '<label class="chk" id="tcRL"><input type="checkbox" id="tcR"' + (p.tcRestart === 'year' || cur === 'ytd' ? ' checked' : '') + '> 연도마다 다시 시작 (날짜 차원 기준)</label></div>');
    const sync = () => {
      const t = BI.$('#tcT', body).value;
      BI.$('#tcNL', body).style.display = ['movavg', 'diff', 'pctdiff'].includes(t) ? '' : 'none';
      BI.$('#tcNL', body).firstChild.textContent = t === 'movavg' ? '이동 평균 기간 (기본 3)' : 'n칸 전과 비교 (기본 1)';
      BI.$('#tcRL', body).style.display = ['running', 'ytd'].includes(t) ? '' : 'none';
      BI.$('#tcDims', body).style.opacity = BI.$('input[name=tcDir]:checked', body).value === 'dims' ? '1' : '.5';
    };
    body.addEventListener('change', sync);
    sync();
    BI.modal({
      title: '테이블 계산 - ' + Q.pillLabel(Object.assign({}, p, { tc: null }), ds), width: 480, body, enterSubmits: false,
      buttons: [{ text: '취소' }, { text: '확인', primary: true, onClick: () => {
        const t = BI.$('#tcT', body).value;
        const d = BI.$('input[name=tcDir]:checked', body).value;
        const dims = BI.$$('#tcDims input:checked', body).map((x) => x.value);
        if (d === 'dims' && !dims.length) { BI.toast('계산 방향으로 쓸 차원을 하나 이상 고르세요.', 'err'); return false; }
        const n = +BI.$('#tcN', body).value || 0;
        const restart = BI.$('#tcR', body).checked && ['running', 'ytd'].includes(t);
        App.mutate(() => {
          App.setTableCalc(p, restart ? 'ytd' : t === 'ytd' ? 'running' : t);
          if (d === 'auto') delete p.tcDir; else p.tcDir = d;
          if (d === 'dims') p.tcDims = dims; else delete p.tcDims;
          if (n && ['movavg', 'diff', 'pctdiff'].includes(p.tc)) p.tcN = n; else delete p.tcN;
        });
      } }],
    });
  };

  /* 다른 필드(측정값) 기준 정렬: 시트에 없는 필드도 기준으로 쓸 수 있음 */
  App.sortByFieldDialog = function (sh, p) {
    const ds = App.ds(sh.dsId);
    const meas = [D.COUNT_FIELD].concat(ds.fields.filter((x) => x.role === 'measure' || x.type === 'number' || x.aggCalc));
    const cur = p.sortField || { f: (meas[1] || meas[0]).id, agg: 'SUM', dir: 'desc' };
    const body = BI.h('<div class="pd"><div class="pd-grid">' +
      '<label>기준 필드<select id="sfF">' + meas.map((m) => '<option value="' + m.id + '"' + (m.id === cur.f ? ' selected' : '') + '>' + BI.esc(m.name) + '</option>').join('') + '</select></label>' +
      '<label>집계<select id="sfA">' + Q.AGGS.map(([k, n]) => '<option value="' + k + '"' + (cur.agg === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
      '<label>방향<select id="sfD"><option value="desc">내림차순 (큰 값 먼저)</option><option value="asc"' + (cur.dir === 'asc' ? ' selected' : '') + '>오름차순</option></select></label></div>' +
      '<p class="muted">' + BI.esc(Q.pillLabel(p, ds)) + ' 값을 선택한 필드의 집계값 순서로 정렬해요.</p></div>');
    BI.modal({ title: '정렬 - 다른 필드 기준', width: 460, body, buttons: [{ text: '취소' }, { text: '확인', primary: true, onClick: () => {
      const sf = { f: BI.$('#sfF', body).value, agg: BI.$('#sfA', body).value, dir: BI.$('#sfD', body).value };
      App.mutate(() => { delete p.sortBy; delete p.sortList; p.sort = 'field'; p.sortField = sf; });
    } }] });
  };
  /* 사용자 지정(수동) 순서: 위/아래 버튼 또는 끌어서 순서 지정 */
  App.manualSortDialog = function (sh, p) {
    const ds = App.ds(sh.dsId);
    const uv = Q.uniqueValues(ds, p.f, p.dp).map((u) => u.k);
    const sk = (k) => typeof k + ':' + k;
    let list = uv.slice();
    if (Array.isArray(p.sortList)) {
      const pos = new Map(p.sortList.map((k, i) => [sk(k), i]));
      list.sort((a, b) => (pos.has(sk(a)) ? pos.get(sk(a)) : 1e9) - (pos.has(sk(b)) ? pos.get(sk(b)) : 1e9));
    }
    if (list.length > 500) return BI.toast('값이 ' + list.length.toLocaleString() + '개라 사용자 지정 순서를 쓸 수 없어요 (500개 이하).', 'warn');
    const spaced = uv.filter((k) => typeof k === 'string' && k !== k.trim()).length;
    let cur = 0;
    const body = BI.h('<div class="pd"><p class="muted">항목을 고른 뒤 위/아래 버튼을 누르거나 끌어서 순서를 바꾸세요.' + (spaced ? ' <span class="warn-txt">앞뒤 공백이 있는 값 ' + spaced + '개가 있어요. 데이터 정리의 <b>값 정리 → 앞뒤 공백 제거</b>로 정리하는 것을 권장해요.</span>' : '') + '</p>' +
      '<div class="ms-wrap" style="display:flex;gap:8px"><div class="pd-list ms-list" id="msL" style="flex:1;max-height:340px;overflow:auto"></div>' +
      '<div style="display:flex;flex-direction:column;gap:6px"><button class="btn sm" data-mv="top">맨 위로</button><button class="btn sm" data-mv="-1">위로</button><button class="btn sm" data-mv="1">아래로</button><button class="btn sm" data-mv="bottom">맨 아래로</button><button class="btn sm" data-mv="reset">가나다순</button></div></div></div>');
    const L = BI.$('#msL', body);
    const draw = () => {
      L.innerHTML = list.map((k, i) => '<div class="ci ms-item' + (i === cur ? ' on' : '') + '" draggable="true" data-i="' + i + '" style="padding:4px 8px;cursor:grab;border-radius:6px;' + (i === cur ? 'background:#e3ebfd' : '') + '">' + BI.esc(Q.keyLabel(p, ds, k)) + '</div>').join('');
      const el = L.children[cur];
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    };
    const move = (to) => { to = Math.max(0, Math.min(list.length - 1, to)); const [x] = list.splice(cur, 1); list.splice(to, 0, x); cur = to; draw(); };
    L.onclick = (e) => { const it = e.target.closest('[data-i]'); if (it) { cur = +it.dataset.i; draw(); } };
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mv]');
      if (!b) return;
      const m = b.dataset.mv;
      if (m === 'reset') { list = uv.slice(); cur = 0; draw(); return; }
      move(m === 'top' ? 0 : m === 'bottom' ? list.length - 1 : cur + +m);
    });
    let dragI = null;
    L.addEventListener('dragstart', (e) => { const it = e.target.closest('[data-i]'); if (!it) return; dragI = +it.dataset.i; e.stopPropagation(); try { e.dataTransfer.setData('text/plain', 'ms'); } catch (x) { /* noop */ } });
    L.addEventListener('dragover', (e) => { if (dragI != null) { e.preventDefault(); e.stopPropagation(); } });
    L.addEventListener('drop', (e) => { const it = e.target.closest('[data-i]'); if (dragI == null || !it) return; e.preventDefault(); e.stopPropagation(); cur = dragI; move(+it.dataset.i); dragI = null; });
    draw();
    BI.modal({ title: '사용자 지정 순서 - ' + Q.pillLabel(p, ds), width: 460, body, enterSubmits: false, buttons: [{ text: '취소' }, { text: '확인', primary: true, onClick: () => {
      App.mutate(() => { delete p.sortBy; delete p.sortField; p.sort = 'manual'; p.sortList = list.slice(); });
    } }] });
  };

  /* ---------- 필터 편집 대화상자 ---------- */
  App.editFilter = function (sh, flt, init) {
    if (!sh) return;
    const ds = App.ds(sh.dsId);
    const f = D.fieldById(ds, flt ? flt.f : init.f);
    if (!f || f.virtual) return BI.toast('이 필드는 필터로 사용할 수 없습니다.');
    if (f.aggCalc) return BI.toast('집계 계산 필드는 필터로 쓸 수 없어요. 상위 N 필터의 기준으로는 쓸 수 있어요.', 'warn');
    const isDate = f.type === 'date', isNum = f.type === 'number';
    const modes = isDate ? ['date', 'list', 'top'] : isNum ? (f.role === 'measure' ? ['range', 'list', 'top'] : ['list', 'range', 'top']) : ['list', 'top'];
    const w = flt ? BI.clone(flt) : { id: BI.uid('fl'), f: f.id, type: isDate ? 'date' : isNum && (f.role === 'measure' || (init && init.agg)) ? 'range' : 'list', dp: isDate ? (init && init.dp) || 'year' : null, values: null, exclude: false, card: false, global: false };
    if (isDate && !w.dp) w.dp = 'year';
    const body = BI.h('<div class="flt-dlg"><div class="seg">' + modes.map((m) => '<button data-m="' + m + '">' + Q.FILTER_TYPES[m] + '</button>').join('') + '</div><div class="flt-panel"></div>' +
      '<div class="flt-foot"><label class="chk"><input type="checkbox" id="fCard"' + (w.card ? ' checked' : '') + '> 필터 카드 표시</label><label class="chk"><input type="checkbox" id="fGlobal"' + (w.global ? ' checked' : '') + '> 이 데이터 원본을 사용하는 모든 시트에 적용</label></div></div>');
    const panel = BI.$('.flt-panel', body);
    let mode = w.type;
    const sk = (k) => typeof k + ':' + k;
    let listState = null;
    const drawMode = () => {
      BI.$$('.seg button', body).forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
      if (mode === 'list') {
        const dpSel = isDate ? '<div class="opt-row"><span>날짜 부분</span><select id="fDp">' + Q.DATE_PARTS.map(([k, n]) => '<option value="' + k + '"' + (w.dp === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' : '';
        panel.innerHTML = dpSel + '<div class="lst-tools"><input id="fSearch" placeholder="검색"><button class="btn sm" id="fAll">전체 선택</button><button class="btn sm" id="fNone">선택 해제</button></div><div class="lst" id="fList"></div><label class="chk"><input type="checkbox" id="fEx"' + (w.exclude && w.type === 'list' ? ' checked' : '') + '> 선택한 항목 제외</label>';
        const uv = Q.uniqueValues(ds, f.id, isDate ? w.dp : null);
        const sel = new Set();
        if (w.type !== 'list' || w.values == null) uv.forEach((u) => sel.add(sk(u.k)));
        else w.values.forEach((v) => sel.add(sk(v)));
        listState = { uv, sel };
        const draw = () => {
          const q = BI.$('#fSearch', panel).value.toLowerCase();
          let h = '', n = 0;
          uv.forEach((u, i) => {
            const lb = Q.keyLabel({ f: f.id, dp: isDate ? w.dp : null }, ds, u.k);
            if (q && !lb.toLowerCase().includes(q)) return;
            if (n++ >= 1000) return;
            h += '<label class="chk"><input type="checkbox" data-i="' + i + '"' + (sel.has(sk(u.k)) ? ' checked' : '') + '> ' + BI.esc(lb) + ' <span class="cnt">' + u.n.toLocaleString() + '</span></label>';
          });
          if (n > 1000) h += '<div class="muted">… 외 ' + (n - 1000).toLocaleString() + '개 (검색으로 좁히세요)</div>';
          BI.$('#fList', panel).innerHTML = h || '<div class="muted">항목 없음</div>';
        };
        draw();
        BI.$('#fSearch', panel).oninput = draw;
        BI.$('#fList', panel).onchange = (e) => { const u = uv[+e.target.dataset.i]; if (e.target.checked) sel.add(sk(u.k)); else sel.delete(sk(u.k)); };
        const visible = () => { const q = BI.$('#fSearch', panel).value.toLowerCase(); return uv.filter((u) => !q || Q.keyLabel({ f: f.id, dp: isDate ? w.dp : null }, ds, u.k).toLowerCase().includes(q)); };
        BI.$('#fAll', panel).onclick = () => { visible().forEach((u) => sel.add(sk(u.k))); draw(); };
        BI.$('#fNone', panel).onclick = () => { visible().forEach((u) => sel.delete(sk(u.k))); draw(); };
        if (isDate) BI.$('#fDp', panel).onchange = (e) => { w.dp = e.target.value; w.values = null; drawMode(); };
      } else if (mode === 'range') {
        const [mn, mx] = Q.fieldRange(ds, f.id);
        panel.innerHTML = '<p class="muted">데이터 범위: ' + BI.formatNumber(mn) + ' ~ ' + BI.formatNumber(mx) + ' (행 단위 값 기준)</p><div class="qf-range big"><input type="number" id="fMin" placeholder="최소" value="' + (w.type === 'range' && w.min != null ? w.min : '') + '"><span>~</span><input type="number" id="fMax" placeholder="최대" value="' + (w.type === 'range' && w.max != null ? w.max : '') + '"></div><label class="chk"><input type="checkbox" id="fNull"' + (w.excludeNull ? ' checked' : '') + '> Null 값 제외</label>';
      } else if (mode === 'date') {
        let mn = null, mx = null, nn = 0;
        for (const r of ds.rows) { const v = r[f.id]; if (v == null) { nn++; continue; } if (mn == null || v < mn) mn = v; if (mx == null || v > mx) mx = v; }
        // 상대 기간: 저장은 규칙(최근 N일 등)으로, 계산은 매번 데이터의 마지막 날짜 기준
        const pre = [['all', '전체'], ['day:7', '최근 7일'], ['day:30', '최근 30일'], ['day:90', '최근 90일'], ['month:3', '최근 3개월'], ['month:12', '최근 12개월'], ['ytd', '올해 (YTD)'], ['qtd', '이번 분기'], ['mtd', '이번 달'], ['ly', '작년']];
        let rel = w.type === 'date' && w.rel ? Object.assign({}, w.rel) : null;
        const relTxt = () => (rel ? '<b>' + BI.esc(Q.relLabel(rel)) + '</b> — 데이터를 바꿔도 마지막 날짜 기준으로 다시 계산해요.' : '고정 기간');
        panel.innerHTML = '<p class="muted">데이터 기간: ' + BI.fmtDate(mn) + ' ~ ' + BI.fmtDate(mx) + (nn ? ' · Null ' + nn.toLocaleString() + '건' : '') + '<br>빠른 선택은 데이터의 마지막 날짜를 기준으로 계산합니다.</p><div class="presets">' + pre.map(([k, n]) => '<button class="btn sm" data-p="' + k + '">' + n + '</button>').join('') + '</div>' +
          '<div class="opt-row"><span>상대 기간</span><span id="fRel">' + relTxt() + '</span></div>' +
          '<div class="pd-grid"><label>최근<input type="number" id="fRelN" min="1" value="' + (rel && rel.n ? rel.n : '') + '" placeholder="N" style="width:70px"></label><label>단위<select id="fRelU">' + [['day', '일'], ['week', '주'], ['month', '개월'], ['year', '년']].map(([k, n]) => '<option value="' + k + '"' + (rel && rel.unit === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label></div>' +
          '<div class="qf-range big"><input type="date" id="fFrom" value="' + (w.type === 'date' ? BI.dateInputValue(w.from) : '') + '"><span>~</span><input type="date" id="fTo" value="' + (w.type === 'date' ? BI.dateInputValue(w.to) : '') + '"></div>' +
          '<div class="opt-row"><span>Null 날짜</span><select id="fNulls"><option value="auto">기간을 정하면 제외 (기본)</option><option value="include"' + (w.nulls === 'include' ? ' selected' : '') + '>항상 포함</option><option value="exclude"' + (w.nulls === 'exclude' ? ' selected' : '') + '>항상 제외</option></select></div>';
        const showRange = () => {
          const rr = rel ? Q.relativeRange({ f: f.id, rel }, ds) : null;
          if (rr) { BI.$('#fFrom', panel).value = BI.dateInputValue(rr[0]); BI.$('#fTo', panel).value = BI.dateInputValue(rr[1]); }
          BI.$('#fRel', panel).innerHTML = relTxt();
        };
        BI.$('.presets', panel).onclick = (e) => {
          const b = e.target.closest('[data-p]');
          if (!b || mx == null) return;
          const k = b.dataset.p;
          if (k === 'all') { rel = null; BI.$('#fFrom', panel).value = ''; BI.$('#fTo', panel).value = ''; BI.$('#fRel', panel).innerHTML = relTxt(); return; }
          const [u, n] = k.split(':');
          rel = n ? { unit: u, n: +n } : { unit: u };
          BI.$('#fRelN', panel).value = n || '';
          if (n) BI.$('#fRelU', panel).value = u;
          showRange();
        };
        const relInput = () => { const n = +BI.$('#fRelN', panel).value; if (n > 0) { rel = { unit: BI.$('#fRelU', panel).value, n }; showRange(); } };
        BI.$('#fRelN', panel).oninput = relInput;
        BI.$('#fRelU', panel).onchange = relInput;
        // 날짜를 직접 고치면 고정 기간으로
        ['#fFrom', '#fTo'].forEach((id) => (BI.$(id, panel).oninput = () => { rel = null; BI.$('#fRel', panel).innerHTML = relTxt(); }));
        panel._rel = () => rel;
      } else if (mode === 'top') {
        const meas = [D.COUNT_FIELD].concat(ds.fields.filter((x) => x.type === 'number' || x.aggCalc));
        // 기본 기준: 시트에 놓인 첫 측정값 → 측정값 역할의 첫 필드(코드·번호 같은 숫자 차원 제외) → 레코드 수
        const onSheet = sh.shelves.columns.concat(sh.shelves.rows, [sh.shelves.size, sh.shelves.color, sh.shelves.label]).find((q) => q && q.agg && meas.some((m) => m.id === q.f));
        const firstMeas = ds.fields.find((x) => x.role === 'measure' && (x.type === 'number' || x.aggCalc));
        const by = w.by || (onSheet ? { f: onSheet.f, agg: onSheet.agg === 'AGG' ? 'SUM' : onSheet.agg } : { f: firstMeas ? firstMeas.id : '__count', agg: 'SUM' });
        panel.innerHTML = '<div class="top-row"><select id="fDir"><option value="top">상위</option><option value="bottom"' + (w.dir === 'bottom' ? ' selected' : '') + '>하위</option></select><input type="number" id="fN" min="1" value="' + (w.n || 10) + '"><span>개, 기준:</span><select id="fAgg">' + Q.AGGS.map(([k, n]) => '<option value="' + k + '"' + (by.agg === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select><select id="fBy">' + meas.map((m) => '<option value="' + m.id + '"' + (by.f === m.id ? ' selected' : '') + '>' + BI.esc(m.name) + '</option>').join('') + '</select></div>' +
          (isDate ? '<div class="opt-row"><span>날짜 부분</span><select id="fDp2">' + Q.DATE_PARTS.map(([k, n]) => '<option value="' + k + '"' + (w.dp === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' : '') +
          '<p class="muted">' + BI.esc(f.name) + ' 값 중 기준 측정값이 가장 큰(작은) N개만 남깁니다. 다른 필터가 먼저 적용됩니다.</p>';
      }
    };
    BI.$('.seg', body).onclick = (e) => { const b = e.target.closest('[data-m]'); if (b) { mode = b.dataset.m; drawMode(); } };
    drawMode();
    BI.modal({
      title: '필터 - ' + f.name, width: 480, body, enterSubmits: false,
      buttons: [
        { text: '취소' },
        {
          text: '확인', primary: true, onClick: () => {
            const nw = { id: w.id, f: f.id, type: mode, card: BI.$('#fCard', body).checked, global: BI.$('#fGlobal', body).checked, dp: null };
            if (mode === 'list') {
              nw.dp = isDate ? w.dp : null;
              const { uv, sel } = listState;
              const ex = BI.$('#fEx', body).checked;
              nw.exclude = ex;
              nw.values = !ex && sel.size === uv.length ? null : uv.filter((u) => sel.has(sk(u.k))).map((u) => u.k);
              if (ex && !nw.values.length) nw.values = null, nw.exclude = false;
            } else if (mode === 'range') {
              const a = BI.$('#fMin', body).value, b = BI.$('#fMax', body).value;
              nw.min = a === '' ? null : +a; nw.max = b === '' ? null : +b;
              nw.excludeNull = BI.$('#fNull', body).checked;
            } else if (mode === 'date') {
              nw.from = BI.parseDateInput(BI.$('#fFrom', body).value);
              nw.to = BI.parseDateInput(BI.$('#fTo', body).value, true);
              const rel = panel._rel && panel._rel();
              if (rel) nw.rel = rel;
              const nl = BI.$('#fNulls', body).value;
              if (nl !== 'auto') nw.nulls = nl;
            } else if (mode === 'top') {
              nw.n = +BI.$('#fN', body).value || 10;
              nw.dir = BI.$('#fDir', body).value;
              nw.by = { f: BI.$('#fBy', body).value, agg: BI.$('#fAgg', body).value };
              nw.dp = isDate ? BI.$('#fDp2', body).value : null;
            }
            App.mutate(() => {
              const inSheet = sh.filters.findIndex((x) => x.id === nw.id);
              const inGlobal = App.state.globalFilters.findIndex((x) => x.id === nw.id);
              if (inSheet >= 0) sh.filters.splice(inSheet, 1);
              if (inGlobal >= 0) App.state.globalFilters.splice(inGlobal, 1);
              if (nw.global) {
                nw.dsId = sh.dsId;
                if (inGlobal >= 0) App.state.globalFilters.splice(inGlobal, 0, nw); else App.state.globalFilters.push(nw);
              } else if (inSheet >= 0) sh.filters.splice(inSheet, 0, nw);
              else sh.filters.push(nw);
            });
          },
        },
      ],
    });
  };

  /* ---------- 필드 메뉴 / 계산된 필드 ---------- */
  App.fieldMenu = function (ds, fid, x, y) {
    if (!ds) return;
    const f = D.fieldById(ds, fid);
    if (!f) return;
    const sh = App.activeSheet();
    const items = [{ header: f.name }];
    if (sh && sh.dsId === ds.id) items.push({ text: '시트에 추가', onClick: () => App.autoAdd(sh, f) });
    if (!f.virtual) {
      items.push({ text: '이름 바꾸기…', onClick: () => App.renameField(ds, f) });
      items.push({ text: '복제', onClick: () => App.mutateData(() => { addCalcField(ds, uniqueName(ds, f.name + ' (복사)'), f.aggCalc ? f.calc : '[' + f.name + ']'); }) });
      if (f.calc) {
        items.push({ text: '계산 편집…', onClick: () => App.editCalc(ds, f) });
      } else {
        items.push({ text: '데이터 유형 변경', sub: [['string', '문자열'], ['number', '숫자'], ['date', '날짜'], ['bool', '부울']].map(([k, n]) => ({ text: n, checked: f.type === k, onClick: () => App.mutateData(() => { App.setFieldType(ds, f, k); }) })) });
      }
      if (!f.aggCalc) items.push(f.role === 'measure' ? { text: '차원으로 변환', onClick: () => App.mutateData(() => { f.role = 'dimension'; }) } : { text: '측정값으로 변환', onClick: () => App.mutateData(() => { f.role = 'measure'; }) });
      if (f.type === 'number' || f.aggCalc) items.push({ text: '입력 단위', sub: BI.UNITS.map(([k, n]) => ({ text: n, checked: String(f.unit || '') === k, onClick: () => App.mutateData(() => { if (k) f.unit = +k; else delete f.unit; }) })) });
      if (f.role === 'measure' && f.type === 'number') items.push({ text: '기본 집계', sub: Q.AGGS.map(([k, n]) => ({ text: n, checked: (f.defAgg || 'SUM') === k, onClick: () => App.mutateData(() => { f.defAgg = k; }) })) });
      if (sh && sh.dsId === ds.id) items.push({ text: '필터 추가…', onClick: () => App.editFilter(sh, null, { f: f.id }) });
      items.push({ sep: true });
      items.push({ text: f.calc ? '계산된 필드 삭제' : '필드 삭제', onClick: () => BI.confirm('"' + f.name + '" 필드를 삭제할까요? 이 필드를 사용하는 시트 구성도 제거됩니다.', () => App.mutateData(() => { App.deleteField(ds, f); })) });
    }
    BI.menu(x, y, items);
  };
  function uniqueName(ds, nm) {
    let n = nm, i = 2;
    while (ds.fields.some((f) => f.name.toLowerCase() === n.toLowerCase())) n = nm + ' ' + i++;
    return n;
  }
  function addCalcField(ds, name, expr) {
    const c = BI.Calc.compile(expr, ds);
    const f = { id: BI.uid('c'), name, calc: expr, type: c.type, role: c.isAgg || c.type === 'number' ? 'measure' : 'dimension' };
    ds.fields.push(f);
    D.applyCalcs(ds);
    return f;
  }
  App.renameField = function (ds, f) {
    BI.prompt('필드 이름 바꾸기', f.name, (v) => {
      if (v !== f.name && ds.fields.some((x) => x !== f && x.name.toLowerCase() === v.toLowerCase())) return BI.toast('같은 이름의 필드가 이미 있습니다.', 'err');
      const old = f.name;
      App.mutateData(() => {
        ds.fields.forEach((x) => { if (x.calc) x.calc = BI.Calc.renameRef(x.calc, old, v); });
        if (!f.calc) BI.Prep.record(ds, { t: 'rename', col: old, to: v });
        f.name = v;
      });
    });
  };
  /* 유형 변경: 정리 흐름이 있으면 단계로 기록 후 다시 실행 (부울은 흐름에서 지원하지 않아 직접 변환) */
  App.setFieldType = function (ds, f, k) {
    const name = f.name;
    let fails = 0;
    // 원본 값을 잃지 않도록 정리 흐름(원본 보관)을 거쳐 변환 (부울은 흐름 미지원이라 직접 변환)
    if (!f.calc && k !== 'bool') { BI.Prep.ensure(ds); BI.Prep.record(ds, { t: 'type', col: f.name, to: k }); BI.Prep.rebuild(ds); fails = (ds.convFails || {})[name] || 0; }
    else { ds.rows = ds.rows.map((r) => Object.assign({}, r)); fails = D.changeType(ds, f, k) || 0; D.applyCalcs(ds); App.markDataDirty(ds); }
    const nf = ds.fields.find((x) => x.name === name);
    const total = ds.rows.length;
    const nonNull = nf ? ds.rows.reduce((a, r) => a + (r[nf.id] != null ? 1 : 0), 0) : 0;
    const tn = { string: '문자열', number: '숫자', date: '날짜', bool: '부울' }[k] || k;
    if (fails) BI.toast('"' + name + '"을(를) ' + tn + '(으)로 바꾸면서 ' + fails.toLocaleString() + '건을 변환하지 못해 Null이 됐어요' + (nonNull === 0 && total ? ' (모든 값이 Null)' : '') + '. Ctrl+Z로 되돌리거나 원래 유형으로 다시 바꾸면 원본 값이 돌아와요.', 'warn');
    return fails;
  };
  App.deleteField = function (ds, f) {
    if (!f.calc) BI.Prep.record(ds, { t: 'remove', cols: [f.name] });
    ds.fields = ds.fields.filter((x) => x !== f);
    // 행 값은 지우지 않음 (실행 취소 시 그대로 되살리기 위해 — 행 배열은 스냅샷과 공유)
    const keep = (p) => p && p.f !== f.id;
    App.state.sheets.filter((s) => s.dsId === ds.id).forEach((s) => {
      ['columns', 'rows', 'detail', 'tooltip'].forEach((k) => (s.shelves[k] = s.shelves[k].filter(keep)));
      ['color', 'size', 'label'].forEach((k) => { if (s.shelves[k] && !keep(s.shelves[k])) s.shelves[k] = null; });
      s.filters = s.filters.filter(keep);
    });
    App.state.globalFilters = App.state.globalFilters.filter((g) => g.dsId !== ds.id || keep(g));
    D.applyCalcs(ds);
  };

  App.editCalc = function (ds, field) {
    ds = ds || App.currentDs();
    if (!ds) return BI.toast('먼저 데이터 원본을 추가하세요.');
    const fnames = Object.keys(BI.Calc.FUNCTIONS);
    const groups = { 숫자: ['ABS', 'ROUND', 'CEILING', 'FLOOR', 'SQRT', 'POWER', 'EXP', 'LN', 'LOG', 'SIGN', 'DIV', 'MIN', 'MAX', 'ZN', 'INT', 'FLOAT', 'PI'], 논리: ['IIF', 'ISNULL', 'IFNULL'], 문자열: ['LEN', 'LEFT', 'RIGHT', 'MID', 'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM', 'CONTAINS', 'STARTSWITH', 'ENDSWITH', 'REPLACE', 'FIND', 'SPLIT', 'CONCAT', 'STR'], 날짜: ['YEAR', 'QUARTER', 'MONTH', 'DAY', 'WEEKDAY', 'DATEPART', 'DATETRUNC', 'DATEADD', 'DATEDIFF', 'TODAY', 'NOW', 'MAKEDATE', 'DATE'], 집계: ['SUM', 'AVG', 'COUNT', 'COUNTD', 'MEDIAN', 'STDEV', 'VAR', 'ATTR', 'FIXED'] };
    const fnDef = (n) => BI.Calc.FUNCTIONS[n] || BI.Calc.AGG_HELP[n];
    void fnames;
    const body = BI.h('<div class="calc-dlg">' +
      '<div class="calc-top"><input class="inp" id="cName" placeholder="필드 이름" value="' + BI.esc(field ? field.name : uniqueName(ds, '계산1')) + '"></div>' +
      '<div class="calc-main"><div class="calc-ed"><textarea id="cExpr" spellcheck="false" placeholder="예) [이익] / [매출]&#10;예) IF [매출] >= 1000000 THEN \'대형\' ELSE \'일반\' END">' + BI.esc(field ? field.calc : '') + '</textarea><div class="calc-status" id="cStatus"></div><div class="calc-prev" id="cPrev"></div></div>' +
      '<div class="calc-side"><div class="seg sm" id="cTabs"><button class="on" data-t="f">필드</button><button data-t="fn">함수</button></div><div class="calc-list" id="cList"></div><div class="calc-fhelp" id="cHelp"></div></div></div></div>');
    const ta = BI.$('#cExpr', body);
    const insert = (txt) => {
      const s = ta.selectionStart, e = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + txt + ta.value.slice(e);
      ta.focus();
      ta.selectionStart = ta.selectionEnd = s + txt.length;
      validate();
    };
    const drawList = (t) => {
      BI.$$('#cTabs button', body).forEach((b) => b.classList.toggle('on', b.dataset.t === t));
      const L = BI.$('#cList', body);
      if (t === 'f') L.innerHTML = ds.fields.filter((x) => !field || x.id !== field.id).map((x) => '<div class="ci" data-ins="[' + BI.esc(x.name) + ']">' + (TYPE_ICON[x.type] || '') + ' ' + BI.esc(x.name) + '</div>').join('');
      else L.innerHTML = Object.entries(groups).map(([g, list]) => '<div class="cg">' + g + '</div>' + list.map((n) => '<div class="ci" data-fn="' + n + '">' + n + '</div>').join('')).join('');
    };
    BI.$('#cTabs', body).onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) drawList(b.dataset.t); };
    BI.$('#cList', body).onclick = (e) => {
      const c = e.target.closest('.ci');
      if (!c) return;
      if (c.dataset.ins) insert(c.dataset.ins);
      else { const d = fnDef(c.dataset.fn); insert(c.dataset.fn === 'FIXED' ? '{FIXED [] : SUM([])}' : c.dataset.fn + '(' + (d[0] === 0 ? ')' : '')); BI.$('#cHelp', body).textContent = d[4]; }
    };
    BI.$('#cList', body).onmouseover = (e) => { const c = e.target.closest('.ci[data-fn]'); if (c) BI.$('#cHelp', body).textContent = fnDef(c.dataset.fn)[4]; };
    let valid = !!field;
    const validate = BI.debounce(() => {
      const st = BI.$('#cStatus', body), pv = BI.$('#cPrev', body);
      try {
        const c = BI.Calc.compile(ta.value, ds, field && field.id);
        valid = true;
        st.className = 'calc-status ok';
        st.textContent = '✓ 계산이 유효합니다 · 결과 유형: ' + ({ number: '숫자', string: '문자열', date: '날짜', bool: '부울' }[c.type] || c.type);
        const show = (v) => (v == null ? 'Null' : c.type === 'date' ? BI.fmtDate(v, true) : typeof v === 'number' ? BI.formatNumber(v) : String(v));
        if (c.isAgg) {
          st.textContent += ' · 집계 계산 (뷰의 차원 수준에서 계산되는 측정값)';
          const tmp = { fields: ds.fields.concat([{ id: '__tmp', name: '__tmp', calc: ta.value, aggCalc: true, type: c.type }]), rows: ds.rows, id: ds.id };
          const r = Q.aggregate(tmp, ds.rows, [], [{ f: '__tmp', agg: 'AGG' }]).rows[0];
          pv.innerHTML = '<span class="muted">전체 데이터 기준 값:</span> <code>' + BI.esc(show(r ? r.m[0] : null)) + '</code>';
        } else {
          const vals = ds.rows.slice(0, 6).map((r) => { try { return show(c.fn(r)); } catch (e) { return '오류'; } });
          pv.innerHTML = '<span class="muted">미리보기:</span> ' + vals.map((v) => '<code>' + BI.esc(v) + '</code>').join(' ');
        }
      } catch (e) {
        valid = false;
        st.className = 'calc-status err';
        st.textContent = '✕ ' + e.message;
        pv.innerHTML = '';
      }
    }, 250);
    ta.addEventListener('input', validate);
    drawList('f');
    validate();
    BI.modal({
      title: field ? '계산된 필드 편집' : '계산된 필드 만들기', width: 760, body, enterSubmits: false,
      buttons: [
        { text: '취소' },
        {
          text: '확인', primary: true, onClick: () => {
            const name = BI.$('#cName', body).value.trim();
            const expr = ta.value;
            if (!name) { BI.toast('필드 이름을 입력하세요.', 'err'); return false; }
            if (ds.fields.some((x) => x !== field && x.name.toLowerCase() === name.toLowerCase())) { BI.toast('같은 이름의 필드가 이미 있습니다.', 'err'); return false; }
            try { BI.Calc.compile(expr, ds, field && field.id); } catch (e) { BI.toast('수식 오류: ' + e.message, 'err'); return false; }
            App.mutateData(() => {
            if (field) {
              if (field.name !== name) ds.fields.forEach((x) => { if (x.calc && x !== field) x.calc = BI.Calc.renameRef(x.calc, field.name, name); });
              field.name = name;
              field.calc = expr;
              const oldType = field.type;
              D.applyCalcs(ds);
              if (oldType !== field.type || field.aggCalc) field.role = field.aggCalc || field.type === 'number' ? 'measure' : 'dimension';
              // 집계 계산으로 바뀐 필드를 쓰는 필은 '집계'로, 반대면 기본 집계로
              App.state.sheets.forEach((s) => { if (s.dsId !== ds.id) return; const S = s.shelves; S.columns.concat(S.rows, [S.color, S.size, S.label], S.detail, S.tooltip).forEach((q) => { if (!q || q.f !== field.id) return; if (field.aggCalc) q.agg = 'AGG'; else if (q.agg === 'AGG') q.agg = 'SUM'; }); });
            } else addCalcField(ds, name, expr);
            });
            BI.toast('계산된 필드 "' + name + '" 저장됨', 'ok');
          },
        },
      ],
    });
    setTimeout(() => ta.focus(), 50);
  };

  /* ---------- 드래그 앤 드롭 ---------- */
  App.bindDnD = function () {
    let marker = null;
    const clearMarks = () => {
      BI.$$('.over').forEach((x) => x.classList.remove('over'));
      if (marker) { marker.remove(); marker = null; }
    };
    const insIndex = (shelf, e) => {
      const pills = BI.$$('.pill', shelf);
      for (let i = 0; i < pills.length; i++) {
        const r = pills[i].getBoundingClientRect();
        if (shelf.classList.contains('vert') || shelf.classList.contains('mk')) { if (e.clientY < r.top + r.height / 2) return i; }
        else if (e.clientY < r.bottom && (e.clientX < r.left + r.width / 2 || e.clientY < r.top)) return i;
      }
      return pills.length;
    };
    const showMarker = (shelf, idx) => {
      if (!marker) marker = BI.h('<div class="ins-marker"></div>');
      const pills = BI.$$('.pill', shelf);
      const vert = shelf.classList.contains('vert') || shelf.classList.contains('mk');
      const sr = shelf.getBoundingClientRect();
      let x, y, h, w;
      if (pills.length === 0) { x = sr.left + 4; y = sr.top + 4; h = sr.height - 8; w = 2; }
      else if (idx < pills.length) { const r = pills[idx].getBoundingClientRect(); if (vert) { x = r.left; y = r.top - 2; w = r.width; h = 2; } else { x = r.left - 3; y = r.top; h = r.height; w = 2; } }
      else { const r = pills[pills.length - 1].getBoundingClientRect(); if (vert) { x = r.left; y = r.bottom + 1; w = r.width; h = 2; } else { x = r.right + 2; y = r.top; h = r.height; w = 2; } }
      Object.assign(marker.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      if (!marker.parentNode) document.body.appendChild(marker);
    };

    document.addEventListener('dragstart', (e) => {
      const t = e.target;
      if (!t.closest) return;
      const pill = t.closest('.pill[data-shelf]');
      const field = t.closest('.field[data-fid]');
      const tab = t.closest('.tab[data-id]');
      const dsItem = t.closest('[data-dash-sheet],[data-dash-obj]');
      App.dropped = false;
      if (pill) App.drag = pill.dataset.flt ? { kind: 'filter', id: pill.dataset.flt } : { kind: 'pill', shelf: pill.dataset.shelf, idx: +pill.dataset.idx };
      else if (field) App.drag = { kind: 'field', fid: field.dataset.fid };
      else if (tab) App.drag = { kind: 'tab', id: tab.dataset.id };
      else if (dsItem) App.drag = dsItem.dataset.dashSheet ? { kind: 'dashsheet', sheetId: dsItem.dataset.dashSheet } : { kind: 'dashobj', obj: dsItem.dataset.dashObj };
      else return;
      try { e.dataTransfer.setData('text/plain', 'offline-bi'); e.dataTransfer.effectAllowed = 'copyMove'; } catch (x) { /* noop */ }
      document.body.classList.add('dragging');
      if (App.drag.kind === 'field' || App.drag.kind === 'pill') document.body.classList.add('drag-field');
    });

    const targetFor = (e) => {
      const d = App.drag;
      if (!d) return null;
      const t = e.target.closest && e.target.closest('[data-shelf].shelf, .field-list, #view, .dash-canvas, .tab[data-id], .data-pane');
      if (!t) return null;
      if (d.kind === 'tab') return t.matches('.tab[data-id]') ? t : null;
      if (d.kind === 'dashsheet' || d.kind === 'dashobj') return t.matches('.dash-canvas') ? t : null;
      if (t.matches('.tab, .dash-canvas')) return null;
      if (d.kind === 'filter') return t.matches('[data-shelf=filters]') ? t : t.matches('.field-list,.data-pane') ? t : null;
      return t;
    };
    document.addEventListener('dragover', (e) => {
      const t = targetFor(e);
      if (!t) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move'; } catch (x) { /* noop */ }
      if (!t.classList.contains('over')) { BI.$$('.over').forEach((x) => x !== t && x.classList.remove('over')); t.classList.add('over'); }
      if (t.matches('.shelf.multi, .shelf.vert')) showMarker(t, insIndex(t, e));
      else if (marker) { marker.remove(); marker = null; }
    });
    document.addEventListener('dragleave', (e) => {
      const t = e.target.closest && e.target.closest('.over');
      if (t && !t.contains(e.relatedTarget)) { t.classList.remove('over'); if (marker) { marker.remove(); marker = null; } }
    });
    document.addEventListener('drop', (e) => {
      const t = targetFor(e);
      const d = App.drag;
      if (!t || !d) return;
      e.preventDefault();
      App.dropped = true;
      const idx = t.matches('.shelf') ? insIndex(t, e) : null;
      clearMarks();
      handleDrop(t, d, idx, e);
    });
    document.addEventListener('dragend', () => {
      const d = App.drag;
      clearMarks();
      document.body.classList.remove('dragging', 'drag-field');
      App.drag = null;
      if (!d || App.dropped) return;
      const sh = App.activeSheet();
      if (!sh) return;
      if (d.kind === 'pill') App.mutate(() => takePill(sh, d.shelf, d.idx));
      if (d.kind === 'filter') App.mutate(() => removeFilter(sh, d.id));
    });
  };

  function handleDrop(t, d, idx, e) {
    if (d.kind === 'tab') {
      const toId = t.dataset.id;
      if (toId === d.id) return;
      App.mutate(() => {
        const tabs = App.state.tabs;
        const from = tabs.findIndex((x) => x.id === d.id);
        const item = tabs.splice(from, 1)[0];
        let to = tabs.findIndex((x) => x.id === toId);
        const r = t.getBoundingClientRect();
        if (e.clientX > r.left + r.width / 2) to++;
        tabs.splice(to, 0, item);
      });
      return;
    }
    if (d.kind === 'dashsheet' || d.kind === 'dashobj') return App.dashDrop(t, d, e);
    const sh = App.activeSheet();
    if (!sh) return;
    const ds = App.ds(sh.dsId);
    if (!ds) return;
    // 데이터 패널로 드롭: 필 제거 또는 역할 변경
    if (t.matches('.field-list, .data-pane')) {
      if (d.kind === 'pill') return App.mutate(() => takePill(sh, d.shelf, d.idx));
      if (d.kind === 'filter') return App.mutate(() => removeFilter(sh, d.id));
      if (d.kind === 'field' && t.matches('.field-list')) {
        const f = D.fieldById(ds, d.fid);
        const role = t.dataset.role;
        if (f && !f.virtual && !f.aggCalc && f.role !== role) App.mutateData(() => { f.role = role; });
      }
      return;
    }
    if (t.matches('#view')) {
      if (d.kind === 'field') { const f = D.fieldById(ds, d.fid); if (f) App.autoAdd(sh, f); }
      return;
    }
    const shelf = t.dataset.shelf;
    if (shelf === 'filters') {
      if (d.kind === 'filter') {
        // 순서 변경
        return App.mutate(() => {
          const i = sh.filters.findIndex((x) => x.id === d.id);
          if (i < 0) return false;
          const it = sh.filters.splice(i, 1)[0];
          sh.filters.splice(Math.min(idx, sh.filters.length), 0, it);
        });
      }
      if (d.kind === 'field') return App.editFilter(sh, null, { f: d.fid });
      if (d.kind === 'pill') { const p = getPill(sh, d.shelf, d.idx); if (p) App.editFilter(sh, null, { f: p.f, dp: p.dp, agg: p.agg }); }
      return;
    }
    if (d.kind === 'filter') return;
    App.mutate(() => {
      let p;
      if (d.kind === 'field') {
        const f = D.fieldById(ds, d.fid);
        if (!f) return false;
        p = App.makePill(f);
      } else if (d.kind === 'pill') {
        if (e.ctrlKey) p = Object.assign(BI.clone(getPill(sh, d.shelf, d.idx)), { id: BI.uid('p') });
        else {
          if (d.shelf === shelf && !MULTI[shelf]) return false;
          p = takePill(sh, d.shelf, d.idx);
          if (d.shelf === shelf && idx > d.idx) idx--;
        }
      }
      if (!p) return false;
      putPill(sh, shelf, p, idx);
    });
  }
})();
