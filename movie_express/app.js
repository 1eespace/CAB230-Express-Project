var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

const helmet = require("helmet");
const cors = require("cors");
const swaggerUI = require("swagger-ui-express");
const yaml = require("yamljs");
swaggerDocument = yaml.load("./docs/swagger.yaml");
require("dotenv").config();

var moviesRouter = require("./routes/movies");
var peopleRouter = require("./routes/people");
var userRouter = require("./routes/user");

var app = express();

const options = require("./knexfile.js");
const knex = require("knex")(options);

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(logger("dev"));
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  req.db = knex;
  next();
});

app.use("/", swaggerUI.serve);
app.get("/", swaggerUI.setup(swaggerDocument));
app.use("/movies", moviesRouter);
app.use("/people", peopleRouter);
// POST functions to register, login, refresh, and logout / profile
app.use("/user", userRouter);

logger.token("res", (req, res) => {
  const headers = {};
  res.getHeaderNames().map((h) => (headers[h] = res.getHeader(h)));
  return JSON.stringify(headers);
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
