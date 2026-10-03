package com.studentdashboard.service;

import com.studentdashboard.dto.Dtos;
import com.studentdashboard.dto.Dtos.*;
import com.studentdashboard.entity.Task;
import com.studentdashboard.entity.TaskStatus;
import com.studentdashboard.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class AnalyticsService {

    private final TaskRepository taskRepository;
    private final SubjectService subjectService;

    public AnalyticsService(TaskRepository taskRepository, SubjectService subjectService) {
        this.taskRepository = taskRepository;
        this.subjectService = subjectService;
    }

    public Summary summary(Long userId) {
        List<Task> tasks = taskRepository.findByUserId(userId);
        LocalDate today = LocalDate.now();

        long total = tasks.size();
        long completed = tasks.stream().filter(t -> t.getStatus() == TaskStatus.COMPLETED).count();
        long inProgress = tasks.stream().filter(t -> t.getStatus() == TaskStatus.IN_PROGRESS).count();
        long overdue = tasks.stream()
                .filter(t -> t.getStatus() != TaskStatus.COMPLETED && t.getDeadline() != null
                        && t.getDeadline().isBefore(today)).count();
        long dueToday = tasks.stream()
                .filter(t -> t.getStatus() != TaskStatus.COMPLETED && today.equals(t.getDeadline())).count();
        long todayTasks = tasks.stream().filter(t -> today.equals(t.getDeadline())).count();

        return new Summary(total, completed, total - completed, inProgress,
                overdue, dueToday, todayTasks, Dtos.percent(completed, total));
    }

    // Tasks completed per day, last 7 days
    public List<ChartPoint> daily(Long userId) {
        return lastDays(userId, 7);
    }

    // Tasks completed per day, last 30 days (trend line)
    public List<ChartPoint> trends(Long userId) {
        return lastDays(userId, 30);
    }

    // Completed vs created per week, last 8 weeks
    public List<WeeklyPoint> weekly(Long userId) {
        List<Task> tasks = taskRepository.findByUserId(userId);
        LocalDate thisMonday = LocalDate.now().with(DayOfWeek.MONDAY);
        List<WeeklyPoint> points = new ArrayList<>();
        for (int i = 7; i >= 0; i--) {
            LocalDate start = thisMonday.minusWeeks(i);
            LocalDate end = start.plusDays(6);
            long completed = completedBetween(tasks, start, end);
            long created = tasks.stream()
                    .filter(t -> {
                        LocalDate d = t.getCreatedAt().toLocalDate();
                        return !d.isBefore(start) && !d.isAfter(end);
                    }).count();
            points.add(new WeeklyPoint(start.toString(), completed, created));
        }
        return points;
    }

    // Subject-wise productivity = completion % per subject
    public List<SubjectResponse> subjects(Long userId) {
        return subjectService.list(userId);
    }

    // ---------- helpers ----------
    private List<ChartPoint> lastDays(Long userId, int days) {
        List<Task> tasks = taskRepository.findByUserId(userId);
        LocalDate today = LocalDate.now();
        List<ChartPoint> points = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            points.add(new ChartPoint(day.toString(), completedBetween(tasks, day, day)));
        }
        return points;
    }

    private long completedBetween(List<Task> tasks, LocalDate from, LocalDate to) {
        return tasks.stream()
                .filter(t -> t.getCompletedAt() != null)
                .filter(t -> {
                    LocalDate d = t.getCompletedAt().toLocalDate();
                    return !d.isBefore(from) && !d.isAfter(to);
                }).count();
    }
}
