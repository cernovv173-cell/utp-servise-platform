plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val firebaseConfigJson = providers.environmentVariable("UTP_FIREBASE_ANDROID_CONFIG_JSON").orNull?.trim()
val yandexClientId = providers.environmentVariable("YANDEX_CLIENT_ID").orNull?.trim().orEmpty()
val vkIdAppId = providers.environmentVariable("VK_ID_APP_ID").orNull?.trim().orEmpty()
val vkIdClientSecret = providers.environmentVariable("VK_ID_CLIENT_SECRET").orNull?.trim().orEmpty()
val releaseKeystorePath = providers.environmentVariable("UTP_RELEASE_KEYSTORE_PATH").orNull
val releaseStorePassword = providers.environmentVariable("UTP_RELEASE_STORE_PASSWORD").orNull
val releaseKeyAlias = providers.environmentVariable("UTP_RELEASE_KEY_ALIAS").orNull
val releaseKeyPassword = providers.environmentVariable("UTP_RELEASE_KEY_PASSWORD").orNull
val googleServicesFile = file("google-services.json")
if (!firebaseConfigJson.isNullOrBlank()) {
    val firebaseConfig = try {
        groovy.json.JsonSlurper().parseText(firebaseConfigJson) as Map<*, *>
    } catch (failure: Exception) {
        throw GradleException("UTP_FIREBASE_ANDROID_CONFIG_JSON must contain valid JSON.", failure)
    }
    val packageNames = (firebaseConfig["client"] as? List<*>)
        .orEmpty()
        .mapNotNull { client ->
            val clientInfo = (client as? Map<*, *>)?.get("client_info") as? Map<*, *>
            val androidInfo = clientInfo?.get("android_client_info") as? Map<*, *>
            androidInfo?.get("package_name") as? String
        }
    if ("ru.utp.servise" !in packageNames) {
        throw GradleException("The supplied Firebase Android config must include package ru.utp.servise.")
    }
    googleServicesFile.writeText(firebaseConfigJson, Charsets.UTF_8)
} else if (!googleServicesFile.isFile) {
    logger.warn("UTP_FIREBASE_ANDROID_CONFIG_JSON is empty; Firebase push notifications will be unavailable in this build.")
}
if (!firebaseConfigJson.isNullOrBlank() || googleServicesFile.isFile) {
    pluginManager.apply("com.google.gms.google-services")
}
android {
    namespace = "ru.utp.servise"
    compileSdk = 36

    defaultConfig {
        if (yandexClientId.isNotBlank() && !yandexClientId.matches(Regex("[A-Za-z0-9_-]{8,128}"))) {
            throw GradleException("YANDEX_CLIENT_ID must be a valid Yandex OAuth app identifier.")
        }
        manifestPlaceholders["YANDEX_CLIENT_ID"] = yandexClientId
        manifestPlaceholders["VKIDClientID"] = vkIdAppId
        manifestPlaceholders["VKIDClientSecret"] = vkIdClientSecret
        manifestPlaceholders["VKIDRedirectHost"] = "vk.ru"
        manifestPlaceholders["VKIDRedirectScheme"] = "vk$vkIdAppId"
        applicationId = "ru.utp.servise"
        minSdk = 26
        targetSdk = 35
        versionCode = 59
        versionName = "1.5.25"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
    defaultConfig {
        buildConfigField(
            "String",
            "API_BASE_URL",
            "\"${providers.environmentVariable("UTP_API_BASE_URL").orNull.orEmpty().trimEnd('/')}\""
        )
        buildConfigField("String", "YANDEX_CLIENT_ID", "\"$yandexClientId\"")
        buildConfigField("String", "VK_ID_APP_ID", "\"$vkIdAppId\"")
    }
    signingConfigs {
        create("release") {
            storeFile = releaseKeystorePath
                ?.takeIf { it.isNotBlank() }
                ?.let { file(it) }
            storePassword = releaseStorePassword?.takeIf { it.isNotBlank() }
            keyAlias = releaseKeyAlias?.takeIf { it.isNotBlank() }
            keyPassword = releaseKeyPassword?.takeIf { it.isNotBlank() }
        }
    }
    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
            manifestPlaceholders["VKIDClientID"] = ""
            manifestPlaceholders["VKIDClientSecret"] = ""
            manifestPlaceholders["VKIDRedirectScheme"] = "vk"
            buildConfigField("String", "VK_ID_APP_ID", "\"\"")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.08.00")
    implementation(platform("com.google.firebase:firebase-bom:34.19.0"))
    implementation("com.google.firebase:firebase-messaging")
    implementation(composeBom)
    androidTestImplementation(composeBom)
    implementation("androidx.compose.animation:animation")
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material:material-icons-core")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.2")
    implementation("androidx.navigation:navigation-compose:2.9.8")
    implementation("com.google.android.gms:play-services-code-scanner:16.1.0")
    implementation("com.google.zxing:core:3.5.4")
    implementation("com.yandex.android:authsdk:3.1.3")
    implementation("com.vk.id:vkid:2.7.3")
    testImplementation("junit:junit:4.13.2")
    debugImplementation("androidx.compose.ui:ui-tooling")
}
