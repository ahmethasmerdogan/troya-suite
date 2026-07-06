package com.troya.api

import com.troya.application.port.FareQuotePort
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * F4 — fare quote (pricing engine PORT gösterimi; kapsam dışı sistem, adapter mock).
 * Dönen breakdown, POST /tickets `entries.fare` alanına aynen konabilir
 * (base + ΣTFC == total invariant'ı ile uyumlu üretilir).
 */
@RestController
@RequestMapping("/fares")
class FareController(private val fareQuote: FareQuotePort) {
    @GetMapping("/quote")
    fun quote(@RequestParam origin: String, @RequestParam destination: String, @RequestParam(defaultValue = "Y") rbd: String) = fareQuote.quote(origin, destination, rbd)
}
