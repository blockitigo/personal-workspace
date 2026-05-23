package com.personal.workspace;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import com.personal.workspace.api.HealthController;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class PersonalWorkspaceApplicationTests {

    @Test
    void contextLoads() {
    }

    @Test
    void healthEndpointReturnsOk() {
        Map<String, Object> response = new HealthController().health();

        assertThat(response).containsEntry("status", "ok");
        assertThat(response).containsEntry("service", "personal-workspace");
        assertThat(response).containsKey("time");
    }
}
