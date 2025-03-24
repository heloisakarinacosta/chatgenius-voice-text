
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
        system_prompt: "You are a helpful assistant. Provide clear and concise information to the user's queries.",
        voice_enabled: true,
        voice_id: "alloy",
        voice_language: "en-US",
        voice_latency: 100
      };
      
      await pool.query(
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
      const config = configRows[0];
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
    
    // Get agent functions
    const [functionRows] = await pool.query('SELECT * FROM agent_functions');
    const functions = functionRows.map(func => ({
      name: func.name,
      description: func.description,
      parameters: JSON.parse(func.parameters),
      webhook: func.webhook
    }));
    
    // Get training files
    const [fileRows] = await pool.query('SELECT * FROM training_files');
    const trainingFiles = fileRows.map(file => ({
      id: file.id,
      name: file.name,
      content: file.content,
      size: file.size,
      type: file.type,
      timestamp: new Date(file.timestamp)
    }));
    
    res.json({
      ...agentConfig,
      functions,
      trainingFiles
    });
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
    
    // Update basic config
    await pool.query(
      'UPDATE agent_config SET system_prompt = ?, voice_enabled = ?, voice_id = ?, voice_language = ?, voice_latency = ? WHERE id = 1',
      [systemPrompt, voice.enabled, voice.voiceId, voice.language, voice.latency]
    );
    
    // Update functions (remove all and insert again)
    await pool.query('DELETE FROM agent_functions');
    
    if (functions && functions.length > 0) {
      const functionsValues = functions.map(func => [
        func.name,
        func.description,
        JSON.stringify(func.parameters),
        func.webhook
      ]);
      
      const placeholders = functions.map(() => '(?, ?, ?, ?)').join(', ');
      const flatValues = functionsValues.flat();
      
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
