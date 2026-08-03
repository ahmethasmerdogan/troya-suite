/**
 * Rota → gövde şekli.
 *
 * Tek şekil var: tek sütun. Kayıt gezme "liste → detay" akışıyla yürür;
 * liste tam genişlik bir veri tablosudur, satıra tıklamak kaydı açar.
 * (Bölünmüş konsol denendi ve bırakıldı: dar liste paneli veri tablosunun
 * okunurluğunu düşürüyordu.)
 */
export function isSplit(pathname: string): boolean {
  // Mesajlaşma tek istisnadır: sohbet konsolu kenardan kenara, kendi
  // sütunlarıyla ve tek dış kaydırma olmadan durmalı.
  return pathname.startsWith("/chat");
}
