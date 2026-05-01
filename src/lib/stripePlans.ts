export const getPlanFromPrice = (priceId: string) => {
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC) return "basic";
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_CLINIC) return "clinic";

  return "basic";
};