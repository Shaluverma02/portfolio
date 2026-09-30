# Shalu's portfolio

Run the portfolio and its private admin dashboard:

```sh
npm install
npm start
```

- Portfolio: http://localhost:5500/
- Admin login: http://localhost:5500/admin
- Dashboard after login: http://localhost:5500/admin/dashboard

On first start, the server creates username `admin` and a random password. Open
`.admin/login-details.txt` locally for the credentials. The password hash is stored
in `.admin/credentials.json`; the whole `.admin` folder is excluded from Git and is
never served over HTTP. Keep the login-details file private; it can be removed
after saving the password in a password manager.

The dashboard includes Add, Edit, and Delete for projects, skills, experience, and certificates,
plus a searchable contact inbox. Open a section in the sidebar and use its Add
button or the Edit/Delete buttons on an item. Deletion requires confirmation.
Sign out
returns to the login page. Sessions expire after eight hours or a server restart.
The old `/showdata.html` address redirects to the protected inbox.

Portfolio content is stored in `projects.json`, `skills.json`, `experience.json`, and
`certificates.json` in the project root. The homepage, Projects page, and Experience
page load those same files through the server. Refresh the public page after saving
an admin change. Existing content is kept and given stable IDs automatically.
Writes are serialized and replace the JSON file atomically. An empty section stays
empty; removed content does not reappear from hardcoded HTML.

Project images support existing names (such as `portfolio1`), `/assets/...` paths,
or http(s) image URLs. Skill icons accept `/assets/...` paths or http(s) URLs.
Image fields are optional; this version uses image links rather than file uploads.

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
session cookies have the Secure flag. The JSON data and in-memory sessions are
intended for one server process with a persistent writable disk.

```sh
npm test
```

Tests use isolated temporary records and credentials. They cover login/logout,
protected routes, cookies, login throttling, contact submission, private file
access, credential persistence, existing public routes, and all four content
sections' create/edit/delete flows, validation, persistence, and concurrent writes.
