use chrono::Local;
use std::{
    fs::{create_dir_all, File, OpenOptions},
    io::Write,
    path::PathBuf,
    sync::{Mutex, OnceLock},
};

#[derive(Clone, Copy)]
pub enum LogLevel {
    Error,
    Warn,
    Info,
    Debug,
}

impl LogLevel {
    fn as_str(self) -> &'static str {
        match self {
            Self::Error => "ERROR",
            Self::Warn => "WARN",
            Self::Info => "INFO",
            Self::Debug => "DEBUG",
        }
    }
}

struct Logger {
    file: Mutex<File>,
    file_path: PathBuf,
}

static LOGGER: OnceLock<Logger> = OnceLock::new();

pub fn init() -> Result<PathBuf, String> {
    if let Some(logger) = LOGGER.get() {
        return Ok(logger.file_path.clone());
    }

    let working_dir = std::env::current_dir().map_err(|error| error.to_string())?;
    let logs_dir = working_dir.join("logs");
    create_dir_all(&logs_dir).map_err(|error| error.to_string())?;

    let file_name = format!("{}.log", Local::now().format("%Y-%m-%d-%H-%M-%S"));
    let file_path = logs_dir.join(file_name);
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .map_err(|error| error.to_string())?;

    LOGGER
        .set(Logger {
            file: Mutex::new(file),
            file_path: file_path.clone(),
        })
        .map_err(|_| "logger already initialized".to_string())?;

    Ok(file_path)
}

pub fn error(module: &str, message: impl AsRef<str>) {
    log(LogLevel::Error, module, message);
}

pub fn warn(module: &str, message: impl AsRef<str>) {
    log(LogLevel::Warn, module, message);
}

pub fn info(module: &str, message: impl AsRef<str>) {
    log(LogLevel::Info, module, message);
}

pub fn debug(module: &str, message: impl AsRef<str>) {
    log(LogLevel::Debug, module, message);
}

pub fn log(level: LogLevel, module: &str, message: impl AsRef<str>) {
    let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
    let line = format!(
        "[{timestamp}] [{}] [{}] {}\n",
        level.as_str(),
        module,
        message.as_ref()
    );

    match level {
        LogLevel::Error | LogLevel::Warn => eprint!("{line}"),
        LogLevel::Info | LogLevel::Debug => print!("{line}"),
    }

    if let Some(logger) = LOGGER.get() {
        if let Ok(mut file) = logger.file.lock() {
            let _ = file.write_all(line.as_bytes());
            let _ = file.flush();
        }
    }
}
