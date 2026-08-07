import { describe, it, expect, beforeEach } from "vitest";
import { useUI, initialUser } from "./ui";
import { useUsers } from "./users";
import { DEMO_USERS } from "@/domain/users";

/**
 * Oturum sürekliliği ve çıkışta temizlik.
 *
 * İki gerçek hata buradan çıktı:
 * (1) Yönetim panelinden eklenen personel giriş yapıyor ama SAYFA YENİLENİNCE
 *     login ekranına düşüyordu — `initialUser` canlı kadroyu değil tohum
 *     listeyi okuyordu.
 * (2) Çıkışta sohbet geçmişi tarayıcıda kalıyordu; arayüz başka kullanıcıya
 *     göstermiyordu ama kayıt DevTools'tan okunabiliyordu. Ortak gişe
 *     terminalinde bu bir sızıntıdır.
 */
beforeEach(() => {
  localStorage.clear();
  useUsers.setState({ users: DEMO_USERS.map((u) => ({ ...u })), audit: [] });
});

describe("oturumun geri yüklenmesi", () => {
  it("yönetim panelinden eklenen kullanıcı sayfa yenilenince oturumda kalır", () => {
    const u = useUsers.getState().createUser("a.erdogan", {
      name: "Deniz Ak", email: "d.ak@thy.com", location: "AYT-STN",
      role: "staff", title: "Check-in Görevlisi", unit: "Check-in",
    });
    localStorage.setItem("troya.user", u.id);

    // Sayfa yenilemesi = store yeniden kurulur = initialUser() yeniden çalışır.
    const restored = initialUser();
    expect(restored?.id).toBe(u.id);
    expect(restored?.name).toBe("Deniz Ak");
  });

  it("devre dışı bırakılan personel oturumunu sürdüremez", () => {
    const u = useUsers.getState().createUser("a.erdogan", {
      name: "Pasif Kullanıcı", email: "p.pasif@thy.com", location: "IST-CTR",
      role: "staff", title: "Uzman", unit: "Biletleme",
    });
    useUsers.getState().setStatus("a.erdogan", u.id, "suspended", "izin");
    localStorage.setItem("troya.user", u.id);

    expect(initialUser()).toBeNull();
  });

  it("tohum kadro hâlâ çalışır (geriye dönük uyum)", () => {
    localStorage.setItem("troya.user", "a.erdogan");
    expect(initialUser()?.id).toBe("a.erdogan");
  });

  it("bozuk kadro kaydı oturumu düşürmez — tohuma düşer", () => {
    localStorage.setItem("troya.users.v1", "{bozuk json");
    localStorage.setItem("troya.user", "a.erdogan");
    expect(initialUser()?.id).toBe("a.erdogan");
  });
});

describe("çıkışta temizlik", () => {
  it("sohbet geçmişi ve okundu bilgisi tarayıcıda BIRAKILMAZ", () => {
    localStorage.setItem("troya.user", "a.erdogan");
    localStorage.setItem("troya.chat.v1.msgs", JSON.stringify({ "dm:a|b": [{ text: "gizli" }] }));
    localStorage.setItem("troya.chat.v1.read.a.erdogan", JSON.stringify({ "dm:a|b": "2026-01-01" }));

    useUI.getState().logout();

    expect(localStorage.getItem("troya.user")).toBeNull();
    expect(localStorage.getItem("troya.chat.v1.msgs")).toBeNull();
    expect(localStorage.getItem("troya.chat.v1.read.a.erdogan")).toBeNull();
  });

  it("cihaz ayarları ve kadro korunur — yalnız kişisel veri silinir", () => {
    localStorage.setItem("troya.user", "a.erdogan");
    localStorage.setItem("troya.lang", "en");
    localStorage.setItem("troya.theme", "dark");
    localStorage.setItem("troya.users.v1", "[]");
    localStorage.setItem("troya.closedPeriods", '["2026-08-01"]');

    useUI.getState().logout();

    expect(localStorage.getItem("troya.lang")).toBe("en");
    expect(localStorage.getItem("troya.theme")).toBe("dark");
    expect(localStorage.getItem("troya.users.v1")).toBe("[]");
    expect(localStorage.getItem("troya.closedPeriods")).toBe('["2026-08-01"]');
  });
});
