package com.studentdashboard.dto;

import com.studentdashboard.entity.Priority;
import com.studentdashboard.entity.TaskStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class Dtos {

    // ---------- Users ----------
    public record RegisterRequest(
            @NotBlank(message = "Name is required") String name,
            @NotBlank(message = "Email is required") @Email(message = "Email is not valid") String email,
            @NotBlank(message = "Password is required")
            @Size(min = 6, message = "Password must be at least 6 characters") String password) {}

    public record LoginRequest(
            @NotBlank(message = "Email is required") String email,
            @NotBlank(message = "Password is required") String password) {}

    public record UpdateProfileRequest(
            @NotBlank(message = "Name is required") String name,
            String newPassword) {}

    public record UserResponse(Long id, String name, String email, LocalDateTime createdAt) {}

    // ---------- Subjects ----------
    public record SubjectRequest(
            @NotBlank(message = "Subject name is required") String name,
            String color) {}

    public record SubjectResponse(Long id, String name, String color,
                                  long totalTasks, long completedTasks, int percentage) {}

    // ---------- Tasks ----------
    public record TaskRequest(
            @NotBlank(message = "Title is required") String title,
            String description,
            Priority priority,
            TaskStatus status,
            LocalDate deadline,
            Long subjectId) {}

    public record TaskResponse(Long id, String title, String description,
                               Priority priority, TaskStatus status, LocalDate deadline,
                               LocalDateTime createdAt, LocalDateTime completedAt,
                               Long subjectId, String subjectName, String subjectColor) {}

    // ---------- Analytics ----------
    public record Summary(long total, long completed, long pending, long inProgress,
                          long overdue, long dueToday, long todayTasks, int productivity) {}

    public record ChartPoint(String label, long value) {}

    public record WeeklyPoint(String label, long completed, long created) {}

    // ---------- Helper ----------
    public static int percent(long part, long total) {
        return total == 0 ? 0 : (int) Math.round(part * 100.0 / total);
    }
}
