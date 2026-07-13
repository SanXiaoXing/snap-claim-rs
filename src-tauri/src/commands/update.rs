use crate::error::AppError;
use crate::models::UpdateInfo;
use tauri::{command, AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

/// 检查是否有新版本。返回 None 表示已是最新。
#[command]
pub async fn check_for_update(app: AppHandle) -> Result<Option<UpdateInfo>, AppError> {
    let updater = app.updater().map_err(|e| AppError::Updater(e.to_string()))?;
    let update = updater
        .check()
        .await
        .map_err(|e| AppError::Updater(e.to_string()))?;

    Ok(update.map(|u| UpdateInfo {
        version: u.version.clone(),
        notes: u.body.clone().unwrap_or_default(),
        pub_date: u.date.map(|d| d.to_string()),
    }))
}

/// 下载并安装更新，进度通过 `updater://progress` 事件推送，完成后重启。
#[command]
pub async fn install_update(app: AppHandle) -> Result<(), AppError> {
    let updater = app.updater().map_err(|e| AppError::Updater(e.to_string()))?;
    let update = updater
        .check()
        .await
        .map_err(|e| AppError::Updater(e.to_string()))?
        .ok_or_else(|| AppError::Updater("没有可用的更新".into()))?;

    let app_for_progress = app.clone();
    update
        .download_and_install(
            move |downloaded, total| {
                let _ = app_for_progress.emit("updater://progress", (downloaded, total));
            },
            || {},
        )
        .await
        .map_err(|e| AppError::Updater(e.to_string()))?;

    // 安装完成，重启应用
    app.restart();
}
