use serde::Deserialize;
use std::collections::HashMap;

/// 单类发票的规则配置
#[derive(Debug, Clone, Deserialize)]
pub struct InvoiceTypeConfig {
    pub keywords: Vec<String>,
    pub patterns: HashMap<String, Vec<String>>,
}

/// 完整规则配置（对应 rules.yaml 顶层结构）
#[derive(Debug, Clone, Deserialize)]
pub struct RulesConfig {
    pub invoice_types: HashMap<String, InvoiceTypeConfig>,
}

impl RulesConfig {
    /// 从 embed 的 YAML 字符串加载规则
    pub fn load() -> Result<Self, String> {
        let yaml_str = include_str!("rules.yaml");
        serde_yaml::from_str(yaml_str).map_err(|e| format!("规则文件解析失败: {e}"))
    }
}