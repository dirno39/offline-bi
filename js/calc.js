/* Offline BI - 계산된 필드 수식 엔진 (eval 미사용) */
(function () {
  'use strict';
  const BI = window.BI;
  const C = (BI.Calc = {});

  const KW = ['IF', 'THEN', 'ELSEIF', 'ELSE', 'END', 'CASE', 'WHEN', 'AND', 'OR', 'NOT', 'TRUE', 'FALSE', 'NULL', 'IN'];

  function tokenize(src) {
    const t = [];
    let i = 0;
    const n = src.length;
    while (i < n) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '[') {
        const j = src.indexOf(']', i);
        if (j < 0) throw new Error('닫는 ] 가 없습니다.');
        t.push({ k: 'field', v: src.slice(i + 1, j), p: i });
        i = j + 1; continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1, s = '';
        while (j < n && src[j] !== c) {
          if (src[j] === '\\' && j + 1 < n) { s += src[j + 1]; j += 2; continue; }
          s += src[j++];
        }
        if (j >= n) throw new Error('문자열 따옴표가 닫히지 않았습니다.');
        t.push({ k: 'str', v: s, p: i });
        i = j + 1; continue;
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
        t.push({ k: 'num', v: parseFloat(m[0]), p: i });
        i += m[0].length; continue;
      }
      if (/[A-Za-z_가-힣]/.test(c)) {
        const m = /^[A-Za-z_가-힣][A-Za-z0-9_가-힣]*/.exec(src.slice(i));
        const up = m[0].toUpperCase();
        t.push(KW.includes(up) ? { k: 'kw', v: up, p: i } : { k: 'id', v: up, raw: m[0], p: i });
        i += m[0].length; continue;
      }
      const two = src.substr(i, 2);
      if (['<=', '>=', '!=', '<>', '==', '&&', '||'].includes(two)) {
        t.push({ k: 'op', v: two === '&&' ? 'AND' : two === '||' ? 'OR' : two, p: i });
        i += 2; continue;
      }
      if ('+-*/%^=<>(),&!'.includes(c)) { t.push({ k: 'op', v: c, p: i }); i++; continue; }
      throw new Error('알 수 없는 문자: "' + c + '"');
    }
    t.push({ k: 'eof', p: n });
    return t;
  }

  /* ---------- 날짜 도우미 ---------- */
  const DP = {
    trunc(part, ms) {
      if (ms == null) return null;
      const d = new Date(ms);
      switch (String(part).toLowerCase()) {
        case 'year': return new Date(d.getFullYear(), 0, 1).getTime();
        case 'quarter': return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1).getTime();
        case 'month': return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        case 'week': { const wd = (d.getDay() + 6) % 7; return new Date(d.getFullYear(), d.getMonth(), d.getDate() - wd).getTime(); }
        case 'day': return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        case 'hour': return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime();
        default: throw new Error('알 수 없는 날짜 단위: ' + part);
      }
    },
    part(part, ms) {
      if (ms == null) return null;
      const d = new Date(ms);
      switch (String(part).toLowerCase()) {
        case 'year': return d.getFullYear();
        case 'quarter': return Math.floor(d.getMonth() / 3) + 1;
        case 'month': return d.getMonth() + 1;
        case 'week': { const s = new Date(d.getFullYear(), 0, 1); return Math.ceil(((d - s) / 86400000 + s.getDay() + 1) / 7); }
        case 'day': return d.getDate();
        case 'weekday': return d.getDay() + 1;
        case 'hour': return d.getHours();
        case 'minute': return d.getMinutes();
        default: throw new Error('알 수 없는 날짜 단위: ' + part);
      }
    },
    add(part, n, ms) {
      if (ms == null || n == null) return null;
      const d = new Date(ms);
      switch (String(part).toLowerCase()) {
        case 'year': d.setFullYear(d.getFullYear() + n); break;
        case 'quarter': d.setMonth(d.getMonth() + 3 * n); break;
        case 'month': d.setMonth(d.getMonth() + n); break;
        case 'week': d.setDate(d.getDate() + 7 * n); break;
        case 'day': d.setDate(d.getDate() + n); break;
        case 'hour': d.setHours(d.getHours() + n); break;
        default: throw new Error('알 수 없는 날짜 단위: ' + part);
      }
      return d.getTime();
    },
    diff(part, a, b) {
      if (a == null || b == null) return null;
      const A = new Date(a), B = new Date(b);
      switch (String(part).toLowerCase()) {
        case 'year': return B.getFullYear() - A.getFullYear();
        case 'quarter': return (B.getFullYear() - A.getFullYear()) * 4 + Math.floor(B.getMonth() / 3) - Math.floor(A.getMonth() / 3);
        case 'month': return (B.getFullYear() - A.getFullYear()) * 12 + B.getMonth() - A.getMonth();
        case 'week': return Math.floor((DP.trunc('week', b) - DP.trunc('week', a)) / (7 * 86400000) + 0.5);
        case 'day': return Math.round((DP.trunc('day', b) - DP.trunc('day', a)) / 86400000);
        case 'hour': return Math.floor((b - a) / 3600000);
        case 'minute': return Math.floor((b - a) / 60000);
        default: throw new Error('알 수 없는 날짜 단위: ' + part);
      }
    },
  };
  C.DP = DP;

  const num = (v) => (v == null || v === '' ? null : typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : isNaN(+v) ? null : +v);
  const str = (v) => (v == null ? null : String(v));
  const nn = (f) => function () { for (let i = 0; i < arguments.length; i++) if (arguments[i] == null) return null; return f.apply(null, arguments); };

  /* 함수 정의: [최소인자, 최대인자, 반환형, 구현, 설명] */
  const FN = {
    ABS: [1, 1, 'number', nn((x) => Math.abs(num(x))), 'ABS(숫자) 절대값'],
    ROUND: [1, 2, 'number', (x, d) => { x = num(x); if (x == null) return null; const p = Math.pow(10, num(d) || 0); return Math.round(x * p) / p; }, 'ROUND(숫자, [자릿수]) 반올림'],
    CEILING: [1, 1, 'number', nn((x) => Math.ceil(num(x))), 'CEILING(숫자) 올림'],
    FLOOR: [1, 1, 'number', nn((x) => Math.floor(num(x))), 'FLOOR(숫자) 내림'],
    SQRT: [1, 1, 'number', nn((x) => Math.sqrt(num(x))), 'SQRT(숫자) 제곱근'],
    POWER: [2, 2, 'number', nn((x, y) => Math.pow(num(x), num(y))), 'POWER(숫자, 지수)'],
    EXP: [1, 1, 'number', nn((x) => Math.exp(num(x))), 'EXP(숫자)'],
    LN: [1, 1, 'number', nn((x) => Math.log(num(x))), 'LN(숫자) 자연로그'],
    LOG: [1, 2, 'number', (x, b) => (x == null ? null : Math.log(num(x)) / Math.log(b == null ? 10 : num(b))), 'LOG(숫자, [밑=10])'],
    SIGN: [1, 1, 'number', nn((x) => Math.sign(num(x))), 'SIGN(숫자) 부호'],
    PI: [0, 0, 'number', () => Math.PI, 'PI()'],
    DIV: [2, 2, 'number', (a, b) => { a = num(a); b = num(b); return a == null || !b ? null : a / b; }, 'DIV(a, b) 0으로 나누기 안전'],
    MIN: [1, 99, 'any', function () { let m = null; for (const a of arguments) if (a != null && (m == null || a < m)) m = a; return m; }, 'MIN(a, b, ...) 행 단위 최소'],
    MAX: [1, 99, 'any', function () { let m = null; for (const a of arguments) if (a != null && (m == null || a > m)) m = a; return m; }, 'MAX(a, b, ...) 행 단위 최대'],
    ZN: [1, 1, 'number', (x) => (num(x) == null ? 0 : num(x)), 'ZN(숫자) Null이면 0'],
    ISNULL: [1, 1, 'bool', (x) => x == null || x === '', 'ISNULL(값)'],
    IFNULL: [2, 2, 'any', (a, b) => (a == null || a === '' ? b : a), 'IFNULL(값, 대체값)'],
    LEN: [1, 1, 'number', nn((s) => str(s).length), 'LEN(문자열) 길이'],
    LEFT: [2, 2, 'string', nn((s, n) => str(s).slice(0, num(n))), 'LEFT(문자열, 개수)'],
    RIGHT: [2, 2, 'string', nn((s, n) => (num(n) <= 0 ? '' : str(s).slice(-num(n)))), 'RIGHT(문자열, 개수)'],
    MID: [2, 3, 'string', (s, a, l) => (s == null ? null : l == null ? str(s).slice(num(a) - 1) : str(s).substr(num(a) - 1, num(l))), 'MID(문자열, 시작, [길이]) 1부터 시작'],
    UPPER: [1, 1, 'string', nn((s) => str(s).toUpperCase()), 'UPPER(문자열)'],
    LOWER: [1, 1, 'string', nn((s) => str(s).toLowerCase()), 'LOWER(문자열)'],
    TRIM: [1, 1, 'string', nn((s) => str(s).trim()), 'TRIM(문자열)'],
    LTRIM: [1, 1, 'string', nn((s) => str(s).replace(/^\s+/, '')), 'LTRIM(문자열)'],
    RTRIM: [1, 1, 'string', nn((s) => str(s).replace(/\s+$/, '')), 'RTRIM(문자열)'],
    CONTAINS: [2, 2, 'bool', nn((s, t) => str(s).includes(str(t))), 'CONTAINS(문자열, 찾을값)'],
    STARTSWITH: [2, 2, 'bool', nn((s, t) => str(s).startsWith(str(t))), 'STARTSWITH(문자열, 접두어)'],
    ENDSWITH: [2, 2, 'bool', nn((s, t) => str(s).endsWith(str(t))), 'ENDSWITH(문자열, 접미어)'],
    REPLACE: [3, 3, 'string', nn((s, a, b) => str(s).split(str(a)).join(str(b))), 'REPLACE(문자열, 찾기, 바꾸기)'],
    FIND: [2, 2, 'number', nn((s, t) => str(s).indexOf(str(t)) + 1), 'FIND(문자열, 찾을값) 위치(없으면 0)'],
    SPLIT: [3, 3, 'string', nn((s, d, i) => { const p = str(s).split(str(d)); i = num(i); const v = i > 0 ? p[i - 1] : p[p.length + i]; return v == null ? null : v; }), 'SPLIT(문자열, 구분자, 번호)'],
    CONCAT: [1, 99, 'string', function () { return Array.from(arguments).map((a) => (a == null ? '' : a)).join(''); }, 'CONCAT(a, b, ...)'],
    STR: [1, 1, 'string', (x) => (x == null ? null : typeof x === 'number' && x > 1e11 && x < 5e12 ? String(x) : String(x)), 'STR(값) 문자열 변환'],
    INT: [1, 1, 'number', (x) => { x = num(x); return x == null ? null : Math.trunc(x); }, 'INT(값) 정수 변환'],
    FLOAT: [1, 1, 'number', (x) => num(x), 'FLOAT(값) 숫자 변환'],
    YEAR: [1, 1, 'number', (d) => DP.part('year', d), 'YEAR(날짜)'],
    QUARTER: [1, 1, 'number', (d) => DP.part('quarter', d), 'QUARTER(날짜)'],
    MONTH: [1, 1, 'number', (d) => DP.part('month', d), 'MONTH(날짜)'],
    DAY: [1, 1, 'number', (d) => DP.part('day', d), 'DAY(날짜)'],
    WEEKDAY: [1, 1, 'number', (d) => DP.part('weekday', d), 'WEEKDAY(날짜) 1=일요일'],
    DATEPART: [2, 2, 'number', (p, d) => DP.part(p, d), "DATEPART('month', 날짜)"],
    DATETRUNC: [2, 2, 'date', (p, d) => DP.trunc(p, d), "DATETRUNC('month', 날짜)"],
    DATEADD: [3, 3, 'date', (p, n, d) => DP.add(p, num(n), d), "DATEADD('day', 7, 날짜)"],
    DATEDIFF: [3, 3, 'number', (p, a, b) => DP.diff(p, a, b), "DATEDIFF('day', 시작, 종료)"],
    TODAY: [0, 0, 'date', () => DP.trunc('day', Date.now()), 'TODAY()'],
    NOW: [0, 0, 'date', () => Date.now(), 'NOW()'],
    MAKEDATE: [3, 3, 'date', nn((y, m, d) => new Date(num(y), num(m) - 1, num(d)).getTime()), 'MAKEDATE(연, 월, 일)'],
    DATE: [1, 1, 'date', (x) => { if (x == null) return null; if (typeof x === 'number') return x; const v = BI.Data.parseDate(x, true); return isNaN(v) ? null : v; }, 'DATE(값) 날짜 변환'],
    IIF: [3, 4, 'any', null, 'IIF(조건, 참일때, 거짓일때)'],
  };
  C.FUNCTIONS = FN;

  function Parser(tokens, ds, selfId) {
    let i = 0;
    const peek = () => tokens[i];
    const next = () => tokens[i++];
    const isOp = (v) => peek().k === 'op' && peek().v === v;
    const isKw = (v) => peek().k === 'kw' && peek().v === v;
    const expect = (k, v) => {
      const t = next();
      if (t.k !== k || (v && t.v !== v)) throw new Error((v || k) + ' 이(가) 필요합니다 (위치 ' + t.p + ')');
      return t;
    };
    const fieldsByName = {};
    ds.fields.forEach((f) => (fieldsByName[f.name.toLowerCase()] = f));
    const refs = new Set();

    const truthy = (v) => v != null && v !== false && v !== 0 && v !== '';

    function parseExpr() { return parseOr(); }
    function parseOr() {
      let l = parseAnd();
      while (isKw('OR') || isOp('OR')) {
        next();
        const r = parseAnd(), a = l;
        l = { t: 'bool', f: (row) => truthy(a.f(row)) || truthy(r.f(row)) };
      }
      return l;
    }
    function parseAnd() {
      let l = parseNot();
      while (isKw('AND') || isOp('AND')) {
        next();
        const r = parseNot(), a = l;
        l = { t: 'bool', f: (row) => truthy(a.f(row)) && truthy(r.f(row)) };
      }
      return l;
    }
    function parseNot() {
      if (isKw('NOT') || isOp('!')) {
        next();
        const e = parseNot();
        return { t: 'bool', f: (row) => { const v = e.f(row); return v == null ? null : !truthy(v); } };
      }
      return parseCmp();
    }
    function parseCmp() {
      const l = parseAdd();
      if (peek().k === 'op' && ['=', '==', '!=', '<>', '<', '>', '<=', '>='].includes(peek().v)) {
        const op = next().v;
        const r = parseAdd();
        const cmp = (a, b) => {
          if (a == null || b == null) return null;
          if (typeof a !== typeof b) {
            if (typeof a === 'number' && !isNaN(+b)) b = +b;
            else if (typeof b === 'number' && !isNaN(+a)) a = +a;
            else { a = String(a); b = String(b); }
          }
          switch (op) {
            case '=': case '==': return a === b;
            case '!=': case '<>': return a !== b;
            case '<': return a < b;
            case '>': return a > b;
            case '<=': return a <= b;
            case '>=': return a >= b;
          }
        };
        return { t: 'bool', f: (row) => cmp(l.f(row), r.f(row)) };
      }
      if (isKw('IN')) {
        next();
        expect('op', '(');
        const items = [parseExpr()];
        while (isOp(',')) { next(); items.push(parseExpr()); }
        expect('op', ')');
        return { t: 'bool', f: (row) => { const v = l.f(row); if (v == null) return null; return items.some((it) => it.f(row) == v); } };
      }
      return l;
    }
    function parseAdd() {
      let l = parseMul();
      while (peek().k === 'op' && ['+', '-', '&'].includes(peek().v)) {
        const op = next().v;
        const r = parseMul(), a = l;
        if (op === '&') l = { t: 'string', f: (row) => { const x = a.f(row), y = r.f(row); return (x == null ? '' : String(x)) + (y == null ? '' : String(y)); } };
        else if (op === '+') {
          const t = a.t === 'string' || r.t === 'string' ? 'string' : a.t === 'date' && r.t === 'number' ? 'date' : a.t === 'number' && r.t === 'number' ? 'number' : 'any';
          l = {
            t,
            f: (row) => {
              const x = a.f(row), y = r.f(row);
              if (x == null || y == null) return null;
              if (typeof x === 'string' || typeof y === 'string') return String(x) + String(y);
              if (a.t === 'date' && r.t === 'number') return x + y * 86400000;
              return x + y;
            },
          };
        } else {
          const t = a.t === 'date' && r.t === 'date' ? 'number' : a.t === 'date' ? 'date' : 'number';
          l = {
            t,
            f: (row) => {
              const x = a.f(row), y = r.f(row);
              if (x == null || y == null) return null;
              if (a.t === 'date' && r.t === 'date') return (x - y) / 86400000;
              if (a.t === 'date') return x - y * 86400000;
              return num(x) - num(y);
            },
          };
        }
      }
      return l;
    }
    function parseMul() {
      let l = parseUnary();
      while (peek().k === 'op' && ['*', '/', '%'].includes(peek().v)) {
        const op = next().v;
        const r = parseUnary(), a = l;
        l = {
          t: 'number',
          f: (row) => {
            const x = num(a.f(row)), y = num(r.f(row));
            if (x == null || y == null) return null;
            if (op === '*') return x * y;
            if (y === 0) return null;
            return op === '/' ? x / y : x % y;
          },
        };
      }
      return l;
    }
    function parseUnary() {
      if (isOp('-')) { next(); const e = parseUnary(); return { t: 'number', f: (row) => { const v = num(e.f(row)); return v == null ? null : -v; } }; }
      if (isOp('+')) { next(); return parseUnary(); }
      return parsePow();
    }
    function parsePow() {
      const b = parsePrimary();
      if (isOp('^')) {
        next();
        const e = parseUnary();
        return { t: 'number', f: (row) => { const x = num(b.f(row)), y = num(e.f(row)); return x == null || y == null ? null : Math.pow(x, y); } };
      }
      return b;
    }
    function parsePrimary() {
      const t = peek();
      if (t.k === 'num') { next(); return { t: 'number', f: () => t.v, c: t.v }; }
      if (t.k === 'str') { next(); return { t: 'string', f: () => t.v, c: t.v }; }
      if (t.k === 'field') {
        next();
        const f = fieldsByName[t.v.trim().toLowerCase()];
        if (!f) throw new Error('필드를 찾을 수 없습니다: [' + t.v + ']');
        if (f.id === selfId) throw new Error('자기 자신을 참조할 수 없습니다.');
        refs.add(f.id);
        const id = f.id;
        return { t: f.type, f: (row) => { const v = row[id]; return v === undefined ? null : v; } };
      }
      if (t.k === 'kw') {
        if (t.v === 'TRUE') { next(); return { t: 'bool', f: () => true }; }
        if (t.v === 'FALSE') { next(); return { t: 'bool', f: () => false }; }
        if (t.v === 'NULL') { next(); return { t: 'any', f: () => null }; }
        if (t.v === 'IF') return parseIf();
        if (t.v === 'CASE') return parseCase();
      }
      if (t.k === 'op' && t.v === '(') {
        next();
        const e = parseExpr();
        expect('op', ')');
        return e;
      }
      if (t.k === 'id') {
        next();
        const def = FN[t.v];
        if (!def) throw new Error('알 수 없는 함수: ' + t.raw);
        expect('op', '(');
        const args = [];
        if (!isOp(')')) {
          args.push(parseExpr());
          while (isOp(',')) { next(); args.push(parseExpr()); }
        }
        expect('op', ')');
        if (args.length < def[0] || args.length > def[1]) throw new Error(t.v + ' 함수의 인수 개수가 올바르지 않습니다. 사용법: ' + def[4]);
        if (t.v === 'IIF') {
          const [c, a, b, u] = args;
          return { t: a.t !== 'any' ? a.t : b.t, f: (row) => { const v = c.f(row); if (v == null && u) return u.f(row); return truthy(v) ? a.f(row) : b.f(row); } };
        }
        const impl = def[3];
        let rt = def[2];
        if (rt === 'any') rt = (args.find((a) => a.t !== 'any') || { t: 'any' }).t;
        if (t.v === 'STR') rt = 'string';
        const fs = args.map((a) => a.f);
        if (t.v === 'STR' && args[0].t === 'date') return { t: 'string', f: (row) => { const v = fs[0](row); return v == null ? null : BI.fmtDate(v, true); } };
        return { t: rt, f: (row) => impl.apply(null, fs.map((f) => f(row))) };
      }
      throw new Error('예상하지 못한 토큰: ' + (t.v != null ? t.v : t.k) + ' (위치 ' + t.p + ')');
    }
    function parseIf() {
      expect('kw', 'IF');
      const branches = [];
      let c = parseExpr();
      expect('kw', 'THEN');
      branches.push([c, parseExpr()]);
      while (isKw('ELSEIF')) {
        next();
        c = parseExpr();
        expect('kw', 'THEN');
        branches.push([c, parseExpr()]);
      }
      let els = null;
      if (isKw('ELSE')) { next(); els = parseExpr(); }
      expect('kw', 'END');
      const rt = (branches.map((b) => b[1]).concat(els ? [els] : []).find((e) => e.t !== 'any') || { t: 'any' }).t;
      return {
        t: rt,
        f: (row) => {
          for (const [cc, e] of branches) if (truthy(cc.f(row))) return e.f(row);
          return els ? els.f(row) : null;
        },
      };
    }
    function parseCase() {
      expect('kw', 'CASE');
      const subj = parseExpr();
      const whens = [];
      while (isKw('WHEN')) {
        next();
        const w = parseExpr();
        expect('kw', 'THEN');
        whens.push([w, parseExpr()]);
      }
      let els = null;
      if (isKw('ELSE')) { next(); els = parseExpr(); }
      expect('kw', 'END');
      const rt = (whens.map((b) => b[1]).concat(els ? [els] : []).find((e) => e.t !== 'any') || { t: 'any' }).t;
      return {
        t: rt,
        f: (row) => {
          const s = subj.f(row);
          for (const [w, e] of whens) if (s != null && s == w.f(row)) return e.f(row);
          return els ? els.f(row) : null;
        },
      };
    }

    return {
      run() {
        const e = parseExpr();
        if (peek().k !== 'eof') throw new Error('수식 끝에 불필요한 내용이 있습니다 (위치 ' + peek().p + ')');
        return { fn: e.f, type: e.t, refs: Array.from(refs) };
      },
    };
  }

  C.compile = function (src, ds, selfId) {
    if (!src || !String(src).trim()) throw new Error('수식이 비어 있습니다.');
    const res = Parser(tokenize(String(src)), ds, selfId).run();
    if (res.type === 'any') {
      // 샘플 행으로 타입 추정
      for (let i = 0; i < Math.min(ds.rows.length, 200); i++) {
        let v;
        try { v = res.fn(ds.rows[i]); } catch (e) { continue; }
        if (v != null) { res.type = typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'bool' : 'string'; break; }
      }
      if (res.type === 'any') res.type = 'string';
    }
    return res;
  };

  /* 다른 필드 이름 변경 시 수식 내 참조 갱신 */
  C.renameRef = function (src, oldName, newName) {
    return String(src).replace(/\[([^\]]+)\]/g, (m, n) => (n.trim().toLowerCase() === oldName.toLowerCase() ? '[' + newName + ']' : m));
  };
})();
