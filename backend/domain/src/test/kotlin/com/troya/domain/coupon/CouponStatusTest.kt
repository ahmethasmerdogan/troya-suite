package com.troya.domain.coupon

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.EnumSource

class CouponStatusTest {
    @Test
    fun `resmî 17 statü tanımlı`() {
        CouponStatus.entries shouldHaveSize 17
    }

    @ParameterizedTest
    @EnumSource(CouponStatus::class, names = ["FLOWN", "EXCHANGED", "EXCHANGED_FIM", "REFUNDED", "VOID", "PRINTED", "PRINT_EXCHANGE", "CLOSED"])
    fun `final statüler terminal - çıkış geçişi yok`(status: CouponStatus) {
        status.isFinal.shouldBeTrue()
        status.allowedTransitions().shouldBeEmpty()
    }

    @ParameterizedTest
    @EnumSource(CouponStatus::class, names = ["FLOWN", "VOID", "REFUNDED", "EXCHANGED"])
    fun `final statüden geçiş exception fırlatır`(finalStatus: CouponStatus) {
        shouldThrow<CouponStatusTransitionException> {
            finalStatus.transitionTo(CouponStatus.OPEN_FOR_USE)
        }
    }

    @Test
    fun `geçerli geçişler - uçuş ilerleyişi O-A-C-L-F`() {
        CouponStatus.OPEN_FOR_USE.canTransitionTo(CouponStatus.AIRPORT_CONTROL).shouldBeTrue()
        CouponStatus.AIRPORT_CONTROL.canTransitionTo(CouponStatus.CHECKED_IN).shouldBeTrue()
        CouponStatus.CHECKED_IN.canTransitionTo(CouponStatus.LIFTED).shouldBeTrue()
        CouponStatus.LIFTED.canTransitionTo(CouponStatus.FLOWN).shouldBeTrue()
    }

    @Test
    fun `geçerli geçişler - void exchange refund O'dan`() {
        CouponStatus.OPEN_FOR_USE.transitionTo(CouponStatus.VOID) shouldBe CouponStatus.VOID
        CouponStatus.OPEN_FOR_USE.transitionTo(CouponStatus.EXCHANGED) shouldBe CouponStatus.EXCHANGED
        CouponStatus.OPEN_FOR_USE.transitionTo(CouponStatus.REFUNDED) shouldBe CouponStatus.REFUNDED
    }

    @Test
    fun `geçersiz geçişler reddedilir`() {
        CouponStatus.OPEN_FOR_USE.canTransitionTo(CouponStatus.LIFTED).shouldBeFalse() // atlama yok
        CouponStatus.LIFTED.canTransitionTo(CouponStatus.CHECKED_IN).shouldBeFalse() // geri gidiş yok
        CouponStatus.AIRPORT_CONTROL.canTransitionTo(CouponStatus.PRINTED).shouldBeFalse() // print yalnız O'dan (1.3.3)
        CouponStatus.SUSPENDED.canTransitionTo(CouponStatus.REFUNDED).shouldBeFalse() // iade uygunluğu O/A/Y (1.3.5)
    }

    @Test
    fun `iade uygunluğu O-A-Y ve yalnız-TFC (Y) akışı (Handbook 1_3_5)`() {
        CouponStatus.OPEN_FOR_USE.canTransitionTo(CouponStatus.REFUND_TFC).shouldBeTrue()
        CouponStatus.REFUND_TFC.transitionTo(CouponStatus.REFUNDED) shouldBe CouponStatus.REFUNDED
        CouponStatus.AIRPORT_CONTROL.canTransitionTo(CouponStatus.REFUNDED).shouldBeTrue()
    }

    @Test
    fun `fromCode round-trip`() {
        CouponStatus.entries.forEach { CouponStatus.fromCode(it.code) shouldBe it }
    }

    @Test
    fun `allowedTransitions sadece geçerli statü içerir`() {
        CouponStatus.entries.forEach { from ->
            from.allowedTransitions().forEach { to -> CouponStatus.entries.contains(to).shouldBeTrue() }
        }
    }
}
