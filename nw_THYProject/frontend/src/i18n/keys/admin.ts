/**
 * "admin" alanının çevirileri.
 *
 * TR değerleri arayüzde GÖRÜNEN metnin birebir aynısıdır — e2e seçicileri
 * bu metinlere bağlı, tek kelime değişirse testler düşer.
 * Yer tutucu: "{n} kupon" → t("admin.x", { n: 3 }).
 */
export const tr = {
  // ---- Yönetim kabuğu ----
  "admin.title": "Yönetim",
  "admin.hint": "Roller, kullanıcılar, denetim kaydı ve sistem ayarları.",
  "admin.section.roles": "Roller & Yetkiler",
  "admin.section.users": "Kullanıcılar",
  "admin.section.logs": "Denetim Kaydı",
  "admin.section.revenue": "Gelir Koruma",
  "admin.section.settings": "Ayarlar",
  "admin.noPerm.title": "Yetkiniz yok",
  "admin.noPerm.body": "Bu bölüm için gereken rol: {role}",
  "admin.reason": "Gerekçe",
  "admin.suspended": "Devre dışı",

  // ---- Rol → yetki matrisi ----
  "admin.roles.title": "Rol → yetki matrisi",
  "admin.roles.hint": "Yetkiler kümülatiftir: üst rol alt rolün her şeyini yapabilir.",
  "admin.roles.permission": "Yetki",

  // ---- Kullanıcılar ----
  "admin.users.title": "Kullanıcılar",
  "admin.users.hint": "{n} personel · {active} aktif",
  "admin.users.searchPh": "Ad · birim · istasyon",
  "admin.users.new": "Yeni kullanıcı",
  "admin.users.needManager": "Müdür ve üzeri gerekir",
  "admin.users.empty": "Kullanıcı bulunamadı",
  "admin.users.emptyHint": "Farklı bir ad, birim ya da istasyon deneyin.",
  "admin.users.you": "siz",
  "admin.users.active": "aktif",
  "admin.users.inactive": "devre dışı",
  "admin.users.edit": "Düzenle",
  "admin.users.role": "Rol",
  "admin.users.needAdmin": "Rol atamak için Admin gerekir",
  "admin.users.selfLock": "Kendinizi devre dışı bırakamazsınız",
  "admin.users.deactivate": "Devre dışı",
  "admin.users.activate": "Etkinleştir",

  // ---- Kullanıcı değişiklikleri (denetim) ----
  "admin.changes.title": "Kullanıcı değişiklikleri",
  "admin.changes.hint": "Kim, kimde, neyi, hangi gerekçeyle değiştirdi.",
  "admin.changes.empty": "Değişiklik yok",
  "admin.changes.emptyHint": "Kadroda henüz bir değişiklik yapılmadı.",
  "admin.action.create": "Eklendi",
  "admin.action.update": "Güncellendi",
  "admin.action.role": "Rol atandı",
  "admin.action.status": "Durum",
  "admin.action.delete": "Silindi",

  // ---- Kullanıcı formu ----
  "admin.form.editTitle": "Kullanıcıyı düzenle",
  "admin.form.newTitle": "Yeni kullanıcı",
  "admin.form.newHint": "Kullanıcı adı e-postadan üretilir; parola demo ortamında sorulmaz.",
  "admin.form.save": "Kaydet",
  "admin.form.create": "Kullanıcıyı ekle",
  "admin.form.name": "Ad Soyad",
  "admin.form.email": "E-posta",
  "admin.form.emailHint": "Kullanıcı adı buradan türer.",
  "admin.form.emailTaken": "Bu e-posta başka bir personelde kayıtlı.",
  "admin.form.jobTitle": "Unvan",
  "admin.form.jobTitlePh": "Bilet Satış Uzmanı",
  "admin.form.unit": "Birim",
  "admin.form.location": "İstasyon / Ofis",
  "admin.form.phone": "Dahili",
  "admin.form.manager": "Bağlı olduğu yönetici",
  "admin.form.noManager": "— yok —",
  "admin.form.role": "Rol",
  "admin.form.roleHint": "Rol ayrı bir işlemdir; buradan değiştirilmez.",

  // ---- Rol atama ----
  "admin.role.title": "Rol ata — {name}",
  "admin.role.hint": "Rol değişikliği yetki matrisini anında değiştirir ve denetim kaydına yazılır.",
  "admin.role.submit": "Rolü ata",
  "admin.role.gained": "Kazanacağı yetkiler",
  "admin.role.lost": "Kaybedeceği yetkiler",
  "admin.role.reasonHint": "Denetim kaydına yazılır.",
  "admin.role.reasonPh": "Vardiya sorumluluğu devri",

  // ---- Devre dışı / etkinleştir ----
  "admin.status.deactivateTitle": "Devre dışı bırak — {name}",
  "admin.status.activateTitle": "Etkinleştir — {name}",
  "admin.status.deactivate": "Devre dışı bırak",
  "admin.status.activate": "Etkinleştir",
  "admin.status.deactivateNote": "Devre dışı personel giriş yapamaz; mevcut kayıtları ve denetim geçmişi silinmez.",
  "admin.status.activateNote": "Personel yeniden giriş yapabilir ve rolünün yetkileriyle çalışır.",
  "admin.status.reasonPhOff": "İzin / görev değişikliği",
  "admin.status.reasonPhOn": "Göreve dönüş",

  // ---- Denetim kaydı ----
  "admin.logs.title": "Denetim kaydı",
  "admin.logs.hint": "Kim, ne zaman, ne yaptı — event store'dan türer ({n} olay).",
  "admin.logs.searchPh": "Belge · personel · yolcu",
  "admin.logs.empty": "Kayıt yok",
  "admin.logs.emptyHint": "Bu filtreyle eşleşen denetim kaydı bulunmuyor.",
  "admin.cat.issue": "Kesim",
  "admin.cat.void": "Void",
  "admin.cat.refund": "İade",
  "admin.cat.exchange": "Exchange / Reissue",
  "admin.cat.emd": "EMD",
  "admin.cat.checkin": "Check-in / Biniş",
  "admin.cat.other": "Diğer",

  // ---- Gelir koruma ----
  "admin.revenue.title": "Gelir koruma",
  "admin.revenue.hint": "Sıra dışı kupon kullanımı, çift belge, statü uyuşmazlığı (Handbook 14.7).",
  "admin.revenue.empty": "Uyarı yok",
  "admin.revenue.emptyHint": "Şu an gelir koruma uyarısı bulunmuyor.",

  // ---- Ayarlar ----
  "admin.settings.title": "Ayarlar",
  "admin.settings.hint": "Bu ortamda oturum düzeyinde tutulur; gerçekte kullanıcı profiline yazılır.",
  "admin.settings.theme": "Tema",
  "admin.settings.lang": "Dil",
  "admin.settings.role": "Rol",
  "admin.settings.station": "İstasyon",
  "admin.theme.light": "Açık",
  "admin.theme.dark": "Koyu",
  "admin.theme.system": "Sistem",

  // ---- Profilim ----
  "admin.profile.title": "Profilim",
  "admin.profile.hint": "Kimlik bilgileriniz, yetkileriniz, ekibiniz ve son işlemleriniz.",
  "admin.profile.noSession": "Oturum bulunamadı.",
  "admin.profile.card": "Personel kartı",
  "admin.profile.chain": "Bağlı olduğu yönetim zinciri",
  "admin.profile.chainHint": "Onay ve yetki devri bu hat üzerinden yürür.",
  "admin.profile.team": "Bana bağlı personel",
  "admin.profile.teamHint": "{n} kişi",
  // Tekil biçim — Türkçede sayıdan sonra çoğul eki yok, İngilizcede "1 person".
  "admin.profile.teamHint.one": "{n} kişi",
  "admin.profile.perms": "Rolüm ve yetkilerim",
  "admin.profile.permCount": "{n} / {total} yetki",
  "admin.profile.needRole": "{role} ve üzeri gerekir",
  "admin.profile.prefs": "Tercihler",
  "admin.profile.prefsHint": "Yalnız sizin oturumunuzu etkiler.",
  "admin.profile.lightTheme": "Açık tema",
  "admin.profile.darkTheme": "Koyu tema",
  "admin.profile.recent": "Son işlemlerim",
  "admin.profile.recentHint": "Denetim kaydından — bu istasyonda yaptığınız işlemler.",
  "admin.profile.recentEmpty": "Kayıt yok",
  "admin.profile.recentEmptyHint": "Bu oturumda henüz bir işlem yapmadınız.",

  // ---- Kişi kartı ----
  "admin.person.offline": "Çevrimdışı",
  "admin.person.lastSeen": "Çevrimdışı · son görülme {time}",
  "admin.person.unit": "Birim",
  "admin.person.station": "İstasyon",
  "admin.person.email": "E-posta",
  "admin.person.phone": "Dahili",
  "admin.person.manager": "Bağlı olduğu",
  "admin.person.team": "Ekibi",
  "admin.person.teamValue": "{n} kişi · {names}",
  "admin.person.teamValue.one": "{n} kişi · {names}",
  "admin.person.message": "Mesaj gönder",

  // ---- Ekran yardımı (kabuk) ----
  "admin.help.button": "Bu ekran nasıl kullanılır",
  "admin.help.modalTitle": "{title} — nasıl kullanılır",
  "admin.help.steps": "Adımlar",
  "admin.help.watch": "Dikkat",
  "admin.help.shortcuts": "Kısayollar",
  "admin.help.fullGuide": "Tüm kullanım kılavuzu",
  "admin.help.close": "Kapat",
  "admin.help.sc.palette": "Komut paleti",
  "admin.help.sc.exchange": "Exchange",
  "admin.help.sc.refund": "Refund",
  "admin.help.sc.void": "Void",

  // ---- Ekran yardımı: Bilet Kesme ----
  "admin.help.issue.title": "Bilet Kesme",
  "admin.help.issue.what": "Yolcuya elektronik bilet düzenlersiniz. Beş adım: yolcu, sefer, ücret, ödeme, onay.",
  "admin.help.issue.s1": "Ad ve soyadı pasaporttaki gibi yazın — sonradan değiştirmek yeni belge gerektirir.",
  "admin.help.issue.s2": "Uçuş numarasını SİZ yazmazsınız: güzergâh ve tarihi girin, sistem o günün seferlerini listeler.",
  "admin.help.issue.s3": "Ücreti de siz yazmazsınız: sistem tarifesinden uygun ücreti seçersiniz; RBD ve ücret kodu otomatik dolar.",
  "admin.help.issue.s4": "Onay ekranında özeti okuyup beyanı işaretlemeden kesim yapılmaz.",
  "admin.help.issue.w1": "Kucak bebeği 24 aydan küçük olmalı; büyükse çocuk (CHD) bileti gerekir.",
  "admin.help.issue.w2": "Ücretli özel hizmet seçerseniz ayrıca EMD düzenlenir.",
  "admin.help.issue.w3": "Void yalnız satış günü içinde mümkündür; sonrası iade kurallarına tabidir.",

  // ---- Ekran yardımı: Bilet Kaydı ----
  "admin.help.ticket.title": "Bilet Kaydı",
  "admin.help.ticket.what": "Belgenin tamamı: kuponlar, ücret dökümü, kontrol bilgisi ve yaşam döngüsü.",
  "admin.help.ticket.s1": "Üstteki belge yüzü yolcunun elindeki bilete karşılık gelir; Yazdır ile kâğıda basılır.",
  "admin.help.ticket.s2": "Her bacak ayrı bir KUPONDUR ve statüsü bağımsız yürür (O açık, F uçulmuş, V iptal…).",
  "admin.help.ticket.s3": "Exchange / Refund / Void toolbar'da; diğer işlemler 'İşlemler' menüsündedir.",
  "admin.help.ticket.s4": "Yaşam döngüsü kaydın denetim geçmişidir — kim, ne zaman, ne yaptı, ne kadar.",
  "admin.help.ticket.w1": "Kupon kontrolü başka taşıyıcıdaysa işlem yapılamaz; önce kontrolü isteyin.",
  "admin.help.ticket.w2": "Kuponlar sırayla kullanılır: önceki kupon açıkken sonraki honor edilmez.",

  // ---- Ekran yardımı: Bilet Arama ----
  "admin.help.search.title": "Bilet Arama",
  "admin.help.search.what": "Tek çubuk her şeyi tanır: bilet no, PNR, yolcu adı, havalimanı, uçuş no, kart son 4 hane.",
  "admin.help.search.s1": "Durum sekmeleri 17 kupon kodunu gruplar — void edilen bilet kaybolmaz, 'İptal (Void)' sekmesindedir.",
  "admin.help.search.s2": "Gelişmiş panel tarih aralığı, FOID ve kart ile daraltır.",
  "admin.help.search.s3": "Satır sonundaki ikonlar: kaydı aç, yolcu belgesi.",
  "admin.help.search.s4": "CSV dışa aktarımı ekranda göründüğü gibi çıkar (Excel uyumlu).",

  // ---- Ekran yardımı: Koltuk Seçimi ----
  "admin.help.seat.title": "Koltuk Seçimi",
  "admin.help.seat.what": "Kabin uçağın gerçek düzeninden çizilir; her koltuk her yolcuya verilemez.",
  "admin.help.seat.s1": "Turuncu ⊘ koltuk bu yolcuya kapalıdır; nedeni sağdaki 'Kapalı koltuklar' panelinde yazar.",
  "admin.help.seat.s2": "Yeşil zeminli sıralar acil çıkış sıralarıdır.",
  "admin.help.seat.s3": "Seçtiğiniz koltuğun tarifi (pencere/koridor, çıkış, bölme başı) alt şeritte görünür.",
  "admin.help.seat.w1": "Bebekli, çocuk ve hareket kısıtlı yolcu çıkış sırasına oturamaz (EASA/DOT).",
  "admin.help.seat.w2": "WCHC ve sedye yolcusu yalnız pencere kenarına; evcil hayvan bölme başına oturamaz.",

  // ---- Ekran yardımı: Yolcu Kabul ----
  "admin.help.checkin.title": "Yolcu Kabul",
  "admin.help.checkin.what": "Uçuşa yolcu kabul eder, biniş yapar ve kapıyı kapatırsınız. Her adım bilet kuponunu ilerletir.",
  "admin.help.checkin.s1": "Kontrol al: kuponları havalimanı kontrolüne alır (O→A).",
  "admin.help.checkin.s2": "Kabul et: koltuk verir, kuponu check-in'e taşır (A→C) ve bagajı kupona yazar.",
  "admin.help.checkin.s3": "Bindir: kuponu uçağa alınmış yapar (C→L).",
  "admin.help.checkin.s4": "Uçuşu kapat: binenlerin kuponu uçulmuş olur (L→F), binmeyenler no-show.",
  "admin.help.checkin.w1": "Uluslararası uçuşta APIS (pasaport + uyruk) eksikse kabul yapılamaz.",
  "admin.help.checkin.w2": "Kontuar dış hatta kalkıştan 60, iç hatta 45 dk önce kapanır. Sonrasında kabul yalnız süpervizör onayı ve gerekçeyle (geç kabul); kapı 15 dk önce kapanınca hiç yapılamaz.",
  "admin.help.checkin.w3": "Seyahat belgesi \"Belge uygun değil\" çıkan yolcu kabul edilmez. Belge penceresinden vize/ETA/ESTA ya da pasaport tarihi girin; istisna yalnız varış ülkesi makamının OK TO BOARD onayıyla.",

  // ---- Ekran yardımı: Raporlar ----
  "admin.help.report.title": "Raporlar",
  "admin.help.report.what": "Üç rapor üç ayrı soruya cevap verir.",
  "admin.help.report.s1": "Satış / İşlem: bugün ne oldu — belge belge işlem listesi.",
  "admin.help.report.s2": "Mali Rapor: ceza, vergi, KDV ve iade türü kırılımı.",
  "admin.help.report.s3": "Dönem Kapanışı: günü kapatır; kapanan dönemde void ve iade geri alma yapılamaz.",
  "admin.help.report.w1": "Dönem kapanışı geri alınamaz; kapatmadan önce açık kalemleri kontrol edin.",

  // ---- Ekran yardımı: Rezervasyon ----
  "admin.help.res.title": "Rezervasyon (QuickRes)",
  "admin.help.res.what": "PNR arar, açar ve yeni rezervasyon oluşturursunuz.",
  "admin.help.res.s1": "Uygunluk sorgusunda sınıfa tıklamak rezervasyon formunu o seferle doldurur.",
  "admin.help.res.s2": "PNR detayında 'Bilet Kes' yolcu ve seferi kesim formuna taşır.",
  "admin.help.res.s3": "Kesim tamamlanınca doküman numarası PNR'a yazılır ve rezervasyon 'biletlendi' olur.",
  "admin.help.res.w1": "Kesim süre limiti (TTL/ADTK) dolan rezervasyon düşebilir — uyarı bandına dikkat edin.",

  // ---- Ekran yardımı: Mesajlaşma ----
  "admin.help.chat.title": "Mesajlaşma",
  "admin.help.chat.what": "Gişedeki personelin süpervizöre soru sorduğu yer. Kanallar herkese açık, kişiler birebir.",
  "admin.help.chat.s1": "'Bilet ekle' ile kaydı mesaja iliştirin — karşı taraf sağ panelde canlı görür.",
  "admin.help.chat.s2": "Kişi satırındaki (i) kişi kartını açar: unvan, birim, kime bağlı olduğu.",
  "admin.help.chat.s3": "Durumunuzu (Müsait / Meşgul / Uzakta) kendiniz bildirirsiniz.",

  // ---- Ekran yardımı: varsayılan ----
  "admin.help.default.title": "Troya Suite",
  "admin.help.default.what": "Rezervasyon (QuickRes), biletleme (Troya) ve yolcu kabul (QuickCheck-in) tek panelde.",
  "admin.help.default.s1": "Üstteki modül şeridi hangi işi yaptığınızı seçer; alt satır o modülün bölümleridir.",
  "admin.help.default.s2": "⌘K komut paleti bilet no, PNR ya da EMD numarasını doğrudan açar.",
  "admin.help.default.s3": "Yetkiniz olmayan işlem kilitli görünür; üzerine gelince hangi rolün gerektiği yazar.",
} as const;

