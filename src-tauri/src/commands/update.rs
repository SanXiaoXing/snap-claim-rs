use crate::error::AppError;
use crate::models::UpdateInfo;
use serde::Serialize;
use std::sync::Mutex;
use tauri::{command, ipc::Channel, AppHandle, State};
use tauri_plugin_updater::Update;
use tauri_plugin_updater::UpdaterExt;

#[derive(Debug, thiserror::Error, Serialize)]
pub enum UpdateError {
    #[error(transparent)]
    Updater(#[from] tauri_plugin_updater::Error),
    #[error("没有可用更新")]
    NoPendingUpdate,
}

impl From<UpdateError> for AppError {
    fn from(e: UpdateError) -> Self {
        AppError::Updater(e.to_string())
    }
}

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data")]
#[serde(rename_all = "camelCase")]
pub enum DownloadProgressEvent {
    Started { content_length: Option<u64> },
    Progress { chunk_length: usize },
    Finished,
}

pub struct PendingUpdate(pub Mutex<Option<Update>>);

/// 检查是否有新版本。返回 None 表示已是最新。
#[command]
pub async fn check_for_update(
    app: AppHandle,
    pending_update: State<'_, PendingUpdate>,
) -> Result<Option<UpdateInfo>, AppError> {
    let updater = app.updater().map_err(|e| AppError::Updater(e.to_string()))?;
    let update = updater
        .check()
        .await
        .map_err(|e| AppError::Updater(e.to_string()))?;

    // 存储 pending update 供后续安装
    *pending_update.0.lock().unwrap() = update.clone();

    Ok(update.map(|u| UpdateInfo {
        version: u.version.clone(),
        notes: u.body.clone().unwrap_or_default(),
        pub_date: u.date.map(|d| d.to_string()),
    }))
}

/// 下载并安装更新，进度通过 Channel 推送，完成后重启。
#[command]
pub async fn install_update(
    pending_update: State<'_, PendingUpdate>,
    on_event: Channel<DownloadProgressEvent>,
    app: AppHandle,
) -> Result<(), AppError> {
    // Take the update out of the mutex guard immediately before awaiting
    let Some(update) = pending_update.0.lock().unwrap().take() else {
        return Err(UpdateError::NoPendingUpdate.into());
    };

    let mut started = false;

    update
        .download_and_install(
            |chunk_length, content_length| {
                if !started {
                    let _ = on_event.send(DownloadProgressEvent::Started { content_length });
                    started = true;
                }
                let _ = on_event.send(DownloadProgressEvent::Progress { chunk_length });
            },
            || {
                let _ = on_event.send(DownloadProgressEvent::Finished);
            },
        )
        .await
        .map_err(|e| AppError::Updater(e.to_string()))?;

    // 安装完成，重启应用
    app.restart();
}
