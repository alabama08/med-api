// Paystack helper — reusable for any future payment logic
export const formatAmount = (amount, currency = "NGN") => {
  // Paystack accepts amounts in lowest denomination
  // NGN: kobo (x100), USD: cents (x100), GHS: pesewas (x100)
  return Math.round(amount * 100);
};

export const parseCurrency = (currency) => {
  const supported = ["NGN", "USD", "GHS", "ZAR", "KES"];
  return supported.includes(currency?.toUpperCase())
    ? currency.toUpperCase()
    : "NGN";
};