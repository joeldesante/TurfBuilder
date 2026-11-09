# Maintenance mode

`MAINTENANCE_MODE=true` makes every request answer a 503 "down for maintenance" page before the app reads or writes the database. Use it while running a data migration. It does not stop work already running (list PDF generation, the backfill Job) or the deploy migration step.

It is an environment variable, not a system setting, because settings live in the database.

## Locally

Set `MAINTENANCE_MODE=true` in `.env` and restart the dev server.

## Kubernetes

The deployments read an optional ConfigMap, created by hand so a deploy never switches it off by accident:

| Environment | ConfigMap |
|-------------|-----------|
| production | `turfbuilder-maintenance` |
| staging | `turfbuilder-maintenance-staging` |

Turn it on (pods read it at start, so restart them):

```bash
kubectl create configmap turfbuilder-maintenance -n turfbuilder \
  --from-literal=MAINTENANCE_MODE=true --dry-run=client -o yaml | kubectl apply -f -
kubectl rollout restart deployment/turfbuilder-production -n turfbuilder
```

Turn it off:

```bash
kubectl delete configmap turfbuilder-maintenance -n turfbuilder
kubectl rollout restart deployment/turfbuilder-production -n turfbuilder
```

For staging use `turfbuilder-maintenance-staging` and `deployment/turfbuilder-staging`.

A ConfigMap that is left in place stays on through later deploys. Delete it when the work is done.
