package com.troya.domain.ticket

import com.troya.domain.common.CarrierCode
import com.troya.domain.common.Money
import com.troya.domain.coupon.CouponStatus
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test

class TicketTest {
    private val tn = TicketNumber.build("235", "700000001")
    private val tn2 = TicketNumber.build("235", "700000002")
    private val coupon = IssuedCoupon("IST", "AMS", "TK", "TK1951", "Y", "YRT", "2026-07-01T08:00:00Z")
    private val coupon2 = IssuedCoupon("AMS", "IST", "TK", "TK1952", "Y", "YRT", "2026-07-10T11:00:00Z")

    private fun issued(vararg coupons: IssuedCoupon = arrayOf(coupon, coupon2)): Ticket =
        Ticket.issue(tn, Passenger("TEST", "USER", "MR"), CarrierCode("TK"), "ABC123", coupons.toList(), Money.of(12000, "TRY"))

    @Test
    fun `issue tüm kuponları O başlatır ve TicketIssued event üretir`() {
        val t = Ticket.issue(tn, Passenger("TEST", "USER", "MR"), CarrierCode("TK"), "ABC123", listOf(coupon), Money.of(12000, "TRY"))
        t.coupons shouldHaveSize 1
        t.coupons.all { it.status == CouponStatus.OPEN_FOR_USE }.shouldBeTrue()
        t.uncommittedEvents.filterIsInstance<TicketIssued>() shouldHaveSize 1
        t.passenger.surname shouldBe "TEST"
        t.fareTotal.currency.currencyCode shouldBe "TRY"
    }

    @Test
    fun `kuponsuz bilet kesilemez`() {
        shouldThrow<IllegalArgumentException> {
            Ticket.issue(tn, Passenger("A", "B", null), CarrierCode("TK"), null, emptyList(), Money.of(1, "TRY"))
        }
    }

    @Test
    fun `event geçmişinden rehydrate state'i kurar`() {
        val issued = TicketIssued(tn.value, "YILMAZ", "ELIF", "MS", "TK", "PNR1", listOf(coupon), "12000", "TRY")
        val t = Ticket.rehydrate(tn, listOf(issued))
        t.passenger.surname shouldBe "YILMAZ"
        t.coupons shouldHaveSize 1
        t.coupons[0].status shouldBe CouponStatus.OPEN_FOR_USE
        t.version shouldBe 1L
    }

    // ----- F3: Void (Handbook 1.1.9) -----

    @Test
    fun `void tüm kuponları V yapar ve TicketVoided üretir`() {
        val t = issued()
        t.void("müşteri istedi")
        t.coupons.all { it.status == CouponStatus.VOID }.shouldBeTrue()
        t.uncommittedEvents.filterIsInstance<TicketVoided>() shouldHaveSize 1
    }

    @Test
    fun `void invariant - herhangi bir kupon O değilse reddedilir`() {
        val t = issued()
        t.refund(listOf(1), Money.of(5000, "TRY"), null) // 1 numaralı kupon artık R
        shouldThrow<TicketRuleViolationException> { t.void(null) }
    }

    @Test
    fun `void edilen bilet tekrar void edilemez (final terminal)`() {
        val t = issued()
        t.void(null)
        shouldThrow<TicketRuleViolationException> { t.void(null) }
    }

    // ----- F3: Refund (Handbook Ch 15) -----

    @Test
    fun `refund seçili kuponları R yapar, diğerleri O kalır`() {
        val t = issued()
        t.refund(listOf(2), Money.of(4000, "TRY"), "illness")
        t.coupons.first { it.seq == 2 }.status shouldBe CouponStatus.REFUNDED
        t.coupons.first { it.seq == 1 }.status shouldBe CouponStatus.OPEN_FOR_USE
        val e = t.uncommittedEvents.filterIsInstance<CouponsRefunded>().single()
        e.couponSeqs shouldBe listOf(2)
        e.waiver shouldBe "illness"
    }

    @Test
    fun `refund invariant - O olmayan kupon iade edilemez`() {
        val t = issued()
        t.refund(listOf(1), Money.of(4000, "TRY"), null)
        shouldThrow<TicketRuleViolationException> { t.refund(listOf(1), Money.of(4000, "TRY"), null) }
    }

    @Test
    fun `refund invariant - bilette olmayan kupon ve boş seçim reddedilir`() {
        val t = issued()
        shouldThrow<TicketRuleViolationException> { t.refund(listOf(9), Money.of(1, "TRY"), null) }
        shouldThrow<TicketRuleViolationException> { t.refund(emptyList(), Money.of(1, "TRY"), null) }
    }

    // ----- F3: Exchange (Handbook Ch 12) -----

