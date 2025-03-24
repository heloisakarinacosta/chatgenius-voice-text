
import mysql from 'mysql2/promise';

// Configuração de conexão com o banco de dados
let pool: mysql.Pool | null = null;

// Inicializa a pool de conexões
export const initDatabase = async () => {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'chat_assistant',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    console.log('Database connection pool initialized');
    
    // Verifica a conexão
    const connection = await pool.getConnection();
    console.log('Database connected successfully');
    connection.release();
    
    // Cria as tabelas necessárias se não existirem
    await createTables();
    
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    return false;
  }
};

// Cria as tabelas necessárias
const createTables = async () => {
  if (!pool) return;
  
  try {
    // Tabela de configurações do widget
    await pool.query(`
      CREATE TABLE IF NOT EXISTS widget_config (
        id INT PRIMARY KEY,
        position VARCHAR(20) NOT NULL,
        title VARCHAR(100) NOT NULL,
        subtitle VARCHAR(255) NOT NULL,
        primary_color VARCHAR(20) NOT NULL,
        icon_type VARCHAR(20) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Tabela de configurações do agente
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_config (
        id INT PRIMARY KEY,
        system_prompt TEXT NOT NULL,
        voice_enabled BOOLEAN DEFAULT true,
        voice_id VARCHAR(50) NOT NULL,
        voice_language VARCHAR(10) NOT NULL,
        voice_latency INT DEFAULT 100,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Tabela de funções do agente
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_functions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        parameters JSON NOT NULL,
        webhook VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Tabela de arquivos de treinamento
    await pool.query(`
      CREATE TABLE IF NOT EXISTS training_files (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        size INT NOT NULL,
        type VARCHAR(100) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Tabela de conversas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id VARCHAR(36) PRIMARY KEY,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Tabela de mensagens
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(36) PRIMARY KEY,
        conversation_id VARCHAR(36) NOT NULL,
        role ENUM('user', 'assistant', 'system') NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )
    `);
    
    // Tabela de configurações de admin
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_config (
        id INT PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        password_hash VARCHAR(100) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Database tables created/verified');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
};

// Obtém a conexão com o banco de dados
export const getDbConnection = async () => {
  if (!pool) {
    await initDatabase();
  }
  return pool;
};

// Funções para interagir com o banco de dados para as configurações do widget
export const getWidgetConfig = async () => {
  try {
    const db = await getDbConnection();
    if (!db) throw new Error('Database not connected');
    
    const [rows] = await db.query('SELECT * FROM widget_config WHERE id = 1');
    const results = rows as any[];
    
    if (results.length === 0) {
      // Insere a configuração padrão se não existir
      const defaultConfig = {
        position: "bottom-right",
        title: "Chat Assistant",
        subtitle: "How can I help you today?",
        primary_color: "#000000",
        icon_type: "chat"
      };
      
      await db.query(
        'INSERT INTO widget_config (id, position, title, subtitle, primary_color, icon_type) VALUES (1, ?, ?, ?, ?, ?)',
        [defaultConfig.position, defaultConfig.title, defaultConfig.subtitle, defaultConfig.primary_color, defaultConfig.icon_type]
      );
      
      return defaultConfig;
    }
    
    const config = results[0];
    return {
      position: config.position,
      title: config.title,
      subtitle: config.subtitle,
      primaryColor: config.primary_color,
      iconType: config.icon_type
    };
  } catch (error) {
    console.error('Error getting widget config:', error);
    // Retorna configuração padrão em caso de erro
    return {
      position: "bottom-right",
      title: "Chat Assistant",
      subtitle: "How can I help you today?",
      primaryColor: "#000000",
      iconType: "chat"
    };
  }
};

export const updateWidgetConfig = async (config: any) => {
  try {
    const db = await getDbConnection();
    if (!db) throw new Error('Database not connected');
    
    await db.query(
      'UPDATE widget_config SET position = ?, title = ?, subtitle = ?, primary_color = ?, icon_type = ? WHERE id = 1',
      [config.position, config.title, config.subtitle, config.primaryColor, config.iconType]
    );
    
    return true;
  } catch (error) {
    console.error('Error updating widget config:', error);
    return false;
  }
};

// Funções para interagir com o banco de dados para as configurações do agente
export const getAgentConfig = async () => {
  try {
    const db = await getDbConnection();
    if (!db) throw new Error('Database not connected');
    
    // Obter configuração básica do agente
    const [configRows] = await db.query('SELECT * FROM agent_config WHERE id = 1');
    const configResults = configRows as any[];
    
    let agentConfig;
    
    if (configResults.length === 0) {
      // Insere a configuração padrão se não existir
      const defaultConfig = {
        system_prompt: "You are a helpful assistant. Provide clear and concise information to the user's queries.",
        voice_enabled: true,
        voice_id: "alloy",
        voice_language: "en-US",
        voice_latency: 100
      };
      
      await db.query(
        'INSERT INTO agent_config (id, system_prompt, voice_enabled, voice_id, voice_language, voice_latency) VALUES (1, ?, ?, ?, ?, ?)',
        [defaultConfig.system_prompt, defaultConfig.voice_enabled, defaultConfig.voice_id, defaultConfig.voice_language, defaultConfig.voice_latency]
      );
      
      agentConfig = {
        systemPrompt: defaultConfig.system_prompt,
        voice: {
          enabled: defaultConfig.voice_enabled,
          voiceId: defaultConfig.voice_id,
          language: defaultConfig.voice_language,
          latency: defaultConfig.voice_latency
        }
      };
    } else {
      const config = configResults[0];
      agentConfig = {
        systemPrompt: config.system_prompt,
        voice: {
          enabled: Boolean(config.voice_enabled),
          voiceId: config.voice_id,
          language: config.voice_language,
          latency: config.voice_latency
        }
      };
    }
    
    // Obter funções do agente
    const [functionRows] = await db.query('SELECT * FROM agent_functions');
    const functions = (functionRows as any[]).map(func => ({
      name: func.name,
      description: func.description,
      parameters: JSON.parse(func.parameters),
      webhook: func.webhook
    }));
    
    // Obter arquivos de treinamento
    const [fileRows] = await db.query('SELECT * FROM training_files');
    const trainingFiles = (fileRows as any[]).map(file => ({
      id: file.id,
      name: file.name,
      content: file.content,
      size: file.size,
      type: file.type,
      timestamp: new Date(file.timestamp)
    }));
    
    return {
      ...agentConfig,
      functions,
      trainingFiles
    };
  } catch (error) {
    console.error('Error getting agent config:', error);
    // Retorna configuração padrão em caso de erro
    return {
      systemPrompt: "You are a helpful assistant. Provide clear and concise information to the user's queries.",
      functions: [],
      voice: {
        enabled: true,
        voiceId: "alloy",
        language: "en-US",
        latency: 100
      },
      trainingFiles: []
    };
  }
};

export const updateAgentConfig = async (config: any) => {
  try {
    const db = await getDbConnection();
    if (!db) throw new Error('Database not connected');
    
    // Atualiza a configuração básica
    await db.query(
      'UPDATE agent_config SET system_prompt = ?, voice_enabled = ?, voice_id = ?, voice_language = ?, voice_latency = ? WHERE id = 1',
      [config.systemPrompt, config.voice.enabled, config.voice.voiceId, config.voice.language, config.voice.latency]
    );
    
    // Atualiza as funções (remove todas e insere novamente)
    await db.query('DELETE FROM agent_functions');
    
    if (config.functions && config.functions.length > 0) {
      const functionsValues = config.functions.map((func: any) => [
        func.name,
        func.description,
        JSON.stringify(func.parameters),
        func.webhook
      ]);
      
      const placeholders = config.functions.map(() => '(?, ?, ?, ?)').join(', ');
      const flatValues = functionsValues.flat();
      
      await db.query(
        `INSERT INTO agent_functions (name, description, parameters, webhook) VALUES ${placeholders}`,
        flatValues
      );
    }
    
    return true;
  } catch (error) {
    console.error('Error updating agent config:', error);
    return false;
  }
};

// Funções para gerenciar arquivos de treinamento
export const addTrainingFile = async (file: any) => {
  try {
    const db = await getDbConnection();
    if (!db) throw new Error('Database not connected');
    
    await db.query(
      'INSERT INTO training_files (id, name, content, size, type, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [file.id, file.name, file.content, file.size, file.type, new Date()]
    );
    
    return true;
  } catch (error) {
    console.error('Error adding training file:', error);
    return false;
  }
};

export const removeTrainingFile = async (id: string) => {
  try {
    const db = await getDbConnection();
    if (!db) throw new Error('Database not connected');
    
    await db.query('DELETE FROM training_files WHERE id = ?', [id]);
    
    return true;
  } catch (error) {
    console.error('Error removing training file:', error);
    return false;
  }
};

// Funções para gerenciar conversas
export const getConversations = async () => {
  try {
    const db = await getDbConnection();
    if (!db) throw new Error('Database not connected');
    
    const [rows] = await db.query('SELECT * FROM conversations ORDER BY created_at DESC');
    const conversations = rows as any[];
    
    const conversationsWithMessages = await Promise.all(
      conversations.map(async (conv) => {
        const [messageRows] = await db.query(
          'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
          [conv.id]
        );
        
        const messages = (messageRows as any[]).map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp)
        }));
        
        return {
          id: conv.id,
          messages,
          isActive: Boolean(conv.is_active),
          createdAt: new Date(conv.created_at)
        };
      })
    );
    
    return conversationsWithMessages;
  } catch (error) {
    console.error('Error getting conversations:', error);
    return [];
  }
};

export const createConversation = async (id: string) => {
  try {
    const db = await getDbConnection();
    if (!db) throw new Error('Database not connected');
    
    await db.query(
      'INSERT INTO conversations (id, is_active, created_at) VALUES (?, ?, ?)',
      [id, true, new Date()]
    );
    
    return true;
  } catch (error) {
    console.error('Error creating conversation:', error);
    return false;
  }
};

export const addMessage = async (conversationId: string, message: any) => {
  try {
    const db = await getDbConnection();
    if (!db) throw new Error('Database not connected');
    
    await db.query(
      'INSERT INTO messages (id, conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)',
      [message.id, conversationId, message.role, message.content, new Date(message.timestamp)]
    );
    
    return true;
  } catch (error) {
    console.error('Error adding message:', error);
    return false;
  }
};

// Funções para gerenciar configurações de admin
export const getAdminConfig = async () => {
  try {
    const db = await getDbConnection();
    if (!db) throw new Error('Database not connected');
    
    const [rows] = await db.query('SELECT * FROM admin_config WHERE id = 1');
    const results = rows as any[];
    
    if (results.length === 0) {
      // Insere a configuração padrão se não existir
      const defaultConfig = {
        username: "admin",
        password_hash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918" // "admin" - SHA-256 hashed
      };
      
      await db.query(
        'INSERT INTO admin_config (id, username, password_hash) VALUES (1, ?, ?)',
        [defaultConfig.username, defaultConfig.password_hash]
      );
      
      return defaultConfig;
    }
    
    const config = results[0];
    return {
      username: config.username,
      passwordHash: config.password_hash
    };
  } catch (error) {
    console.error('Error getting admin config:', error);
    // Retorna configuração padrão em caso de erro
    return {
      username: "admin",
      passwordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918" // "admin" - SHA-256 hashed
    };
  }
};

export const updateAdminConfig = async (config: any) => {
  try {
    const db = await getDbConnection();
    if (!db) throw new Error('Database not connected');
    
    await db.query(
      'UPDATE admin_config SET username = ?, password_hash = ? WHERE id = 1',
      [config.username, config.passwordHash]
    );
    
    return true;
  } catch (error) {
    console.error('Error updating admin config:', error);
    return false;
  }
};
