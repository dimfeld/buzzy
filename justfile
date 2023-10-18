set dotenv-load

_default:
  @just --list

dev:
  just dev-web &
  just run-model-backend &
  just run-mimic

dev-web:
  cd packages/web && pnpm dev

run:
  just run-web &
  just run-model-backend &
  just run-mimic

run-web:
  cd packages/web && node server/index.js

run-mimic:
  cd packages/mimic3 && rye run mimic3-server \
    --host={{env_var_or_default('MIMIC_HOST', '127.0.0.1')}} \
    --port {{env_var('MIMIC_PORT')}} \
    --preload-voice {{env_var('MIMIC_VOICE')}} \
    --voice {{env_var('MIMIC_VOICE')}}

run-model-backend:
  cd packages/model-backend-py && rye run \
    uvicorn \
      --reload \
      --port {{env_var('FASTAPI_PORT')}} \
      --app-dir src/model_backend_py \
      app:app
