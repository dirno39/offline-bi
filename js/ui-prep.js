/* Offline BI - 데이터 정리(Prep) 편집기
   왼쪽: 흐름(원본 설정 + 변환 단계) / 오른쪽: 도구 모음 + 결과 미리보기 표 */
(function () {
  'use strict';
  const BI = window.BI, App = BI.App, D = BI.Data, P = BI.Prep;
  const LIMIT = 20000;   // 미리보기 계산에 쓰는 원본 행 수 상한
  const SHOW = 150;      // 표에 그리는 행 수

  const TOOLS = [
    ['unpivot', '피벗 해제', '열 → 행', '<path d="M3 4h4v16H3zM10 4h11M10 9h11M10 14h7"/><path d="M17 17l3 3-3 3" transform="translate(0 -3)"/>'],
    ['pivot', '피벗', '행 → 열', '<path d="M4 3v18M9 3v18M14 3v18"/><path d="M17 8h4M19 6l2 2-2 2"/>'],
    ['split', '열 분할', '구분자', '<path d="M12 3v18" stroke-dasharray="2 2"/><rect x="3" y="7" width="7" height="10" rx="1"/><rect x="14" y="7" width="7" height="10" rx="1"/>'],
    ['clean', '값 정리', '공백·괄호·바꾸기', '<path d="M4 20l6-6M14 4l6 6-8 8-6-6z"/>'],
    ['filter', '행 필터', '값·조건', '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>'],
    ['filldown', '아래로 채우기', '빈 칸', '<path d="M12 4v13M7 12l5 5 5-5M5 21h14"/>'],
    ['calc', '계산 열', '수식', '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 13h2M14 13h2M8 17h2M14 17h2"/>'],
    ['aggregate', '그룹·집계', '합계·평균', '<path d="M18 4H6l6 8-6 8h12"/>'],
    ['remove', '열 제거', '', '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'],
    ['dedupe', '중복 제거', '', '<rect x="3" y="3" width="12" height="12" rx="1"/><rect x="9" y="9" width="12" height="12" rx="1"/>'],
    ['transpose', '행↔열', '전치', '<path d="M4 4h7v7H4zM13 13h7v7h-7z"/><path d="M15 4h5v5M9 20H4v-5"/>'],
  ];
  const svg = (p) => '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const opt = (v, t, sel) => '<option value="' + BI.esc(v) + '"' + (sel ? ' selected' : '') + '>' + BI.esc(t) + '</option>';

  App.openPrep = function (ds, opts) {
    opts = opts || {};
    P.ensure(ds);
    const src = ds.prep;
    // 편집용 사본 (원본 배열은 공유, 단계는 복사)
    const work = Object.assign({}, src, { steps: BI.clone(src.steps || []), unions: (src.unions || []).slice() });
    let view = work.steps.length;
    const sel = new Set();
    let lastClick = null;
    let T = null, res = null;

    const body = BI.h('<div class="prep"><aside class="prep-flow"></aside><section class="prep-main"><div class="prep-tools"></div><div class="prep-banner"></div><div class="prep-grid"></div><div class="prep-status"></div></section></div>');
    const flowEl = BI.$('.prep-flow', body), toolsEl = BI.$('.prep-tools', body), bannerEl = BI.$('.prep-banner', body), gridEl = BI.$('.prep-grid', body), statusEl = BI.$('.prep-status', body);

    const rawRows = () => (work.raw || []).length + (work.unions || []).reduce((a, u) => a + u.length, 0);

    function draw() {
      res = P.run(work, view, { limit: rawRows() > LIMIT ? LIMIT : 0 });
      T = res.table;
      Array.from(sel).forEach((c) => { if (!T.cols.includes(c)) sel.delete(c); });
      drawFlow();
      drawTools();
      drawBanner();
      drawGrid();
      const errs = Object.keys(res.errors).length;
      statusEl.innerHTML = '<span><b>' + T.rows.length.toLocaleString() + '</b>행 × <b>' + T.cols.length + '</b>열</span>' +
        (rawRows() > LIMIT ? '<span class="muted">미리보기는 원본 처음 ' + LIMIT.toLocaleString() + '행 기준 · 적용하면 전체 ' + rawRows().toLocaleString() + '행에 실행됩니다</span>' : '') +
        (T.rows.length > SHOW ? '<span class="muted">표에는 처음 ' + SHOW + '행만 보여요</span>' : '') +
        (errs ? '<span class="err-txt">오류가 있는 단계 ' + errs + '개는 건너뛰었어요</span>' : '');
    }

    function drawFlow() {
      let h = '<div class="pf-hd">흐름</div>';
      h += '<div class="pf-card pf-src' + (view === 0 ? ' on' : '') + '" data-view="0"><div class="pf-t"><span class="no">' + svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>') + '</span><div><b>원본</b><span>' + BI.esc(ds.source || ds.name) + ' · ' + rawRows().toLocaleString() + '행' + (work.unions.length ? ' (유니온 ' + work.unions.length + '개 포함)' : '') + '</span></div></div>';
      h += '<div class="pf-set">';
      if (work.text) h += '<label>구분자<select data-src="delim">' + D.DELIMS.map(([k, n]) => opt(k, n, (work.delim || 'auto') === k)).join('') + '</select></label>';
      h += '<label title="표 위쪽의 제목·설명 행을 건너뜁니다">건너뛸 행<input type="number" min="0" max="50" data-src="skip" value="' + (work.skip || 0) + '"></label>';
      h += '<label title="머리글로 쓸 행 수. 2 이상이면 여러 줄 머리글을 합칩니다">머리글 행<input type="number" min="0" max="10" data-src="headerRows" value="' + (work.headerRows == null ? 1 : work.headerRows) + '"></label>';
      if (+work.headerRows > 1) h += '<label title="여러 줄 머리글을 합칠 때 사이에 넣는 문자">머리글 연결<input data-src="headerSep" value="' + BI.esc(work.headerSep || ' | ') + '"></label>';
      h += '</div></div>';
      h += '<div class="pf-hd">변환 단계 <span class="muted">' + work.steps.length + '</span></div>';
      if (!work.steps.length) h += '<div class="pf-empty">위쪽 도구나 열 머리글의 ▾ 메뉴로 단계를 추가하세요. 단계는 언제든 끄거나 지울 수 있어요.</div>';
      work.steps.forEach((st, k) => {
        const [t, d] = P.describe(st);
        const err = res.errors[k];
        h += '<div class="pf-card pf-step' + (view === k + 1 ? ' on' : '') + (view < k + 1 ? ' after' : '') + (err ? ' err' : '') + (st.off ? ' off' : '') + '" data-view="' + (k + 1) + '">' +
          '<div class="pf-t"><span class="no">' + (k + 1) + '</span><div><b>' + BI.esc(t) + '</b><span>' + BI.esc(d) + '</span>' + (err ? '<em>' + BI.esc(err) + '</em>' : '') + '</div></div>' +
          '<div class="pf-btns"><button class="ibtn sm" data-sup="' + k + '" title="위로"' + (k ? '' : ' disabled') + '>↑</button><button class="ibtn sm" data-stog="' + k + '" title="' + (st.off ? '다시 사용' : '잠시 끄기') + '">' + (st.off ? '▶' : '⏸') + '</button><button class="ibtn sm" data-sdel="' + k + '" title="단계 삭제">' + BI.ICON.x + '</button></div></div>';
      });
      flowEl.innerHTML = h;
    }

    function drawTools() {
      toolsEl.innerHTML = TOOLS.map(([k, n, s, ic]) => '<button class="pt-btn" data-pact="' + k + '" title="' + BI.esc(n + (s ? ' (' + s + ')' : '')) + '">' + svg(ic) + '<span>' + n + '</span></button>').join('') +
        '<span class="grow"></span>' + (sel.size ? '<span class="pt-sel">열 ' + sel.size + '개 선택됨 <button class="ibtn sm" data-pact="clearSel">해제</button></span>' : '<span class="pt-sel muted">열 머리글을 클릭해 선택 (Shift: 범위)</span>');
    }

    function drawBanner() {
      let h = '';
      if (view < work.steps.length) h += '<div class="pb info">' + view + '단계까지의 결과를 보고 있어요. 새 단계는 이 위치에 끼워 넣어집니다. <button class="btn sm" data-view-last="1">마지막 단계 보기</button></div>';
      if (!work.steps.length) {
        const sg = P.suggest(work);
        if (sg) h += '<div class="pb tip"><div><b>분석하기 좋은 형태로 바꿀 수 있어요</b><span>숫자 열 ' + sg.numCols + '개가 가로로 펼쳐진 통계표예요. 숫자 열을 행으로 내리면(피벗 해제) <i>' + BI.esc(sg.textCols.concat(sg.steps[0].names, ['값']).join(' · ')) + '</i> 형태가 되어 필터·차트에 쓰기 쉬워집니다.</span></div><button class="btn primary sm" data-pact="suggest">추천 변환 적용</button></div>';
      }
      bannerEl.innerHTML = h;
    }

    function drawGrid() {
      if (!T.cols.length) { gridEl.innerHTML = '<div class="pf-empty">표시할 데이터가 없습니다. 건너뛸 행·머리글 행 설정을 확인하세요.</div>'; return; }
      let h = '<table class="grid prep-tbl"><thead><tr><th class="rn"></th>';
      T.cols.forEach((c, i) => {
        const ty = P.colType(T, i);
        h += '<th data-ci="' + i + '" class="' + (sel.has(c) ? 'sel' : '') + '"><div class="ph">' + (App.TYPE_ICON[ty] || App.TYPE_ICON.string) + '<span class="pn" title="' + BI.esc(c) + '">' + BI.esc(c) + '</span><button class="ibtn sm" data-cmenu="' + i + '" title="열 메뉴">' + BI.ICON.chev + '</button></div></th>';
      });
      h += '</tr></thead><tbody>';
      T.rows.slice(0, SHOW).forEach((r, k) => {
        h += '<tr><td class="rn">' + (k + 1) + '</td>' + r.map((v, i) => '<td class="' + (sel.has(T.cols[i]) ? 'sel ' : '') + (typeof v === 'number' ? 'num' : '') + '">' + (v == null || v === '' ? '<span class="null">null</span>' : BI.esc(typeof v === 'number' ? BI.formatNumber(v) : v)) + '</td>').join('') + '</tr>';
      });
      h += '</tbody></table>';
      const sl = gridEl.scrollLeft;
      gridEl.innerHTML = h;
      gridEl.scrollLeft = sl;
    }

    /* ---------- 단계 추가 ---------- */
    function addStep(st) {
      work.steps.splice(view, 0, st);
      view++;
      sel.clear();
      draw();
      if (res.errors[view - 1]) BI.toast('이 단계를 적용할 수 없어요: ' + res.errors[view - 1], 'err');
    }
    const selOr = (c) => (sel.size ? T.cols.filter((x) => sel.has(x)) : c != null ? [c] : []);
    const colChecks = (checked, id) => '<div class="pd-list" id="' + (id || 'pdCols') + '">' + T.cols.map((c) => '<label class="chk"><input type="checkbox" value="' + BI.esc(c) + '"' + (checked.includes(c) ? ' checked' : '') + '> ' + BI.esc(c) + '</label>').join('') + '</div>';
    const checked = (bd, id) => BI.$$('#' + (id || 'pdCols') + ' input:checked', bd).map((x) => x.value);
    const colSelect = (id, cur) => '<select id="' + id + '">' + T.cols.map((c) => opt(c, c, c === cur)).join('') + '</select>';
    const dlg = (title, html, onOk, width) => BI.modal({ title, width: width || 480, body: BI.h('<div class="pd">' + html + '</div>'), enterSubmits: false, buttons: [{ text: '취소' }, { text: '추가', primary: true, onClick: (bd) => onOk(bd) }] });
    const need = (cols) => { if (!cols.length) { BI.toast('열을 하나 이상 선택하세요.', 'err'); return false; } return true; };

    function dUnpivot(pre) {
      const numeric = T.cols.filter((c, i) => P.isNumericCol(T, i));
      const init = pre && pre.length ? pre : sel.size ? selOr() : numeric;
      const sep = work.headerSep || ' | ';
      const html = '<p class="muted">선택한 열들의 <b>열 이름</b>은 새 이름 열로, <b>값</b>은 하나의 값 열로 내려갑니다. 선택하지 않은 열은 그대로 유지돼요.</p>' +
        '<div class="pd-row"><b>행으로 내릴 열</b><span><button class="btn sm" data-q="num">숫자 열 모두</button> <button class="btn sm" data-q="all">전체</button> <button class="btn sm" data-q="none">해제</button></span></div>' + colChecks(init) +
        '<label class="chk"><input type="checkbox" id="pdSplit"> 열 이름을 <code>' + BI.esc(sep.trim() || sep) + '</code> 기준으로 나눠 여러 열로 만들기 (여러 줄 머리글)</label>' +
        '<div class="pd-grid"><label>이름 열<input id="pdNames" value="항목"></label><label>값 열<input id="pdValue" value="값"></label></div>' +
        '<label class="chk"><input type="checkbox" id="pdNull" checked> 값이 비어 있는 행은 만들지 않기</label>';
      const m = dlg('피벗 해제 (열 → 행)', html, (bd) => {
        const cols = checked(bd);
        if (!need(cols)) return false;
        const names = BI.$('#pdNames', bd).value.split(',').map((x) => x.trim()).filter(Boolean);
        addStep({ t: 'unpivot', cols, names: names.length ? names : ['항목'], sep, value: BI.$('#pdValue', bd).value.trim() || '값', dropNull: BI.$('#pdNull', bd).checked });
      }, 520);
      const bd = m.body;
      const sync = () => {
        const cols = checked(bd);
        const split = BI.$('#pdSplit', bd).checked;
        BI.$('#pdNames', bd).value = split ? P.guessNames(cols.length ? cols : [''], sep).join(', ') : '항목';
        BI.$('#pdNames', bd).previousSibling.textContent = split ? '이름 열 (쉼표로 구분)' : '이름 열';
      };
      const canSplit = init.length && init.every((c) => c.includes(sep));
      BI.$('#pdSplit', bd).checked = !!canSplit;
      sync();
      BI.$('#pdSplit', bd).onchange = sync;
      BI.$('#pdCols', bd).onchange = () => { if (BI.$('#pdSplit', bd).checked) sync(); };
      bd.addEventListener('click', (e) => {
        const q = e.target.closest('[data-q]');
        if (!q) return;
        BI.$$('#pdCols input', bd).forEach((x) => (x.checked = q.dataset.q === 'all' ? true : q.dataset.q === 'none' ? false : numeric.includes(x.value)));
        if (BI.$('#pdSplit', bd).checked) sync();
      });
    }

    function dPivot(col) {
      const num = T.cols.find((c, i) => P.isNumericCol(T, i));
      dlg('피벗 (행 → 열)', '<p class="muted">이름 열의 각 값이 새 열이 되고, 값 열을 집계해 채웁니다. 나머지 열은 행 기준으로 유지돼요.</p>' +
        '<div class="pd-grid"><label>새 열 이름이 될 열' + colSelect('pdKey', col || T.cols.find((c) => c !== num)) + '</label><label>값 열' + colSelect('pdVal', num) + '</label>' +
        '<label>집계<select id="pdAgg">' + Object.entries(P.AGG_NAMES).map(([k, n]) => opt(k, n, k === 'SUM')).join('') + '</select></label></div>', (bd) => {
        const key = BI.$('#pdKey', bd).value, value = BI.$('#pdVal', bd).value;
        if (key === value) { BI.toast('서로 다른 열을 고르세요.', 'err'); return false; }
        addStep({ t: 'pivot', key, value, agg: BI.$('#pdAgg', bd).value });
      });
    }

    function dSplit(col) {
      col = col || selOr()[0] || T.cols[0];
      const sample = (c) => { const i = T.cols.indexOf(c); const r = T.rows.find((x) => x[i] != null && x[i] !== ''); return r ? String(r[i]) : ''; };
      const guessSep = (s) => (s.includes(' | ') ? ' | ' : s.includes('_') ? '_' : s.includes('-') ? '-' : s.includes('/') ? '/' : s.includes(',') ? ',' : ' ');
      const m = dlg('열 분할', '<div class="pd-grid"><label>나눌 열' + colSelect('pdCol', col) + '</label><label>구분자<input id="pdSep"></label><label>나눌 개수<select id="pdN">' + [2, 3, 4, 5, 6].map((n) => opt(n, n + '개')).join('') + '</select></label></div>' +
        '<div class="pd-row"><b>새 열 이름</b></div><div id="pdNamesBox" class="pd-grid"></div><div class="pd-prev" id="pdPrev"></div>' +
        '<label class="chk"><input type="checkbox" id="pdKeep"> 원래 열도 남기기</label><p class="muted">구분자가 개수보다 많으면 나머지는 마지막 열에 그대로 붙어요.</p>', (bd) => {
        const sep = BI.$('#pdSep', bd).value;
        if (!sep) { BI.toast('구분자를 입력하세요.', 'err'); return false; }
        addStep({ t: 'split', col: BI.$('#pdCol', bd).value, sep, names: BI.$$('#pdNamesBox input', bd).map((x, i) => x.value.trim() || BI.$('#pdCol', bd).value + (i + 1)), keep: BI.$('#pdKeep', bd).checked });
      }, 520);
      const bd = m.body;
      const names = () => {
        const c = BI.$('#pdCol', bd).value, n = +BI.$('#pdN', bd).value;
        const cur = BI.$$('#pdNamesBox input', bd).map((x) => x.value);
        BI.$('#pdNamesBox', bd).innerHTML = Array.from({ length: n }, (_, i) => '<label>' + (i + 1) + '<input value="' + BI.esc(cur[i] && !cur[i].startsWith(c) ? cur[i] : c + '_' + (i + 1)) + '"></label>').join('');
        const s = sample(c), sep = BI.$('#pdSep', bd).value;
        BI.$('#pdPrev', bd).innerHTML = s ? '예시: <code>' + BI.esc(s) + '</code> → ' + (sep ? s.split(sep).slice(0, n).map((x) => '<code>' + BI.esc(x.trim()) + '</code>').join(' ') : '') : '';
      };
      const resetSep = () => { BI.$('#pdSep', bd).value = guessSep(sample(BI.$('#pdCol', bd).value)); BI.$('#pdNamesBox', bd).innerHTML = ''; names(); };
      BI.$('#pdCol', bd).onchange = resetSep;
      BI.$('#pdN', bd).onchange = names;
      BI.$('#pdSep', bd).oninput = names;
      resetSep();
    }

    function dClean(col, op) {
      const init = selOr(col);
      const m = dlg('값 정리', '<div class="pd-row"><b>적용할 열</b></div>' + colChecks(init.length ? init : [T.cols[0]]) +
        '<div class="pd-row"><b>정리 방식</b></div><div class="pd-ops">' + P.CLEAN_OPS.map(([k, n]) => '<label class="chk"><input type="radio" name="pdOp" value="' + k + '"' + ((op || 'trim') === k ? ' checked' : '') + '> ' + BI.esc(n) + '</label>').join('') + '</div>' +
        '<div class="pd-grid" id="pdFR"><label id="pdFL">찾을 값<input id="pdFind"></label><label id="pdRL">바꿀 값<input id="pdRepl"></label></div>', (bd) => {
        const cols = checked(bd);
        if (!need(cols)) return false;
        const o = BI.$('input[name=pdOp]:checked', bd).value;
        addStep({ t: 'clean', cols, op: o, find: BI.$('#pdFind', bd).value, repl: BI.$('#pdRepl', bd).value });
      }, 500);
      const bd = m.body;
      const sync = () => {
        const o = BI.$('input[name=pdOp]:checked', bd).value;
        BI.$('#pdFR', bd).style.display = ['replace', 'tonull', 'prefix', 'suffix'].includes(o) ? '' : 'none';
        BI.$('#pdRL', bd).style.display = o === 'replace' ? '' : 'none';
        BI.$('#pdFL', bd).firstChild.textContent = o === 'tonull' ? 'Null로 바꿀 값 (쉼표로 여러 개)' : o === 'prefix' || o === 'suffix' ? '붙일 글자' : '찾을 값';
        if (o === 'tonull' && !BI.$('#pdFind', bd).value) BI.$('#pdFind', bd).value = '-, …, x, X';
      };
      BI.$('.pd-ops', bd).onchange = sync;
      sync();
    }

    function dFilter(col, mode) {
      col = col || selOr()[0] || T.cols[0];
      let m;
      const draw = (bd) => {
        const c = BI.$('#pdCol', bd).value, i = T.cols.indexOf(c);
        const mm = BI.$('.seg button.on', bd).dataset.m;
        let h = '';
        if (mm === 'list') {
          const cnt = new Map();
          T.rows.forEach((r) => { const k = r[i] == null || r[i] === '' ? null : P.cellStr(r[i]); cnt.set(k, (cnt.get(k) || 0) + 1); });
          const vals = Array.from(cnt.entries()).sort((a, b) => BI.cmp(a[0], b[0])).slice(0, 1000);
          h = '<div class="pd-grid"><label class="chk"><input type="radio" name="pdKeep" value="exclude" checked> 선택한 값 제외</label><label class="chk"><input type="radio" name="pdKeep" value="keep"> 선택한 값만 유지</label></div>' +
            '<input id="pdSearch" placeholder="검색" class="inp" style="width:100%;margin:4px 0">' +
            '<div class="pd-list" id="pdVals">' + vals.map(([k, n]) => '<label class="chk"><input type="checkbox" value="' + BI.esc(k == null ? '\u0000' : k) + '"> ' + (k == null ? '<span class="null">null</span>' : BI.esc(k)) + ' <span class="cnt">' + n.toLocaleString() + '</span></label>').join('') + '</div>';
        } else if (mm === 'cond') {
          h = '<div class="pd-grid"><label>조건<select id="pdOp">' + [['=', '같음 (=)'], ['!=', '같지 않음 (≠)'], ['>', '보다 큼 (>)'], ['>=', '이상 (≥)'], ['<', '보다 작음 (<)'], ['<=', '이하 (≤)'], ['contains', '포함'], ['notcontains', '포함하지 않음'], ['starts', '…로 시작'], ['ends', '…로 끝남']].map(([k, n]) => opt(k, n)).join('') + '</select></label><label>값<input id="pdVal"></label></div><p class="muted">조건에 맞는 행만 남습니다. 숫자끼리는 크기로 비교해요.</p>';
        } else h = '<p class="muted">선택한 열이 비어 있는(Null) 행을 제거합니다. 통계표 아래쪽의 주석·출처 행을 지울 때 유용해요.</p>';
        BI.$('#pdBody', bd).innerHTML = h;
        const s = BI.$('#pdSearch', bd);
        if (s) s.oninput = () => BI.$$('#pdVals label', bd).forEach((l) => (l.style.display = l.textContent.toLowerCase().includes(s.value.toLowerCase()) ? '' : 'none'));
      };
      m = dlg('행 필터', '<div class="pd-grid"><label>열' + colSelect('pdCol', col) + '</label></div><div class="seg sm"><button data-m="list">값 선택</button><button data-m="cond">조건</button><button data-m="notnull">Null 제외</button></div><div id="pdBody"></div>', (bd) => {
        const c = BI.$('#pdCol', bd).value;
        const mm = BI.$('.seg button.on', bd).dataset.m;
        if (mm === 'list') {
          const values = BI.$$('#pdVals input:checked', bd).map((x) => (x.value === '\u0000' ? null : x.value));
          if (!values.length) { BI.toast('값을 하나 이상 고르세요.', 'err'); return false; }
          addStep({ t: 'filter', col: c, mode: BI.$('input[name=pdKeep]:checked', bd).value, values });
        } else if (mm === 'cond') addStep({ t: 'filter', col: c, mode: 'cond', op: BI.$('#pdOp', bd).value, value: BI.$('#pdVal', bd).value });
        else addStep({ t: 'filter', col: c, mode: 'notnull' });
      }, 480);
      const bd = m.body;
      const setMode = (mm) => { BI.$$('.seg button', bd).forEach((b) => b.classList.toggle('on', b.dataset.m === mm)); draw(bd); };
      BI.$('.seg', bd).onclick = (e) => { const b = e.target.closest('[data-m]'); if (b) setMode(b.dataset.m); };
      BI.$('#pdCol', bd).onchange = () => draw(bd);
      setMode(mode || 'list');
    }

    function dCalc() {
      const m = dlg('계산 열 추가', '<div class="pd-grid"><label>새 열 이름<input id="pdName" value="계산1"></label></div><label class="pd-lab">수식</label><textarea id="pdExpr" class="inp" spellcheck="false" style="width:100%;height:90px;font-family:var(--mono,monospace)" placeholder="예) [값] / 10000   ·   IF [시도] = \'서울\' THEN \'수도권\' ELSE \'지방\' END"></textarea>' +
        '<div class="calc-status" id="pdSt"></div><div class="pd-row"><b>열 넣기</b></div><div class="pd-chips">' + T.cols.map((c) => '<button class="chip" data-ins="[' + BI.esc(c) + ']">' + BI.esc(c) + '</button>').join('') + '</div><p class="muted">함수 목록은 상단 도움말(?)을 참고하세요. 계산된 필드와 같은 문법이에요.</p>', (bd) => {
        try { compile(bd); } catch (e) { BI.toast('수식 오류: ' + e.message, 'err'); return false; }
        addStep({ t: 'calc', name: BI.$('#pdName', bd).value.trim() || '계산1', expr: BI.$('#pdExpr', bd).value });
      }, 560);
      const bd = m.body;
      function compile(b) {
        const tmp = { fields: T.cols.map((n, i) => ({ id: 'c' + i, name: n, type: P.colType(T, i) })), rows: [] };
        return BI.Calc.compile(BI.$('#pdExpr', b).value, tmp);
      }
      const ta = BI.$('#pdExpr', bd);
      const val = BI.debounce(() => { const st = BI.$('#pdSt', bd); try { const c = compile(bd); st.className = 'calc-status ok'; st.textContent = '✓ 유효한 수식 · 결과: ' + ({ number: '숫자', string: '문자열', date: '날짜', bool: '부울' }[c.type] || c.type); } catch (e) { st.className = 'calc-status err'; st.textContent = '✕ ' + e.message; } }, 250);
      ta.oninput = val;
      BI.$('.pd-chips', bd).onclick = (e) => { const c = e.target.closest('[data-ins]'); if (!c) return; const s = ta.selectionStart; ta.value = ta.value.slice(0, s) + c.dataset.ins + ta.value.slice(ta.selectionEnd); ta.focus(); ta.selectionStart = ta.selectionEnd = s + c.dataset.ins.length; val(); };
      setTimeout(() => ta.focus(), 50);
    }

    function dAggregate(col) {
      const numeric = T.cols.filter((c, i) => P.isNumericCol(T, i));
      const groups = sel.size ? selOr().filter((c) => !numeric.includes(c)) : col ? [col] : T.cols.filter((c) => !numeric.includes(c));
      const row = (c, fn) => '<div class="pd-agg"><select>' + T.cols.map((x) => opt(x, x, x === c)).join('') + '</select><select>' + Object.entries(P.AGG_NAMES).map(([k, n]) => opt(k, n, k === fn)).join('') + '</select><button class="ibtn sm" data-rm="1">' + BI.ICON.x + '</button></div>';
      const m = dlg('그룹 · 집계', '<p class="muted">그룹 기준 열의 값 조합마다 한 행으로 묶고, 나머지는 집계합니다. 다른 열은 사라져요.</p><div class="pd-row"><b>그룹 기준</b></div>' + colChecks(groups, 'pdGroups') +
        '<div class="pd-row"><b>집계</b><button class="btn sm" data-add="1">+ 추가</button></div><div id="pdAggs">' + (numeric.length ? numeric.map((c) => row(c, 'SUM')).join('') : row(T.cols[0], 'COUNT')) + '</div>', (bd) => {
        const aggs = BI.$$('.pd-agg', bd).map((d) => { const s = BI.$$('select', d); return { col: s[0].value, fn: s[1].value }; });
        if (!aggs.length) { BI.toast('집계할 열을 추가하세요.', 'err'); return false; }
        addStep({ t: 'aggregate', groups: checked(bd, 'pdGroups'), aggs });
      }, 520);
      m.body.addEventListener('click', (e) => {
        if (e.target.closest('[data-add]')) BI.$('#pdAggs', m.body).insertAdjacentHTML('beforeend', row(numeric[0] || T.cols[0], 'SUM'));
        const rm = e.target.closest('[data-rm]');
        if (rm) rm.closest('.pd-agg').remove();
      });
    }

    function dPickCols(title, desc, init, cb) {
      dlg(title, '<p class="muted">' + desc + '</p>' + colChecks(init), (bd) => { const cols = checked(bd); if (!need(cols)) return false; cb(cols); });
    }

    function act(a, col) {
      switch (a) {
        case 'suggest': { const sg = P.suggest(work); if (sg) sg.steps.forEach((s) => { work.steps.splice(view, 0, s); view++; }); draw(); BI.toast('추천 변환을 적용했어요. 필요 없는 행(예: 전국 합계)은 행 필터로 지우세요.', 'ok'); break; }
        case 'unpivot': dUnpivot(col ? T.cols.filter((c, i) => c !== col && P.isNumericCol(T, i)) : null); break;
        case 'pivot': dPivot(col); break;
        case 'split': dSplit(col); break;
        case 'clean': dClean(col); break;
        case 'filter': dFilter(col); break;
        case 'filldown': { const c = selOr(col); if (c.length) addStep({ t: 'filldown', cols: c }); else dPickCols('아래로 채우기', '빈 칸을 바로 위의 값으로 채웁니다. 병합 셀을 풀었을 때 유용해요.', [], (cols) => addStep({ t: 'filldown', cols })); break; }
        case 'calc': dCalc(); break;
        case 'aggregate': dAggregate(col); break;
        case 'remove': { const c = selOr(col); if (c.length) addStep({ t: 'remove', cols: c }); else dPickCols('열 제거', '제거할 열을 고르세요.', [], (cols) => addStep({ t: 'remove', cols })); break; }
        case 'dedupe': addStep({ t: 'dedupe' }); break;
        case 'transpose': addStep({ t: 'transpose', first: '항목' }); break;
        case 'clearSel': sel.clear(); draw(); break;
      }
    }

    function colMenu(i, x, y) {
      const c = T.cols[i];
      BI.menu(x, y, [
        { header: c },
        { text: '이름 바꾸기…', onClick: () => BI.prompt('열 이름 바꾸기', c, (v) => { if (v !== c) addStep({ t: 'rename', col: c, to: v }); }) },
        { text: '데이터 유형', sub: [['auto', '자동'], ['string', '문자열'], ['number', '숫자'], ['date', '날짜']].map(([k, n]) => ({ text: n, checked: k === 'auto' ? !T.types[c] : T.types[c] === k, onClick: () => addStep({ t: 'type', col: c, to: k }) })) },
        { sep: true },
        { text: '값 정리', sub: P.CLEAN_OPS.map(([k, n]) => ({ text: n.split(' — ')[0], onClick: () => (['replace', 'tonull', 'prefix', 'suffix'].includes(k) ? dClean(c, k) : addStep({ t: 'clean', cols: [c], op: k })) })) },
        { text: '열 분할…', onClick: () => dSplit(c) },
        { text: '아래로 채우기', onClick: () => addStep({ t: 'filldown', cols: [c] }) },
        { text: '행 필터', sub: [{ text: '값 선택…', onClick: () => dFilter(c, 'list') }, { text: '조건…', onClick: () => dFilter(c, 'cond') }, { text: 'Null 행 제거', onClick: () => addStep({ t: 'filter', col: c, mode: 'notnull' }) }] },
        { sep: true },
        { text: '이 열을 기준으로 나머지 숫자 열 피벗 해제…', onClick: () => act('unpivot', c) },
        { text: '이 열의 값을 열로 피벗…', onClick: () => dPivot(c) },
        { text: '이 열 기준으로 그룹·집계…', onClick: () => dAggregate(c) },
        { sep: true },
        { text: '열 제거', onClick: () => addStep({ t: 'remove', cols: sel.has(c) ? selOr() : [c] }) },
      ]);
    }

    /* ---------- 이벤트 ---------- */
    body.addEventListener('click', (e) => {
      const t = e.target;
      const a = t.closest('[data-pact]');
      if (a) return act(a.dataset.pact);
      if (t.closest('[data-view-last]')) { view = work.steps.length; return draw(); }
      const del = t.closest('[data-sdel]');
      if (del) { const k = +del.dataset.sdel; work.steps.splice(k, 1); if (view > k) view--; return draw(); }
      const tog = t.closest('[data-stog]');
      if (tog) { const st = work.steps[+tog.dataset.stog]; st.off = !st.off; if (!st.off) delete st.off; return draw(); }
      const up = t.closest('[data-sup]');
      if (up) { const k = +up.dataset.sup; if (k > 0) { const s = work.steps.splice(k, 1)[0]; work.steps.splice(k - 1, 0, s); } return draw(); }
      const cm = t.closest('[data-cmenu]');
      if (cm) { const r = cm.getBoundingClientRect(); return colMenu(+cm.dataset.cmenu, r.left, r.bottom + 2); }
      const th = t.closest('th[data-ci]');
      if (th) {
        const i = +th.dataset.ci, c = T.cols[i];
        if (e.shiftKey && lastClick != null) { const [a1, b1] = [Math.min(lastClick, i), Math.max(lastClick, i)]; for (let k = a1; k <= b1; k++) sel.add(T.cols[k]); }
        else if (sel.has(c)) sel.delete(c); else sel.add(c);
        lastClick = i;
        drawTools(); drawGrid();
        return;
      }
      const card = t.closest('[data-view]');
      if (card && !t.closest('input,select')) { view = +card.dataset.view; draw(); }
    });
    body.addEventListener('contextmenu', (e) => { const th = e.target.closest('th[data-ci]'); if (th) { e.preventDefault(); colMenu(+th.dataset.ci, e.clientX, e.clientY); } });
    body.addEventListener('change', (e) => {
      const k = e.target.dataset.src;
      if (!k) return;
      let v = e.target.value;
      if (k === 'skip' || k === 'headerRows') v = Math.max(0, +v || 0);
      if (k === 'headerSep' && !v) v = ' | ';
      work[k] = v;
      view = 0;
      draw();
    });

    BI.modal({
      title: '데이터 정리 — ' + ds.name, cls: 'prep-modal', body, enterSubmits: false, autofocus: false,
      buttons: [
        { text: '원래대로 (모든 단계 지우기)', left: true, onClick: () => { if (!work.steps.length) return false; BI.confirm('변환 단계를 모두 지울까요? (적용 전까지는 원본 데이터 원본에 반영되지 않아요)', () => { work.steps = []; view = 0; draw(); }); return false; } },
        { text: '취소' },
        {
          text: '적용', primary: true, onClick: () => {
            const beforeIds = ds.fields.filter((f) => !f.calc).map((f) => f.id);
            ds.prep = work;
            let errs;
            try { errs = P.rebuild(ds); } catch (err) { console.error(err); BI.toast('적용하지 못했어요: ' + err.message, 'err'); return false; }
            const after = new Set(ds.fields.map((f) => f.id));
            const lost = beforeIds.filter((id) => !after.has(id));
            App.ui.statKey = null;
            App.refresh();
            App.autosave();
            // 사라진 필드를 실제로 쓰고 있는 시트가 있는지 (필·필터의 필드 ID로 확인)
            const used = lost.length && App.state.sheets.some((s) => s.dsId === ds.id && lost.some((id) => JSON.stringify([s.shelves, s.filters]).includes('"f":"' + id + '"')));
            BI.toast('데이터 정리를 적용했어요: ' + ds.rows.length.toLocaleString() + '행 · ' + ds.fields.length + '개 필드' + (Object.keys(errs).length ? ' (오류 단계 ' + Object.keys(errs).length + '개 건너뜀)' : '') + (used ? ' · 사라진 필드를 쓰던 시트는 확인이 필요해요' : ''), 'ok');
          },
        },
      ],
    });
    draw();
    if (opts.message) BI.toast(opts.message);
  };
})();
