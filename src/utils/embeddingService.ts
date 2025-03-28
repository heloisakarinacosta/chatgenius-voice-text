
import CryptoJS from 'crypto-js';

// Interface para chunks de texto com metadados
export interface TextChunk {
  id: string;
  content: string;
  fileId: string;
  fileName: string;
  embedding?: number[];
}

// Interface para documento indexado
export interface IndexedDocument {
  chunks: TextChunk[];
  fileId: string;
  fileName: string;
}

// Interface para resultado de busca
export interface SearchResult {
  content: string;
  fileName: string;
  score: number;
}

// Serviço de embedding simplificado
export class EmbeddingService {
  private documents: Map<string, IndexedDocument> = new Map();
  private embeddingsCache: Map<string, number[]> = new Map();
  private ready = false;
  private minRelevanceScore = 0.15; // Reduzido para ser mais inclusivo com consultas curtas
  private processingPromises: Map<string, Promise<any>> = new Map(); // Para rastrear promessas ativas
  private debug = true; // Ativar logs detalhados

  constructor() {
    console.log("Embedding service initialized");
  }

  // Gera um hash do texto para usar como chave de cache
  private generateHash(text: string): string {
    // Usando CryptoJS em vez do módulo crypto do Node
    return CryptoJS.MD5(text).toString();
  }

  // Divide texto em chunks de tamanho adequado
  private chunkText(text: string, fileId: string, fileName: string): TextChunk[] {
    // Dividir por parágrafos primeiro
    const paragraphs = text.split(/\n\s*\n/);
    
    const chunks: TextChunk[] = [];
    let currentChunk = "";
    
    // Tamanho alvo para cada chunk (aproximadamente 200 palavras)
    const targetSize = 1000;
    
    for (const paragraph of paragraphs) {
      if (paragraph.trim().length === 0) continue;
      
      if ((currentChunk + paragraph).length <= targetSize) {
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      } else {
        if (currentChunk) {
          const id = this.generateHash(currentChunk);
          chunks.push({
            id,
            content: currentChunk,
            fileId,
            fileName
          });
        }
        currentChunk = paragraph;
      }
    }
    
    // Adicionar o último chunk se existir
    if (currentChunk) {
      const id = this.generateHash(currentChunk);
      chunks.push({
        id,
        content: currentChunk,
        fileId,
        fileName
      });
    }
    
    if (this.debug) {
      console.log(`Chunked text into ${chunks.length} chunks for file ${fileName}`);
    }
    
    return chunks;
  }

