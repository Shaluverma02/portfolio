# Shalu's portfolio

## Folder layout

```text
frontend/
  index.html
  assets/          # CSS, browser JavaScript, images
  admin/          # Admin UI; served through protected backend routes
  projects/
  experience/
  server.js       # Public server and backend proxy
  package.json
backend/
  app.js          # API, authentication, protected admin routes
  server.js       # Backend startup
  lib/            # MongoDB, validation, auth, chat
  .env            # Existing environment settings moved here
  .admin/         # Existing credentials preserved
  *.json          # Seed data
  uploads/
  package.json
```

Run from the project root using `npm run frontend` and `npm run backend`, or from each folder:

```powershell
# Terminal 1
cd backend
npm install
npm start
```

```powershell
# Terminal 2
cd frontend
npm install
npm start
```

Edit environment settings in `backend/.env`. Frontend does not load database or admin secrets.

Run frontend and backend in two separate terminals (Node.js 22+):

Install dependencies once with `npm install`. Keep your existing `backend/.env`; for a new setup, copy `backend/.env.example` and enter the database settings.

Terminal 1 — backend:

```sh
npm run backend
```

Terminal 2 — frontend:

```sh
npm run frontend
```

Open http://localhost:5500 for the portfolio and http://localhost:5500/admin for admin. Backend runs at http://localhost:5501. Use `npm run dev:backend` and `npm run dev:frontend` for automatic restarts.

The `frontend/server.js` entry point serves the existing public HTML/CSS/JS and proxies API, public data, resume, admin, and WebSocket routes to the backend. The `backend/server.js` entry point handles MongoDB, authentication, contact submissions, resumes, and chat. Admin pages remain protected by backend authentication. All UI files now live in `frontend/`; their browser URLs stay the same. Backend logic, private credentials, seed JSON, uploads, and environment settings live in `backend/`. Frontend does not read `backend/.env`; only backend loads database and admin secrets.

Optional settings: `BACKEND_PORT` in `backend/.env`, and `FRONTEND_PORT` / `BACKEND_URL` in the frontend terminal environment. If you change the backend port, set `BACKEND_URL` to match. Both processes must run for live data, admin, contact, and chat; the public frontend can start independently.

The original combined server is also available:

```sh
npm install
copy backend\.env.example backend\.env
npm start
```

- Portfolio: http://localhost:5500/
- Admin login: http://localhost:5500/admin
- Dashboard after login: http://localhost:5500/admin/dashboard

On first start, the server creates username `admin` and a random password. Open
`backend/.admin/login-details.txt` locally for the credentials. The password hash is stored
in `backend/.admin/credentials.json`; the whole `.admin` folder is excluded from Git and is
never served over HTTP. Keep the login-details file private; it can be removed
after saving the password in a password manager.

The dashboard includes Add, Edit, and Delete for projects, skills, experience, and certificates,
plus a searchable contact inbox. Open a section in the sidebar and use its Add
button or the Edit/Delete buttons on an item. Deletion requires confirmation.
Use **Resumes** to upload multiple PDF versions, set the active resume shown by the
public Resume button, or remove old versions. Resume files are stored in MongoDB
GridFS; PDF files up to 15 MB are supported.
Sign out
returns to the login page. Sessions expire after eight hours or a server restart.
The old `/showdata.html` address redirects to the protected inbox.

Portfolio content and contact submissions are stored in MongoDB. Start a local
MongoDB server (`mongod`) on its default address, `mongodb://127.0.0.1:27017`, or
set `MONGODB_URI` to your MongoDB connection string and optionally `MONGODB_DB`
(defaults to `portfolio`). Copy `backend/.env.example` to `backend/.env` to configure these values
for both `npm start` and `npm run dev`; production can provide them as environment
variables instead. For MongoDB Atlas, use the `mongodb+srv://` connection string
from Atlas, ensure the database user has read/write access, and allow your server's
IP address in Atlas Network Access. URL-encode special characters in the database
username or password. On first startup, existing `projects.json`,
`skills.json`, `experience.json`, `certificates.json`, and `contacts.json` records
are imported once; subsequent reads and writes use MongoDB. The homepage, Projects
page, and Experience page continue to load the same public JSON endpoints. Education
is fixed HTML in `frontend/index.html` and is not managed through the admin panel or MongoDB.
Refresh the public page after saving an admin change.

Project images, skill icons, and certificate images accept an `/assets/...` path or
a full http(s) image URL. Cloudinary-hosted images can be used by pasting their
complete secure delivery URL (for example, `https://res.cloudinary.com/<cloud>/image/upload/<asset>`).
The image field also accepts that Cloudinary URL without the leading `https://`.
The dashboard does not upload files; upload images to Cloudinary separately and
paste the returned URL/path into the relevant field. A Cloudinary public ID alone
is not a display URL; use the full `res.cloudinary.com/<cloud>/image/upload/...` path.

To publish a certificate, open **Certificates** in the dashboard and choose **Add
certificate**. Enter its title and issuer, then optionally add the issue date,
credential ID, description, a certificate image link (`/assets/...` or http(s)),
and a certificate or verification URL. Certificates appear on the homepage;
Edit updates them and Delete removes them. The section starts empty.

To set or reset the account, stop the server and start it with `ADMIN_USERNAME`
(optional, defaults to the existing username or `admin`) and `ADMIN_PASSWORD`
(12 to 1024 characters) as environment variables. These replace the stored
credentials and remove the initial login-details file. There is no public sign-up.

`PORT` overrides port 5500. `npm run dev` restarts the server on source changes;
this also clears login sessions. For HTTPS hosting, use `NODE_ENV=production` so
session cookies have the Secure flag. Admin credentials remain in the private `.admin` directory. Login sessions remain
in memory and expire after a server restart.

```sh
npm test
```

Tests use isolated temporary records and credentials. They cover login/logout,
protected routes, cookies, login throttling, contact submission, private file
access, credential persistence, existing public routes, and all four editable content
sections' create/edit/delete flows, validation, persistence, and concurrent writes.
