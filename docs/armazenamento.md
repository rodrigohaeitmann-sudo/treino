# Onde guardar os treinos: opções e a escolha feita

A pergunta era como deixar os treinos registrados. Estas são as alternativas avaliadas para um app
pessoal hospedado no GitHub.

| Opção | Funciona sem internet na academia | Outros aparelhos | Custo / manutenção | Vê e analisa os dados fora do app | Observações |
|---|---|---|---|---|---|
| **Só no aparelho** (IndexedDB/localStorage) | Sim | Não | Zero | Só exportando | Se limpar os dados do navegador ou trocar de celular, perde tudo sem backup. |
| **Google Sheets via Apps Script** ✅ | Sim (com cache local) | Sim | Zero; você já conhece | **Sim**, planilha com uma linha por série | Latência de 1–3 s por sincronização; limite de ~50 mil caracteres por célula (um treino tem ~3 mil). |
| Firebase / Supabase | Sim (com cache) | Sim, em tempo real | Grátis no começo; exige conta, regras de segurança e login | Pelo painel do serviço | Mais robusto para vários usuários. Exagero para um usuário só. |
| Arquivo JSON no próprio repositório (API do GitHub) | Não | Sim | Exige um token de acesso guardado no navegador | Sim (JSON no repositório) | Cada treino vira um commit. O token no celular dá acesso de escrita ao repositório: arriscado. |
| Armazenamento do artefato no claude.ai | Parcial | Sim | Zero | Não | Preso ao claude.ai; é o que o artefato original usava. |

## Escolha: local primeiro + planilha como nuvem

1. **Tudo é gravado primeiro no aparelho** (IndexedDB). O app abre e funciona sem sinal,
   o que importa numa academia com internet ruim. O navegador é instruído a não apagar esses dados
   (`navigator.storage.persist()`).
2. **Quando há internet, o app sincroniza com uma planilha Google** através de um Apps Script
   publicado como *App da Web*, o mesmo mecanismo que você já usa. O script está em
   [`apps-script/Code.gs`](../apps-script/Code.gs).
3. A planilha recebe quatro abas:
   - **Sessoes**: um treino por linha (data, treino, duração, séries, volume, RPE, peso corporal, notas);
   - **Series**: uma linha por série (exercício, kg, reps, tipo, volume). Serve para tabelas dinâmicas,
     gráficos e Looker Studio;
   - **Treinos** e **Exercicios**: seus planos e a biblioteca (com links dos vídeos e ajustes do aparelho).
4. Cada linha guarda também o registro completo numa coluna `json`. A sincronização usa essa
   coluna, então as colunas legíveis podem ser formatadas à vontade.
   **Edite os dados pelo app**: mudanças feitas direto nas colunas da planilha não voltam para o app.

### Como a sincronização funciona

- Cada registro tem `id`, `updatedAt` (hora da última edição) e `deleted`. Exclusões viram “lápides”
  (`deleted = true`), assim também chegam aos outros aparelhos.
- O app envia o que mudou desde o último envio e pede o que a planilha recebeu desde o último
  `cursor`. Em conflito, **vence a edição mais recente**. Com um usuário e poucos aparelhos isso basta.
- O script usa `LockService` para duas sincronizações simultâneas não se atropelarem, e confere um
  **token** secreto (guardado nas *Propriedades do script*, fora do código).
- A requisição usa `Content-Type: text/plain`: o navegador não faz a pré-verificação de CORS
  (que o Apps Script não responde) e o JSON chega normalmente.
- Os testes (`tests/apps-script.test.js`) rodam o `Code.gs` de verdade contra uma planilha simulada
  em memória, incluindo a sincronização entre dois aparelhos, edições atrasadas e exclusões.

### Backup extra

Em **Ajustes → Backup** dá para exportar tudo em JSON (e importar de volta) ou baixar um CSV com uma
linha por série. A importação também aceita os dados do artefato antigo.
