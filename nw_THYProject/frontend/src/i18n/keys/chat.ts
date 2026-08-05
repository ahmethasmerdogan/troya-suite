/**
 * "chat" alanının çevirileri.
 *
 * TR değerleri arayüzde GÖRÜNEN metnin birebir aynısıdır — e2e seçicileri
 * bu metinlere bağlı, tek kelime değişirse testler düşer.
 * Yer tutucu: "{n} kupon" → t("chat.x", { n: 3 }).
 */
export const tr = {
  "chat.new": "Yeni",
  "chat.new.chat": "Yeni sohbet",
  "chat.new.chatHint": "Bir kişiyle birebir konuşma",
  "chat.new.group": "Yeni grup",
  "chat.new.groupHint": "Birkaç kişiyle özel konuşma",
  "chat.new.channel": "Yeni kanal",
  "chat.new.channelHint": "İstasyon geneline açık başlık",
  "chat.groups": "Gruplar",
  "chat.group.title": "Yeni grup",
  "chat.group.hint": "Seçtiğiniz kişilerle özel bir konuşma açılır. Ad vermezseniz üye adlarından türetilir.",
  "chat.group.name": "Grup adı",
  "chat.group.nameHint": "İsteğe bağlı — boş bırakırsanız üye adları kullanılır.",
  "chat.group.namePlaceholder": "Gate Vardiyası",
  "chat.group.members": "Üyeler",
  "chat.group.membersHint": "En az bir kişi seçin; siz otomatik üyesiniz.",
  "chat.group.submit": "Grubu oluştur",
  "chat.group.selected": "{n} kişi seçildi",
  "chat.group.memberCount": "{n} üye",
  "chat.group.addMember": "Kişi ekle",
  "chat.group.leave": "Gruptan ayrıl",
  "chat.channel.private": "Özel kanal",
  "chat.channel.public": "Herkese açık",
  "chat.channel.membersOptional": "Üyeler (isteğe bağlı)",
  "chat.channel.membersHint": "Kimse seçmezseniz kanal herkese açık olur.",
  "chat.channel.join": "Kanala katıl",
  "chat.channel.leave": "Kanaldan ayrıl",
  "chat.channel.joined": "Katıldınız",
  "chat.members": "Üyeler",
  "chat.startHint": "İlk mesajı yazarak konuşmayı başlatın.",
  /* ---------- mesajlaşma: durum (presence) ---------- */
  "chat.presence.available": "Müsait",
  "chat.presence.busy": "Meşgul",
  "chat.presence.away": "Uzakta",
  "chat.offline": "Çevrimdışı",
  "chat.offlineSince": "Çevrimdışı · son görülme {time}",
  "chat.online": "{n} çevrimiçi",

  /* ---------- mesajlaşma: sol panel ---------- */
  "chat.dirSearchPlaceholder": "Kişi · birim · kanal ara",
  "chat.conversations": "Sohbetler",
  "chat.channels": "Kanallar",
  "chat.people": "Kişiler",
  "chat.newChannel": "Yeni kanal",
  "chat.newChat": "Yeni sohbet",
  "chat.personCard": "{name} kişi kartı",

  /* ---------- mesajlaşma: sohbet ---------- */
  "chat.thread": "Sohbet",
  "chat.typing": "yazıyor…",
  "chat.typingBy": "{names} yazıyor…",
  "chat.empty.title": "Henüz mesaj yok",
  "chat.empty.hint": "İlk mesajı siz yazın ya da bir bilet iliştirin.",
  "chat.attach.ticket": "Bilet ekle",
  "chat.attach.remove": "İlişiği kaldır",
  "chat.composer.placeholder": "Mesaj yazın…",
  "chat.send": "Gönder",
  "chat.searching": "Aranıyor…",

  /* ---------- mesajlaşma: iliştirilen kayıt ---------- */
  "chat.ref.view": "{id} kaydını görüntüle",
  "chat.ref.panelTitle": "Bilet görüntüsü",
  "chat.ref.notFound": "Kayıt bulunamadı",
  "chat.ref.notFoundHint": "{id} bu istasyonda görünmüyor.",
  "chat.ref.etkt": "Elektronik Bilet",
  "chat.ref.coupons": "Kuponlar",
  "chat.ref.amount": "Tutar",
  "chat.ref.openTicket": "Bilette aç",

  /* ---------- mesajlaşma: bilet seçici ---------- */
  "chat.picker.hint": "Aradığınız kaydı seçin — mesaja iliştirilir.",
  "chat.picker.placeholder": "Bilet no, yolcu, PNR, uçuş no…",
  "chat.picker.none": "Eşleşen bilet yok.",

  /* ---------- mesajlaşma: yeni kanal ---------- */
  "chat.newChannel.hint": "Kanal herkese açıktır; açıldığı anda diğer pencerelerde de görünür.",
  "chat.newChannel.submit": "Kanalı aç",
  "chat.newChannel.name": "Kanal adı",
  "chat.newChannel.namePlaceholder": "Gate Ekibi",
  "chat.newChannel.desc": "Açıklama",
  "chat.newChannel.descHint": "Kanalın ne için kullanıldığı.",
  "chat.newChannel.descPlaceholder": "Gate operasyonu koordinasyonu",

  /* ---------- mesajlaşma: yeni sohbet ---------- */
  "chat.newChat.hint": "Kişiyi ad, unvan ya da birimle bulun.",
  "chat.newChat.placeholder": "Ad · unvan · birim",
  "chat.newChat.none": "Kişi bulunamadı",
  "chat.newChat.noneHint": "Farklı bir ad ya da birim deneyin.",

  /* ---------- QuickRes: PNR arama ---------- */
  "chat.res.search.hint": "PNR (record locator), yolcu adı ya da havalimanı ile ara.",
  "chat.res.search.empty": "Bir PNR seçin",
  "chat.res.search.emptyHint": "Soldaki listeden bir rezervasyona tıklayın; yolcuları ve segmentleri burada açılır.",
  "chat.res.list.none": "PNR bulunamadı",
  "chat.res.list.noneHint": "record locator, yolcu adı ya da havalimanı koduyla deneyin.",

  /* ---------- QuickRes: PNR detay ---------- */
  "chat.res.ttl.warnTitle": "Bilet kesim süresi doluyor",
  "chat.res.ttl.warnBody": "Bu rezervasyon için kalan süre {n} saat. Süresinde kesilmezse rezervasyon düşer (SSR ADTK).",
  "chat.res.ttl.expiredTitle": "Bilet kesim süresi doldu",
  "chat.res.ttl.expiredBody": "Ticketing time limit geçti; rezervasyon iptale düşmüş olabilir.",
  "chat.res.reservation": "Rezervasyon",
  "chat.res.createdAt": "Oluşturma",
  "chat.res.segment": "Segment",
  "chat.res.contact": "İletişim",
  "chat.res.passengers": "Yolcular",
  "chat.res.segments": "Segmentler",
  "chat.res.issuedTickets": "Kesilmiş biletler",

  /* ---------- QuickRes: PNR oluşturma ---------- */
  "chat.res.new.hint": "Yolcu ve uçuş bilgilerini girin; sistem PNR (record locator) üretir.",
  "chat.res.new.created": "Rezervasyon oluşturuldu",
  "chat.res.new.fromAvail": "Uygunluk sorgusundan gelindi",
  "chat.res.new.fromAvailBody": "{flight} · {o} → {d} · sınıf {rbd} segment olarak dolduruldu. Yolcu bilgilerini girip rezervasyonu oluşturun.",
  "chat.res.new.paxHint": "Ad ve soyadı pasaporttaki ile birebir yazın.",
  "chat.res.new.segHint": "Her uçuş bacağı için bir segment.",
  "chat.res.new.contactHint": "E-posta ya da telefon — bilgilendirme için.",
  "chat.res.new.error": "Rezervasyon oluşturulamadı",
  "chat.res.new.creating": "Oluşturuluyor…",
  "chat.res.new.submit": "Rezervasyon Oluştur",
  "chat.res.remove": "Kaldır",

  /* ---------- QuickRes: alan etiketleri ---------- */
  "chat.res.field.surname": "Soyadı",
  "chat.res.field.givenName": "Ad",
  "chat.res.field.title": "Ünvan",
  "chat.res.field.origin": "Nereden",
  "chat.res.field.destination": "Nereye",
  "chat.res.field.carrier": "Taşıyıcı",
  "chat.res.field.flightNumber": "Uçuş No",
  "chat.res.field.rbd": "Sınıf",
  "chat.res.field.departure": "Kalkış",
  "chat.res.field.date": "Tarih",

  /* ---------- QuickRes: uygunluk ---------- */
  "chat.res.avail.hint": "Güzergâh ve tarihe göre uçuş ve sınıf uygunluğu. Bir sınıfa tıklayın — rezervasyon formu o seferle açılır.",
  "chat.res.avail.idle": "Sorgu bekleniyor",
  "chat.res.avail.idleHint": "Güzergâh ve tarihi girip Ara'ya basın.",
  "chat.res.avail.none": "Uçuş bulunamadı",
  "chat.res.avail.noneHint": "Farklı bir tarih ya da güzergâh deneyin.",
  "chat.res.avail.duration": "{h}sa {m}dk",
  "chat.res.avail.seats": "{n} koltuk",
  "chat.res.avail.pick": "Bu sınıfla rezervasyon oluştur",
  "chat.res.avail.full": "Bu sınıfta koltuk yok",

  /* ---------- Ticketing Time Limit rozeti ---------- */
  "chat.ttl.expired": "TTL doldu",
  "chat.ttl.hours": "TTL {n} sa",
  "chat.ttl.days": "TTL {n} gün",
} as const;

