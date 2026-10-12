# Categories are a closed code set

Canal, Campanha, and Amigo are product structure. An operator does not create, rename, or remove them, so they are not documents and they have no repository. They live as a constant: `canal`, `campanha`, `amigo`, with `holdsOrigins` true, true, and false, in that order.

Amigo is refused because `holdsOrigins` is false. The code `amigo` is the id the client sends; it is not a `UniqueEntityId` (that VO is 24-character hex and would reject the code). Origin ids are `UniqueEntityId`. The catalog read projects the three categories from the constant and attaches origins. A category collection, and one embedded Catalog document, were rejected: the first stores three rows that never change, the second makes every create contend on a single document.
