/* Offline BI - 대시보드 */
(function () {
  'use strict';
  const BI = window.BI, App = BI.App;
  const COLS = 24, ROWH = 10;

  App.renderDashMode = function () {
    const db = App.activeDash();
    const main = BI.$('#main');
    if (!BI.$('.dash-mode', main)) {
      main.innerHTML = '<div class="dash-mode"><aside class="pane dash-side" id="dashSide"></aside><section class="dash-work"><div class="dash-head" id="dashHead"></div><div class="dash-scroll"><div class="dash-canvas" id="dashCanvas"></div></div></section></div>';
      bindDashEvents(BI.$('.dash-mode', main));
    }
    renderSide(db);
    renderHead(db);
    renderCanvas(db);
  };

  function renderSide(db) {
    const used = new Set(db.items.filter((i) => i.type === 'sheet').map((i) => i.sheetId));
    let h = '<div class="pane-hd">대시보드</div><div class="sec-hd">시트 <span class="muted">(캔버스로 드래그)</span></div><ul class="dash-list">';
    App.state.tabs.filter((t) => t.type === 'sheet').forEach((t) => {
      const s = App.sheet(t.id);
      if (!s) return;
      h += '<li draggable="true" data-dash-sheet="' + s.id + '" class="' + (used.has(s.id) ? 'used' : '') + '" title="드래그하여 추가 / 더블클릭하면 빈 곳에 추가">' + App.sheetIcon(s) + '<span>' + BI.esc(s.name) + '</span></li>';
    });
    h += '</ul><div class="sec-hd">개체</div><ul class="dash-list"><li draggable="true" data-dash-obj="text"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 5h14M12 5v14"/></svg><span>텍스트</span></li></ul>';
    h += '<div class="sec-hd">레이아웃</div><div class="opts">';
    h += '<button class="btn sm full" data-dact="auto2">자동 배치 (2열)</button><button class="btn sm full" data-dact="auto1">자동 배치 (1열)</button>';
    h += '<label class="chk"><input type="checkbox" data-dopt="showFilters"' + (db.showFilters !== false ? ' checked' : '') + '> 필터 카드 표시</label>';
    h += '</div><div class="tip-box"><b>사용법</b><br>· 머리글을 끌어 이동, 오른쪽 아래 모서리로 크기 조절<br>· <b>필터로 사용</b>(깔때기 아이콘)을 켠 시트의 마크를 클릭하면 같은 데이터를 쓰는 다른 시트가 필터링됩니다<br>· 빈 곳을 클릭하거나 선택 칩의 닫기 버튼으로 해제</div>';
    BI.$('#dashSide').innerHTML = h;
  }

  function dashFilters(db) {
    const sheets = db.items.filter((i) => i.type === 'sheet').map((i) => App.sheet(i.sheetId)).filter(Boolean);
    const dsIds = new Set(sheets.map((s) => s.dsId));
    const out = [];
    const seen = new Set();
    App.state.globalFilters.forEach((f) => { if (f.card && dsIds.has(f.dsId) && !seen.has(f.id)) { seen.add(f.id); out.push({ f, dsId: f.dsId }); } });
    sheets.forEach((s) => s.filters.forEach((f) => { if (f.card && !seen.has(f.id)) { seen.add(f.id); out.push({ f, dsId: s.dsId, sheet: s }); } }));
    return out;
  }

  /* 대시보드에 적용 중인 조건: 필터 카드 + (카드 없이) 거르고 있는 전역 필터 + 동작 필터 선택 */
  App.dashConds = function (db) {
    const out = [];
    const sheets = db.items.filter((i) => i.type === 'sheet').map((i) => App.sheet(i.sheetId)).filter(Boolean);
    const dsIds = new Set(sheets.map((s) => s.dsId));
    const add = (f, dsId) => { const ds = App.ds(dsId); if (!ds) return; const t = App.filterText(f, ds); out.push({ k: '필터', name: t.name, value: t.value, all: t.all }); };
    dashFilters(db).forEach((x) => add(x.f, x.dsId));
    App.state.globalFilters.forEach((f) => { if (!f.card && dsIds.has(f.dsId)) { const ds = App.ds(f.dsId); if (ds && !App.filterText(f, ds).all) add(f, f.dsId); } });
    if (db.selection) out.push({ k: '선택', name: '', value: db.selection.label });
    return out;
  };

  /* 인쇄용 배치: 개체가 페이지 경계에 걸치면 그 행부터 아래를 다음 페이지로 밀어 냄 (on=false면 원래대로) */
  App.dashPrintLayout = function (db, on) {
    const cv = BI.$('#dashCanvas');
    if (!cv) return;
    const els = new Map(BI.$$('.dash-item', cv).map((e) => [e.dataset.item, e]));
    const maxY = db.items.reduce((a, i) => Math.max(a, i.y + i.h), 0);
    if (!on) {
      db.items.forEach((it) => { const el = els.get(it.id); if (el) itemStyle(el, it); });
      cv.style.height = Math.max(maxY * ROWH + 160, 500) + 'px';
      return;
    }
    const PH = App.PRINT.h;
    const off0 = cv.getBoundingClientRect().top - BI.$('#main').getBoundingClientRect().top;
    const shifts = [];
    const topOf = (it) => it.y * ROWH + shifts.reduce((a, s) => a + (it.y >= s.y ? s.d : 0), 0);
    const hOf = (it) => Math.min(it.h * ROWH, PH - 6);
    const items = db.items.slice().sort((a, b) => a.y - b.y || a.x - b.x);
    items.forEach((it) => {
      const t = off0 + topOf(it), pg = Math.floor(t / PH);
      if (t + hOf(it) > (pg + 1) * PH + 1 && t > pg * PH + 1) shifts.push({ y: it.y, d: (pg + 1) * PH - t });
    });
    let bottom = 0;
    items.forEach((it) => {
      const el = els.get(it.id);
      if (!el) return;
      el.style.top = topOf(it) + 'px';
      el.style.height = hOf(it) + 'px';
      bottom = Math.max(bottom, topOf(it) + hOf(it));
    });
    cv.style.height = bottom + 'px';
  };

  function renderHead(db) {
    const head = BI.$('#dashHead');
    let h = '<div class="dash-title" title="더블클릭하여 편집">' + BI.esc(db.title || db.name) + '</div>';
    if (db.selection) h += '<div class="sel-chip">선택: ' + BI.esc(db.selection.label) + ' <button data-dact="clearSel" title="선택 해제">' + BI.ICON.x + '</button></div>';
    h += '<div class="dash-filters" id="dashFilters"></div><div class="print-cond" id="dashCond">' + App.condHtml(App.dashConds(db)) + '</div>';
    head.innerHTML = h;
    if (db.showFilters === false) return;
    const fl = dashFilters(db);
    const box = BI.$('#dashFilters', head);
    // 데이터 원본별로 렌더
    const byDs = new Map();
    fl.forEach((x) => { if (!byDs.has(x.dsId)) byDs.set(x.dsId, []); byDs.get(x.dsId).push(x.f); });
    byDs.forEach((flts, dsId) => {
      const ds = App.ds(dsId);
      if (!ds) return;
      const sub = document.createElement('div');
      sub.className = 'dash-fgroup';
      box.appendChild(sub);
      App.renderFilterCards(sub, flts, ds, () => { renderCanvas(db); const c = BI.$('#dashCond'); if (c) c.innerHTML = App.condHtml(App.dashConds(db)); }, { compact: true });
    });
  }

  function itemStyle(el, it) {
    el.style.left = (it.x / COLS) * 100 + '%';
    el.style.width = (it.w / COLS) * 100 + '%';
    el.style.top = it.y * ROWH + 'px';
    el.style.height = it.h * ROWH + 'px';
  }

  function renderCanvas(db) {
    const cv = BI.$('#dashCanvas');
    if (!cv) return;
    const maxY = db.items.reduce((a, i) => Math.max(a, i.y + i.h), 0);
    cv.style.height = Math.max(maxY * ROWH + 160, 500) + 'px';
    const existing = new Map(BI.$$('.dash-item', cv).map((e) => [e.dataset.item, e]));
    if (!db.items.length) {
      cv.innerHTML = '<div class="dash-empty"><svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="#9aa7b4" stroke-width="2"><rect x="6" y="8" width="24" height="20" stroke-dasharray="4 3"/><rect x="34" y="8" width="24" height="20" stroke-dasharray="4 3"/><rect x="6" y="32" width="52" height="24" stroke-dasharray="4 3"/></svg><p><b>왼쪽 목록의 시트를 여기로 끌어다 놓으세요</b></p></div>';
      return;
    }
    const empty = BI.$('.dash-empty', cv);
    if (empty) empty.remove();
    const sel = db.selection;
    db.items.forEach((it) => {
      let el = existing.get(it.id);
      existing.delete(it.id);
      const sheet = it.type === 'sheet' ? App.sheet(it.sheetId) : null;
      if (!el) {
        el = BI.h('<div class="dash-item" data-item="' + it.id + '"><div class="di-hd"><span class="di-title"></span><span class="di-btns"></span></div><div class="di-bd"><div class="chart-host"></div><div class="html-host"></div><div class="empty-host"></div></div><div class="di-rs" title="크기 조절"></div></div>');
        cv.appendChild(el);
      }
      itemStyle(el, it);
      el.classList.toggle('is-text', it.type === 'text');
      el.classList.toggle('is-src', !!(sel && sel.src === it.id));
      el.classList.toggle('no-title', it.hideTitle === true);
      const title = BI.$('.di-title', el), btns = BI.$('.di-btns', el);
      if (it.type === 'sheet') {
        title.textContent = sheet ? sheet.title || sheet.name : '(삭제된 시트)';
        title.style.textAlign = (sheet && sheet.options.titleAlign) || 'left';
        btns.innerHTML = '<button data-iact="filter" class="' + (it.filter ? 'on' : '') + '" title="필터로 사용 (클릭한 값으로 다른 시트 필터링)">' + BI.ICON.filter + '</button><button data-iact="menu" title="메뉴">' + BI.ICON.more + '</button><button data-iact="remove" title="제거">' + BI.ICON.x + '</button>';
        const bd = BI.$('.di-bd', el);
        if (sheet) {
          const conds = sel && sel.src !== it.id && sel.dsId === sheet.dsId ? sel.conds : null;
          const focus = sel && sel.src === it.id ? sel.conds : null;
          App.renderChartInto(bd, sheet, { conds, focus, onSelect: (s) => onSelect(db, it, s), emptyHtml: '시트에 필드가 없습니다.' });
        }
      } else {
        title.textContent = '텍스트';
        btns.innerHTML = '<button data-iact="edit" title="편집">' + BI.ICON.edit + '</button><button data-iact="remove" title="제거">' + BI.ICON.x + '</button>';
        const hh = BI.$('.html-host', el);
        BI.$('.chart-host', el).style.display = 'none';
        BI.$('.empty-host', el).style.display = 'none';
        hh.style.display = '';
        hh.innerHTML = '<div class="dash-text" style="font-size:' + (it.size || 14) + 'px;text-align:' + (it.align || 'left') + ';' + (it.bold ? 'font-weight:bold;' : '') + 'color:' + (it.color || '#222') + '">' + BI.esc(it.text || '텍스트를 입력하려면 ✎ 버튼을 누르세요').replace(/\n/g, '<br>') + '</div>';
      }
    });
    existing.forEach((el) => { App.disposeCharts(el); el.remove(); });
  }

  function onSelect(db, it, s) {
    if (!it.filter) return;
    const sheet = App.sheet(it.sheetId);
    if (!s || !s.length) { db.selection = null; }
    else {
      const label = s.map((x) => x.label).join(', ');
      if (db.selection && db.selection.src === it.id && db.selection.label === label) db.selection = null;
      else db.selection = { src: it.id, dsId: sheet.dsId, label, conds: s.map((x) => ({ f: x.f, dp: x.dp, keys: [x.key] })) };
    }
    renderHead(db);
    renderCanvas(db);
    App.autosave();
  }

  /* 겹침 방지: fixed(방금 놓은 개체)는 그대로 두고, 겹치는 개체를 그 아래로 밀어 냄 (격자 단위 유지) */
  function resolveOverlap(items, fixed) {
    const ov = (a, b) => a !== b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const placed = fixed ? [fixed] : [];
    items.filter((i) => i !== fixed).sort((a, b) => a.y - b.y || a.x - b.x).forEach((it) => {
      let hit, guard = 0;
      while ((hit = placed.find((p) => ov(p, it))) && guard++ < 500) it.y = hit.y + hit.h;
      placed.push(it);
    });
    // 위쪽 빈 줄 메우기 (격자 대시보드처럼 위로 붙임)
    items.slice().sort((a, b) => a.y - b.y || a.x - b.x).forEach((it) => {
      while (it.y > 0 && !items.some((o) => o !== it && ov(o, Object.assign({}, it, { y: it.y - 1 })))) it.y--;
    });
  }
  App.dashResolveOverlap = resolveOverlap;

  App.dashDrop = function (cv, d, e) {
    const db = App.activeDash();
    if (!db) return;
    const r = cv.getBoundingClientRect();
    let x = Math.floor(((e.clientX - r.left) / r.width) * COLS);
    let y = Math.max(0, Math.floor((e.clientY - r.top) / ROWH));
    const w = d.kind === 'dashobj' ? 8 : 12, h = d.kind === 'dashobj' ? 6 : 30;
    x = Math.max(0, Math.min(COLS - w, x - 2));
    App.mutate(() => {
      const it = d.kind === 'dashsheet' ? { id: BI.uid('it'), type: 'sheet', sheetId: d.sheetId, x, y, w, h, filter: false } : { id: BI.uid('it'), type: 'text', text: '', x, y, w, h, size: 16, bold: true };
      db.items.push(it);
      resolveOverlap(db.items, it);
    });
  };

  function addAtFreeSpot(db, sheetId) {
    const maxY = db.items.reduce((a, i) => Math.max(a, i.y + i.h), 0);
    App.mutate(() => db.items.push({ id: BI.uid('it'), type: 'sheet', sheetId, x: 0, y: maxY, w: 12, h: 30, filter: false }));
  }

  function autoLayout(db, cols) {
    App.mutate(() => {
      let y = 0, col = 0;
      const texts = db.items.filter((i) => i.type === 'text');
      texts.forEach((t) => { t.x = 0; t.y = y; t.w = COLS; t.h = Math.max(4, Math.min(t.h, 8)); y += t.h; });
      const sheets = db.items.filter((i) => i.type === 'sheet');
      const w = COLS / cols;
      sheets.forEach((it) => {
        const s = App.sheet(it.sheetId);
        const isKpi = s && s.chartType === 'kpi';
        if (isKpi) { if (col) { y += 30; col = 0; } it.x = 0; it.y = y; it.w = COLS; it.h = 15; y += 15; return; }
        it.x = col * w; it.y = y; it.w = w; it.h = 30;
        col++;
        if (col >= cols) { col = 0; y += 30; }
      });
    });
  }

  function editText(db, it) {
    const body = BI.h('<div><textarea class="inp" style="width:100%;height:120px">' + BI.esc(it.text || '') + '</textarea>' +
      '<div class="opt-row"><span>글자 크기</span><input type="number" id="tSize" value="' + (it.size || 14) + '" min="8" max="72"></div>' +
      '<div class="opt-row"><span>정렬</span><select id="tAlign"><option value="left">왼쪽</option><option value="center"' + (it.align === 'center' ? ' selected' : '') + '>가운데</option><option value="right"' + (it.align === 'right' ? ' selected' : '') + '>오른쪽</option></select></div>' +
      '<div class="opt-row"><span>색상</span><input type="color" id="tColor" value="' + (it.color || '#222222') + '"></div>' +
      '<label class="chk"><input type="checkbox" id="tBold"' + (it.bold ? ' checked' : '') + '> 굵게</label></div>');
    BI.modal({
      title: '텍스트 편집', width: 440, body, enterSubmits: false,
      buttons: [{ text: '취소' }, { text: '확인', primary: true, onClick: (bd) => App.mutate(() => { it.text = BI.$('textarea', bd).value; it.size = +BI.$('#tSize', bd).value || 14; it.align = BI.$('#tAlign', bd).value; it.color = BI.$('#tColor', bd).value; it.bold = BI.$('#tBold', bd).checked; }) }],
    });
  }

  function bindDashEvents(root) {
    root.addEventListener('click', (e) => {
      const db = App.activeDash();
      if (!db) return;
      const a = e.target.closest('[data-dact]');
      if (a) {
        if (a.dataset.dact === 'auto2') autoLayout(db, 2);
        if (a.dataset.dact === 'auto1') autoLayout(db, 1);
        if (a.dataset.dact === 'clearSel') { db.selection = null; renderHead(db); renderCanvas(db); App.autosave(); }
        return;
      }
      const ia = e.target.closest('[data-iact]');
      if (ia) {
        const el = ia.closest('.dash-item');
        const it = db.items.find((i) => i.id === el.dataset.item);
        if (!it) return;
        const act = ia.dataset.iact;
        if (act === 'remove') App.mutate(() => { db.items = db.items.filter((i) => i !== it); if (db.selection && db.selection.src === it.id) db.selection = null; });
        else if (act === 'filter') App.mutate(() => { it.filter = !it.filter; if (!it.filter && db.selection && db.selection.src === it.id) db.selection = null; });
        else if (act === 'edit') editText(db, it);
        else if (act === 'menu') {
          const r = ia.getBoundingClientRect();
          BI.menu(r.left, r.bottom, [
            { text: '시트로 이동', onClick: () => App.activate('sheet', it.sheetId) },
            { text: '필터로 사용', checked: !!it.filter, onClick: () => App.mutate(() => { it.filter = !it.filter; }) },
            { text: '제목 숨기기', checked: !!it.hideTitle, onClick: () => App.mutate(() => { it.hideTitle = !it.hideTitle; }) },
            { text: '전체 너비로', onClick: () => App.mutate(() => { it.x = 0; it.w = COLS; resolveOverlap(db.items, it); }) },
            { sep: true },
            { text: '이미지로 저장 (PNG)', onClick: () => { const h = BI.$('.chart-host', el); if (h && h._ec) BI.downloadDataURL((App.sheet(it.sheetId) || {}).name + '.png', h._ec.getDataURL({ pixelRatio: 2, backgroundColor: '#fff' })); else BI.toast('차트가 아닌 항목입니다.'); } },
            { text: '제거', onClick: () => App.mutate(() => { db.items = db.items.filter((i) => i !== it); }) },
          ]);
        }
        return;
      }
      // 빈 캔버스 클릭 시 선택 해제
      if (e.target.classList.contains('dash-canvas') && db.selection) { db.selection = null; renderHead(db); renderCanvas(db); App.autosave(); }
    });
    root.addEventListener('change', (e) => {
      const db = App.activeDash();
      if (db && e.target.dataset.dopt) App.mutate(() => { db[e.target.dataset.dopt] = e.target.checked; });
    });
    root.addEventListener('dblclick', (e) => {
      const db = App.activeDash();
      if (!db) return;
      if (e.target.closest('.dash-title')) return BI.prompt('대시보드 제목', db.title || db.name, (v) => App.mutate(() => { db.title = v; }));
      const li = e.target.closest('[data-dash-sheet]');
      if (li) return addAtFreeSpot(db, li.dataset.dashSheet);
      const t = e.target.closest('.dash-item.is-text');
      if (t) { const it = db.items.find((i) => i.id === t.dataset.item); if (it) editText(db, it); }
    });
    // 이동 / 크기 조절
    root.addEventListener('pointerdown', (e) => {
      const db = App.activeDash();
      if (!db || e.button !== 0) return;
      const hd = e.target.closest('.di-hd');
      const rs = e.target.closest('.di-rs');
      if ((!hd && !rs) || e.target.closest('button')) return;
      const el = e.target.closest('.dash-item');
      const it = db.items.find((i) => i.id === el.dataset.item);
      if (!it) return;
      e.preventDefault();
      const cv = BI.$('#dashCanvas');
      const unitX = cv.getBoundingClientRect().width / COLS;
      const sx = e.clientX, sy = e.clientY;
      const o = { x: it.x, y: it.y, w: it.w, h: it.h };
      const cur = Object.assign({}, o);
      el.classList.add('moving');
      const ghost = BI.h('<div class="dash-ghost"></div>');
      cv.appendChild(ghost);
      const mv = (ev) => {
        const dx = Math.round((ev.clientX - sx) / unitX), dy = Math.round((ev.clientY - sy) / ROWH);
        if (rs) { cur.w = Math.max(3, Math.min(COLS - o.x, o.w + dx)); cur.h = Math.max(6, o.h + dy); }
        else { cur.x = Math.max(0, Math.min(COLS - o.w, o.x + dx)); cur.y = Math.max(0, o.y + dy); }
        itemStyle(ghost, cur);
        if (rs) { el.style.width = ((cur.w / COLS) * 100) + '%'; el.style.height = cur.h * ROWH + 'px'; }
        else { el.style.left = (cur.x / COLS) * 100 + '%'; el.style.top = cur.y * ROWH + 'px'; }
        const need = (cur.y + cur.h) * ROWH + 160;
        if (parseFloat(cv.style.height) < need) cv.style.height = need + 'px';
      };
      const up = () => {
        document.removeEventListener('pointermove', mv);
        document.removeEventListener('pointerup', up);
        el.classList.remove('moving');
        ghost.remove();
        if (cur.x === o.x && cur.y === o.y && cur.w === o.w && cur.h === o.h) return;
        App.lightCommit(() => { Object.assign(it, cur); resolveOverlap(db.items, it); }, () => renderCanvas(db));
      };
      document.addEventListener('pointermove', mv);
      document.addEventListener('pointerup', up);
    });
  }

  /* 대시보드 PNG 내보내기: 제목 + 적용 중인 필터·선택 조건 줄 + 화면과 같은 배치의 개체 */
  App.exportDashPng = async function (db) {
    const cv = BI.$('#dashCanvas');
    if (!cv) return;
    const scale = 2, PAD = 12;
    const W = cv.clientWidth + PAD * 2;
    const maxY = db.items.reduce((a, i) => Math.max(a, i.y + i.h), 0) * ROWH;
    const head = App.imageHeader(db.title || db.name, App.dashConds(db), W - PAD * 2 - 36);
    const HH = head.h + 18; // 머리글 패널 높이
    const TH = PAD + HH + 2;
    const H = TH + maxY + PAD;
    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const g = canvas.getContext('2d');
    g.scale(scale, scale);
    g.fillStyle = BI.cssVar('--canvas', '#eceff3');
    g.fillRect(0, 0, W, H);
    const rr = (x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
    g.fillStyle = BI.cssVar('--panel', '#fff');
    rr(PAD + 4, PAD, W - PAD * 2 - 8, HH, 12); g.fill();
    head.draw(g, PAD + 20, PAD + 10);
    const cvr = cv.getBoundingClientRect();
    const F = BI.Charts.FONT;
    for (const el of BI.$$('.dash-item', cv)) {
      const r = el.getBoundingClientRect();
      const x = r.left - cvr.left + PAD, y = r.top - cvr.top + TH;
      g.fillStyle = BI.cssVar('--panel', '#fff');
      rr(x + 4, y + 4, r.width - 8, r.height - 8, 12); g.fill();
      if (el.classList.contains('is-src')) { g.strokeStyle = BI.cssVar('--accent-line', '#c5d4fb'); g.lineWidth = 2; g.stroke(); }
      if (!el.classList.contains('no-title') && !el.classList.contains('is-text')) {
        const t = BI.$('.di-title', el);
        g.fillStyle = BI.cssVar('--text', '#191f28');
        g.font = '700 13px ' + F;
        g.textBaseline = 'middle';
        const al = t.style.textAlign || 'left';
        g.textAlign = al;
        g.fillText(t.textContent, al === 'center' ? x + r.width / 2 : al === 'right' ? x + r.width - 18 : x + 18, y + 22);
        g.textAlign = 'left';
        g.textBaseline = 'alphabetic';
      }
      const bd = BI.$('.di-bd', el);
      const br = bd.getBoundingClientRect();
      const bx = br.left - cvr.left + PAD, by = br.top - cvr.top + TH;
      const ch = BI.$('.chart-host', el);
      if (ch && ch._ec && ch.style.display !== 'none') {
        const im = await App.loadImage(ch._ec.getDataURL({ pixelRatio: scale, backgroundColor: '#fff' }));
        if (im) g.drawImage(im, bx, by, br.width, br.height);
      } else {
        const hh = BI.$('.html-host', el);
        if (hh && hh.style.display !== 'none') {
          const im = await App.htmlImage(hh, br.width, br.height);
          if (im) g.drawImage(im, bx, by, br.width, br.height);
        }
      }
    }
    App.saveCanvas(canvas, db.name || 'dashboard');
  };
})();
