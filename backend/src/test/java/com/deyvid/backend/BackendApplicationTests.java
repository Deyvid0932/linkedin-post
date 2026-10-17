package com.deyvid.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable(named = "RUN_DB_TESTS", matches = "true")
@SpringBootTest(properties = {
        "spring.datasource.url=${TEST_DB_URL}", "spring.datasource.username=${TEST_DB_USERNAME}", "spring.datasource.password=${TEST_DB_PASSWORD}",
        "app.jwt.secret=test-only-jwt-key-with-more-than-32-bytes", "app.security.encryption-key=12345678901234567890123456789012", "app.scheduler.mode=actions"
})
class BackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
