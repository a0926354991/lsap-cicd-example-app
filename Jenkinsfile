import groovy.json.JsonOutput

pipeline {
    agent any
    options { timestamps() }

    environment {
        // --- 請確認以下資訊 ---
        STUDENT_NAME = "陳庭宇"
        STUDENT_ID   = "B11705053"

        // 你的 Docker Hub 倉庫 (從你之前的截圖確認是這個)
        IMAGE_REPO = "timmy1110/lsap-cicd-example-app"

        // App 內部 Port
        APP_PORT = "3000"

        // 容器與 Port 設定
        DEV_CONTAINER  = "dev-app"
        PROD_CONTAINER = "prod-app"
        DEV_HOST_PORT  = "8081"
        PROD_HOST_PORT = "8082"

        // 憑證 ID (要跟 Jenkins 裡設定的一樣)
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

        // --- Dev 階段：建置、推送、部署 (包含加分題邏輯) ---
        stage('Dev: Build + Push + Deploy (8081) + Verify') {
            when { branch 'dev' }
            steps {
                script {
                    // 定義變數
                    def devTag = "dev-${env.BUILD_NUMBER}"
                    def devImage = "${env.IMAGE_REPO}:${devTag}"

                    // 使用 withCredentials 直接拿帳密 (修復 No such property: docker 的問題)
                    withCredentials([usernamePassword(credentialsId: env.DOCKERHUB_CREDS_ID,
                                                      usernameVariable: 'DH_USER',
                                                      passwordVariable: 'DH_PASS')]) {
                        
                        // 1. 登入 Docker Hub
                        sh '''
                            set +x
                            echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
                            set -x
                        '''

                        // --- 加分題邏輯開始 ---
                        // 2. 讀取 package.json 的版本號 (例如 1.1.0)
                        def pkgVersion = sh(script: "node -p \"require('./package.json').version\"", returnStdout: true).trim()
                        echo "Detected Version: ${pkgVersion}"
                        
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

                    // 6. 部署到 Port 8081
                    // 先移除舊的容器 (如果存在)
                    sh "docker rm -f ${env.DEV_CONTAINER} || true"
                    // 啟動新容器
                    sh "docker run -d --name ${env.DEV_CONTAINER} -p ${env.DEV_HOST_PORT}:${env.APP_PORT} ${devImage}"
                    
                    // 7. 驗證 Health Check
                    sleep 5
                    sh "curl -fsS http://localhost:${env.DEV_HOST_PORT}/health"
                }
            }
        }

        // --- Main 階段：GitOps 晉升部署 (不重新 Build) ---
        stage('Main: Promote (NO BUILD) + Deploy (8082)') {
            when { branch 'main' }
            steps {
                script {
                    // 1. 讀取 deploy.config 裡的版本號 (去掉換行符號)
                    def targetTag = sh(returnStdout: true, script: "tr -d '\\r\\n\\t ' < deploy.config").trim()
                    if (!targetTag) { error("deploy.config is empty (should be like dev-15)") }

                    def srcImage  = "${env.IMAGE_REPO}:${targetTag}"
                    def prodTag   = "prod-${env.BUILD_NUMBER}"
                    def prodImage = "${env.IMAGE_REPO}:${prodTag}"

                    // 2. 登入並執行 Retag (晉升)
                    withCredentials([usernamePassword(credentialsId: env.DOCKERHUB_CREDS_ID,
                                                      usernameVariable: 'DH_USER',
                                                      passwordVariable: 'DH_PASS')]) {
                        sh '''
                            set +x
                            echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin
                            set -x
                        '''
                        
                        // 拉取舊版 -> 改名 -> 推送新版
                        sh """
                            set -eux
                            docker pull ${srcImage}
                            docker tag ${srcImage} ${prodImage}
                            docker push ${prodImage}

                            # 部署到 Port 8082
                            docker rm -f ${PROD_CONTAINER} || true
                            docker run -d --name ${PROD_CONTAINER} -p ${PROD_HOST_PORT}:${APP_PORT} ${prodImage}
                        """
                    }
                }
            }
        }
    }

    // --- ChatOps 通知 ---
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

                // 產生 JSON payload
                def payload = JsonOutput.toJson([content: msg])
                writeFile file: 'chat_payload.json', text: payload

                // 發送 Webhook
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
