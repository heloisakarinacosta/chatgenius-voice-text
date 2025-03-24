
# Backend Server

Este é o servidor backend para a aplicação de chat. Ele fornece APIs para gerenciar configurações, conversas e integração com a API OpenAI.

## Configuração

1. Certifique-se de ter o Node.js instalado (versão 14 ou superior)
2. Instale as dependências:
   ```
   npm install
   ```
3. Copie o arquivo `.env.example` para `.env` e configure as variáveis de ambiente se necessário
4. Inicie o servidor:
   ```
   node server.js
   ```

## API Endpoints

O servidor fornece os seguintes endpoints:

- `GET /api/health` - Verifica se o servidor está funcionando
- `GET /api/admin/api-key` - Obtém a chave API da OpenAI
- `GET /api/admin` - Obtém configurações de administrador
- `PUT /api/admin` - Atualiza configurações de administrador
- `GET /api/widget` - Obtém configurações do widget de chat
- `PUT /api/widget` - Atualiza configurações do widget de chat
- `GET /api/agent` - Obtém configurações do agente de chat
- `PUT /api/agent` - Atualiza configurações do agente de chat
- `GET /api/conversation` - Obtém todas as conversas
- `POST /api/conversation` - Cria uma nova conversa
- `POST /api/conversation/:id/messages` - Adiciona uma mensagem a uma conversa
- `POST /api/training` - Adiciona um arquivo de treinamento
- `DELETE /api/training/:id` - Remove um arquivo de treinamento

## Armazenamento de Dados

O servidor utiliza um banco de dados MySQL para armazenamento persistente. Se o banco de dados não estiver disponível, ele utiliza arquivos JSON locais como fallback.

### Estrutura de Arquivos de Fallback

- `data/config.json` - Armazena a chave da API OpenAI
- `data/widget.json` - Configurações do widget de chat
- `data/agent.json` - Configurações do agente de chat
- `data/conversations.json` - Histórico de conversas
- `data/training.json` - Arquivos de treinamento

## Troubleshooting

Se você está enfrentando problemas com o servidor backend:

1. Verifique se o servidor está rodando em http://localhost:3001
2. Verifique o console para mensagens de erro
3. Certifique-se de que a pasta `data` existe e tem permissões de escrita
4. Se estiver usando MySQL, verifique as configurações de conexão no arquivo `.env`

Para ver os logs do servidor, execute:
```
node server.js
```
