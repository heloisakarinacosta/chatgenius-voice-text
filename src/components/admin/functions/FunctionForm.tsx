
import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { AgentFunction } from "@/contexts/ChatContext";

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
      setParametersError("Invalid JSON format: " + e.message);
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
      toast.error("Invalid parameters JSON: " + e.message);
    }
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
