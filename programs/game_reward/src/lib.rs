use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint};

pub mod instructions;
pub mod states;
pub mod errors;
pub mod constants;

use instructions::*;

declare_id!("9aTkaPCVPwJVP1rsps4GyBdCHeGTnQCtF6FHACocBwjZ");

#[program]
pub mod game_reward {
    use super::*;

    pub fn initialize_config(ctx: Context<InitializeConfig>, points_to_claim: u64) -> Result<()> {
        instructions::initialize_config::handler(ctx, points_to_claim)
    }

    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        instructions::check_in::handler(ctx)
    }
}

#[derive(Accounts)]
pub struct Initialize {}
