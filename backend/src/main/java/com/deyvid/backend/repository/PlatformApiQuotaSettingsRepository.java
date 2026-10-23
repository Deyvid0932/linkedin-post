package com.deyvid.backend.repository;

import com.deyvid.backend.entity.PlatformApiQuotaSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PlatformApiQuotaSettingsRepository extends JpaRepository<PlatformApiQuotaSettings, Short> {}
