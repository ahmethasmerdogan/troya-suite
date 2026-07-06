package com.troya.domain.common

import java.math.BigDecimal
import java.util.Currency

/**
 * Para value object (Handbook Ch 11). Tutar + ISO 4217 currency.
 * Equivalent fare / ROE çevrimleri Faz 4'te eklenecek.
 */
@JvmInline
value class Money private constructor(private val packed: Pair<BigDecimal, Currency>) {
    val amount: BigDecimal get() = packed.first
    val currency: Currency get() = packed.second

    operator fun plus(other: Money): Money {
        require(currency == other.currency) { "Farklı para birimleri toplanamaz: $currency vs ${other.currency}" }
        return Money(amount + other.amount to currency)
    }

    operator fun minus(other: Money): Money {
        require(currency == other.currency) { "Farklı para birimleri çıkarılamaz: $currency vs ${other.currency}" }
        return Money(amount - other.amount to currency)
    }

    fun isNegative(): Boolean = amount.signum() < 0

    override fun toString(): String = "${amount.toPlainString()} ${currency.currencyCode}"

    companion object {
        fun of(amount: BigDecimal, currencyCode: String): Money = Money(amount to Currency.getInstance(currencyCode))

        fun of(amount: Long, currencyCode: String): Money = of(BigDecimal.valueOf(amount), currencyCode)
    }
}
