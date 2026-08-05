import { describe, it, expect, beforeEach } from "vitest";
import { useUsers } from "./users";
import { DEMO_USERS, chainOf, reportsOf, userIdFrom, initialsOf } from "@/domain/users";
import { permissionsFor } from "@/domain/auth";

/**
 * Kullanıcı yönetimi — kadro artık sabit değil, her değişiklik olaydır.
 */
beforeEach(() => {
  localStorage.clear();
  useUsers.setState({ users: DEMO_USERS.map((u) => ({ ...u })), audit: [] });
});

describe("kadro", () => {
  it("tohum kadro hiyerarşi kurar", () => {
    const users = useUsers.getState().users;
    expect(chainOf(users, "e.demir").map((u) => u.id)).toEqual(["m.kaya", "z.sahin", "b.yildiz", "a.erdogan"]);
    expect(reportsOf(users, "m.kaya").map((u) => u.id)).toEqual(["e.demir"]);
  });

  it("kullanıcı adı ve baş harf addan türer", () => {
    expect(userIdFrom("Elif Demir")).toBe("e.demir");
    expect(userIdFrom("Zeynep Şahin")).toBe("z.sahin");
    expect(initialsOf("Ahmet Erdoğan")).toBe("AE");
  });
});

describe("kullanıcı yönetimi", () => {
  it("yeni kullanıcı eklenir ve denetim kaydına yazılır", () => {
    const { createUser } = useUsers.getState();
    const u = createUser("a.erdogan", {
      name: "Deniz Ak", email: "d.ak@thy.com", location: "AYT-STN",
      role: "staff", title: "Check-in Görevlisi", unit: "Check-in", managerId: "z.sahin",
    });
    const s = useUsers.getState();
    expect(s.users.some((x) => x.id === u.id)).toBe(true);
    expect(u.initials).toBe("DA");
    expect(s.audit[0].action).toBe("create");
    expect(s.audit[0].actor).toBe("a.erdogan");
  });

  it("rol ataması yetkileri gerçekten değiştirir ve gerekçesi kaydedilir", () => {
    const { assignRole } = useUsers.getState();
    const before = permissionsFor("staff");
    assignRole("a.erdogan", "e.demir", "supervisor", "vardiya devri");
    const after = useUsers.getState().users.find((u) => u.id === "e.demir")!;
    expect(after.role).toBe("supervisor");
    expect(permissionsFor(after.role).length).toBeGreaterThan(before.length);
    expect(useUsers.getState().audit[0]).toMatchObject({ action: "role", reason: "vardiya devri" });
  });

  it("aynı rol yeniden atanırsa olay üretilmez", () => {
    const { assignRole } = useUsers.getState();
    assignRole("a.erdogan", "e.demir", "staff", "değişiklik yok");
    expect(useUsers.getState().audit).toHaveLength(0);
  });

  it("devre dışı bırakma durumu değiştirir ve kayda geçer", () => {
    const { setStatus } = useUsers.getState();
    setStatus("b.yildiz", "e.demir", "suspended", "uzun süreli izin");
    const u = useUsers.getState().users.find((x) => x.id === "e.demir")!;
    expect(u.status).toBe("suspended");
    expect(useUsers.getState().audit[0].detail).toContain("devre dışı");
  });

  it("silinen yöneticinin astları bir üst kademeye bağlanır", () => {
    const { removeUser } = useUsers.getState();
    removeUser("a.erdogan", "m.kaya"); // Elif'in yöneticisi
    const elif = useUsers.getState().users.find((u) => u.id === "e.demir")!;
    expect(elif.managerId).toBe("z.sahin"); // Mert'in yöneticisi
  });

  it("değişiklik yoksa güncelleme olay üretmez", () => {
    const { updateUser } = useUsers.getState();
    updateUser("a.erdogan", "e.demir", { title: "Bilet Satış Uzmanı" });
    expect(useUsers.getState().audit).toHaveLength(0);
  });
});
