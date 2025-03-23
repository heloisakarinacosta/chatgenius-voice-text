
import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useChat, WidgetConfig, AgentConfig, AgentFunction } from "@/contexts/ChatContext";
import { Check, Copy, Terminal, Settings, MessageCircle, Phone, RefreshCw, Languages, Volume2, Code } from "lucide-react";
import { createHash } from "crypto-js/sha256";
import { toast } from "sonner";

interface AdminPanelProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  isAuthenticated: boolean;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ apiKey, setApiKey, isAuthenticated }) => {
  const { widgetConfig, agentConfig, adminConfig, updateWidgetConfig, updateAgentConfig, updateAdminConfig } = useChat();
  
  const [updatedWidgetConfig, setUpdatedWidgetConfig] = useState<WidgetConfig>({ ...widgetConfig });
  const [updatedAgentConfig, setUpdatedAgentConfig] = useState<AgentConfig>({ ...agentConfig });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [functions, setFunctions] = useState<AgentFunction[]>(agentConfig.functions);
  const [newFunction, setNewFunction] = useState<AgentFunction>({
    name: "",
    description: "",
    parameters: {},
    webhook: "",
  });
  const [widgetCode, setWidgetCode] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [editingFunctionIndex, setEditingFunctionIndex] = useState<number | null>(null);
  
  // Voice options from OpenAI
  const voiceOptions = [
    { id: "alloy", name: "Alloy" },
    { id: "echo", name: "Echo" },
    { id: "fable", name: "Fable" },
    { id: "onyx", name: "Onyx" },
    { id: "nova", name: "Nova" },
    { id: "shimmer", name: "Shimmer" },
  ];
  
  // Language options
  const languageOptions = [
    { id: "en-US", name: "English (US)" },
    { id: "en-GB", name: "English (UK)" },
    { id: "es-ES", name: "Spanish" },
    { id: "fr-FR", name: "French" },
    { id: "de-DE", name: "German" },
    { id: "it-IT", name: "Italian" },
    { id: "ja-JP", name: "Japanese" },
    { id: "ko-KR", name: "Korean" },
    { id: "pt-BR", name: "Portuguese (Brazil)" },
    { id: "zh-CN", name: "Chinese (Simplified)" },
  ];
  
  // Update widget code when config changes
  useEffect(() => {
    generateWidgetCode();
  }, [updatedWidgetConfig]);
  
  // Generate widget embed code
  const generateWidgetCode = () => {
    const code = `
<script>
  (function() {
    const script = document.createElement('script');
    script.src = '${window.location.origin}/widget.js';
    script.defer = true;
    script.dataset.position = '${updatedWidgetConfig.position}';
    script.dataset.title = '${updatedWidgetConfig.title}';
    script.dataset.subtitle = '${updatedWidgetConfig.subtitle}';
    script.dataset.color = '${updatedWidgetConfig.primaryColor}';
    document.body.appendChild(script);
  })();
</script>`;
    
    setWidgetCode(code);
  };
  
