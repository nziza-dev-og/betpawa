"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

const depositFormSchema = z.object({
  amount: z.coerce.number().min(1, { message: "Amount must be at least 1." }).max(10000, { message: "Maximum deposit is 10,000." }),
});

type DepositFormValues = z.infer<typeof depositFormSchema>;

interface DepositFormProps {
  onDeposit: (amount: number) => Promise<void>;
  isDepositing: boolean;
}

export function DepositForm({ onDeposit, isDepositing }: DepositFormProps) {
  const form = useForm<DepositFormValues>({
    resolver: zodResolver(depositFormSchema),
    defaultValues: {
      amount: 100,
    },
  });

  async function onSubmit(data: DepositFormValues) {
    await onDeposit(data.amount);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount (COINS)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Enter amount to deposit" {...field} disabled={isDepositing} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isDepositing}>
          {isDepositing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isDepositing ? "Processing..." : "Confirm Deposit"}
        </Button>
      </form>
    </Form>
  );
}
