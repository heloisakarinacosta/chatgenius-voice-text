
import React, { useState } from "react";
import { Card, CardHeader, CardContent, CardDescription, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createHash } from "crypto-js/sha256";
import { toast } from "sonner";

interface SettingsTabProps {
  adminConfig: {
    passwordHash: string;
  };
  updateAdminConfig: (config: any) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ 
  adminConfig, 
  updateAdminConfig 
}) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  return (
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
  );
};

export default SettingsTab;
