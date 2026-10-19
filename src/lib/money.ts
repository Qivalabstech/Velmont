/** All amounts are integers in paise. */
export const rupees = (paise: number) => paise / 100;
export const toPaise = (rupeeValue: number | string) => Math.round(Number(rupeeValue) * 100);

export function inr(paise: number, opts: { decimals?: boolean } = {}) {
  const v = paise / 100;
  const hasFraction = Math.round(paise) % 100 !== 0;
  return "₹" + v.toLocaleString("en-IN", {
    minimumFractionDigits: opts.decimals || hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

export const percentOff = (price: number, mrp: number) => (mrp > price ? Math.round((1 - price / mrp) * 100) : 0);
