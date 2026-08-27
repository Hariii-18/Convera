export type User = {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  timezone: string;
  created_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
};
