/**
 * "fix" alanının çevirileri.
 *
 * TR değerleri arayüzde GÖRÜNEN metnin birebir aynısıdır — e2e seçicileri
 * bu metinlere bağlı, tek kelime değişirse testler düşer.
 */
export const tr = {
  "fix.map.desc": "Platform servisleri arası bağımlılık ve veri akışı — canlı.",
  "fix.map.back": "Geri",
  "fix.map.style": "STİL",
  "fix.map.byService": "Servis",
  "fix.map.byStatus": "Durum",
  "fix.map.statusLabel": "Durum",
  "fix.map.healthy": "Sağlıklı",
  "fix.map.degraded": "Planlı / bekliyor",
  "fix.map.down": "Hata",
  "fix.map.t15m": "Son 15 dakika",
  "fix.map.t1h": "Son 1 saat",
  "fix.map.t24h": "Son 24 saat",
  "fix.map.t7d": "Son 7 gün",
  // --- EMD makbuzu (Handbook 5.8) — tek dilli belge alanları
  "fix.emd.receipt.paxOrGroup": "Yolcu / Grup adı",
  "fix.emd.receipt.docNumber": "Belge numarası",
  "fix.emd.receipt.description": "Açıklama",
  "fix.emd.receipt.coupon": "kupon #{n}",
  "fix.emd.receipt.issuedAt": "Kesim tarihi",
  "fix.emd.receipt.issuedBy": "Kesen havayolu / acente",
  "fix.emd.receipt.placeOfIssue": "Kesim yeri",
  "fix.emd.receipt.fop": "Ödeme şekli",
  "fix.emd.receipt.foid": "Kimlik belgesi (FOID)",
  "fix.emd.receipt.endorsement": "Ciro / kısıtlamalar",
  "fix.emd.receipt.docType": "Belge tipi",
  "fix.emd.receipt.coupons.title": "Değer kuponları",
  "fix.emd.receipt.coupons.hint": "Her kupon için taşıyıcı, güzergâh ve tutar (5.8).",
  "fix.emd.receipt.baseAmount": "Çıplak tutar",
  "fix.emd.receipt.equivAmount": "Eşdeğer tutar",
  "fix.emd.receipt.tfc": "Vergi / harç {code}",
  "fix.emd.receipt.docAmount": "Belge tutarı",
  "fix.emd.receipt.terms":
    "Bu belge, taşıyıcının geçerli taşıma şartlarına ve ilgili tarife kurallarına tabidir. Uluslararası taşımalarda Varşova/Montreal Sözleşmeleri hükümleri uygulanabilir; sorumluluk sınırlıdır. Belgenin kullanım koşulları, geçerlilik süresi ve iade şartları düzenleyen taşıyıcının kurallarına bağlıdır.",

  // --- bilet kesme sihirbazı
  "fix.issue.origin.placeholder": "İstanbul / IST",
} as const;

export const en: Record<keyof typeof tr, string> = {
  "fix.map.desc": "Dependencies and data flow between platform services — live.",
  "fix.map.back": "Back",
  "fix.map.style": "STYLE",
  "fix.map.byService": "Service",
  "fix.map.byStatus": "Status",
  "fix.map.statusLabel": "Status",
  "fix.map.healthy": "Healthy",
  "fix.map.degraded": "Planned / pending",
  "fix.map.down": "Down",
  "fix.map.t15m": "Last 15 minutes",
  "fix.map.t1h": "Last hour",
  "fix.map.t24h": "Last 24 hours",
  "fix.map.t7d": "Last 7 days",
  "fix.emd.receipt.paxOrGroup": "Passenger / group name",
  "fix.emd.receipt.docNumber": "Document number",
  "fix.emd.receipt.description": "Description",
  "fix.emd.receipt.coupon": "coupon #{n}",
  "fix.emd.receipt.issuedAt": "Date of issue",
  "fix.emd.receipt.issuedBy": "Issuing airline / agent",
  "fix.emd.receipt.placeOfIssue": "Place of issue",
  "fix.emd.receipt.fop": "Form of payment",
  "fix.emd.receipt.foid": "Identity document (FOID)",
  "fix.emd.receipt.endorsement": "Endorsements / restrictions",
  "fix.emd.receipt.docType": "Document type",
  "fix.emd.receipt.coupons.title": "Value coupons",
  "fix.emd.receipt.coupons.hint": "Carrier, routing and amount for each coupon (5.8).",
  "fix.emd.receipt.baseAmount": "Base amount",
  "fix.emd.receipt.equivAmount": "Equivalent amount",
  "fix.emd.receipt.tfc": "Tax / fee {code}",
  "fix.emd.receipt.docAmount": "Document amount",
  "fix.emd.receipt.terms":
    "This document is subject to the carrier's applicable conditions of carriage and to the relevant tariff rules. For international carriage the provisions of the Warsaw/Montreal Conventions may apply; liability is limited. The conditions of use, the period of validity and the refund terms are governed by the rules of the issuing carrier.",

  "fix.issue.origin.placeholder": "Istanbul / IST",
};
