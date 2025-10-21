use anchor_lang::prelude::*;

pub mod instructions;
pub mod states;
pub mod errors;
pub mod constants;

use instructions::*;

declare_id!("9aTkaPCVPwJVP1rsps4GyBdCHeGTnQCtF6FHACocBwjZ");

#[program]
pub mod game_reward {
    use super::*;

    pub fn initialize_config(ctx: Context<InitializeConfig>, points_to_claim: u64, reward_amount: u64) -> Result<()> {
        instructions::initialize_config::handler(ctx, points_to_claim, reward_amount)
    }

    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        instructions::check_in::handler(ctx)
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        instructions::claim::handler(ctx)
    }

    pub fn create_mock_token(ctx: Context<CreateMockToken>, decimals: u8) -> Result<()> {
        instructions::mock_token::create_mock_token_handler(ctx, decimals)
    }


    pub fn fund_vault(ctx: Context<FundVault>, amount: u64) -> Result<()> {
        instructions::mock_token::fund_vault_handler(ctx, amount)
    }
}

#[derive(Accounts)]
pub struct Initialize {}
