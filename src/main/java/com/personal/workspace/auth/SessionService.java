package com.personal.workspace.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

@Service
public class SessionService {

    private static final Duration TTL = Duration.ofMinutes(30);

    private final Map<String, Instant> sessions = new ConcurrentHashMap<>();

    public String create() {
        String token = UUID.randomUUID().toString();
        sessions.put(token, Instant.now().plus(TTL));
        return token;
    }

    public boolean isValid(String token) {
        Instant expiresAt = sessions.get(token);
        if (expiresAt == null) {
            return false;
        }
        if (expiresAt.isBefore(Instant.now())) {
            sessions.remove(token);
            return false;
        }
        return true;
    }

    public void touch(String token) {
        if (isValid(token)) {
            sessions.put(token, Instant.now().plus(TTL));
        }
    }

    public void invalidate(String token) {
        sessions.remove(token);
    }
}
