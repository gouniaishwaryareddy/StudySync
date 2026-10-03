package com.studentdashboard.repository;

import com.studentdashboard.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findByUserId(Long userId);
    List<Task> findBySubjectIdAndUserId(Long subjectId, Long userId);
    Optional<Task> findByIdAndUserId(Long id, Long userId);
    void deleteBySubjectId(Long subjectId);
}
