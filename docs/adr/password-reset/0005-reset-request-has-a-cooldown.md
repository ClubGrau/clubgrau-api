# Password-reset request has a 15-minute cooldown

“Last request wins” lets anyone who knows the email issue a new Reset Token and burn the link the owner just opened. A request within 15 minutes of the last send still returns the same opaque success but does **not** send email and does **not** invalidate the outstanding token. After 15 minutes, a new token replaces the previous one. Multiple concurrent live tokens were rejected (larger attack surface).
