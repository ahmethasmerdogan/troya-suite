rootProject.name = "troya-eticket"

// Çok-modüllü monorepo — Hexagonal katmanlar (ARCHITECTURE §7).
// Bağımlılık yönü daima dışarıdan içeri: api → application → domain ; infrastructure → domain.
include("domain")
include("application")
include("infrastructure")
include("api")
