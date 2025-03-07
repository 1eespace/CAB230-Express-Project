const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  if (
    !("authorization" in req.headers) ||
    !req.headers.authorization.match(/^Bearer /)
  ) {
    res.status(401).json({
      error: true,
      message: "Authorization header ('Bearer token') not found",
    });
    return;
  }
  const token = req.headers.authorization.replace(/^Bearer /, "");
  let decodedToken;
  try {
    decodedToken = jwt.verify(token, `${process.env.JWT_SECRET}`);
    if (decodedToken.exp > Date.now()) {
      res.status(401).json({ message: "JWT token has expired" });
    }
  } catch (e) {
    res.status(401).json({ error: true, message: "Invalid JWT token" });

    return;
  }

  req.user = decodedToken;
  next();
};
