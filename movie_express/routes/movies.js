var express = require("express");
var router = express.Router();

const charactersParser = (str) => {
  if (str === "") {
    return [];
  }

  const replaced = str.replaceAll(`["`, "").replaceAll(`"]`, "");
  const split = replaced.split('","');

  return split;
};

/* GET home page. */
router.get("/", function (req, res, next) {
  res.send("Hello from movies route");
});

/* GET /movies/search */
router.get("/search", function (req, res, next) {
  const title = req.query.title;
  const year = req.query.year;
  const perPage = 100;
  const page = req.query.page || 1;

  // Validate year parameter
  if (year && !/^\d{4}$/.test(year)) {
    return res.status(400).json({
      error: true,
      message: "Invalid year format. Format must be yyyy.",
    });
  }

  if (page && (!/^\d+$/.test(page) || parseInt(page) <= 0)) {
    return res.status(400).json({
      error: true,
      message: "Invalid page format. page must be a number.",
    });
  }

  const query = req.db
    .distinct()
    .from("basics")
    .select(
      "primaryTitle as title",
      "year",
      "tconst as imdbID",
      req.db.raw("CAST(imdbRating AS DECIMAL(3,1)) as imdbRating"),
      req.db.raw(
        "CAST(rottenTomatoesRating AS DECIMAL(3,0)) as rottenTomatoesRating",
      ),
      req.db.raw("CAST(metacriticRating AS DECIMAL(3,0)) as metacriticRating"),
      "rated as classification",
    )
    .modify((queryBuilder) => {
      if (title) {
        queryBuilder.where("primaryTitle", "like", `%${title}%`);
      }
      if (year) {
        queryBuilder.where("year", year);
      }
    })
    .limit(perPage)
    .offset((page - 1) * perPage);

  const countQuery = req.db
    .from("basics")
    .countDistinct("tconst as count")
    .modify((queryBuilder) => {
      if (title) {
        queryBuilder.where("primaryTitle", "like", `%${title}%`);
      }
      if (year) {
        queryBuilder.where("year", year);
      }
    });

  Promise.all([query, countQuery]).then(([rows, countResult]) => {
    const data = rows.map((row) => {
      return {
        title: row.title,
        year: row.year,
        imdbID: row.imdbID,
        imdbRating: parseFloat(row.imdbRating),
        rottenTomatoesRating: parseFloat(row.rottenTomatoesRating),
        metacriticRating: parseFloat(row.metacriticRating),
        classification: row.classification,
      };
    });

    // pagination
    const totalCount = parseInt(countResult[0].count);
    const totalPages = Math.ceil(totalCount / perPage);
    const currentPage = Math.max(page, 1);
    const from = data.length >= 0 ? (currentPage - 1) * perPage : 0;
    let to = Math.min(from + perPage, totalCount);
    if (currentPage > totalPages) {
      to = from;
    }
    const pagination = {
      total: totalCount,
      lastPage: totalPages,
      prevPage: currentPage > 1 ? currentPage - 1 : null,
      nextPage: currentPage < totalPages ? currentPage + 1 : null,
      perPage: perPage,
      currentPage: currentPage,
      from: data.length >= 0 ? from : 0,
      to: data.length >= 0 ? to : 0,
    };

    const response = {
      data: data,
      pagination: pagination,
    };

    res.json(response);
  });
});

/* GET /data/:imdbID */
router.get("/data/:imdbID", function (req, res, next) {
  const imdbID = req.params.imdbID;
  const year = req.query.year;
  const queryParams = Object.keys(req.query);

  if (queryParams.length > 0) {
    const invalidParam = year;
    return res.status(400).json({
      error: true,
      message: `Invalid query parameter: ${invalidParam}. Query parameters are not permitted.`,
    });
  }

  const movieQuery = req.db
    .from("basics")
    .distinct()
    .select(
      "primaryTitle as title",
      "year",
      "runtimeMinutes as runtime",
      "genres",
      "country",
      "boxoffice",
      "poster",
      "plot",
    )
    .where("tconst", imdbID);

  const principalsQuery = req.db
    .from("principals")
    .distinct()
    .select("nconst as id", "category", "name", "characters")
    .where("tconst", imdbID);

  const ratingsQuery = req.db
    .from("ratings")
    .distinct()
    .select("source", "value")
    .where("tconst", imdbID);

  Promise.all([movieQuery, principalsQuery, ratingsQuery]).then(
    ([movieRows, principalRows, ratingRows]) => {
      if (movieRows.length === 0) {
        return res.status(404).json({
          error: true,
          message: "No record exists for the given IMDb ID",
        });
      }

      const principals = principalRows.map((row) => {
        let characters = [];
        if (row.characters) {
          try {
            characters = charactersParser(row.characters);
          } catch (error) {
            console.error(
              `Error parsing characters for principal with ID ${row.id}:`,
              error,
            );
          }
        }
        return {
          id: row.id,
          category: row.category,
          name: row.name,
          characters: characters,
        };
      });

      const ratings = ratingRows.map((row) => {
        let value = null;
        if (row.value) {
          const ratingValue = parseFloat(row.value.split("/")[0]);
          value = isNaN(ratingValue) ? null : ratingValue;
        }
        return {
          source: row.source,
          value: value,
        };
      });

      const movieData = {
        title: movieRows[0].title,
        year: movieRows[0].year,
        runtime: movieRows[0].runtime,
        genres: movieRows[0].genres.split(","),
        country: movieRows[0].country,
        principals: principals,
        ratings: ratings,
        boxoffice: movieRows[0].boxoffice,
        poster: movieRows[0].poster,
        plot: movieRows[0].plot,
      };

      res.json(movieData);
    },
  );
});

module.exports = router;
