package com.troya.domain.ticket

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test

class TicketNumberTest {
    @Test
    fun `check digit ilk 12 hanenin mod 7'si`() {
        TicketNumber.checkDigit("235123456789") shouldBe (235123456789L % 7L).toInt()
    }

    @Test
    fun `build 13 hane üretir ve doğrulanır`() {
        val tn = TicketNumber.build("235", "123456789")
        tn.value.length shouldBe 13
        tn.airlinePrefix shouldBe "235"
    }

    @Test
    fun `serial 9 haneye pad'lenir`() {
        TicketNumber.build("235", "42").value.substring(0, 12) shouldBe "235000000042"
    }

    @Test
    fun `bozuk check digit reddedilir`() {
        val tn = TicketNumber.build("235", "123456789")
        val wrongLast = ((tn.value.last().digitToInt() + 1) % 10).toString()
        shouldThrow<IllegalArgumentException> {
            TicketNumber(tn.value.substring(0, 12) + wrongLast)
        }
    }

    @Test
    fun `13 hane olmayan reddedilir`() {
        shouldThrow<IllegalArgumentException> { TicketNumber("235") }
    }
}