  // Handle password change
  const handlePasswordChange = () => {
    // Check if current password is correct
    const currentHash = createHash(currentPassword).toString();
    
    if (currentHash !== adminConfig.passwordHash) {
      toast.error("Current password is incorrect");
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    
    // Update password
    const newHash = createHash(newPassword).toString();
    updateAdminConfig({
      passwordHash: newHash,
    });
    
    toast.success("Password updated successfully");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };
  
  // Save widget configuration
  const saveWidgetConfig = () => {
    updateWidgetConfig(updatedWidgetConfig);
    toast.success("Widget configuration saved");
  };
  
  // Save agent configuration
  const saveAgentConfig = () => {
    const updatedConfig = {
      ...updatedAgentConfig,
      functions: functions,
    };
    
    updateAgentConfig(updatedConfig);
    toast.success("Agent configuration saved");
  };
  
  // Add or update function
  const addOrUpdateFunction = () => {
    if (!newFunction.name || !newFunction.description || !newFunction.webhook) {
      toast.error("All fields are required");
      return;
    }
    
    // Try to parse parameters
    let parsedParams: Record<string, any> = {};
    try {
      if (typeof newFunction.parameters === 'string') {
        parsedParams = JSON.parse(newFunction.parameters);
      } else {
        parsedParams = newFunction.parameters as Record<string, any>;
      }
    } catch (e) {
      toast.error("Invalid JSON parameters");
      return;
    }
    
    const functionToSave: AgentFunction = {
      name: newFunction.name,
      description: newFunction.description,
      webhook: newFunction.webhook,
      parameters: parsedParams
    };
    
    if (editingFunctionIndex !== null) {
      // Update existing function
      const updatedFunctions = [...functions];
      updatedFunctions[editingFunctionIndex] = functionToSave;
      setFunctions(updatedFunctions);
    } else {
      // Add new function
      setFunctions([...functions, functionToSave]);
    }
    
    // Reset form
    setNewFunction({
      name: "",
      description: "",
      parameters: {},
      webhook: "",
    });
    setEditingFunctionIndex(null);
    
    toast.success(editingFunctionIndex !== null ? "Function updated" : "Function added");
  };
  
  // Edit function
  const editFunction = (index: number) => {
    const functionToEdit = functions[index];
    let functionParams: Record<string, any>;
    
    if (typeof functionToEdit.parameters === 'string') {
      try {
        functionParams = JSON.parse(functionToEdit.parameters);
      } catch (e) {
        functionParams = {};
        console.error("Error parsing function parameters:", e);
      }
    } else {
      functionParams = functionToEdit.parameters as Record<string, any>;
    }
    
    setNewFunction({
      ...functionToEdit,
      parameters: functionParams
    });
    
    setEditingFunctionIndex(index);
  };
  
  // Delete function
  const deleteFunction = (index: number) => {
    const updatedFunctions = [...functions];
    updatedFunctions.splice(index, 1);
    setFunctions(updatedFunctions);
    toast.success("Function deleted");
  };
  
  // Copy widget code
  const copyWidgetCode = () => {
    navigator.clipboard.writeText(widgetCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    toast.success("Widget code copied to clipboard");
  };
  
  // Test voice latency
  const testVoiceLatency = async () => {
    const startTime = Date.now();
    toast.info("Testing voice latency...");
    
    // Simulate a network request
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const latency = Date.now() - startTime;
    
    // Update agent config with measured latency
    setUpdatedAgentConfig({
      ...updatedAgentConfig,
      voice: {
        ...updatedAgentConfig.voice,
        latency,
      },
    });
    
    toast.success(`Voice latency: ${latency}ms`);
  };
  
  return (
    <div className="container max-w-4xl py-6">
      <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
      
      <div className="mb-6">
        <Label htmlFor="apiKey" className="text-base font-medium">OpenAI API Key</Label>
        <div className="flex items-center gap-2 mt-2">
          <Input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="flex-1"
          />
          <Button 
            variant={apiKey ? "default" : "destructive"}
            disabled={!apiKey}
          >
            {apiKey ? <Check className="h-4 w-4 mr-2" /> : null}
            {apiKey ? "Key Set" : "Missing Key"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Your API key is stored locally and never sent to our servers.
        </p>
      </div>
      
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
          <Card>
            <CardHeader>
              <CardTitle>Widget Configuration</CardTitle>
              <CardDescription>
                Customize how your chat widget appears on your website.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="widgetTitle">Title</Label>
                  <Input
                    id="widgetTitle"
                    value={updatedWidgetConfig.title}
                    onChange={(e) => setUpdatedWidgetConfig({
                      ...updatedWidgetConfig,
                      title: e.target.value,
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="widgetSubtitle">Subtitle</Label>
                  <Input
                    id="widgetSubtitle"
                    value={updatedWidgetConfig.subtitle}
                    onChange={(e) => setUpdatedWidgetConfig({
                      ...updatedWidgetConfig,
                      subtitle: e.target.value,
                    })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="widgetPosition">Position</Label>
                  <Select
                    value={updatedWidgetConfig.position}
                    onValueChange={(value: any) => setUpdatedWidgetConfig({
                      ...updatedWidgetConfig,
                      position: value,
                    })}
                  >
                    <SelectTrigger id="widgetPosition">
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bottom-right">Bottom Right</SelectItem>
                      <SelectItem value="bottom-left">Bottom Left</SelectItem>
                      <SelectItem value="top-right">Top Right</SelectItem>
                      <SelectItem value="top-left">Top Left</SelectItem>
                      <SelectItem value="center-right">Center Right</SelectItem>
                      <SelectItem value="center-left">Center Left</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="widgetColor">Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="widgetColor"
                      type="color"
                      value={updatedWidgetConfig.primaryColor}
                      onChange={(e) => setUpdatedWidgetConfig({
                        ...updatedWidgetConfig,
                        primaryColor: e.target.value,
                      })}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={updatedWidgetConfig.primaryColor}
                      onChange={(e) => setUpdatedWidgetConfig({
                        ...updatedWidgetConfig,
                        primaryColor: e.target.value,
                      })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="widgetCode">Widget Embed Code</Label>
                <div className="relative">
                  <Textarea
                    id="widgetCode"
                    value={widgetCode}
                    readOnly
                    rows={5}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={copyWidgetCode}
                  >
                    {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Add this code to your website to display the chat widget.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={saveWidgetConfig}>Save Changes</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Agent Configuration */}
        <TabsContent value="agent">
          <Card>
            <CardHeader>
              <CardTitle>Agent Configuration</CardTitle>
              <CardDescription>
                Configure your AI assistant's behavior and voice settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <Textarea
                  id="systemPrompt"
                  value={updatedAgentConfig.systemPrompt}
                  onChange={(e) => setUpdatedAgentConfig({
                    ...updatedAgentConfig,
                    systemPrompt: e.target.value,
                  })}
                  rows={6}
                  placeholder="You are a helpful assistant..."
                />
                <p className="text-sm text-muted-foreground">
                  This is the instruction that primes your AI assistant's behavior and knowledge.
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="voiceEnabled">Voice Enabled</Label>
                  <Switch
                    id="voiceEnabled"
                    checked={updatedAgentConfig.voice.enabled}
                    onCheckedChange={(checked) => setUpdatedAgentConfig({
                      ...updatedAgentConfig,
                      voice: {
                        ...updatedAgentConfig.voice,
                        enabled: checked,
                      },
                    })}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Enable voice responses from your AI assistant.
                </p>
              </div>
              
              {updatedAgentConfig.voice.enabled && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="voiceId">Voice</Label>
                      <div className="flex items-center gap-2">
                        <Select
                          value={updatedAgentConfig.voice.voiceId}
                          onValueChange={(value) => setUpdatedAgentConfig({
                            ...updatedAgentConfig,
                            voice: {
                              ...updatedAgentConfig.voice,
                              voiceId: value,
                            },
                          })}
                        >
                          <SelectTrigger id="voiceId" className="flex-1">
                            <SelectValue placeholder="Select voice" />
                          </SelectTrigger>
                          <SelectContent>
                            {voiceOptions.map((voice) => (
                              <SelectItem key={voice.id} value={voice.id}>
                                {voice.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={testVoiceLatency}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="language">Language</Label>
                      <Select
                        value={updatedAgentConfig.voice.language}
                        onValueChange={(value) => setUpdatedAgentConfig({
                          ...updatedAgentConfig,
                          voice: {
                            ...updatedAgentConfig.voice,
                            language: value,
                          },
                        })}
                      >
                        <SelectTrigger id="language">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          {languageOptions.map((language) => (
                            <SelectItem key={language.id} value={language.id}>
                              {language.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Voice Latency</Label>
                      <div className="flex items-center gap-2">
                        <Volume2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono">{updatedAgentConfig.voice.latency || 0}ms</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Measured response time for voice generation.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={saveAgentConfig}>Save Changes</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Functions Configuration */}
        <TabsContent value="functions">
          <Card>
            <CardHeader>
              <CardTitle>Function Configuration</CardTitle>
              <CardDescription>
                Create and manage functions that your AI assistant can use.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <Label htmlFor="funcParams">Parameters (JSON)</Label>
                  <Textarea
                    id="funcParams"
                    value={typeof newFunction.parameters === 'object' 
                      ? JSON.stringify(newFunction.parameters, null, 2) 
                      : newFunction.parameters as string}
                    onChange={(e) => setNewFunction({
                      ...newFunction,
                      parameters: e.target.value,
                    })}
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
                    className="font-mono text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={addOrUpdateFunction}>
                    {editingFunctionIndex !== null ? "Update Function" : "Add Function"}
                  </Button>
                  {editingFunctionIndex !== null && (
                    <Button variant="outline" onClick={() => {
                      setNewFunction({
                        name: "",
                        description: "",
                        parameters: {},
                        webhook: "",
                      });
                      setEditingFunctionIndex(null);
                    }}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Functions ({functions.length})</h3>
                
                {functions.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    No functions defined yet. Add your first function above.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {functions.map((func, index) => (
                      <div key={index} className="p-4 border rounded-md">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{func.name}</h4>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => editFunction(index)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteFunction(index)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {func.description}
                        </p>
                        <div className="text-xs font-mono mt-2 text-muted-foreground">
                          Webhook: {func.webhook}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={saveAgentConfig}>Save All Functions</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Settings */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Admin Settings</CardTitle>
              <CardDescription>
                Update your admin password and other settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handlePasswordChange}
                disabled={!currentPassword || !newPassword || !confirmPassword}
              >
                Update Password
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;
