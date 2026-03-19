# Blofin Example Server

This folder contains a sanitized Express example for authenticated Blofin requests.

It is not part of the public Vercel demo.

## Local setup

1. Copy `server/.env.example` to `server/.env`.
2. Add your own Blofin credentials locally.
3. Install server dependencies with `npm install` inside `server/`.
4. Run `npm run dev` or `npm start` inside `server/`.

## Notes

- Never commit `server/.env`.
- The public repository should only contain placeholders.
- The frontend demo does not call this server by default.
