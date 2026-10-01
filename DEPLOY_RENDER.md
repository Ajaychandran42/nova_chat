# Deploy Nova Chat on Render's free tier

This repository deploys as **one Docker Web Service**. The Express server serves
the Vite app, REST API, Socket.IO endpoint, and `/health` endpoint from the same
Render URL. No separate static-site service is required.

## Before deploying

1. Push this repository to GitHub, GitLab, or Bitbucket. Do not commit `.env`
   files; use the included `.env.example` files only as local templates.
2. Create a free MongoDB Atlas cluster and create a database user. Copy its
   `mongodb+srv://...` connection string. Allow Render to connect (for a hobby
   deployment, Atlas network access `0.0.0.0/0` is the practical option; use a
   strong database password).
3. In Clerk, create/configure a production instance and collect:
   - Publishable key (`pk_...`)
   - Secret key (`sk_...`)
   - Webhook signing secret (`whsec_...`), after creating the webhook below

## Create the Render service

1. In Render, select **New > Blueprint** and connect this repository. Render
   detects `render.yaml` and creates a free Docker Web Service. Alternatively,
   select **New > Web Service**, choose the repository, set **Language** to
   **Docker**, and leave the Dockerfile path as `./Dockerfile`.
2. Choose the **Free** plan and deploy. The Dockerfile is at the repository
   root and builds both `frontend` and `backend` automatically.
3. Once Render assigns a URL such as `https://nova-chat.onrender.com`, set these
   environment variables in the service settings and redeploy:

   | Variable | Value |
   | --- | --- |
   | `FRONTEND_URL` | Your exact Render URL, for example `https://nova-chat.onrender.com` |
   | `MONGO_URI` | MongoDB Atlas connection string |
   | `CLERK_SECRET_KEY` | Clerk `sk_...` server secret |
   | `CLERK_WEBHOOK_SIGNING_SECRET` | Clerk webhook signing secret |
   | `IMAGEKIT_PRIVATE_KEY` | ImageKit private key (needed for media uploads) |
   | `VITE_CLERK_PUBLISHABLE_KEY` | Clerk `pk_...` public key |

`VITE_CLERK_PUBLISHABLE_KEY` is deliberately available during the Docker build;
it is a public browser key. Do not put `CLERK_SECRET_KEY`, `MONGO_URI`, or any
other secret in a `VITE_*` variable.

4. In Clerk, add the Render URL to the instance's allowed origins/redirect URLs
as required by its production settings. Create a webhook targeting:

   ```text
   https://YOUR-SERVICE.onrender.com/api/webhooks/clerk
   ```

   Subscribe it to `user.created`, `user.updated`, and `user.deleted`, then put
   its signing secret in `CLERK_WEBHOOK_SIGNING_SECRET`.

5. Open `https://YOUR-SERVICE.onrender.com/health`. It must return
   `{ "ok": true }`. Then test sign-up/sign-in, a chat message, Socket.IO
   online presence, and an ImageKit upload.

## Free-tier limitations

Render free web services are intended for hobby/testing use, can spin down when
idle (the next request has a cold-start delay), can restart at any time, and do
not include persistent disks, shell access, or horizontal scaling. This project
does not use self-pinging to try to keep the service awake. Keep data in MongoDB
Atlas and media in ImageKit, not on the service filesystem. Render free
allowances and limits can change; verify them in the Render dashboard before
launching a public app.