package com.troya.application.port

import com.troya.domain.common.AggregateRoot

/**
 * Event-sourced repository portu. Komut tarafı: aggregate'i event'lerden rehydrate eder,
 * komut işler, yeni event'leri store'a append eder (CQRS yazma yolu — ARCHITECTURE §3).
 * Sorgu için read model kullanılır; burada DEĞİL.
 */
interface Repository<A : AggregateRoot<ID>, ID> {
    fun load(id: ID): A?
    fun save(aggregate: A)
}

/** İdempotency portu — para/statü değiştiren komutlar için (ARCHITECTURE §6). */
interface IdempotencyStore {
    /** Bu key daha önce işlendiyse sonucun referansını (örn. bilet no) döndürür; yoksa null. */
    fun recall(key: String): String?

    /** key → sonuç referansını kaydet (tekrar = aynı sonuç). */
    fun remember(key: String, resultRef: String)
}
