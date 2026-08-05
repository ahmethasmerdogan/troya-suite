/**
 * "docs2" alanının çevirileri.
 *
 * TR değerleri arayüzde GÖRÜNEN metnin birebir aynısıdır — e2e seçicileri
 * bu metinlere bağlı, tek kelime değişirse testler düşer.
 *
 * Kapsam: /docs sayfa kabuğu (başlık, stat etiketleri, panel başlıkları) ve
 * /guide kullanım kılavuzunun tamamı.
 * Not: /docs'un GÖVDE içeriği (modüller, mimari ilkeler, handbook bölümleri)
 * kendi `lang`-keyed desenini korur — sayfanın içinde TR/EN yan yana durur.
 */
export const tr = {
  // --- /docs kabuk ---
  "docs2.docs.title": "Sistem Dokümantasyonu",
  "docs2.docs.hint": "IATA Ticketing Handbook'tan türetilen elektronik biletleme platformunun teknik özeti.",
  "docs2.docs.tagline": "Modern Biletleme Platformu",
  "docs2.docs.stat.statuses": "Kupon statüsü",
  "docs2.docs.stat.coverage": "Handbook kapsamı",
  "docs2.docs.stat.modules": "Modül",
  "docs2.docs.stat.lang": "Arayüz dili",
  "docs2.docs.modules": "Modüller & yetenekler",
  "docs2.docs.principles": "Mimari ilkeler",
  "docs2.docs.stack": "Teknoloji Yığını",
  "docs2.docs.handbook": "IATA Handbook Kapsamı",

  // --- /guide kabuk ---
  "docs2.guide.hint": "Sık yapılan işler, adım adım. Kısaltma bilmenize gerek yok.",
  "docs2.guide.care": "Dikkat",

  // --- /guide: bilet kesmek ---
  "docs2.guide.issue.title": "Bilet kesmek",
  "docs2.guide.issue.s1": "Soldaki raydan Troya modülüne geçin, ardından Bilet Kes'e basın.",
  "docs2.guide.issue.s2": "Yolcu bilgilerini pasaporttaki ile birebir girin; sistem büyük harfe çevirir.",
  "docs2.guide.issue.s3": "Güzergâh ve tarihi girin, çıkan uçuş listesinden uçuşu seçin — sefer no elle yazılmaz.",
  "docs2.guide.issue.s4": "Sistem ücret tarifesini çıkarır; duruma uygun ücreti seçin (RBD ve fare basis otomatik oluşur).",
  "docs2.guide.issue.s5": "Ödeme şeklini girin, özeti kontrol edin ve onay kutusunu işaretleyerek kesin.",
  "docs2.guide.issue.care": "Kesim geri alınamaz. Void yalnız satış günü içinde mümkündür.",

  // --- /guide: bilet bulmak ---
  "docs2.guide.find.title": "Bilet bulmak",
  "docs2.guide.find.s1": "Bilet Ara ekranında tek çubuk yeter: bilet no, PNR, yolcu soyadı, havalimanı, uçuş no ya da kartın son 4 hanesi.",
  "docs2.guide.find.s2": "Daha dar arama için Gelişmiş'e basıp tarih aralığı ve kimlik gibi alanları kullanın.",
  "docs2.guide.find.s3": "Sol listeden kayda tıklayın; sağda bilet açılır, liste yerinde kalır.",
  "docs2.guide.find.s4": "Her yerden ⌘K ile de arayabilirsiniz: 13 hane belge, 6 karakter PNR olarak algılanır.",

  // --- /guide: değişiklik, iade, iptal ---
  "docs2.guide.change.title": "Değişiklik, iade, iptal",
  "docs2.guide.change.s1": "Bileti açın; üstteki şeritte Exchange, Refund ve Void doğrudan durur.",
  "docs2.guide.change.s2": "Diğer işlemler (revalidation, IRROP, ciro, kağıda basma, no-show) İşlemler menüsündedir.",
  "docs2.guide.change.s3": "Her işlem sonucu ekranda gösterir ve kupon statüsünü değiştirir; geçmiş yaşam döngüsünde kalır.",
  "docs2.guide.change.care": "Yetkiniz yetmiyorsa buton pasif görünür; üzerine gelince gereken rol yazar.",

  // --- /guide: check-in ve biniş ---
  "docs2.guide.checkin.title": "Check-in ve biniş",
  "docs2.guide.checkin.s1": "QuickCheck-in modülünde uçuşu seçin.",
  "docs2.guide.checkin.s2": "Check-in sekmesinde yolcuyu kabul edin ve koltuk verin; sistem uygun olmayan koltuğu engeller.",
  "docs2.guide.checkin.s3": "Biniş sekmesinde yolcuları bindirin; kupon statüsü otomatik ilerler.",
} as const;

