# The reserved name is a nameKey inside the category

The shared `Name` keeps the display spelling (trim, collapsed spaces, 2–100, case preserved). Uniqueness is case-insensitive inside the category and still holds when the other origin is ended. Canal and Campanha do not share a list. Accent folding is out: “Verão” and “Verao” stay distinct.

The origin stores `name` and `nameKey` (`Name.value.toLowerCase()`, Unicode default case fold). A unique index on `(categoryId, nameKey)` is the race backstop. `IndicationOriginNamePolicy` checks availability before the write, same shape as email occupancy, and a Mongo `11000` on that index becomes the same `IndicationOriginNameTakenError` (`409`). A collation index was rejected because the fold would live in the database. A read with no unique index was rejected because two creates can both pass it.
