
import React from "react";
import { Button } from "@/components/ui/button";
import { AgentFunction } from "@/contexts/ChatContext";

interface FunctionListItemProps {
  func: AgentFunction;
  onEdit: () => void;
  onDelete: () => void;
}

const FunctionListItem: React.FC<FunctionListItemProps> = ({
  func,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="p-4 border rounded-md">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{func.name}</h4>
        <div className="flex items-center gap-2">
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
    </div>
  );
};

export default FunctionListItem;
