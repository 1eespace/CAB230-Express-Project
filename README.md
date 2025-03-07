# CAB230-Express-Project: Movie Api 🎬

## 📌 Project Overview

This project is the **backend service** for a **Movie Web Application**,
built using **Node.js and Express**.
It provides a RESTful API that allows users to **search, retrieve, and authenticate** for movie-related data.
The API serves as the backend for a React-based frontend application.

## 🛠️ Technologies Used

- **Backend Framework:** Express.js (Node.js)
- **Database:** MySQL (Knex.js for query building)
- **Authentication:** JWT-based authentication (Login, Registration)
- **Security:** CORS, HTTPS with self-signed certificates
- **Testing:** Jest for unit tests, Supertest for API testing
- **API Documentation:** Swagger https://swagger.io/docs/

## 🔧 Key Features

1. **Movie Data API:** Fetch movie details using `/movies/search` and `/movies/data/{imdbID}`.
2. **User Authentication:** Secure login, registration, and token-based authentication.
3. **Protected Endpoints:** Some endpoints require authentication.
4. **Testing:** Full test suite with Jest (✔ 385 tests passed ✅).
5. **Database Integration:** Uses MySQL with Knex.js for migrations and queries.
