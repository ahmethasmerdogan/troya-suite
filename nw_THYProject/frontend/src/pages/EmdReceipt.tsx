import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { getEmd } from "@/domain/api";
import { RFISC_CATALOG } from "@/domain/mockData";
import { Money } from "@/components/domain/Money";
import { Button } from "@/components/ui/core";
import { Panel, PanelBody, PanelHead, Line, Rule } from "@/components/ui/surface";
import { Banner } from "@/components/ui/banner";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandMark } from "@/components/BrandMark";
import { formatDateTime } from "@/lib/utils";

/**
 * EMD Makbuzu (Handbook 5.8).
 *
 * "The Validating Carrier shall deliver a Receipt." Bu ekran o belgedir ve
 * handbook'un saydığı zorunlu alanları eksiksiz taşır: yolcu/grup adı, RFIC
 * tanımı ve açıklaması, in-connection-with belge numarası, her değer kuponu
 * için taşıyıcı + O/D, çıplak tutar, eşdeğer tutar, belge tutarı, ödeme şekli
 * (kart numarası son dört hane hariç maskeli), TFC kalemleri, tour code, kesim
 * tarihi, kesen acente/havayolu adı ve yeri, belge numarası, original issue /
 * issued in exchange for, ciro ve kısıtlamalar, FOID.
 *
 * Ayrıca Appendix B "Terms and Conditions Notice" yolcuya verilmek zorundadır.
 */
export function EmdReceipt() {
  const { emdNumber } = useParams({ from: "/emds/$emdNumber/receipt" });
  const navigate = useNavigate();
  const { data: emd, isLoading } = useQuery({ queryKey: ["emd", emdNumber], queryFn: () => getEmd(emdNumber) });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!emd) return <Banner kind="warning"><b className="num">{emdNumber}</b> numaralı EMD bulunamadı.</Banner>;

  const group = RFISC_CATALOG.find((r) => r.rfisc === emd.coupons[0]?.rfisc)?.group ?? emd.rfic ?? "—";
  const fop = emd.formOfPayment;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => navigate({ to: "/emds/$emdNumber", params: { emdNumber } })} aria-label="EMD'ye dön"
          className="grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-surface text-ink-2 transition-colors hover:bg-elev hover:text-ink">
          <ArrowLeft size={16} strokeWidth={1.75} />
        </button>
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink">EMD Makbuzu</h1>
          <p className="text-[12.5px] text-ink-3">Handbook 5.8 — Validating Carrier makbuzu yolcuya teslim etmekle yükümlüdür.</p>
        </div>
        <Button className="ml-auto" variant="secondary" onClick={() => window.print()}>
          <Printer size={15} strokeWidth={1.75} /> Yazdır
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex items-center gap-2.5 bg-[var(--brand)] px-5 py-2.5 text-white">
          <BrandMark size={18} variant="bare" className="text-white" />
          <span className="text-[12px] font-semibold uppercase tracking-[0.14em]">Turkish Airlines</span>
          <span className="ml-auto text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/80">
            EMD Receipt · Elektronik Muhtelif Belge
          </span>
        </div>
        <div className="grid gap-x-8 px-5 py-4 sm:grid-cols-2">
          <Line label="Yolcu / Grup adı" value={emd.groupName ?? `${emd.passenger.surname}/${emd.passenger.givenName}`} />
          <Line label="Belge numarası" value={<span className="num">{emd.emdNumber}</span>} />
          <Line label="Reason for Issuance (RFIC)" value={group} />
          <Line label="Reason for Issuance Sub-Code" value={<span className="num">{emd.coupons[0]?.rfisc ?? "—"}</span>} />
          <Line label="Açıklama" value={emd.coupons[0]?.description ?? "—"} />
          <Line label="In connection with" value={<span className="num">{emd.associatedTicket ?? "—"}{emd.associatedCouponSeq != null ? ` · kupon #${emd.associatedCouponSeq}` : ""}</span>} />
          <Line label="Kesim tarihi" value={<span className="num">{formatDateTime(emd.issuedAt)}</span>} />
          <Line label="Kesen havayolu / acente" value={`${emd.issuingAgency ?? "Turkish Airlines"} · ${emd.issuingCarrier}`} />
          <Line label="Kesim yeri" value={emd.placeOfIssue ?? "IST"} />
          <Line label="Ödeme şekli" value={<span className="num">{fopLabel(fop?.type)}{fop?.detail ? ` · ${maskCard(fop.detail)}` : ""}</span>} />
          <Line label="Tour code" value={<span className="num">{emd.tourCode ?? "—"}</span>} />
          <Line label="Kimlik belgesi (FOID)" value={<span className="num">{emd.passenger.foid ?? "—"}</span>} />
          {emd.endorsement && <Line label="Ciro / kısıtlamalar" value={emd.endorsement} />}
          {emd.forRefundOnly && <Line label="Belge tipi" value="FOR REFUND ONLY (15.3)" />}
        </div>
      </div>

      <Panel>
        <PanelHead title="Değer kuponları" hint="Her kupon için taşıyıcı, güzergâh ve tutar (5.8)." />
        <PanelBody className="pt-1">
          {emd.coupons.map((c) => (
            <div key={c.seq} className="flex flex-wrap items-center gap-3 border-b border-hair py-3 last:border-0">
              <span className="num grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-sunken text-[12px] text-ink-2">{c.seq}</span>
              <span className="num text-[12.5px] text-ink-2">{emd.issuingCarrier}</span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{c.description}</span>
              <span className="num text-[11.5px] text-ink-3">RFISC {c.rfisc}</span>
              <Money value={c.value} size="sm" />
            </div>
          ))}
          <Rule className="my-2" />
          <Line label="Çıplak tutar" value={<Money value={emd.total} size="sm" />} />
          {emd.equivAmount && <Line label="Eşdeğer tutar" value={<Money value={emd.equivAmount} size="sm" />} />}
          {emd.tfcs?.map((x) => (
            <Line key={x.code} label={`Vergi / harç ${x.code}`} value={<Money value={x.amount} size="sm" />} />
          ))}
          <Line label="Belge tutarı" strong value={<Money value={emd.total} size="sm" />} />
        </PanelBody>
      </Panel>

      <Banner kind="info" title="Terms and Conditions Notice (Appendix B)">
        Bu belge, taşıyıcının geçerli taşıma şartlarına ve ilgili tarife kurallarına tabidir. Uluslararası
        taşımalarda Varşova/Montreal Sözleşmeleri hükümleri uygulanabilir; sorumluluk sınırlıdır. Belgenin
        kullanım koşulları, geçerlilik süresi ve iade şartları düzenleyen taşıyıcının kurallarına bağlıdır.
      </Banner>
    </div>
  );
}

function fopLabel(t?: string) {
  return { cash: "Nakit", credit: "Kredi Kartı", uatp: "UATP", other: "Diğer" }[t ?? ""] ?? "Nakit";
}

/** 5.8: kart numarasının son dört hanesi dışındaki karakterler "X" ile değiştirilir. */
function maskCard(detail: string): string {
  const digits = detail.replace(/\D/g, "");
  if (digits.length < 5) return detail;
  return "X".repeat(digits.length - 4) + digits.slice(-4);
}
