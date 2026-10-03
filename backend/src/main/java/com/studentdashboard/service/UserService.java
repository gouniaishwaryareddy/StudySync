package com.studentdashboard.service;

import com.studentdashboard.dto.Dtos.*;
import com.studentdashboard.entity.User;
import com.studentdashboard.exception.ApiException;
import com.studentdashboard.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UserResponse register(RegisterRequest req) {
        String email = req.email().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "This email is already registered");
        }
        User user = new User();
        user.setName(req.name().trim());
        user.setEmail(email);
        user.setPassword(encoder.encode(req.password()));   // hash, never plain text
        return toResponse(userRepository.save(user));
    }

    public UserResponse login(LoginRequest req) {
        User user = userRepository.findByEmail(req.email().trim().toLowerCase())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));
        if (!encoder.matches(req.password(), user.getPassword())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }
        return toResponse(user);
    }

    @Transactional(readOnly = true)
    public UserResponse get(Long id) {
        return toResponse(find(id));
    }

    public UserResponse update(Long id, UpdateProfileRequest req) {
        User user = find(id);
        user.setName(req.name().trim());
        if (req.newPassword() != null && !req.newPassword().isBlank()) {
            if (req.newPassword().length() < 6) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Password must be at least 6 characters");
            }
            user.setPassword(encoder.encode(req.newPassword()));
        }
        return toResponse(userRepository.save(user));
    }

    private User find(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private UserResponse toResponse(User u) {
        return new UserResponse(u.getId(), u.getName(), u.getEmail(), u.getCreatedAt());
    }
}
