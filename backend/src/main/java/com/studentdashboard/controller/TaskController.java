package com.studentdashboard.controller;

import com.studentdashboard.dto.Dtos.*;
import com.studentdashboard.entity.Priority;
import com.studentdashboard.entity.TaskStatus;
import com.studentdashboard.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    // GET /api/tasks?search=&subjectId=&priority=&status=&sort=asc|desc
    @GetMapping
    public List<TaskResponse> list(@RequestHeader("X-User-Id") Long userId,
                                   @RequestParam(name = "search", required = false) String search,
                                   @RequestParam(name = "subjectId", required = false) Long subjectId,
                                   @RequestParam(name = "priority", required = false) Priority priority,
                                   @RequestParam(name = "status", required = false) TaskStatus status,
                                   @RequestParam(name = "sort", defaultValue = "asc") String sort) {
        return taskService.list(userId, search, subjectId, priority, status, sort);
    }

    // GET /api/tasks/deadlines/today | tomorrow | upcoming | overdue
    @GetMapping("/deadlines/{type}")
    public List<TaskResponse> deadlines(@RequestHeader("X-User-Id") Long userId,
                                        @PathVariable("type") String type) {
        return taskService.deadlines(userId, type);
    }

    @GetMapping("/{id}")
    public TaskResponse get(@RequestHeader("X-User-Id") Long userId, @PathVariable("id") Long id) {
        return taskService.get(userId, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse create(@RequestHeader("X-User-Id") Long userId, @Valid @RequestBody TaskRequest req) {
        return taskService.create(userId, req);
    }

    @PutMapping("/{id}")
    public TaskResponse update(@RequestHeader("X-User-Id") Long userId, @PathVariable("id") Long id,
                               @Valid @RequestBody TaskRequest req) {
        return taskService.update(userId, id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@RequestHeader("X-User-Id") Long userId, @PathVariable("id") Long id) {
        taskService.delete(userId, id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/complete")
    public TaskResponse complete(@RequestHeader("X-User-Id") Long userId, @PathVariable("id") Long id) {
        return taskService.complete(userId, id);
    }
}
