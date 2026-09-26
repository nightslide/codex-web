# Browser asset builds

`npm run build:browser` builds the browser adapter, prepares gzip variants, and
publishes a versioned asset snapshot.
Run `npm run build:server` and restart the web server after deploying a build.

The upstream bundle filenames do not change when this project patches their
contents. They therefore cannot safely receive immutable cache headers on their
original URLs. Published HTML points its scripts and styles to
`/__codex_assets/<revision>/assets/…`; relative module imports use the same
revision. These URLs are served with a one-year immutable cache policy. HTML is
revalidated so a reload can discover the current revision. Unversioned asset
URLs retain their existing revalidation behavior.

Snapshots are stored under `scratch/asar/webview-builds/releases`. Their objects
are deduplicated by content hash under `webview-builds/objects`, independently of
the mutable build inputs. Changing an upstream filename's contents creates a
new revision while older tabs can still load their original chunks. Unchanged
assets do not occupy additional space in each release. Do not modify published
snapshots or their objects in place. Removing older snapshots can break lazy
imports in tabs that still use those releases; deployment cleanup must account
for that lifetime.

The npm package contains only the current release, not the mutable asset inputs,
object store, or older host releases. The publisher writes the release directory's
`.npmignore` accordingly. Legacy `/assets/…` URLs also resolve from the current
snapshot, so packaged installations retain those paths without storing the
assets twice. Replacing an installed npm package does not retain its older
snapshots: tabs using the previous package must reload after that upgrade. To
keep those tabs working, preserve their release directories during deployment.

Development trees without a published snapshot keep the original static-file
behavior. A malformed published manifest fails server startup rather than
silently serving files from a different release.

## Focused verification

```sh
node --test test/versioned-webview.test.mjs
npm run build:browser
npm run build:server
```

Measure cold navigation and same-context reload separately. Browser cache
headers reduce repeated network work; they do not remove JavaScript execution
or history rendering costs. Chromium with a mobile viewport is not a substitute
for a physical iPhone Safari measurement.
