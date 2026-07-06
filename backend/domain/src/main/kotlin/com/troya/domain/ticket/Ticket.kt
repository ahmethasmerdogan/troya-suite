package com.troya.domain.ticket

import com.troya.domain.common.AggregateRoot
import com.troya.domain.common.CarrierCode
import com.troya.domain.common.DomainEvent
import com.troya.domain.common.Money
import com.troya.domain.coupon.CouponStatus
import java.math.BigDecimal

/** Yolcu (Handbook Ch 2). Faz 1 minimum; FOID/infant ileri fazda. */
data class Passenger(val surname: String, val givenName: String, val title: String?)

/** Elektronik kupon — segment + statü (FSM). Faz 1: issue ile O başlar. */
data class Coupon(
    val seq: Int,
    val status: CouponStatus,
    val origin: String,
    val destination: String,
    val marketingCarrier: String,
    val flightNumber: String,
    val rbd: String,
    val fareBasis: String,
    val departure: String,
)

/**
 * Ticket aggregate root (DDD + Event Sourcing). State event'lerden türetilir.
 * F1: IssueTicket → TicketIssued (tüm kuponlar O).
 * F3: void (TÜM kuponlar O → V) · refund (seçili O kuponlar → R) · exchange (açık kuponlar → E + yeni bilet linkage).
 * Statü geçişleri CouponStatus FSM'inden geçer; ihlal exception (asla sessiz).
 */
class Ticket private constructor(override val id: TicketNumber) : AggregateRoot<TicketNumber>() {
    lateinit var passenger: Passenger
        private set
    var pnr: String? = null
        private set

    // inline value class'larda lateinit yasak → nullable backing + non-null getter.
    private var validatingCarrierValue: CarrierCode? = null
    val validatingCarrier: CarrierCode get() = validatingCarrierValue ?: error("Ticket henüz issue edilmedi")
    private val mutableCoupons = mutableListOf<Coupon>()
    val coupons: List<Coupon> get() = mutableCoupons.toList()
    private var fareTotalValue: Money? = null
    val fareTotal: Money get() = fareTotalValue ?: error("Ticket henüz issue edilmedi")

    /** F4 — Ch 2 girdileri (fare breakdown, FOP, FOID, tour code, endorsement). */
    var entries: TicketEntries? = null
        private set

    /** Exchange linkage (Ch 12): bu bilet eski bir biletin yerine kesildiyse onun numarası. */
    var issuedInExchangeFor: String? = null
        private set

    /** Exchange linkage (Ch 12): bu biletin açık kuponları hangi yeni bilete devredildi. */
    var exchangedTo: String? = null
        private set

    // ----- Komutlar (invariant kontrolü → event) -----

    /** Void (Handbook 1.1.9): satış iptali. İnvariant: TÜM kuponlar O olmalı; hepsi V olur. */
    fun void(reason: String?) {
        val notOpen = mutableCoupons.filter { it.status != CouponStatus.OPEN_FOR_USE }
        if (notOpen.isNotEmpty()) {
            val detail = notOpen.joinToString { "${it.seq}:${it.status.code}" }
            throw TicketRuleViolationException("Void için TÜM kuponlar O (Open) olmalı; uygun olmayan: $detail")
        }
        raise(TicketVoided(id.value, reason))
    }

    /** Refund (Handbook Ch 15): seçili açık kuponlar R olur. İnvariant: her seçili kupon O olmalı. */
    fun refund(couponSeqs: List<Int>, refundAmount: Money, waiver: String?) {
        refundViolation(couponSeqs)?.let { throw TicketRuleViolationException(it) }
        raise(CouponsRefunded(id.value, couponSeqs.distinct().sorted(), refundAmount.amount.toPlainString(), refundAmount.currency.currencyCode, waiver))
    }

    private fun refundViolation(couponSeqs: List<Int>): String? {
        val bySeq = mutableCoupons.associateBy { it.seq }
        val couponIssue = couponSeqs.firstNotNullOfOrNull { seq ->
            val c = bySeq[seq]
            when {
                c == null -> "Kupon $seq bu bilette yok."
                c.status != CouponStatus.OPEN_FOR_USE -> "Kupon $seq iade edilemez — statü ${c.status.code} (O olmalı, Ch 15)."
                else -> null
            }
        }
        return if (couponSeqs.isEmpty()) "İade için en az bir kupon seçilmeli." else couponIssue
    }

    /**
     * Exchange (Handbook Ch 12): TÜM açık (O) kuponlar E olur; yeni bilet ayrı issue edilir.
     * Dönen liste = değiştirilen kupon seq'leri. İnvariant: en az bir açık kupon.
     */
    fun exchange(newTicketNumber: TicketNumber): List<Int> {
        val openSeqs = mutableCoupons.filter { it.status == CouponStatus.OPEN_FOR_USE }.map { it.seq }
        if (openSeqs.isEmpty()) throw TicketRuleViolationException("Exchange için açık (O) kupon yok (Ch 12).")
        raise(CouponsExchanged(id.value, openSeqs, newTicketNumber.value))
        return openSeqs
    }

