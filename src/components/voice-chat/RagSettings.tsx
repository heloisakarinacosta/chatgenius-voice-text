
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { embeddingService } from "@/utils/embeddingService";
import { RefreshCw } from "lucide-react";

const RagSettings = () => {
  const [ragEnabled, setRagEnabled] = useState<boolean>(true);
  const [indexStats, setIndexStats] = useState<{
    documentCount: number;
    chunkCount: number;
  } | null>(null);
  const [isReindexing, setIsReindexing] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    const ragEnabledValue = embeddingService.isEnabled();
    setRagEnabled(ragEnabledValue);
    
    updateIndexStats();
  }, []);
  
  const updateIndexStats = () => {
    if (embeddingService.isReady()) {
      setIndexStats(embeddingService.getStats());
    }
  };
  
  const handleRagToggle = (value: boolean) => {
    embeddingService.setEnabled(value);
    setRagEnabled(value);
    toast({
      title: `Sistema RAG ${value ? 'ativado' : 'desativado'}`
    });
  };
  
  const handleReindex = async () => {
    try {
      setIsReindexing(true);
      toast({
        title: "Reindexando documentos...",
      });
      await embeddingService.reindexAllDocuments();
      updateIndexStats();
      toast({
        title: "Reindexação concluída com sucesso"
      });
    } catch (error) {
      console.error("Erro ao reindexar documentos:", error);
      toast({
        title: "Erro ao reindexar documentos",
        variant: "destructive"
      });
    } finally {
      setIsReindexing(false);
    }
  };
  
  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-md font-medium">Sistema RAG</h3>
          <p className="text-sm text-muted-foreground">
            Encontra contexto relevante nos documentos de treinamento
          </p>
        </div>
        <Switch
          checked={ragEnabled}
          onCheckedChange={handleRagToggle}
        />
      </div>
      
      {ragEnabled && indexStats && (
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-muted p-2 rounded-md">
            <div className="text-sm">
              <span className="font-medium">Documentos indexados:</span> {indexStats.documentCount}
            </div>
            <div className="text-sm">
              <span className="font-medium">Fragmentos:</span> {indexStats.chunkCount}
            </div>
          </div>
          
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleReindex}
            disabled={isReindexing || !embeddingService.isReady()}
            className="w-full"
          >
            {isReindexing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Reindexando...
              </>
            ) : (
              <>Reindexar documentos</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default RagSettings;
