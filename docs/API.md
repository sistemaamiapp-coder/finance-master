# API — Meu Lar Financeiro

Base URL local: `http://localhost:3000/api`.

Todas as respostas são JSON, exceto os downloads de backup e comprovantes, que usam `Content-Disposition: attachment`. Erros seguem o formato:

```json
{
  "error": "Mensagem compreensível",
  "code": "CODIGO_DO_ERRO",
  "details": ["Detalhe opcional"]
}
```

## Sessão e CSRF

O cadastro e o login criam dois cookies:

- `meu_lar_session`: token de sessão, `HttpOnly`, `SameSite=Strict`.
- `meu_lar_csrf`: token CSRF legível pelo frontend, `SameSite=Strict`.

Em produção, ambos usam `Secure`. Toda rota de escrita autenticada exige o token CSRF no header:

```text
X-CSRF-Token: token_recebido_no_login_ou_cadastro
```

O token também é comparado com o hash registrado na sessão. O frontend deve incluí-lo nas requisições `POST`, `PUT` e `DELETE` usando `credentials: "include"`.

## Rotas

### `GET /api/health`

Resposta pública de saúde. Retorna produto e indica se o repositório configurado não é o de testes.

```json
{ "ok": true, "product": "Meu Lar Financeiro", "database": true }
```

### `POST /api/auth/register`

Cria a usuária, o workspace vazio e a sessão.

```json
{
  "name": "Maria",
  "email": "maria@example.com",
  "password": "Segura1234"
}
```

A senha precisa ter de 10 a 128 caracteres e conter letras e números. Retorna `201`, `user` e `csrfToken`.

### `POST /api/auth/login`

```json
{
  "email": "maria@example.com",
  "password": "Segura1234"
}
```

Retorna `200`, `user` e `csrfToken`. Erros de credencial usam `401 UNAUTHORIZED`.

### `POST /api/auth/logout`

Requer autenticação e CSRF. Revoga a sessão atual e limpa os cookies.

### `GET /api/auth/me`

Requer autenticação. Retorna a usuária pública, sem hash de senha.

### `POST /api/auth/password`

Requer autenticação e CSRF.

```json
{
  "currentPassword": "Segura1234",
  "newPassword": "NovaSenha123"
}
```

Valida a senha atual e atualiza o hash. A interface deve orientar a usuária a fazer login novamente após a troca.

### `DELETE /api/auth/account`

Requer autenticação, CSRF e uma sessão criada há menos de cinco minutos. Esse cuidado evita um segundo campo de confirmação de senha e ainda protege a exclusão. Remove todos os dados da usuária.

### `GET /api/state`

Requer autenticação.

```json
{
  "state": { "version": 3, "accounts": [] },
  "revision": 0
}
```

### `PUT /api/state`

Requer autenticação, CSRF e revisão correta.

```json
{
  "expectedRevision": 0,
  "state": { "version": 3 }
}
```

O backend normaliza e valida todo o estado antes de gravar. Retorna o estado salvo e a nova revisão. Uma revisão diferente retorna `409 REVISION_CONFLICT`; dados inválidos retornam `422 VALIDATION_ERROR`.

O corpo tem limite de 2 MB. O repositório PostgreSQL grava workspace e projeções na mesma transação.

### `GET /api/backup`

Requer autenticação. Baixa um JSON com produto, data de exportação, revisão e estado completo.

### `GET /api/reports/annual/:year`

Requer autenticação. O ano deve estar entre 1900 e 2200.

```json
{
  "year": 2026,
  "months": [
    {
      "key": "2026-01",
      "label": "janeiro",
      "receitas": 0,
      "despesas": 0,
      "recebido": 0,
      "pago": 0,
      "saldo": 0,
      "acumulado": 0,
      "crescimento": null,
      "investimentos": 0,
      "metas": 0,
      "movimentado": false
    }
  ]
}
```

O array sempre contém os 12 meses. Valores são calculados a partir do workspace, sem dados fictícios.

## Comprovantes

Formatos aceitos: PDF, JPEG, PNG e WebP, até 5 MiB por arquivo. O servidor valida o conteúdo pelos magic bytes e exige que o MIME declarado corresponda ao conteúdo. Os arquivos ficam em storage privado; a API nunca retorna `storage_key`.

### `POST /api/attachments/upload/:entityType/:entityId`

Requer autenticação, CSRF e corpo binário. `entityType` aceita `transaction`, `card_purchase`, `invoice` ou `account`. Para fatura, use `entityId` no formato `cardId:YYYY-MM`. Envie o nome em `X-File-Name`, codificado com `encodeURIComponent`. Retorna `201` com os metadados públicos.

### `GET /api/attachments/:entityType/:entityId`

Requer autenticação. Lista somente os comprovantes da usuária vinculados à entidade.

### `GET /api/attachments/content/:id`

Requer autenticação. Retorna o binário com download forçado, `X-Content-Type-Options: nosniff` e CSP `sandbox`.

### `DELETE /api/attachments/:id`

Requer autenticação e CSRF. Remove o metadado e o arquivo privado.

## Códigos importantes

| Código HTTP | Código | Significado |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | Requisição ou valor inválido |
| 401 | `UNAUTHORIZED` | Sessão ausente, expirada ou credencial inválida |
| 403 | `CSRF_INVALID` | Token CSRF ausente ou inválido |
| 403 | `REAUTH_REQUIRED` | Exclusão exige login recente |
| 403 | `ORIGIN_DENIED` | Origem não autorizada |
| 409 | `REVISION_CONFLICT` | Outro dispositivo alterou os dados |
| 409 | `EMAIL_EXISTS` | E-mail já cadastrado |
| 404 | `ATTACHMENT_NOT_FOUND` | Comprovante inexistente ou de outra usuária |
| 413 | `ATTACHMENT_TOO_LARGE` | Arquivo acima de 5 MiB |
| 422 | `VALIDATION_ERROR` | Estado financeiro ou arquivo inválido |
| 429 | Limite de tentativas | Muitas requisições no intervalo |

## Pendências da API

A restauração de backup pela API ainda não possui endpoint próprio. Listas de compras, metas, recorrências e lembretes usam o workspace validado; PDF, Excel e CSV são gerados no navegador.
