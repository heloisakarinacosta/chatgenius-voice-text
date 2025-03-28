import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Search, RefreshCw, FileText } from "lucide-react";
import { AgentFunction } from "@/contexts/ChatContext";
import { embeddingService } from "@/utils/embeddingService";

export interface FunctionFormState {
  name: string;
  description: string;
  parameters: Record<string, any> | string;
  webhook: string;
}

interface FunctionFormProps {
  newFunction: FunctionFormState;
  setNewFunction: (func: FunctionFormState) => void;
  addOrUpdateFunction: () => void;
  editingFunctionIndex: number | null;
  cancelEditing: () => void;
}

const FunctionForm: React.FC<FunctionFormProps> = ({
  newFunction,
  setNewFunction,
  addOrUpdateFunction,
  editingFunctionIndex,
  cancelEditing,
}) => {
  const [parametersError, setParametersError] = useState<string | null>(null);
  const [testQuery, setTestQuery] = useState("");
  const [testResults, setTestResults] = useState<string | null>(null);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [rawResults, setRawResults] = useState<Array<{fileName: string; score: number; content: string}> | null>(null);
  
  // Function to handle parameter changes
  const handleParameterChange = (value: string) => {
    setNewFunction({
      ...newFunction,
      parameters: value
    });
    
    // Validate JSON
    try {
      JSON.parse(value);
      setParametersError(null);
    } catch (e) {
      setParametersError("Invalid JSON format: " + (e as Error).message);
    }
  };
  
  const handleSubmit = () => {
    // Validate required fields
    if (!newFunction.name) {
      toast.error("Function name is required");
      return;
    }
    
    if (!newFunction.description) {
      toast.error("Function description is required");
      return;
    }
    
    if (!newFunction.webhook) {
      toast.error("Webhook URL is required");
      return;
    }
    
    // Validate parameters JSON
    try {
      if (typeof newFunction.parameters === 'string') {
        JSON.parse(newFunction.parameters);
      }
      addOrUpdateFunction();
    } catch (e) {
      toast.error("Invalid parameters JSON: " + (e as Error).message);
    }
  };
  
  const testEmbeddingSearch = async () => {
    if (!testQuery.trim()) {
      toast.error("Por favor, insira uma consulta para testar");
      return;
    }
    
    if (!embeddingService.isReady()) {
      toast.error("O serviço de embedding não está pronto. Adicione arquivos de treinamento primeiro.");
      return;
    }
    
    try {
      setIsSearching(true);
      setDebugInfo(null);
      setRawResults(null);
      
      // Ativar modo debug
      embeddingService.setDebug(true);
      
      // Buscar resultados brutos para mostrar detalhes
      const results = embeddingService.search(testQuery, 5);
      setRawResults(results);
      
      // Construir informações de debug
      let debug = "Detalhes da busca:\n";
      if (results.length > 0) {
        debug += results.map((r, i) => 
          `${i+1}. Arquivo: ${r.fileName}\n   Score: ${r.score.toFixed(4)}\n   Primeiros 100 chars: ${r.content.substring(0, 100)}...\n`
        ).join("\n");
      } else {
        debug += "Nenhum resultado encontrado acima do limiar de relevância.\n";
        debug += "Isso pode indicar que o texto que você está procurando não está nos documentos,\n";
        debug += "ou que o algoritmo de relevância não encontrou correspondência suficiente.\n";
        
        // Sugerir termos semelhantes
        const specialTerms = ["cpj", "cpj-3c", "spiced", "office.adv"];
        const queryLower = testQuery.toLowerCase();
        
        for (const term of specialTerms) {
          if (queryLower.includes(term)) {
            debug += `\nDica: Foi detectado o termo especial "${term}" na consulta.\n`;
            debug += `Tente uma consulta mais específica que inclua mais contexto.\n`;
            break;
          }
        }
      }
      
      // Definir detalhes da busca
      setDebugInfo(debug);
      
      // Busca contexto relevante usando await para lidar com a Promise
      const context = await embeddingService.getRelevantContext(testQuery);
      
      if (!context) {
        setTestResults("Nenhum contexto relevante encontrado para a consulta.");
        return;
      }
      
      setTestResults(context);
      toast.success("Busca de contexto realizada com sucesso");
    } catch (error) {
      console.error("Erro ao testar busca:", error);
      toast.error("Ocorreu um erro ao testar a busca de contexto");
      setTestResults("Erro ao realizar busca: " + (error as Error).message);
    } finally {
      setIsSearching(false);
      // Desativar modo debug
      embeddingService.setDebug(false);
    }
  };

  const reindexDocuments = () => {
    try {
      // Reindexar todos os documentos com o algoritmo atualizado
      embeddingService.reindexAllDocuments();
      toast.success("Documentos reindexados com sucesso");
    } catch (error) {
      console.error("Erro ao reindexar documentos:", error);
      toast.error("Erro ao reindexar documentos");
    }
  };
  
  const clearTestResults = () => {
    setTestResults(null);
    setDebugInfo(null);
    setRawResults(null);
  };

  return (
    <div className="space-y-4 pb-4 border-b">
      <h3 className="text-lg font-medium">
        {editingFunctionIndex !== null ? "Edit Function" : "Add New Function"}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="funcName">Function Name</Label>
          <Input
            id="funcName"
            value={newFunction.name}
            onChange={(e) => setNewFunction({
              ...newFunction,
              name: e.target.value,
            })}
            placeholder="check_availability"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="funcWebhook">Webhook URL</Label>
          <Input
            id="funcWebhook"
            value={newFunction.webhook}
            onChange={(e) => setNewFunction({
              ...newFunction,
              webhook: e.target.value,
            })}
            placeholder="https://example.com/api/webhook"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="funcDescription">Description</Label>
        <Input
          id="funcDescription"
          value={newFunction.description}
          onChange={(e) => setNewFunction({
            ...newFunction,
            description: e.target.value,
          })}
          placeholder="Check appointment availability for a specific date and time"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="funcParams">Parameters (JSON Schema)</Label>
        <Textarea
          id="funcParams"
          value={typeof newFunction.parameters === 'object' 
            ? JSON.stringify(newFunction.parameters, null, 2) 
            : newFunction.parameters as string}
          onChange={(e) => handleParameterChange(e.target.value)}
          rows={5}
          placeholder={`{
  "type": "object",
  "properties": {
    "date": {
      "type": "string",
      "format": "date",
      "description": "The date for the appointment"
    },
    "time": {
      "type": "string",
      "description": "The time for the appointment"
    }
  },
  "required": ["date", "time"]
}`}
          className={`font-mono text-sm ${parametersError ? 'border-destructive' : ''}`}
        />
        {parametersError && (
          <Alert variant="destructive" className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {parametersError}
            </AlertDescription>
          </Alert>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          The parameters should be a valid JSON Schema object. This defines what parameters the function accepts.
        </p>
      </div>
      
      {/* Painel de teste de RAG */}
      <div className="border-t pt-4 mt-4">
        <div className="flex gap-2 mb-4">
          <Button 
            variant="outline" 
            type="button" 
            onClick={() => setShowTestPanel(!showTestPanel)}
          >
            {showTestPanel ? "Ocultar Teste RAG" : "Testar Sistema RAG"}
          </Button>
          
          <Button
            variant="secondary"
            type="button"
            onClick={reindexDocuments}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Reindexar Documentos
          </Button>
        </div>
        
        {showTestPanel && (
          <div className="space-y-4 p-4 border rounded-md bg-muted/30">
            <h4 className="font-medium">Teste de Busca de Contexto Relevante</h4>
            <p className="text-sm text-muted-foreground">
              Use este painel para testar a busca de contexto relevante nos arquivos de treinamento.
            </p>
            
            <div className="flex gap-2">
              <Input
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                placeholder="Digite uma consulta para testar..."
                className="flex-1"
              />
              <Button 
                onClick={testEmbeddingSearch}
                size="sm"
                className="flex items-center gap-1"
                disabled={isSearching}
              >
                <Search className="h-4 w-4" />
                {isSearching ? "Buscando..." : "Testar"}
              </Button>
            </div>
            
            {rawResults && rawResults.length > 0 && (
              <div className="mt-2">
                <h5 className="text-sm font-medium mb-2">Resultados encontrados:</h5>
                <div className="grid gap-2">
                  {rawResults.map((result, index) => (
                    <div key={index} className="border rounded-md p-3 bg-background">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">{result.fileName}</span>
                        </div>
                        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs">
                          Score: {result.score.toFixed(3)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {result.content.substring(0, 150)}...
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {debugInfo && (
              <div className="mt-2">
                <h5 className="text-sm font-medium mb-2">Detalhes da busca:</h5>
                <div className="bg-background border rounded-md p-2 max-h-40 overflow-y-auto">
                  <pre className="text-xs whitespace-pre-wrap">{debugInfo}</pre>
                </div>
              </div>
            )}
            
            {testResults && (
              <div className="mt-2">
                <h5 className="text-sm font-medium mb-2">Contexto relevante:</h5>
                <div className="bg-background border rounded-md p-2 max-h-60 overflow-y-auto">
                  <pre className="text-xs whitespace-pre-wrap">{testResults}</pre>
                </div>
                <div className="flex justify-end mt-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearTestResults}
                  >
                    Limpar resultados
                  </Button>
                </div>
              </div>
            )}
            
            <div className="pt-2">
              <p className="text-xs text-muted-foreground">
                Estatísticas:
                {embeddingService.isReady() ? (
                  <>
                    <span className="ml-1">
                      {embeddingService.getStats().documentCount} documentos,
                    </span>
                    <span className="ml-1">
                      {embeddingService.getStats().chunkCount} chunks indexados
                    </span>
                  </>
                ) : (
                  <span className="ml-1">Serviço não inicializado</span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <Button onClick={handleSubmit}>
          {editingFunctionIndex !== null ? "Update Function" : "Add Function"}
        </Button>
        {editingFunctionIndex !== null && (
          <Button variant="outline" onClick={cancelEditing}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};

export default FunctionForm;
