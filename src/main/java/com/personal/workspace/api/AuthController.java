package com.personal.workspace.api;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.personal.workspace.auth.SessionService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final String COOKIE_NAME = "pw_session";

    private final SessionService sessions;
    private final String username;
    private final String password;

    public AuthController(
            SessionService sessions,
            @Value("${app.auth.username:admin}") String username,
            @Value("${app.auth.password:admin}") String password) {
        this.sessions = sessions;
        this.username = username;
        this.password = password;
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody LoginRequest request) {
        if (!username.equals(request.getUsername()) || !password.equals(request.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("authenticated", false));
        }

        String token = sessions.create();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, sessionCookie(token, Duration.ofMinutes(30)).toString())
                .body(Map.of("authenticated", true, "username", username));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(@CookieValue(value = COOKIE_NAME, required = false) String token) {
        if (token != null) {
            sessions.invalidate(token);
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, sessionCookie("", Duration.ZERO).toString())
                .body(Map.of("authenticated", false));
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(
            @CookieValue(value = COOKIE_NAME, required = false) String token,
            HttpServletResponse response) {
        if (token == null || !sessions.isValid(token)) {
            return ResponseEntity.ok(Map.of("authenticated", false));
        }

        sessions.touch(token);
        response.addHeader(HttpHeaders.SET_COOKIE, sessionCookie(token, Duration.ofMinutes(30)).toString());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("authenticated", true);
        body.put("username", username);
        return ResponseEntity.ok(body);
    }

    private ResponseCookie sessionCookie(String token, Duration maxAge) {
        return ResponseCookie.from(COOKIE_NAME, token)
                .httpOnly(true)
                .sameSite("Lax")
                .path("/")
                .maxAge(maxAge)
                .build();
    }

    public static class LoginRequest {
        private String username;
        private String password;

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }
    }
}
