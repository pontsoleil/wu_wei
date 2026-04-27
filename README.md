# WuWei 2

WuWei 2 is a browser-based knowledge modelling and note editing application.

This repository snapshot is prepared for GitHub upload from the local Apache
development tree.

## Repository Layout

- `index.html` - application entry point
- `app2/` - client-side WuWei modules
- `cgi-bin/` - local Windows/Apache Python CGI scripts
- `server/` - Linux server CGI shell scripts and helper scripts
- `css/`, `lib/` - bundled browser dependencies
- `manual/` - design documents and operation guides
- `setting/` - local application settings and test definitions

## Files Not Included

Runtime and private data are intentionally excluded:

- `data/`
- `public/`
- `cgi-bin/user/`
- `cgi-bin/data/environment`
- `server/data/environment`
- logs, caches, generated archives
- `server/bin/ffmpeg` and `server/bin/ffprobe`

Create local environment files from the included examples before running CGI
scripts.

## GitHub Upload

```powershell
cd C:\Apache24\htdocs\wu_wei2\GIT
git init -b main
git add .
git commit -m "Initial WuWei 2 snapshot"
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
```

If `git init -b main` is not supported, run:

```powershell
git init
git branch -M main
```

