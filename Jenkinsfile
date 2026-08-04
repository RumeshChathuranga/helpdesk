// Mirrors .github/workflows/ci.yml's lint/typecheck/test/build stages as a
// Jenkins fluency demo — GitHub Actions stays the real gate (see
// CLAUDE.md's DevOps work section). This does not scan, SBOM, or sign;
// that stays exclusively in build-image.yml.
pipeline {
  agent none

  environment {
    BUN_IMAGE = 'oven/bun:1.3.5'
    // prisma.config.ts only needs DATABASE_URL present, not reachable, to
    // generate the client — same placeholder ci.yml uses for typecheck.
    PLACEHOLDER_DATABASE_URL = 'postgresql://user:password@localhost:5432/placeholder'
  }

  options {
    timeout(time: 30, unit: 'MINUTES')
  }

  stages {
    stage('Install') {
      agent { docker { image "${env.BUN_IMAGE}" } }
      environment {
        // server/package.json's postinstall is `bunx prisma generate`, so the
        // install itself loads prisma.config.ts and needs DATABASE_URL — this
        // is not only the Typecheck stage's concern. Locally it's invisible
        // because Bun auto-loads server/.env; this container has no such file.
        DATABASE_URL = "${env.PLACEHOLDER_DATABASE_URL}"
      }
      steps {
        // Jenkins workspaces persist across builds (unlike GitHub Actions'
        // always-fresh runners), so a previous build's node_modules can
        // still be sitting here. `--frozen-lockfile` only guarantees the
        // *current* lockfile's packages are present — it doesn't prune
        // packages left behind by an older lockfile — so a dependency that
        // moved versions (e.g. zod ^4.3.6 -> ^4.4.3) can leave both versions
        // on disk and let module resolution pick the stale one. Wipe first
        // so every build installs from a clean slate.
        sh 'rm -rf node_modules client/node_modules server/node_modules packages/core/node_modules'
        sh 'bun install --frozen-lockfile'
      }
    }

    stage('Lint') {
      agent { docker { image "${env.BUN_IMAGE}" } }
      steps {
        sh 'bun run lint'
      }
    }

    stage('Typecheck') {
      agent { docker { image "${env.BUN_IMAGE}" } }
      environment {
        DATABASE_URL = "${env.PLACEHOLDER_DATABASE_URL}"
      }
      steps {
        // The server imports generated Prisma types, so tsc needs the
        // client generated first — matches ci.yml's typecheck job.
        sh 'bun run --filter server db:generate'
        sh 'bun run typecheck'
      }
    }

    stage('Test (client)') {
      agent { docker { image "${env.BUN_IMAGE}" } }
      steps {
        sh 'bun run test:client'
      }
    }

    stage('Test (server)') {
      // Runs on the controller's built-in node (not a docker agent) so
      // this stage can start a sibling Postgres container and a sibling
      // Bun container side by side — mirrors the pgvector service
      // container in ci.yml's test-server job.
      agent any
      steps {
        script {
          docker.image('pgvector/pgvector:pg15').withRun(
            '-e POSTGRES_USER=user -e POSTGRES_PASSWORD=password ' +
            '-e POSTGRES_DB=helpdesk_test -p 5433:5432'
          ) { pg ->
            withEnv(["PG_CID=${pg.id}"]) {
              sh '''
                for i in $(seq 1 20); do
                  docker exec "$PG_CID" pg_isready -U user -d helpdesk_test && break
                  sleep 2
                done
              '''
            }

            // --network host: the sibling Postgres container published
            // 5433 to the *host*, and this is Docker-outside-of-Docker
            // (the controller shells out to the host's docker socket, not
            // a nested daemon) — two independently-networked sibling
            // containers can't otherwise reach each other by localhost.
            // Fine for a local one-node demo; not how Kubernetes will do
            // this in Phase 2.
            docker.image(env.BUN_IMAGE).inside('--network host') {
              withEnv([
                'DATABASE_URL=postgresql://user:password@localhost:5433/helpdesk_test?schema=public'
              ]) {
                sh 'cp server/.env.test.example server/.env.test'
                sh 'bun run --filter server db:generate'
                sh 'bun run db:migrate:deploy'
                sh 'bun run db:test:seed'
                sh 'bun run test:server'
              }
            }
          }
        }
      }
    }

    stage('Build image') {
      agent any
      steps {
        sh 'docker build -t helpdesk:jenkins-${BUILD_NUMBER} .'
      }
    }
  }
}