export const en: Record<keyof typeof tr, string> = {
  // ---- Yönetim kabuğu ----
  "admin.title": "Administration",
  "admin.hint": "Roles, users, audit log and system settings.",
  "admin.section.roles": "Roles & Permissions",
  "admin.section.users": "Users",
  "admin.section.logs": "Audit Log",
  "admin.section.revenue": "Revenue Protection",
  "admin.section.settings": "Settings",
  "admin.noPerm.title": "Not authorised",
  "admin.noPerm.body": "Role required for this section: {role}",
  "admin.reason": "Reason",
  "admin.suspended": "Suspended",

  // ---- Rol → yetki matrisi ----
  "admin.roles.title": "Role → permission matrix",
  "admin.roles.hint": "Permissions are cumulative: a higher role can do everything a lower role can.",
  "admin.roles.permission": "Permission",

  // ---- Kullanıcılar ----
  "admin.users.title": "Users",
  "admin.users.hint": "{n} staff · {active} active",
  "admin.users.searchPh": "Name · unit · station",
  "admin.users.new": "New user",
  "admin.users.needManager": "Manager or above required",
  "admin.users.empty": "No users found",
  "admin.users.emptyHint": "Try a different name, unit or station.",
  "admin.users.you": "you",
  "admin.users.active": "active",
  "admin.users.inactive": "suspended",
  "admin.users.edit": "Edit",
  "admin.users.role": "Role",
  "admin.users.needAdmin": "Admin required to assign roles",
  "admin.users.selfLock": "You cannot suspend your own account",
  "admin.users.deactivate": "Suspend",
  "admin.users.activate": "Activate",

  // ---- Kullanıcı değişiklikleri (denetim) ----
  "admin.changes.title": "User changes",
  "admin.changes.hint": "Who changed what, on whom and for what reason.",
  "admin.changes.empty": "No changes",
  "admin.changes.emptyHint": "No staff change has been made yet.",
  "admin.action.create": "Created",
  "admin.action.update": "Updated",
  "admin.action.role": "Role assigned",
  "admin.action.status": "Status",
  "admin.action.delete": "Deleted",

  // ---- Kullanıcı formu ----
  "admin.form.editTitle": "Edit user",
  "admin.form.newTitle": "New user",
  "admin.form.newHint": "The username is derived from the e-mail; no password is requested in this demo environment.",
  "admin.form.save": "Save",
  "admin.form.create": "Add user",
  "admin.form.name": "Full Name",
  "admin.form.email": "E-mail",
  "admin.form.emailHint": "The username is derived from this.",
  "admin.form.emailTaken": "This e-mail is already registered to another staff member.",
  "admin.form.jobTitle": "Job Title",
  "admin.form.jobTitlePh": "Ticket Sales Agent",
  "admin.form.unit": "Unit",
  "admin.form.location": "Station / Office",
  "admin.form.phone": "Extension",
  "admin.form.manager": "Reporting manager",
  "admin.form.noManager": "— none —",
  "admin.form.role": "Role",
  "admin.form.roleHint": "Role assignment is a separate action; it cannot be changed here.",

  // ---- Rol atama ----
  "admin.role.title": "Assign role — {name}",
  "admin.role.hint": "A role change updates the permission matrix immediately and is written to the audit log.",
  "admin.role.submit": "Assign role",
  "admin.role.gained": "Permissions gained",
  "admin.role.lost": "Permissions lost",
  "admin.role.reasonHint": "Written to the audit log.",
  "admin.role.reasonPh": "Shift responsibility handover",

  // ---- Devre dışı / etkinleştir ----
  "admin.status.deactivateTitle": "Suspend — {name}",
  "admin.status.activateTitle": "Activate — {name}",
  "admin.status.deactivate": "Suspend",
  "admin.status.activate": "Activate",
  "admin.status.deactivateNote": "A suspended agent cannot sign in; existing records and audit history are not deleted.",
  "admin.status.activateNote": "The agent can sign in again and works with the permissions of their role.",
  "admin.status.reasonPhOff": "Leave / assignment change",
  "admin.status.reasonPhOn": "Return to duty",

  // ---- Denetim kaydı ----
  "admin.logs.title": "Audit log",
  "admin.logs.hint": "Who did what and when — derived from the event store ({n} events).",
  "admin.logs.searchPh": "Document · agent · passenger",
  "admin.logs.empty": "No records",
  "admin.logs.emptyHint": "No audit record matches this filter.",
  "admin.cat.issue": "Issue",
  "admin.cat.void": "Void",
  "admin.cat.refund": "Refund",
  "admin.cat.exchange": "Exchange / Reissue",
  "admin.cat.emd": "EMD",
  "admin.cat.checkin": "Check-in / Boarding",
  "admin.cat.other": "Other",

  // ---- Gelir koruma ----
  "admin.revenue.title": "Revenue protection",
  "admin.revenue.hint": "Out-of-sequence coupon usage, duplicate documents, status mismatch (Handbook 14.7).",
  "admin.revenue.empty": "No alerts",
  "admin.revenue.emptyHint": "There is no revenue protection alert at the moment.",

  // ---- Ayarlar ----
  "admin.settings.title": "Settings",
  "admin.settings.hint": "Kept at session level in this environment; in production it is stored on the user profile.",
  "admin.settings.theme": "Theme",
  "admin.settings.lang": "Language",
  "admin.settings.role": "Role",
  "admin.settings.station": "Station",
  "admin.theme.light": "Light",
  "admin.theme.dark": "Dark",
  "admin.theme.system": "System",

  // ---- Profilim ----
  "admin.profile.title": "My Profile",
  "admin.profile.hint": "Your identity details, permissions, team and recent transactions.",
  "admin.profile.noSession": "No active session.",
  "admin.profile.card": "Staff card",
  "admin.profile.chain": "Reporting chain",
  "admin.profile.chainHint": "Approvals and delegation of authority follow this line.",
  "admin.profile.team": "My direct reports",
  "admin.profile.teamHint": "{n} people",
  "admin.profile.teamHint.one": "{n} person",
  "admin.profile.perms": "My role and permissions",
  "admin.profile.permCount": "{n} / {total} permissions",
  "admin.profile.needRole": "{role} or above required",
  "admin.profile.prefs": "Preferences",
  "admin.profile.prefsHint": "Affects your session only.",
  "admin.profile.lightTheme": "Light theme",
  "admin.profile.darkTheme": "Dark theme",
  "admin.profile.recent": "My recent transactions",
  "admin.profile.recentHint": "From the audit log — transactions you performed at this station.",
  "admin.profile.recentEmpty": "No records",
  "admin.profile.recentEmptyHint": "You have not performed any transaction in this session yet.",

  // ---- Kişi kartı ----
  "admin.person.offline": "Offline",
  "admin.person.lastSeen": "Offline · last seen {time}",
  "admin.person.unit": "Unit",
  "admin.person.station": "Station",
  "admin.person.email": "E-mail",
  "admin.person.phone": "Extension",
  "admin.person.manager": "Reports to",
  "admin.person.team": "Team",
  "admin.person.teamValue": "{n} people · {names}",
  "admin.person.teamValue.one": "{n} person · {names}",
  "admin.person.message": "Send message",

  // ---- Ekran yardımı (kabuk) ----
  "admin.help.button": "How to use this screen",
  "admin.help.modalTitle": "{title} — how to use",
  "admin.help.steps": "Steps",
  "admin.help.watch": "Watch out",
  "admin.help.shortcuts": "Shortcuts",
  "admin.help.fullGuide": "Full user guide",
  "admin.help.close": "Close",
  "admin.help.sc.palette": "Command palette",
  "admin.help.sc.exchange": "Exchange",
  "admin.help.sc.refund": "Refund",
  "admin.help.sc.void": "Void",

  // ---- Ekran yardımı: Bilet Kesme ----
  "admin.help.issue.title": "Issue Ticket",
  "admin.help.issue.what": "You issue an electronic ticket for the passenger. Five steps: passenger, flight, fare, payment, confirmation.",
  "admin.help.issue.s1": "Enter the given and family name exactly as in the passport — changing it later requires a new document.",
  "admin.help.issue.s2": "You do NOT type the flight number: enter the routing and the date, and the system lists that day's flights.",
  "admin.help.issue.s3": "Nor do you type the fare: you pick a suitable fare from the system tariff; RBD and fare basis are filled automatically.",
  "admin.help.issue.s4": "No ticket is issued until you read the summary on the confirmation screen and tick the declaration.",
  "admin.help.issue.w1": "An infant in arms must be under 24 months; if older, a child (CHD) ticket is required.",
  "admin.help.issue.w2": "If you select a chargeable special service, a separate EMD is issued.",
  "admin.help.issue.w3": "Void is only possible within the day of sale; after that refund rules apply.",

  // ---- Ekran yardımı: Bilet Kaydı ----
  "admin.help.ticket.title": "Ticket Record",
  "admin.help.ticket.what": "The whole document: coupons, fare breakdown, control information and lifecycle.",
  "admin.help.ticket.s1": "The document face at the top corresponds to the ticket the passenger holds; use Print to put it on paper.",
  "admin.help.ticket.s2": "Each leg is a separate COUPON and its status runs independently (O open, F flown, V void…).",
  "admin.help.ticket.s3": "Exchange / Refund / Void are on the toolbar; the other actions are in the 'Actions' menu.",
  "admin.help.ticket.s4": "The lifecycle is the audit history of the record — who did what, when and for how much.",
  "admin.help.ticket.w1": "If coupon control is held by another carrier no action is possible; request control first.",
  "admin.help.ticket.w2": "Coupons are used in sequence: the next coupon is not honoured while the previous one is still open.",

  // ---- Ekran yardımı: Bilet Arama ----
  "admin.help.search.title": "Ticket Search",
  "admin.help.search.what": "A single bar recognises everything: ticket number, PNR, passenger name, airport, flight number, last 4 digits of the card.",
  "admin.help.search.s1": "The status tabs group the 17 coupon codes — a voided ticket is not lost, it sits under the 'Void' tab.",
  "admin.help.search.s2": "The advanced panel narrows by date range, FOID and card.",
  "admin.help.search.s3": "The icons at the end of a row: open the record, passenger document.",
  "admin.help.search.s4": "The CSV export comes out exactly as shown on screen (Excel compatible).",

  // ---- Ekran yardımı: Koltuk Seçimi ----
  "admin.help.seat.title": "Seat Selection",
  "admin.help.seat.what": "The cabin is drawn from the real aircraft layout; not every seat can be given to every passenger.",
  "admin.help.seat.s1": "An orange ⊘ seat is closed to this passenger; the reason is stated in the 'Restricted seats' panel on the right.",
  "admin.help.seat.s2": "Rows on a green background are emergency exit rows.",
  "admin.help.seat.s3": "The description of the seat you pick (window/aisle, exit, bulkhead) appears in the bottom strip.",
  "admin.help.seat.w1": "Passengers with an infant, children and passengers with reduced mobility may not be seated in an exit row (EASA/DOT).",
  "admin.help.seat.w2": "WCHC and stretcher passengers only at a window seat; a passenger with a pet may not be seated at a bulkhead.",

  // ---- Ekran yardımı: Yolcu Kabul ----
  "admin.help.checkin.title": "Passenger Acceptance",
  "admin.help.checkin.what": "You accept passengers for the flight, board them and close the gate. Each step advances the ticket coupon.",
  "admin.help.checkin.s1": "Take control: moves the coupons to airport control (O→A).",
  "admin.help.checkin.s2": "Accept: assigns a seat, moves the coupon to checked-in (A→C) and records the baggage on the coupon.",
  "admin.help.checkin.s3": "Board: sets the coupon to boarded (C→L).",
  "admin.help.checkin.s4": "Close flight: coupons of boarded passengers become flown (L→F), those who did not board are no-show.",
  "admin.help.checkin.w1": "On an international flight acceptance is not possible while APIS (passport + nationality) is missing.",
  "admin.help.checkin.w2": "The counter closes 60 min before departure on international and 45 min on domestic flights. After that, acceptance only with supervisor approval and a reason (late acceptance); once the gate closes at 15 min, not at all.",
  "admin.help.checkin.w3": "A passenger whose travel documents are \"not OK\" cannot be accepted. Enter the visa/ETA/ESTA or passport expiry in the document window; the only exception is an OK TO BOARD approval from the destination authority.",

  // ---- Ekran yardımı: Raporlar ----
  "admin.help.report.title": "Reports",
  "admin.help.report.what": "Three reports answer three different questions.",
  "admin.help.report.s1": "Sales / Transaction: what happened today — a document-by-document transaction list.",
  "admin.help.report.s2": "Financial Report: penalty, tax, VAT and refund type breakdown.",
  "admin.help.report.s3": "Period Closing: closes the day; in a closed period void and refund-cancel are not possible.",
  "admin.help.report.w1": "Period closing cannot be undone; check the open items before closing.",

  // ---- Ekran yardımı: Rezervasyon ----
  "admin.help.res.title": "Reservation (QuickRes)",
  "admin.help.res.what": "You search and open PNRs and create new bookings.",
  "admin.help.res.s1": "Clicking a class in the availability display fills the booking form with that flight.",
  "admin.help.res.s2": "'Issue Ticket' on the PNR detail carries the passenger and the flight into the issue form.",
  "admin.help.res.s3": "Once issuance is complete the document number is written to the PNR and the booking becomes 'ticketed'.",
  "admin.help.res.w1": "A booking whose ticketing time limit (TTL/ADTK) expires may be cancelled — watch the warning banner.",

  // ---- Ekran yardımı: Mesajlaşma ----
  "admin.help.chat.title": "Messaging",
  "admin.help.chat.what": "Where counter staff ask the supervisor a question. Channels are open to everyone, contacts are one-to-one.",
  "admin.help.chat.s1": "Attach the record to the message with 'Attach ticket' — the other side sees it live in the right-hand panel.",
  "admin.help.chat.s2": "The (i) on a contact row opens the person card: job title, unit and who they report to.",
  "admin.help.chat.s3": "You set your own status (Available / Busy / Away).",

  // ---- Ekran yardımı: varsayılan ----
  "admin.help.default.title": "Troya Suite",
  "admin.help.default.what": "Reservation (QuickRes), ticketing (Troya) and passenger acceptance (QuickCheck-in) in a single console.",
  "admin.help.default.s1": "The module strip at the top selects the job you are doing; the row below holds that module's sections.",
  "admin.help.default.s2": "The ⌘K command palette opens a ticket, PNR or EMD number directly.",
  "admin.help.default.s3": "An action you are not authorised for appears locked; hovering shows which role is required.",
};
