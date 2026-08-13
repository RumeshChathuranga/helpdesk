// Mirrors .github/workflows/ci.yml's lint/typecheck/test/build stages as a
// Jenkins fluency demo — GitHub Actions stays the real gate 
pipeline {
  agent none

  environment {
    BUN_IMAGE = 'oven/bun:1.3.5'
    PLACEHOLDER_DATABASE_URL = 'postgresql://user:password@localhost:5432/placeholder'
  }

  options {
    timeout(time: 30, unit: 'MINUTES')
  }

  stages {
    stage('Install') {
      agent { docker { image "${env.BUN_IMAGE}" } }
      environment {
        DATABASE_URL = "${env.PLACEHOLDER_DATABASE_URL}"
      }
      steps {
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
