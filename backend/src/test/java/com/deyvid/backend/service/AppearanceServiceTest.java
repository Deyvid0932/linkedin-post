package com.deyvid.backend.service;

import com.deyvid.backend.entity.PlatformAppearanceSettings;
import com.deyvid.backend.entity.Role;
import com.deyvid.backend.entity.User;
import com.deyvid.backend.repository.PlatformAppearanceSettingsRepository;
import com.deyvid.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AppearanceServiceTest {
    private PlatformAppearanceSettings platformSettings = settings("red,blue,green,yellow", "red");
    private PlatformAppearanceSettings savedPlatformSettings;
    private User currentUser;
    private User savedUser;
    private final PlatformAppearanceSettingsRepository settingsRepository = repositoryProxy(
            PlatformAppearanceSettingsRepository.class,
            (method, args) -> switch (method) {
                case "findById" -> Optional.ofNullable(platformSettings);
                case "save" -> {
                    savedPlatformSettings = (PlatformAppearanceSettings) args[0];
                    platformSettings = savedPlatformSettings;
                    yield savedPlatformSettings;
                }
                default -> throw new UnsupportedOperationException(method);
            });
    private final UserRepository userRepository = repositoryProxy(
            UserRepository.class,
            (method, args) -> switch (method) {
                case "findById" -> Optional.ofNullable(currentUser != null && currentUser.getId().equals(args[0]) ? currentUser : null);
                case "save" -> {
                    savedUser = (User) args[0];
                    currentUser = savedUser;
                    yield savedUser;
                }
                default -> throw new UnsupportedOperationException(method);
            });
    private final AppearanceService service = new AppearanceService(settingsRepository, userRepository);

    @Test
    void requiresPlatformDefaultToBeEnabled() {
        assertThrows(IllegalArgumentException.class,
                () -> service.updatePolicy("yellow", List.of("red", "blue")));
    }

    @Test
    void rejectsAnEmptyPalette() {
        assertThrows(IllegalArgumentException.class,
                () -> service.updatePolicy("red", List.of()));
    }

    @Test
    void savesAnAccentEnabledByTheAdministratorForTheCurrentUser() {
        User user = User.builder().id(UUID.randomUUID()).accentColor("red").roles(Set.of()).build();
        currentUser = user;

        var response = service.updateUserAccent(user.getId(), "blue");

        assertEquals("blue", user.getAccentColor());
        assertEquals("blue", response.userAccentColor());
        assertEquals(user, savedUser);
    }

    @Test
    void refusesAnAccentDisabledByTheAdministratorWithoutChangingTheUser() {
        User user = User.builder().id(UUID.randomUUID()).accentColor("red").roles(Set.of()).build();
        currentUser = user;
        platformSettings = settings("red,yellow", "red");

        assertThrows(IllegalArgumentException.class, () -> service.updateUserAccent(user.getId(), "blue"));

        assertEquals("red", user.getAccentColor());
        assertNull(savedUser);
    }

    @Test
    void fallsBackToPlatformDefaultWhenStoredUserAccentIsNoLongerAllowed() {
        User user = User.builder()
                .accentColor("blue")
                .roles(Set.of(Role.builder().name("ROLE_ADMIN").build()))
                .build();
        platformSettings = settings("red,yellow", "yellow");

        var response = service.getSettings(user);

        assertEquals("yellow", response.userAccentColor());
        assertEquals("yellow", response.defaultAccentColor());
        assertEquals(List.of("red", "yellow"), response.allowedAccentColors());
        assertEquals(true, response.administrator());
    }

    @Test
    void persistsOnlyTheSelectedPlatformPaletteAndDefault() {
        platformSettings = settings("red,blue,green,yellow", "red");

        service.updatePolicy("green", List.of("green", "blue", "green"));

        assertEquals("green", platformSettings.getDefaultAccentColor());
        assertEquals("green,blue", platformSettings.getAllowedAccentColors());
        assertEquals(platformSettings, savedPlatformSettings);
    }

    private static PlatformAppearanceSettings settings(String allowed, String defaultColor) {
        return PlatformAppearanceSettings.builder()
                .id((short) 1)
                .allowedAccentColors(allowed)
                .defaultAccentColor(defaultColor)
                .build();
    }

    private interface RepositoryCall {
        Object invoke(String method, Object[] args);
    }

    @SuppressWarnings("unchecked")
    private static <T> T repositoryProxy(Class<T> repositoryType, RepositoryCall call) {
        return (T) Proxy.newProxyInstance(repositoryType.getClassLoader(), new Class<?>[] { repositoryType },
                (proxy, method, args) -> {
                    if (method.getDeclaringClass() == Object.class) {
                        return switch (method.getName()) {
                            case "toString" -> repositoryType.getSimpleName() + " test proxy";
                            case "hashCode" -> System.identityHashCode(proxy);
                            case "equals" -> proxy == args[0];
                            default -> null;
                        };
                    }
                    return call.invoke(method.getName(), args == null ? new Object[0] : args);
                });
    }
}
