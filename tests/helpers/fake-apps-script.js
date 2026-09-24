// Executa apps-script/Code.gs em Node com uma planilha falsa em memória.
// Só implementa o pedaço da API do Google que o script usa.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';

class Range {
  constructor(sheet, row, col, nr = 1, nc = 1) { Object.assign(this, { sheet, row, col, nr, nc }); }
  getValues() {
    const out = [];
    for (let r = 0; r < this.nr; r++) {
      const src = this.sheet.data[this.row - 1 + r] || [];
      const line = [];
      for (let c = 0; c < this.nc; c++) line.push(src[this.col - 1 + c] ?? '');
      out.push(line);
    }
    return out;
  }
  setValues(v) {
    if (v.length !== this.nr || v.some(r => r.length !== this.nc)) throw new Error('dimensões diferentes do intervalo');
    v.forEach((line, r) => {
      const i = this.row - 1 + r;
      while (this.sheet.data.length <= i) this.sheet.data.push([]);
      line.forEach((val, c) => { this.sheet.data[i][this.col - 1 + c] = val; });
    });
    return this;
  }
  setFontWeight() { return this; }
}

class Sheet {
  constructor(name) { this.name = name; this.data = []; }
  getLastRow() { return this.data.length; }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
  deleteRows(start, n) { this.data.splice(start - 1, n); }
  setFrozenRows() {}
}

export class FakeSpreadsheet {
  constructor() { this.sheets = new Map(); }
  getSheetByName(n) { return this.sheets.get(n) || null; }
  insertSheet(n) { const s = new Sheet(n); this.sheets.set(n, s); return s; }
  /** Linhas de dados (sem cabeçalho) como objetos. */
  rows(name) {
    const sh = this.sheets.get(name);
    if (!sh) return [];
    const [head, ...rest] = sh.data;
    return rest.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
  }
}

export function loadAppsScript({ token = 'segredo' } = {}) {
  const ss = new FakeSpreadsheet();
  const props = new Map(token ? [['TOKEN', token]] : []);
  const ctx = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.get(k) ?? null, setProperty: (k, v) => props.set(k, v) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { createTextOutput: s => ({ body: s, setMimeType() { return this; } }), MimeType: { JSON: 'application/json' } },
    Utilities: { getUuid: () => randomUUID() },
    Logger: { log() {} },
    JSON, Date, Math, Number, String, Object, Array, Error,
  });
  const code = readFileSync(new URL('../../apps-script/Code.gs', import.meta.url), 'utf8');
  vm.runInContext(code, ctx, { filename: 'Code.gs' });
  const post = req => JSON.parse(ctx.doPost({ postData: { contents: typeof req === 'string' ? req : JSON.stringify(req) } }).body);
  return { ss, ctx, props, post };
}
