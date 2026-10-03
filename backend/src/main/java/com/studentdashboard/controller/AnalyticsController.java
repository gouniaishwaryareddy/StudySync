package com.studentdashboard.controller;

import com.studentdashboard.dto.Dtos.*;
import com.studentdashboard.service.AnalyticsService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/summary")
    public Summary summary(@RequestHeader("X-User-Id") Long userId) {
        return analyticsService.summary(userId);
    }

    @GetMapping("/daily")
    public List<ChartPoint> daily(@RequestHeader("X-User-Id") Long userId) {
        return analyticsService.daily(userId);
    }

    @GetMapping("/weekly")
    public List<WeeklyPoint> weekly(@RequestHeader("X-User-Id") Long userId) {
        return analyticsService.weekly(userId);
    }

    @GetMapping("/subjects")
    public List<SubjectResponse> subjects(@RequestHeader("X-User-Id") Long userId) {
        return analyticsService.subjects(userId);
    }

    @GetMapping("/trends")
    public List<ChartPoint> trends(@RequestHeader("X-User-Id") Long userId) {
        return analyticsService.trends(userId);
    }
}
