package com.deyvid.backend.dto.request;

import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;
import java.util.*;

public record QueueUploadRequest(@NotNull UUID repositoryId, @NotNull UUID accountId,
        @NotNull @Future OffsetDateTime firstPostAt, @NotBlank @Size(max = 64) String timezone,
        @NotEmpty @Size(max = 100) List<@NotNull UUID> draftIds) {}
