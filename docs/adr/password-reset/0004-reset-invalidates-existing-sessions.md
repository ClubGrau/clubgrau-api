# Password Reset invalidates existing Session Tokens

Lifecycle left JWT revocation on Deactivate/Remove as an Auth sibling. Password Reset’s threat is different: a stolen password or a Session Token issued before the reset. After complete, previously issued JWTs for that collaborator must fail authentication. Login remains the only issuer of a new Session Token (no auto-login from the email link). How the middleware learns the password changed is a design-doc concern. Deactivate/Remove still do not gain revocation in this ADR.
