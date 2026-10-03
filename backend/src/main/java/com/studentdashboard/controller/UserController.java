package com.studentdashboard.controller;

import com.studentdashboard.dto.Dtos.*;
import com.studentdashboard.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse register(@Valid @RequestBody RegisterRequest req) {
        return userService.register(req);
    }

    @PostMapping("/login")
    public UserResponse login(@Valid @RequestBody LoginRequest req) {
        return userService.login(req);
    }

    @GetMapping("/{id}")
    public UserResponse get(@PathVariable("id") Long id) {
        return userService.get(id);
    }

    @PutMapping("/{id}")
    public UserResponse update(@PathVariable("id") Long id, @Valid @RequestBody UpdateProfileRequest req) {
        return userService.update(id, req);
    }
}