  // Implementação melhorada de embeddings
  private createEmbedding(text: string): number[] {
    const hash = this.generateHash(text);
    
    // Verificar cache
    if (this.embeddingsCache.has(hash)) {
      return this.embeddingsCache.get(hash)!;
    }
    
    // Pré-processamento: converter para minúsculas, remover pontuação, tokenizar
    const preprocessedText = text.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
      .replace(/\s{2,}/g, " ");
    
    // Extrair palavras importantes (mais de 2 caracteres)
    const words = preprocessedText.split(/\W+/).filter(w => w.length > 2);
    
    // Criar um vetor de 150 dimensões para melhor representação semântica
    const embedding = new Array(150).fill(0);
    
    words.forEach(word => {
      // Usar hashCode para distribuir palavras pelo vetor
      const wordHash = this.hashCode(word);
      const position = Math.abs(wordHash) % 150;
      
      // Aumentar a importância de palavras mais longas
      const wordImportance = Math.min(1.5, word.length / 4);
      embedding[position] += wordImportance;
      
      // Adicionar também em posições vizinhas para melhorar matches parciais
      if (position > 0) embedding[position - 1] += wordImportance * 0.5;
      if (position < 149) embedding[position + 1] += wordImportance * 0.5;
    });
    
    // Normalizar o vetor
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0)) || 1;
    const normalized = embedding.map(val => val / magnitude);
    
    // Armazenar em cache
    this.embeddingsCache.set(hash, normalized);
    
    return normalized;
  }

  // Função de hash melhorada para strings
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  // Calcula similaridade de cosseno com ajustes para melhorar relevância
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let matchedDimensions = 0;
    
    for (let i = 0; i < a.length; i++) {
      // Contabilizar quantas dimensões têm valores significativos em ambos os vetores
      if (a[i] > 0.01 && b[i] > 0.01) {
        matchedDimensions++;
      }
      dotProduct += a[i] * b[i];
    }
    
    // Bônus para vetores que compartilham mais dimensões ativadas
    const dimensionBonus = Math.min(0.3, matchedDimensions / 50);
    
    return dotProduct + dimensionBonus;
  }

  // Adiciona um documento ao índice
  public addDocument(fileId: string, fileName: string, content: string): void {
    if (this.debug) {
      console.log(`Adding document to embedding index: ${fileName} (${content.length} chars)`);
    }
    
    if (this.documents.has(fileId)) {
      console.log(`Document ${fileId} already exists in index, updating`);
      this.documents.delete(fileId);
    }
    
    const chunks = this.chunkText(content, fileId, fileName);
    
    // Criar embeddings para cada chunk
    for (const chunk of chunks) {
      chunk.embedding = this.createEmbedding(chunk.content);
    }
    
    this.documents.set(fileId, {
      chunks,
      fileId,
      fileName
    });
    
    this.ready = true;
    console.log(`Document ${fileName} added to index with ${chunks.length} chunks`);
  }

  // Remove um documento do índice
  public removeDocument(fileId: string): void {
    console.log(`Removing document ${fileId} from index`);
    this.documents.delete(fileId);
    this.ready = this.documents.size > 0;
    
    // Limpar quaisquer promessas pendentes associadas a este documento
    const promiseKey = `doc_${fileId}`;
    if (this.processingPromises.has(promiseKey)) {
      console.log(`Cleaning up pending promise for document ${fileId}`);
      this.processingPromises.delete(promiseKey);
    }
  }

  // Busca por documentos relevantes para uma query
  public search(query: string, topK: number = 3): SearchResult[] {
    if (!this.ready || this.documents.size === 0) {
      console.log("No documents in index or service not ready");
      return [];
    }
    
    if (this.debug) {
      console.log(`Searching for relevant chunks for query: "${query}"`);
    }
    
    try {
      // Para consultas muito curtas, adicione tratamento especial
      const isShortQuery = query.split(/\s+/).filter(w => w.length > 2).length <= 3;
      
      // Pré-processar a query da mesma forma que os documentos
      const queryEmbedding = this.createEmbedding(query);
      const results: Array<{content: string; fileName: string; score: number}> = [];
      
      // Buscar em todos os chunks de todos os documentos
      this.documents.forEach(doc => {
        doc.chunks.forEach(chunk => {
          if (chunk.embedding) {
            const score = this.cosineSimilarity(queryEmbedding, chunk.embedding);
            
            // Adicionar um boost para matches diretos de palavras-chave
            let keywordBoost = 0;
            const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 3);
            const contentLower = chunk.content.toLowerCase();
            
            // Verificar palavras-chave exatas no conteúdo
            for (const word of queryWords) {
              if (contentLower.includes(word)) {
                // Maior boost para palavras mais longas (provavelmente mais significativas)
                keywordBoost += Math.min(0.3, word.length / 15);
                
                // Boost adicional para consultas curtas
                if (isShortQuery) {
                  keywordBoost += 0.1;
                }
              }
            }
            
            // Pontuação final é a similaridade de cosseno + boost de palavras-chave
            const finalScore = score + keywordBoost;
            
            // Para consultas curtas, reduzir o threshold de inclusão
            const effectiveThreshold = isShortQuery ? 
              this.minRelevanceScore * 0.7 : this.minRelevanceScore;
            
            // Só adiciona resultados acima do limite mínimo de relevância
            if (finalScore > effectiveThreshold) {
              results.push({
                content: chunk.content,
                fileName: chunk.fileName,
                score: finalScore
              });
            }
          }
        });
      });
      
      // Ordenar por similaridade
      results.sort((a, b) => b.score - a.score);
      
      // Log de debug para ajudar a entender os resultados
      if (results.length > 0) {
        console.log(`Top result score: ${results[0].score.toFixed(3)} from file: ${results[0].fileName}`);
        
        if (this.debug && results.length > 0) {
          console.log("Top results details:");
          results.slice(0, 3).forEach((r, i) => {
            console.log(`${i+1}. File: ${r.fileName}, Score: ${r.score.toFixed(3)}`);
            console.log(`   Preview: ${r.content.substring(0, 100)}...`);
          });
        }
      } else {
        const effectiveThreshold = isShortQuery ? 
          this.minRelevanceScore * 0.7 : this.minRelevanceScore;
        console.log(`No results above threshold (${effectiveThreshold})`);
      }
      
      // Retornar os top-K resultados
      const topResults = results.slice(0, topK);
      
      console.log(`Found ${topResults.length} relevant chunks (from ${results.length} total above threshold)`);
      return topResults;
    } catch (error) {
      console.error("Error in search:", error);
      return [];
    }
  }

  // Busca assíncrona com promise e timeout
  public async searchAsync(query: string, topK: number = 3, timeoutMs: number = 3000): Promise<SearchResult[]> {
    const searchPromise = new Promise<SearchResult[]>((resolve) => {
      resolve(this.search(query, topK));
    });
    
    const timeoutPromise = new Promise<SearchResult[]>((_, reject) => {
      setTimeout(() => reject(new Error('Search timeout')), timeoutMs);
    });
    
    try {
      return await Promise.race([searchPromise, timeoutPromise]);
    } catch (error) {
      console.error("Search timed out or failed:", error);
      return [];
    }
  }

  // Verifica se o serviço está pronto
  public isReady(): boolean {
    return this.ready;
  }

  // Retorna estatísticas sobre os documentos indexados
  public getStats(): { documentCount: number; chunkCount: number } {
    let chunkCount = 0;
    
    this.documents.forEach(doc => {
      chunkCount += doc.chunks.length;
    });
    
    return {
      documentCount: this.documents.size,
      chunkCount
    };
  }
  
  // Método para obter contexto relevante para uma query
  public async getRelevantContext(query: string, maxChars: number = 4000): Promise<string> {
    try {
      // Verificação especial para consultas curtas relacionadas a termos específicos ou siglas
      const normalizedQuery = query.toLowerCase().trim();
      const specialTerms = ["cpj", "cpj-3c", "spiced", "office.adv"];
      
      let specialTermBoost = false;
      for (const term of specialTerms) {
        if (normalizedQuery.includes(term)) {
          specialTermBoost = true;
          console.log(`Detected special term "${term}" in query. Applying special handling.`);
          break;
        }
      }
      
      // Gerar um ID para esta operação de busca específica
      const operationId = `query_${this.generateHash(query)}_${Date.now()}`;
      
      // Criar a promessa com timeout
      const contextPromise = new Promise<string>(async (resolve) => {
        // Buscar um número maior de resultados para garantir mais contexto
        // Para termos especiais, aumentamos ainda mais o número de resultados
        const numResults = specialTermBoost ? 8 : 5;
        const results = await this.searchAsync(query, numResults);
        
        if (results.length === 0) {
          // Se não achou nada com busca normal, tentar busca direta por termos especiais
          if (specialTermBoost) {
            console.log("Trying direct file matching for special terms...");
            
            // Busca direta nos nomes dos arquivos
            const directMatches: SearchResult[] = [];
            this.documents.forEach(doc => {
              for (const term of specialTerms) {
                if (doc.fileName.toLowerCase().includes(term) && 
                    normalizedQuery.includes(term)) {
                  // Encontrou um arquivo que contém o termo especial
                  directMatches.push({
                    content: doc.chunks[0]?.content || "",
                    fileName: doc.fileName,
                    score: 0.95 // Score alto para forçar inclusão
                  });
                  console.log(`Direct match found: ${doc.fileName} for term "${term}"`);
                }
              }
            });
            
            if (directMatches.length > 0) {
              let context = "Informações relevantes sobre a consulta:\n\n";
              let totalChars = context.length;
              
              for (const result of directMatches) {
                const entry = `### Conteúdo de ${result.fileName} (correspondência direta):\n${result.content}\n\n`;
                
                if (totalChars + entry.length <= maxChars) {
                  context += entry;
                  totalChars += entry.length;
                } else {
                  break;
                }
              }
              
              console.log(`Generated direct match context with ${totalChars} characters`);
              resolve(context);
              return;
            }
          }
          
          console.log("No relevant context found for query");
          resolve("");
          return;
        }
        
        let context = "Informações relevantes sobre a consulta:\n\n";
        let totalChars = context.length;
        
        // Debug para mostrar todos os resultados encontrados
        console.log(`Found ${results.length} results for query "${query}":`);
        results.forEach((r, i) => {
          console.log(`Result ${i+1}: Score ${r.score.toFixed(3)}, File: ${r.fileName}`);
        });
        
        // Adiciona cada resultado ao contexto, mantendo abaixo do limite de caracteres
        for (const result of results) {
          const entry = `### Trecho de ${result.fileName} (relevância: ${result.score.toFixed(2)}):\n${result.content}\n\n`;
          
          if (totalChars + entry.length <= maxChars) {
            context += entry;
            totalChars += entry.length;
          } else {
            // Se o próximo trecho ultrapassa o limite, adiciona uma versão truncada
            const remainingChars = maxChars - totalChars - 100;
            if (remainingChars > 200) {
              const truncatedEntry = `### Trecho de ${result.fileName} (relevância: ${result.score.toFixed(2)}):\n${result.content.substring(0, remainingChars)}...\n\n`;
              context += truncatedEntry;
            }
            break;
          }
        }
        
        console.log(`Generated context with ${totalChars} characters from ${results.length} relevant chunks`);
        resolve(context);
      });
      
      // Registrar a promessa para limpeza posterior se necessário
      this.processingPromises.set(operationId, contextPromise);
      
      // Definir um timeout
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Context generation timeout'));
          // Limpar após o timeout
          if (this.processingPromises.has(operationId)) {
            this.processingPromises.delete(operationId);
          }
        }, 5000); // 5 segundos de timeout
      });
      
      // Executar com timeout
      const result = await Promise.race([contextPromise, timeoutPromise]);
      
      // Limpar após conclusão
      if (this.processingPromises.has(operationId)) {
        this.processingPromises.delete(operationId);
      }
      
      return result;
    } catch (error) {
      console.error("Error getting relevant context:", error);
      return "";
    }
  }

  // Limpar a memória e reindexar todos os documentos
  public reindexAllDocuments(): void {
    console.log("Reindexing all documents...");
    
    // Guardar referência para os documentos atuais
    const currentDocuments = new Map(this.documents);
    
    // Limpar embeddings e documentos
    this.embeddingsCache.clear();
    this.documents.clear();
    this.ready = false;
    
    // Reindexar cada documento
    currentDocuments.forEach(doc => {
      // Para cada documento, precisamos acessar um original para obter o conteúdo
      const originalContent = doc.chunks.map(chunk => chunk.content).join("\n\n");
      this.addDocument(doc.fileId, doc.fileName, originalContent);
    });
    
    console.log(`Reindexed ${currentDocuments.size} documents`);
    this.ready = this.documents.size > 0;
  }
  
  // Obter mais detalhes sobre o documento
  public getDocumentDetails(fileId: string): { fileName: string; chunkCount: number } | null {
    const doc = this.documents.get(fileId);
    if (!doc) return null;
    
    return {
      fileName: doc.fileName,
      chunkCount: doc.chunks.length
    };
  }
  
  // Ativar ou desativar debug
  public setDebug(enable: boolean): void {
    this.debug = enable;
    console.log(`Debug mode ${enable ? 'enabled' : 'disabled'}`);
  }
}

// Instância singleton do serviço para ser usada em toda a aplicação
export const embeddingService = new EmbeddingService();
