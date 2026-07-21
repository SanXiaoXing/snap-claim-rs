mod commands;
mod config;
mod error;
mod models;
mod services;
mod utils;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;
use commands::update::PendingDownload;
use std::sync::Mutex;

/// 从命令行参数中提取文件路径（PDF + 图片），emit 给前端
fn emit_file_args(app: &tauri::AppHandle, args: &[String]) {
    const IMAGE_EXTS: &[&str] = &[".png", ".jpg", ".jpeg", ".webp", ".bmp"];
    let files: Vec<String> = args
        .iter()
        .filter(|a| {
            let lower = a.to_lowercase();
            lower.ends_with(".pdf") || IMAGE_EXTS.iter().any(|ext| lower.ends_with(ext))
        })
        .cloned()
        .collect();
    if !files.is_empty() {
        let _ = app.emit("file://open", files);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志（控制台输出，开发环境可看到识别过程）
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    // ponytail: 单实例——用户拖文件到任务栏图标或右键"打开方式"时，
    // Windows 会启动新进程传参；single-instance 将参数转发到已有实例，
    // 统一走 emit_file_args → file://open 事件。
    let args: Vec<String> = std::env::args().collect();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            emit_file_args(app, &argv);
        }))
        .manage(PendingDownload(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            commands::recognition::recognize_invoices,
            commands::recognition::recognize_from_text,
            commands::recognition::read_image_bytes,
            commands::pdf::merge_pdfs,
            commands::excel::export_excel,
            commands::update::check_for_update,
            commands::update::download_update,
            commands::update::install_update,
        ])
        .setup(move |app| {
            // 首次启动：如果命令行带了文件参数，也 emit 给前端
            emit_file_args(app.handle(), &args);
            // ponytail: 原生菜单栏——自定义项 emit id 给前端分发，原生子项(quit)自处理
            let quit = PredefinedMenuItem::quit(app, None)?;
            let about = MenuItem::with_id(app, "help_about", "关于 SnapClaim", true, None::<&str>)?;

            let file = Submenu::with_items(
                app,
                "文件",
                true,
                &[
                    &MenuItem::with_id(app, "file_add", "添加文件...", true, Some("CmdOrCtrl+O"))?,
                    &MenuItem::with_id(app, "file_clear", "清空", true, None::<&str>)?,
                    &quit,
                ],
            )?;

            let export = Submenu::with_items(
                app,
                "导出",
                true,
                &[
                    &MenuItem::with_id(app, "file_merge", "合并 PDF", true, Some("CmdOrCtrl+M"))?,
                    &MenuItem::with_id(app, "file_export", "导出报销单", true, Some("CmdOrCtrl+E"))?,
                ],
            )?;

            let theme = Submenu::with_items(
                app,
                "主题",
                true,
                &[
                    &MenuItem::with_id(app, "theme_Clean Office", "Clean Office", true, None::<&str>)?,
                    &MenuItem::with_id(app, "theme_High Contrast", "High Contrast", true, None::<&str>)?,
                    &MenuItem::with_id(app, "theme_Dark Pro", "Dark Pro", true, None::<&str>)?,
                    &MenuItem::with_id(app, "theme_Soft Minimal", "Soft Minimal", true, None::<&str>)?,
                    &MenuItem::with_id(app, "theme_Corporate Trust", "Corporate Trust", true, None::<&str>)?,
                ],
            )?;

            let help = Submenu::with_items(
                app,
                "帮助",
                true,
                &[
                    &MenuItem::with_id(app, "help_check_update", "检查更新...", true, None::<&str>)?,
                    &PredefinedMenuItem::separator(app)?,
                    &about,
                ],
            )?;

            let menu = Menu::with_items(app, &[&file, &export, &theme, &help])?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            // ponytail: 统一 emit id 给前端按 id 分发，避免后端 match 膨胀；原生子项不进这里
            let _ = app.emit("menu://event", event.id().as_ref());
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}