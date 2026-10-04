export type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
};

export type CustomerOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  archived_at: string | null;
};

export type CustomerActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
};