export const en: Record<keyof typeof tr, string> = {
  "chat.new": "New",
  "chat.new.chat": "New chat",
  "chat.new.chatHint": "One-to-one conversation",
  "chat.new.group": "New group",
  "chat.new.groupHint": "Private conversation with several people",
  "chat.new.channel": "New channel",
  "chat.new.channelHint": "Topic open to the whole station",
  "chat.groups": "Groups",
  "chat.group.title": "New group",
  "chat.group.hint": "A private conversation is opened with the people you select. If you leave the name empty it is derived from member names.",
  "chat.group.name": "Group name",
  "chat.group.nameHint": "Optional — member names are used if left empty.",
  "chat.group.namePlaceholder": "Gate Shift",
  "chat.group.members": "Members",
  "chat.group.membersHint": "Select at least one person; you are a member automatically.",
  "chat.group.submit": "Create group",
  "chat.group.selected": "{n} selected",
  "chat.group.memberCount": "{n} members",
  "chat.group.addMember": "Add people",
  "chat.group.leave": "Leave group",
  "chat.channel.private": "Private channel",
  "chat.channel.public": "Public",
  "chat.channel.membersOptional": "Members (optional)",
  "chat.channel.membersHint": "If you select nobody the channel is open to everyone.",
  "chat.channel.join": "Join channel",
  "chat.channel.leave": "Leave channel",
  "chat.channel.joined": "Joined",
  "chat.members": "Members",
  "chat.startHint": "Write the first message to start the conversation.",
  /* ---------- messaging: presence ---------- */
  "chat.presence.available": "Available",
  "chat.presence.busy": "Busy",
  "chat.presence.away": "Away",
  "chat.offline": "Offline",
  "chat.offlineSince": "Offline · last seen {time}",
  "chat.online": "{n} online",

  /* ---------- messaging: left pane ---------- */
  "chat.dirSearchPlaceholder": "Search person · unit · channel",
  "chat.conversations": "Conversations",
  "chat.channels": "Channels",
  "chat.people": "People",
  "chat.newChannel": "New channel",
  "chat.newChat": "New chat",
  "chat.personCard": "{name} contact card",

  /* ---------- messaging: thread ---------- */
  "chat.thread": "Conversation",
  "chat.typing": "typing…",
  "chat.typingBy": "{names} typing…",
  "chat.empty.title": "No messages yet",
  "chat.empty.hint": "Write the first message or attach a ticket.",
  "chat.attach.ticket": "Attach ticket",
  "chat.attach.remove": "Remove attachment",
  "chat.composer.placeholder": "Type a message…",
  "chat.send": "Send",
  "chat.searching": "Searching…",

  /* ---------- messaging: attached record ---------- */
  "chat.ref.view": "View record {id}",
  "chat.ref.panelTitle": "Ticket view",
  "chat.ref.notFound": "Record not found",
  "chat.ref.notFoundHint": "{id} is not visible at this station.",
  "chat.ref.etkt": "Electronic Ticket",
  "chat.ref.coupons": "Coupons",
  "chat.ref.amount": "Amount",
  "chat.ref.openTicket": "Open in ticket",

  /* ---------- messaging: ticket picker ---------- */
  "chat.picker.hint": "Pick the record you are looking for — it is attached to the message.",
  "chat.picker.placeholder": "Ticket number, passenger, PNR, flight number…",
  "chat.picker.none": "No matching ticket.",

  /* ---------- messaging: new channel ---------- */
  "chat.newChannel.hint": "Channels are open to everyone; once created they appear in other windows too.",
  "chat.newChannel.submit": "Create channel",
  "chat.newChannel.name": "Channel name",
  "chat.newChannel.namePlaceholder": "Gate Team",
  "chat.newChannel.desc": "Description",
  "chat.newChannel.descHint": "What the channel is used for.",
  "chat.newChannel.descPlaceholder": "Gate operations coordination",

  /* ---------- messaging: new chat ---------- */
  "chat.newChat.hint": "Find the person by name, title or unit.",
  "chat.newChat.placeholder": "Name · title · unit",
  "chat.newChat.none": "No person found",
  "chat.newChat.noneHint": "Try a different name or unit.",

  /* ---------- QuickRes: PNR search ---------- */
  "chat.res.search.hint": "Search by PNR (record locator), passenger name or airport.",
  "chat.res.search.empty": "Select a PNR",
  "chat.res.search.emptyHint": "Click a reservation in the list on the left; its passengers and segments open here.",
  "chat.res.list.none": "No PNR found",
  "chat.res.list.noneHint": "try a record locator, passenger name or airport code.",

  /* ---------- QuickRes: PNR detail ---------- */
  "chat.res.ttl.warnTitle": "Ticketing time limit is running out",
  "chat.res.ttl.warnBody": "This reservation has {n} hours left. If not ticketed in time the reservation is cancelled (SSR ADTK).",
  "chat.res.ttl.expiredTitle": "Ticketing time limit expired",
  "chat.res.ttl.expiredBody": "The ticketing time limit has passed; the reservation may already be cancelled.",
  "chat.res.reservation": "Reservation",
  "chat.res.createdAt": "Created",
  "chat.res.segment": "Segment",
  "chat.res.contact": "Contact",
  "chat.res.passengers": "Passengers",
  "chat.res.segments": "Segments",
  "chat.res.issuedTickets": "Issued tickets",

  /* ---------- QuickRes: create PNR ---------- */
  "chat.res.new.hint": "Enter passenger and flight details; the system generates a PNR (record locator).",
  "chat.res.new.created": "Reservation created",
  "chat.res.new.fromAvail": "Arrived from the availability query",
  "chat.res.new.fromAvailBody": "{flight} · {o} → {d} · class {rbd} has been filled in as a segment. Enter the passenger details and create the reservation.",
  "chat.res.new.paxHint": "Enter the given name and surname exactly as in the passport.",
  "chat.res.new.segHint": "One segment per flight leg.",
  "chat.res.new.contactHint": "E-mail or phone — for notifications.",
  "chat.res.new.error": "Reservation could not be created",
  "chat.res.new.creating": "Creating…",
  "chat.res.new.submit": "Create Reservation",
  "chat.res.remove": "Remove",

  /* ---------- QuickRes: field labels ---------- */
  "chat.res.field.surname": "Surname",
  "chat.res.field.givenName": "Given name",
  "chat.res.field.title": "Title",
  "chat.res.field.origin": "From",
  "chat.res.field.destination": "To",
  "chat.res.field.carrier": "Carrier",
  "chat.res.field.flightNumber": "Flight No",
  "chat.res.field.rbd": "Class",
  "chat.res.field.departure": "Departure",
  "chat.res.field.date": "Date",

  /* ---------- QuickRes: availability ---------- */
  "chat.res.avail.hint": "Flight and class availability by route and date. Click a class — the reservation form opens with that flight.",
  "chat.res.avail.idle": "Waiting for a query",
  "chat.res.avail.idleHint": "Enter the route and date, then press Search.",
  "chat.res.avail.none": "No flight found",
  "chat.res.avail.noneHint": "Try a different date or route.",
  "chat.res.avail.duration": "{h}h {m}m",
  "chat.res.avail.seats": "{n} seats",
  "chat.res.avail.pick": "Create a reservation in this class",
  "chat.res.avail.full": "No seats in this class",

  /* ---------- Ticketing Time Limit badge ---------- */
  "chat.ttl.expired": "TTL expired",
  "chat.ttl.hours": "TTL {n} h",
  "chat.ttl.days": "TTL {n} d",
};
