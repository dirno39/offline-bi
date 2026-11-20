/* Offline BI - 데이터 원본 화면 (시작 화면, 필드 관리, 미리보기, 교체/유니온/조인) */
(function () {
  'use strict';
  const BI = window.BI, App = BI.App, D = BI.Data, Q = BI.Query;

  App.renderDataSourceMode = function () {
    const main = BI.$('#main');
    const st = App.state;
    if (!st.datasources.length) {
      main.innerHTML =
        '<div class="welcome"><div class="welcome-box">' +
        '<div class="wl-intro">' +
        '<div class="wl-logo"><svg viewBox="0 0 32 32" width="52" height="52" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#3563e9"/><rect x="7.5" y="16" width="4.5" height="9" rx="2.25" fill="#fff" fill-opacity=".55"/><rect x="13.75" y="11" width="4.5" height="14" rx="2.25" fill="#fff" fill-opacity=".8"/><rect x="20" y="6.5" width="4.5" height="18.5" rx="2.25" fill="#fff"/></svg></div>' +
        '<h1>파일을 놓으면<br><em>분석</em>이 바로 시작돼요</h1>' +
        '<p class="wl-lead">Offline BI는 인터넷 연결 없이 동작하는 셀프서비스 BI 도구예요. 필드를 끌어다 놓아 차트와 대시보드를 만들고, 데이터는 이 PC 밖으로 나가지 않아요.</p>' +
        '<div class="wl-btns"><button class="btn primary lg" data-cmd="addData">데이터 파일 열기</button><button class="btn lg" data-cmd="sample">샘플 데이터로 시작</button><button class="btn lg ghost" data-cmd="open">통합 문서 열기 (.obi)</button></div>' +
        '<ul class="wl-feat"><li><b>드래그 앤 드롭 분석</b><span>필드를 열·행·마크 선반에 끌어 놓아 시각화</span></li><li><b>30여 종 차트</b><span>막대·라인·콤보·트리맵·히트맵·산점도·워터폴·생키·KPI 등</span></li><li><b>필터 · 계산된 필드</b><span>목록·범위·기간·상위 N 필터, 테이블 계산, 수식</span></li><li><b>대시보드</b><span>필터 카드, 시트 간 동작 필터, PNG·PDF 내보내기</span></li></ul>' +
        '</div>' +
        '<div class="wl-side"><div class="drop-zone" id="dropZone" data-cmd="addData" role="button" tabindex="0" title="클릭해서 파일 선택">' +
        '<div class="dz-ico"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4 14v4.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V14"/></svg></div>' +
        '<p class="dz-title">엑셀 · CSV 파일을 여기로 끌어다 놓으세요</p><p class="dz-sub">UTF-8 / EUC-KR 인코딩 자동 인식 · 여러 시트 선택 가능</p>' +
        '<div class="dz-fmts"><span>CSV</span><span>TSV</span><span>TXT</span><span>XLSX</span><span>XLS</span><span>XLSM</span><span>ODS</span><span>JSON</span></div>' +
        '</div><div class="wl-privacy">' + BI.ICON.shield + '서버·설치·외부 연결 없이 브라우저 안에서만 처리돼요</div></div>' +
        '</div></div>';
      return;
    }
    let ds = App.ds(st.active.id) || App.ds(App.ui.dsPage) || st.datasources[0];
    App.ui.dsPage = ds.id;
    if (!BI.$('.ds-mode', main)) {
      main.innerHTML = '<div class="ds-mode"><aside class="pane ds-side" id="dsSide"></aside><section class="ds-main" id="dsMain"></section></div>';
      bindDsEvents(BI.$('.ds-mode', main));
    }
    // 목록
    let h = '<div class="pane-hd">데이터 원본</div><ul class="ds-list">';
    st.datasources.forEach((d) => {
      h += '<li data-ds="' + d.id + '" class="' + (d.id === ds.id ? 'on' : '') + '"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M3 14h18M9 4v16"/></svg><div><b>' + BI.esc(d.name) + '</b><span>' + d.rows.length.toLocaleString() + '행 · ' + d.fields.length + '열</span></div></li>';
    });
    h += '</ul><div class="opts"><button class="btn full" data-cmd="addData">+ 데이터 파일 추가</button><button class="btn full" data-dsact="join"' + (st.datasources.length < 2 ? ' disabled' : '') + '>조인으로 결합…</button><button class="btn full" data-cmd="sample">샘플 데이터 추가</button></div>';
    BI.$('#dsSide').innerHTML = h;
    renderDsMain(ds);
  };

  function stats(ds) {
    const key = ds.id + ':' + ds.rows.length + ':' + ds.fields.map((f) => f.id + f.type).join(',');
    if (App.ui.statKey === key) return App.ui.stats;
    const lim = Math.min(ds.rows.length, 50000);
    const out = {};
    ds.fields.forEach((f) => {
      const set = new Set();
      let nulls = 0, mn = null, mx = null;
      for (let i = 0; i < lim; i++) {
        const v = ds.rows[i][f.id];
        if (v == null || v === '') { nulls++; continue; }
        if (set.size < 10001) set.add(v);
        if (typeof v === 'number') { if (mn == null || v < mn) mn = v; if (mx == null || v > mx) mx = v; }
      }
      out[f.id] = { distinct: set.size > 10000 ? '10,000+' : set.size.toLocaleString(), nulls, mn, mx, sample: Array.from(set).slice(0, 4) };
    });
    App.ui.statKey = key;
    App.ui.stats = out;
    return out;
  }

  function fmtCell(f, v) {
    if (v == null) return '<span class="null">null</span>';
    if (f.type === 'date') return BI.esc(BI.fmtDate(v, true));
    if (typeof v === 'number') return BI.esc(BI.formatNumber(v));
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    return BI.esc(v);
  }

  function renderDsMain(ds) {
    const s = stats(ds);
    const typeSel = (f) => f.calc ? '<span class="muted">계산</span>' : '<select data-ftype="' + f.id + '">' + [['string', '문자열'], ['number', '숫자'], ['date', '날짜'], ['bool', '부울']].map(([k, n]) => '<option value="' + k + '"' + (f.type === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>';
    let h = '<div class="ds-head"><div><h2 class="ds-name" title="클릭하여 이름 변경">' + BI.esc(ds.name) + '</h2><div class="muted">' + (ds.source ? '원본 파일: ' + BI.esc(ds.source) + ' · ' : '') + ds.rows.length.toLocaleString() + '행 · ' + ds.fields.length + '개 필드</div></div>' +
      '<div class="ds-acts"><button class="btn primary" data-dsact="analyze">새 시트에서 분석 →</button><button class="btn" data-dsact="prep" title="피벗 해제·열 분할·값 정리 등으로 표 구조를 바꿉니다">데이터 정리' + (ds.prep && ds.prep.steps.length ? ' <span class="badge">' + ds.prep.steps.length + '단계</span>' : '') + '…</button><button class="btn" data-dsact="calc">계산된 필드</button><button class="btn" data-dsact="replace" title="같은 구조의 새 파일로 데이터를 교체합니다 (시트 유지)">데이터 교체…</button><button class="btn" data-dsact="union" title="같은 열 구조의 파일을 아래에 추가합니다">행 추가(유니온)…</button><button class="btn" data-dsact="export">CSV 내보내기</button><button class="btn danger" data-dsact="delete">삭제</button></div></div>';
    h += '<div class="ds-body"><div class="ds-fields"><table class="grid"><thead><tr><th>유형</th><th>필드명</th><th>역할</th><th>고유값</th><th>Null</th><th>범위 / 예시</th></tr></thead><tbody>';
    ds.fields.forEach((f) => {
      const st = s[f.id] || {};
      const ex = f.calc ? '<code>' + BI.esc(f.calc) + '</code>' + (f.error ? ' <span class="err-txt">' + BI.esc(f.error) + '</span>' : '') : st.mn != null && f.type === 'number' ? BI.formatNumber(st.mn) + ' ~ ' + BI.formatNumber(st.mx) : st.mn != null && f.type === 'date' ? BI.fmtDate(st.mn) + ' ~ ' + BI.fmtDate(st.mx) : (st.sample || []).map((v) => BI.esc(typeof v === 'boolean' ? String(v) : v)).join(', ');
      h += '<tr><td>' + (App.TYPE_ICON[f.type] || '') + ' ' + typeSel(f) + '</td><td><input class="fname" data-fname="' + f.id + '" value="' + BI.esc(f.name) + '">' + (f.calc ? ' <button class="ibtn sm" data-calcedit="' + f.id + '" title="계산 편집">✎</button>' : '') + '</td>' +
        '<td><select data-frole="' + f.id + '"><option value="dimension"' + (f.role === 'dimension' ? ' selected' : '') + '>차원</option><option value="measure"' + (f.role === 'measure' ? ' selected' : '') + '>측정값</option></select></td>' +
        '<td class="num">' + (st.distinct || '') + '</td><td class="num">' + (st.nulls ? st.nulls.toLocaleString() : '') + '</td><td class="ex">' + ex + '</td></tr>';
    });
    h += '</tbody></table></div>';
    const N = 200;
    h += '<div class="ds-preview"><div class="sec-hd">데이터 미리보기 <span class="muted">(처음 ' + Math.min(N, ds.rows.length) + '행)</span></div><div class="grid-wrap"><table class="grid"><thead><tr><th>#</th>' + ds.fields.map((f) => '<th>' + (App.TYPE_ICON[f.type] || '') + ' ' + BI.esc(f.name) + '</th>').join('') + '</tr></thead><tbody>';
    ds.rows.slice(0, N).forEach((r, i) => { h += '<tr><td class="rn">' + (i + 1) + '</td>' + ds.fields.map((f) => '<td class="' + (f.type === 'number' ? 'num' : '') + '">' + fmtCell(f, r[f.id]) + '</td>').join('') + '</tr>'; });
    h += '</tbody></table></div></div></div>';
    BI.$('#dsMain').innerHTML = h;
  }

  function pickFile(accept) {
    return new Promise((res) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = accept || '.csv,.tsv,.txt,.dat,.prn,.xlsx,.xls,.xlsm,.xlsb,.ods,.json';
      inp.onchange = () => res(inp.files[0] || null);
      inp.click();
    });
  }
  async function loadOne(file) {
    const tables = await D.parseFile(file);
    if (!tables.length) throw new Error('데이터가 없습니다.');
    const t = tables.length > 1 ? (await App.pickTables(file.name, tables))[0] : tables[0];
    return t || null;
  }

  function afterDataChange(ds) {
    D.applyCalcs(ds);
    App.ui.statKey = null;
    App.refresh();
    App.autosave();
  }

  function bindDsEvents(root) {
    root.addEventListener('click', async (e) => {
      const li = e.target.closest('[data-ds]');
      if (li) { App.ui.dsPage = li.dataset.ds; App.state.active = { type: 'datasource', id: li.dataset.ds }; App.refresh(); return; }
      const ds = App.ds(App.ui.dsPage);
      const ce = e.target.closest('[data-calcedit]');
      if (ce && ds) return App.editCalc(ds, D.fieldById(ds, ce.dataset.calcedit));
      if (e.target.closest('.ds-name') && ds) return BI.prompt('데이터 원본 이름', ds.name, (v) => { ds.name = v; App.refresh(); App.autosave(); });
      const a = e.target.closest('[data-dsact]');
      if (!a || a.disabled) return;
      const act = a.dataset.dsact;
      try {
        if (act === 'analyze' && ds) {
          App.mutate(() => { const s = App.newSheet(ds.id); App.state.sheets.push(s); App.state.tabs.push({ type: 'sheet', id: s.id }); App.state.active = { type: 'sheet', id: s.id }; });
        } else if (act === 'calc' && ds) App.editCalc(ds);
        else if (act === 'prep' && ds) App.openPrep(ds);
        else if (act === 'replace' && ds) {
          const f = await pickFile();
          if (!f) return;
          const t = await loadOne(f);
          if (!t) return;
          // 원본만 바꾸고 기존 정리 단계는 그대로 다시 적용
          const src = BI.Prep.ensure(ds);
          const before = ds.fields.filter((x) => !x.calc).map((x) => x.name);
          const ns = BI.Prep.newSource(t);
          Object.assign(src, { raw: ns.raw, text: ns.text, delim: ns.delim, _parsedDelim: ns._parsedDelim, unions: [] });
          if (!src.steps.length) { src.skip = ns.skip; src.headerRows = ns.headerRows; delete src.baseTypes; }
          const errs = BI.Prep.rebuild(ds);
          ds.source = f.name;
          afterDataChange(ds);
          const missing = before.filter((n) => !ds.fields.some((x) => x.name === n));
          const ne = Object.keys(errs).length;
          BI.toast('데이터를 교체했습니다 (' + ds.rows.length.toLocaleString() + '행)' + (src.steps.length ? ' · 정리 단계 ' + src.steps.length + '개 다시 적용' : '') + (ne ? ' · 실패한 단계 ' + ne + '개' : '') + (missing.length ? ' · 새 파일에 없는 필드: ' + missing.join(', ') : ''), missing.length || ne ? 'err' : 'ok');
        } else if (act === 'union' && ds) {
          const f = await pickFile();
          if (!f) return;
          const t = await loadOne(f);
          if (!t) return;
          const before = ds.rows.length;
          const src = BI.Prep.ensure(ds);
          src.unions.push(BI.Prep.normalize(t.aoa));
          BI.Prep.rebuild(ds);
          afterDataChange(ds);
          BI.toast((ds.rows.length - before).toLocaleString() + '행을 추가했습니다.', 'ok');
        } else if (act === 'export' && ds) {
          App.exportData('csv', App.rawTable(ds, ds.rows), ds.name);
        } else if (act === 'delete' && ds) {
          BI.confirm('"' + ds.name + '" 데이터 원본을 삭제할까요? 이 데이터를 사용하는 시트는 비게 됩니다.', () => {
            App.state.datasources = App.state.datasources.filter((d) => d !== ds);
            App.state.globalFilters = App.state.globalFilters.filter((g) => g.dsId !== ds.id);
            App.state.sheets.forEach((s) => { if (s.dsId === ds.id) { s.dsId = App.state.datasources[0] ? null : null; } });
            App.ui.dsPage = null;
            App.state.active = { type: 'datasource', id: null };
            App.undo = []; App.redo = [];
            App.refresh();
            App.autosave();
          });
        } else if (act === 'join') joinDialog();
      } catch (err) {
        console.error(err);
        BI.toast('작업 실패: ' + err.message, 'err');
      }
    });
    root.addEventListener('change', (e) => {
      const ds = App.ds(App.ui.dsPage);
      if (!ds) return;
      const t = e.target;
      if (t.dataset.ftype) {
        const f = D.fieldById(ds, t.dataset.ftype);
        App.setFieldType(ds, f, t.value);
        afterDataChange(ds);
      } else if (t.dataset.frole) {
        D.fieldById(ds, t.dataset.frole).role = t.value;
        App.autosave();
      } else if (t.dataset.fname) {
        const f = D.fieldById(ds, t.dataset.fname);
        const v = t.value.trim();
        if (!v || ds.fields.some((x) => x !== f && x.name.toLowerCase() === v.toLowerCase())) { BI.toast('이름이 비었거나 중복됩니다.', 'err'); t.value = f.name; return; }
        ds.fields.forEach((x) => { if (x.calc) x.calc = BI.Calc.renameRef(x.calc, f.name, v); });
        if (!f.calc) BI.Prep.record(ds, { t: 'rename', col: f.name, to: v });
        f.name = v;
        App.refresh();
        App.autosave();
      }
    });
  }

  function joinDialog() {
    const dss = App.state.datasources;
    const opt = (sel) => dss.map((d) => '<option value="' + d.id + '"' + (d.id === sel ? ' selected' : '') + '>' + BI.esc(d.name) + '</option>').join('');
    const fopt = (d) => d.fields.filter((f) => !f.calc).map((f) => '<option value="' + f.id + '">' + BI.esc(f.name) + '</option>').join('');
    const L0 = App.ds(App.ui.dsPage) || dss[0];
    const R0 = dss.find((d) => d !== L0) || dss[0];
    const body = BI.h('<div class="join-dlg">' +
      '<div class="join-grid"><div><label>왼쪽 테이블</label><select id="jL">' + opt(L0.id) + '</select><label>키 필드</label><select id="jLk">' + fopt(L0) + '</select></div>' +
      '<div class="join-type"><label>조인 유형</label><select id="jT"><option value="inner">내부 조인 (Inner)</option><option value="left" selected>왼쪽 조인 (Left)</option><option value="full">완전 외부 조인 (Full)</option></select></div>' +
      '<div><label>오른쪽 테이블</label><select id="jR">' + opt(R0.id) + '</select><label>키 필드</label><select id="jRk">' + fopt(R0) + '</select></div></div>' +
      '<label>새 데이터 원본 이름</label><input class="inp" id="jN" style="width:100%" value="' + BI.esc(L0.name + ' + ' + R0.name) + '"><p class="muted">조인 결과는 새 데이터 원본으로 만들어집니다. 키 값은 문자열로 비교합니다.</p></div>');
    const sync = (side) => {
      const d = App.ds(BI.$('#j' + side, body).value);
      BI.$('#j' + side + 'k', body).innerHTML = fopt(d);
      // 같은 이름 키 자동 선택
      const other = App.ds(BI.$('#j' + (side === 'L' ? 'R' : 'L'), body).value);
      const lk = BI.$('#j' + side + 'k', body);
      const common = d.fields.find((f) => other.fields.some((g) => g.name === f.name));
      if (common) lk.value = common.id;
      BI.$('#jN', body).value = App.ds(BI.$('#jL', body).value).name + ' + ' + App.ds(BI.$('#jR', body).value).name;
    };
    BI.$('#jL', body).onchange = () => sync('L');
    BI.$('#jR', body).onchange = () => sync('R');
    sync('L'); sync('R');
    BI.modal({
      title: '조인으로 데이터 결합', width: 620, body,
      buttons: [{ text: '취소' }, {
        text: '조인 실행', primary: true, onClick: () => {
          const L = App.ds(BI.$('#jL', body).value), R = App.ds(BI.$('#jR', body).value);
          const nd = D.join(L, R, BI.$('#jLk', body).value, BI.$('#jRk', body).value, BI.$('#jT', body).value, BI.$('#jN', body).value.trim());
          App.state.datasources.push(nd);
          App.ui.dsPage = nd.id;
          App.state.active = { type: 'datasource', id: nd.id };
          App.refresh();
          App.autosave();
          BI.toast('조인 결과: ' + nd.rows.length.toLocaleString() + '행', 'ok');
        },
      }],
    });
  }
})();
