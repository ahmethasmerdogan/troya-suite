import { describe, it, expect, beforeEach } from "vitest";
import { useTips, ONBOARDED_KEY } from "./tips";

/**
 * İpucu tercihleri — varsayılan KAPALI olmalı: karşılamayı `troya.onboarded`
 * ile atlayan otomasyon ve alışkın kullanıcı ekranda beklenmedik bir katman
 * (nabızlı nokta, tur şeridi) görmesin.
 */
const read = () => JSON.parse(localStorage.getItem("troya.tips.v1") ?? "null");

beforeEach(() => {
  localStorage.clear();
  useTips.setState({ enabled: false, seen: [], tours: [], dailyHidden: false, onboarded: false, activeTour: null });
});

describe("ipucu tercihleri", () => {
  it("karşılama tamamlanınca seçim kaydedilir ve onboarded bayrağı yazılır", () => {
    useTips.getState().finishOnboarding(true);
    expect(localStorage.getItem(ONBOARDED_KEY)).toBe("1");
    expect(useTips.getState().enabled).toBe(true);
    expect(read().enabled).toBe(true);
  });

  it("ipuçlarını kapatarak karşılamayı bitirmek kalıcıdır", () => {
    useTips.getState().finishOnboarding(false);
    expect(useTips.getState().onboarded).toBe(true);
    expect(read().enabled).toBe(false);
  });

  it("okunan ipucu bir kez kaydedilir (idempotent)", () => {
    useTips.getState().dismiss("search.smartbar");
    useTips.getState().dismiss("search.smartbar");
    expect(useTips.getState().seen).toEqual(["search.smartbar"]);
    expect(read().seen).toEqual(["search.smartbar"]);
  });

  it("biten ve yarıda bırakılan tur 'görüldü' sayılır; öneri bir daha çıkmaz", () => {
    useTips.getState().startTour("panel");
    expect(useTips.getState().activeTour).toBe("panel");
    useTips.getState().endTour();
    useTips.getState().skipTour("search");
    expect(useTips.getState().activeTour).toBeNull();
    expect(read().tours).toEqual(["panel", "search"]);
  });

  it("sıfırlama okunanları ve turları unutur, ipuçlarını açar", () => {
    useTips.setState({ enabled: false, seen: ["a"], tours: ["panel"], dailyHidden: true });
    useTips.getState().reset();
    const s = useTips.getState();
    expect([s.enabled, s.seen, s.tours, s.dailyHidden]).toEqual([true, [], [], false]);
  });

  it("karşılamayı yeniden açmak onboarded bayrağını siler", () => {
    useTips.getState().finishOnboarding(true);
    useTips.getState().replayOnboarding();
    expect(localStorage.getItem(ONBOARDED_KEY)).toBeNull();
    expect(useTips.getState().onboarded).toBe(false);
  });
});
