package com.deyvid.backend.controller;

import com.deyvid.backend.dto.request.RevokeSessionsRequest;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.repository.UserRepository;
import com.deyvid.backend.security.AuthHelper;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.lang.reflect.Proxy;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class UserControllerSecurityTest {

    private static final String HASH = "encoded-current-password";

    @Test
    void revokesEveryPreviouslyIssuedSessionAfterCheckingCurrentPassword() {
        User user = user(4, HASH);
        AtomicInteger revocations = new AtomicInteger();
        UserController controller = controller(user, revocations);

        var response = controller.revokeSessions(null, new RevokeSessionsRequest("current-password"));

        assertEquals(5, user.getTokenVersion());
        assertEquals(200, response.getStatusCode().value());
        assertEquals(1, revocations.get());
    }

    @Test
    void rejectsWrongPasswordAndDoesNotChangeTheSessionVersion() {
        User user = user(4, HASH);
        AtomicInteger revocations = new AtomicInteger();

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> controller(user, revocations)
                .revokeSessions(null, new RevokeSessionsRequest("wrong-password")));

        assertEquals(HttpStatus.UNAUTHORIZED, exception.getStatusCode());
        assertEquals(4, user.getTokenVersion());
        assertEquals(0, revocations.get());
    }

    @Test
    void rejectsAccountsWithoutALocalPasswordInsteadOfClaimingSessionsWereRevoked() {
        User user = user(2, null);
        AtomicInteger revocations = new AtomicInteger();

        ResponseStatusException exception = assertThrows(ResponseStatusException.class, () -> controller(user, revocations)
                .revokeSessions(null, new RevokeSessionsRequest("any-password")));

        assertEquals(HttpStatus.UNAUTHORIZED, exception.getStatusCode());
        assertEquals(2, user.getTokenVersion());
        assertEquals(0, revocations.get());
    }

    private static User user(long tokenVersion, String passwordHash) {
        return User.builder()
                .id(UUID.randomUUID())
                .email("person@example.test")
                .passwordHash(passwordHash)
                .tokenVersion(tokenVersion)
                .build();
    }

    private static UserController controller(User user, AtomicInteger revocations) {
        UserRepository repository = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(),
                new Class<?>[] { UserRepository.class },
                (proxy, method, args) -> {
                    if ("incrementTokenVersionIfActive".equals(method.getName())) {
                        revocations.incrementAndGet();
                        user.setTokenVersion(user.getTokenVersion() + 1);
                        return 1;
                    }
                    if (method.getReturnType() == boolean.class) return false;
                    if (method.getReturnType() == long.class) return 0L;
                    if (method.getReturnType() == int.class) return 0;
                    return null;
                });
        AuthHelper authHelper = new AuthHelper(repository) {
            @Override
            public User getCurrentUser(Authentication authentication) {
                return user;
            }
        };
        PasswordEncoder passwordEncoder = new PasswordEncoder() {
            @Override
            public String encode(CharSequence rawPassword) {
                return "encoded-" + rawPassword;
            }

            @Override
            public boolean matches(CharSequence rawPassword, String encodedPassword) {
                return encodedPassword != null && Objects.equals(HASH, encodedPassword)
                        && Objects.equals("current-password", rawPassword.toString());
            }

            @Override
            public boolean upgradeEncoding(String encodedPassword) {
                return false;
            }
        };
        return new UserController(authHelper, repository, passwordEncoder, null);
    }
}
