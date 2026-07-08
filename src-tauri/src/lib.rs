mod commands;
mod config;
mod error;
mod models;
mod services;
mod utils;

use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;

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
        .invoke_handler(tauri::generate_handler![
            commands::recognition::recognize_invoices,
        ])
        .setup(|app| {
            // ponytail: 原生菜单栏——自定义项 emit id 给前端分发，原生子项(quit/about)自处理
            let quit = PredefinedMenuItem::quit(app, None)?;
            let pkg = app.package_info();
            let about_meta = AboutMetadata {
                name: Some(pkg.name.to_string()),
                version: Some(pkg.version.to_string()),
                authors: Some(vec![pkg.authors.to_string()]),
                comments: Some(pkg.description.to_string()),
                ..Default::default()
            };
            let about = PredefinedMenuItem::about(app, None, Some(about_meta))?;

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
                    &MenuItem::with_id(app, "file_merge", "合并 PDF", true, None::<&str>)?,
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