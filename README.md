# Meu Lar Financeiro

Organize seu dinheiro, cuide do seu lar e realize seus sonhos.

Sistema financeiro doméstico individual em português, com frontend web estático, API Node.js/Express e persistência PostgreSQL. O projeto não movimenta dinheiro, não acessa bancos e não armazena senhas bancárias, CVV ou PIN.

## Estado atual

A fundação técnica está implementada e os testes automatizados passam. O workspace versionado, a autenticação por sessão, a proteção CSRF, o controle de concorrência, as regras financeiras e as migrações já estão codificados.

A interface está integrada à API e funciona também em modo local no GitHub Pages. Os módulos financeiros e domésticos, exportações, PWA offline e comprovantes privados estão implementados. A validação das migrations e da persistência com PostgreSQL real ainda é obrigatória antes de declarar o backend pronto para produção.

## Estrutura

```text
.
├── index.html                 Frontend estático e navegação principal
├── assets/                    CSS, JavaScript, imagens e ícones
├── backend/src/               API, autenticação e serviços financeiros
├── backend/src/repositories/  Persistência em memória e PostgreSQL
├── database/migrations/       Migrações SQL versionadas
├── tests/                     Testes financeiros e de API
└── docs/                      API, banco de dados e publicação
```

O frontend permanece na raiz para preservar o endereço atual do GitHub Pages. O backend também serve esses arquivos quando executado localmente ou em um servidor próprio.

## Requisitos

- Node.js 20 ou superior.
- PostgreSQL 14 ou superior para execução fora dos testes.
- npm incluído na instalação do Node.js.
- HTTPS obrigatório em produção.

## Instalação local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie um arquivo `.env` a partir do exemplo:

   ```bash
   cp .env.example .env
   ```

3. Ajuste `DATABASE_URL` e `CORS_ORIGIN` no `.env`. Não versione esse arquivo.

4. Crie o banco `meu_lar_financeiro` no PostgreSQL e aplique as migrações:

   ```bash
   npm run migrate
   ```

5. Inicie o servidor:

   ```bash
   npm run dev
   ```

6. Abra `http://localhost:3000`.

Para usar outra porta, altere `PORT` e `CORS_ORIGIN` no `.env`.

## Testes e verificações

```bash
npm test
npm run check
```

Os testes usam um repositório em memória e não exigem PostgreSQL. Eles cobrem autenticação, sessão, CSRF, isolamento entre usuárias, revisão do workspace, saldo, transferências, cartões, faturas, parcelamentos, metas, recorrências, validação, resumo anual, XLSX, PWA e comprovantes.

`NODE_ENV=test` permite executar os testes sem `DATABASE_URL`. Fora desse ambiente, a variável é obrigatória.

## Decisões técnicas

- O workspace JSONB é a fonte canônica do estado financeiro, preservando a compatibilidade com os backups atuais.
- Tabelas relacionais são projeções transacionais do workspace e permitem consultas, integridade e evolução do modelo.
- Gravações usam revisão otimista: uma resposta `409 REVISION_CONFLICT` exige recarregar os dados antes de salvar novamente.
- Valores são convertidos para centavos inteiros nos cálculos e armazenados como `NUMERIC(14,2)` no banco.
- Compras no cartão entram na fatura da competência definida pelo fechamento. O pagamento da fatura é uma transferência que reduz o caixa e liquida o passivo, sem registrar as compras novamente como despesa.
- Senhas usam scrypt com salt. Tokens de sessão e CSRF são armazenados como hash SHA-256.
- Sessões usam cookies `HttpOnly`, `SameSite=Strict` e `Secure` quando configurado para HTTPS.
- Meses sem movimentação continuam presentes no resumo anual, com valores zerados.
- Comprovantes aceitam PDF, JPEG, PNG e WebP até 5 MiB, validados pelo conteúdo e guardados fora do repositório. O padrão é `~/.meu-lar-financeiro/attachments`; `ATTACHMENT_DIR` permite escolher outro volume privado persistente.
- O backup JSON não inclui arquivos de comprovantes nem suas chaves de armazenamento. Faça backup separado da pasta privada.
- A PWA guarda somente o shell público. Nenhuma resposta da API ou dado financeiro autenticado entra no cache offline.

## Documentação

- [API](docs/API.md)
- [Banco de dados](docs/DATABASE.md)
- [Publicação](docs/DEPLOY.md)

## Privacidade

Cada workspace pertence à usuária autenticada. O backend obtém essa identidade da sessão e não confia em identificadores enviados pelo frontend. Excluir a conta remove usuária, sessões, workspace, projeções relacionais, metadados e arquivos de comprovantes.

Backups JSON contêm dados financeiros pessoais. Devem ser armazenados com proteção, nunca em repositórios públicos, e descartados conforme a política de retenção adotada.
