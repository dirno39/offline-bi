/* Offline BI - 애플리케이션 코어: 상태, 실행취소, 저장, 탭, 툴바 */
(function () {
  'use strict';
  const BI = window.BI;
  const Q = BI.Query, D = BI.Data;
  const App = (BI.App = {
    state: null,
    undo: [],
    redo: [],
    drag: null,
    ui: { showMe: true },
  });

  /* ---------- 상태 ---------- */
  App.newState = () => ({ version: 1, name: '새 통합 문서', datasources: [], sheets: [], dashboards: [], globalFilters: [], tabs: [], active: { type: 'datasource', id: null } });

  App.ds = (id) => App.state.datasources.find((d) => d.id === id);
  App.sheet = (id) => App.state.sheets.find((s) => s.id === id);
  App.dash = (id) => App.state.dashboards.find((s) => s.id === id);
  App.activeSheet = () => (App.state.active.type === 'sheet' ? App.sheet(App.state.active.id) : null);
  App.activeDash = () => (App.state.active.type === 'dashboard' ? App.dash(App.state.active.id) : null);
  App.fieldType = (fid) => {
    const s = App.activeSheet();
    const ds = s && App.ds(s.dsId);
    const f = ds && D.fieldById(ds, fid);
    return f ? f.type : null;
  };

  App.newSheet = function (dsId, name) {
    const n = App.state.sheets.length + 1;
    let nm = name || '시트 ' + n;
    let i = n;
    while (App.state.sheets.some((s) => s.name === nm) && !name) nm = '시트 ' + ++i;
    return {
      id: BI.uid('sh'), name: nm, dsId: dsId || (App.state.datasources[0] && App.state.datasources[0].id) || null,
      chartType: 'auto',
      shelves: { columns: [], rows: [], color: null, size: null, label: null, detail: [], tooltip: [] },
      filters: [],
      options: { labels: false, legend: true, numFmt: 'auto', palette: 'default', seq: 'blue', showTitle: true },
      title: '',
    };
  };
  App.newDashboard = function () {
    let i = App.state.dashboards.length + 1;
    while (App.state.dashboards.some((d) => d.name === '대시보드 ' + i)) i++;
    return { id: BI.uid('db'), name: '대시보드 ' + i, items: [], selection: null, title: '', showFilters: true };
  };

  App.effectiveFilters = function (sheet) {
    return (sheet.filters || []).concat(App.state.globalFilters.filter((f) => f.dsId === sheet.dsId));
  };

  /* ---------- 실행 취소 ---------- */
  const snap = () => JSON.stringify({ sheets: App.state.sheets, dashboards: App.state.dashboards, globalFilters: App.state.globalFilters, tabs: App.state.tabs, active: App.state.active });
  App.mutate = function (fn, opts) {
    const before = snap();
    const r = fn();
    if (r === false) return;
    App.undo.push(before);
    if (App.undo.length > 80) App.undo.shift();
    App.redo = [];
    App.refresh(opts);
    App.autosave();
  };
  const restore = (s) => {
    const o = JSON.parse(s);
    Object.assign(App.state, o);
  };
  App.doUndo = function () {
    if (!App.undo.length) return;
    App.redo.push(snap());
    restore(App.undo.pop());
    App.refresh();
    App.autosave();
  };
  App.doRedo = function () {
    if (!App.redo.length) return;
    App.undo.push(snap());
    restore(App.redo.pop());
    App.refresh();
    App.autosave();
  };

  /* ---------- 자동 저장 (IndexedDB) ---------- */
  const IDB = {
    db: null,
    open() {
      return new Promise((res) => {
        try {
          const rq = indexedDB.open('offline-bi', 1);
          rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
          rq.onsuccess = () => { IDB.db = rq.result; res(IDB.db); };
          rq.onerror = () => res(null);
        } catch (e) { res(null); }
      });
    },
    put(k, v) {
      return new Promise((res) => {
        if (!IDB.db) return res(false);
        try {
          const tx = IDB.db.transaction('kv', 'readwrite');
          tx.objectStore('kv').put(v, k);
          tx.oncomplete = () => res(true);
          tx.onerror = () => res(false);
        } catch (e) { res(false); }
      });
    },
    get(k) {
      return new Promise((res) => {
        if (!IDB.db) return res(null);
        try {
          const rq = IDB.db.transaction('kv').objectStore('kv').get(k);
          rq.onsuccess = () => res(rq.result || null);
          rq.onerror = () => res(null);
        } catch (e) { res(null); }
      });
    },
  };
  App.autosave = BI.debounce(async function () {
    const st = App.state;
    const ok = await IDB.put('workbook', { savedAt: Date.now(), state: st });
    const el = BI.$('#saveState');
    if (el) el.textContent = ok ? '자동 저장됨 ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';
  }, 800);

  /* ---------- 통합 문서 파일 저장/열기 ---------- */
  App.saveWorkbookFile = function () {
    const data = JSON.stringify({ app: 'offline-bi', version: 1, savedAt: new Date().toISOString(), state: App.state });
    const nm = (App.state.name || '통합문서').replace(/[\\/:*?"<>|]/g, '_');
    BI.download(nm + '.obi', data, 'application/json');
    BI.toast('통합 문서를 저장했습니다 (' + nm + '.obi)');
  };
  App.openWorkbookFile = async function (file) {
    try {
      const txt = D.decodeText(await D.readFile(file));
      const o = JSON.parse(txt);
      if (!o.state || !o.state.datasources) throw new Error('형식이 올바르지 않습니다.');
      App.loadState(o.state);
      App.state.name = file.name.replace(/\.[^.]+$/, '');
      App.undo = []; App.redo = [];
      App.refresh();
      App.autosave();
      BI.toast('통합 문서를 열었습니다.');
    } catch (e) {
      BI.toast('통합 문서를 열 수 없습니다: ' + e.message, 'err');
    }
  };
  App.loadState = function (st) {
    const s = Object.assign(App.newState(), st);
    s.datasources.forEach((ds) => D.applyCalcs(ds));
    s.sheets.forEach((sh) => {
      sh.shelves = Object.assign({ columns: [], rows: [], color: null, size: null, label: null, detail: [], tooltip: [] }, sh.shelves);
      sh.options = Object.assign({ labels: false, legend: true, numFmt: 'auto', palette: 'default', seq: 'blue', showTitle: true }, sh.options);
      sh.filters = sh.filters || [];
    });
    s.tabs = s.tabs.filter((t) => (t.type === 'sheet' ? s.sheets.some((x) => x.id === t.id) : s.dashboards.some((x) => x.id === t.id)));
    App.state = s;
  };

  /* ---------- 데이터 추가 ---------- */
  App.addDataFiles = async function (files) {
    const added = [];
    for (const file of files) {
      try {
        BI.toast('불러오는 중: ' + file.name);
        const tables = await D.parseFile(file);
        if (!tables.length) { BI.toast(file.name + ': 데이터가 없습니다.', 'err'); continue; }
        let chosen = tables;
        if (tables.length > 1) chosen = await App.pickTables(file.name, tables);
        chosen.forEach((t) => {
          const nm = tables.length > 1 ? file.name.replace(/\.[^.]+$/, '') + ' - ' + t.name : t.name;
          const ds = BI.Prep.createDataSource(nm, t);
          ds.source = file.name;
          if (!ds.fields.length) { BI.toast(nm + ': 열을 찾을 수 없습니다.', 'err'); return; }
          added.push(ds);
        });
      } catch (e) {
        console.error(e);
        BI.toast(file.name + ' 읽기 실패: ' + e.message, 'err');
      }
    }
    if (!added.length) return;
    App.addDataSources(added);
    // 여러 줄 머리글이거나 가로로 펼쳐진 통계표면 데이터 정리 화면을 바로 열어 줌
    const odd = added.find((d) => d.prep && (+d.prep.headerRows > 1 || +d.prep.skip > 0 || BI.Prep.suggest(d.prep)));
    if (odd) {
      const why = +odd.prep.headerRows > 1 ? '머리글이 ' + odd.prep.headerRows + '줄인 표라 하나로 합쳤어요.' : +odd.prep.skip > 0 ? '표 위쪽 제목 행 ' + odd.prep.skip + '줄을 건너뛰었어요.' : '숫자 열이 가로로 펼쳐진 표예요.';
      setTimeout(() => App.openPrep(odd, { message: why + ' 필요하면 여기서 분석하기 좋은 형태로 바꿔 보세요.' }), 300);
    }
  };
  App.addDataSources = function (added) {
    added.forEach((ds) => App.state.datasources.push(ds));
    App.mutate(() => {
      if (!App.state.sheets.length) {
        const sh = App.newSheet(added[0].id);
        App.state.sheets.push(sh);
        App.state.tabs.push({ type: 'sheet', id: sh.id });
        App.state.active = { type: 'sheet', id: sh.id };
      } else {
        const s = App.activeSheet();
        if (s && !s.dsId) s.dsId = added[0].id;
        App.ui.dsPage = added[0].id;
        if (App.state.active.type === 'datasource') App.state.active = { type: 'datasource', id: added[0].id };
      }
    });
    BI.toast(added.map((d) => d.name + ' (' + d.rows.length.toLocaleString() + '행)').join(', ') + ' 추가됨', 'ok');
  };
  App.pickTables = function (fname, tables) {
    return new Promise((resolve) => {
      const body = BI.h('<div><p class="muted">' + BI.esc(fname) + ' 파일에 시트가 여러 개 있습니다. 가져올 시트를 선택하세요.</p><div class="pick-list">' +
        tables.map((t, i) => '<label class="chk"><input type="checkbox" data-i="' + i + '" ' + (i === 0 ? 'checked' : '') + '> ' + BI.esc(t.name) + ' <span class="muted">(' + Math.max(0, t.aoa.length - 1).toLocaleString() + '행)</span></label>').join('') + '</div></div>');
      let done = false;
      BI.modal({
        title: '시트 선택', width: 420, body,
        buttons: [
          { text: '취소', onClick: () => { done = true; resolve([]); } },
          { text: '가져오기', primary: true, onClick: (bd) => { done = true; resolve(BI.$$('input:checked', bd).map((c) => tables[+c.dataset.i])); } },
        ],
        onClose: () => { if (!done) resolve([]); },
      });
    });
  };
  App.loadSample = function () {
    const ds = D.sampleDataSource();
    App.state.datasources.push(ds);
    App.mutate(() => {
      const mk = (name, fn) => { const s = App.newSheet(ds.id, name); fn(s); App.state.sheets.push(s); App.state.tabs.push({ type: 'sheet', id: s.id }); return s; };
      const P = (f, agg, extra) => Object.assign({ id: BI.uid('p'), f, agg: agg || null }, extra || {});
      const s1 = mk('월별 매출 추이', (s) => { s.shelves.columns = [P('order_date', null, { dp: 'month' })]; s.shelves.rows = [P('sales', 'SUM')]; s.shelves.color = P('category'); s.chartType = 'line'; });
      const s2 = mk('카테고리별 매출', (s) => { s.shelves.rows = [P('subcat', null, { sort: 'mdesc' })]; s.shelves.columns = [P('sales', 'SUM')]; s.shelves.color = P('category'); s.chartType = 'hbar'; s.options.labels = true; s.options.numFmt = 'man'; });
      const s3 = mk('권역 × 세그먼트', (s) => { s.shelves.columns = [P('segment')]; s.shelves.rows = [P('region')]; s.shelves.color = P('profit', 'SUM'); s.shelves.label = P('sales', 'SUM'); s.chartType = 'hltable'; s.options.numFmt = 'man'; s.options.totals = true; });
      const s4 = mk('매출 구성비', (s) => { s.shelves.color = P('channel'); s.shelves.size = P('sales', 'SUM'); s.chartType = 'donut'; });
      const s5 = mk('KPI', (s) => { s.shelves.columns = [P('order_date', null, { dp: 'year' })]; s.shelves.rows = [P('sales', 'SUM'), P('profit', 'SUM'), P('order_id', 'COUNTD')]; s.chartType = 'kpi'; s.options.numFmt = 'compact'; });
      const s6 = mk('매출 vs 이익', (s) => { s.shelves.columns = [P('sales', 'SUM')]; s.shelves.rows = [P('profit', 'SUM')]; s.shelves.color = P('category'); s.shelves.detail = [P('subcat'), P('city')]; s.chartType = 'scatter'; s.options.trend = true; });
      const db = App.newDashboard();
      db.name = '매출 대시보드';
      db.title = '매출 현황 대시보드';
      db.items = [
        { id: BI.uid('it'), type: 'sheet', sheetId: s5.id, x: 0, y: 0, w: 24, h: 15 },
        { id: BI.uid('it'), type: 'sheet', sheetId: s1.id, x: 0, y: 15, w: 14, h: 30, filter: true },
        { id: BI.uid('it'), type: 'sheet', sheetId: s4.id, x: 14, y: 15, w: 10, h: 30, filter: true },
        { id: BI.uid('it'), type: 'sheet', sheetId: s2.id, x: 0, y: 45, w: 12, h: 34, filter: true },
        { id: BI.uid('it'), type: 'sheet', sheetId: s3.id, x: 12, y: 45, w: 12, h: 34 },
      ];
      App.state.dashboards.push(db);
      App.state.tabs.push({ type: 'dashboard', id: db.id });
      App.state.globalFilters.push({ id: BI.uid('fl'), dsId: ds.id, f: 'region', type: 'list', values: null, exclude: false, card: true, global: true });
      App.state.globalFilters.push({ id: BI.uid('fl'), dsId: ds.id, f: 'order_date', type: 'date', from: null, to: null, card: true, global: true });
      App.state.active = { type: 'dashboard', id: db.id };
      void s6;
    });
    BI.toast('샘플 데이터를 불러왔습니다. 시트 탭을 눌러 살펴보세요.', 'ok');
  };

  /* ---------- 탭 ---------- */
  App.renderTabs = function () {
    const bar = BI.$('#tabs');
    const a = App.state.active;
    let h = '<div class="tab ds-tab' + (a.type === 'datasource' ? ' active' : '') + '" data-tab="datasource"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg> 데이터 원본</div>';
    App.state.tabs.forEach((t) => {
      const o = t.type === 'sheet' ? App.sheet(t.id) : App.dash(t.id);
      if (!o) return;
      const icon = t.type === 'sheet'
        ? '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/></svg>'
        : '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="5"/><rect x="13" y="10" width="8" height="11"/><rect x="3" y="13" width="8" height="8"/></svg>';
      h += '<div class="tab ' + t.type + (a.type === t.type && a.id === t.id ? ' active' : '') + '" draggable="true" data-tab="' + t.type + '" data-id="' + t.id + '">' + icon + ' <span>' + BI.esc(o.name) + '</span></div>';
    });
    h += '<button class="tab-add" data-cmd="newSheet" title="새 워크시트"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M14 4h6M17 1v6"/></svg></button>';
    h += '<button class="tab-add" data-cmd="newDash" title="새 대시보드"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/><path d="M14 7h6M17 4v6"/></svg></button>';
    bar.innerHTML = h;
  };

  App.activate = function (type, id) {
    App.state.active = { type, id: id || null };
    App.refresh();
    App.autosave();
  };

  App.tabMenu = function (t, id, x, y) {
    const o = t === 'sheet' ? App.sheet(id) : App.dash(id);
    BI.menu(x, y, [
      { text: '이름 바꾸기', onClick: () => App.renameTab(t, id) },
      { text: '복제', onClick: () => App.duplicateTab(t, id) },
      t === 'sheet' ? { text: '새 대시보드에 추가', onClick: () => App.mutate(() => { const d = App.newDashboard(); d.items.push({ id: BI.uid('it'), type: 'sheet', sheetId: id, x: 0, y: 0, w: 24, h: 40 }); App.state.dashboards.push(d); App.state.tabs.push({ type: 'dashboard', id: d.id }); App.state.active = { type: 'dashboard', id: d.id }; }) } : { sep: true },
      { sep: true },
      { text: '삭제', onClick: () => BI.confirm('"' + o.name + '"을(를) 삭제할까요?', () => App.deleteTab(t, id)) },
    ]);
  };
  App.renameTab = function (t, id) {
    const o = t === 'sheet' ? App.sheet(id) : App.dash(id);
    BI.prompt('이름 바꾸기', o.name, (v) => App.mutate(() => { o.name = v; }));
  };
  App.duplicateTab = function (t, id) {
    App.mutate(() => {
      const o = BI.clone(t === 'sheet' ? App.sheet(id) : App.dash(id));
      o.id = BI.uid(t === 'sheet' ? 'sh' : 'db');
      o.name = o.name + ' (복사본)';
      if (t === 'sheet') {
        o.filters.forEach((f) => (f.id = BI.uid('fl')));
        App.state.sheets.push(o);
      } else {
        o.items.forEach((it) => (it.id = BI.uid('it')));
        App.state.dashboards.push(o);
      }
      const idx = App.state.tabs.findIndex((x) => x.id === id);
      App.state.tabs.splice(idx + 1, 0, { type: t, id: o.id });
      App.state.active = { type: t, id: o.id };
    });
  };
  App.deleteTab = function (t, id) {
    App.mutate(() => {
      const idx = App.state.tabs.findIndex((x) => x.id === id);
      App.state.tabs.splice(idx, 1);
      if (t === 'sheet') {
        App.state.sheets = App.state.sheets.filter((s) => s.id !== id);
        App.state.dashboards.forEach((d) => (d.items = d.items.filter((it) => it.sheetId !== id)));
      } else App.state.dashboards = App.state.dashboards.filter((s) => s.id !== id);
      if (App.state.active.id === id) {
        const n = App.state.tabs[Math.max(0, idx - 1)];
        App.state.active = n ? { type: n.type, id: n.id } : { type: 'datasource', id: null };
      }
    });
  };

  /* ---------- 명령 ---------- */
  App.cmd = function (c, el) {
    const sh = App.activeSheet();
    switch (c) {
      case 'new':
        BI.confirm('현재 작업을 닫고 새 통합 문서를 시작할까요? (저장하지 않은 내용은 사라집니다)', () => {
          App.state = App.newState();
          App.undo = []; App.redo = [];
          App.refresh();
          App.autosave();
        });
        break;
      case 'open': BI.$('#fileWb').click(); break;
      case 'save': App.saveWorkbookFile(); break;
      case 'addData': BI.$('#fileData').click(); break;
      case 'sample': App.loadSample(); break;
      case 'undo': App.doUndo(); break;
      case 'redo': App.doRedo(); break;
      case 'newSheet': {
        App.mutate(() => {
          const cur = App.activeSheet();
          const dsId = cur ? cur.dsId : App.state.active.type === 'datasource' && App.state.active.id ? App.state.active.id : undefined;
          const s = App.newSheet(dsId);
          App.state.sheets.push(s);
          App.state.tabs.push({ type: 'sheet', id: s.id });
          App.state.active = { type: 'sheet', id: s.id };
        });
        break;
      }
      case 'newDash':
        App.mutate(() => {
          const d = App.newDashboard();
          App.state.dashboards.push(d);
          App.state.tabs.push({ type: 'dashboard', id: d.id });
          App.state.active = { type: 'dashboard', id: d.id };
        });
        break;
      case 'swap':
        if (!sh) return;
        App.mutate(() => { const t = sh.shelves.columns; sh.shelves.columns = sh.shelves.rows; sh.shelves.rows = t; if (sh.chartType === 'hbar') sh.chartType = 'bar'; else if (sh.chartType === 'bar') sh.chartType = 'hbar'; else if (sh.chartType === 'stackbar') sh.chartType = 'stackhbar'; else if (sh.chartType === 'stackhbar') sh.chartType = 'stackbar'; });
        break;
      case 'clear':
        if (!sh) return;
        App.mutate(() => { sh.shelves = { columns: [], rows: [], color: null, size: null, label: null, detail: [], tooltip: [] }; sh.filters = []; sh.chartType = 'auto'; });
        break;
      case 'sortAsc': App.quickSort(false); break;
      case 'sortDesc': App.quickSort(true); break;
      case 'showMe': App.ui.showMe = !App.ui.showMe; App.refresh(); break;
      case 'exportPng': App.exportPng(); break;
      case 'exportCsv': App.exportData('csv'); break;
      case 'exportXlsx': App.exportData('xlsx'); break;
      case 'viewData': App.viewData(); break;
      case 'print': window.print(); break;
      case 'calc': App.editCalc(); break;
      case 'help': App.showHelp(); break;
      case 'exportMenu': {
        const r = el.getBoundingClientRect();
        BI.menu(r.left, r.bottom + 2, [
          { text: '이미지로 내보내기 (PNG)', onClick: () => App.exportPng(), disabled: !sh && !App.activeDash() },
          { text: '요약 데이터 → CSV', onClick: () => App.exportData('csv'), disabled: !sh },
          { text: '요약 데이터 → Excel (XLSX)', onClick: () => App.exportData('xlsx'), disabled: !sh },
          { text: '데이터 보기', onClick: () => App.viewData(), disabled: !sh },
          { sep: true },
          { text: '인쇄 / PDF로 저장', onClick: () => window.print() },
        ]);
        break;
      }
      case 'fileMenu': {
        const r = el.getBoundingClientRect();
        BI.menu(r.left, r.bottom + 2, [
          { text: '새 통합 문서', onClick: () => App.cmd('new') },
          { text: '통합 문서 열기… (.obi)', onClick: () => App.cmd('open') },
          { text: '통합 문서 저장 (.obi)', onClick: () => App.cmd('save') },
          { text: '통합 문서 이름 변경', onClick: () => BI.prompt('통합 문서 이름', App.state.name, (v) => { App.state.name = v; App.refresh(); App.autosave(); }) },
          { sep: true },
          { text: '데이터 파일 추가… (CSV, Excel)', onClick: () => App.cmd('addData') },
          { text: '샘플 데이터 불러오기', onClick: () => App.cmd('sample') },
        ]);
        break;
      }
    }
  };

  /* ---------- 빠른 정렬 (툴바) ----------
     측정값 축의 반대편에 있는 마지막 불연속 차원을 측정값 합계 기준으로 정렬.
     측정값이 없으면 이름순. 같은 방향을 다시 누르면 정렬 해제. */
  App.sortTarget = function (sh) {
    sh = sh || App.activeSheet();
    if (!sh) return null;
    const ds = App.ds(sh.dsId);
    const S = sh.shelves;
    const pick = (arr) => { for (let i = arr.length - 1; i >= 0; i--) { const p = arr[i]; if (!p.agg && !(ds && BI.Query.isTimeline(p, ds))) return p; } return null; };
    const hasMeas = (a) => a.some((p) => p.agg);
    let t = null;
    if (hasMeas(S.columns)) t = pick(S.rows);
    if (!t && hasMeas(S.rows)) t = pick(S.columns);
    if (!t) t = pick(S.rows) || pick(S.columns);
    if (!t && S.color && !S.color.agg) t = S.color;
    const anyMeas = hasMeas(S.columns) || hasMeas(S.rows) || ['color', 'size', 'label'].some((k) => S[k] && S[k].agg);
    return t ? { pill: t, byMeasure: anyMeas } : null;
  };
  // 표 머리글 클릭: 차원 = 이름 오름→내림→해제, 측정값 = 값 내림→오름→해제
  App.tableSort = function (sheet, fid, mi) {
    const find = () => { const S = sheet.shelves; return S.rows.concat(S.columns, [S.color, S.label], S.detail || [], S.tooltip || []).find((p) => p && !p.agg && p.f === fid); };
    if (!find()) return;
    App.mutate(() => {
      const p = find();
      if (mi == null) {
        const next = { undefined: 'asc', asc: 'desc', desc: undefined }[p.sort === 'asc' || p.sort === 'desc' ? p.sort : undefined];
        if (next) p.sort = next; else delete p.sort;
        delete p.sortBy;
      } else {
        const same = (p.sort === 'mdesc' || p.sort === 'masc') && (p.sortBy || 0) === mi;
        const next = !same ? 'mdesc' : p.sort === 'mdesc' ? 'masc' : undefined;
        if (next) { p.sort = next; p.sortBy = mi; } else { delete p.sort; delete p.sortBy; }
      }
    });
  };

  App.quickSort = function (desc) {
    const sh = App.activeSheet();
    const tg = App.sortTarget(sh);
    if (!tg) { BI.toast('정렬할 차원이 없어요. 열이나 행에 차원을 먼저 놓아 주세요.', 'err'); return; }
    const mode = tg.byMeasure ? (desc ? 'mdesc' : 'masc') : (desc ? 'desc' : 'asc');
    App.mutate(() => {
      const t = App.sortTarget(sh).pill;
      if (t.sort === mode) delete t.sort; else { t.sort = mode; delete t.sortBy; }
    });
  };

  App.renderToolbar = function () {
    const tb = BI.$('#toolbar');
    BI.$('[data-cmd=undo]', tb).disabled = !App.undo.length;
    BI.$('[data-cmd=redo]', tb).disabled = !App.redo.length;
    const isSheet = !!App.activeSheet();
    ['swap', 'clear', 'showMe', 'calc', 'sortAsc', 'sortDesc'].forEach((c) => { const b = BI.$('[data-cmd=' + c + ']', tb); if (b) b.disabled = !isSheet; });
    const tg = isSheet ? App.sortTarget() : null;
    const cur = tg ? tg.pill.sort : null;
    BI.$('[data-cmd=sortAsc]', tb).classList.toggle('on', cur === 'masc' || cur === 'asc');
    BI.$('[data-cmd=sortDesc]', tb).classList.toggle('on', cur === 'mdesc' || cur === 'desc');
    BI.$('[data-cmd=showMe]', tb).classList.toggle('on', App.ui.showMe && isSheet);
    BI.$('#wbName').textContent = App.state.name || '';
  };

  /* ---------- 메인 렌더 ---------- */
  App.refresh = function (opts) {
    opts = opts || {};
    BI.closeMenus();
    App.renderTabs();
    App.renderToolbar();
    const a = App.state.active;
    if (a.type === 'sheet' && !App.sheet(a.id)) App.state.active = { type: 'datasource', id: null };
    if (a.type === 'dashboard' && !App.dash(a.id)) App.state.active = { type: 'datasource', id: null };
    const main = BI.$('#main');
    const key = App.state.active.type + ':' + (App.state.active.id || '');
    if (main.dataset.mode !== key) {
      App.disposeCharts(main);
      main.innerHTML = '';
      main.dataset.mode = key;
    }
    if (App.state.active.type === 'sheet') App.renderSheetMode(opts);
    else if (App.state.active.type === 'dashboard') App.renderDashMode(opts);
    else App.renderDataSourceMode(opts);
  };

  /* ---------- 차트 렌더 공통 ---------- */
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver((ents) => ents.forEach((e) => { const ec = e.target._ec; if (ec && !ec.isDisposed()) ec.resize(); })) : null;
  App.disposeCharts = function (root) {
    BI.$$('.chart-host', root).forEach((h) => { if (h._ec) { ro && ro.unobserve(h); h._ec.dispose(); h._ec = null; } });
  };

  /* container 내부: .chart-host, .html-host, .empty-host */
  App.renderChartInto = function (box, sheet, opts) {
    opts = opts || {};
    const ds = App.ds(sheet.dsId);
    const ch = BI.$('.chart-host', box), hh = BI.$('.html-host', box), eh = BI.$('.empty-host', box);
    const show = (w) => { ch.style.display = w === 'c' ? '' : 'none'; hh.style.display = w === 'h' ? '' : 'none'; eh.style.display = w === 'e' ? '' : 'none'; };
    if (!ds) {
      show('e');
      eh.innerHTML = '<div class="empty-msg">데이터 원본이 없습니다.<br><button class="btn primary" data-cmd="addData">데이터 파일 추가</button></div>';
      return null;
    }
    const t0 = performance.now();
    const rows = Q.applyFilters(ds, App.effectiveFilters(sheet), opts.conds);
    const out = BI.Charts.build(sheet, ds, rows, opts);
    out.rows = rows;
    out.ms = performance.now() - t0;
    box._out = out;
    box.style.setProperty('--fs', out.fontScale || 1);
    if (out.option) {
      show('c');
      let ec = ch._ec;
      if (!ec || ec.isDisposed()) {
        ec = ch._ec = echarts.init(ch, BI.Charts.THEME, { renderer: 'canvas' });
        ro && ro.observe(ch);
      }
      ch.style.minHeight = out.minHeight ? out.minHeight + 'px' : '';
      ec.setOption(out.option, true);
      ec.off('click');
      ec.on('click', (p) => {
        if (!opts.onSelect) return;
        const s = BI.Charts.selectionFor(box._out, p);
        opts.onSelect(s, p.event && p.event.event);
      });
      setTimeout(() => ec && !ec.isDisposed() && ec.resize(), 0);
    } else if (out.html) {
      show('h');
      if (ch._ec) { ro && ro.unobserve(ch); ch._ec.dispose(); ch._ec = null; }
      hh.innerHTML = out.html;
      hh.onclick = (e) => {
        const th = e.target.closest('th[data-sortf]');
        if (th) { App.tableSort(sheet, th.dataset.sortf, th.dataset.sortm != null ? +th.dataset.sortm : null); return; }
        const td = e.target.closest('td[data-r]');
        if (!td || !opts.onSelect) return;
        opts.onSelect(BI.Charts.selectionForRow(box._out, +td.dataset.r), e);
      };
      // 테이블 셀 툴팁
      hh.onmousemove = (e) => {
        const td = e.target.closest('td[data-r]');
        App.hoverTip(td ? BI.Charts.tipHtml(box._out.ctx, box._out.ctx.res.rows[+td.dataset.r]) : null, e);
      };
      hh.onmouseleave = () => App.hoverTip(null);
    } else {
      show('e');
      if (ch._ec) { ro && ro.unobserve(ch); ch._ec.dispose(); ch._ec = null; }
      eh.innerHTML = '<div class="empty-msg">' + (typeof out.empty === 'string' ? BI.esc(out.empty) : opts.emptyHtml || '표시할 필드를 선택하세요.') + '</div>';
    }
    return out;
  };

  App.hoverTip = function (html, e) {
    let t = BI.$('#hoverTip');
    if (!html) { if (t) t.style.display = 'none'; return; }
    if (!t) { t = BI.h('<div id="hoverTip"></div>'); document.body.appendChild(t); }
    t.innerHTML = html;
    t.style.display = 'block';
    const r = t.getBoundingClientRect();
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + r.width > innerWidth) x = e.clientX - r.width - 10;
    if (y + r.height > innerHeight) y = e.clientY - r.height - 10;
    t.style.left = x + 'px';
    t.style.top = y + 'px';
  };

  /* ---------- 내보내기 ---------- */
  App.exportPng = function () {
    const sh = App.activeSheet();
    if (sh) {
      const host = BI.$('#view .chart-host');
      if (host && host._ec && host.style.display !== 'none') {
        BI.downloadDataURL((sh.name || 'chart') + '.png', host._ec.getDataURL({ pixelRatio: 2, backgroundColor: '#fff' }));
      } else BI.toast('테이블/KPI는 이미지 대신 CSV·Excel 내보내기 또는 인쇄를 이용하세요.');
      return;
    }
    const db = App.activeDash();
    if (db) App.exportDashPng(db);
  };
  App.resultTable = function (out) {
    const ctx = out && out.ctx;
    if (!ctx || !ctx.res || !ctx.res.dims) return null;
    const res = ctx.res;
    const head = res.dims.map((p) => Q.pillLabel(p, ctx.ds)).concat(res.meas.map((p) => Q.pillLabel(p, ctx.ds)));
    const body = res.rows.map((r) => r.d.map((k, j) => Q.keyLabel(res.dims[j], ctx.ds, k)).concat(r.m.map((v, i) => { const f = Q.measureFormat(res.meas[i], ctx.ds, 'auto'); return f === 'date' ? BI.fmtDate(v) : v; })));
    return [head].concat(body);
  };
  App.rawTable = function (ds, rows, limit) {
    const fs = ds.fields;
    const head = fs.map((f) => f.name);
    const body = rows.slice(0, limit || rows.length).map((r) => fs.map((f) => { const v = r[f.id]; return f.type === 'date' ? BI.fmtDate(v, true) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : v; }));
    return [head].concat(body);
  };
  const toCsv = (aoa) => '﻿' + aoa.map((r) => r.map((v) => { if (v == null) return ''; const s = String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
  App.exportData = function (kind, aoa, name) {
    const sh = App.activeSheet();
    if (!aoa) {
      if (!sh) return;
      const box = BI.$('#view');
      aoa = App.resultTable(box && box._out);
      if (!aoa) aoa = App.rawTable(App.ds(sh.dsId), (box && box._out && box._out.rows) || []);
      name = sh.name;
    }
    if (kind === 'csv') BI.download(name + '.csv', toCsv(aoa), 'text/csv;charset=utf-8');
    else {
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, String(name).slice(0, 30).replace(/[\\/?*[\]:]/g, '_') || 'Sheet1');
      XLSX.writeFile(wb, name + '.xlsx');
    }
  };
  App.viewData = function () {
    const sh = App.activeSheet();
    if (!sh) return;
    const box = BI.$('#view');
    const out = box && box._out;
    const ds = App.ds(sh.dsId);
    if (!ds) return;
    const summ = App.resultTable(out);
    const rows = (out && out.rows) || Q.applyFilters(ds, App.effectiveFilters(sh));
    const raw = App.rawTable(ds, rows, 1000);
    const tbl = (aoa) => '<table class="grid"><thead><tr>' + aoa[0].map((c) => '<th>' + BI.esc(c) + '</th>').join('') + '</tr></thead><tbody>' + aoa.slice(1, 1001).map((r) => '<tr>' + r.map((c) => '<td>' + BI.esc(typeof c === 'number' ? BI.formatNumber(c) : c == null ? '' : c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
    const body = BI.h('<div><div class="seg" id="vdTabs"><button class="on" data-t="s">요약 (' + (summ ? summ.length - 1 : 0).toLocaleString() + '행)</button><button data-t="r">전체 행 (' + rows.length.toLocaleString() + '행)</button></div><div class="vd-body"></div></div>');
    const vb = BI.$('.vd-body', body);
    let cur = 's';
    const show = (t) => { cur = t; vb.innerHTML = t === 's' ? (summ ? tbl(summ) : '<p class="muted">요약 데이터가 없습니다.</p>') : tbl(raw) + (rows.length > 1000 ? '<p class="muted">처음 1,000행만 표시합니다.</p>' : ''); BI.$$('#vdTabs button', body).forEach((b) => b.classList.toggle('on', b.dataset.t === t)); };
    BI.$$('#vdTabs button', body).forEach((b) => (b.onclick = () => show(b.dataset.t)));
    show('s');
    BI.modal({
      title: '데이터 보기 - ' + sh.name, width: 960, body, cls: 'wide',
      buttons: [
        { text: 'CSV 다운로드', left: true, onClick: () => { App.exportData('csv', cur === 's' && summ ? summ : App.rawTable(ds, rows), sh.name + (cur === 's' ? '_요약' : '_전체')); return false; } },
        { text: 'Excel 다운로드', onClick: () => { App.exportData('xlsx', cur === 's' && summ ? summ : App.rawTable(ds, rows), sh.name + (cur === 's' ? '_요약' : '_전체')); return false; } },
        { text: '닫기', primary: true },
      ],
    });
  };

  /* ---------- 도움말 ---------- */
  App.showHelp = function () {
    const fns = Object.entries(BI.Calc.FUNCTIONS).map(([k, v]) => '<tr><td><code>' + k + '</code></td><td>' + BI.esc(v[4]) + '</td></tr>').join('');
    BI.modal({
      title: '사용 안내', width: 760,
      body: '<div class="help">' +
        '<h4>기본 사용법</h4><ol>' +
        '<li><b>데이터 추가</b>: 상단 <i>데이터 추가</i> 버튼 또는 파일을 창에 끌어다 놓으면 CSV · TSV · XLSX · XLS · JSON 파일을 불러옵니다. (UTF-8 / EUC-KR 자동 인식)</li>' +
        '<li><b>시트</b>: 왼쪽 데이터 패널의 <span class="pill-demo dim">차원</span>·<span class="pill-demo mea">측정값</span> 필드를 <b>열/행</b> 선반이나 <b>마크</b> 카드(색상·크기·레이블·세부정보·툴팁)로 드래그하세요. 필드를 더블클릭하면 자동으로 배치됩니다.</li>' +
        '<li><b>표현 방식</b>: 오른쪽 패널에서 차트 종류를 고릅니다. 현재 필드 구성에 맞는 차트가 강조됩니다.</li>' +
        '<li><b>필(pill) 메뉴</b>: 선반의 필을 클릭하면 집계 방식, 날짜 단위, 정렬, 빠른 테이블 계산(누계·구성비·증감률 등)을 바꿀 수 있습니다. 필을 선반 밖으로 끌어내면 제거됩니다.</li>' +
        '<li><b>필터</b>: 필드를 <b>필터</b> 선반에 놓으면 목록 / 범위 / 기간 / 상위 N 필터를 설정할 수 있습니다. "필터 카드 표시"를 켜면 화면 오른쪽(대시보드는 상단)에 빠른 필터가 나타납니다.</li>' +
        '<li><b>차트 클릭</b>: 시트에서 마크를 클릭하면 "이 항목만 유지 / 제외" 필터를 바로 만들 수 있습니다.</li>' +
        '<li><b>대시보드</b>: 왼쪽 목록의 시트를 캔버스로 끌어다 놓고, 머리글을 드래그해 이동, 오른쪽 아래 모서리로 크기를 조절합니다. <b>필터로 사용</b>을 켠 시트를 클릭하면 다른 시트가 해당 값으로 필터링됩니다.</li>' +
        '<li><b>저장</b>: 작업은 브라우저에 자동 저장됩니다. 파일로 공유하려면 <i>파일 → 통합 문서 저장(.obi)</i>을 사용하세요 (데이터 포함).</li>' +
        '</ol><h4>단축키</h4><p><code>Ctrl+Z</code> 실행 취소 · <code>Ctrl+Y</code> 다시 실행 · <code>Ctrl+S</code> 통합 문서 저장 · <code>Ctrl+O</code> 열기</p>' +
        '<h4>계산된 필드 문법</h4><p>필드는 <code>[필드명]</code>, 문자열은 <code>\'텍스트\'</code>. 연산자: <code>+ - * / % ^</code>, 비교 <code>= != &lt; &gt; &lt;= &gt;=</code>, 논리 <code>AND OR NOT</code>, 문자열 연결 <code>&amp;</code>.<br>' +
        '<code>IF [이익] &gt; 0 THEN \'흑자\' ELSEIF [이익] = 0 THEN \'손익분기\' ELSE \'적자\' END</code><br><code>CASE [권역] WHEN \'수도권\' THEN \'수도권\' ELSE \'지방\' END</code><br><code>[이익] / [매출]</code> &nbsp; <code>DATEDIFF(\'day\', [주문일자], [배송일자])</code></p>' +
        '<table class="grid fn-table"><thead><tr><th>함수</th><th>설명</th></tr></thead><tbody>' + fns + '</tbody></table></div>',
    });
  };

  /* ---------- 초기화 ---------- */
  App.init = async function () {
    App.state = App.newState();
    await IDB.open();
    const saved = await IDB.get('workbook');
    if (saved && saved.state && saved.state.datasources) {
      try { App.loadState(saved.state); } catch (e) { console.error(e); App.state = App.newState(); }
    }
    App.bindGlobal();
    App.refresh();
  };

  App.bindGlobal = function () {
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cmd]');
      if (b && !b.disabled) { App.cmd(b.dataset.cmd, b); return; }
      const tab = e.target.closest('.tab');
      if (tab) {
        if (tab.dataset.tab === 'datasource') App.activate('datasource', App.ui.dsPage || null);
        else App.activate(tab.dataset.tab, tab.dataset.id);
      }
    });
    BI.$('#tabs').addEventListener('dblclick', (e) => { const t = e.target.closest('.tab[data-id]'); if (t) App.renameTab(t.dataset.tab, t.dataset.id); });
    BI.$('#tabs').addEventListener('contextmenu', (e) => { const t = e.target.closest('.tab[data-id]'); if (t) { e.preventDefault(); App.tabMenu(t.dataset.tab, t.dataset.id, e.clientX, e.clientY); } });
    BI.$('#fileData').addEventListener('change', (e) => { const f = Array.from(e.target.files); e.target.value = ''; if (f.length) App.addDataFiles(f); });
    BI.$('#fileWb').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) App.openWorkbookFile(f); });
    document.addEventListener('keydown', (e) => {
      if (e.target.closest('input,textarea,select')) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) { e.preventDefault(); App.doUndo(); }
      else if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); App.doRedo(); }
      else if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); App.saveWorkbookFile(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'o') { e.preventDefault(); BI.$('#fileWb').click(); }
    });
    // 파일 드롭 (OS 파일)
    document.addEventListener('dragover', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) { e.preventDefault(); document.body.classList.add('file-over'); } });
    document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('file-over'); });
    document.addEventListener('drop', (e) => {
      document.body.classList.remove('file-over');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        e.preventDefault();
        const fs = Array.from(e.dataTransfer.files);
        const wb = fs.find((f) => /\.obi$/i.test(f.name));
        if (wb) App.openWorkbookFile(wb);
        else App.addDataFiles(fs);
      }
    });
    window.addEventListener('beforeunload', () => { /* 자동 저장됨 */ });
    App.bindDnD();
  };

  window.addEventListener('DOMContentLoaded', () => App.init());
})();
