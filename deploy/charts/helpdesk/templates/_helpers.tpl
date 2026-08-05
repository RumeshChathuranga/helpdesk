{{- define "helpdesk.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "helpdesk.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "helpdesk.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "helpdesk.labels" -}}
helm.sh/chart: {{ include "helpdesk.chart" . }}
{{ include "helpdesk.selectorLabels" . }}
app.kubernetes.io/version: {{ .Values.image.tag | default .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "helpdesk.selectorLabels" -}}
app.kubernetes.io/name: {{ include "helpdesk.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "helpdesk.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "helpdesk.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{- define "helpdesk.image" -}}
{{- printf "%s:%s" .Values.image.repository (.Values.image.tag | default .Chart.AppVersion) }}
{{- end }}

{{/*
Env shared by the API, the worker and the migration Job. DATABASE_URL is read
straight from the secret CloudNativePG generates, so it never passes through
values, a shell, or git.
*/}}
{{- define "helpdesk.envFrom" -}}
- configMapRef:
    name: {{ include "helpdesk.fullname" . }}
- secretRef:
    name: {{ .Values.existingSecret }}
{{- end }}

{{- define "helpdesk.databaseEnv" -}}
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: {{ .Values.database.secretName }}
      key: {{ .Values.database.secretKey }}
{{- end }}

{{/*
Probes, parameterised by port. Liveness deliberately hits /live, which never
touches the database — a slow Postgres must not get the process killed.
*/}}
{{- define "helpdesk.probes" -}}
startupProbe:
  httpGet:
    path: /api/health/live
    port: http
  periodSeconds: {{ .root.Values.probes.startup.periodSeconds }}
  failureThreshold: {{ .root.Values.probes.startup.failureThreshold }}
livenessProbe:
  httpGet:
    path: /api/health/live
    port: http
  periodSeconds: {{ .root.Values.probes.liveness.periodSeconds }}
  timeoutSeconds: {{ .root.Values.probes.liveness.timeoutSeconds }}
  failureThreshold: {{ .root.Values.probes.liveness.failureThreshold }}
readinessProbe:
  httpGet:
    path: /api/health/ready
    port: http
  periodSeconds: {{ .root.Values.probes.readiness.periodSeconds }}
  timeoutSeconds: {{ .root.Values.probes.readiness.timeoutSeconds }}
  failureThreshold: {{ .root.Values.probes.readiness.failureThreshold }}
{{- end }}
