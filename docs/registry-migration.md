# MCP registry namespace migration

Status: [maintainer request 1684](https://github.com/modelcontextprotocol/registry/issues/1684) submitted on 3 October 2026; administrator action is pending. The working website, npm package and hosted connector remain at their current production versions until the migration release is merged.

## Verified state, 3 October 2026

| Item | Value |
|---|---|
| Previous namespace | `io.github.Bahamas1717/aibvf-mcp` |
| Previous latest version | `0.12.0` |
| Current namespace | `io.github.Craig-Horton/aibvf-mcp` |
| Published current version | `0.14.14`, npm transport |
| Reserved hosted URL | `https://mcp.aibvf.com/api/mcp` |
| Repository continuity | Both repository paths identify repository `1174231803` |
| Prepared migration release | MCP `0.14.15`, core `0.10.6` unchanged |

The [successful runtime verification](https://github.com/Craig-Horton/ai-bvf/actions/runs/37111842036) confirms the published package, hosted endpoint and both registry identities. The old GitHub API route returns a redirect to repository `1174231803`; the current route identifies that repository as Craig-Horton/ai-bvf.

## Required registry action

Current GitHub credentials authorize the Craig-Horton namespace. There is no supported rename API, and the old login no longer grants this connection access to the Bahamas1717 namespace.

A registry administrator must release the reservation across every old version. Official [status handling](https://github.com/modelcontextprotocol/registry/blob/bf4e88cbe8d1a635c06144ccea1d24cb52fa6186/internal/api/handlers/v0/status.go#L237) requires namespace permission, and the [URL conflict check](https://github.com/modelcontextprotocol/registry/blob/bf4e88cbe8d1a635c06144ccea1d24cb52fa6186/internal/service/registry_service.go#L301) considers non-deleted versions. Deprecated versions still reserve their URLs.

The [FAQ](https://github.com/modelcontextprotocol/registry/blob/bf4e88cbe8d1a635c06144ccea1d24cb52fa6186/docs/modelcontextprotocol-io/faq.mdx#L19) explains that deleted status preserves historical records. Existing requests [1662](https://github.com/modelcontextprotocol/registry/issues/1662) and [1682](https://github.com/modelcontextprotocol/registry/issues/1682) report the same account-rename limitation.

## Maintainer request

Destination: https://github.com/modelcontextprotocol/registry/issues

Title: Release orphaned io.github.Bahamas1717/aibvf-mcp after GitHub account rename

Please mark all versions of `io.github.Bahamas1717/aibvf-mcp` as `deleted`, with the status message `Moved to io.github.Craig-Horton/aibvf-mcp`, and release its reservation of `https://mcp.aibvf.com/api/mcp`. If a supported ownership migration is preferable, please transfer the old namespace authority to the current publisher.

The GitHub account now uses Craig-Horton. The current package listing is `io.github.Craig-Horton/aibvf-mcp` version 0.14.14, while the old listing still reports version 0.12.0 and reserves the working hosted endpoint.

### Ownership evidence

- Current source: https://github.com/Craig-Horton/ai-bvf
- Former source: https://github.com/Bahamas1717/ai-bvf
- The former repository API returns `Moved Permanently` to `https://api.github.com/repositories/1174231803`.
- The current repository API reports the same repository ID, `1174231803`, with `full_name: Craig-Horton/ai-bvf`.
- Current repository owner: `Craig-Horton`, public GitHub account ID `167990311`.
- npm package: https://www.npmjs.com/package/aibvf-mcp
- Current release: https://github.com/Craig-Horton/ai-bvf/releases/tag/v0.14.14

### Publication failure

On 3 October 2026, adding the existing hosted endpoint to the current namespace returned:

```text
remote URL https://mcp.aibvf.com/api/mcp is already used by server io.github.Bahamas1717/aibvf-mcp
```

Evidence: https://github.com/Craig-Horton/ai-bvf/actions/runs/37111342235/attempts/3

Publishing the current npm-only listing succeeded after omitting the remote entry. The hosted service remains available. We want the registry's remote discovery to point to the current publisher.

### Why publisher credentials cannot complete this

The registry derives GitHub namespace permissions from the current login or repository owner. Current Craig-Horton credentials therefore do not grant edit rights to `io.github.Bahamas1717/*`.

This matches #1662 and #1682. Deprecated records still reserve remote URLs, so please apply the change across all old versions or confirm an equivalent migration that releases the reservation.

We can provide a repository commit or a domain-control challenge if required. After the reservation is released, we will publish the prepared current-namespace release with the same hosted URL.

## Completion procedure

1. Track [request 1684](https://github.com/modelcontextprotocol/registry/issues/1684) and record the administrator's resolution.
2. Verify every old registry version is deleted, or confirm an equivalent ownership transfer that releases the URL.
3. Recheck the working hosted endpoint and the current namespace before publication.
4. Merge the tested MCP 0.14.15 release change. The release keeps core 0.10.6 and restores the hosted entry in `server.json`.
5. Verify npm installation, MCP registry version 0.14.15, the hosted remote entry and the GitHub release.
6. Update this record and the adoption plan with the resolution evidence.

Publishing another version under the old name, or merely deprecating the old listing, does not clear historical active URL reservations. Keep the migration release unmerged until step 2 is satisfied.
