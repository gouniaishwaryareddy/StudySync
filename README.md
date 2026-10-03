# StudySync - Student Productivity Dashboard

Stack: HTML/CSS/JS + Chart.js -> REST API -> Spring Boot -> JPA/Hibernate -> PostgreSQL

## 1. Database
In pgAdmin Query Tool run:  CREATE DATABASE student_dashboard;
(Tables are created automatically by Hibernate.)

## 2. Backend
1. Open `backend/src/main/resources/application.properties`
   and replace YOUR_PASSWORD_HERE with your PostgreSQL password.
2. Open the project in Visual Studio Code, open a terminal in the `backend` folder, and run `mvn spring-boot:run`
   (or run `mvn spring-boot:run` inside `backend`).
3. Wait for "Started StudentDashboardApplication" (server on port 8080).

## 3. Frontend
Open the `frontend` folder in VS Code and start `index.html` with the
"Live Server" extension (or double-click index.html).
Register an account and start using the app.

## Requirements
JDK 17+ (built on JDK 25), Maven 3.6.3+, PostgreSQL.
