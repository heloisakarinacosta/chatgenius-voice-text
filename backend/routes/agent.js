
const express = require('express');
const router = express.Router();
const db = require('../database');

// Get agent configuration
router.get('/', async (req, res) => {
  try {
    const pool = db.getDbConnection();
    if (!pool) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    // Get basic agent config
    const [configRows] = await pool.query('SELECT * FROM agent_config WHERE id = 1');
    
    let agentConfig;
    if (configRows.length === 0) {
      // Insert default config if not exists
      const defaultConfig = {
        system_prompt: "Você é um assistente útil e prestativo. Forneça informações claras e concisas para as perguntas do usuário. Responda sempre em português do Brasil.",
        voice_enabled: true,
        voice_id: "nova",
        voice_language: "pt-BR",
        voice_latency: 30,          // Reduzido para menor latência
        silence_timeout: 0.6,        // Ajustado para melhor detecção de silêncio
        max_call_duration: 1800,
        wait_before_speaking: 0.05,   // Reduzido para resposta mais imediata
        wait_after_punctuation: 0.03, // Reduzido para fluidez
        wait_without_punctuation: 0.2, // Reduzido para melhor fluidez
        wait_after_number: 0.1        // Reduzido para melhor fluidez
      };
      
      await pool.query(
        'INSERT INTO agent_config (id, system_prompt, voice_enabled, voice_id, voice_language, voice_latency, ' +
        'silence_timeout, max_call_duration, wait_before_speaking, wait_after_punctuation, wait_without_punctuation, wait_after_number) ' +
        'VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          defaultConfig.system_prompt, 
          defaultConfig.voice_enabled, 
          defaultConfig.voice_id, 
          defaultConfig.voice_language, 
          defaultConfig.voice_latency,
          defaultConfig.silence_timeout,
          defaultConfig.max_call_duration,
          defaultConfig.wait_before_speaking,
          defaultConfig.wait_after_punctuation,
          defaultConfig.wait_without_punctuation,
          defaultConfig.wait_after_number
        ]
      );
      
      agentConfig = {
        systemPrompt: defaultConfig.system_prompt,
        voice: {
          enabled: defaultConfig.voice_enabled,
          voiceId: defaultConfig.voice_id,
          language: defaultConfig.voice_language,
          latency: defaultConfig.voice_latency,
          silenceTimeout: defaultConfig.silence_timeout,
          maxCallDuration: defaultConfig.max_call_duration,
          waitBeforeSpeaking: defaultConfig.wait_before_speaking,
          waitAfterPunctuation: defaultConfig.wait_after_punctuation,
          waitWithoutPunctuation: defaultConfig.wait_without_punctuation,
          waitAfterNumber: defaultConfig.wait_after_number
        },
        functions: [],
        trainingFiles: []
      };
    } else {
      const config = configRows[0];
      agentConfig = {
        systemPrompt: config.system_prompt,
        voice: {
          enabled: Boolean(config.voice_enabled),
          voiceId: config.voice_id,
          language: config.voice_language,
          latency: config.voice_latency || 30,
          silenceTimeout: config.silence_timeout || 0.6,
          maxCallDuration: config.max_call_duration || 1800,
          waitBeforeSpeaking: config.wait_before_speaking || 0.05,
          waitAfterPunctuation: config.wait_after_punctuation || 0.03,
          waitWithoutPunctuation: config.wait_without_punctuation || 0.2,
          waitAfterNumber: config.wait_after_number || 0.1
        },
        functions: [],
        trainingFiles: []
      };
    }
    
    // Get agent functions
    const [functionRows] = await pool.query('SELECT * FROM agent_functions');
    agentConfig.functions = functionRows.map(func => ({
      name: func.name,
      description: func.description,
      parameters: JSON.parse(func.parameters),
      webhook: func.webhook
    }));
    
    // Get training files
    const [fileRows] = await pool.query('SELECT * FROM training_files');
    agentConfig.trainingFiles = fileRows.map(file => ({
      id: file.id,
      name: file.name,
      content: file.content,
      size: file.size,
      type: file.type,
      timestamp: file.timestamp
    }));
    
    // Add platform detection info for client-side optimizations
    agentConfig.platformInfo = {
      isOptimized: true,
      version: "1.2.0"
    };
    
    res.json(agentConfig);
  } catch (error) {
    console.error('Error fetching agent config:', error);
    res.status(500).json({ error: 'Failed to fetch agent configuration' });
  }
});

// Update agent configuration
router.put('/', async (req, res) => {
  try {
    const { systemPrompt, voice, functions } = req.body;
    
    const pool = db.getDbConnection();
    if (!pool) {
      return res.status(503).json({ error: 'Database not connected' });
    }
    
    // Update basic config with voice settings
    await pool.query(
      'UPDATE agent_config SET ' + 
      'system_prompt = ?, voice_enabled = ?, voice_id = ?, voice_language = ?, voice_latency = ?, ' +
      'silence_timeout = ?, max_call_duration = ?, wait_before_speaking = ?, ' +
      'wait_after_punctuation = ?, wait_without_punctuation = ?, wait_after_number = ? ' +
      'WHERE id = 1',
      [
        systemPrompt, 
        voice.enabled, 
        voice.voiceId, 
        voice.language, 
        voice.latency,
        voice.silenceTimeout || 0.6,
        voice.maxCallDuration || 1800,
        voice.waitBeforeSpeaking || 0.05,
        voice.waitAfterPunctuation || 0.03,
        voice.waitWithoutPunctuation || 0.2,
        voice.waitAfterNumber || 0.1
      ]
    );
    
    // Update functions (remove all and insert again)
    await pool.query('DELETE FROM agent_functions');
    
    if (functions && functions.length > 0) {
      const values = functions.map(func => [
        func.name,
        func.description,
        JSON.stringify(func.parameters),
        func.webhook
      ]);
      
      const placeholders = functions.map(() => '(?, ?, ?, ?)').join(', ');
      const flatValues = values.flat();
      
      await pool.query(
        `INSERT INTO agent_functions (name, description, parameters, webhook) VALUES ${placeholders}`,
        flatValues
      );
    }
    
    res.json({ success: true, message: 'Agent configuration updated successfully' });
  } catch (error) {
    console.error('Error updating agent config:', error);
    res.status(500).json({ error: 'Failed to update agent configuration' });
  }
});

module.exports = router;
