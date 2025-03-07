var express = require("express");
var router = express.Router();
const authorization = require("../routes/auth");

// GET /people/{id}
router.get("/:id", authorization, (req, res, next) => {
  const id = req.params.id;
  const year = req.query.year;
  const queryParams = Object.keys(req.query);

  if (queryParams.length > 0) {
    const invalidParam = year;
    return res.status(400).json({
      error: true,
      message: `Invalid query parameter: ${invalidParam}. Query parameters are not permitted.`,
    });
  }

  req.db
    .from("names")
    .select("*")
    .where("nconst", "=", id)
    .then((rows) => {
      if (rows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "No record exists of a person with this ID",
        });
      }

      const person = rows[0];

      req.db
        .from("principals")
        .join("basics", "principals.tconst", "=", "basics.tconst")
        .select(
          "principals.tconst",
          "principals.category",
          "principals.characters",
          "basics.primaryTitle",
          "basics.imdbRating",
        )
        .where("principals.nconst", "=", id)
        .then((roles) => {
          const result = {
            name: person.primaryName,
            birthYear: person.birthYear,
            deathYear: person.deathYear,
            roles: roles.map((role) => ({
              movieName: role.primaryTitle,
              movieId: role.tconst,
              category: role.category,
              characters: role.characters ? JSON.parse(role.characters) : [],
              imdbRating: parseFloat(role.imdbRating),
            })),
          };

          return res.status(200).json(result);
        });
    });
});

module.exports = router;
