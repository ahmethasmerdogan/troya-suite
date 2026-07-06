package com.troya.domain.ticket

/**
 * Ticket number — 3 haneli airline kodu + 9 serial + mod-7 check digit = 13 hane (ROADMAP Faz 1).
 * Check digit = ilk 12 hanenin tam sayı olarak mod 7'si.
 */
@JvmInline
value class TicketNumber(val value: String) {
    init {
        require(value.matches(Regex("\\d{13}"))) { "Ticket number 13 hane olmalı: $value" }
        require(checkDigit(value.substring(0, 12)) == value[12].digitToInt()) {
            "Geçersiz check digit: $value"
        }
    }

    val airlinePrefix: String get() = value.substring(0, 3)
    val serial: String get() = value.substring(3, 12)

    companion object {
        /** 12 haneyi mod 7'ye indirger (büyük sayı için parça parça). */
        fun checkDigit(twelveDigits: String): Int {
            require(twelveDigits.matches(Regex("\\d{12}"))) { "12 hane bekleniyor" }
            var remainder = 0
            for (ch in twelveDigits) {
                remainder = (remainder * 10 + ch.digitToInt()) % 7
            }
            return remainder
        }

        fun build(airlinePrefix: String, serial: String): TicketNumber {
            val twelve = (airlinePrefix + serial.padStart(9, '0')).take(12)
            return TicketNumber(twelve + checkDigit(twelve).toString())
        }
    }
}
