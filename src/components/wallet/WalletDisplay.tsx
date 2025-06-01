import { Wallet, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface WalletDisplayProps {
  balance: number | null;
  onDepositClick: () => void;
  isLoading: boolean;
  userName?: string;
}

export function WalletDisplay({ balance, onDepositClick, isLoading, userName }: WalletDisplayProps) {
  return (
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-primary-foreground bg-primary py-1 px-3 rounded-full">
          {userName ? `${userName}'s Wallet` : 'My Wallet'}
        </CardTitle>
        <Wallet className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-3/4" />
        ) : (
          <div className="text-3xl font-bold text-foreground">
            {balance !== null ? `${balance.toFixed(2)}` : '0.00'} <span className="text-sm text-muted-foreground">COINS</span>
          </div>
        )}
        <Button onClick={onDepositClick} className="mt-4 w-full bg-accent text-accent-foreground hover:bg-accent/90">
          <DollarSign className="mr-2 h-4 w-4" /> Deposit Funds
        </Button>
      </CardContent>
    </Card>
  );
}
