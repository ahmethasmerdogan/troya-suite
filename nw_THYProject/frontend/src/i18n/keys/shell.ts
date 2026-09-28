/**
 * "shell" alanının çevirileri.
 *
 * TR değerleri arayüzde GÖRÜNEN metnin birebir aynısıdır — e2e seçicileri
 * bu metinlere bağlı, tek kelime değişirse testler düşer.
 */
export const tr = {
  // kabuk — topbar / mobil gezinme
  "shell.menu": "Menü",
  "shell.denied.title": "Bu ekrana erişim yetkiniz yok",
  "shell.denied.body": "Bu ekran için gereken yetki rolünüzde yok.",
  "shell.denied.hint": "Erişim için yöneticinizden rol güncellemesi isteyin.",
  "shell.modules": "Modüller",
  "shell.theme.light": "Açık tema",
  "shell.theme.dark": "Koyu tema",
  "shell.notices.empty": "Açık duyuru yok.",
  "shell.role.demo": "Rol (demo)",
  "shell.recordList": "Kayıt listesi",
  "shell.close": "Kapat",

  // duyuru şeridi + zil
  "shell.notice.critical": "Kritik",
  "shell.notice.warning": "Uyarı",
  "shell.notice.info": "Duyuru",
  "shell.notice.revenue": "Gelir koruma",
  "shell.notice.ops": "İstasyon operasyon",
  "shell.notice.open": "Aç",
  "shell.notice.dismiss": "Duyuruyu kapat",
  "shell.ago.now": "şimdi",
  "shell.ago.min": "{n} dk",
  "shell.ago.hour": "{n} sa",
  "shell.ago.day": "{n} g",

  // veri tablosu
  "shell.table.columns": "Kolonlar",
  "shell.table.visibleColumns": "Görünür kolonlar",
  "shell.table.comfortable": "Rahat satır",
  "shell.table.dense": "Sık satır",
  "shell.table.action": "İşlem",
  "shell.table.empty": "Kayıt bulunamadı",
  "shell.table.totalRow": "TOPLAM",
  "shell.table.records": "{n} kayıt",
  "shell.table.page": "Sayfa",
  "shell.table.prev": "Önceki",
  "shell.table.next": "Sonraki",

  // alan primitifleri
  "shell.field.info": "Açıklama",
  "shell.field.example": "Örnek",
  "shell.field.source": "Kaynak: Handbook {ref}",
  "shell.field.clear": "Temizle",

  // giriş ekranı
  "shell.login.tagline": "Modern Biletleme Platformu",
  "shell.login.badge": "PSS · Elektronik Biletleme",
  "shell.login.headline1": "Biletleme operasyonunun",
  "shell.login.headline2": "tek konsolu.",
  "shell.login.lede":
    "Bilet kesiminden EMD'ye, exchange/refund'dan interline mesajlaşmaya — IATA standartlarına sadık, tıklama-tabanlı arayüz.",
  "shell.login.stat.status": "Kupon statüsü",
  "shell.login.stat.handbook": "Handbook kapsamı",
  "shell.login.stat.bilingual": "Çift dilli",
  "shell.login.copyright": "© 2026 Troya · IATA Ticketing Handbook'a dayalı prototip",
  "shell.login.title": "Giriş yap",
  "shell.login.subtitle": "Kurumsal hesabınızla devam edin.",
  "shell.login.username": "Kullanıcı adı",
  "shell.login.usernamePlaceholder": "örn. a.erdogan",
  "shell.login.password": "Parola",
  "shell.login.showPassword": "Parolayı göster",
  "shell.login.failed": "Giriş yapılamadı",
  "shell.login.submit": "Giriş Yap",
  "shell.login.quick": "Hızlı giriş · test kullanıcıları",
  "shell.login.demoNote": "Demo ortamı — parola gerekmez, herhangi bir test kullanıcısıyla giriş yapın.",
  "shell.login.suspended":
    "{name} devre dışı bırakılmış. Yönetim > Kullanıcılar bölümünden yeniden etkinleştirilmelidir.",
  "shell.login.userNotFound":
    "Kullanıcı bulunamadı. Aşağıdaki test kullanıcılarından biriyle hızlı giriş yapabilirsiniz.",
} as const;

export const en: Record<keyof typeof tr, string> = {
  "shell.menu": "Menu",
  "shell.denied.title": "You are not authorised to open this screen",
  "shell.denied.body": "Your role does not include the permission this screen requires.",
  "shell.denied.hint": "Ask your manager for a role update to get access.",
  "shell.modules": "Modules",
  "shell.theme.light": "Light theme",
  "shell.theme.dark": "Dark theme",
  "shell.notices.empty": "No open announcements.",
  "shell.role.demo": "Role (demo)",
  "shell.recordList": "Record list",
  "shell.close": "Close",

  "shell.notice.critical": "Critical",
  "shell.notice.warning": "Warning",
  "shell.notice.info": "Notice",
  "shell.notice.revenue": "Revenue protection",
  "shell.notice.ops": "Station operations",
  "shell.notice.open": "Open",
  "shell.notice.dismiss": "Dismiss announcement",
  "shell.ago.now": "now",
  "shell.ago.min": "{n} min",
  "shell.ago.hour": "{n} h",
  "shell.ago.day": "{n} d",

  "shell.table.columns": "Columns",
  "shell.table.visibleColumns": "Visible columns",
  "shell.table.comfortable": "Comfortable rows",
  "shell.table.dense": "Dense rows",
  "shell.table.action": "Action",
  "shell.table.empty": "No records found",
  "shell.table.totalRow": "TOTAL",
  "shell.table.records": "{n} records",
  "shell.table.page": "Page",
  "shell.table.prev": "Previous",
  "shell.table.next": "Next",

  "shell.field.info": "Explanation",
  "shell.field.example": "Example",
  "shell.field.source": "Source: Handbook {ref}",
  "shell.field.clear": "Clear",

  "shell.login.tagline": "Modern Ticketing Platform",
  "shell.login.badge": "PSS · Electronic Ticketing",
  "shell.login.headline1": "One console for the whole",
  "shell.login.headline2": "ticketing operation.",
  "shell.login.lede":
    "From ticket issuance to EMD, from exchange/refund to interline messaging — a click-based interface faithful to IATA standards.",
  "shell.login.stat.status": "Coupon statuses",
  "shell.login.stat.handbook": "Handbook coverage",
  "shell.login.stat.bilingual": "Bilingual",
  "shell.login.copyright": "© 2026 Troya · Prototype based on the IATA Ticketing Handbook",
  "shell.login.title": "Sign in",
  "shell.login.subtitle": "Continue with your corporate account.",
  "shell.login.username": "Username",
  "shell.login.usernamePlaceholder": "e.g. a.erdogan",
  "shell.login.password": "Password",
  "shell.login.showPassword": "Show password",
  "shell.login.failed": "Sign-in failed",
  "shell.login.submit": "Sign In",
  "shell.login.quick": "Quick sign-in · test users",
  "shell.login.demoNote": "Demo environment — no password required, sign in with any test user.",
  "shell.login.suspended": "{name} has been deactivated. Reactivate it from Admin > Users.",
  "shell.login.userNotFound": "User not found. You can use quick sign-in with one of the test users below.",
};
