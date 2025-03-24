
# Chat Assistant Backend

Este é o backend para a aplicação Chat Assistant, que fornece APIs para gerenciar configurações, conversas e arquivos de treinamento.

## Requisitos

- Node.js (versão 14 ou superior)
- MariaDB ou MySQL

## Instalação

1. Clone o repositório
2. Navegue até a pasta `backend`
3. Instale as dependências:

```bash
npm install
```

4. Crie um arquivo `.env` baseado no `.env.example`:

```bash
cp .env.example .env
```

5. Edite o arquivo `.env` com suas configurações:

```
# API Configuration
PORT=3001

# OpenAI API Key
OPENAI_API_KEY=sua_chave_aqui

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha_aqui
DB_NAME=chat_assistant
```

## Iniciar o servidor

Para iniciar o servidor em modo de desenvolvimento:

```bash
npm run dev
```

Para iniciar o servidor em modo de produção:

```bash
npm start
```

## Estrutura das APIs

O backend fornece as seguintes APIs:

- `/api/health` - Verificar status do servidor e da conexão com o banco de dados
- `/api/widget` - Gerenciar configurações do widget
- `/api/agent` - Gerenciar configurações do agente
- `/api/admin` - Gerenciar configurações de administrador
- `/api/conversation` - Gerenciar conversas e mensagens
- `/api/training` - Gerenciar arquivos de treinamento

## Banco de dados

O sistema utiliza MariaDB/MySQL para armazenar dados. As tabelas são criadas automaticamente na primeira execução do servidor.
