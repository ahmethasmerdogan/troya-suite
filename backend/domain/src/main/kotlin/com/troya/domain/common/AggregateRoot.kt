package com.troya.domain.common

/**
 * Aggregate root — state event'lerden türetilir (rehydrate/replay).
 * Komut → invariant kontrolü → event(ler) üret; state'i event uygulayarak güncelle.
 * Faz 1: Ticket aggregate bunu extend eder.
 */
abstract class AggregateRoot<ID> {
    abstract val id: ID

    var version: Long = 0
        private set

    private val _uncommittedEvents = mutableListOf<DomainEvent>()
    val uncommittedEvents: List<DomainEvent> get() = _uncommittedEvents.toList()

    /** Yeni event'i kaydet + uygula (komut tarafı). */
    protected fun raise(event: DomainEvent) {
        apply(event)
        _uncommittedEvents.add(event)
    }

    /** Event store'dan replay (yeni event üretmeden state kur). */
    fun replay(history: Iterable<DomainEvent>) {
        history.forEach {
            apply(it)
            version++
        }
    }

    fun markCommitted() {
        version += _uncommittedEvents.size
        _uncommittedEvents.clear()
    }

    /** Event'i state'e uygula. Alt sınıf when(event) ile ele alır. */
    protected abstract fun apply(event: DomainEvent)
}
