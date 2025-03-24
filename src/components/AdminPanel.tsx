import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Terminal, Settings, Code, FileText, AlertTriangle, Database } from "lucide-react";
import { AgentFunction, useChat } from "@/contexts/ChatContext";
import ApiKeySection from "@/components/admin/ApiKeySection";
import WidgetConfigTab from "@/components/admin/WidgetConfigTab";
import AgentConfigTab from "@/components/admin/AgentConfigTab";
import FunctionsTab from "@/components/admin/FunctionsTab";
import SettingsTab from "@/components/admin/SettingsTab";
import TrainingFilesTab from "@/components/admin/TrainingFilesTab";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface AdminPanelProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  isAuthenticated: boolean;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ apiKey, setApiKey, isAuthenticated }) => {
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
          <Database className="h-4 w-4" />
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
        <Alert variant="default" className="mb-6 bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertDescription className="text-yellow-600 dark:text-yellow-400">
            Usando armazenamento local para os dados. Para usar o banco de dados MariaDB, configure um servidor de API backend.
          </AlertDescription>
        </Alert>
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
