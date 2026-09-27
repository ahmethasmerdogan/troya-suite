// Ticket number: 3 haneli airline kodu + 9 serial + mod-7 check digit (ROADMAP Faz 1).
// Check digit = (airline+serial 12 hane sayısı) mod 7.

export function computeCheckDigit(twelveDigits: string): number {
  // 12 haneli sayıyı mod 7'ye indir (büyük sayı için parça parça).
  let remainder = 0;
  for (const ch of twelveDigits) {
    remainder = (remainder * 10 + Number(ch)) % 7;
  }
  return remainder;
}

export function buildTicketNumber(airlinePrefix: string, serial: string): string {
  const twelve = (airlinePrefix + serial.padStart(9, "0")).slice(0, 12);
  return twelve + String(computeCheckDigit(twelve));
}

export function isValidTicketNumber(ticketNumber: string): boolean {
  if (!/^\d{13}$/.test(ticketNumber)) return false;
  const twelve = ticketNumber.slice(0, 12);
  const check = Number(ticketNumber[12]);
  return computeCheckDigit(twelve) === check;
}
