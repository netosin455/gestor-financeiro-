# Sincronização com Google Sheets

Integração bidirecional entre o Google Sheets (planilha Caixa 2026) e o Gestor Financeiro via Google Apps Script. Nenhuma função extra no Vercel é necessária — toda a orquestração é feita no lado do Google.

---

## Pré-requisito: Token de Serviço

Crie um usuário de serviço no sistema com role `financeiro` para o Apps Script usar:

```
Email: sheets-sync@araujoprev.com.br
Senha: (gere uma senha forte e guarde no Apps Script Properties)
```

Faça login via `POST /api/auth/login` no script para obter o JWT antes de cada operação.

---

## Direção 1 — Planilha → Sistema (ao adicionar linha)

Este script é acionado automaticamente quando uma nova linha é adicionada na aba "Caixa".

### Como configurar

1. Abra a planilha no Google Sheets
2. Vá em **Extensões → Apps Script**
3. Cole o código abaixo
4. Em **Arquivo → Propriedades do projeto**, adicione:
   - `GESTOR_EMAIL` = `sheets-sync@araujoprev.com.br`
   - `GESTOR_SENHA` = (senha do usuário de serviço)
   - `GESTOR_URL`   = `https://seu-projeto.vercel.app`
5. Configure um trigger: **Editar → Gatilhos → + Adicionar gatilho**
   - Função: `onNovaLinha`
   - Tipo de evento: **Ao editar**

### Script

```javascript
const props = PropertiesService.getScriptProperties();
const BASE  = props.getProperty('GESTOR_URL');

function getToken() {
  const res = UrlFetchApp.fetch(BASE + '/api/auth/login', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      email: props.getProperty('GESTOR_EMAIL'),
      password: props.getProperty('GESTOR_SENHA'),
    }),
    muteHttpExceptions: true,
  });
  return JSON.parse(res.getContentText()).token;
}

function onNovaLinha(e) {
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== 'Caixa') return;

  const row    = e.range.getRow();
  const values = sheet.getRange(row, 1, 1, 8).getValues()[0];

  // Mapeamento das colunas:
  // A=DATA, B=DESCRIÇÃO, C=CATEGORIA, D=UNIDADE, E=VALOR, F=TIPO, G=STATUS, H=OBS
  const [data, descricao, categoria, unidade, valor, tipo, status, obs] = values;

  if (!data || !descricao || !valor) return; // linha incompleta

  const token = getToken();
  if (!token) { Logger.log('Falha no login'); return; }

  // Busca o ID da categoria pelo nome
  const metaRes = UrlFetchApp.fetch(BASE + '/api/lancamentos?meta=1', {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });
  const meta = JSON.parse(metaRes.getContentText());
  const cat  = (meta.data?.categorias ?? []).find(c => c.nome === String(categoria).toUpperCase());
  if (!cat) { Logger.log('Categoria não encontrada: ' + categoria); return; }

  // Formata a data
  const d = new Date(data);
  const dataISO = Utilities.formatDate(d, 'GMT-3', 'yyyy-MM-dd');

  const payload = {
    descricao:       String(descricao),
    categoria_id:    cat.id,
    valor:           Number(valor),
    tipo:            tipo === 'entrada' ? 'entrada' : 'saida',
    data_lancamento: dataISO,
    status:          status || 'pendente',
    observacoes:     obs || null,
  };

  const res = UrlFetchApp.fetch(BASE + '/api/lancamentos', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  Logger.log('Criado: ' + res.getResponseCode() + ' — ' + res.getContentText());
}
```

---

## Direção 2 — Sistema → Planilha (atualização periódica)

Este script roda a cada hora e sobrescreve a aba "Sync" com os dados do mês atual do sistema.

### Como configurar

1. No mesmo projeto Apps Script, adicione o script abaixo
2. Configure um trigger: **+ Adicionar gatilho**
   - Função: `syncDeSistema`
   - Tipo de evento: **Com base no tempo → A cada hora**

### Script

```javascript
function syncDeSistema() {
  const token = getToken();
  if (!token) return;

  const mes = Utilities.formatDate(new Date(), 'GMT-3', 'yyyy-MM');

  const res = UrlFetchApp.fetch(
    BASE + '/api/lancamentos?format=csv&mes=' + mes, {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() !== 200) {
    Logger.log('Erro ao buscar CSV: ' + res.getContentText());
    return;
  }

  const csv  = Utilities.parseCsv(res.getContentText());
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  let sheet  = ss.getSheetByName('Sync');

  if (!sheet) {
    sheet = ss.insertSheet('Sync');
  } else {
    sheet.clearContents();
  }

  sheet.getRange(1, 1, csv.length, csv[0].length).setValues(csv);
  Logger.log('Sync concluído: ' + csv.length + ' linhas');
}
```

---

## Observações

- O token JWT expira em 7 dias por padrão. O script faz login a cada execução para garantir um token válido.
- A deduplicação no sistema usa `descrição|data|valor` como fingerprint — reimportar a mesma linha não cria duplicatas.
- Para produção, monitore o log do Apps Script em **Execuções** para identificar falhas.
