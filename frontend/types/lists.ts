export type ListType = "block" | "allow";
export type ListEntryType = "domain" | "ip" | "cidr";
export type ListDirection = "source" | "destination" | "both";
export type ListAction = "drop" | "reject" | "pass";

export type ListEntry = {
  id: string;
  profile_id: string;
  list_type: ListType;
  entry_type: ListEntryType;
  value: string;
  direction: ListDirection;
  action: ListAction;
  reason: string | null;
  enabled: boolean;
  generated_rule_ids: string[];
  created_by_id: string | null;
  updated_by_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ListEntryPayload = {
  profile_id: string;
  entry_type: ListEntryType;
  value: string;
  direction: ListDirection;
  action?: ListAction | null;
  reason?: string | null;
  enabled: boolean;
};

export type ListEntryUpdatePayload = Partial<Omit<ListEntryPayload, "profile_id">>;

export type GeneratedRule = {
  list_entry_id: string;
  rule_text: string;
};

export type GeneratedRulesResponse = {
  rules: GeneratedRule[];
};
