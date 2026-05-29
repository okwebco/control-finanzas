#!/bin/bash
# =============================================================
# Control Finanzas — Setup GCP (ejecutar UNA sola vez)
# Proyecto: control-finanzas
# Dominio:  finanzas.jhonvelez.com
# =============================================================
set -e

PROJECT_ID="control-finanzas-ow"
REGION="us-central1"
SERVICE="control-finanzas"
AR_REPO="control-finanzas"
BUCKET="finanzas-jhonvelez-db"
DEPLOY_SA="cf-deploy"        # Service account para GitHub Actions
RUNTIME_SA="cf-runtime"      # Service account para el contenedor en producción

echo "==> Proyecto: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# ── 1. APIs necesarias ──────────────────────────────────────
echo "==> Habilitando APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  iam.googleapis.com

# ── 2. Artifact Registry ────────────────────────────────────
echo "==> Creando Artifact Registry repo..."
gcloud artifacts repositories create $AR_REPO \
  --repository-format=docker \
  --location=$REGION \
  --description="Control Finanzas — imágenes Docker"

# ── 3. GCS Bucket para SQLite persistente ───────────────────
echo "==> Creando bucket de base de datos..."
gcloud storage buckets create gs://$BUCKET \
  --location=$REGION \
  --uniform-bucket-level-access

# ── 4. Service account para el runtime (contenedor) ─────────
echo "==> Creando service account de runtime..."
gcloud iam service-accounts create $RUNTIME_SA \
  --display-name="Control Finanzas — Runtime"

RUNTIME_SA_EMAIL="${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com"

# Acceso a GCS bucket (lectura/escritura de SQLite)
gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
  --member="serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role="roles/storage.objectAdmin"

# Acceso a Secret Manager
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"

# ── 5. Secrets en Secret Manager ────────────────────────────
echo "==> Creando secrets en Secret Manager..."
echo -n "conFIN2071" | gcloud secrets create cf-app-password --data-file=-
echo -n "$(python3 -c 'import secrets; print(secrets.token_hex(32))')" | gcloud secrets create cf-secret-key --data-file=-
echo -n "7107631888" | gcloud secrets create cf-green-api-instance --data-file=-
echo -n "8abf8aa6fb5e4c01aa76ee44d458e7ea25748bd72819419195" | gcloud secrets create cf-green-api-token --data-file=-
echo -n "573122040393" | gcloud secrets create cf-whatsapp-phone --data-file=-

echo ""
echo ">>> SECRET_KEY generado aleatoriamente. Para ver el valor:"
echo "    gcloud secrets versions access latest --secret=cf-secret-key"

# ── 6. Service account para GitHub Actions (deploy) ─────────
echo "==> Creando service account para CI/CD..."
gcloud iam service-accounts create $DEPLOY_SA \
  --display-name="Control Finanzas — GitHub Actions Deploy"

DEPLOY_SA_EMAIL="${DEPLOY_SA}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/run.developer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/artifactregistry.writer"

# Permitir asignar el runtime SA al Cloud Run service
gcloud iam service-accounts add-iam-policy-binding $RUNTIME_SA_EMAIL \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"

# Generar clave JSON para GitHub
gcloud iam service-accounts keys create deploy/sa-key.json \
  --iam-account=$DEPLOY_SA_EMAIL

echo ""
echo ">>> Clave guardada en deploy/sa-key.json"
echo ">>> IMPORTANTE: copia su contenido como secreto GCP_SA_KEY en GitHub"
echo ">>> Luego borra el archivo: rm deploy/sa-key.json"

# ── 7. Primer despliegue manual ──────────────────────────────
echo ""
echo "==> Construcción y primer despliegue..."
IMAGE="us-central1-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/app:init"

gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
docker build -t "$IMAGE" .
docker push "$IMAGE"

gcloud run deploy $SERVICE \
  --image="$IMAGE" \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=1 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=60s \
  --service-account="$RUNTIME_SA_EMAIL" \
  --set-env-vars="DATABASE_URL=sqlite:////data/control_finanzas.db" \
  --set-secrets="APP_PASSWORD=cf-app-password:latest,SECRET_KEY=cf-secret-key:latest,GREEN_API_INSTANCE_ID=cf-green-api-instance:latest,GREEN_API_TOKEN=cf-green-api-token:latest,WHATSAPP_PHONE=cf-whatsapp-phone:latest" \
  --add-volume="name=db-vol,type=cloud-storage,bucket=${BUCKET}" \
  --add-volume-mount="volume=db-vol,mount-path=/data" \
  --project=$PROJECT_ID

echo ""
echo "✓ Servicio desplegado."
gcloud run services describe $SERVICE --region=$REGION --format="value(status.url)"

# ── 8. Dominio personalizado ─────────────────────────────────
echo ""
echo "==> Configurando dominio finanzas.jhonvelez.com..."
gcloud beta run domain-mappings create \
  --service=$SERVICE \
  --domain=finanzas.jhonvelez.com \
  --region=$REGION \
  --project=$PROJECT_ID

echo ""
echo ">>> Agrega este registro en tu DNS (Cloudflare u otro):"
gcloud beta run domain-mappings describe \
  --domain=finanzas.jhonvelez.com \
  --region=$REGION \
  --format="table(status.resourceRecords[].name,status.resourceRecords[].type,status.resourceRecords[].rrdata)"

echo ""
echo "=== Setup completo ==="
echo "Próximos pasos:"
echo "  1. Copia deploy/sa-key.json como secreto GCP_SA_KEY en GitHub"
echo "  2. Borra deploy/sa-key.json"
echo "  3. Agrega el registro DNS para finanzas.jhonvelez.com"
echo "  4. Cada push a main desplegará automáticamente"
