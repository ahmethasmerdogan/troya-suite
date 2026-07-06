package com.troya.api

import com.troya.application.port.OptimisticConcurrencyException
import com.troya.application.ticket.TicketNotFoundException
import com.troya.domain.coupon.CouponStatusTransitionException
import com.troya.domain.ticket.TicketRuleViolationException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

/**
 * Domain/uygulama hataları → HTTP eşlemesi (contracts/openapi.yaml yanıt kodları):
 * bulunamadı → 404 · iş kuralı/FSM ihlali → 422 · eşzamanlı yazım çakışması → 409.
 * Hata gövdesi: { "error": mesaj } — frontend alan-bazlı gösterir.
 */
@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(TicketNotFoundException::class)
    fun notFound(e: TicketNotFoundException): ResponseEntity<Map<String, String?>> = ResponseEntity.status(HttpStatus.NOT_FOUND).body(mapOf("error" to e.message))

    @ExceptionHandler(TicketRuleViolationException::class, CouponStatusTransitionException::class, IllegalArgumentException::class)
    fun ruleViolation(e: RuntimeException): ResponseEntity<Map<String, String?>> = ResponseEntity.unprocessableEntity().body(mapOf("error" to e.message))

    @ExceptionHandler(OptimisticConcurrencyException::class)
    fun conflict(e: OptimisticConcurrencyException): ResponseEntity<Map<String, String?>> = ResponseEntity.status(HttpStatus.CONFLICT).body(mapOf("error" to e.message))
}
