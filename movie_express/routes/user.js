var express = require("express");
var router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

/* GET user listing. */
router.get("/", function (req, res, next) {
  res.send("Hello from user route");
});

/* POST user register */
router.post("/register", function (req, res, next) {
  const email = req.body.email;
  const password = req.body.password;

  // Verify body
  if (!email || !password) {
    return res.status(400).json({
      error: true,
      message: "Request body incomplete, both email and password are required",
    });
  }

  // Determine if user already exists in table
  const queryUsers = req.db
    .from("users")
    .select("*")
    .where("email", "=", email);

  queryUsers
    .then((users) => {
      // If user exists, return error response
      if (users.length > 0) {
        return res.status(409).json({
          error: true,
          message: "User already exists",
        });
      }

      // If user does not exist, insert user into DB
      const saltRounds = 10;
      const hash = bcrypt.hashSync(password, saltRounds);
      return req.db.from("users").insert({ email, hash });
    })
    .then(() => {
      res.status(201).json({ message: "User created" });
    });
});

/* POST user login */
router.post("/login", function (req, res, next) {
  const email = req.body.email;
  const password = req.body.password;

  // Verify body
  if (!email || !password) {
    return res.status(400).json({
      error: true,
      message: "Request body incomplete, both email and password are required",
    });
  }

  const queryUsers = req.db
    .from("users")
    .select("*")
    .where("email", "=", email);

  queryUsers.then((users) => {
    if (users.length === 0) {
      return res.status(401).json({
        error: true,
        message: "Incorrect email or password",
      });
    }

    // Compare password hashes
    const user = users[0];
    return bcrypt.compare(password, user.hash).then((match) => {
      if (!match) {
        return res.status(401).json({
          error: true,
          message: "Incorrect email or password",
        });
      }

      // Create JWT tokens
      const access_token_expires_in =
        req.body.bearerExpiresInSeconds || 60 * 10;
      const refresh_token_expires_in =
        req.body.refreshExpiresInSeconds || 60 * 60;
      const refreshTokenExpiresIn = 86400;

      const accessToken = jwt.sign({ email }, `${process.env.JWT_SECRET_KEY}`, {
        expiresIn: access_token_expires_in,
      });

      const refreshToken = jwt.sign(
        { email },
        `${process.env.JWT_SECRET_KEY}`,
        {
          expiresIn: refresh_token_expires_in,
        },
      );

      return res.status(200).json({
        bearerToken: {
          token: accessToken,
          token_type: "Bearer",
          expires_in: access_token_expires_in,
        },
        refreshToken: {
          token: refreshToken,
          token_type: "Refresh",
          expires_in: refreshTokenExpiresIn,
        },
      });
    });
  });
});

/* POST user refresh */
router.post("/refresh", (req, res, next) => {
  const refreshToken = req.body.refreshToken;
  // Verify refresh token
  if (!refreshToken) {
    return res.status(400).json({
      error: true,
      message: "Request body incomplete, refresh token required",
    });
  }

  try {
    const decodedToken = jwt.verify(
      refreshToken,
      `${process.env.JWT_SECRET_KEY}`,
    );
    const email = decodedToken.email;

    // Create new access token
    const accessTokenExpiresIn = 600; // 10 minutes
    const accessToken = jwt.sign({ email }, `${process.env.JWT_SECRET_KEY}`, {
      expiresIn: accessTokenExpiresIn,
    });

    const refreshTokenExpiresIn = 86400; // 24 hours
    const newRefreshToken = jwt.sign(
      { email },
      `${process.env.JWT_SECRET_KEY}`,
      {
        expiresIn: refreshTokenExpiresIn,
      },
    );

    return res.status(200).json({
      bearerToken: {
        token: accessToken,
        token_type: "Bearer",
        expires_in: accessTokenExpiresIn,
      },
      refreshToken: {
        token: newRefreshToken,
        token_type: "Refresh",
        expires_in: refreshTokenExpiresIn,
      },
    });
  } catch (e) {
    if (e.name === "TokenExpiredError") {
      return res.status(401).json({
        error: true,
        message: "JWT token has expired",
      });
    } else {
      return res.status(401).json({
        error: true,
        message: "Invalid JWT token",
      });
    }
  }
});

