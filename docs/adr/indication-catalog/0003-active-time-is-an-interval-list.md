# Active time is an interval list on the origin

Days active means time the origin was offered, not age since `createdAt`. End closes the open interval (`to` set, a second end changes nothing). Reopen appends a new open interval (a second reopen changes nothing). `createdAt` is the `from` of the first interval and does not change. `active` on the catalog read is derived: the last interval has `to === null`. There is no stored `active` flag.

The intervals are an array on the origin document. One collection, one repository. A single accumulated total cannot answer a later period cut. A separate interval collection would add a second repository for a short array. The catalog `GET` does not return the intervals or a day count; the board PRD owns that reading.
