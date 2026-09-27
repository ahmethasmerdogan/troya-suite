import { describe, expect, it } from "vitest";

// Vercel, Git'ten derlerken repo kökündeki vercel.json'u okur; CLI ile bu
// klasörden yayınlarken buradakini. İkisinin güvenlik başlıkları ve SPA
// yönlendirmesi aynı kalmalı.
type Fs = { readFileSync(path: URL, encoding: "utf8"): string };
const NODE_FS = "node:fs";

async function readJson(rel: string) {
  const fs = (await import(/* @vite-ignore */ NODE_FS)) as Fs;
  return JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), "utf8"));
}

describe("vercel.json", () => {
  it("kök yapılandırma bu uygulamayı derler", async () => {
    const root = await readJson("../../../../vercel.json");
    expect(root.buildCommand).toContain("nw_THYProject/frontend");
    expect(root.outputDirectory).toBe("nw_THYProject/frontend/dist");
  });

  it("başlıklar ve yönlendirmeler iki dosyada aynı", async () => {
    const root = await readJson("../../../../vercel.json");
    const app = await readJson("../../vercel.json");
    expect(root.headers).toEqual(app.headers);
    expect(root.rewrites).toEqual(app.rewrites);
  });
});
