package com.troya.application.port

import com.troya.domain.ticket.FareDetails

/**
 * Pricing/fare engine PORTU — kapsam DIŞI sistem (ROADMAP §0: fiyat tüketilir, hesaplanmaz).
 * Adapter şimdilik deterministik mock (MockFareQuoteAdapter); gerçek PSS'te ATPCO/fare
 * engine entegrasyonu bu portun arkasına takılır, domain değişmez.
 */
data class FareQuote(
    val origin: String,
    val destination: String,
    val rbd: String,
    val fareBasis: String,
    val fare: FareDetails,
    val totalAmount: String,
    val currency: String,
)

interface FareQuotePort {
    fun quote(origin: String, destination: String, rbd: String): FareQuote
}
