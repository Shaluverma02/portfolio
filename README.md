# Shalu's portfolio

## Project layout

```text
client/           # Website, assets, admin UI, Vite development server and build
server/           # Independent API, database, authentication and live chat service
package.json      # Root run/test commands
.env              # Shared local server/client settings
*.json            # Seed data
uploads/
```

## Run locally

Use Node.js 22+ and install dependencies separately for each app:

```sh
npm install --prefix server
npm install --prefix client
```

Start the backend and frontend in separate terminals, from the project root:

```sh
npm run server
npm run client
```

Each folder has its own `node_modules` and lockfile. The backend API listens on
port 5500; the client runs independently on port 5173. The frontend calls the
backend directly using `VITE_API_URL` and does not proxy requests.
For local login, open the exact `http://localhost:5173` address (not the
`127.0.0.1` alias) so the browser sends the session cookie to the localhost API.

Or, in separate terminals, run `npm run dev` from `server/` and `client/`.
Open the frontend at http://localhost:5173. Build the static frontend with
`npm run build:client`; deploy `client/dist/` separately from the backend.
The backend serves only API/data/WebSocket routes; configure its `CLIENT_ORIGIN`
to match the deployed frontend origin. The frontend build embeds `VITE_API_URL`,
so rebuild it after changing the backend URL.

For a new setup, copy `.env.example` to `.env` and configure MongoDB and
`VITE_API_URL` (the publicly reachable backend base URL) plus `CLIENT_ORIGIN`
(the frontend origin allowed to call the API). Add comma-separated origins when
you serve the client from multiple domains. Set `PORT` and `CLIENT_PORT` to
change the local ports; update `VITE_API_URL` to match `PORT`.
Existing environment settings and admin credentials are preserved at the root.
Use `npm test` for tests and `npm run check:db` to check database startup.

- Portfolio: http://localhost:5173/
- Admin login: http://localhost:5173/admin/login.html
- Dashboard after login: http://localhost:5173/admin/dashboard.html

On first start, the server creates username `admin` and a random password. Open
`.admin/login-details.txt` locally for the credentials. The password hash is stored
in `.admin/credentials.json`; the whole `.admin` folder is excluded from Git and is
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

Portfolio content and contact submissions are stored in MongoDB. The backend
serves JSON and API/WebSocket endpoints only; it does not serve the website.
Start a local
MongoDB server (`mongod`) on its default address, `mongodb://127.0.0.1:27017`, or
set `MONGODB_URI` to your MongoDB connection string and optionally `MONGODB_DB`
(defaults to `portfolio`). Copy `.env.example` to `.env` to configure these values
for the backend commands; production can provide them as environment variables
instead. For MongoDB Atlas, use the `mongodb+srv://` connection string
from Atlas, ensure the database user has read/write access, and allow your server's
IP address in Atlas Network Access. URL-encode special characters in the database
username or password. On first startup, existing `projects.json`,
`skills.json`, `experience.json`, `certificates.json`, and `contacts.json` records
are imported once; subsequent reads and writes use MongoDB. The homepage, Projects
page, and Experience page continue to load the same public JSON endpoints. Education
is fixed HTML in `index.html` and is not managed through the admin panel or MongoDB.
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

`PORT` overrides backend port 5500. The backend `npm run dev` command restarts
on source changes; this also clears login sessions. For HTTPS hosting, use `NODE_ENV=production` so
session cookies have the Secure flag. Admin credentials remain in the private `.admin` directory. Login sessions remain
in memory and expire after a server restart.

```sh
npm test
```

Tests use isolated temporary records and credentials. They cover login/logout,
protected routes, cookies, login throttling, contact submission, private file
access, credential persistence, existing public routes, and all four editable content
sections' create/edit/delete flows, validation, persistence, and concurrent writes.