export const en: Record<keyof typeof tr, string> = {
  // --- /docs shell ---
  "docs2.docs.title": "System Documentation",
  "docs2.docs.hint": "Technical overview of the electronic ticketing platform derived from the IATA Ticketing Handbook.",
  "docs2.docs.tagline": "Modern Ticketing Platform",
  "docs2.docs.stat.statuses": "Coupon statuses",
  "docs2.docs.stat.coverage": "Handbook coverage",
  "docs2.docs.stat.modules": "Modules",
  "docs2.docs.stat.lang": "Interface language",
  "docs2.docs.modules": "Modules & capabilities",
  "docs2.docs.principles": "Architecture principles",
  "docs2.docs.stack": "Technology stack",
  "docs2.docs.handbook": "IATA Handbook coverage",

  // --- /guide shell ---
  "docs2.guide.hint": "Common tasks, step by step. You do not need to know the abbreviations.",
  "docs2.guide.care": "Caution",

  // --- /guide: issuing a ticket ---
  "docs2.guide.issue.title": "Issuing a ticket",
  "docs2.guide.issue.s1": "Switch to the Troya module from the rail on the left, then press Issue Ticket.",
  "docs2.guide.issue.s2": "Enter the passenger details exactly as they appear in the passport; the system converts them to upper case.",
  "docs2.guide.issue.s3": "Enter the route and the date, then pick the flight from the list that appears — the flight number is never typed by hand.",
  "docs2.guide.issue.s4": "The system quotes the fares; select the one that fits the case (RBD and fare basis are filled in automatically).",
  "docs2.guide.issue.s5": "Enter the form of payment, review the summary and issue by ticking the confirmation box.",
  "docs2.guide.issue.care": "Issuance cannot be undone. Void is only possible within the day of sale.",

  // --- /guide: finding a ticket ---
  "docs2.guide.find.title": "Finding a ticket",
  "docs2.guide.find.s1": "On the Search Tickets screen a single bar is enough: ticket number, PNR, passenger surname, airport, flight number or the last 4 digits of the card.",
  "docs2.guide.find.s2": "To narrow the search, press Advanced and use fields such as the date range and the identity document.",
  "docs2.guide.find.s3": "Click a record in the list on the left; the ticket opens on the right and the list stays in place.",
  "docs2.guide.find.s4": "You can also search from anywhere with ⌘K: 13 digits are read as a document, 6 characters as a PNR.",

  // --- /guide: change, refund, void ---
  "docs2.guide.change.title": "Change, refund, void",
  "docs2.guide.change.s1": "Open the ticket; Exchange, Refund and Void sit right in the toolbar at the top.",
  "docs2.guide.change.s2": "The other operations (revalidation, IRROP, endorsement, print to paper, no-show) are in the Operations menu.",
  "docs2.guide.change.s3": "Every operation shows its result on screen and changes the coupon status; the record stays in the lifecycle.",
  "docs2.guide.change.care": "If your permissions are not enough the button appears disabled; hover over it to see the role required.",

  // --- /guide: check-in and boarding ---
  "docs2.guide.checkin.title": "Check-in and boarding",
  "docs2.guide.checkin.s1": "Select the flight in the QuickCheck-in module.",
  "docs2.guide.checkin.s2": "Accept the passenger on the Check-in tab and assign a seat; the system blocks seats that are not eligible.",
  "docs2.guide.checkin.s3": "Board the passengers on the Boarding tab; the coupon status advances automatically.",
};
