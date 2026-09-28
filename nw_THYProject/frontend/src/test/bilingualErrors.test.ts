// @vitest-environment node
import { describe, expect, it } from "vitest";
import ts from "typescript";

// Mock sunucunun her ret gerekçesi iki dilli olmalı: İngilizce arayüzde
// personel gerekçeyi Türkçe okumasın. Yeni bir `throw` yalnız Türkçe metinle
// yazılırsa bu test hangi satır olduğunu söyler.
type Fs = { readFileSync(path: URL, encoding: "utf8"): string; readdirSync(path: URL): string[] };
const NODE_FS = "node:fs";
const NAMES = new Set(["DomainError", "MemoError", "LocalizedError", "InvalidTransitionError"]);

describe("sunucu hataları", () => {
  it("her hata İngilizce karşılığıyla atılır", async () => {
    const fs = (await import(/* @vite-ignore */ NODE_FS)) as Fs;
    const dir = new URL("../domain/", import.meta.url);
    const missing: string[] = [];
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;
      const src = fs.readFileSync(new URL(name, dir), "utf8");
      const sf = ts.createSourceFile(name, src, ts.ScriptTarget.Latest, true);
      const visit = (n: ts.Node) => {
        if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && NAMES.has(n.expression.text)
          && (n.arguments?.length ?? 0) < 2 && !isDeclaration(n, sf)) {
          missing.push(`${name}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`);
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
    expect(missing).toEqual([]);
  });
});

/** `super(message, en)` gibi sınıf içi çağrılar ve yeniden fırlatmalar sayılmaz. */
function isDeclaration(n: ts.NewExpression, sf: ts.SourceFile): boolean {
  const arg = n.arguments?.[0];
  return !!arg && ts.isIdentifier(arg) && sf.text.includes(`${arg.text}En`);
}
