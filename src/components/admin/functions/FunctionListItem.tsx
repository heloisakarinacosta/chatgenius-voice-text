
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { AgentFunction } from "@/contexts/ChatContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Code } from "lucide-react";

interface FunctionListItemProps {
  func: AgentFunction;
  onEdit: () => void;
  onDelete: () => void;
  onTest?: (func: AgentFunction) => void;
}

const FunctionListItem: React.FC<FunctionListItemProps> = ({
  func,
  onEdit,
  onDelete,
  onTest,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-4 border rounded-md">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{func.name}</h4>
        <div className="flex items-center gap-2">
          {onTest && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTest(func)}
            >
              Test
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
          >
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
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
      
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className="mt-2"
      >
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="flex items-center gap-1 text-xs w-full justify-start p-1">
            <span>Parameters {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="text-xs p-2 bg-muted rounded-md overflow-auto max-h-40">
            {JSON.stringify(func.parameters, null, 2)}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default FunctionListItem;
