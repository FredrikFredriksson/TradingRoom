import { 
  Bitcoin, 
  Coins,
  Sparkles,
  CircleDot,
  Wallet,
  Gem,
  Zap,
  Flame,
  Mountain,
  Circle
} from 'lucide-react';

/**
 * Get the appropriate icon component for a cryptocurrency symbol
 */
export function getCryptoIcon(symbol) {
  const symbolUpper = symbol.toUpperCase();
  
  // Extract base asset (before /)
  const baseAsset = symbolUpper.split('/')[0];
  
  const iconMap = {
    'BTC': Bitcoin,
    'ETH': Circle, // Ethereum icon not available, using Circle as alternative
    'BNB': Coins,
    'SOL': Sparkles,
    'XRP': CircleDot,
    'ADA': Wallet,
    'DOGE': Gem,
    'DOT': Zap,
    'MATIC': Flame,
    'AVAX': Mountain,
  };
  
  return iconMap[baseAsset] || Coins; // Default to Coins icon
}
