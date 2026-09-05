# Security and local operation

This is a local research application, not an Internet-facing service. No security review can guarantee that a computer cannot be compromised.

## September 2026 security update

* Bind only to loopback. Do not forward port 8892, create public tunnels, or run as administrator.
* HTTP requests require an exact loopback Host and same-origin browser context. JSON writes require a per-process session token; the browser obtains it automatically. External Python clients must GET `/api/security-token` and send its `token` as `X-Local-CSRF` on POST.
* Bodies are limited to 8 MiB, concurrent requests to 16, and calculation submissions to two. These limits reduce abuse but do not bound the memory/time of every scientific library.
* Static responses use the reviewed `static-files.json` allowlist; hidden files, arbitrary newly added files, links/junctions and private research output are not published automatically. Selected multiquark exports require the local session cookie.
* Three.js and Lucide runtime resources are vendored; provenance is in `vendor-integrity.json`. Additional optional tools still need their own security review.

Keep OS, GPU drivers and Python up to date. Do not import untrusted executable scripts, model files, plugins or scientific datasets merely because they came from another researcher. Existing downloads/installations do not update themselves: pull this update and restart the server.

## Verification

Run `python -m pytest tests/test_local_security.py tests/test_discovery_chain_http.py` from the repository root. Tests use temporary local servers and reject foreign origins/Host headers, missing tokens, oversized requests, private paths and saturated job slots.

Report suspected vulnerabilities privately to the repository owner; do not publish credentials, private datasets or weaponized demonstrations in public issues. This update is targeted hardening, not a complete penetration test, dependency certification or review of every historical commit.
