/**
 * Treino — backend no Google Sheets.
 *
 * Como instalar (detalhes no README do repositório):
 *  1. Crie uma planilha nova → Extensões → Apps Script → cole este arquivo.
 *  2. Rode a função `setup` uma vez (autorize) e copie o TOKEN que aparece no log.
 *  3. Implantar → Nova implantação → App da Web → Executar como: Eu; Quem pode acessar: Qualquer pessoa.
 *  4. No app: Ajustes → Google Sheets → cole a URL /exec e o TOKEN.
 *
 * Cada registro do app vira uma linha (coluna `json` guarda o registro completo);
 * a aba "Series" tem uma linha por série, pronta para tabelas dinâmicas e gráficos.
 */

var TABLES = {
  exercises: {
    sheet: 'Exercicios',
    cols: ['id', 'nome', 'grupo', 'equipamento', 'videos', 'ajustes_aparelho'],
    row: function (r) {
      return [r.id, txt_(r.name), txt_(r.group), txt_(r.equipment),
        (r.videos || []).map(function (v) { return 'https://youtu.be/' + v.id + (v.start ? '?t=' + v.start : ''); }).join('\n'),
        txt_(r.setup)];
    }
  },
  plans: {
    sheet: 'Treinos',
    cols: ['id', 'nome', 'descricao', 'ordem', 'exercicios'],
    row: function (r) {
      return [r.id, txt_(r.name), txt_(r.subtitle), r.order == null ? '' : r.order,
        (r.items || []).map(function (i) { return i.exerciseId + ' ' + i.sets + 'x' + i.repsMin + (i.repsMax && i.repsMax !== i.repsMin ? '-' + i.repsMax : ''); }).join(', ')];
    }
  },
  sessions: {
    sheet: 'Sessoes',
    cols: ['id', 'data', 'tipo', 'treino', 'inicio', 'fim', 'duracao_min', 'series', 'volume_kg', 'rpe', 'peso_corporal', 'atividade', 'distancia_km', 'notas'],
    row: function (r) {
      var sets = 0, vol = 0;
      (r.items || []).forEach(function (it) {
        (it.sets || []).forEach(function (s) {
          if (s.kind === 'warmup') return;
          sets++; vol += (Number(s.kg) || 0) * (Number(s.reps) || 0);
        });
      });
      return [r.id, r.date || '', r.kind || '', txt_(r.planName),
        r.startedAt ? new Date(r.startedAt) : '', r.finishedAt ? new Date(r.finishedAt) : '',
        r.durationSec ? Math.round(r.durationSec / 60) : '', r.kind === 'gym' ? sets : '', r.kind === 'gym' ? Math.round(vol) : '',
        r.rpe == null ? '' : r.rpe, r.bodyweight == null ? '' : r.bodyweight, txt_(r.activity), r.distanceKm == null ? '' : r.distanceKm, txt_(r.notes)];
    }
  }
};
var META = ['updatedAt', 'deleted', 'syncedAt', 'json'];
var SERIES = {
  sheet: 'Series',
  cols: ['sessao_id', 'data', 'treino', 'ordem', 'exercicio_id', 'exercicio', 'grupo', 'serie', 'tipo', 'kg', 'reps', 'segundos', 'volume_kg', 'concluida_em']
};

function doGet() {
  return json_({ ok: true, app: 'treino', message: 'Backend do Treino no ar. Use o app para sincronizar.' });
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'JSON inválido.' }); }
  var expected = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!expected) return json_({ ok: false, error: 'Defina o TOKEN: rode a função setup() no Apps Script.' });
  if (!req || req.token !== expected) return json_({ ok: false, error: 'Token incorreto.' });

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (req.action === 'ping') return json_({ ok: true, time: Date.now(), counts: counts_() });
    if (req.action === 'sync') return json_(sync_(req));
    return json_({ ok: false, error: 'Ação desconhecida.' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

/** Rode uma vez pelo editor: cria as abas e um TOKEN aleatório (veja em Execuções → Log). */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABLES).forEach(function (k) { sheet_(ss, TABLES[k].sheet, TABLES[k].cols.concat(META)); });
  sheet_(ss, SERIES.sheet, SERIES.cols);
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('TOKEN');
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '').slice(0, 24);
    props.setProperty('TOKEN', token);
  }
  Logger.log('TOKEN: ' + token);
  return token;
}

