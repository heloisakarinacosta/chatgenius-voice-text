
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
    const requestBody: any = {
      model: options.model || "gpt-4o-mini",
      messages: options.messages,
      temperature: options.temperature || 0.7,
      stream: options.stream || false,
    };

    // Only include functions if they exist and are not empty
    if (options.functions && options.functions.length > 0) {
      requestBody.functions = options.functions;
    }

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
    console.error("Error calling OpenAI:", error);
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
    const requestBody: any = {
      model: options.model || "gpt-4o-mini",
      messages: options.messages,
      temperature: options.temperature || 0.7,
      stream: true,
    };

    // Only include functions if they exist and are not empty
    if (options.functions && options.functions.length > 0) {
      requestBody.functions = options.functions;
    }

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
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch (e) {
        // Se não for JSON, apenas continua
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

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");
      
      for (const line of lines) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            const json = JSON.parse(line.substring(6));
            if (json.choices && json.choices[0].delta && json.choices[0].delta.content) {
              const content = json.choices[0].delta.content;
              fullMessage += content;
              callbacks.onMessage?.(content);
            }
          } catch (e) {
            console.error("Error parsing JSON:", e);
          }
        }
      }
    }

    callbacks.onComplete?.(fullMessage);
  } catch (error) {
    console.error("Error streaming from OpenAI:", error);
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
