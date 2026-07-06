package com.troya.domain.emd

import com.troya.domain.common.AggregateRoot
import com.troya.domain.common.CarrierCode
import com.troya.domain.common.DomainEvent
import com.troya.domain.common.Money
import com.troya.domain.coupon.CouponStatus
import com.troya.domain.ticket.TicketNumber
import com.troya.domain.ticket.TicketRuleViolationException
import java.math.BigDecimal

/** EMD tipi (Handbook Ch 5): A = associated (ET kuponuna bağlı) · S = standalone. */
enum class EmdType { A, S }

/**
 * EMD aggregate (F5, Handbook Ch 5) — event-sourced, Ticket ile aynı event store.
 * Doküman numarası ET ile aynı 13-hane mod-7 formatı (TicketNumber yeniden kullanılır).
 * Bu prototipte EMD tek kuponludur (Ch 5 en çok 4'e izin verir — ileri faz);
 * kupon statüsü ET ile AYNI resmî kod kümesini/FSM'i kullanır (Ch 5.4).
 *
 * İnvariant'lar:
 *  (1) EMD-A mutlaka bir ET + kupon seq'ine bağlıdır ("in connection with");
 *      EMD-S'te bağ opsiyoneldir.
 *  (2) RFISC zorunludur (Ch 5.5 reason for issuance sub code).
 *  (3) Statü geçişleri CouponStatus FSM'inden geçer; final terminal.
 */
class Emd private constructor(override val id: TicketNumber) : AggregateRoot<TicketNumber>() {
    var type: EmdType = EmdType.S
        private set
    var rfisc: String = ""
        private set
    var description: String? = null
        private set
    var passengerName: String = ""
        private set

    private var carrierValue: CarrierCode? = null
    val validatingCarrier: CarrierCode get() = carrierValue ?: error("EMD henüz issue edilmedi")

    var associatedTicket: String? = null
        private set
    var associatedCouponSeq: Int? = null
        private set

    private var amountValue: Money? = null
    val amount: Money get() = amountValue ?: error("EMD henüz issue edilmedi")

    var status: CouponStatus = CouponStatus.OPEN_FOR_USE
        private set

    // ----- Komutlar -----

    /** İade (Ch 5 / Ch 15): O→R. */
    fun refund() {
        ensureOpen("refund")
        raise(EmdRefunded(id.value))
    }

    /** Void: O→V. */
    fun void(reason: String?) {
        ensureOpen("void")
        raise(EmdVoided(id.value, reason))
    }

    private fun ensureOpen(op: String) {
        if (status != CouponStatus.OPEN_FOR_USE) {
            throw TicketRuleViolationException("EMD $op için statü O olmalı — mevcut: ${status.code}.")
        }
    }

    // ----- Event uygulama -----

    override fun apply(event: DomainEvent) {
        when (event) {
            is EmdIssued -> applyIssued(event)
            is EmdRefunded -> status = status.transitionTo(CouponStatus.REFUNDED)
            is EmdVoided -> status = status.transitionTo(CouponStatus.VOID)
            else -> error("Emd bilinmeyen event uygulayamaz: ${event::class.simpleName}")
        }
    }

    private fun applyIssued(event: EmdIssued) {
        type = EmdType.valueOf(event.emdType)
        rfisc = event.rfisc
        description = event.description
        passengerName = event.passengerName
        carrierValue = CarrierCode(event.validatingCarrier)
        associatedTicket = event.associatedTicket
        associatedCouponSeq = event.associatedCouponSeq
        amountValue = Money.of(BigDecimal(event.amount), event.currency)
        status = CouponStatus.OPEN_FOR_USE
    }

    companion object {
        /** Komut tarafı: EMD kes (EmdIssued üretir). İnvariant'lar burada zorlanır. */
        fun issue(command: IssueEmdSpec): Emd {
            if (command.rfisc.isBlank()) throw TicketRuleViolationException("RFISC zorunludur (Ch 5.5).")
            if (command.type == EmdType.A && (command.associatedTicket == null || command.associatedCouponSeq == null)) {
                throw TicketRuleViolationException("EMD-A bir ET + kupon seq'ine bağlı olmalıdır (Ch 5).")
            }
            val emd = Emd(command.number)
            emd.raise(
                EmdIssued(
                    emdNumber = command.number.value,
                    emdType = command.type.name,
                    rfisc = command.rfisc.uppercase(),
                    description = command.description,
                    passengerName = command.passengerName,
                    validatingCarrier = command.validatingCarrier.value,
                    associatedTicket = command.associatedTicket,
                    associatedCouponSeq = command.associatedCouponSeq,
                    amount = command.amount.amount.toPlainString(),
                    currency = command.amount.currency.currencyCode,
                ),
            )
            return emd
        }

        fun rehydrate(id: TicketNumber, history: List<DomainEvent>): Emd {
            val emd = Emd(id)
            emd.replay(history)
            return emd
        }
    }
}

/** Issue parametre paketi (LongParameterList'ten kaçınmak + okunabilirlik). */
data class IssueEmdSpec(
    val number: TicketNumber,
    val type: EmdType,
    val rfisc: String,
    val description: String?,
    val passengerName: String,
    val validatingCarrier: CarrierCode,
    val associatedTicket: String?,
    val associatedCouponSeq: Int?,
    val amount: Money,
)
