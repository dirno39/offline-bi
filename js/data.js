/* Offline BI - 데이터 로딩 / 타입 추론 / 샘플 데이터 */
(function () {
  'use strict';
  const BI = window.BI;
  const D = (BI.Data = {});

  D.COUNT_FIELD = { id: '__count', name: '레코드 수', type: 'number', role: 'measure', virtual: true };

  /* ---------- 파일 읽기 ---------- */
  D.readFile = function (file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsArrayBuffer(file);
    });
  };

  /* 파일 내용(바이트)으로 실제 형식 판별 — 확장자와 다를 수 있음 */
  D.sniff = function (buf) {
    const b = new Uint8Array(buf, 0, Math.min(buf.byteLength, 65536));
    const n = b.length;
    if (n >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return 'zip';
    if (n >= 8 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 && b[4] === 0xa1 && b[5] === 0xb1 && b[6] === 0x1a && b[7] === 0xe1) return 'cfb';
    if (n >= 2 && b[0] === 0xff && b[1] === 0xfe) return 'utf16le';
    if (n >= 2 && b[0] === 0xfe && b[1] === 0xff) return 'utf16be';
    // BOM 없는 UTF-16: 짝수/홀수 위치에 0 바이트가 많음
    let z0 = 0, z1 = 0;
    const m = Math.min(n, 4096) & ~1;
    for (let i = 0; i < m; i += 2) { if (b[i] === 0) z0++; if (b[i + 1] === 0) z1++; }
    if (m >= 8 && z1 > m * 0.2 && z0 < m * 0.02) return 'utf16le';
    if (m >= 8 && z0 > m * 0.2 && z1 < m * 0.02) return 'utf16be';
    // HTML/XML 표 (웹 시스템에서 받은 "xls"가 실제로는 HTML인 경우가 많음)
    let head = '';
    for (let i = 0; i < Math.min(n, 1024); i++) head += String.fromCharCode(b[i]);
    head = head.replace(/^\xef\xbb\xbf/, '').trim().slice(0, 300).toLowerCase();
    if (/^<(\?xml|!doctype html|html|table|meta|head|body)/.test(head) || /<table[\s>]/.test(head)) return 'html';
    // 제어 문자(탭·줄바꿈 제외) 비율이 높으면 텍스트가 아님 → 암호화(DRM)·압축·기타 바이너리
    let ctrl = 0;
    for (let i = 0; i < n; i++) { const c = b[i]; if (c === 0 || (c < 0x09) || (c > 0x0d && c < 0x20 && c !== 0x1b)) ctrl++; }
    if (n > 64 && ctrl / n > 0.01) return 'binary';
    return 'text';
  };
  D.BINARY_MSG = '파일 내용을 읽을 수 없어요. 문서 보안(DRM)으로 암호화되었거나 텍스트·엑셀 형식이 아닌 파일 같아요. 문서 보안 프로그램에서 "복호화" 또는 "일반 문서로 저장"한 뒤 다시 불러오거나, 엑셀에서 CSV(쉼표로 분리) 또는 XLSX로 다시 저장해 주세요.';

  D.decodeText = function (buf, kind) {
    kind = kind || D.sniff(buf);
    if (kind === 'utf16le' || kind === 'utf16be') return new TextDecoder(kind === 'utf16le' ? 'utf-16le' : 'utf-16be').decode(buf).replace(/^\uFEFF/, '');
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
    } catch (e) {
      try {
        return new TextDecoder('euc-kr').decode(buf);
      } catch (e2) {
        return new TextDecoder('utf-8').decode(buf);
      }
    }
  };

  /* 파일 → 테이블 목록 [{name, aoa}] */
  D.parseFile = async function (file) {
    const name = file.name;
    const ext = (name.split('.').pop() || '').toLowerCase();
    const buf = await D.readFile(file);
    const kind = D.sniff(buf);
    const isTextExt = ext === 'csv' || ext === 'tsv' || ext === 'txt' || ext === 'dat' || ext === 'prn';
    // 확장자와 실제 내용이 다른 경우: 엑셀/HTML 표는 엑셀 경로로, 암호화·바이너리는 안내
    if (kind === 'binary') throw new Error(D.BINARY_MSG);
    if (isTextExt && (kind === 'zip' || kind === 'cfb' || kind === 'html')) return D.parseWorkbook(buf, kind);
    if (isTextExt) {
      const text = D.decodeText(buf, kind);
      if (D.looksGarbled(text)) throw new Error(D.BINARY_MSG);
      const delim = ext === 'tsv' ? '\t' : D.detectDelimiter(text);
      // 원본 텍스트는 구분자를 바꿔 다시 읽을 수 있도록 보관 (너무 크면 생략)
      return [{ name: name.replace(/\.[^.]+$/, ''), aoa: D.parseCSV(text, delim), text: text.length < 20e6 ? text : null, delim }];
    }
    if (ext === 'json') {
      const text = D.decodeText(buf);
      let j = JSON.parse(text);
      if (!Array.isArray(j)) {
        const k = Object.keys(j).find((k) => Array.isArray(j[k]));
        if (!k) throw new Error('JSON 배열을 찾을 수 없습니다.');
        j = j[k];
      }
      const cols = [];
      j.forEach((o) => Object.keys(o || {}).forEach((k) => { if (!cols.includes(k)) cols.push(k); }));
      return [{ name: name.replace(/\.[^.]+$/, ''), aoa: [cols].concat(j.map((o) => cols.map((c) => (o || {})[c]))) }];
    }
    if (kind === 'text' || kind === 'utf16le' || kind === 'utf16be') {
      // 엑셀 확장자인데 실제로는 텍스트(CSV/탭) — 웹 시스템 내보내기에서 흔함
      const text = D.decodeText(buf, kind);
      if (!D.looksGarbled(text)) {
        const delim = D.detectDelimiter(text);
        return [{ name: name.replace(/\.[^.]+$/, ''), aoa: D.parseCSV(text, delim), text: text.length < 20e6 ? text : null, delim }];
      }
      throw new Error(D.BINARY_MSG);
    }
    return D.parseWorkbook(buf, kind);
  };

  /* 텍스트로 디코딩한 결과가 깨진 글자투성이인지 */
  D.looksGarbled = function (text) {
    const s = text.slice(0, 50000);
    if (s.length < 50) return false;
    let bad = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c === 0xfffd || c < 0x09 || (c > 0x0d && c < 0x20) || (c >= 0x7f && c <= 0x9f) || (c >= 0xe000 && c <= 0xf8ff)) bad++;
    }
    return bad / s.length > 0.02;
  };

  D.parseWorkbook = function (buf, kind) {
    if (typeof XLSX === 'undefined') throw new Error('엑셀 라이브러리를 불러오지 못했습니다.');
    let wb;
    try {
      wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: false, cellNF: true, cellText: false });
    } catch (e) {
      const msg = String(e && e.message || e);
      if (/password|encrypt|protect/i.test(msg)) throw new Error('암호가 걸린 엑셀 파일이에요. 엑셀에서 암호를 해제하고 다시 저장한 뒤 불러와 주세요.');
      if (kind === 'cfb') throw new Error('엑셀 파일을 열 수 없어요. 암호가 걸려 있거나 문서 보안(DRM)으로 암호화된 파일일 수 있어요. 암호/보안을 해제해 XLSX 또는 CSV로 다시 저장해 주세요.');
      throw new Error(D.BINARY_MSG);
    }
    const out = wb.SheetNames.map((sn) => ({ name: sn, aoa: D.sheetToAoa(wb.Sheets[sn]) })).filter((t) => t.aoa.length > 0);
    // 읽기는 됐는데 내용이 깨진 경우(알 수 없는 형식을 텍스트로 해석) 안내
    const sample = out.slice(0, 3).map((t) => t.aoa.slice(0, 200).map((r) => r.join('\t')).join('\n')).join('\n');
    if (out.length && D.looksGarbled(sample)) throw new Error(D.BINARY_MSG);
    return out;
  };

  D.sheetToAoa = function (ws) {
    if (!ws || !ws['!ref']) return [];
    const range = XLSX.utils.decode_range(ws['!ref']);
    const out = [];
    for (let R = range.s.r; R <= range.e.r; R++) {
      const row = [];
      let any = false;
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        let v = null;
        if (cell) {
          if (cell.t === 'n') {
            const fmt = cell.z;
            if (fmt && typeof fmt === 'string' && XLSX.SSF.is_date(fmt)) {
              const pd = XLSX.SSF.parse_date_code(cell.v);
              v = pd ? new Date(pd.y, pd.m - 1, pd.d, pd.H, pd.M, Math.round(pd.S)) : cell.v;
            } else if (fmt && typeof fmt === 'string' && /^0{2,}$/.test(fmt) && Number.isInteger(cell.v) && cell.v >= 0) {
              // 000000 같은 0 채움 서식의 코드값 → 앞자리 0을 살린 문자열 (5930 → "005930")
              v = String(cell.v).padStart(fmt.length, '0');
            } else v = cell.v;
          } else if (cell.t === 'd') v = cell.v instanceof Date ? cell.v : new Date(cell.v);
          else if (cell.t === 'b') v = cell.v ? 'TRUE' : 'FALSE';
          else if (cell.t === 'e') v = null;
          else v = cell.v;
        }
        if (v !== null && v !== '' && v !== undefined) any = true;
        row.push(v);
      }
      out.push(any ? row : null);
    }
    // 병합 셀(머리글) 처리: 병합 범위 값 채우기
    // 단, 한 줄짜리 병합이 표 전체 폭을 덮으면 제목 행이므로 채우지 않음 (제목 행 감지가 되도록)
    const fullW = range.e.c - range.s.c + 1;
    (ws['!merges'] || []).forEach((m) => {
      const base = out[m.s.r - range.s.r];
      if (!base) return;
      if (m.s.r === m.e.r && m.e.c - m.s.c + 1 >= Math.max(3, fullW - 1)) return;
      const v = base[m.s.c - range.s.c];
      for (let r = m.s.r; r <= m.e.r; r++) {
        const row = out[r - range.s.r];
        if (!row) continue;
        for (let c = m.s.c; c <= m.e.c; c++) if (row[c - range.s.c] == null) row[c - range.s.c] = v;
      }
    });
    return out.filter((r) => r);
  };

  /* ---------- CSV 파서 ---------- */
  /* 구분자 감지: 줄마다 구분자 개수가 일정한지(일관성)로 판단.
     숫자 안의 천 단위 쉼표(1,234)처럼 줄마다 개수가 들쭉날쭉한 문자는 구분자로 보지 않음 */
  D.detectDelimiter = function (text) {
    const lines = text.slice(0, 20000).replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim()).slice(0, 30);
    if (!lines.length) return ',';
    const countIn = (l, d) => { let n = 0, q = false; for (const ch of l) { if (ch === '"') q = !q; else if (!q && ch === d) n++; } return n; };
    const score = (counts) => {
      const freq = new Map();
      counts.forEach((c) => { if (c > 0) freq.set(c, (freq.get(c) || 0) + 1); });
      let mode = 0, mf = 0;
      freq.forEach((f, c) => { if (f > mf || (f === mf && c > mode)) { mode = c; mf = f; } });
      return { mode, cons: mf / counts.length };
    };
    let best = ',', bs = { mode: 0, cons: 0 };
    [',', '\t', ';', '|'].forEach((d) => {
      const sc = score(lines.map((l) => countIn(l, d)));
      if (sc.cons > bs.cons + 1e-9 || (Math.abs(sc.cons - bs.cons) < 1e-9 && sc.mode > bs.mode)) { best = d; bs = sc; }
    });
    // 공백 정렬(2칸 이상 공백): 구분선(-----)은 빼고 판단, 다른 구분자보다 확실히 일관될 때만
    const wl = lines.filter((l) => !/^[\s\-=_+|]+$/.test(l));
    const ws = score(wl.map((l) => (/\S {2,}\S/.test(l.trim()) ? l.trim().split(/\t| {2,}/).length - 1 : 0)));
    if (ws.mode >= 1 && (bs.mode === 0 || ws.cons >= bs.cons + 0.2)) return 'ws';
    return bs.mode ? best : ',';
  };

  D.DELIMS = [['auto', '자동 감지'], [',', '쉼표 (,)'], ['\t', '탭'], [';', '세미콜론 (;)'], ['|', '세로선 (|)'], ['ws', '공백 정렬 (2칸 이상)'], [' ', '공백 1칸']];
  D.parseCSV = function (text, delim) {
    if (!delim || delim === 'auto') delim = D.detectDelimiter(text);
    if (delim === 'ws') {
      // 공백으로 열을 맞춘 텍스트(고정폭): 탭 또는 2칸 이상 공백을 구분자로
      return text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() && !/^[\s\-=_+|]+$/.test(l)).map((l) => l.trim().split(/\t|\s{2,}/).map((v) => v.replace(/^"(.*)"$/, '$1')));
    }
    const rows = [];
    let row = [], f = '', i = 0, q = false;
    const n = text.length;
    while (i < n) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { f += '"'; i += 2; continue; }
          q = false; i++; continue;
        }
        f += c; i++; continue;
      }
      if (c === '"' && f === '') { q = true; i++; continue; }
      if (c === delim) { row.push(f); f = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') {
        row.push(f); f = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = []; i++; continue;
      }
      f += c; i++;
    }
    if (f !== '' || row.length) { row.push(f); if (row.length > 1 || row[0] !== '') rows.push(row); }
    return rows;
  };

  /* ---------- 값 파싱 ---------- */
  const NUM_RE = /^[+-]?(?:[₩$€¥£]\s?)?(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?(?:[eE][+-]?\d+)?\s?(?:%|원)?$/;
  D.parseNumber = function (v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (v instanceof Date) return null;
    let s = String(v).trim();
    if (s === '' || s === '-') return null;
    let neg = false;
    // 잠정·추정치 표기 (1,234 p)) 제거
    s = s.replace(/\s*(\(?[pe]\)|잠정|추정)$/i, '');
    // 등락 부호: ▲ 상승(+), ▼·△·▽ 하락/음수(-)  예) ▲800, ▼500, △1,200
    if (/^[▲△▼▽]/.test(s)) { if (s[0] !== '▲') neg = true; s = s.slice(1).trim(); if (s === '' || s === '-') return s === '' ? NaN : null; }
    if (/^\(.*\)$/.test(s)) { neg = !neg; s = s.slice(1, -1); }
    if (!NUM_RE.test(s) || !/\d/.test(s)) return NaN;
    if (/^[+-]?0\d+$/.test(s)) return NaN; // 앞자리 0 → 코드값
    const pct = /%$/.test(s);
    s = s.replace(/[₩$€¥£,%원\s]/g, '');
    let n = parseFloat(s);
    if (isNaN(n)) return NaN;
    if (pct) n = n / 100;
    return neg ? -n : n;
  };

  const DATE_RES = [
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\.?(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?(?:Z|[+-]\d{2}:?\d{2})?$/,
    /^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  ];
  D.parseDate = function (v, allowCompact) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? NaN : v.getTime();
    if (typeof v === 'number') {
      if (allowCompact && v >= 19000101 && v <= 21001231) v = String(v);
      else return NaN;
    }
    // 잠정치 표기(p), e))와 점 뒤 공백(2024. 01. 05)을 정리
    const s = String(v).trim().replace(/\s*(\(?[pe]\)|잠정|추정)$/i, '').replace(/(\d)\s*([./-])\s*(?=\d)/g, '$1$2').replace(/\.\s*$/, '');
    for (const re of DATE_RES) {
      const m = re.exec(s);
      if (m) {
        const y = +m[1], mo = +m[2], d = +m[3];
        if (mo < 1 || mo > 12 || d < 1 || d > 31) return NaN;
        return new Date(y, mo - 1, d, +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
      }
    }
    let m = /^(\d{4})[-/.](\d{1,2})$/.exec(s) || /^(\d{4})\s*년\s*(\d{1,2})\s*월$/.exec(s);
    if (m && +m[2] >= 1 && +m[2] <= 12) return new Date(+m[1], +m[2] - 1, 1).getTime();
    if (allowCompact) {
      m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
      if (m && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    }
    return NaN;
  };

  D.convert = function (v, type, allowCompact) {
    if (v == null || v === '') return null;
    if (type === 'number') {
      const n = D.parseNumber(v);
      return n == null || isNaN(n) ? null : n;
    }
    if (type === 'date') {
      const n = D.parseDate(v, true);
      return n == null || isNaN(n) ? null : n;
    }
    if (type === 'bool') {
      if (typeof v === 'boolean') return v;
      const s = String(v).toLowerCase();
      return s === 'true' || s === '1' || s === 'y' || s === '참' ? true : s === 'false' || s === '0' || s === 'n' || s === '거짓' ? false : null;
    }
    if (v instanceof Date) return BI.fmtDate(v.getTime(), true);
    if (typeof v === 'number' && type === 'string') return String(v);
    return String(v);
  };

  const DIM_NAME_RE = /(^id$|_id$|\bid\b|코드|code|번호|no\.?$|^no$|우편|zip|연도|year|^년$|년도|^월$|month|전화|phone|사번|학번|key$)/i;
  const DATE_NAME_RE = /(일자|날짜|date|dt$|_dt|일시|기준일|년월|연월|시점|기간)/i;
  // 2024. 01 / 2024.05 p) 처럼 시점 표기가 분명한 문자열 (숫자 2024.05로 보지 않음)
  const YM_STR_RE = /^\d{4}\s*[.\-/]\s*\d{1,2}\s*(\(?[pe]\)|잠정|추정)$|^\d{4}\s*[.\-/]\s+\d{1,2}\.?$/i;

  D.inferType = function (values, name) {
    let n = 0, num = 0, date = 0, compactDate = 0;
    const lim = Math.min(values.length, 3000);
    const step = values.length > lim ? values.length / lim : 1;
    for (let k = 0; k < values.length && n < lim; k += step) {
      const v = values[Math.floor(k)];
      if (v == null || v === '') continue;
      n++;
      if (v instanceof Date) { date++; continue; }
      if (typeof v === 'string' && YM_STR_RE.test(v.trim()) && !isNaN(D.parseDate(v, false))) { date++; continue; }
      const pn = D.parseNumber(v);
      if (pn != null && !isNaN(pn)) {
        num++;
        if (/^\d{8}$/.test(String(v))) compactDate += isNaN(D.parseDate(v, true)) ? 0 : 1;
        continue;
      }
      const pd = D.parseDate(v, false);
      if (pd != null && !isNaN(pd)) date++;
    }
    if (n === 0) return 'string';
    if (date === n) return 'date';
    if (num === n) {
      if (compactDate === n && DATE_NAME_RE.test(name || '')) return 'date';
      return 'number';
    }
    if (num + date === n && date > 0 && DATE_NAME_RE.test(name || '')) return 'date';
    return 'string';
  };

  D.defaultRole = function (type, name) {
    if (type === 'number' && !DIM_NAME_RE.test(name || '')) return 'measure';
    return 'dimension';
  };

  /* aoa(첫 행=머리글) → 데이터 원본 */
  D.buildDataSource = function (name, aoa, opts) {
    opts = opts || {};
    let hi = 0;
    while (hi < aoa.length && !(aoa[hi] || []).some((v) => v != null && v !== '')) hi++;
    const header = (aoa[hi] || []).slice();
    const body = aoa.slice(hi + 1);
    const width = Math.max(header.length, ...body.slice(0, 200).map((r) => r.length));
    const used = {};
    const fields = [];
    for (let c = 0; c < width; c++) {
      let nm = header[c] == null || header[c] === '' ? '열' + (c + 1) : header[c] instanceof Date ? BI.fmtDate(header[c].getTime()) : String(header[c]).trim().replace(/\s+/g, ' ');
      let base = nm, i = 2;
      while (used[nm]) nm = base + ' (' + i++ + ')';
      used[nm] = 1;
      const col = body.map((r) => (r ? r[c] : null));
      const type = (opts.types && opts.types[nm]) || D.inferType(col, nm);
      fields.push({ id: 'f' + c + '_' + Math.random().toString(36).slice(2, 6), name: nm, type, role: D.defaultRole(type, nm), _c: c, _named: !(header[c] == null || header[c] === '') });
    }
    // 머리글도 값도 없는 열만 제거 (이름이 있는 열은 값이 모두 비어도 유지)
    const keep = fields.filter((f) => f._named || body.some((r) => r && r[f._c] != null && r[f._c] !== ''));
    const rows = new Array(body.length);
    const fails = {};
    for (let r = 0; r < body.length; r++) {
      const src = body[r] || [];
      const o = {};
      for (const f of keep) {
        const sv = src[f._c];
        const v = D.convert(sv, f.type);
        if (v == null && sv != null && sv !== '' && !(typeof sv === 'string' && D.isNullToken(sv))) fails[f.name] = (fails[f.name] || 0) + 1;
        o[f.id] = v;
      }
      rows[r] = o;
    }
    keep.forEach((f) => { delete f._c; delete f._named; });
    const ds = { id: BI.uid('ds'), name, fields: keep, rows, rawTypes: {} };
    if (Object.keys(fails).length) ds.convFails = fails;
    return ds;
  };

  /* 필드 데이터 유형 변경 (원본 값 보존을 위해 문자열 경유) */
  /* 통계표의 빈 값 기호 (변환 실패로 세지 않음) */
  D.isNullToken = (s) => /^\s*(-|—|–|…|\.{2,3}|x|X|\*|N\/A|n\/a|NA|#N\/A)\s*$/.test(s);
  D.changeType = function (ds, field, type) {
    const old = field.type;
    if (old === type) return 0;
    let fails = 0;
    for (const r of ds.rows) {
      let v = r[field.id];
      if (old === 'date' && v != null) v = BI.fmtDate(v, true);
      const nv = D.convert(v, type);
      if (nv == null && v != null && v !== '') fails++;
      r[field.id] = nv;
    }
    field.type = type;
    if (type === 'number' && field.role === 'dimension' && !DIM_NAME_RE.test(field.name)) field.role = 'measure';
    if (type !== 'number' && field.role === 'measure') field.role = 'dimension';
    return fails;
  };

  /* 다른 데이터 원본의 행 추가(유니온) - 이름 기준 매칭 */
  D.unionRows = function (ds, newDs) {
    const map = {};
    newDs.fields.forEach((f) => (map[f.name] = f));
    newDs.rows.forEach((r) => {
      const o = {};
      ds.fields.forEach((f) => {
        if (f.calc) return;
        const nf = map[f.name];
        o[f.id] = nf ? D.convert(nf.type === 'date' && r[nf.id] != null ? new Date(r[nf.id]) : r[nf.id], f.type) : null;
      });
      ds.rows.push(o);
    });
  };

  /* 데이터 교체 - 필드 이름 기준 매칭, 기존 필드 ID 유지 */
  D.replaceRows = function (ds, newDs) {
    const map = {};
    newDs.fields.forEach((f) => (map[f.name] = f));
    const missing = ds.fields.filter((f) => !f.calc && !map[f.name]).map((f) => f.name);
    ds.rows = [];
    D.unionRows(ds, newDs);
    // 새로 생긴 필드 추가
    const known = new Set(ds.fields.map((f) => f.name));
    newDs.fields.forEach((nf) => {
      if (known.has(nf.name)) return;
      const f = { id: nf.id, name: nf.name, type: nf.type, role: nf.role };
      ds.fields.push(f);
      ds.rows.forEach((r, i) => (r[f.id] = newDs.rows[i][nf.id]));
    });
    return missing;
  };

  /* 조인 키 정규화: 기본은 문자열 비교, normalize 옵션이면 앞뒤 공백·앞자리 0을 맞춤 (5930 = "005930") */
  D.joinKey = function (v, normalize) {
    if (v == null || v === '') return null;
    let s = String(v);
    if (normalize) {
      s = s.trim();
      if (/^[+-]?\d+(\.0+)?$/.test(s)) s = s.replace(/\.0+$/, '').replace(/^([+-]?)0+(?=\d)/, '$1');
    }
    return s;
  };
  /* 조인 미리보기: 왼쪽 행 중 오른쪽과 맞는 비율, 유형 불일치 */
  D.joinStats = function (left, right, lk, rk, opts) {
    const nz = !!(opts && opts.normalize);
    const lf = D.fieldById(left, lk), rf = D.fieldById(right, rk);
    const keys = new Set();
    right.rows.forEach((r) => { const k = D.joinKey(r[rk], nz); if (k != null) keys.add(k); });
    let n = 0, hit = 0;
    const lkeys = new Set(), lhit = new Set();
    left.rows.forEach((l) => { const k = D.joinKey(l[lk], nz); if (k == null) return; n++; lkeys.add(k); if (keys.has(k)) { hit++; lhit.add(k); } });
    // 정규화하면 더 맞는지 (숫자 코드 ↔ 문자 코드)
    let hitNorm = hit;
    if (!nz) {
      const nk = new Set(); right.rows.forEach((r) => { const k = D.joinKey(r[rk], true); if (k != null) nk.add(k); });
      hitNorm = 0; left.rows.forEach((l) => { const k = D.joinKey(l[lk], true); if (k != null && nk.has(k)) hitNorm++; });
    }
    return { leftRows: left.rows.length, keyed: n, matched: hit, rate: n ? hit / n : 0, distinct: lkeys.size, distinctMatched: lhit.size, rightKeys: keys.size, typeL: lf && lf.type, typeR: rf && rf.type, typeMismatch: !!(lf && rf && lf.type !== rf.type), hitNorm };
  };

  /* 조인 */
  D.join = function (left, right, lk, rk, how, name, opts) {
    const nz = !!(opts && opts.normalize);
    const fields = [];
    const lmap = {}, rmap = {};
    const used = new Set();
    const lcalc = [], rcalc = [];
    left.fields.forEach((f) => {
      const nf = { id: BI.uid('f'), name: f.name, type: f.type, role: f.role };
      if (f.defAgg) nf.defAgg = f.defAgg;
      used.add(nf.name);
      lmap[f.id] = nf.id;
      if (f.calc) { nf.calc = f.calc; lcalc.push(nf); } else fields.push(nf);
    });
    const renamed = [];
    right.fields.forEach((f) => {
      let nm = f.name;
      if (used.has(nm)) { nm = nm + ' (' + right.name + ')'; renamed.push([f.name, nm]); }
      const nf = { id: BI.uid('f'), name: nm, type: f.type, role: f.role };
      if (f.defAgg) nf.defAgg = f.defAgg;
      used.add(nm);
      rmap[f.id] = nf.id;
      if (f.calc) { nf.calc = f.calc; rcalc.push(nf); } else fields.push(nf);
    });
    // 오른쪽 계산 필드 수식은 이름이 바뀐 오른쪽 필드를 가리키도록 갱신
    rcalc.forEach((nf) => { renamed.forEach(([a, b]) => { nf.calc = BI.Calc.renameRef(nf.calc, a, b); }); });
    const idx = new Map();
    right.rows.forEach((r) => {
      const k = D.joinKey(r[rk], nz);
      if (k == null) return;
      if (!idx.has(k)) idx.set(k, []);
      idx.get(k).push(r);
    });
    const rows = [];
    const matchedRight = new Set();
    const mk = (l, r) => {
      const o = {};
      if (l) for (const id in lmap) o[lmap[id]] = l[id] == null ? null : l[id];
      else for (const id in lmap) o[lmap[id]] = null;
      if (r) for (const id in rmap) o[rmap[id]] = r[id] == null ? null : r[id];
      else for (const id in rmap) o[rmap[id]] = null;
      return o;
    };
    left.rows.forEach((l) => {
      const k = D.joinKey(l[lk], nz);
      const m = k == null ? null : idx.get(k);
      if (m) m.forEach((r) => { rows.push(mk(l, r)); matchedRight.add(r); });
      else if (how === 'left' || how === 'full') rows.push(mk(l, null));
    });
    if (how === 'full') right.rows.forEach((r) => { if (!matchedRight.has(r)) rows.push(mk(null, r)); });
    // 계산 필드는 수식을 그대로 유지하고 결과 행에서 다시 계산
    const nd = { id: BI.uid('ds'), name: name || left.name + ' + ' + right.name, fields: fields.concat(lcalc, rcalc), rows };
    nd.joinInfo = { left: left.id, right: right.id, lk, rk, how, normalize: nz };
    D.applyCalcs(nd);
    return nd;
  };

  /* 계산 필드 재계산 */
  D.applyCalcs = function (ds) {
    const errors = [];
    // 집계 계산 여부를 먼저 확정 (다른 집계 계산 필드를 참조하는 경우 순서와 관계없이)
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      ds.fields.forEach((f) => {
        if (!f.calc) return;
        let agg = false;
        try { agg = BI.Calc.compile(f.calc, { fields: ds.fields, rows: [] }, f.id).isAgg; } catch (e) { agg = !!f.aggCalc; }
        if (!!f.aggCalc !== agg) { changed = true; if (agg) f.aggCalc = true; else delete f.aggCalc; }
      });
      if (!changed) break;
    }
    ds.fields.forEach((f) => {
      if (!f.calc) return;
      try {
        const c = BI.Calc.compile(f.calc, ds, f.id);
        f.type = c.type === 'any' ? f.type || 'string' : c.type;
        if (c.isAgg) {
          // 집계 계산: 행 값을 만들지 않고 뷰의 차원 수준에서 계산 (항상 측정값)
          f.aggCalc = true;
          f.role = 'measure';
          f.error = null;
          for (const r of ds.rows) delete r[f.id];
          return;
        }
        delete f.aggCalc;
        for (const r of ds.rows) {
          let v;
          try { v = c.fn(r); } catch (e) { v = null; }
          if (typeof v === 'number' && !isFinite(v)) v = null;
          if (v === undefined) v = null;
          r[f.id] = v;
        }
        f.error = null;
      } catch (e) {
        f.error = e.message;
        errors.push(f.name + ': ' + e.message);
        for (const r of ds.rows) r[f.id] = null;
      }
    });
    return errors;
  };

  D.fieldById = function (ds, id) {
    if (id === '__count') return D.COUNT_FIELD;
    return ds && ds.fields.find((f) => f.id === id);
  };

  /* ---------- 샘플 데이터 (가상의 사무용품 유통사 매출) ---------- */
  D.sampleDataSource = function () {
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const regions = {
      수도권: ['서울', '경기', '인천'],
      영남: ['부산', '대구', '울산', '경남', '경북'],
      호남: ['광주', '전남', '전북'],
      충청: ['대전', '세종', '충남', '충북'],
      강원: ['강원'],
      제주: ['제주'],
    };
    const regionW = [['수도권', 0.45], ['영남', 0.22], ['호남', 0.11], ['충청', 0.13], ['강원', 0.05], ['제주', 0.04]];
    const cats = {
      가구: [['의자', 180000], ['책상', 320000], ['책장', 210000], ['수납장', 150000], ['소파', 450000]],
      사무용품: [['필기구', 8000], ['용지', 25000], ['바인더', 12000], ['라벨', 9000], ['파일', 6000], ['문구세트', 30000]],
      전자기기: [['모니터', 280000], ['노트북', 1350000], ['프린터', 390000], ['키보드', 65000], ['복합기', 820000], ['헤드셋', 95000]],
    };
    const segs = [['개인', 0.5], ['기업', 0.32], ['공공', 0.18]];
    const ships = [['일반배송', 0.6], ['빠른배송', 0.25], ['당일배송', 0.1], ['방문수령', 0.05]];
    const channels = ['온라인몰', '오프라인 매장', '대리점', 'B2B 영업'];
    const wpick = (arr) => {
      let r = rnd(), acc = 0;
      for (const [v, w] of arr) { acc += w; if (r <= acc) return v; }
      return arr[arr.length - 1][0];
    };
    const F = (id, name, type, role) => ({ id, name, type, role });
    const fields = [
      F('order_id', '주문번호', 'string', 'dimension'),
      F('order_date', '주문일자', 'date', 'dimension'),
      F('ship_date', '배송일자', 'date', 'dimension'),
      F('ship_mode', '배송형태', 'string', 'dimension'),
      F('segment', '고객세그먼트', 'string', 'dimension'),
      F('channel', '판매채널', 'string', 'dimension'),
      F('region', '권역', 'string', 'dimension'),
      F('city', '시도', 'string', 'dimension'),
      F('category', '카테고리', 'string', 'dimension'),
      F('subcat', '하위카테고리', 'string', 'dimension'),
      F('sales', '매출', 'number', 'measure'),
      F('qty', '수량', 'number', 'measure'),
      F('discount', '할인율', 'number', 'measure'),
      F('profit', '이익', 'number', 'measure'),
      F('target', '목표매출', 'number', 'measure'),
    ];
    const rows = [];
    const start = new Date(2022, 0, 1).getTime();
    const days = 365 * 3;
    for (let i = 0; i < 6000; i++) {
      let dayOff = Math.floor(Math.pow(rnd(), 0.85) * days);
      const od = new Date(start + dayOff * 86400000);
      const mon = od.getMonth();
      if ((mon === 1 || mon === 6) && rnd() < 0.3) dayOff = Math.min(days - 1, dayOff + 30);
      const odate = new Date(od.getFullYear(), od.getMonth(), od.getDate()).getTime();
      const ship = wpick(ships);
      const lead = ship === '당일배송' ? 0 : ship === '빠른배송' ? 1 + Math.floor(rnd() * 2) : ship === '방문수령' ? Math.floor(rnd() * 3) : 2 + Math.floor(rnd() * 4);
      const region = wpick(regionW);
      const cat = wpick([['가구', 0.25], ['사무용품', 0.45], ['전자기기', 0.3]]);
      const [sub, price] = pick(cats[cat]);
      const qty = 1 + Math.floor(Math.pow(rnd(), 2) * (cat === '사무용품' ? 20 : 6));
      const seg = wpick(segs);
      let disc = rnd() < 0.55 ? 0 : pick([0.05, 0.1, 0.15, 0.2, 0.3, 0.4]);
      if (seg === '공공') disc = Math.min(disc, 0.1);
      const unit = price * (0.85 + rnd() * 0.3);
      const growth = 1 + (od.getFullYear() - 2022) * 0.12;
      const sales = Math.round((unit * qty * (1 - disc) * growth) / 10) * 10;
      const margin = (cat === '전자기기' ? 0.14 : cat === '가구' ? 0.09 : 0.22) - disc * 1.1 + (rnd() - 0.5) * 0.12;
      const profit = Math.round((sales * margin) / 10) * 10;
      rows.push({
        order_id: 'ORD-' + (od.getFullYear() % 100) + String(100000 + i).slice(1),
        order_date: odate,
        ship_date: odate + lead * 86400000,
        ship_mode: ship,
        segment: seg,
        channel: seg === '기업' && rnd() < 0.5 ? 'B2B 영업' : pick(channels),
        region,
        city: pick(regions[region]),
        category: cat,
        subcat: sub,
        sales,
        qty,
        discount: disc,
        profit,
        target: Math.round((sales * (0.85 + rnd() * 0.35)) / 100) * 100,
      });
    }
    rows.sort((a, b) => a.order_date - b.order_date);
    return { id: BI.uid('ds'), name: '샘플_매출데이터', fields, rows };
  };
})();
