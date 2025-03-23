
import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Terminal, Settings, Code } from "lucide-react";
import { AgentFunction, useChat } from "@/contexts/ChatContext";
import ApiKeySection from "@/components/admin/ApiKeySection";
import WidgetConfigTab from "@/components/admin/WidgetConfigTab";
import AgentConfigTab from "@/components/admin/AgentConfigTab";
import FunctionsTab from "@/components/admin/FunctionsTab";
import SettingsTab from "@/components/admin/SettingsTab";

interface AdminPanelProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  isAuthenticated: boolean;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ apiKey, setApiKey, isAuthenticated }) => {
  const { widgetConfig, agentConfig, adminConfig, updateWidgetConfig, updateAgentConfig, updateAdminConfig } = useChat();
  const [functions, setFunctions] = useState<AgentFunction[]>(agentConfig.functions);
  
  // Update functions when agentConfig changes
  useEffect(() => {
    setFunctions(agentConfig.functions);
  }, [agentConfig.functions]);
  
  // Save agent configuration with functions
  const saveAgentConfig = () => {
    const updatedConfig = {
      ...agentConfig,
      functions: functions,
    };
    
    updateAgentConfig(updatedConfig);
  };
  
  return (
    <div className="container max-w-4xl py-6">
      <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
      
      <ApiKeySection apiKey={apiKey} setApiKey={setApiKey} />
      
      <Tabs defaultValue="widget" className="space-y-4">
        <TabsList className="grid grid-cols-4">
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
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>
        
        {/* Widget Configuration */}
        <TabsContent value="widget">
          <WidgetConfigTab 
            widgetConfig={widgetConfig} 
            updateWidgetConfig={updateWidgetConfig} 
          />
        </TabsContent>
        
        {/* Agent Configuration */}
        <TabsContent value="agent">
          <AgentConfigTab 
            agentConfig={agentConfig} 
            updateAgentConfig={updateAgentConfig}
            functions={functions}
          />
        </TabsContent>
        
        {/* Functions Configuration */}
        <TabsContent value="functions">
          <FunctionsTab 
            functions={functions} 
            setFunctions={setFunctions}
            saveAgentConfig={saveAgentConfig}
          />
        </TabsContent>
        
        {/* Settings */}
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
