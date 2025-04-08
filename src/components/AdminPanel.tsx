
import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Terminal, Settings, Code, FileText, AlertTriangle, Database, Server } from "lucide-react";
import { AgentFunction, useChat } from "@/contexts/ChatContext";
import ApiKeySection from "@/components/admin/ApiKeySection";
import WidgetConfigTab from "@/components/admin/WidgetConfigTab";
import AgentConfigTab from "@/components/admin/AgentConfigTab";
import FunctionsTab from "@/components/admin/FunctionsTab";
import SettingsTab from "@/components/admin/SettingsTab";
import TrainingFilesTab from "@/components/admin/TrainingFilesTab";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

interface AdminPanelProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  isAuthenticated: boolean;
  diagnosticInfo?: any;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ 
  apiKey, 
  setApiKey, 
  isAuthenticated,
  diagnosticInfo 
}) => {
  const { 
    widgetConfig, 
    agentConfig, 
    adminConfig, 
    updateWidgetConfig, 
    updateAgentConfig, 
    updateAdminConfig,
    addTrainingFile,
    removeTrainingFile,
    isDbConnected
  } = useChat();
  const [functions, setFunctions] = useState<AgentFunction[]>(agentConfig.functions);
  const [activeTab, setActiveTab] = useState("widget");
  const [isDbInfoOpen, setIsDbInfoOpen] = useState(false);
  
  useEffect(() => {
    setFunctions(agentConfig.functions);
  }, [agentConfig.functions]);
  
  const saveAgentConfig = () => {
    const updatedConfig = {
      ...agentConfig,
      functions: functions,
    };
    
    updateAgentConfig(updatedConfig);
  };
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };
  
  return (
    <div className="container max-w-4xl py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <Badge variant="outline">
            {diagnosticInfo?.environment || "development"}
          </Badge>
          <Database className="h-4 w-4 ml-2" />
          <Badge variant={isDbConnected ? "default" : "destructive"}>
            {isDbConnected ? "MariaDB Connected" : "Using localStorage"}
          </Badge>
        </div>
      </div>
      
      {!apiKey && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Por favor, configure sua chave da API OpenAI para que o assistente funcione corretamente.
          </AlertDescription>
        </Alert>
      )}
      
      {!isDbConnected && (
        <Collapsible
          open={isDbInfoOpen}
          onOpenChange={setIsDbInfoOpen}
          className="mb-6 space-y-2"
        >
          <Alert 
            variant="default" 
            className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800"
          >
            <div className="flex justify-between w-full">
              <div className="flex items-start">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <AlertDescription className="text-yellow-600 dark:text-yellow-400 ml-2">
                  Usando armazenamento local para os dados. Para usar o banco de dados MariaDB, configure o servidor de API backend.
                </AlertDescription>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="p-1 h-auto">
                  <span className="text-xs">{isDbInfoOpen ? 'Ocultar detalhes' : 'Ver detalhes'}</span>
                </Button>
              </CollapsibleTrigger>
            </div>
          </Alert>
          
          <CollapsibleContent>
            <div className="border rounded-md p-4 bg-muted/30 text-sm space-y-4">
              {diagnosticInfo?.dbError ? (
                <div>
                  <h3 className="font-medium mb-2">Erro de conexão</h3>
                  <div className="ml-4 space-y-1">
                    <p><span className="font-medium">Mensagem:</span> {diagnosticInfo.dbError.message}</p>
                    {diagnosticInfo.dbError.code && (
                      <p><span className="font-medium">Código:</span> {diagnosticInfo.dbError.code}</p>
                    )}
                    {diagnosticInfo.dbError.sqlMessage && (
                      <p><span className="font-medium">SQL:</span> {diagnosticInfo.dbError.sqlMessage}</p>
                    )}
                  </div>
                </div>
              ) : null}
              
              {diagnosticInfo?.dbConfig && (
                <div>
                  <h3 className="font-medium mb-2">Configuração do banco de dados</h3>
                  <div className="ml-4 space-y-1">
                    <p><span className="font-medium">Host:</span> {diagnosticInfo.dbConfig.host}</p>
                    <p><span className="font-medium">Banco de dados:</span> {diagnosticInfo.dbConfig.database}</p>
                    <p><span className="font-medium">Usuário:</span> {diagnosticInfo.dbConfig.user}</p>
                  </div>
                </div>
              )}
              
              <div>
                <h3 className="font-medium mb-2">Solução</h3>
                <div className="ml-4 space-y-1">
                  <p>1. Verifique se o MariaDB/MySQL está instalado e em execução</p>
                  <p>2. Verifique as credenciais no arquivo <code>.env</code> do backend</p>
                  <p>3. Certifique-se de que o banco de dados especificado existe</p>
                  <p>4. Reinicie o servidor backend após as alterações</p>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
      
      <ApiKeySection apiKey={apiKey} setApiKey={setApiKey} />
      
      <Tabs defaultValue="widget" value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid grid-cols-5">
          <TabsTrigger value="widget">
            <MessageCircle className="h-4 w-4 mr-2" />
            Widget
          </TabsTrigger>
          <TabsTrigger value="agent">
            <Terminal className="h-4 w-4 mr-2" />
            Agent
          </TabsTrigger>
          <TabsTrigger value="functions">
            <Code className="h-4 w-4 mr-2" />
            Functions
          </TabsTrigger>
          <TabsTrigger value="files">
            <FileText className="h-4 w-4 mr-2" />
            Arquivos
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="widget">
          <WidgetConfigTab 
            widgetConfig={widgetConfig} 
            updateWidgetConfig={updateWidgetConfig} 
          />
        </TabsContent>
        
        <TabsContent value="agent">
          <AgentConfigTab 
            agentConfig={agentConfig} 
            updateAgentConfig={updateAgentConfig}
            functions={functions}
          />
        </TabsContent>
        
        <TabsContent value="functions">
          <FunctionsTab 
            functions={functions} 
            setFunctions={setFunctions}
            saveAgentConfig={saveAgentConfig}
          />
        </TabsContent>
        
        <TabsContent value="files">
          <TrainingFilesTab 
            trainingFiles={agentConfig.trainingFiles}
            addTrainingFile={addTrainingFile}
            removeTrainingFile={removeTrainingFile}
          />
        </TabsContent>
        
        <TabsContent value="settings">
          <SettingsTab 
            adminConfig={adminConfig} 
            updateAdminConfig={updateAdminConfig} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;
