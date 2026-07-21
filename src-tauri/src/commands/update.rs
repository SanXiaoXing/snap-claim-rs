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

/// 已下载的更新数据：Update 对象 + 安装包二进制，供用户确认后再安装。
pub struct PendingDownload(pub Mutex<Option<(Update, Vec<u8>)>>);

/// 检查是否有新版本。返回 None 表示已是最新。
#[command]
pub async fn check_for_update(
    app: AppHandle,
    pending: State<'_, PendingDownload>,
) -> Result<Option<UpdateInfo>, AppError> {
    let updater = app.updater().map_err(|e| AppError::Updater(e.to_string()))?;
    let update = updater
        .check()
        .await
        .map_err(|e| AppError::Updater(e.to_string()))?;

    // 存储 pending update 供后续下载
    if let Some(u) = &update {
        *pending.0.lock().unwrap() = Some((u.clone(), Vec::new()));
    }

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
    pending: State<'_, PendingDownload>,
    on_event: Channel<DownloadProgressEvent>,
) -> Result<(), AppError> {
    let (update, _) = pending
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
            *pending.0.lock().unwrap() = Some((update, bytes));
            Ok(())
        }
        Err(e) => {
            // 下载失败把 Update 放回去，允许再次下载
            *pending.0.lock().unwrap() = Some((update, Vec::new()));
            Err(AppError::Updater(e.to_string()))
        }
    }
}

/// 安装已下载的更新包并重启应用。
#[command]
pub async fn install_update(
    pending: State<'_, PendingDownload>,
    app: AppHandle,
) -> Result<(), AppError> {
    let (update, bytes) = pending
        .0
        .lock()
        .unwrap()
        .take()
        .ok_or(UpdateError::NoPendingUpdate)?;

    if bytes.is_empty() {
        return Err(UpdateError::NoDownloadedPackage.into());
    }

    update
        .install(&bytes)
        .map_err(|e| AppError::Updater(e.to_string()))?;

    app.restart();
}
