import {
  ArrowLeftRight,
  Banknote,
  Car,
  Clapperboard,
  Coffee,
  Dumbbell,
  Fuel,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  type LucideIcon,
  PiggyBank,
  Plane,
  PlugZap,
  Receipt,
  Repeat,
  Shapes,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Tag,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
} from 'lucide-react'

/**
 * Maps stored lucide icon names (kebab-case) to components. Covers the default
 * categories plus common names a user might type; anything unknown falls back to
 * a neutral icon so a typo never breaks the layout.
 */
const ICONS: Record<string, LucideIcon> = {
  'arrow-left-right': ArrowLeftRight,
  banknote: Banknote,
  car: Car,
  clapperboard: Clapperboard,
  coffee: Coffee,
  dumbbell: Dumbbell,
  fuel: Fuel,
  gift: Gift,
  'graduation-cap': GraduationCap,
  'hand-coins': HandCoins,
  'heart-pulse': HeartPulse,
  house: House,
  home: House,
  landmark: Landmark,
  plane: Plane,
  'piggy-bank': PiggyBank,
  'plug-zap': PlugZap,
  receipt: Receipt,
  repeat: Repeat,
  shapes: Shapes,
  shield: Shield,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  sparkles: Sparkles,
  tag: Tag,
  'trending-up': TrendingUp,
  utensils: Utensils,
  wallet: Wallet,
  wifi: Wifi,
}

export function CategoryIcon({
  name,
  color,
  className,
}: {
  name?: string | null
  color?: string | null
  className?: string
}) {
  const Icon = (name && ICONS[name]) || Shapes
  return <Icon className={className} style={color ? { color } : undefined} aria-hidden />
}
