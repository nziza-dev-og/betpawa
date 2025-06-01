"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DepositForm } from "./DepositForm";

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeposit: (amount: number) => Promise<void>;
}

export function DepositModal({ isOpen, onClose, onDeposit }: DepositModalProps) {
  const [isDepositing, setIsDepositing] = useState(false);

  const handleDeposit = async (amount: number) => {
    setIsDepositing(true);
    try {
      await onDeposit(amount);
      onClose(); // Close modal on successful deposit
    } catch (error) {
      // Error should be handled by a toast in the parent component
      console.error("Deposit failed:", error);
    } finally {
      setIsDepositing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Deposit Funds</DialogTitle>
          <DialogDescription>
            Add funds to your Skytrax wallet to start playing.
          </DialogDescription>
        </DialogHeader>
        <DepositForm onDeposit={handleDeposit} isDepositing={isDepositing} />
        <DialogFooter className="sm:justify-start pt-4">
           <Button type="button" variant="outline" onClick={onClose} disabled={isDepositing}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
