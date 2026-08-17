use crate::logger;

#[tauri::command]
pub fn record_frontend_metric(event: String, duration_ms: Option<f64>, context: Option<String>) {
    let context_suffix = match context.as_deref() {
        Some(context) if !context.trim().is_empty() => format!(" context={context}"),
        _ => String::new(),
    };

    match duration_ms {
        Some(duration_ms) => logger::info(
            "frontend.telemetry",
            format!("{event} duration_ms={duration_ms:.3}{context_suffix}"),
        ),
        None => logger::info("frontend.telemetry", format!("{event}{context_suffix}")),
    }
}
