# Notas para o Claude

- App estático (PWA) sem build: módulos ES em `js/`, estilos em `css/app.css`. Interface e textos em pt-BR.
- Regras de negócio ficam em `js/logic/` (puras, sem DOM) e têm testes em `tests/`. Rode `npm test` antes de commitar.
- `apps-script/Code.gs` roda no Google Apps Script (JavaScript V8, sem módulos). Os testes o executam com
  uma planilha falsa (`tests/helpers/fake-apps-script.js`); se usar outro método do `SpreadsheetApp`, implemente-o lá.
- Todo registro sincronizado tem `id`, `updatedAt` e `deleted`; grave sempre com `upsert()`/`remove()` de `js/state.js`.
  Dados da biblioteca padrão (`js/seed.js`) têm `updatedAt: 0` para nunca sobrescrever edições vindas da planilha.
- Ao criar/remover arquivos servidos, atualize `SHELL` e `VERSION` em `sw.js`.
- Texto vindo do usuário vai para o HTML sempre por `esc()` (`js/logic/format.js`).
