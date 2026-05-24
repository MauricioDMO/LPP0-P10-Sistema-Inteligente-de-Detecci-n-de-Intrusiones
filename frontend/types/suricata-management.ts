export type SuricataProfile = {
  id: string;
  name: string;
  description: string | null;
  mode: "IDS" | "IPS";
  sensitivity: "low" | "medium" | "high";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SuricataSource = {
  id: string;
  source_name: string;
  display_name: string;
  description: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type RuleOverride = {
  id: string;
  profile_id: string;
  gid: number;
  sid: number;
  action: "enable" | "disable" | "drop" | "alert" | "reject";
  reason: string | null;
  enabled: boolean;
  notify_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomRule = {
  id: string;
  profile_id: string;
  name: string;
  description: string | null;
  rule_text: string;
  enabled: boolean;
  notify_enabled: boolean;
  validation_status: "pending" | "valid" | "invalid";
  validation_error: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplyJob = {
  id: string;
  profile_id: string;
  status: "pending" | "running" | "success" | "failed";
  started_at: string | null;
  finished_at: string | null;
  generated_files: Record<string, string> | null;
  command_output: string | null;
  error_message: string | null;
  created_at: string;
};

export type SuricataStatus = {
  container_running: boolean;
  active_profile: SuricataProfile | null;
  last_job: ApplyJob | null;
};

export type ProfileCreatePayload = {
  name: string;
  description?: string | null;
  mode: "IDS" | "IPS";
  sensitivity: "low" | "medium" | "high";
};

export type RuleOverrideCreatePayload = {
  gid: number;
  sid: number;
  action: RuleOverride["action"];
  reason?: string | null;
  enabled: boolean;
  notify_enabled?: boolean;
};

export type RuleOverrideUpdatePayload = Partial<RuleOverrideCreatePayload>;

export type CustomRuleCreatePayload = {
  name: string;
  description?: string | null;
  rule_text: string;
  enabled: boolean;
  notify_enabled?: boolean;
};

export type CustomRuleUpdatePayload = Partial<CustomRuleCreatePayload>;

export type TelegramChatRecipient = {
  name: string;
  chat_id: string;
};

export type NotificationSettings = {
  id: string;
  telegram_enabled: boolean;
  telegram_chat_recipients: TelegramChatRecipient[];
  buffer_enabled: boolean;
  buffer_minutes: number;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type NotificationSettingsUpdatePayload = Partial<Omit<NotificationSettings, "id" | "created_at" | "updated_at">>;
