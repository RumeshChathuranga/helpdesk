# Dev sealed secrets

`helpdesk-secrets.sealed.yaml` belongs here. It is encrypted with the cluster's Sealed Secrets
public key, so it is safe in git — only the controller running in the cluster can decrypt it.

It is not committed yet because sealing needs the controller's key from a live cluster. Generate
it with `kubeseal` following `devops-docs/setup/sealed-secrets.md`, then commit it; Argo CD picks
it up on the next sync.

Only `*.sealed.yaml` in this directory is synced — see
[deploy/argocd/apps/dev/20-helpdesk-secrets.yaml](../../../argocd/apps/dev/20-helpdesk-secrets.yaml).
Never put a plain `Secret` here.