function sync_(req) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = Date.now();
  var since = Number(req.since) || 0;
  var changes = req.changes || {};
  var out = {};
  var touchedSessions = [];

  Object.keys(TABLES).forEach(function (key) {
    var def = TABLES[key];
    var header = def.cols.concat(META);
    var sh = sheet_(ss, def.sheet, header);
    var n = header.length;
    var iId = 0, iUpd = def.cols.length, iSync = iUpd + 2, iJson = iUpd + 3; // META: updatedAt, deleted, syncedAt, json
    var last = sh.getLastRow();
    var values = last > 1 ? sh.getRange(2, 1, last - 1, n).getValues() : [];
    var index = {};
    values.forEach(function (row, i) { if (row[iId]) index[String(row[iId])] = i; });

    var appended = [];
    (changes[key] || []).forEach(function (rec) {
      if (!rec || typeof rec.id !== 'string' || !rec.id) return;
      var at = index[rec.id];
      var incomingUpd = Number(rec.updatedAt) || 0;
      if (at !== undefined && !(incomingUpd > (Number(values[at][iUpd]) || 0))) return; // igual ou mais antigo: ignora
      var body = JSON.stringify(rec);
      if (body.length > 49000) throw new Error('Registro grande demais para uma célula: ' + rec.id);
      var row = (rec.deleted ? [rec.id].concat(blank_(def.cols.length - 1)) : def.row(rec))
        .concat([incomingUpd, rec.deleted ? true : false, now, body]);
      if (at !== undefined) {
        values[at] = row;
        sh.getRange(at + 2, 1, 1, n).setValues([row]);
      } else {
        index[rec.id] = values.length;
        values.push(row);
        appended.push(row);
      }
      if (key === 'sessions') touchedSessions.push(rec);
    });
    if (appended.length) sh.getRange(sh.getLastRow() + 1, 1, appended.length, n).setValues(appended);

    out[key] = [];
    values.forEach(function (row) {
      if ((Number(row[iSync]) || 0) > since && row[iJson]) {
        try { out[key].push(JSON.parse(row[iJson])); } catch (err) { /* linha editada à mão */ }
      }
    });
  });

  if (touchedSessions.length) rewriteSeries_(ss, touchedSessions);
  return { ok: true, cursor: now, changes: out };
}

/** Reescreve as linhas da aba Series das sessões alteradas. */
function rewriteSeries_(ss, sessions) {
  var sh = sheet_(ss, SERIES.sheet, SERIES.cols);
  var ids = {};
  sessions.forEach(function (s) { ids[s.id] = true; });
  var last = sh.getLastRow();
  if (last > 1) {
    var col = sh.getRange(2, 1, last - 1, 1).getValues();
    // apaga de baixo para cima, em blocos contíguos
    var i = col.length - 1;
    while (i >= 0) {
      if (ids[col[i][0]]) {
        var end = i;
        while (i - 1 >= 0 && ids[col[i - 1][0]]) i--;
        sh.deleteRows(i + 2, end - i + 1);
      }
      i--;
    }
  }
  var rows = [];
  sessions.forEach(function (s) {
    if (s.deleted || s.kind !== 'gym') return;
    (s.items || []).forEach(function (it, order) {
      (it.sets || []).forEach(function (st, k) {
        var vol = st.kind === 'warmup' ? 0 : (Number(st.kg) || 0) * (Number(st.reps) || 0);
        rows.push([s.id, s.date || '', txt_(s.planName), order + 1, it.exerciseId || '', txt_(it.name), txt_(it.group), k + 1,
          st.kind || 'normal', st.kg == null ? '' : st.kg, st.reps == null ? '' : st.reps, st.sec == null ? '' : st.sec,
          vol, st.doneAt ? new Date(st.doneAt) : '']);
      });
    });
  });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, SERIES.cols.length).setValues(rows);
}

function counts_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var c = {};
  Object.keys(TABLES).forEach(function (k) {
    var sh = ss.getSheetByName(TABLES[k].sheet);
    c[k] = sh ? Math.max(0, sh.getLastRow() - 1) : 0;
  });
  return c;
}

function sheet_(ss, name, header) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Texto livre nunca vira fórmula na planilha. */
function txt_(v) {
  var s = v == null ? '' : String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function blank_(n) { var a = []; for (var i = 0; i < n; i++) a.push(''); return a; }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
