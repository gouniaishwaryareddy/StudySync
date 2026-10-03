package com.studentdashboard.service;

import com.studentdashboard.dto.Dtos;
import com.studentdashboard.dto.Dtos.*;
import com.studentdashboard.entity.Subject;
import com.studentdashboard.entity.Task;
import com.studentdashboard.entity.TaskStatus;
import com.studentdashboard.entity.User;
import com.studentdashboard.exception.ApiException;
import com.studentdashboard.repository.SubjectRepository;
import com.studentdashboard.repository.TaskRepository;
import com.studentdashboard.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class SubjectService {

    private final SubjectRepository subjectRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    public SubjectService(SubjectRepository subjectRepository, TaskRepository taskRepository,
                          UserRepository userRepository) {
        this.subjectRepository = subjectRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<SubjectResponse> list(Long userId) {
        List<Task> tasks = taskRepository.findByUserId(userId);
        return subjectRepository.findByUserIdOrderByNameAsc(userId).stream()
                .map(s -> toResponse(s, tasks)).toList();
    }

    @Transactional(readOnly = true)
    public SubjectResponse get(Long userId, Long id) {
        return toResponse(findOwned(userId, id), taskRepository.findByUserId(userId));
    }

    public SubjectResponse create(Long userId, SubjectRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "User not found. Please log in again."));
        Subject subject = new Subject();
        subject.setUser(user);
        apply(subject, req);
        return toResponse(subjectRepository.save(subject), taskRepository.findByUserId(userId));
    }

    public SubjectResponse update(Long userId, Long id, SubjectRequest req) {
        Subject subject = findOwned(userId, id);
        apply(subject, req);
        return toResponse(subjectRepository.save(subject), taskRepository.findByUserId(userId));
    }

    // Deleting a subject also deletes all of its tasks
    public void delete(Long userId, Long id) {
        Subject subject = findOwned(userId, id);
        taskRepository.deleteBySubjectId(id);
        subjectRepository.delete(subject);
    }

    private void apply(Subject subject, SubjectRequest req) {
        subject.setName(req.name().trim());
        if (req.color() != null && !req.color().isBlank()) subject.setColor(req.color());
    }

    private Subject findOwned(Long userId, Long id) {
        return subjectRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Subject not found"));
    }

    private SubjectResponse toResponse(Subject s, List<Task> allTasks) {
        long total = allTasks.stream()
                .filter(t -> t.getSubject() != null && t.getSubject().getId().equals(s.getId())).count();
        long done = allTasks.stream()
                .filter(t -> t.getSubject() != null && t.getSubject().getId().equals(s.getId())
                        && t.getStatus() == TaskStatus.COMPLETED).count();
        return new SubjectResponse(s.getId(), s.getName(), s.getColor(), total, done, Dtos.percent(done, total));
    }
}
