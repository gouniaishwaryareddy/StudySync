package com.studentdashboard.controller;

import com.studentdashboard.dto.Dtos.*;
import com.studentdashboard.service.SubjectService;
import com.studentdashboard.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/subjects")
public class SubjectController {

    private final SubjectService subjectService;
    private final TaskService taskService;

    public SubjectController(SubjectService subjectService, TaskService taskService) {
        this.subjectService = subjectService;
        this.taskService = taskService;
    }

    @GetMapping
    public List<SubjectResponse> list(@RequestHeader("X-User-Id") Long userId) {
        return subjectService.list(userId);
    }

    @GetMapping("/{id}")
    public SubjectResponse get(@RequestHeader("X-User-Id") Long userId, @PathVariable("id") Long id) {
        return subjectService.get(userId, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SubjectResponse create(@RequestHeader("X-User-Id") Long userId,
                                  @Valid @RequestBody SubjectRequest req) {
        return subjectService.create(userId, req);
    }

    @PutMapping("/{id}")
    public SubjectResponse update(@RequestHeader("X-User-Id") Long userId, @PathVariable("id") Long id,
                                  @Valid @RequestBody SubjectRequest req) {
        return subjectService.update(userId, id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@RequestHeader("X-User-Id") Long userId, @PathVariable("id") Long id) {
        subjectService.delete(userId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/tasks")
    public List<TaskResponse> tasks(@RequestHeader("X-User-Id") Long userId, @PathVariable("id") Long id) {
        return taskService.listBySubject(userId, id);
    }
}
