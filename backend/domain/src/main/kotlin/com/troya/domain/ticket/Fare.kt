package com.troya.domain.ticket

import java.math.BigDecimal

/**
 * F4 — Handbook Ch 2 bilet girdileri. Event serileştirme dostu (primitive alanlar);
 * tutar doğrulaması aggregate'te yapılır. Pricing/fare ENGINE kapsam dışı —
 * fiyat TÜKETİLİR, hesaplanmaz (FareQuotePort mock'u sadece gösterimdir).
 */

/** TFC — tax/fee/charge (2.12): kod + tutar. `XT` ET'de kullanılmaz (01JAN08+). */
data class TaxFeeCharge(val code: String, val amount: String, val currency: String)

/** Fare breakdown (2.10–2.12, 2.22): base + TFC'ler + opsiyonel equivalent fare paid + fare calculation string. */
data class FareDetails(
    val baseFareAmount: String,
    val baseFareCurrency: String,
    val equivFarePaidAmount: String? = null,
    val equivFarePaidCurrency: String? = null,
    val tfcs: List<TaxFeeCharge> = emptyList(),
    /** 2.22 fare construction string (NUC/ROE) — parse edilmez, taşınır (App: pricing engine işi). */
    val fareCalculation: String? = null,
) {
    fun baseAsDecimal(): BigDecimal = BigDecimal(baseFareAmount)

    fun tfcTotal(): BigDecimal = tfcs.fold(BigDecimal.ZERO) { acc, t -> acc + BigDecimal(t.amount) }
}

/** Form of Payment (2.14) — CASH / CREDIT / UATP / OTHER + serbest detay (maskeli PAN vb.). */
data class FormOfPayment(val type: String, val detail: String? = null)

/** Handbook Ch 2 — ek bilet girdileri paketi (issue'da opsiyonel; event payload'ında taşınır). */
data class TicketEntries(
    val fare: FareDetails? = null,
    val formOfPayment: FormOfPayment? = null,
    /** FOID (1.1.7) — form of identification. */
    val foid: String? = null,
    /** Tour code (2.7). */
    val tourCode: String? = null,
    /** Endorsement / restrictions (2.19). */
    val endorsement: String? = null,
)
