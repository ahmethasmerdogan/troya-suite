package com.troya.infrastructure.fare

import com.troya.application.port.FareQuote
import com.troya.application.port.FareQuotePort
import com.troya.domain.ticket.FareDetails
import com.troya.domain.ticket.TaxFeeCharge
import org.springframework.stereotype.Component
import java.math.BigDecimal

/**
 * Pricing/fare engine MOCK adapter'ı (kapsam dışı sistem — ROADMAP §0).
 * Deterministik: aynı O&D+RBD her zaman aynı fiyatı verir (test edilebilirlik).
 * base + ΣTFC == total garanti edilir (aggregate'in F4 invariant'ıyla uyumlu).
 */
@Component
class MockFareQuoteAdapter : FareQuotePort {
    override fun quote(origin: String, destination: String, rbd: String): FareQuote {
        val o = origin.uppercase()
        val d = destination.uppercase()
        val r = rbd.uppercase()
        val seed = (o + d).fold(0) { acc, ch -> (acc * SEED_MULT + ch.code) % SEED_MOD }
        val cabinFactor = when (r) {
            "C", "J", "D", "Z" -> BUSINESS_FACTOR
            "W", "P" -> PREMIUM_FACTOR
            else -> 1
        }
        val base = BigDecimal(BASE_MIN + seed % BASE_SPAN).multiply(BigDecimal(cabinFactor)).setScale(2)
        val yq = base.multiply(YQ_RATE).setScale(2, java.math.RoundingMode.HALF_UP)
        val tr = TR_FLAT
        val total = base + yq + tr
        val fareBasis = "${r}FLEX"
        return FareQuote(
            origin = o,
            destination = d,
            rbd = r,
            fareBasis = fareBasis,
            fare = FareDetails(
                baseFareAmount = base.toPlainString(),
                baseFareCurrency = CURRENCY,
                tfcs = listOf(
                    TaxFeeCharge("YQ", yq.toPlainString(), CURRENCY),
                    TaxFeeCharge("TR", tr.toPlainString(), CURRENCY),
                ),
                fareCalculation = "$o TK $d ${base.toPlainString()}$CURRENCY END ROE1.00",
            ),
            totalAmount = total.toPlainString(),
            currency = CURRENCY,
        )
    }

    private companion object {
        const val SEED_MULT = 31
        const val SEED_MOD = 100_000
        const val BASE_MIN = 2_000
        const val BASE_SPAN = 6_000
        const val BUSINESS_FACTOR = 3
        const val PREMIUM_FACTOR = 2
        const val CURRENCY = "TRY"
        val YQ_RATE: BigDecimal = BigDecimal("0.12")
        val TR_FLAT: BigDecimal = BigDecimal("450.00")
    }
}
