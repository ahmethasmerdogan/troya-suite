// application — use-case orchestration; komut/sorgu handler'ları; saga (Faz 3+).
// domain'e bağlı; framework'e minimum (Spring tx anotasyonları infra'da uygulanır).
dependencies {
    implementation(project(":domain"))
}
