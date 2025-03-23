
import React, { useState } from "react";
import { Card, CardHeader, CardContent, CardDescription, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AgentFunction } from "@/contexts/ChatContext";
import FunctionForm, { FunctionFormState } from "./functions/FunctionForm";
import FunctionList from "./functions/FunctionList";

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
  const [newFunction, setNewFunction] = useState<FunctionFormState>({
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
    resetForm();
    
    toast.success(editingFunctionIndex !== null ? "Function updated" : "Function added");
  };
  
  // Reset form and cancel editing
  const resetForm = () => {
    setNewFunction({
      name: "",
      description: "",
      parameters: {},
      webhook: "",
    });
    setEditingFunctionIndex(null);
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
      name: functionToEdit.name,
      description: functionToEdit.description,
      webhook: functionToEdit.webhook,
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
        {/* Function Form Component */}
        <FunctionForm 
          newFunction={newFunction}
          setNewFunction={setNewFunction}
          addOrUpdateFunction={addOrUpdateFunction}
          editingFunctionIndex={editingFunctionIndex}
          cancelEditing={resetForm}
        />
        
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Functions ({functions.length})</h3>
          
          {/* Function List Component */}
          <FunctionList 
            functions={functions}
            onEditFunction={editFunction}
            onDeleteFunction={deleteFunction}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={saveAgentConfig}>Save All Functions</Button>
      </CardFooter>
    </Card>
  );
};

export default FunctionsTab;