    // ----- Event uygulama (state mutasyonu YALNIZCA burada) -----

    override fun apply(event: DomainEvent) {
        when (event) {
            is TicketIssued -> applyIssued(event)
            is TicketVoided -> applyVoided()
            is CouponsRefunded -> applyRefunded(event)
            is CouponsExchanged -> applyExchanged(event)
            else -> error("Ticket bilinmeyen event uygulayamaz: ${event::class.simpleName}")
        }
    }

    private fun applyIssued(event: TicketIssued) {
        passenger = Passenger(event.surname, event.givenName, event.title)
        pnr = event.pnr
        validatingCarrierValue = CarrierCode(event.validatingCarrier)
        entries = event.entries
        issuedInExchangeFor = event.issuedInExchangeFor
        mutableCoupons.clear()
        event.coupons.forEachIndexed { i, c ->
            mutableCoupons.add(
                Coupon(i + 1, CouponStatus.OPEN_FOR_USE, c.origin, c.destination, c.marketingCarrier, c.flightNumber, c.rbd, c.fareBasis, c.departure),
            )
        }
        fareTotalValue = Money.of(BigDecimal(event.fareAmount), event.fareCurrency)
    }

    private fun applyVoided() {
        replaceCoupons { it.copy(status = it.status.transitionTo(CouponStatus.VOID)) }
    }

    private fun applyRefunded(event: CouponsRefunded) {
        val seqs = event.couponSeqs.toSet()
        replaceCoupons { if (it.seq in seqs) it.copy(status = it.status.transitionTo(CouponStatus.REFUNDED)) else it }
    }

    private fun applyExchanged(event: CouponsExchanged) {
        val seqs = event.couponSeqs.toSet()
        replaceCoupons { if (it.seq in seqs) it.copy(status = it.status.transitionTo(CouponStatus.EXCHANGED)) else it }
        exchangedTo = event.newTicketNumber
    }

    private fun replaceCoupons(transform: (Coupon) -> Coupon) {
        val updated = mutableCoupons.map(transform)
        mutableCoupons.clear()
        mutableCoupons.addAll(updated)
    }

    companion object {
        /** Komut tarafı: yeni bilet kes (TicketIssued event üretir). Exchange kaynaklıysa linkage taşır. */
        fun issue(
            ticketNumber: TicketNumber,
            passenger: Passenger,
            validatingCarrier: CarrierCode,
            pnr: String?,
            coupons: List<IssuedCoupon>,
            fareTotal: Money,
            entries: TicketEntries? = null,
            issuedInExchangeFor: String? = null,
        ): Ticket {
            require(coupons.isNotEmpty()) { "Bilet için en az bir kupon olmalı (Ch 2)." }
            validateFare(entries?.fare, fareTotal)
            val ticket = Ticket(ticketNumber)
            ticket.raise(
                TicketIssued(
                    ticketNumber = ticketNumber.value,
                    surname = passenger.surname,
                    givenName = passenger.givenName,
                    title = passenger.title,
                    validatingCarrier = validatingCarrier.value,
                    pnr = pnr,
                    coupons = coupons,
                    fareAmount = fareTotal.amount.toPlainString(),
                    fareCurrency = fareTotal.currency.currencyCode,
                    entries = entries,
                    issuedInExchangeFor = issuedInExchangeFor,
                ),
            )
            return ticket
        }

        /** F4 iç tutarlılık (2.10–2.12): breakdown verildiyse base + ΣTFC == total ve para birimleri aynı. */
        private fun validateFare(fare: FareDetails?, fareTotal: Money) {
            if (fare == null) return
            val cur = fareTotal.currency.currencyCode
            val sameCurrency = fare.baseFareCurrency == cur && fare.tfcs.all { it.currency == cur }
            if (!sameCurrency) {
                throw TicketRuleViolationException("Fare breakdown para birimi total ile aynı olmalı ($cur).")
            }
            val computed = fare.baseAsDecimal() + fare.tfcTotal()
            if (computed.compareTo(fareTotal.amount) != 0) {
                throw TicketRuleViolationException(
                    "Fare tutarsız: base(${fare.baseFareAmount}) + ΣTFC(${fare.tfcTotal().toPlainString()}) != total(${fareTotal.amount.toPlainString()}).",
                )
            }
        }

        /** Sorgu/komut tarafı: event geçmişinden rehydrate. */
        fun rehydrate(id: TicketNumber, history: List<DomainEvent>): Ticket {
            val ticket = Ticket(id)
            ticket.replay(history)
            return ticket
        }
    }
}