/* POST user logout */
router.post("/logout", (req, res, next) => {
  const refreshToken = req.body.refreshToken;

  // Verify refresh token
  if (!refreshToken) {
    return res.status(400).json({
      error: true,
      message: "Request body incomplete, refresh token required",
    });
  }

  // Check if refreshToken is valid
  try {
    jwt.verify(refreshToken, `${process.env.JWT_SECRET_KEY}`);
  } catch (e) {
    if (e.name === "TokenExpiredError") {
      return res.status(401).json({
        error: true,
        message: "JWT token has expired",
      });
    } else {
      return res.status(401).json({
        error: true,
        message: "Invalid JWT token",
      });
    }
  }
  return res.status(200).json({
    error: false,
    message: "Token successfully invalidated",
  });
});

/* GET user profile */
router.get("/:email/profile", (req, res, next) => {
  const email = req.params.email;
  const authorizationHeader = req.headers.authorization;

  // Retrieve the user's profile from the database
  const queryUser = req.db
    .from("users")
    .select("email", "firstName", "lastName", "dob", "address")
    .where("email", "=", email)
    .first();

  queryUser
    .then((user) => {
      if (!user) {
        return res.status(404).json({
          error: true,
          message: "User not found",
        });
      }

      if (authorizationHeader && authorizationHeader.startsWith("Bearer ")) {
        const accessToken = authorizationHeader.split(" ")[1];
        const decodedToken = jwt.verify(
          accessToken,
          `${process.env.JWT_SECRET}`,
        );

        if (decodedToken.email !== email) {
          delete user.dob;
          delete user.address;
        }
      } else {
        delete user.dob;
        delete user.address;
      }

      res.status(200).json(user);
    })
    .catch((error) => {
      next(error);
    });
});

/* PUT user profile */
router.put("/:email/profile", (req, res, next) => {
  const email = req.params.email;
  const { firstName, lastName, dob, address } = req.body;

  if (!firstName || !lastName || !dob || !address) {
    return res.status(400).json({
      error: true,
      message:
        "Request body incomplete: firstName, lastName, dob and address are required.",
    });
  }

  // Check if all strings
  if (
    typeof firstName !== "string" ||
    typeof lastName !== "string" ||
    typeof dob !== "string" ||
    typeof address !== "string"
  ) {
    return res.status(400).json({
      error: true,
      message:
        "Request body invalid: firstName, lastName and address must be strings only.",
    });
  }
  // Check if dob is a valid date
  if (!isValidDate(dob)) {
    if (new Date(dob) > new Date()) {
      return res.status(400).json({
        error: true,
        message: "Invalid input: dob must be a date in the past.",
      });
    } else {
      return res.status(400).json({
        error: true,
        message: "Invalid input: dob must be a real date in format YYYY-MM-DD.",
      });
    }
  }

  // Check if the user is authorized to modify the profile
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  let decodedToken;
  try {
    decodedToken = jwt.verify(token, `${process.env.JWT_SECRET}`);
    if (decodedToken.exp > Date.now() || decodedToken.email !== email) {
      return res.status(403).json({
        error: true,
        message: "Forbidden",
      });
    }
  } catch (e) {
    return res.status(401).json({
      error: true,
      message: "Authorization header is malformed",
    });
  }

  const updateUserProfile = req.db
    .from("users")
    .where("email", "=", email)
    .update({
      firstName,
      lastName,
      dob,
      address,
    });

  updateUserProfile.then((updatedRows) => {
    if (updatedRows === 0) {
      return res.status(404).json({
        error: true,
        message: "User not found",
      });
    }

    const updatedProfile = {
      email,
      firstName,
      lastName,
      dob,
      address,
    };

    return res.status(200).json(updatedProfile);
  });
});

function isValidDate(dateString) {
  // dateString matches the format YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }

  try {
    // Check if the date is a valid date and not in the future
    const date = new Date(dateString);
    const now = new Date();
    const isValid = !isNaN(date.getTime()) && date <= now;

    // Check if the date is a valid, real date
    const isRealDate = date.toISOString().slice(0, 10) === dateString;

    // Check if the date is within year bounds
    const isWithinBounds =
      date.getFullYear() >= 1990 && date.getFullYear() <= 2023;

    return isValid && isRealDate && isWithinBounds;
  } catch (error) {
    return false;
  }
}

module.exports = router;
