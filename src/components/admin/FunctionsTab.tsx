
import React, { useState } from "react";
import { Card, CardHeader, CardContent, CardDescription, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AgentFunction } from "@/contexts/ChatContext";

interface FunctionsTabProps {
  functions: AgentFunction[];
  setFunctions: (functions: AgentFunction[]) => void;
  saveAgentConfig: () => void;
}

const FunctionsTab: React.FC<FunctionsTabProps> = ({ 
  functions, 
  setFunctions,
  saveAgentConfig
}) => {
  const [newFunction, setNewFunction] = useState<AgentFunction>({
    name: "",
    description: "",
    parameters: {},
    webhook: "",
  });
  const [editingFunctionIndex, setEditingFunctionIndex] = useState<number | null>(null);

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
    let parameterString: string;
    
    if (typeof functionToEdit.parameters === 'string') {
      parameterString = functionToEdit.parameters;
    } else {
      parameterString = JSON.stringify(functionToEdit.parameters, null, 2);
    }
    
    setNewFunction({
      ...functionToEdit,
      parameters: parameterString
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

  return (
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
  );
};

export default FunctionsTab;
