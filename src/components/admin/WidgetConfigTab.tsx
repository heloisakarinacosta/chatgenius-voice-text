
import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent, CardDescription, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { WidgetConfig } from "@/contexts/ChatContext";

interface WidgetConfigTabProps {
  widgetConfig: WidgetConfig;
  updateWidgetConfig: (config: WidgetConfig) => void;
}

const WidgetConfigTab: React.FC<WidgetConfigTabProps> = ({ widgetConfig, updateWidgetConfig }) => {
  const [updatedWidgetConfig, setUpdatedWidgetConfig] = useState<WidgetConfig>({ ...widgetConfig });
  const [widgetCode, setWidgetCode] = useState("");
  const [isCopied, setIsCopied] = useState(false);

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

  // Save widget configuration
  const saveWidgetConfig = () => {
    updateWidgetConfig(updatedWidgetConfig);
    toast.success("Widget configuration saved");
  };

  // Copy widget code
  const copyWidgetCode = () => {
    navigator.clipboard.writeText(widgetCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    toast.success("Widget code copied to clipboard");
  };

  return (
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
  );
};

export default WidgetConfigTab;
