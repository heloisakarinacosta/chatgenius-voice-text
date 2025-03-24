
import React from "react";
import { AgentFunction } from "@/contexts/ChatContext";
import FunctionListItem from "./FunctionListItem";
import { Button } from "@/components/ui/button";
import { PlayCircle } from "lucide-react";

interface FunctionListProps {
  functions: AgentFunction[];
  onEditFunction: (index: number) => void;
  onDeleteFunction: (index: number) => void;
  onTestFunction?: (func: AgentFunction) => void;
}

const FunctionList: React.FC<FunctionListProps> = ({
  functions,
  onEditFunction,
  onDeleteFunction,
  onTestFunction,
}) => {
  if (functions.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        No functions defined yet. Add your first function above.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {functions.map((func, index) => (
        <FunctionListItem
          key={index}
          func={func}
          onEdit={() => onEditFunction(index)}
          onDelete={() => onDeleteFunction(index)}
          onTest={onTestFunction ? () => onTestFunction(func) : undefined}
        />
      ))}
    </div>
  );
};

export default FunctionList;
