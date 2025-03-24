
export interface OpenAIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OpenAIFunction {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface OpenAICompletionOptions {
  messages: OpenAIMessage[];
  model?: string;
  temperature?: number;
  functions?: OpenAIFunction[];
  stream?: boolean;
  trainingFiles?: Array<{
    id: string;
    name: string;
    content: string;
    size: number;
    type: string;
    timestamp: Date;
  }>;
  max_tokens?: number;
  detectEmotion?: boolean;
}

export interface StreamCallbacks {
  onMessage?: (message: string) => void;
  onComplete?: (fullMessage: string) => void;
  onError?: (error: any) => void;
}

export async function callOpenAI(options: OpenAICompletionOptions, apiKey: string): Promise<string> {
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  try {
    // Prepare messages with training files if available
    let messages = [...options.messages];
    
    // Add training files as context if they exist
    if (options.trainingFiles && options.trainingFiles.length > 0) {
      // Create a context message with all training files content
      const trainingContent = options.trainingFiles.map(file => {
        return `### Conteúdo do arquivo: ${file.name}\n\n${file.content}\n\n`;
      }).join("\n");
      
      // Insert the training content after the system message
      const systemMessageIndex = messages.findIndex(msg => msg.role === "system");
      if (systemMessageIndex !== -1) {
        // Append to existing system message
        messages[systemMessageIndex].content += `\n\nEu fornecerei algumas informações adicionais que você deve usar para responder às perguntas do usuário:\n\n${trainingContent}`;
      } else {
        // Add as a new system message if no system message exists
        messages.unshift({
          role: "system",
          content: `Use as seguintes informações para responder às perguntas do usuário:\n\n${trainingContent}`
        });
      }
    }

    // Add emotion detection directive if enabled
    if (options.detectEmotion) {
      const lastUserMessage = messages.findLast(msg => msg.role === "user");
      if (lastUserMessage) {
        messages = [
          ...messages,
          {
            role: "system",
            content: "Por favor, antes de responder, avalie o tom emocional da mensagem do usuário e adapte sua resposta de acordo com essa emoção."
          }
        ];
      }
    }

    const requestBody: any = {
      model: options.model || "gpt-4o-mini",
      messages: messages,
      temperature: options.temperature || 0.7,
      stream: options.stream || false,
      max_tokens: options.max_tokens || 1024,
    };

    // Only include functions if they exist and are not empty
    if (options.functions && options.functions.length > 0) {
      requestBody.functions = options.functions;
    }

    console.log("Enviando requisição para OpenAI API:", {
      ...requestBody,
      messages: `${requestBody.messages.length} mensagens`,
      hasTrainingFiles: options.trainingFiles && options.trainingFiles.length > 0,
      detectEmotion: options.detectEmotion
    });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Erro na resposta da OpenAI API:", error);
      
      if (response.status === 429) {
        throw new Error("API_QUOTA_EXCEEDED");
      } else if (response.status === 401) {
        throw new Error("API_KEY_INVALID");
      } else {
        throw new Error(error.error?.message || "Failed to call OpenAI API");
      }
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Erro ao chamar OpenAI:", error);
    throw error;
  }
}

export async function streamOpenAI(
  options: OpenAICompletionOptions,
  apiKey: string,
  callbacks: StreamCallbacks
): Promise<void> {
  if (!apiKey) {
    callbacks.onError?.(new Error("API_KEY_MISSING"));
    return;
  }

  try {
    // Prepare messages with training files if available
    let messages = [...options.messages];
    
    // Add training files as context if they exist
    if (options.trainingFiles && options.trainingFiles.length > 0) {
      // Create a context message with all training files content
      const trainingContent = options.trainingFiles.map(file => {
        return `### Conteúdo do arquivo: ${file.name}\n\n${file.content}\n\n`;
      }).join("\n");
      
      // Insert the training content after the system message
      const systemMessageIndex = messages.findIndex(msg => msg.role === "system");
      if (systemMessageIndex !== -1) {
        // Append to existing system message
        messages[systemMessageIndex].content += `\n\nEu fornecerei algumas informações adicionais que você deve usar para responder às perguntas do usuário:\n\n${trainingContent}`;
      } else {
        // Add as a new system message if no system message exists
        messages.unshift({
          role: "system",
          content: `Use as seguintes informações para responder às perguntas do usuário:\n\n${trainingContent}`
        });
      }
    }

    // Add emotion detection directive if enabled
    if (options.detectEmotion) {
      messages.push({
        role: "system",
        content: "Por favor, avalie o tom emocional da mensagem do usuário e adapte sua resposta de acordo com essa emoção."
      });
    }

    const requestBody: any = {
      model: options.model || "gpt-4o-mini",
      messages: messages,
      temperature: options.temperature || 0.7,
      stream: true,
      max_tokens: options.max_tokens || 1024,
    };

    // Only include functions if they exist and are not empty
    if (options.functions && options.functions.length > 0) {
      requestBody.functions = options.functions;
    }

    console.log("Enviando streaming para OpenAI API:", {
      ...requestBody,
      messages: `${requestBody.messages.length} mensagens`,
      hasTrainingFiles: options.trainingFiles && options.trainingFiles.length > 0,
      detectEmotion: options.detectEmotion
    });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Erro na resposta de streaming (${response.status}): ${errorText}`);
      
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch (e) {
        // Se não for JSON, apenas continua
        console.log("Resposta de erro não é JSON válido");
      }
      
      if (response.status === 429) {
        throw new Error("API_QUOTA_EXCEEDED");
      } else if (response.status === 401) {
        throw new Error("API_KEY_INVALID");
      } else {
        throw new Error(errorJson?.error?.message || `Error ${response.status}: ${response.statusText}`);
      }
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullMessage = "";
    let buffer = "";

    console.log("Iniciando leitura do stream");

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log("Stream concluído");
        break;
      }

      const chunk = decoder.decode(value);
      buffer += chunk;

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.substring(6);
          
          if (data === "[DONE]") {
            console.log("Recebido [DONE] no stream");
            continue;
          }
          
          try {
            const json = JSON.parse(data);
            if (json.choices && json.choices[0].delta && json.choices[0].delta.content) {
              const content = json.choices[0].delta.content;
              fullMessage += content;
              callbacks.onMessage?.(content);
            }
          } catch (e) {
            console.error("Erro ao parsear JSON do stream:", e, "Line:", line);
          }
        }
      }
    }

    console.log("Stream completo, mensagem final:", fullMessage);
    callbacks.onComplete?.(fullMessage);
  } catch (error) {
    console.error("Erro ao fazer streaming da OpenAI:", error);
    callbacks.onError?.(error);
  }
}

export async function generateSpeech(
  text: string, 
  voiceId: string, 
  apiKey: string
): Promise<ArrayBuffer> {
  console.log(`Generating speech for text: ${text.substring(0, 50)}...`);
  console.log(`Using voice ID: ${voiceId}`);
  
  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text,
        voice: voiceId,
      }),
    });

    if (!response.ok) {
      console.error(`Speech generation error: ${response.status} ${response.statusText}`);
      const errorBody = await response.text();
      console.error(`Error response: ${errorBody}`);
      
      let errorMessage = "Failed to generate speech";
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch (e) {
        // If parsing fails, use the default message
      }
      
      throw new Error(errorMessage);
    }

    console.log("Speech generated successfully");
    return await response.arrayBuffer();
  } catch (error) {
    console.error("Error generating speech:", error);
    throw error;
  }
}

export async function transcribeAudio(
  audioBlob: Blob,
  apiKey: string
): Promise<string> {
  try {
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");
    formData.append("model", "whisper-1");
    
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Failed to transcribe audio");
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw error;
  }
}
