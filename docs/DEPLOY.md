# Publicação — Meu Lar Financeiro

## Componentes

O sistema tem duas partes independentes:

1. **Frontend estático**: pode ser publicado no GitHub Pages.
2. **API e PostgreSQL**: precisam de hospedagem compatível com Node.js e banco PostgreSQL.

O GitHub Pages não executa Express e não oferece PostgreSQL. Enquanto a API não estiver hospedada e conectada, o site publicado continuará usando apenas os dados locais do navegador.

## Frontend no GitHub Pages

O frontend está na raiz do repositório. Publique a branch configurada no GitHub Pages e confirme que `index.html`, `assets/`, `manifest.webmanifest` e `sw.js` estão acessíveis. O service worker usa caminhos relativos para preservar o subpath do Pages.

Não inclua `.env`, credenciais, backups ou dados pessoais na publicação estática.

## Backend

Escolha um provedor que ofereça:

- Node.js 20 ou superior.
- PostgreSQL gerenciado ou servidor PostgreSQL.
- HTTPS e proxy de aplicação.
- Variáveis de ambiente.
- Backups automáticos.
- Logs sem dados financeiros desnecessários.

Configure:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://usuario:senha@host:5432/banco
CORS_ORIGIN=https://endereco-do-frontend
COOKIE_SECURE=true
SESSION_DAYS=7
# Volume persistente e privado, nunca dentro da pasta pública.
ATTACHMENT_DIR=/var/lib/meu-lar-financeiro/attachments
```

`COOKIE_SECURE=true` é obrigatório quando `NODE_ENV=production`. Use um usuário PostgreSQL com privilégio para aplicar migrations e outro com privilégios mínimos para a aplicação, se o provedor permitir.

Execute no servidor:

```bash
npm ci
npm run migrate
npm test
npm run check
npm start
```

O processo deve permanecer ativo por um gerenciador de processos da hospedagem. O servidor Express serve apenas os arquivos públicos permitidos e responde `index.html` nas rotas da SPA; backend, testes, `.env` e documentação não são expostos.

Use um volume persistente para `ATTACHMENT_DIR`, com backup e permissões restritas. Em hospedagem com filesystem efêmero, os comprovantes seriam perdidos a cada reinício.

## Conexão do frontend com a API

A integração deve usar uma URL pública de API configurada sem segredos no frontend. Quando frontend e API estiverem em origens diferentes:

- `CORS_ORIGIN` deve ser exatamente a origem HTTPS do frontend.
- O frontend deve usar `credentials: "include"`.
- Cookies `SameSite=Strict` funcionam entre o frontend e a API quando ambos estão no mesmo site e usam HTTPS.
- Para domínios totalmente diferentes, a estratégia de cookie/CORS deve ser revista antes da publicação.

O frontend detecta a indisponibilidade da API, mantém uma mensagem clara e não sobrescrever dados locais silenciosamente. Para uma API em outra origem, defina `window.MEU_LAR_CONFIG = { apiBase: "https://api.exemplo.com" }` antes de carregar `assets/js/api.js`. Não coloque segredos nessa configuração.

## Banco de dados

Antes de publicar:

1. Crie o banco e aplique `npm run migrate`.
2. Execute uma gravação de workspace e confirme as projeções.
3. Faça logout e login novamente para comprovar persistência.
4. Teste conflito de revisão entre duas sessões.
5. Teste backup e restauração.
6. Configure backup automático e teste uma restauração.
7. Defina retenção de sessões, auditoria, backups e dados excluídos.

## Verificações obrigatórias

- `npm test` sem falhas.
- `npm run check` sem erro de sintaxe.
- Cadastro, login, logout e troca de senha.
- Isolamento entre duas usuárias.
- CSRF em todas as escritas.
- HTTPS e cookies `Secure`.
- Saldo, cartão, fatura, parcela, transferência e recorrência.
- Persistência após logout e novo login.
- Interface em desktop, tablet e celular.
- Tema claro e escuro.
- Exportações e backup.
- Nenhum segredo no frontend ou no repositório.

## Situação desta entrega

Os testes automatizados passam e os fluxos de anexos, exportações e shell offline foram verificados no navegador. A validação com PostgreSQL real permanece pendente neste ambiente. Não publicar o backend como versão final antes de concluir essa verificação.
