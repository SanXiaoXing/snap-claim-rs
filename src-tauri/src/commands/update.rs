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
    #[error("没有已下载的更新包")]
    NoDownloadedPackage,
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

/// 已下载的更新包二进制数据，供用户确认后再安装。
pub struct PendingUpdateBytes(pub Mutex<Option<Vec<u8>>>);

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

    // 存储 pending update 供后续下载/安装
    *pending_update.0.lock().unwrap() = update.clone();

    Ok(update.map(|u| UpdateInfo {
        version: u.version.clone(),
        notes: u.body.clone().unwrap_or_default(),
        pub_date: u.date.map(|d| d.to_string()),
    }))
}

/// 下载更新包，进度通过 Channel 推送，完成后暂存二进制数据。
/// 用户确认后再调用 install_update 执行安装并重启。
#[command]
pub async fn download_update(
    pending_update: State<'_, PendingUpdate>,
    pending_bytes: State<'_, PendingUpdateBytes>,
    on_event: Channel<DownloadProgressEvent>,
) -> Result<(), AppError> {
    let update = pending_update
        .0
        .lock()
        .unwrap()
        .take()
        .ok_or(UpdateError::NoPendingUpdate)?;

    let mut started = false;

    let result = update
        .download(
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
        .await;

    match result {
        Ok(bytes) => {
            *pending_bytes.0.lock().unwrap() = Some(bytes);
            Ok(())
        }
        Err(e) => {
            // 下载失败把 Update 放回去，允许再次下载
            *pending_update.0.lock().unwrap() = Some(update);
            Err(AppError::Updater(e.to_string()))
        }
    }
}

/// 安装已下载的更新包并重启应用。
#[command]
pub async fn install_update(
    pending_update: State<'_, PendingUpdate>,
    pending_bytes: State<'_, PendingUpdateBytes>,
    app: AppHandle,
) -> Result<(), AppError> {
    let update = pending_update
        .0
        .lock()
        .unwrap()
        .take()
        .ok_or(UpdateError::NoPendingUpdate)?;

    let bytes = pending_bytes
        .0
        .lock()
        .unwrap()
        .take()
        .ok_or(UpdateError::NoDownloadedPackage)?;

    update
        .install(&bytes)
        .map_err(|e| AppError::Updater(e.to_string()))?;

    app.restart();
}
