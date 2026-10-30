import type { Json } from "./json";
type Rpc<Args, Returns = undefined> = { Args: Args; Returns: Returns };
type Scope = { p_organization_id: string };
export type LoyaltyFunctions = {
  admin_save_module_price: Rpc<{
    p_module: string;
    p_price_minor: number;
    p_currency: string;
  }>;
  get_loyalty_config: Rpc<Scope, Json>;
  get_loyalty_accounts: Rpc<
    Scope & { p_search?: string; p_offset?: number },
    Json
  >;
  get_loyalty_customer: Rpc<
    Scope & { p_customer_id: string; p_offset?: number },
    Json
  >;
  get_loyalty_card: Rpc<{ p_token: string; p_visitor: string }, Json>;
  save_loyalty_program: Rpc<
    Scope & { p_version: number | null; p_data: Json; p_services: Json },
    string
  >;
  set_loyalty_program_active: Rpc<
    Scope & { p_version: number; p_active: boolean }
  >;
  save_loyalty_reward: Rpc<
    Scope & { p_id: string | null; p_version: number | null; p_data: Json },
    string
  >;
  adjust_loyalty_balance: Rpc<
    Scope & {
      p_customer_id: string;
      p_amount: number;
      p_reason: string;
      p_reference: string | null;
      p_request_key: string;
    },
    string
  >;
  redeem_loyalty_reward: Rpc<
    Scope & {
      p_customer_id: string;
      p_reward_id: string;
      p_reward_version: number;
      p_request_key: string;
    },
    string
  >;
  void_loyalty_redemption: Rpc<
    Scope & {
      p_redemption_id: string;
      p_reason: string;
      p_request_key: string;
    },
    string
  >;
  issue_loyalty_card: Rpc<
    Scope & { p_customer_id: string; p_token_hash: string }
  >;
  revoke_loyalty_card: Rpc<Scope & { p_customer_id: string }>;
};
