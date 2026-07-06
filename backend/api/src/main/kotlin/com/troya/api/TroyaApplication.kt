package com.troya.api

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

// F6: @EnableScheduling — OutboxRelay periyodik yayın (kural 6).
@SpringBootApplication(scanBasePackages = ["com.troya"])
@EnableScheduling
class TroyaApplication

fun main(args: Array<String>) {
    runApplication<TroyaApplication>(*args)
}
