# Banco de dados — Meu Lar Financeiro

O banco recomendado é PostgreSQL 14 ou superior. As migrações ficam em `database/migrations` e são aplicadas com:

```bash
npm run migrate
```

O executor cria `schema_migrations`, aplica cada arquivo SQL ainda não registrado e registra a migração na mesma transação. Não edite migrations já aplicadas em ambientes compartilhados; crie uma nova migration.

## Fonte canônica e projeções

`workspaces.state` é um JSONB versionado e funciona como fonte canônica do estado financeiro. Essa decisão preserva backups e permite evoluir o frontend sem perda de dados.

As demais tabelas pessoais são projeções relacionais desse workspace. Toda gravação de workspace:

1. Inicia uma transação.
2. Bloqueia a linha do workspace com `SELECT ... FOR UPDATE`.
3. Confere `expectedRevision`.
4. Atualiza estado e revisão.
5. Substitui as projeções da usuária.
6. Confirma a transação.

Qualquer erro executa rollback. Assim, uma projeção inválida não deixa o workspace gravado pela metade.

## Tabelas principais

### Identidade e acesso

- `users`: e-mail único, nome e hash scrypt da senha.
- `sessions`: hash do token, hash CSRF, expiração e revogação.
- `workspaces`: estado JSONB canônico e revisão otimista.
- `audit_events`: eventos de auditoria enviados pelo estado validado.
- `attachments`: metadados de comprovantes; o conteúdo binário exige storage próprio.

### Cadastros financeiros

- `accounts`
- `categories`
- `cost_centers`
- `payment_methods`
- `donors`
- `transactions`
- `transaction_payments`
- `transfers`
- `bills`
- `budgets`

### Cartões

- `credit_cards`
- `card_purchases`
- `installments`
- `invoices`
- `invoice_payments`

Compras parceladas compartilham `card_purchase_id`/`groupId` para manter uma compra e várias parcelas. A fatura é identificada por cartão e mês de referência. Transferências destinadas ao cartão podem indicar `invoice_month` e viram pagamentos da fatura.

### Gestão doméstica

- `shopping_lists`
- `shopping_items`
- `savings_goals`
- `goal_movements`
- `recurring_transactions`
- `reminders`
- `settings`

## Integridade e propriedade

Todas as tabelas de dados pessoais possuem `user_id` vinculado a `users(id) ON DELETE CASCADE`. Consultas sempre partem da identidade autenticada.

Restrições importantes:

- IDs únicos por usuária.
- E-mail único.
- Categoria única por usuária, nome, subcategoria e tipo.
- Método de pagamento único por usuária.
- Ocorrência de recorrência única.
- Baixa vinculada ao lançamento.
- Parcela única por compra.
- Fatura única por cartão e mês.
- Pagamento de fatura único por transferência.
- Orçamento único por mês, categoria e centro de custo.
- Valores monetários positivos e `NUMERIC(14,2)`.
- Datas financeiras sem horário armazenadas como `DATE`.
- Anexos limitados a 5 MiB, quatro MIMIs e quatro tipos de entidade; chave de storage única.

## Migração dos dados existentes

O estado local atual será normalizado para a versão 3 antes do primeiro envio ao backend. A normalização:

- Renomeia a organização para Meu Lar Financeiro.
- Cria coleções ausentes sem inventar movimentações.
- Define fechamento, vencimento e limite padrão para cartões antigos.
- Calcula o mês da fatura quando a compra não possui `invoiceMonth`.
- Preserva lançamentos, baixas, transferências e auditoria.

Categorias legadas serão mapeadas durante a integração do frontend, sem alterar a planilha original.

## Backup e recuperação

O backup da API exporta o workspace canônico em JSON, sem metadados ou binários de comprovantes. A pasta privada de anexos precisa de backup separado. Antes de restaurar em produção, é necessário:

1. Validar o arquivo e a versão do estado.
2. Manter uma cópia do workspace atual.
3. Enviar a restauração com a revisão correta.
4. Conferir saldos, faturas e totais após a gravação.
5. Registrar a auditoria da operação.

Backups automatizados e criptografados do PostgreSQL ainda precisam ser configurados no provedor de hospedagem.

## Validação pendente

A suíte atual usa `MemoryRepository`. A execução das migrations, das transações e das projeções com PostgreSQL real ainda não foi executada neste ambiente por falta de servidor PostgreSQL disponível. Essa validação é obrigatória antes de declarar o sistema pronto para produção.
