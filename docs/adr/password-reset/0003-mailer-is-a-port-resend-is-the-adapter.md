# Mailer is a port; Resend is the adapter

Sending email is not a product hexagon: no HTTP, no user stories of its own. Auth calls `MailerPort.send({ to, template, vars })`. Production adapter is [Resend](https://resend.com); tests use a fake. v1 has one template (`password-reset`) and must never put the password in the message. A `mail` module with routes was rejected as a shallow pass-through.
