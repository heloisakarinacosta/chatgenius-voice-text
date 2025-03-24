
import React, { useState, useRef } from "react";
import { Card, CardHeader, CardContent, CardDescription, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrainingFile } from "@/contexts/ChatContext";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { File, FileUp, Trash2, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatBytes } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TrainingFilesTabProps {
  trainingFiles: TrainingFile[];
  addTrainingFile: (file: File) => Promise<void>;
  removeTrainingFile: (id: string) => void;
}

const TrainingFilesTab: React.FC<TrainingFilesTabProps> = ({
  trainingFiles,
  addTrainingFile,
  removeTrainingFile,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [openFileId, setOpenFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    try {
      // Process only text files
      const file = files[0];
      
      // Check if file is a text file or docx
      if (!file.type.startsWith("text/") && 
          !file.name.endsWith(".txt") && 
          !file.name.endsWith(".md") &&
          !file.name.endsWith(".csv") &&
          !file.name.endsWith(".json") &&
          !file.name.endsWith(".docx") &&
          !file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        toast.error("Por favor, envie apenas arquivos de texto (.txt, .md, .csv, .json, .docx)");
        return;
      }
      
      // Check file size (max 1MB)
      if (file.size > 1024 * 1024) {
        toast.error("O arquivo é muito grande. O tamanho máximo é de 1MB");
        return;
      }
      
      await addTrainingFile(file);
      toast.success(`Arquivo "${file.name}" adicionado com sucesso`);
      
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Erro ao fazer upload do arquivo");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = (id: string, name: string) => {
    removeTrainingFile(id);
    toast.success(`Arquivo "${name}" removido com sucesso`);
  };

  const toggleFilePreview = (id: string) => {
    setOpenFileId(openFileId === id ? null : id);
  };

  // Get file icon based on file extension
  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith(".json")) return "JSON";
    if (fileName.endsWith(".csv")) return "CSV";
    if (fileName.endsWith(".md")) return "MD";
    if (fileName.endsWith(".docx")) return "DOCX";
    return "TXT";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Arquivos de Treinamento</CardTitle>
        <CardDescription>
          Adicione arquivos de texto para treinar seu assistente AI com conhecimento personalizado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fileUpload">Upload de Arquivo</Label>
          <div className="flex gap-2">
            <Input
              ref={fileInputRef}
              id="fileUpload"
              type="file"
              accept=".txt,.md,.csv,.json,.docx,text/plain,text/markdown,text/csv,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              onClick={handleUploadClick}
              variant="outline"
              className="w-full border-dashed border-2 p-8 flex flex-col items-center justify-center gap-2"
              disabled={isUploading}
            >
              <FileUp className="h-6 w-6 text-muted-foreground" />
              <span>{isUploading ? "Carregando..." : "Clique para selecionar um arquivo"}</span>
              <span className="text-xs text-muted-foreground">
                Suporta arquivos .txt, .md, .csv, .json, .docx (Max: 1MB)
              </span>
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Arquivos Carregados ({trainingFiles.length})</Label>
            {trainingFiles.length > 0 && (
              <p className="text-xs text-muted-foreground">Clique em um arquivo para ver o conteúdo</p>
            )}
          </div>
          
          {trainingFiles.length === 0 ? (
            <div className="bg-muted p-4 rounded-md text-center text-muted-foreground">
              <FileText className="h-6 w-6 mx-auto mb-2" />
              <p>Nenhum arquivo de treinamento adicionado</p>
              <p className="text-xs">
                Adicione arquivos de texto para melhorar o conhecimento do seu assistente
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {trainingFiles.map((file) => (
                <Collapsible 
                  key={file.id} 
                  open={openFileId === file.id}
                  onOpenChange={() => toggleFilePreview(file.id)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-md cursor-pointer hover:bg-muted/80">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center h-8 w-8 rounded bg-primary/10 text-primary text-xs font-mono">
                          {getFileIcon(file.name)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(file.size)} • {new Date(file.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(file.id, file.name);
                          }}
                          className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 p-3 border rounded-md bg-muted/50 text-sm font-mono overflow-auto max-h-40">
                      {file.content.length > 500 
                        ? file.content.substring(0, 500) + "..." 
                        : file.content}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 rounded-md">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div className="text-sm">
            <p>Estes arquivos são usados para melhorar o conhecimento do seu assistente AI.</p>
            <p className="mt-1">Conteúdo sensível não deve ser enviado, pois será usado para treinamento.</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-4">
        <div className="space-y-1 w-full">
          <h4 className="text-sm font-medium">Como os arquivos são utilizados?</h4>
          <p className="text-sm text-muted-foreground">
            Os conteúdos dos arquivos são enviados à OpenAI como contexto adicional, 
            permitindo que o assistente responda com base nesses dados específicos.
          </p>
        </div>
      </CardFooter>
    </Card>
  );
};

export default TrainingFilesTab;
