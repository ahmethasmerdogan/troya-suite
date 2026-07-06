package com.troya.domain.emd

import com.troya.domain.common.CarrierCode
import com.troya.domain.common.Money
import com.troya.domain.coupon.CouponStatus
import com.troya.domain.ticket.TicketNumber
import com.troya.domain.ticket.TicketRuleViolationException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test

class EmdTest {
    private val en = TicketNumber.build("235", "800000001")
    private fun spec(type: EmdType = EmdType.S, rfisc: String = "0CC", ticket: String? = null, seq: Int? = null) =
        IssueEmdSpec(en, type, rfisc, "Fazla bagaj 10kg", "TEST/USER MR", CarrierCode("TK"), ticket, seq, Money.of(750, "TRY"))

    @Test
    fun `EMD-S issue O başlar ve EmdIssued üretir`() {
        val e = Emd.issue(spec())
        e.status shouldBe CouponStatus.OPEN_FOR_USE
        e.type shouldBe EmdType.S
        e.uncommittedEvents.filterIsInstance<EmdIssued>() shouldHaveSize 1
    }

    @Test
    fun `EMD-A bağ olmadan kesilemez (in connection with zorunlu)`() {
        shouldThrow<TicketRuleViolationException> { Emd.issue(spec(type = EmdType.A)) }
    }

    @Test
    fun `EMD-A ET + kupon seq ile kesilir`() {
        val e = Emd.issue(spec(type = EmdType.A, ticket = "2351234567890", seq = 1))
        e.associatedTicket shouldBe "2351234567890"
        e.associatedCouponSeq shouldBe 1
    }

    @Test
    fun `RFISC boş olamaz`() {
        shouldThrow<TicketRuleViolationException> { Emd.issue(spec(rfisc = " ")) }
    }

    @Test
    fun `refund O'dan R'ye geçirir - tekrar refund reddedilir`() {
        val e = Emd.issue(spec())
        e.refund()
        e.status shouldBe CouponStatus.REFUNDED
        shouldThrow<TicketRuleViolationException> { e.refund() }
    }

    @Test
    fun `void O'dan V'ye geçirir - sonrası işlem reddedilir`() {
        val e = Emd.issue(spec())
        e.void("hatalı kesim")
        e.status shouldBe CouponStatus.VOID
        shouldThrow<TicketRuleViolationException> { e.refund() }
    }

    @Test
    fun `event geçmişinden rehydrate aynı state'i kurar`() {
        val e = Emd.issue(spec(type = EmdType.A, ticket = "2351234567890", seq = 2))
        e.refund()
        val replayed = Emd.rehydrate(en, e.uncommittedEvents)
        replayed.status shouldBe CouponStatus.REFUNDED
        replayed.associatedCouponSeq shouldBe 2
        replayed.version shouldBe 2L
    }
}
