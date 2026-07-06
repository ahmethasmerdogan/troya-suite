package com.troya.application.ticket

import com.troya.domain.ticket.TicketEntries

/** Okuma tarafı DTO'ları (CQRS read model çıktısı). F4: fareBasis/NVB/NVA/bagaj + entries. */
data class CouponView(
    val seq: Int,
    val status: String,
    val origin: String,
    val destination: String,
    val flightNumber: String,
    val rbd: String,
    val fareBasis: String? = null,
    val notValidBefore: String? = null,
    val notValidAfter: String? = null,
    val baggage: String? = null,
)

data class TicketView(
    val ticketNumber: String,
    val passengerName: String,
    val pnr: String?,
    val validatingCarrier: String,
    val route: String,
    val overallStatus: String,
    val totalAmount: String,
    val currency: String,
    val issuedAt: String,
    val coupons: List<CouponView>,
    val entries: TicketEntries? = null,
)

data class TicketSummaryView(
    val ticketNumber: String,
    val passengerName: String,
    val route: String,
    val validatingCarrier: String,
    val overallStatus: String,
    val totalAmount: String,
    val currency: String,
    val issuedAt: String,
)
