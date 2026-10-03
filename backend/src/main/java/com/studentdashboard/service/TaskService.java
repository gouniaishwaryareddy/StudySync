package com.studentdashboard.service;

import com.studentdashboard.dto.Dtos.*;
import com.studentdashboard.entity.*;
import com.studentdashboard.exception.ApiException;
import com.studentdashboard.repository.SubjectRepository;
import com.studentdashboard.repository.TaskRepository;
import com.studentdashboard.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.function.Predicate;

@Service
@Transactional
public class TaskService {

    private final TaskRepository taskRepository;
    private final SubjectRepository subjectRepository;
    private final UserRepository userRepository;

    public TaskService(TaskRepository taskRepository, SubjectRepository subjectRepository,
                       UserRepository userRepository) {
        this.taskRepository = taskRepository;
        this.subjectRepository = subjectRepository;
        this.userRepository = userRepository;
    }

    // Search + filter + sort in one place
    @Transactional(readOnly = true)
    public List<TaskResponse> list(Long userId, String search, Long subjectId,
                                   Priority priority, TaskStatus status, String sort) {
        Comparator<LocalDate> order = "desc".equalsIgnoreCase(sort)
                ? Comparator.reverseOrder() : Comparator.naturalOrder();
        String q = search == null ? "" : search.trim().toLowerCase();

        return taskRepository.findByUserId(userId).stream()
                .filter(t -> q.isEmpty()
                        || t.getTitle().toLowerCase().contains(q)
                        || (t.getDescription() != null && t.getDescription().toLowerCase().contains(q)))
                .filter(t -> subjectId == null
                        || (t.getSubject() != null && t.getSubject().getId().equals(subjectId)))
                .filter(t -> priority == null || t.getPriority() == priority)
                .filter(t -> status == null || t.getStatus() == status)
                .sorted(Comparator.comparing(Task::getDeadline, Comparator.nullsLast(order)))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public TaskResponse get(Long userId, Long id) {
        return toResponse(findOwned(userId, id));
    }

    public TaskResponse create(Long userId, TaskRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "User not found. Please log in again."));
        Task task = new Task();
        task.setUser(user);
        apply(task, req, userId);
        return toResponse(taskRepository.save(task));
    }

    public TaskResponse update(Long userId, Long id, TaskRequest req) {
        Task task = findOwned(userId, id);
        apply(task, req, userId);
        return toResponse(taskRepository.save(task));
    }

    public void delete(Long userId, Long id) {
        taskRepository.delete(findOwned(userId, id));
    }

    public TaskResponse complete(Long userId, Long id) {
        Task task = findOwned(userId, id);
        task.setStatus(TaskStatus.COMPLETED);
        if (task.getCompletedAt() == null) task.setCompletedAt(LocalDateTime.now());
        return toResponse(taskRepository.save(task));
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> listBySubject(Long userId, Long subjectId) {
        subjectRepository.findByIdAndUserId(subjectId, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Subject not found"));
        return taskRepository.findBySubjectIdAndUserId(subjectId, userId).stream()
                .sorted(Comparator.comparing(Task::getDeadline, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(this::toResponse).toList();
    }

    // type = today | tomorrow | upcoming | overdue  (completed tasks are never included)
    @Transactional(readOnly = true)
    public List<TaskResponse> deadlines(Long userId, String type) {
        LocalDate today = LocalDate.now();
        Predicate<LocalDate> match = switch (type.toLowerCase()) {
            case "today" -> d -> d.equals(today);
            case "tomorrow" -> d -> d.equals(today.plusDays(1));
            case "upcoming" -> d -> d.isAfter(today.plusDays(1));
            case "overdue" -> d -> d.isBefore(today);
            default -> throw new ApiException(HttpStatus.BAD_REQUEST, "Unknown deadline type: " + type);
        };
        return taskRepository.findByUserId(userId).stream()
                .filter(t -> t.getStatus() != TaskStatus.COMPLETED)
                .filter(t -> t.getDeadline() != null && match.test(t.getDeadline()))
                .sorted(Comparator.comparing(Task::getDeadline))
                .map(this::toResponse).toList();
    }

    // ---------- helpers ----------
    private void apply(Task task, TaskRequest req, Long userId) {
        task.setTitle(req.title().trim());
        task.setDescription(req.description());
        task.setPriority(req.priority() == null ? Priority.MEDIUM : req.priority());
        TaskStatus status = req.status() == null ? TaskStatus.PENDING : req.status();
        task.setStatus(status);
        task.setDeadline(req.deadline());

        // completedAt powers the analytics: set when completed, cleared otherwise
        if (status == TaskStatus.COMPLETED) {
            if (task.getCompletedAt() == null) task.setCompletedAt(LocalDateTime.now());
        } else {
            task.setCompletedAt(null);
        }

        if (req.subjectId() == null) {
            task.setSubject(null);
        } else {
            task.setSubject(subjectRepository.findByIdAndUserId(req.subjectId(), userId)
                    .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Subject not found")));
        }
    }

    private Task findOwned(Long userId, Long id) {
        return taskRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Task not found"));
    }

    private TaskResponse toResponse(Task t) {
        Subject s = t.getSubject();
        return new TaskResponse(t.getId(), t.getTitle(), t.getDescription(), t.getPriority(), t.getStatus(),
                t.getDeadline(), t.getCreatedAt(), t.getCompletedAt(),
                s == null ? null : s.getId(),
                s == null ? null : s.getName(),
                s == null ? null : s.getColor());
    }
}
