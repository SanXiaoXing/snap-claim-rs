mod commands;
mod config;
mod error;
mod models;
mod services;
mod utils;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;
use commands::update::PendingUpdate;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志（控制台输出，开发环境可看到识别过程）
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(PendingUpdate(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            commands::recognition::recognize_invoices,
            commands::pdf::merge_pdfs,
            commands::excel::export_excel,
            commands::update::check_for_update,
            commands::update::install_update,
        ])
        .setup(|app| {
            // ponytail: 原生菜单栏——自定义项 emit id 给前端分发，原生子项(quit)自处理
            let quit = PredefinedMenuItem::quit(app, None)?;
            let about = MenuItem::with_id(app, "help_about", "关于 SnapClaim", true, None::<&str>)?;

            let file = Submenu::with_items(
                app,
                "文件",
                true,
                &[
                    &MenuItem::with_id(app, "file_add", "添加 PDF...", true, Some("CmdOrCtrl+O"))?,
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