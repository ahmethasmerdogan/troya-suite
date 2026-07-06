package com.troya.domain.common

/** IATA Airline Designator — 2 karakter (örn. TK). (GLOSSARY: Marketing/Operating Carrier) */
@JvmInline
value class CarrierCode(val value: String) {
    init {
        require(value.matches(Regex("[A-Z0-9]{2,3}"))) { "Geçersiz carrier kodu: $value" }
    }
}

/** IATA havalimanı/şehir kodu — 3 harf (örn. IST). */
@JvmInline
value class AirportCode(val value: String) {
    init {
        require(value.matches(Regex("[A-Z]{3}"))) { "Geçersiz havalimanı kodu: $value" }
    }
}

/** Fare Basis kodu (Handbook Ch 2.6). */
@JvmInline
value class FareBasis(val value: String) {
    init {
        require(value.isNotBlank()) { "Fare basis boş olamaz" }
    }
}

/**
 * Carrier rolleri (GLOSSARY). Validating = ET kaydının tek otoritesi;
 * control'ü yalnızca Validating Carrier devreder (Concept of Control, ARCHITECTURE §5).
 */
enum class CarrierRole {
    VALIDATING,
    MARKETING,
    OPERATING,
    BILLING,
}
