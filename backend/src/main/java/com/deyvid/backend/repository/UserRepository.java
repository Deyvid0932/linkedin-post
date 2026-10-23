package com.deyvid.backend.repository;

import com.deyvid.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.stereotype.Repository;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.List;
import java.util.UUID;
import jakarta.persistence.LockModeType;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"tenant", "roles"})
    Optional<User> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);
    long countByIsActiveTrue();

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("update User u set u.tokenVersion = u.tokenVersion + 1 where u.id = :userId and u.isActive = true")
    int incrementTokenVersionIfActive(@Param("userId") UUID userId);

    @Query("select count(distinct u.id) from User u join u.roles r where u.isActive = true and r.name = :roleName")
    long countActiveUsersWithRole(@Param("roleName") String roleName);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u join u.roles r where u.isActive = true and r.name = :roleName order by u.id")
    List<User> lockActiveUsersWithRole(@Param("roleName") String roleName);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"tenant"})
    Page<User> findByNameContainingIgnoreCaseOrEmailContainingIgnoreCase(
            String name, String email, Pageable pageable);

    @Override
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"tenant", "roles"})
    Page<User> findAll(Pageable pageable);

}
