import groovy.json.JsonOutput

pipeline {
  agent any
  options { timestamps() }

  environment {
    // TODO: 改成你自己的
    STUDENT_NAME = "陳庭宇"
    STUDENT_ID   = "B11705053"

    // TODO: 改成你的 Docker Hub repo，例如：a0926354991/lsap-cicd-example-app
    IMAGE_REPO = "timmy1110/lsap-cicd-example-app"

    // 你的 app 在 container 內監聽 3000（你剛剛已驗證）
    APP_PORT = "3000"

    DEV_CONTAINER  = "dev-app"
    PROD_CONTAINER = "prod-app"
    DEV_HOST_PORT  = "8081"
    PROD_HOST_PORT = "8082"

    DOCKERHUB_CREDS_ID = "dockerhub-creds"
    CHAT_WEBHOOK_ID    = "chat-webhook-url"
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Static Analysis') {
      steps {
        sh 'npm ci'
        sh 'npm run lint'
      }
    }

    stage('Dev: Build + Push + Deploy (8081) + Verify') {
            when { branch 'dev' }
            steps {
                script {
                    // 定義基本的變數
                    def devTag = "dev-${env.BUILD_NUMBER}"
                    def devImage = "${env.IMAGE_REPO}:${devTag}"

                    docker.withRegistry('', env.DOCKERHUB_CREDS_ID) {
                        // --- 加分題邏輯開始 ---
                        // 1. 讀取 package.json 的版本號 (例如 1.1.0)
                        def pkgVersion = sh(script: "node -p \"require('./package.json').version\"", returnStdout: true).trim()
                        echo "Detected Version: ${pkgVersion}"
                        
                        // 2. 登入 Docker Hub
                        sh """
                            set +x
                            echo "\$DH_PASS" | docker login -u "\$DH_USER" --password-stdin
                            set -x
                        """

                        // 3. 建立 Image
                        sh "docker build -t ${devImage} ."
                        
                        // 4. 推送基本的 dev-XX Tag
                        sh "docker push ${devImage}"
                        
                        // 5. 推送加分的 Semantic Version Tag (例如 v1.1.0)
                        def semanticImage = "${env.IMAGE_REPO}:v${pkgVersion}"
                        sh "docker tag ${devImage} ${semanticImage}"
                        sh "docker push ${semanticImage}"
                        // --- 加分題邏輯結束 ---
                    }

                    // 部署到 Port 8081 (維持原樣)
                    sh "docker rm -f ${env.DEV_CONTAINER} || true"
                    sh "docker run -d --name ${env.DEV_CONTAINER} -p ${env.DEV_HOST_PORT}:${env.APP_PORT} ${devImage}"
                    
                    sleep 2
                    sh "curl -fsS http://localhost:${env.DEV_HOST_PORT}/health"
                }
            }
        }

    stage('Main: Promote (NO BUILD) + Deploy (8082)') {
      when { branch 'main' }
      steps {
        script {
          def targetTag = sh(returnStdout: true, script: "tr -d '\\r\\n\\t ' < deploy.config").trim()
          if (!targetTag) { error("deploy.config is empty (should be like dev-15)") }

          def srcImage  = "${env.IMAGE_REPO}:${targetTag}"
          def prodTag   = "prod-${env.BUILD_NUMBER}"
          def prodImage = "${env.IMAGE_REPO}:${prodTag}"

          withCredentials([usernamePassword(credentialsId: env.DOCKERHUB_CREDS_ID,
                                            usernameVariable: 'DH_USER',
                                            passwordVariable: 'DH_PASS')]) {
            sh '''
              set -eux
              echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
            '''
          }

          sh """
            set -eux
            docker pull ${srcImage}
            docker tag ${srcImage} ${prodImage}
            docker push ${prodImage}

            docker rm -f ${PROD_CONTAINER} || true
            docker run -d --name ${PROD_CONTAINER} -p ${PROD_HOST_PORT}:${APP_PORT} ${prodImage}
          """
        }
      }
    }
  }

  post {
    failure {
      script {
        def gitUrl = sh(returnStdout: true, script: "git config --get remote.origin.url || true").trim()
        if (!gitUrl) { gitUrl = "unknown" }

        def msg = """❌ CI/CD Build Failed
Name: ${env.STUDENT_NAME}
Student ID: ${env.STUDENT_ID}
Job Name: ${env.JOB_NAME}
Build Number: ${env.BUILD_NUMBER}
GitHub Repo URL: ${gitUrl}
Branch: ${env.BRANCH_NAME}
Status: ${currentBuild.currentResult}
""".trim()

        def payload = JsonOutput.toJson([content: msg])
        writeFile file: 'chat_payload.json', text: payload

        withCredentials([string(credentialsId: env.CHAT_WEBHOOK_ID, variable: 'WEBHOOK_URL')]) {
          sh '''
            set -eux
            curl -fsS -H "Content-Type: application/json" -d @chat_payload.json "$WEBHOOK_URL"
          '''
        }
      }
    }
  }
}