    @Test
    fun `exchange açık kuponları E yapar ve yeni bilet linkage'ı kurar`() {
        val t = issued()
        val seqs = t.exchange(tn2)
        seqs shouldBe listOf(1, 2)
        t.coupons.all { it.status == CouponStatus.EXCHANGED }.shouldBeTrue()
        t.exchangedTo shouldBe tn2.value
        t.uncommittedEvents.filterIsInstance<CouponsExchanged>().single().newTicketNumber shouldBe tn2.value
    }

    @Test
    fun `exchange yalnızca açık kuponları değiştirir - R kupon dokunulmaz`() {
        val t = issued()
        t.refund(listOf(1), Money.of(4000, "TRY"), null)
        t.exchange(tn2) shouldBe listOf(2)
        t.coupons.first { it.seq == 1 }.status shouldBe CouponStatus.REFUNDED
        t.coupons.first { it.seq == 2 }.status shouldBe CouponStatus.EXCHANGED
    }

    @Test
    fun `exchange invariant - açık kupon yoksa reddedilir`() {
        val t = issued()
        t.void(null)
        shouldThrow<TicketRuleViolationException> { t.exchange(tn2) }
    }

    @Test
    fun `exchange kaynaklı issue linkage taşır (Issued in Exchange For)`() {
        val newTicket = Ticket.issue(
            tn2,
            Passenger("TEST", "USER", "MR"),
            CarrierCode("TK"),
            "ABC123",
            listOf(coupon),
            Money.of(15000, "TRY"),
            issuedInExchangeFor = tn.value,
        )
        newTicket.issuedInExchangeFor shouldBe tn.value
        newTicket.uncommittedEvents.filterIsInstance<TicketIssued>().single().issuedInExchangeFor shouldBe tn.value
    }

    // ----- F4: Fare tutarlılığı (2.10–2.12) + Ch 2 girdileri -----

    @Test
    fun `fare breakdown tutarlıysa issue kabul edilir ve entries state'e yazılır`() {
        val entries = TicketEntries(
            fare = FareDetails("10000", "TRY", tfcs = listOf(TaxFeeCharge("YQ", "1500", "TRY"), TaxFeeCharge("TR", "500", "TRY"))),
            formOfPayment = FormOfPayment("CASH"),
            foid = "NI12345678901",
            tourCode = "IT6TK2AB",
            endorsement = "NONREF/NOCHG",
        )
        val t = Ticket.issue(tn, Passenger("TEST", "USER", "MR"), CarrierCode("TK"), "ABC123", listOf(coupon), Money.of(12000, "TRY"), entries)
        t.entries?.fare?.baseFareAmount shouldBe "10000"
        t.entries?.formOfPayment?.type shouldBe "CASH"
        t.entries?.tourCode shouldBe "IT6TK2AB"
    }

    @Test
    fun `fare breakdown tutarsızsa issue reddedilir (base + TFC != total)`() {
        val entries = TicketEntries(fare = FareDetails("10000", "TRY", tfcs = listOf(TaxFeeCharge("YQ", "1000", "TRY"))))
        shouldThrow<TicketRuleViolationException> {
            Ticket.issue(tn, Passenger("A", "B", null), CarrierCode("TK"), null, listOf(coupon), Money.of(12000, "TRY"), entries)
        }
    }

    @Test
    fun `fare breakdown farklı para biriminde reddedilir`() {
        val entries = TicketEntries(fare = FareDetails("12000", "USD"))
        shouldThrow<TicketRuleViolationException> {
            Ticket.issue(tn, Passenger("A", "B", null), CarrierCode("TK"), null, listOf(coupon), Money.of(12000, "TRY"), entries)
        }
    }

    @Test
    fun `entries rehydrate ile korunur`() {
        val entries = TicketEntries(fare = FareDetails("12000", "TRY"), formOfPayment = FormOfPayment("CREDIT", "VI****1881"))
        val t = Ticket.issue(tn, Passenger("TEST", "USER", "MR"), CarrierCode("TK"), null, listOf(coupon), Money.of(12000, "TRY"), entries)
        val replayed = Ticket.rehydrate(tn, t.uncommittedEvents)
        replayed.entries?.formOfPayment?.detail shouldBe "VI****1881"
    }

    // ----- F3: rehydrate — komut geçmişi replay ile aynı state'i verir -----

    @Test
    fun `issue+refund+exchange event geçmişi rehydrate ile aynı state'i kurar`() {
        val t = issued()
        t.refund(listOf(1), Money.of(4000, "TRY"), null)
        t.exchange(tn2)

        val replayed = Ticket.rehydrate(tn, t.uncommittedEvents)
        replayed.coupons.first { it.seq == 1 }.status shouldBe CouponStatus.REFUNDED
        replayed.coupons.first { it.seq == 2 }.status shouldBe CouponStatus.EXCHANGED
        replayed.exchangedTo shouldBe tn2.value
        replayed.version shouldBe 3L
    }
}
