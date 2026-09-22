package com.deyvid.backend.service;

import com.deyvid.backend.entity.SystemNotification;
import com.deyvid.backend.entity.Tenant;
import com.deyvid.backend.repository.SystemNotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final SystemNotificationRepository notificationRepository;

    @Transactional
    public void createNotification(Tenant tenant, String type, String title, String message) {
        try {
            SystemNotification notification = SystemNotification.builder()
                    .tenant(tenant)
                    .type(type)
                    .title(title)
                    .message(message)
                    .isRead(false)
                    .build();
            notificationRepository.save(notification);
            log.info("Notificación generada para Tenant {}: [{}] {}", tenant.getId(), type, title);
        } catch (Exception e) {
            log.error("Error al crear notificación para Tenant {}: {}", tenant.getId(), e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<SystemNotification> getNotificationsByTenant(UUID tenantId) {
        return notificationRepository.findByTenantIdOrderByCreatedAtDesc(tenantId);
    }

    @Transactional
    public void markAsRead(UUID notificationId, UUID tenantId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            if (n.getTenant().getId().equals(tenantId)) {
                n.setIsRead(true);
                notificationRepository.save(n);
            }
        });
    }

    @Transactional
    public void markAllAsRead(UUID tenantId) {
        List<SystemNotification> list = notificationRepository.findByTenantIdAndIsReadFalseOrderByCreatedAtDesc(tenantId);
        list.forEach(n -> n.setIsRead(true));
        notificationRepository.saveAll(list);
    }

    @Transactional
    public void clearAll(UUID tenantId) {
        notificationRepository.deleteByTenantId(tenantId);
    }
}
